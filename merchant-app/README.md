# merchant-app

The Ek Photo Dukaan app: a Paytm-for-Business-style merchant shell with the **one photo → digital dukaan** loop inside it. Unofficial hackathon prototype — no Paytm credentials, no real money movement.

Product overview, demo script and honest limits live in the [repo README](../README.md). This file is the developer reference.

## Run

```bash
npm install
npm run dev      # http://localhost:5173 — UI and demo API from one Vite process
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm test         # vitest
```

```bash
node server/verifyJudgePath.mjs      # 40 checks over the judged path (dev server must be running)
node server/verifySamplePhotoOcr.mjs # prints real OCR output for both shipped sample photos
```

Env vars are optional — see [`.env.example`](.env.example). Deploying: [docs/DEPLOY.md](docs/DEPLOY.md). Vercel **Root Directory must be `merchant-app`**.

## Hash routes

| Route | Screen |
| --- | --- |
| `/#/` | Home — today's sales, Collect / My QR, settlement balance, Ek Photo Dukaan under *More for your business* |
| `/#/dukaan/scan` | One photo or a labelled sample shop → catalog |
| `/#/dukaan/manage` | Edit items, share QR / link / WhatsApp, restock, reorder |
| `/#/dukaan/invoice` | Supplier bill photo or the sample bill matching the loaded shop |
| `/#/dukaan/:slug` | Customer price list and shop UPI QR (`meena-kirana`) |
| `/#/collect`, `/#/qr` | Collect payment · My QR (real `upi://pay` intent) |
| `/#/payments`, `/#/payments/:id` | Ledger, receipt, basket confirm |
| `/#/business`, `/#/customers`, `/#/customers/:id` | Business hub · customer history |
| `/#/settlements`, `/#/insights` | Simulated settlement · rule-based insights |
| `/#/notifications`, `/#/search`, `/#/profile` | Alerts, search, reset demo |

## Demo REST API

Local Vite middleware and the Vercel function in `api/index.ts` share `server/demoApi.ts`. Seeded, demo-only, no secrets.

- `GET /api/health` — `{ official: false, persistence, … }`
- `GET /api/merchant` · `/api/transactions` · `/api/customers` · `/api/settlements` · `/api/notifications`
- `GET /api/insights` · `/api/catalog` · `/api/dukaan/:slug`
- `GET /api/supplier` · `/api/supplier-orders` · `/api/basket-assignments`
- `POST /api/catalog` · `/api/catalog/items` · `/api/catalog/items/:id` · `…/remove`
- `POST /api/supplier/invoice` · `/api/supplier-orders` · `/api/supplier-orders/:id/confirm`
- `POST /api/payments` · `/api/transactions/:id/basket` · `…/refund` · `…/confirm`
- `POST /api/settlements/instant` · `/api/notifications/read` · `/api/reset`

## Module map

| Path | Owns |
| --- | --- |
| `src/services/vision/` | On-device OCR, catalog and invoice parsers, sample fixtures |
| `src/domain/basketSolver.ts` | Exact-sum basket candidates from a ticket amount |
| `src/intelligence/engine.ts`, `demand.ts` | Deterministic insights, days-of-cover |
| `src/domain/metrics.ts` | Dashboard numbers — do not recompute these in components |
| `src/services/paytm/` | `PaytmService` seam and the real `upi://pay` builder |
| `src/store/useMerchantStore.ts` | UI state; persist key `paytm-merchant-demo-v1` |
| `src/data/seed.ts` | Meena Kirana, 22 Aug 2026, 2:35 pm IST |
| `server/demoApi.ts` | Seeded entities and the REST surface above |

`src/types/models.ts` is the shared schema — agree changes before editing it.

## Constraints that must hold

- Stock is a **range or flag**, never a fake exact count.
- Receipt identifiers are labelled **App payment reference** (`EPD-…`), never "UPI transaction ID".
- Payment authorisation, settlement, refund and supplier payout stay **simulated** and labelled.
- The demo works with **no API keys** and no network.

REAL vs SIMULATED for every screen: [docs/FEATURES.md](docs/FEATURES.md).
