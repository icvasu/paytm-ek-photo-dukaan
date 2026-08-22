# Ek Photo Dukaan — rehearsal card

## What to say per slide

1. **Title:** “Meena photographs her shelf once. After that, the payments she already takes keep her stock register current.”
2. **Problem:** “Inventory apps fail before they help: nobody at a busy counter will type 200 products, and a payment tells her how much arrived, not what sold.”
3. **Loop:** “The photo creates the catalog. Paytm money-in is the demand sensor; money-out is the restock action. Remove Paytm and the loop has no input or output.”
4. **OCR proof:** “On the shipped rate-card photo, real on-device OCR reads 13 lines at 94% mean confidence and keeps all 12 priced rows. It drops only the no-price heading.”
5. **₹45 moment:** “Across Meena’s 12 items, the solver searches 14 combinations and finds exactly one ₹45 basket: one Thums Up. Ninety-two percent is a confidence cap, not an accuracy claim.”
6. **AI:** “Four pieces work together: OCR, fuzzy resolution, bounded subset-sum, and weighted demand. The important behavior is refusal when the evidence is weak.”
7. **Paytm:** “The UPI intent and QR are real; WhatsApp is a real draft link. Authorisation, settlement, webhook receipt, and supplier payout are simulated and labelled.”
8. **Impact:** “This ships as an add-on inside the merchant app, needs no hardware, and runs OCR on-device at zero marginal AI cost. The path has over 150 tests and a 40/40 judge harness.”
9. **Limits + close:** “Today this is for a 10–15 item, printed catalog; cash is a blind spot. One photo starts the register, and only Paytm’s payment stream can keep it alive.”

## Five-minute demo order

1. **0:00–0:40** Home → *More for your business* → **Ek Photo Dukaan**. Say: “A feature inside the merchant app, not another app.”
2. **0:40–1:20** Tap **Meena’s kirana shelf**. Point to **12 items** and Thums Up **2–3 left**. Call this a labelled sample shop.
3. **1:20–1:50** Optional OCR proof: **Photo of a printed rate card** → **13 lines, 94%, 12/12 priced rows kept**.
4. **1:50–2:20** Preview storefront and QR. Say: “Real `upi://pay`; placeholder VPA means no money moves.”
5. **2:20–3:25** **My QR → 45 → Record a counter payment** → open payment → inference → confirm. Point to **14 / 1 / 92%**.
6. **3:25–4:15** Back twice → **Business → Ek Photo Dukaan**. Point to Thums Up **2–3 → 1–2 left, ~2 days**.
7. **4:15–5:00** Supplier sample bill → approve reorder → open WhatsApp draft. Read the simulated-payout label, then close: “Payments keep the register.”

## Six numbers

**12 items · ₹45 payment · 14 combinations · 1 exact basket · 92% capped confidence · 2–3 → 1–2 left, ~2 days**

## Five hostile questions

**Is the OCR real?** Yes. Tesseract runs in the browser with no upload. The shipped photo measures 13 lines, 94% mean confidence, and 12/12 priced rows kept.

**Is 92% your accuracy?** No. It is a deliberately capped heuristic confidence for this basket. An amount cannot prove what was bought.

**What if two baskets fit?** The app shows ranked alternatives and waits for the merchant. If none fit, it asks for manual items. Stock never moves silently.

**Does real money move?** No. The UPI intent is real, but authorisation, settlement, webhook receipt, and supplier payout are simulated and labelled. No live Paytm or bank API is connected.

**Why Paytm, not a standalone app?** Paytm already sees the payment amount and is where the supplier payment ends. A standalone app would have to ask Meena to type every sale.

## Recovery lines

- **OCR misreads:** “That is why every row shows confidence and remains editable. Meena is the source of truth.”
- **No OCR text:** “This is the designed refusal state. It will not invent a catalog.”
- **Basket empty:** “No exact sum means no guess. I’ll use the judged ₹45 path.”
- **Network fails:** “OCR is on-device. I’ll continue with the embedded deck screenshots.”
- **Screen errors:** “I’ll return through the merchant’s real entry point.” Reload `/#/`; do not debug on stage.
