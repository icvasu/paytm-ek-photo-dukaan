# Paytm integration surface

What is real in this prototype, what is simulated, and exactly what would change
to run it on live Paytm for Business APIs.

This document exists because the difference matters. A UPI intent QR that opens
a real payment app is genuinely real. A bank confirmation printed by our own
server is not, and this prototype never claims otherwise.

---

## 1. What is real today

### Standards-compliant UPI intent URIs

`src/services/paytm/upi.ts` builds NPCI UPI deep links — the same string a
printed Paytm QR encodes:

```
upi://pay?pa=<vpa>&pn=<payeeName>&am=<amount>&cu=INR&tn=<note>&tr=<txnRef>
```

Every parameter is validated before it is encoded, because a malformed
`upi://` link fails silently inside the payment app: the QR scans and then
nothing happens.

| Rule | Why |
| --- | --- |
| `pa` must match `handle@psp` | A bad VPA produces a dead link |
| `pn`, `tn` percent-encoded | An `&` in "Meena Kirana & General Store" would split the query |
| `am` always `0.00` format | UPI requires a plain 2-decimal decimal |
| `am` between ₹1 and ₹1,00,000 | Outside this, apps reject the request |
| `tn` clamped to 50 chars | NPCI limit |
| `tr` uppercase alphanumeric, 35 chars | NPCI limit; used for reconciliation |
| Empty parameters omitted entirely | Some apps choke on `tn=` with no value |

Sub-paise amounts are rejected rather than silently rounded, and control
characters are stripped before encoding.

Covered by 17 tests in `src/services/paytm/upi.test.ts`, including a
round-trip through `parseUpiIntent` so what we encode is provably what a
scanner reads.

### Where the QR appears

| Surface | QR type | Amount |
| --- | --- | --- |
| Merchant "My QR" screen | Dynamic when an amount is typed, static otherwise | From the amount field |
| Public storefront (`/dukaan/:slug`) | Static shop QR | Customer enters it |

`upi://` only resolves where a UPI app is installed. On desktop the tappable
"Open UPI app" button is hidden and the QR is shown instead — see
`supportsUpiIntentLink()`.

### Payee configuration

The VPA is read from `VITE_MERCHANT_VPA` (see `.env.example`). When unset or
malformed it falls back to `example.merchant@upi`, a deliberately fake
placeholder, and every QR card renders a visible notice saying the QR is a
valid UPI request to a placeholder ID so no money can move.

No real VPA is hardcoded, and the placeholder is not designed to look real.

---

## 2. Real vs simulated

| Capability | Status | Notes |
| --- | --- | --- |
| UPI intent URI construction | **Real** | NPCI-spec `upi://pay`, validated and encoded |
| Scannable UPI QR | **Real** | Opens Paytm / GPay / PhonePe with fields prefilled |
| Deep-link handoff to a payment app | **Real** | `upi://` intent on Android/iOS |
| On-device catalog OCR | **Real** | `tesseract.js`, runs in the browser, no upload |
| Item name resolution | **Real** | Fuzzy match to a product lexicon |
| Basket inference from amount | **Real** | Bounded subset-sum solver over catalog prices |
| Demand / days-of-cover | **Real** | Exponentially weighted rate, stated limits |
| Payment *authorisation* | **Simulated** | `POST /api/payments` writes to a local ledger |
| Payment status / callback | **Simulated** | No Paytm webhook is received |
| Settlement to bank | **Simulated** | Bank reference is generated locally |
| Refunds | **Simulated** | Local ledger only |
| Merchant onboarding / KYC | **Not implemented** | Out of scope |

**The honest boundary:** scanning a QR from this app really does open a real
payment app on a real amount. Everything after that — authorisation, the
success callback, settlement — is simulated locally, because it needs merchant
credentials we do not have and must not fake.

A payment recorded through "Record a counter payment" is a prototype ledger
entry. It is never presented as a confirmed bank settlement.

---

## 3. The adapter seam

All payment I/O goes through one interface, so swapping the simulator for live
Paytm APIs is a single-file change with no UI churn.

```
src/services/paytm/PaytmService.ts
  interface PaytmService          <- the seam
    charge(...)                   -> Paytm Orders + Payment Status API
    settleNow(...)                -> Paytm Settlement API
  class DemoPaytmService          <- in-process simulator (offline demo)
  class ApiPaytmService           <- talks to our own /api (current default)
  class LivePaytmService          <- would talk to Paytm (not implemented)

src/services/container.ts         <- one line picks the implementation
```

`src/services/paytm/upi.ts` sits *outside* the seam on purpose: UPI intent
construction is a client-side standard, not a Paytm API call, so it is already
production-correct and needs no credentials.

### Call-by-call mapping to production

| Seam method | Today | In production |
| --- | --- | --- |
| `charge()` | `POST /api/payments` → local ledger | **Create Order** then **Initiate Transaction** (Paytm Payment Gateway), returning a `txnToken` |
| — | n/a | **Payment Status API**, polled as the reconciliation fallback |
| — | n/a | **Webhook / callback**: Paytm's server-to-server notification, the authoritative event |
| `settleNow()` | `POST /api/settlements/instant` → local ref | **Settlement API** / Instant Settlement, returning a real UTR |
| `qrPayload()` | Already real | Unchanged — or **Create Dynamic QR** for a Paytm-managed QR with a `qrCodeId` |

Order and transaction identifiers already follow Paytm's shape
(`paytmStyleTxnId`), so the ledger schema does not change when the source
becomes real.

---

## 4. Webhook flow that would drive stock decrement

Today stock changes only when the merchant confirms a basket, because we have
no trustworthy payment event. In production the webhook becomes the trigger and
the merchant confirms the *items*, not the payment.

```
Customer scans the UPI QR
        │  upi://pay?pa=...&am=45.00&tr=EPD7K2QX
        ▼
Customer's UPI app  ──authorises──▶  NPCI  ──▶  Paytm
                                                  │
                    ┌─────────────────────────────┘
                    ▼
        POST /api/paytm/webhook          (server-to-server, signed)
        { orderId, txnId, txnAmount, status: TXN_SUCCESS, checksumhash }
                    │
                    ├─ 1. Verify checksum with the merchant key      ── reject if invalid
                    ├─ 2. Look up our order by `tr` / orderId        ── reject if unknown
                    ├─ 3. Assert txnAmount == the amount we requested ── reject on mismatch
                    ├─ 4. Idempotency: ignore a txnId already applied
                    ├─ 5. Write the transaction as confirmed
                    ├─ 6. Run the basket solver on the confirmed amount
                    │      └─ unambiguous  → decrement stock, flag "auto-attributed"
                    │      └─ ambiguous    → queue for one-tap merchant confirmation
                    └─ 7. Return 200 so Paytm stops retrying
```

Four properties this design needs, none of which are optional:

1. **Checksum verification.** An unsigned webhook is an open endpoint for
   inventing payments.
2. **Idempotency on `txnId`.** Paytm retries until it gets a 200, so the same
   event must not decrement stock twice.
3. **Amount assertion.** The webhook amount must equal what we encoded in the
   QR; a mismatch means the QR was tampered with or reused.
4. **Ambiguity gate.** An amount does not identify a basket. When the solver
   returns several exact-sum baskets, stock must wait for the merchant rather
   than guess — otherwise the register drifts and the whole feature loses trust.

The `tr` (transaction reference) already generated for every dynamic QR is what
makes step 2 possible: it is the join key between a QR we rendered and a
webhook we later receive.

### What is missing to switch this on

- Paytm merchant ID and key (from Paytm for Business onboarding)
- A public HTTPS callback URL registered with Paytm
- Persistent storage for the order → reference mapping (the demo has an
  optional KV store; see `.env.example`)

No code outside `PaytmService.ts`, the new webhook route, and
`services/container.ts` would need to change.

---

## 5. Verifying the claims in this document

```bash
# UPI URI construction, encoding and limits
npx vitest run src/services/paytm/upi.test.ts

# Basket solver: exact sums, no-solution honesty, adversarial amounts
npx vitest run src/domain/basketSolver.test.ts

# OCR line parsing and fuzzy lexicon resolution
npx vitest run src/services/vision/parseCatalog.test.ts src/intelligence/fuzzy.test.ts
```

To check a QR by hand: open the "What this QR encodes" panel under any QR in
the app. It prints the exact `upi://pay?...` string that was encoded. Scan the
QR with a phone camera and compare.
