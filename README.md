# Ek Photo Dukaan

**One photo → a digital dukaan a kirana owner will actually use.**

Unofficial prototype for the Paytm AI Hackathon (Hyderabad) · Theme 2: *AI for Small Businesses*. **Not affiliated with or endorsed by Paytm.** No production credentials. In-app labelling stays **PROTOTYPE**.

Every inventory app starts by asking the owner to type items, prices and stock. A person with a queue at the counter will not do that. We never ask. Photograph the printed rate card (or start from a labelled sample shop), review the catalog, share a customer price-list QR, then let Paytm amounts you already collect become restock signal.

Payments are the **base rail**, not the pitch.

<p align="center">
  <img src="merchant-app/docs/screens/home.png" alt="Home — Ek Photo Dukaan shortcut inside the merchant shell" width="280" />
  <img src="merchant-app/docs/screens/dukaan-scan.png" alt="Scan — one photo or a sample shop" width="280" />
  <img src="merchant-app/docs/screens/dukaan-manage.png" alt="Manage — editable catalog, QR and restock" width="280" />
  <img src="merchant-app/docs/screens/public-dukaan.png" alt="Public customer price list with UPI QR" width="280" />
</p>

More captures: [`merchant-app/docs/screens/`](merchant-app/docs/screens/).

---

## 5-minute judge demo

Phone-width browser (~390px). From `merchant-app/`: `npm install && npm run dev` → [http://127.0.0.1:5173](http://127.0.0.1:5173).

| Min | Show |
| --- | --- |
| 0:00 | **Profile → Reset to sample data.** Home: Meena’s seeded sales, empty dukaan. |
| 0:30 | Tap **Ek Photo Dukaan**. Use the printed rate-card **sample** (fast, labelled) *or* photograph a real card (on-device OCR). |
| 1:30 | Review prices, toggle availability, preview `/#/dukaan/meena-kirana`. Show QR / copy / WhatsApp draft. |
| 2:30 | **Add supplier bill** (sample Sharma Traders). Collect **₹45**, confirm the Thums Up basket on the receipt. |
| 3:30 | **Approve reorder** → WhatsApp draft → **Mark as paid and received** (simulated payout). Catalog ranges update. |
| 4:30 | Insights + honesty: “no bank API, no WhatsApp Cloud send, stock is a range.” Reset again. |

Full click path: [`merchant-app/docs/DEMO.md`](merchant-app/docs/DEMO.md). Spoken script: [`merchant-app/docs/SPEAKER_SCRIPT.md`](merchant-app/docs/SPEAKER_SCRIPT.md).

---

## How to run

```bash
cd merchant-app
npm install
npm run dev          # UI + in-memory demo API on http://127.0.0.1:5173
```

```bash
npm run build        # tsc + Vite production frontend
npm run lint         # oxlint
npm test             # vitest (UPI, OCR parse, basket solver, samples)
```

The deployable app **is `merchant-app/`**, not this repository root. On Vercel set **Root Directory → `merchant-app`**. If that setting is left at `/`, the root [`vercel.json`](vercel.json) fails the build on purpose instead of shipping an empty site.

---

## Hash routes

| Route | Screen |
| --- | --- |
| `/#/` | Home — sales, Collect / My QR, Ek Photo Dukaan CTA |
| `/#/dukaan/scan` | One photo or labelled sample shop → catalog |
| `/#/dukaan/manage` | Edit items, share QR/link/WhatsApp, restock, reorder |
| `/#/dukaan/invoice` | Supplier bill (sample matching the loaded shop) |
| `/#/dukaan/:slug` | Customer price list + shop UPI QR (`meena-kirana`) |
| `/#/collect` `/#/qr` | Collect payment · My QR (real `upi://pay` intent) |
| `/#/payments` `/#/payments/:id` | Ledger + receipt + basket confirm |
| `/#/business` `/#/customers` `/#/customers/:id` | Business hub · customer history |
| `/#/settlements` `/#/insights` | Simulated settle · rule-based insights |
| `/#/notifications` `/#/search` `/#/profile` | Alerts, search, reset demo |

---

## Stack

React 19 + TypeScript + Vite 8 · hash router · Zustand · Recharts · `qrcode.react` · `tesseract.js` (browser OCR) · Vite middleware / Vercel function (`server/demoApi.ts`) · optional Upstash Redis for shared demo state.

---

## Honest limits

| Claim | Reality |
| --- | --- |
| Catalog from a **photo you take** | **Real** on-device OCR + line parse + fuzzy product match. Handwriting is out. |
| Catalog from a **sample shop** | **Fixture** — pre-written rows, labelled as such. Use this on stage. |
| UPI QR | **Real** NPCI `upi://pay` URI. Money moves only if you set a real VPA (`VITE_MERCHANT_VPA`). Default is a fake placeholder. |
| Payment received / settlement / refund / supplier payout | **Simulated** local ledger. No Paytm API, no webhook, no bank. |
| WhatsApp | Opens a `wa.me` draft. We do not send via Cloud API. |
| Stock | **Range + heuristic**, never a fake exact count. Demand model is exponential smoothing with stated limits. |
| Persistence on Vercel | Instance memory unless Redis env vars are set. `/api/health` reports the mode. Public `meena-kirana` always seeds a demo catalog on a cold start. |

Do not say “Paytm is live” or “the model learned today.”

---

## For judges

| Doc | Why |
| --- | --- |
| [`merchant-app/docs/PITCH.html`](merchant-app/docs/PITCH.html) | Open in a browser — 16:9 pitch deck |
| [`merchant-app/docs/DEMO.md`](merchant-app/docs/DEMO.md) | 8–12 step walkthrough + API smoke |
| [`merchant-app/docs/SPEAKER_SCRIPT.md`](merchant-app/docs/SPEAKER_SCRIPT.md) | What to say in 3 minutes |
| [`merchant-app/docs/JUDGE_DEFENSE.md`](merchant-app/docs/JUDGE_DEFENSE.md) | Likely questions, honest answers |
| [`merchant-app/docs/FEATURES.md`](merchant-app/docs/FEATURES.md) | Every user-facing feature, REAL vs SIMULATED |
| [`merchant-app/docs/ARCHITECTURE.md`](merchant-app/docs/ARCHITECTURE.md) | Photo → catalog → QR → restock |
| [`merchant-app/docs/PAYTM_INTEGRATION.md`](merchant-app/docs/PAYTM_INTEGRATION.md) | What is a real UPI QR vs a fake charge |
| [`merchant-app/docs/DEPLOY.md`](merchant-app/docs/DEPLOY.md) | Vercel root directory, env, persistence |
| [`merchant-app/README.md`](merchant-app/README.md) | Routes, API, how to run the app |

Hackathon **brief** (north star, two-photo loop): [`Paytm_Ek_Photo_Dukaan_Brief.md`](Paytm_Ek_Photo_Dukaan_Brief.md) · [PDF](Paytm_Ek_Photo_Dukaan_Brief.pdf). Theme list: [`Paytm_AI_Hackathon_Themes_Hyderabad.pdf`](Paytm_AI_Hackathon_Themes_Hyderabad.pdf).

`Paytm_QR_Rakshak_*` in this repo is a **different, abandoned idea**. It is not this product and is not in the demo.

---

## Repo layout

```
merchant-app/          ← product (set this as the Vercel root)
  src/                 React merchant shell + dukaan + intelligence
  server/demoApi.ts    Seeded in-memory (or Redis) REST API
  docs/                Judge + teammate docs + screenshots
CONTRIBUTING.md        Two-person staging workflow
LICENSE                MIT + hackathon notice
```

Teammates: **icvasu** (owner) · **@Jaiaggarwaaaaal** (write). Branch features off `staging`; promote to `main` only when the judged walkthrough works. See [CONTRIBUTING.md](CONTRIBUTING.md).
