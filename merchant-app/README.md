# Ek Photo Dukaan merchant demo

Unofficial hackathon prototype: **one photo → digital dukaan** inside a Paytm-for-Business-style shell. A printed rate-card photo (or a labelled sample shop) becomes an editable catalog, a shareable customer price list / QR, and heuristic restock. Payments are the host rail, not the pitch. Not affiliated with or endorsed by Paytm. No production credentials.

**For judges:** [docs/PITCH.html](docs/PITCH.html) · [docs/DEMO.md](docs/DEMO.md) · [docs/SPEAKER_SCRIPT.md](docs/SPEAKER_SCRIPT.md) · [docs/JUDGE_DEFENSE.md](docs/JUDGE_DEFENSE.md) · [docs/FEATURES.md](docs/FEATURES.md) · [docs/PAYTM_INTEGRATION.md](docs/PAYTM_INTEGRATION.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DEPLOY.md](docs/DEPLOY.md). Repo clone / branches: [CONTRIBUTING.md](../CONTRIBUTING.md). Screenshots: [docs/screens/](docs/screens/).

**Deploying?** [docs/DEPLOY.md](docs/DEPLOY.md). Vercel **Root Directory must be `merchant-app`**. Env vars are optional — see [`.env.example`](.env.example).

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5173 — UI + demo API
npm run build        # tsc + Vite production frontend
npm run lint
npm test
```

One Vite process serves the React UI and the in-memory REST API.

## Demo flow

1. Profile → **Advanced** → **Reset to sample data** (the developer affordances live in that collapsed section).
2. Home → scroll to **More for your business** → **Ek Photo Dukaan**. It sits below today's sales, the Collect / My QR pair and the settlement balance; the **Business** tab has the same entry as a one-tap row.
3. Use a labelled **sample shop** (repeatable fixture — this is the judged tap), or run real on-device OCR by photographing a printed rate card or tapping a **sample photo**.
4. Review / edit prices and availability.
5. Preview `/#/dukaan/meena-kirana`. Show QR, copy link, WhatsApp draft.
6. Add the matching **sample supplier bill** (Sri Balaji Distributors, ₹7,175). Collect ₹45 and confirm the Thums Up basket — one exact basket, 92% confidence.
7. Approve reorder, open the WhatsApp draft, mark paid/received (simulated).
8. Reset again.

## Hash routes

- `/#/` Home
- `/#/payments`, `/#/payments/:id`
- `/#/collect`, `/#/qr`
- `/#/business`, `/#/customers`, `/#/customers/:id`
- `/#/settlements`, `/#/insights`
- `/#/notifications`, `/#/search`, `/#/profile`
- `/#/dukaan/scan`, `/#/dukaan/manage`, `/#/dukaan/invoice`, `/#/dukaan/:slug`

## Demo REST API

- `GET /api/health` — `{ official: false, persistence, … }`
- `GET /api/merchant` · `GET /api/transactions` · `GET /api/customers` · `GET /api/settlements` · `GET /api/notifications`
- `GET /api/insights` · `GET /api/catalog` · `GET /api/dukaan/:slug`
- `GET /api/supplier` · `GET /api/supplier-orders` · `GET /api/basket-assignments`
- `POST /api/catalog` · `POST /api/catalog/items` · `POST /api/catalog/items/:id` · `…/remove`
- `POST /api/supplier/invoice` · `POST /api/supplier-orders` · `POST /api/supplier-orders/:id/confirm`
- `POST /api/payments` · `POST /api/transactions/:id/basket` · `…/refund` · `…/confirm`
- `POST /api/settlements/instant` · `POST /api/notifications/read` · `POST /api/reset`

Local Vite middleware and the Vercel `api/index.ts` function share `server/demoApi.ts`. Demo-only.

## Architecture

- `src/domain/metrics.ts` — dashboard numbers (do not duplicate in UI).
- `src/intelligence/engine.ts` + `demand.ts` — deterministic insights and days-of-cover.
- `src/domain/basketSolver.ts` — exact-sum basket candidates from a ticket amount.
- `src/services/vision/` — on-device OCR, catalog/invoice parsers, sample fixtures.
- `src/services/paytm/` — `PaytmService` seam + real `upi://pay` builder.
- `server/demoApi.ts` — seeded entities, no secrets.
- `src/store/useMerchantStore.ts` — UI state; persist key `paytm-merchant-demo-v1`.
- `src/data/seed.ts` — Meena Kirana, 22 Aug 2026, 2:35 pm IST.

## Honest limits

- Payment **authorisation**, settlement, refund and supplier payout are **simulated**.
- UPI QR construction is **real**; money moves only if `VITE_MERCHANT_VPA` is a real handle.
- Sample **shops** are **fixtures** (rows we wrote, shown next to a drawing). A user-supplied photo and the two sample **photos** all use **real on-device OCR**, with no fixture behind them — `node server/verifySamplePhotoOcr.mjs` prints what they actually read.
- Stock is a **range / heuristic**, never a fake exact count.
- Receipt identifiers are **ours**: the field is labelled **App payment reference** (`EPD-…`), not “UPI transaction ID”, and settlement refs are `EPD-STL-…`. No NPCI identifier is implied anywhere.
- The affiliation disclosure is stated in full at **Profile → About**; each screen labels its own simulated part where it appears.
- WhatsApp is a `wa.me` draft, not Cloud API send.
- Without Redis, Vercel state is per-instance. `/api/health` reports the mode.
- No auth, multi-merchant tenancy, live Paytm webhooks, or production hardening.

See [docs/FEATURES.md](docs/FEATURES.md) for REAL vs SIMULATED on every screen.
