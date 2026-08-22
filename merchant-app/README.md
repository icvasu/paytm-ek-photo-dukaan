# Merchant Business Demo

An unofficial Paytm-for-Business-style merchant web app built for the “AI for Small Businesses” hackathon theme. This is a local prototype, is not affiliated with or endorsed by Paytm, and does not use real Paytm APIs or credentials.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). The single Vite process starts both the React UI and the in-memory REST API. Use `npm run build` for a production frontend build.

## Demo flow

1. Open Home and review today’s sales, transaction counts, settlement balance, and insight.
2. Tap **Collect**, enter an amount and select a customer.
3. Submit and watch processing become success; the Soundbox banner appears when enabled.
4. Return Home to see sales and recent payments update.
5. Collect ₹13 (or use “fail” in the note) to demonstrate a failed payment.
6. Open a successful unsettled payment and refund it.
7. Open **My QR**, set an amount, and simulate a customer scan-and-pay.
8. Open **Business → Customers** to see spend derived from linked transactions.
9. Open **Settlements** and settle the available balance; linked transactions update.
10. Review the charts and rule-based recommendations under **Smart insights**.
11. Read notifications and verify the unread badge changes.
12. Use **Profile → Reset demo data** to restore the original scenario.

## UI routes

- `/#/` Home
- `/#/payments`, `/#/payments/:id`
- `/#/collect`, `/#/qr`
- `/#/business`
- `/#/customers`, `/#/customers/:id`
- `/#/settlements`, `/#/insights`
- `/#/notifications`, `/#/search`, `/#/profile`

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
- The API is available through `npm run dev`; a static production build needs a separately hosted backend.
- UI persistence and API memory are separate demo projections; reset synchronizes both.
- There is no authentication, multi-merchant tenancy, bank connectivity, real-time webhook handling, or production security hardening.
