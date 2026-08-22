# Mentor Cue Card — Ek Photo Dukaan

*Every number below was re-verified against the running app. Speak, don't read.*

---

## 1. The 5-minute run order

| Time | Tap | Say | Point at |
|---|---|---|---|
| 0:00 | Merchant home `/#/` | "This is the Paytm merchant app. Today's collections, counter actions — all normal." | Sales hero |
| 0:20 | Scroll to **More for your business** → **Ek Photo Dukaan** | "This is a feature *inside* the app, not a new app. That's the whole point." | The section heading |
| 0:40 | **Meena's kirana shelf** (first sample) | "One photo of her shelf. No typing, no barcode scanner." | The photo |
| 1:00 | Catalog builds | "**12 items**, priced, categorised, stock-flagged — from one picture." | **12 items** |
| 1:30 | Share → QR | "She prints this once and sticks it on the counter." | QR card |
| 1:50 | `/#/dukaan/meena-kirana` | "Customer scans, sees a live price list. No app install." | Storefront |
| 2:20 | Collect **₹45** | "Payment lands. Paytm knows the amount — nobody knows *what sold*. That's the gap." | **₹45** |
| 2:50 | Basket inference | "We searched **14 combinations** and found **exactly one** basket that sums to ₹45 — **1× Thums Up 750 ml**, **92% confidence**." | **14 / 1 / 92%** |
| 3:20 | Confirm | "One tap. Amount just became inventory." | — |
| 3:40 | Restock forecast | "Thums Up went from **About 2–3 left** to **About 1–2 left**, and now reads **~2 days** of cover. Confidence rose 35% → 60% because we have a real sale." | **1–2 left · ~2 days** |
| 4:10 | Supplier bill photo | "Photograph the supplier bill, reorder is pre-filled. Nothing sends until she taps." | Bill lines |
| 4:40 | Close | "Photo in, priced storefront out, and every payment teaches the shelf what it sold." | — |

---

## 2. The six numbers

> ### **12** items from one photo  ·  **₹45** payment  ·  **14** combinations searched
> ### **1** exact basket  ·  **92%** confidence  ·  **2–3 → 1–2 left, ~2 days cover**

**Point at the Restock forecast line for the last one** — the catalog chip still reads "2–3 bottles"; the line that moves is the forecast, "About 1–2 left · 60% confidence · ~2 days".

---

## 3. One line per criterion

- **Paytm Integration** — The UPI QR and `upi://pay` intent are real NPCI-spec and really open Paytm/GPay/PhonePe; authorisation and settlement are simulated behind a single documented adapter seam, and we label every simulated reference as ours.
- **AI Innovation** — We invert the payment: a bounded subset-sum solver turns "₹45 arrived" into "1× Thums Up sold" with a ranked, explainable posterior — inference from data Paytm already has, no new hardware.
- **User Impact** — Meena gets a priced digital storefront in one photo instead of an afternoon of typing, and her stock forecast improves every time she confirms a basket.
- **Demo Quality** — The whole judged path is covered by a 40-check harness (`node server/verifyJudgePath.mjs`, 40/40) plus 150 passing tests, and the app refuses honestly when it can't read a photo.
- **Build Feasibility** — OCR runs on-device in the browser, so marginal AI inference cost is zero and it works offline; the inference is rule-based, so there is no model to train, no data to collect, and no GPU.

---

## 4. Hostile Q&A

**Is the OCR real?** Yes — Tesseract in the browser, no upload. The rate-card photo reads **12 priced rows at 94% mean confidence** with every price exactly as printed. Run `node server/verifySamplePhotoOcr.mjs` and watch it.

**What if two baskets add to the same amount?** Then we say so. We show it as ambiguous with ranked candidates and their confidences — ₹73 gives two baskets at 57% and 43%. The merchant picks; we never silently guess.

**What's fake or simulated here?** Payment authorisation, the success callback, and settlement — because those need merchant credentials we don't have and won't fake. The QR, the UPI intent, the OCR, the solver, and the forecast are all real. `docs/PAYTM_INTEGRATION.md` has the line-by-line real/simulated table.

**Isn't this just OCR plus a QR code?** OCR gets you text. The value is the inference layer that converts a bare amount into a specific SKU and then into days-of-cover — that's the part nobody else is doing with data Paytm already owns.

**Why does Paytm need this rather than a standalone app?** Because the amount is already in Paytm's rails and the merchant is already in this app. A standalone app would need to re-acquire the merchant and would never see the payment; here it's one card under "More for your business."

**Can this actually ship, and what would it cost to run?** Yes — OCR is on-device, so marginal inference cost is zero and it scales with the merchant's phone, not our servers. It ships as a feature inside the existing app with no new hardware — no barcode scanner, no POS.

**What happens with handwritten boards?** Printed rate cards are the reliable case today and we scope the claim there. Handwriting degrades, so we surface confidence per row and make every field editable rather than pretending.

**What if the photo is bad?** It refuses instead of inventing. Tap the shelf photo sample — zero readable lines, and the pipeline says "nothing readable" rather than hallucinating a catalog. That refusal is a designed feature.

**Do you have any real user data?** No, and we don't claim any. The seeded shop is clearly labelled demo data. What's real is the engineering: public repo, 150 tests, 40-check judge harness.

---

## 5. Recovery lines — say these, never debug

- **OCR misreads a row** → "Good — this is exactly why every row is editable and shows its own confidence. She corrects it once and it's saved." *(Tap the field, fix it, move on.)*
- **Network dies** → "Convenient timing: the OCR is on-device, so this keeps working offline. That's the feasibility argument making itself." *(Switch to localhost.)*
- **A screen errors** → "Let me take you in through the path a merchant actually uses." *(Reload `/#/`, restart from the home card. Do not open DevTools.)*
- **Basket comes back empty** → "That's the honest answer — no combination of her catalog hits that amount, so we say so instead of guessing." *(Use ₹45.)*
- **Anything unexplained** → "I'd rather show you the harness than hand-wave" → run `node server/verifyJudgePath.mjs`.

---

## 6. Pre-flight checklist (before the mentor arrives)

- [ ] Dev server running (`npm run dev`, port **5173**) — this is the demo surface.
- [ ] Browser at `/#/` **already loaded once**, so the Tesseract assets (~3.9 MB core + 2 MB language data) are warm in cache.
- [ ] Tap the **Meena's kirana shelf** sample once, confirm 12 items, then **reset** — first run pre-warms OCR.
- [ ] Second tab open at `/#/dukaan/meena-kirana` (the customer view).
- [ ] Third tab: https://merchant-app-black.vercel.app as the live-deployment proof.
- [ ] Terminal ready with `node server/verifyJudgePath.mjs` typed but **not** run.
- [ ] Phone charged and screen-timeout off if you plan to scan the QR for real.
- [ ] Zoom the browser to ~110% so the mentor can read the numbers from beside you.
- [ ] Close DevTools. Silence notifications.

---

*Verified: build clean · lint warnings only · 150/150 tests · judge path 40/40 · OCR harness passes · `/tesseract/*` and both demo JPEGs serve from local and production.*
