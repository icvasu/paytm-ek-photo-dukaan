# Feature inventory (what is actually in the app)

Only screens and actions a judge can tap. **REAL** = the implementation does the stated work in this build. **SIMULATED** = UI + local ledger, no Paytm / bank / WhatsApp Cloud / live tenant. **FIXTURE** = pre-written sample data, labelled as such.

Seeded merchant: **Meena Reddy · Meena Kirana & General Store, Ameerpet**. Clock is fixed at the demo seed (22 Aug 2026, afternoon IST).

---

## Merchant shell

| Feature | Status | Where |
| --- | --- | --- |
| Paytm-for-Business-style mobile shell, bottom nav | REAL UI | Home / Payments / Business / Profile |
| Today’s sales, received / pending / failed | REAL math on **seeded + collected** ledger | `/#/` |
| Recent payments list | REAL (seed + new collects) | `/#/`, `/#/payments` |
| Search payments and customers | REAL (client filter) | `/#/search` |
| Notifications, mark read / mark all | REAL against demo API | `/#/notifications` |
| Business hub: 7-day sales, success rate | REAL math | `/#/business` |
| Customer list + detail + spend | REAL on seeded customers | `/#/customers`, `/#/customers/:id` |
| Profile: merchant card, VPA, bank last-4, address | FIXTURE merchant | `/#/profile` |
| Soundbox toggle + notification preference toggles | REAL local prefs | `/#/profile` |
| Reset to sample data | REAL (`POST /api/reset` + local persist) | Profile → Advanced |
| Prototype / unofficial Paytm disclosure | REAL copy | Profile, capture, catalog, QR |

---

## Ek Photo Dukaan

| Feature | Status | Where |
| --- | --- | --- |
| Home CTA into scan or manage | REAL | `/#/` |
| Take / choose a photo of a shelf or printed rate card | REAL camera/file input | `/#/dukaan/scan` |
| On-device OCR (tesseract.js) → line parse → fuzzy lexicon match | REAL, no upload | `analyzePhoto` |
| Two labelled sample shops (kirana shelf, tea-counter rate card) | FIXTURE | Scan → sample cards |
| Honest “reading on this phone” / sample-not-OCR disclosure | REAL | Scan + manage |
| Editable catalog: name, price, availability, add, remove (undo) | REAL API | `/#/dukaan/manage` |
| Stock shown as **range / flag**, never a fake exact count | REAL | Manage items |
| Persist catalog through API (survives refresh while API is up) | REAL | `POST /api/catalog` |
| Public customer price list (search + category chips) | REAL | `/#/dukaan/meena-kirana` |
| Price-list QR, copy link, WhatsApp draft | REAL QR/link; WhatsApp is a draft only | Manage |
| Preview as customer | REAL | Manage → Preview |
| Rebuild from a new photo | REAL | Manage |
| Cold-start public slug `meena-kirana` | FIXTURE fallback | `GET /api/dukaan/meena-kirana` |

---

## Payments loop

| Feature | Status | Where |
| --- | --- | --- |
| Collect amount, customer, method, note | SIMULATED charge | `/#/collect` |
| Processing / success / fail screens + soundbox line | SIMULATED | Collect |
| Forced fail on ₹13 or note containing “fail” | SIMULATED (demo hook) | Profile Advanced |
| Payment list: search, status / method / period / sort | REAL UI | `/#/payments` |
| Receipt: confirm pending, refund (unsettle only) | SIMULATED | `/#/payments/:id` |
| Basket suggestion from amount (subset-sum solver) | REAL solver | Payment detail |
| Merchant-confirmed basket assignment | REAL write to API | `POST /api/transactions/:id/basket` |
| Instant settlement (≥ ₹50 available) | SIMULATED bank ref | `/#/settlements` |
| Settlement history | SIMULATED | Settlements |

---

## Supplier

| Feature | Status | Where |
| --- | --- | --- |
| Photograph a supplier bill (on-device OCR) | REAL | `/#/dukaan/invoice` |
| Load matching sample bill (repeatable demo) | FIXTURE | `/#/dukaan/invoice` |
| Invoice parser (qty × rate arithmetic, SKU link) | REAL | `invoicePipeline.ts` |
| Persist supplier, lines, unit costs, usual-order total | REAL API | `POST /api/supplier/invoice` |
| Approve reorder (idempotent queue) | SIMULATED payout queue | Manage |
| WhatsApp supplier order draft | REAL draft link | Manage |
| Mark as paid and received → stock-in ranges | SIMULATED confirm | `POST /api/supplier-orders/:id/confirm` |

---

## Insights

| Feature | Status | Where |
| --- | --- | --- |
| 14-day sales area chart, hourly activity bar chart | REAL on ledger | `/#/insights` |
| Average ticket, repeat-customer % | REAL metrics | Insights |
| Rule-based cards (peak hour, week delta, restock) | REAL rules, not an LLM | `intelligence/engine.ts` |
| Days-of-cover / reorder forecast from baskets + supplier | REAL heuristic (capped confidence) | Manage + insights |
| Home insight teaser | REAL | `/#/` |

---

## Paytm / UPI

| Feature | Status | Where |
| --- | --- | --- |
| NPCI `upi://pay` URI (validated pa/pn/am/cu/tn/tr) | REAL | `src/services/paytm/upi.ts` |
| My QR: static shop QR or dynamic amount QR | REAL QR; charge still SIMULATED | `/#/qr` |
| Public shop QR (customer enters amount) | REAL QR | Public dukaan |
| “Open UPI app” on devices that support the intent | REAL deep link | QR cards |
| Placeholder VPA notice when `VITE_MERCHANT_VPA` unset | REAL | QR cards |
| Record a counter payment from My QR | SIMULATED ledger | My QR |
| Live Paytm Orders / webhooks / KYC | **Not implemented** | — |

---

## AI / vision / intelligence

| Feature | Status | Notes |
| --- | --- | --- |
| Browser OCR | REAL | tesseract.js, no server upload |
| Catalog line parser + product lexicon | REAL | Printed type; handwriting out |
| Invoice line parser + arithmetic check | REAL parser | Judged UI still uses the sample bill |
| Fuzzy name match | REAL | Thresholded; no forced near-miss |
| Basket inference | REAL | Honest `no_solution` / `ambiguous` |
| Demand / days-of-cover | REAL heuristic | Exponentially weighted; limits stated |
| Generative LLM insights | **Not implemented** | Adapter seam exists in comments only |
