# Feature inventory (what is actually in the app)

Every user-visible feature, what is genuinely computed, and the **exact taps** to reach it. A judge should be able to hold this page and check every line without help.

| Status | Meaning |
| --- | --- |
| **REAL** | The implementation does the stated work in this build, on this device. |
| **SIMULATED** | The UI and the local ledger are real; no Paytm API, bank, WhatsApp Cloud API or live tenant is called. Always labelled on screen. |
| **FIXTURE** | Pre-written sample data, labelled as a sample on screen. |
| **Not implemented** | Absent. Listed here so the gap is ours to state, not a judge's to find. |

The app is **not** official Paytm: no credentials, no production tenant, no endorsement. Every screen that touches money says so.

Seeded merchant: **Meena Reddy · Meena Kirana & General Store, Ameerpet**. The clock is pinned to the demo seed (22 Aug 2026, afternoon IST) so the numbers are identical on every run.

**Start state for every path below:** open the app at `/#/`, then Profile tab → **Advanced** → **Reset to sample data**.

---

## Merchant shell — Paytm for Business is the host app

Ek Photo Dukaan is a feature *inside* this shell, reached from Home under *More for your business*. It is not the front door.

| Feature | Status | Taps from `/#/` |
| --- | --- | --- |
| Mobile merchant shell with bottom nav | REAL | Home · Payments · Business · Profile |
| Today's sales with received / pending / failed | REAL math over the ledger | Home (top card) |
| Available-for-settlement balance | REAL math | Home → *Available for settlement* |
| Recent payments list | REAL (seed + anything you collect) | Home → *Recent payments*, or Payments tab |
| Payment search + status / method / period / sort filters | REAL client filtering | Payments tab → search box and filter chips |
| Payment receipt detail | REAL | Payments tab → tap any row |
| Search across payments and customers | REAL | Home → magnifier, top right |
| Notifications, mark one / mark all read | REAL against the demo API | Home → bell, top right |
| Business hub: 7-day sales, success rate | REAL math | Business tab |
| Customer list, detail and lifetime spend | REAL over seeded customers | Business tab → **Customers** → tap a customer |
| Profile: merchant card, VPA, bank last-4, address | FIXTURE merchant record | Profile tab |
| Soundbox and notification preference toggles | REAL local preferences | Profile tab |
| Reset to sample data | REAL (`POST /api/reset`) | Profile tab → **Advanced** → **Reset to sample data** |
| Unofficial-prototype disclosure | REAL copy | Profile, scan, manage, QR screens |

---

## Ek Photo Dukaan — one photo becomes the catalog

| Feature | Status | Taps from `/#/` |
| --- | --- | --- |
| Home entry point into the feature | REAL | Home → *More for your business* → **Ek Photo Dukaan** (routes to scan with no catalog, manage with one) |
| Take or choose a photo of a shelf / printed rate card | REAL camera + file input | Ek Photo Dukaan → **Take or choose a photo** |
| On-device OCR → line parse → fuzzy lexicon match | REAL, nothing uploaded | The same path; `analyzePhoto` |
| OCR assets served from our own origin (no CDN) | REAL | `public/tesseract/` — worker, WASM core and language model are self-hosted, so the read works on a dead venue network |
| Two sample shops (kirana shelf, tea-counter rate card) | FIXTURE — rows written by us, tied to a drawing | Scan → *or start from a sample shop* |
| Sample photo of a printed rate card | **REAL OCR**, no fixture behind it | Scan → *or read a sample photo for real* |
| Sample photo of a cluttered shelf | **REAL OCR** that reads no price list and refuses, on purpose | Scan → *or read a sample photo for real* |
| Unreadable photo is refused with a reason | REAL — there is no silent fallback catalog | Upload any photo with no price list |
| Recall of an identical photo by content hash | REAL | Re-submit the same image: rows are identical and instant, and the note says *"Recalled from the earlier read of this same image"* |
| "How this was read from your photo" evidence panel | REAL, computed from the run | Manage → **How this was read from your photo** (engine, lines read, mean text confidence, rows kept, rows skipped) |
| Fixture-vs-real-read disclosure | REAL copy | Scan (info note) and Manage |
| Reproducible OCR measurement over the shipped sample photos | REAL harness | `node server/verifySamplePhotoOcr.mjs` |
| Editable catalog: name, price, availability, add, remove, undo | REAL, writes through the API | Ek Photo Dukaan → Manage |
| Stock as a **range or flag**, never a fake exact count | REAL | Manage → item rows |
| Catalog persists through the API across a refresh | REAL (`POST /api/catalog`) | Manage → reload the page |
| Rebuild from a new photo | REAL | Manage → **Rebuild from a new photo** |
| Public customer price list with search + category chips | REAL | Manage → **Share** → **Preview as a customer** |
| Price-list QR and copy link | REAL, built from the current origin | Manage → **Share** |
| WhatsApp price-list message | REAL `wa.me` draft — opens a pre-filled chat, we never send it | Manage → **Share** → WhatsApp |
| Cold-start public slug `meena-kirana` | FIXTURE fallback so a scanned QR never 404s | `GET /api/dukaan/meena-kirana` |

---

## Payments become stock — the inference loop

| Feature | Status | Taps from `/#/` |
| --- | --- | --- |
| Collect an amount with customer, method, note | SIMULATED charge, local ledger | Home → **Collect** |
| Processing / success / failure screens + soundbox line | SIMULATED | Collect → **Collect ₹…** |
| Deliberate failure hook (₹13, or a note containing "fail") | SIMULATED, for showing the failure screen on demand | Collect → amount `13` |
| Basket suggestion from an amount (bounded subset-sum) | **REAL solver** over your catalog's real prices | Payments tab → a successful payment → *What did this customer buy?* |
| "How this was inferred" panel | REAL, computed per search | Payment detail → **How this was inferred** (distinct price points, combinations explored, baskets that sum exactly, ranking prior, probability) |
| Honest `no_solution` / `ambiguous` answers | REAL — it says so and asks you to pick rather than guessing | Collect ₹1 or ₹9,999, then open the payment |
| Merchant-confirmed basket assignment | REAL write (`POST /api/transactions/:id/basket`) | Payment detail → **Confirm items** |
| Server rejects a basket that does not total the payment | REAL validation | Verified by `server/verifyJudgePath.mjs` |
| Stock moves only after the merchant confirms | REAL | Confirm a basket, then reopen Manage and compare the forecast |
| Receipt: confirm a pending payment, refund | SIMULATED (unsettle only) | Payments tab → a pending payment |
| Instant settlement (≥ ₹50 available) and history | SIMULATED — the bank reference is generated locally | Home → *Available for settlement* |

---

## Supplier — photo two, and the reorder

| Feature | Status | Taps from `/#/` |
| --- | --- | --- |
| Photograph a supplier bill (same on-device OCR) | REAL | Manage → **Add supplier bill** → **Take or choose a photo of the bill** |
| Load the matching sample bill | FIXTURE, labelled — the repeatable stage path | Manage → **Add supplier bill** → **Use this sample bill instead** |
| Invoice parser: `qty × rate = amount` arithmetic check per row | REAL | `invoicePipeline.ts` |
| Fuzzy link of each bill line to your own catalog | REAL, thresholded — an unmatched line stays unmatched | Same |
| Unreadable rows listed with the reason, never guessed | REAL | Manage → **How this bill was read** |
| Persist supplier, lines, unit costs and bill total | REAL API (`POST /api/supplier/invoice`) | Automatic on save |
| Bill total shown as **bill total**, not a "usual order" average | REAL — it is the one bill that was read | Manage → supplier card |
| Days-of-cover / reorder forecast per item | REAL heuristic, confidence capped at 85% | Manage → *Restock* |
| Hinglish restock prompt on the stockout card | REAL copy | Manage → *Restock* |
| "Why this restock" evidence panel | REAL, shows the demand model's inputs and limits | Manage → **Why this restock** |
| Approve reorder (idempotent — a double tap cannot double-order) | SIMULATED payout queue, labelled on the card | Manage → **Approve reorder** |
| WhatsApp supplier order | REAL `wa.me` draft with the order text — we never send it | Manage → **Send on WhatsApp** |
| Mark as paid and received → stock-in ranges | SIMULATED confirmation standing in for a Paytm payout webhook | Manage → **Mark as paid and received** |

---

## Insights — rules over the ledger, not an LLM

Every sentence on these cards is computed from the transaction ledger. **No insight text names a customer, a weekday or a figure that was not derived** — `src/intelligence/engine.test.ts` renames the customers and reshapes the week and asserts the copy moves with the data.

| Feature | Status | Taps from `/#/` |
| --- | --- | --- |
| 14-day sales area chart, hourly activity bars | REAL over the ledger | Business tab → **Business insights** |
| Average ticket, repeat-customer share | REAL metrics | Business insights |
| Week-on-week trend, naming the weakest weekday it measured | REAL | Business insights |
| Peak window card, with the real share of payments inside it | REAL | Business insights |
| Regulars card, naming the top repeat customers by actual spend | REAL | Business insights |
| Afternoon failure-cluster card | REAL rule over success-by-hour | Business insights |
| Catalog restock card once a catalog exists | REAL | Business insights |
| Home insight teaser | REAL | Home → *Business insight* |
| Generative / LLM-written insights | **Not implemented** | The engine is rules; we do not claim a model wrote these |

---

## Paytm / UPI surface

| Feature | Status | Taps from `/#/` |
| --- | --- | --- |
| NPCI `upi://pay` URI, validated `pa/pn/am/cu/tn/tr` | **REAL** — production-correct, needs no credentials | `src/services/paytm/upi.ts`, 17 tests |
| My QR: static shop QR, or dynamic QR once an amount is typed | REAL QR | Home → **My QR** |
| "What this QR encodes" field-by-field decode | REAL | My QR → **What this QR encodes** |
| Public shop QR where the customer enters the amount | REAL QR | Public storefront → **Pay this shop** |
| "Open UPI app" deep link where the intent is supported | REAL | QR cards on a phone |
| Placeholder-VPA warning when `VITE_MERCHANT_VPA` is unset | REAL — says plainly that no money can move | Every QR card |
| Record a counter payment from My QR | SIMULATED ledger entry | My QR → record |
| Payment authorisation, status callback, settlement to bank, refunds | **SIMULATED** — labelled everywhere | See `PAYTM_INTEGRATION.md` |
| Live Paytm Orders API, signed webhooks, merchant KYC | **Not implemented** | Adapter seam is `PaytmService.ts`; the webhook design is written up but not built |
| WhatsApp Cloud API sending | **Not implemented** | We open drafts only, and never claim delivery |

**The honest boundary:** scanning a QR from this app really does open a real UPI app on a real amount. Everything after that is a local ledger.

---

## AI / vision / intelligence

| Capability | Status | Notes |
| --- | --- | --- |
| Browser OCR | REAL | tesseract.js on-device, no upload, assets self-hosted |
| Catalog line parser + product lexicon | REAL | Printed type only; handwriting is out of scope |
| Invoice line parser + arithmetic verification | REAL | The stage path still uses the sample bill for repeatability |
| Fuzzy name match | REAL | Thresholded; a near-miss is kept as printed rather than forced |
| Basket inference | REAL | Bounded multi-subset-sum; honest `no_solution` / `ambiguous` |
| Demand / days-of-cover | REAL heuristic | Exponentially weighted rate, confidence capped, limits stated on screen |
| Content-hash recall of vision reads | REAL | Determinism and latency; a recalled read says it was recalled |
| Trained or fine-tuned model, learning curves | **Not implemented** | We do not claim the model learned anything today |

---

## Known limits we volunteer

- **Cash sales are invisible.** Paytm amounts are observed; cash is a prior, not a claim of omniscience.
- **Scoped to ~10–15 items with distinct prices.** A 2,000-SKU kirana makes an amount an unreadable mixture. That is a product choice, not a hidden shortcut.
- **Printed rate cards only.** Handwriting is not the judged path.
- **Sample-shop stock ranges are authored**, not measured — the provenance panel says so. Tap a *sample photo* instead for a genuinely read catalog.
- **Without Redis, state is per serverless instance.** `/api/health` reports which. The public slug always seeds so a scanned QR never 404s.

## Verify it yourself

```bash
npm run build && npm run lint && npm test        # typecheck, lint, unit + regression tests
npm run preview                                   # then, against that origin:
node server/verifyJudgePath.mjs http://localhost:4173   # 40-check walk of the judged path
node server/verifySamplePhotoOcr.mjs              # real OCR over the shipped sample photos
curl -s https://merchant-app-black.vercel.app/api/health
```
