# Demo walkthrough

**Unofficial prototype** — simulated payments and labelled demo fixtures. Not official Paytm.

Phone-width browser (DevTools responsive, ~390px) looks like the merchant app. Use `http://localhost:5173` after `npm run dev` from `merchant-app/`, or the production Vercel URL.

The hero path is **one photo → digital dukaan**. Merchant payments are the existing shell and the signal source, not the opening pitch.

For the 5-minute judged run, use [SPEAKER_SCRIPT.md](./SPEAKER_SCRIPT.md). It is the timed version of this file with the words to say. This document is the fuller walkthrough and the reference for what each screen actually does.

---

## Pick the right sample shop

Two fixtures ship with the app, and the choice changes the demo materially.

| Sample | Use it for | Why |
| --- | --- | --- |
| **Meena's kirana shelf** | **The judged run.** | ₹45 has exactly **one** basket on this catalog: 1× Thums Up 750 ml, 14 combinations searched, 92% confidence. The attribution beat is unambiguous. |
| **Printed rate card** | Showing the ambiguous case on purpose | ₹45 has **8** valid baskets here and confidence drops to 28%. Good for "what happens when the amount is not identifiable", bad as the headline. |

The seeded merchant is **Meena Kirana & General Store** (owner Meena Reddy), so the kirana shelf is also the consistent story.

---

## Happy path (judges)

1. **Reset** — Profile → **Advanced** → **Reset to sample data**. Confirm Home shows Meena's seeded sales and the Ek Photo Dukaan card reads *Turn one photo into your catalog* (no leftover catalog from a previous run).
2. **Home** — Point to the **Ek Photo Dukaan** shortcut inside the merchant shell and tap it. With no catalog it routes to `/dukaan/scan`; with one it routes to `/dukaan/manage`.
3. **One photo** — Tap **Meena's kirana shelf** under *or start from a sample shop*. To show real OCR instead, tap **Take or choose a photo** and supply a printed price list; that path runs tesseract.js on-device. Sample selection is by explicit tap only — there is no longer any filename heuristic.
4. **Honest stages** — For an uploaded photo you see the on-device reading progress. For a sample you see the fixture load. Read the disclosure on Manage: sample rows ship with the prototype and were not read out of the picture.
5. **Review stock ranges** — e.g. Thums Up **Running low, 2–3 bottles**; Amul Taaza Milk **Missing today**. These are visual estimates, never observed exact counts.
6. **Show the work** — Open **How this was read** on Manage. For an uploaded photo it lists engine, lines read, rows accepted and rows rejected. For a sample it says plainly that it is a fixture.
7. **Edit** — Change one price or toggle availability. Merchant is source of truth.
8. **Persist** — The catalog was stored through `POST /api/catalog`. Refresh the page; the API-backed list remains.
9. **Customer list** — Tap **Preview** to open `/#/dukaan/meena-kirana`. Same items, read-only.
10. **Real UPI QR** — On the storefront, **Pay this shop** renders a genuine NPCI `upi://pay` intent. Let a judge scan it. Open **What this QR encodes** to show the field-by-field decode. If the payee is `example.merchant@upi` the card says scanning opens a payment app but no money can move — say that out loud. Set `VITE_MERCHANT_VPA` to point it at a real account.
11. **Share** — On Manage, show the price-list QR, copy the link, and open the `wa.me` draft. Do not claim API delivery.
12. **Payment → items** — Home → **Collect** → `45` → **Collect ₹45** → **View payment**. Under *What did this customer buy?* the solver proposes **1× Thums Up 750 ml**. Open **How this was inferred**: bounded multi-subset-sum, 14 combinations explored, 1 exact-sum basket, confidence capped at 92%. Tap **Confirm items**.
13. **Stock drops** — Back on Manage, the Thums Up forecast moves from **about 2–3 left** (no cover figure, nothing confirmed yet) to **about 1–2 left, ~2 days** of cover. Say both numbers out loud so the change is audible.
14. **Supplier bill (photo two)** — Tap **Add supplier bill**. The page offers two paths and they are labelled differently, so say which one you took:
    - **Take or choose a photo of the bill** runs the same on-device OCR as the shelf photo, then checks each row's `qty × rate = amount` arithmetic and fuzzy-matches the item against your own catalog. Use this if a judge hands you a printed bill. Unreadable rows are listed with the reason instead of being guessed.
    - **Use this sample bill instead** loads the labelled fixture. For the kirana shelf that is **Sri Balaji Distributors**, usual order **₹7,175** (Aashirvaad ×10, Fortune Oil ×24, Thums Up ×24, Amul Milk ×30). Repeatable, so this is the safer judged path — but call it a sample, not a live read.

    Either way, the saved card shows the disclosure verbatim and **How this bill was read** opens the row-by-row evidence for the photo path.
15. **Restock action** — **Approve reorder** (4 items are flagged: Aashirvaad Atta, Fortune Oil, Thums Up, Amul Milk). Open the WhatsApp supplier draft, then **Mark as paid and received**. The order card carries the disclosure verbatim: *Merchant approved. Simulated Paytm vendor payout queued; no bank API called.* Point at it.
16. **Reset again** — Catalog, supplier, baskets and orders are gone; payments seed back. Proves demo-mode, not a production tenant.

---

## Timing

Use [SPEAKER_SCRIPT.md](./SPEAKER_SCRIPT.md) for the 5-minute cut. Do not open QR Rakshak, GST, or a chatbot. Sample shops and the seeded payment stream work with no external model and no network.

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

Deploy from `merchant-app/` with `npx vercel --prod`. Vercel serves the Vite build and the Node function in `api/index.ts` (every `/api/*` path is rewritten onto it); that function reuses the same handler as local Vite development.

For durable cross-device edits, connect an Upstash Redis integration in the Vercel project. The API automatically uses either `KV_REST_API_URL` + `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. `/api/health` reports `persistence: "shared-redis"` when configured.

The price-list QR, copied link, and WhatsApp draft are built at runtime from `window.location.origin`, so a production QR points at the current Vercel domain rather than localhost. A phone opening `/#/dukaan/meena-kirana` fetches `/api/dukaan/meena-kirana` in its own browser. On a cold serverless instance, that endpoint seeds the same 12-item Meena Kirana DEMO catalog.

Without those Redis environment variables, catalog edits and demo payments are kept on `globalThis` for the lifetime of a warm serverless instance. They can reset or differ across concurrent instances. The public phone route always remains demoable through the seeded cold-start catalog, but do not claim durable cross-device edits unless `/api/health` says `shared-redis`.

---

## Failure / honesty checks

- Upload a photo with no readable price lines → the scan screen refuses and explains, rather than inventing rows. There is no silent fallback catalog.
- Try an amount with no exact basket → the attribution card says so and asks the merchant to pick. It does not guess.
- Try ₹45 on the **printed rate card** catalog → 8 baskets, 28% confidence, alternates listed. Useful as a deliberate demonstration of ambiguity.
- Handwriting: do **not** use as the judged path.
- Cash: if asked, "we see Paytm sales clearly; cash is a prior."
- Collecting ₹13, or any note containing "fail", always fails. Useful for showing the failure screen on demand.
