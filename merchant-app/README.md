# Ek Photo Dukaan merchant demo

An unofficial hackathon prototype for **one photo → digital dukaan** inside a Paytm-for-Business-style shell. A printed rate-card photo becomes an editable catalog, shareable customer price list/QR and heuristic restock hint. Merchant payments are the base signal and host experience, not the pitch. This project is not affiliated with or endorsed by Paytm and uses no real Paytm APIs or credentials.

**Teammate docs (Ek Photo Dukaan V0):** [docs/V0.md](docs/V0.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DEMO.md](docs/DEMO.md) · [docs/TEAM.md](docs/TEAM.md). Repo clone and branches: root [CONTRIBUTING.md](../CONTRIBUTING.md).

## Run

```bash
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). The single Vite process starts both the React UI and the in-memory REST API. Use `npm run build` for a production frontend build.

## Demo flow

1. On Home, tap **Ek Photo Dukaan**.
2. Use the bundled printed tea-counter rate card or upload an image.
3. Read the demo-vision disclosure; the current adapter is seeded and does not inspect pixels.
4. Review and edit the generated catalog.
5. Show the heuristic restock hint, share QR/link and WhatsApp-ready customer message.
6. Preview the read-only customer price list.
7. Use **Profile → Reset demo data** to clear the catalog and restore the seeded scenario.

Payments, collection, My QR, settlements and insights remain available to establish the existing merchant shell and seeded Paytm-like amount stream.

## UI routes

- `/#/` Home
- `/#/payments`, `/#/payments/:id`
- `/#/collect`, `/#/qr`
- `/#/business`
- `/#/customers`, `/#/customers/:id`
- `/#/settlements`, `/#/insights`
- `/#/notifications`, `/#/search`, `/#/profile`
- `/#/dukaan/scan`, `/#/dukaan/manage`, `/#/dukaan/:slug`

## Demo REST API

- `GET /api/health`
- `GET /api/merchant`
- `GET /api/transactions`, `GET /api/transactions/:id`
- `GET /api/customers`, `GET /api/customers/:id`
- `GET /api/settlements`
- `GET /api/notifications`
- `GET /api/insights`
- `POST /api/payments`
- `POST /api/settlements/instant`
- `POST /api/reset`
- `GET /api/catalog`, `POST /api/catalog`
- `GET /api/dukaan/:slug`
- `POST /api/catalog/items`, `POST /api/catalog/items/:id`, `POST /api/catalog/items/:id/remove`

The API is a Vite development middleware with a seeded in-memory database and localhost CORS. It is demo-only and resets when the dev server restarts.

## Architecture

- `src/domain/metrics.ts` is the single source of truth for dashboard and analytical numbers.
- `src/intelligence/engine.ts` contains deterministic, replaceable insight rules.
- `src/services/paytm/PaytmService.ts` is the payment/settlement interface; `ApiPaytmService` calls the local REST API.
- `server/demoApi.ts` exposes seeded entities and mutations without secrets or external services.
- `src/store/useMerchantStore.ts` manages reactive UI state and persists the demo under `paytm-merchant-demo-v1`.
- `src/data/seed.ts` builds a deterministic Hyderabad merchant scenario at 22 Aug 2026, 2:35 pm IST.

## AI extension points

Replace `IntelligenceEngine.generate()` with an authenticated server-side model adapter. Keep raw transaction data and secrets server-side, retain deterministic metric functions, validate model output, and show provenance to merchants.

## Limitations

- All payments, QR scans, refunds, settlement references, and notifications are simulations.
- Photo interpretation is deterministic filename/size mapping, not production OCR or a real vision model.
- Restock output is a labelled heuristic; supplier invoice capture, basket decomposition, stockout confidence and supplier reorder are not implemented.
- The API is available through `npm run dev`; a static production build needs a separately hosted backend.
- UI persistence and API memory are separate demo projections; reset synchronizes both.
- There is no authentication, multi-merchant tenancy, bank connectivity, real-time webhook handling, or production security hardening.
