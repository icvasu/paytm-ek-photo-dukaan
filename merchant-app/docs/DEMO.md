# Demo walkthrough (8–12 steps)

**Unofficial prototype** — simulated payments and demo vision. Not official Paytm.

Phone-width browser (DevTools responsive, ~390px) looks like the merchant app. Use `http://localhost:5173` after `npm run dev` from `merchant-app/`.

If **Ek Photo Dukaan** UI routes are not on your branch yet, steps 1–4 still work for the **payments shell**; steps 5–11 are the dukaan slice to finish. Catalog APIs can be exercised with `curl` (see below).

---

## Happy path (judges)

1. **Reset** — Profile → **Reset demo data**. Confirm Home shows Meena’s seeded sales and an empty dukaan (no leftover catalog from a previous run).
2. **Home** — Point at today’s sales, LIVE DEMO pill, and the **Ek Photo Dukaan** shortcut (or `/#/dukaan` when shipped).
3. **One photo** — Use the seeded **Meena shelf** sample, or upload a file whose name contains `meena`, `shelf`, or `kirana` (demo vision key). For the tea-counter list, name the file with `rate`, `counter`, or `tea`.
4. **Honest stages** — Show upload → “reading” → catalog. Read the disclosure: demo mapping, not production OCR.
5. **Review stock ranges** — e.g. Thums Up **low**, Amul **out / missing**. Never claim an exact pack count.
6. **Edit** — Change one price or toggle availability. Merchant is source of truth.
7. **Publish** — Catalog is stored via `POST /api/catalog`. Refresh the page; list should remain (API + persist).
8. **Customer list** — Open `/#/dukaan/meena-kirana` (or in-app customer view). Same items, read-only.
9. **QR + share** — Show QR for that URL (or dukaan payload). Copy link. Open WhatsApp-ready text (`wa.me` draft). Do not claim the message was sent by an API.
10. **Restock hint** — Smart insights (`/#/insights`) or dukaan card: unavailable/low items plus overlap with successful Paytm ticket amounts.
11. **Existing Paytm loop (30s)** — Collect a payment or My QR scan so judges see the shop already runs on Paytm rails (simulated). Optional: Collect ₹13 / note `fail` for a failed payment.
12. **Reset again** — Catalog gone; payments seed back. Proves demo-mode, not a production tenant.

---

## 3-minute timing

Use the table in [V0.md](./V0.md). Do not open QR Rakshak, GST, or a chatbot. If Wi-Fi dies, replay the **named sample file** so vision still returns `confidence: high`.

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

---

## Failure / honesty checks

- Upload `random.png` (name does not match heuristics) → **starter** list + “could not reliably read” note.
- Handwriting: do **not** use as the judged path.
- Cash: if asked, “we see Paytm sales clearly; cash is a prior.”
