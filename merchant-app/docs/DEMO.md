# Demo walkthrough (8–12 steps)

**Unofficial prototype** — simulated payments and demo vision. Not official Paytm.

Phone-width browser (DevTools responsive, ~390px) looks like the merchant app. Use `http://localhost:5173` after `npm run dev` from `merchant-app/`.

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
10. **Restock hint** — On the dukaan manager, show unavailable/low photo flags plus overlap with successful seeded Paytm ticket amounts. Call it a heuristic, not a model forecast.
11. **Existing Paytm loop (30s)** — Collect a payment or My QR scan so judges see the shop already runs on Paytm rails (simulated). Optional: Collect ₹13 / note `fail` for a failed payment.
12. **Reset again** — Catalog gone; payments seed back. Proves demo-mode, not a production tenant.

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

---

## Failure / honesty checks

- Upload `random.png` (name does not match heuristics) → **starter** list + “could not reliably read” note.
- Handwriting: do **not** use as the judged path.
- Cash: if asked, “we see Paytm sales clearly; cash is a prior.”
