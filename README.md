# Ek Photo Dukaan

**One photo → a digital dukaan a kirana owner will actually use.**

Prototype for the **Paytm AI Hackathon · Hyderabad · Theme 2, AI for Small Businesses**. Unofficial: not affiliated with or endorsed by Paytm, no production credentials, no real money movement. The app states this at **Profile → About**, and every simulated surface is labelled where it appears.

Every inventory app starts by asking the owner to type items, prices and stock. A person with a queue at the counter will not do that. We never ask. Photograph the printed rate card, review the catalog, share a customer price list and QR, then let the Paytm amounts already being collected become restock signal.

Payments are the base rail, not the pitch.

<p align="center">
  <img src="merchant-app/docs/screens/home.png" alt="Home — Ek Photo Dukaan inside the merchant shell" width="230" />
  <img src="merchant-app/docs/screens/dukaan-scan.png" alt="Scan — one photo or a sample shop" width="230" />
  <img src="merchant-app/docs/screens/dukaan-manage.png" alt="Manage — editable catalog, QR and restock" width="230" />
  <img src="merchant-app/docs/screens/public-dukaan.png" alt="Customer price list with UPI QR" width="230" />
</p>

---

## The loop

| Step | What happens |
| --- | --- |
| **Photo** | On-device OCR (tesseract.js, no upload) reads a printed rate card into priced rows. |
| **Catalog** | The merchant reviews and edits. The photo is a draft, never the last word. |
| **Storefront** | A customer price list at `/#/dukaan/:slug` with a real `upi://pay` QR. |
| **Attribution** | A ₹45 payment is not just ₹45. A bounded subset-sum solver proposes exact baskets; the merchant confirms one. |
| **Restock** | Confirmed baskets move a stock **range** and days-of-cover. A supplier-bill photo pre-fills the reorder. |

---

## Run it

Node 20+.

```bash
cd merchant-app
npm install
npm run dev      # UI + in-memory demo API on http://localhost:5173
```

```bash
npm run build    # tsc + Vite production frontend
npm run lint     # oxlint
npm test         # vitest — 167 tests (UPI, OCR parse, basket solver, insights, samples)
```

Two harnesses print what the demo actually does, rather than asserting it:

```bash
node server/verifyJudgePath.mjs      # 40 checks over the judged path (needs npm run dev)
node server/verifySamplePhotoOcr.mjs # real OCR output for both shipped sample photos
```

The deployable app is **`merchant-app/`**, not the repository root. On Vercel set **Root Directory → `merchant-app`**; the root [`vercel.json`](vercel.json) fails the build on purpose if that is left at `/`.

---

## 5-minute demo

Phone-width browser (~390px).

| Min | Show |
| --- | --- |
| 0:00 | **Profile → Advanced → Reset to sample data.** Home: Meena's seeded sales, empty dukaan. |
| 0:30 | Home → **More for your business** → **Ek Photo Dukaan**. Use the **Meena's kirana shelf** sample (the judged tap), or prove real OCR with a **sample photo** or your own printed card. |
| 1:30 | Review prices, toggle availability, preview `/#/dukaan/meena-kirana`. QR, copy link, WhatsApp draft. |
| 2:30 | **Add supplier bill** → sample bill (Sri Balaji Distributors, ₹7,175). **My QR → 45 → Record a counter payment** (there is no seeded ₹45 — always create it), then confirm the Thums Up basket. |
| 3:30 | **Approve reorder** → WhatsApp draft → **Mark as paid and received** (simulated). Thums Up moves 2–3 → 1–2 left, ~2 days cover. |
| 4:30 | Insights, then the honesty line: no bank API, no WhatsApp Cloud send, stock is a range. Point at **Profile → About**. |

Use the kirana shelf, not the rate card: on the kirana catalog ₹45 has exactly one basket at 92% confidence; on the rate card it has eight at 28%.

Every route is captured in [`merchant-app/docs/screens/`](merchant-app/docs/screens/), and `journey-01` through `journey-14` are this run in order.

---

## Honest limits

| Claim | Reality |
| --- | --- |
| Catalog from a photo you take | **Real** on-device OCR + line parse + fuzzy product match. Printed type only; handwriting is out of scope. |
| Catalog from a sample shop | **Fixture** — rows we wrote, labelled as such on screen. Repeatable, so it is the stage path. |
| UPI QR | **Real** NPCI `upi://pay` URI. Money moves only if `VITE_MERCHANT_VPA` is a real handle; the default is a placeholder. |
| Payment received, settlement, refund, supplier payout | **Simulated** local ledger. No Paytm API, no webhook, no bank. |
| Receipt identifiers | **Ours.** Labelled **App payment reference** (`EPD-…`), never "UPI transaction ID". Settlements are `EPD-STL-…`. |
| WhatsApp | Opens a `wa.me` draft. No Cloud API send. |
| Stock | **Range plus heuristic**, never a fake exact count. Demand is exponential smoothing with stated limits. |
| Persistence on Vercel | Per-instance memory unless Redis env vars are set; `/api/health` reports the mode. The public `meena-kirana` slug always seeds so a customer QR never 404s. |

Do not say "Paytm is live" or "the model learned today."

---

## Docs

| Doc | Why |
| --- | --- |
| [`docs/PITCH.html`](merchant-app/docs/PITCH.html) | 16:9 pitch deck — open in a browser |
| [`docs/DEMO.md`](merchant-app/docs/DEMO.md) | Full walkthrough, sample-by-sample, with API smoke checks |
| [`docs/SPEAKER_SCRIPT.md`](merchant-app/docs/SPEAKER_SCRIPT.md) | The 5 minutes, timed, with the words to say |
| [`docs/MENTOR_CUE_CARD.md`](merchant-app/docs/MENTOR_CUE_CARD.md) | One page to hold while presenting — run order, the six numbers, recovery lines |
| [`docs/JUDGE_DEFENSE.md`](merchant-app/docs/JUDGE_DEFENSE.md) | Hostile questions, honest answers |
| [`docs/EXPLAIN_SIMPLE.md`](merchant-app/docs/EXPLAIN_SIMPLE.md) | The whole thing in plain words |
| [`docs/FEATURES.md`](merchant-app/docs/FEATURES.md) | Every user-facing feature, REAL vs SIMULATED |
| [`docs/ARCHITECTURE.md`](merchant-app/docs/ARCHITECTURE.md) | Photo → catalog → QR → restock |
| [`docs/PAYTM_INTEGRATION.md`](merchant-app/docs/PAYTM_INTEGRATION.md) | Real UPI QR vs simulated charge, line by line |
| [`docs/DEPLOY.md`](merchant-app/docs/DEPLOY.md) | Vercel root directory, env vars, persistence |
| [`merchant-app/README.md`](merchant-app/README.md) | Routes, demo REST API, module map |

Concept brief: [`Paytm_Ek_Photo_Dukaan_Brief.md`](Paytm_Ek_Photo_Dukaan_Brief.md). Theme list: [`Paytm_AI_Hackathon_Themes_Hyderabad.pdf`](Paytm_AI_Hackathon_Themes_Hyderabad.pdf).

---

## Layout

```
merchant-app/          product — set this as the Vercel root
  src/                 React merchant shell, dukaan, intelligence
  server/demoApi.ts    seeded in-memory (or Redis) REST API
  server/verify*.mjs   judge-path and OCR harnesses
  docs/                judge docs and screenshots
CONTRIBUTING.md        branch workflow
```

Stack: React 19 · TypeScript · Vite 8 · hash router · Zustand · Recharts · `qrcode.react` · `tesseract.js` · Vite middleware / Vercel function · optional Upstash Redis.

MIT licensed — see [LICENSE](LICENSE).
