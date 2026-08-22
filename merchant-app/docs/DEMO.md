# Demo walkthrough (8–12 steps)

**Unofficial prototype** — simulated payments and demo vision. Not official Paytm.

Phone-width browser (DevTools responsive, ~390px) looks like the merchant app. Use `http://localhost:5173` after `npm run dev` from `merchant-app/`, or the production Vercel URL.

The hero path is **one photo → digital dukaan**. Merchant payments are the existing shell and seeded signal source, not the opening pitch.

---

## Happy path (judges)

1. **Reset** — Profile → **Reset demo data**. Confirm Home shows Meena’s seeded sales and an empty dukaan (no leftover catalog from a previous run).
2. **Home** — Point to the **Ek Photo Dukaan** shortcut inside the merchant shell and tap it immediately.
3. **One photo** — Use the seeded printed **tea-counter rate card**, or upload a file. Filenames containing `rate`, `counter`, or `tea` select the deterministic judged sample.
4. **Honest stages** — Show upload → “reading” → catalog. Read the disclosure: demo mapping, not production OCR.
5. **Review stock ranges** — e.g. Thums Up **low**, Limca **not visible**. These are seeded demo estimates, never observed exact counts.
6. **Edit** — Change one price or toggle availability. Merchant is source of truth.
7. **Persist** — Catalog was stored through `POST /api/catalog`. Refresh the page; the API-backed list remains.
8. **Customer list** — Tap Preview to open `/#/dukaan/meena-kirana`. The same items are read-only.
9. **QR + share** — Return to Manage, show the price-list QR, copy the link, and open the `wa.me` draft. Do not claim API delivery.
10. **Supplier bill** — Tap **Scan supplier bill**, use Sharma Traders sample. Supplier, line quantities, unit costs and normal order persist through the API; clearly call it a DEMO heuristic.
11. **Payment → items** — Collect ₹45, open its receipt and confirm the suggested Thums Up basket. Return to Manage; the range/velocity forecast reflects that merchant-confirmed sale.
12. **Restock action** — Approve reorder, open the WhatsApp supplier draft, then simulate payout confirmation. Notification and catalog ranges update; say clearly that no bank API was called.
13. **Reset again** — Catalog, supplier, baskets and orders are gone; payments seed back. Proves demo-mode, not a production tenant.

---

## 3-minute timing

Use the table in [V0.md](./V0.md). Do not open QR Rakshak, GST, or a chatbot. The bundled sample and demo vision work without an external model or network.

---

## API smoke (no UI)

With `npm run dev` running:

```bash
curl -s http://localhost:5173/api/health
curl -s http://localhost:5173/api/catalog
```

After the UI (or a POST) creates a catalog:

```bash
curl -s http://localhost:5173/api/dukaan/meena-kirana
curl -s http://localhost:5173/api/insights
```

`health` should include `"official": false` (demo).

## Vercel and phone QR

Deploy from `merchant-app/` with `npx vercel --prod`. Vercel serves the Vite build and the catch-all Node function in `api/[...path].ts`; that function reuses the same handler as local Vite development.

For durable cross-device edits, connect an Upstash Redis integration in the Vercel project. The API automatically uses either `KV_REST_API_URL` + `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. `/api/health` reports `persistence: "shared-redis"` when configured.

The price-list QR, copied link, and WhatsApp draft are built at runtime from `window.location.origin`, so a production QR points at the current Vercel domain rather than localhost. A phone opening `/#/dukaan/meena-kirana` fetches `/api/dukaan/meena-kirana` in its own browser. On a cold serverless instance, that endpoint seeds the same 12-item Meena Kirana DEMO catalog.

Without those Redis environment variables, catalog edits and demo payments are kept on `globalThis` for the lifetime of a warm serverless instance. They can reset or differ across concurrent instances. The public phone route always remains demoable through the seeded cold-start catalog, but do not claim durable cross-device edits unless `/api/health` says `shared-redis`.

---

## Failure / honesty checks

- Upload `random.png` (name does not match heuristics) → **starter** list + “could not reliably read” note.
- Handwriting: do **not** use as the judged path.
- Cash: if asked, “we see Paytm sales clearly; cash is a prior.”
