# Paytm Ek Photo Dukaan

**Hackathon:** Paytm AI Hackathon · Hyderabad · 22 August 2026  
**Track:** Theme 2 — AI for Small Businesses  
**Status:** Finalised concept for submission. Ready to build.

---

## Paste this into the submission form

### Project title

**Ek Photo Dukaan** — photograph once, never type again.

### One-line description

Ek Photo Dukaan sets up a shop's entire stock and supplier system from two photographs of paper the owner already has, then runs it off the Paytm payments he already takes — no counting, no scanning, nothing typed.

### Short description (~85 words)

Ask a tea-stall owner how much Thums Up is left and he'll squint at the fridge and guess. Usually he's close — which is how a shop runs out of its best seller on a Saturday evening.

Every inventory app starts by asking him to enter his stock. Nobody with a queue at the counter has done that twice. Ek Photo Dukaan asks for two photographs instead: the rate card on the wall, and a supplier invoice. After that, his Paytm payments do the work.

### Full description (~330 words)

Ask a tea-stall owner how much Thums Up is left and he'll squint at the fridge and guess. Usually he's close. "Usually close" is how a shop runs out of its best seller on a Saturday evening, and how a crate the supplier pushed on him sits unsold for a month.

Every inventory app ever built starts the same way: enter your items, enter your prices, enter your stock. Nobody running a shop with one pair of hands and a queue at the counter has done that twice. It isn't laziness — data entry is a second job that pays nothing.

Ek Photo Dukaan asks for photographs instead.

**Photo one: the rate card already taped to the wall.** A vision model reads every item and price off it. That's the shop's catalogue, built in thirty seconds.

**Photo two: a supplier's invoice** — the ones that already arrive as WhatsApp images. The model reads who supplied it, what came in, at what unit cost, and how often. That sets the supplier up as a payable inside Paytm, with a normal order size and a normal amount.

That is the entire setup. Nothing typed.

From there, the payments the shop already takes do the running. A ₹40 payment where chai is ₹10 and a samosa is ₹15 isn't just ₹40 — it's a basket. Thousands of those amounts become a live picture of what's actually selling. The invoices say what came in, the payments say what went out, and the two have to reconcile, because you can't sell what you never bought. Each one sharpens the other.

Then, before the fridge is empty: *"Thums Up runs out Thursday afternoon. Order 4 crates from Sharma Traders?"* One tap sends the WhatsApp order and queues the Paytm payment to the supplier from photo two.

Two photographs at the start. After that the shop keeps its own books, predicts its own shortages, and orders its own stock — and the owner never counts, scans, or types anything.

---

## What we combined, and why it is one product

This is **not** two features sharing a logo. It is one loop.

| Parent idea | What we kept | What we dropped |
| --- | --- | --- |
| **Ek Photo Setup** (Theme 1 consumer bill onboarding) | The camera primitive: photograph a document a person already owns, extract structured entities, configure a payable with zero typing | Household BBPS bills, first-time consumer onboarding, electricity/gas/broadband |
| **Stock ka Andaza** (Theme 2 inventory from payments) | Amount-stream decomposition, probabilistic stock, supplier reorder as a Paytm payment + WhatsApp order | The uncomfortable "please type your menu first" cold start |

**The join:** Ek Photo Setup's camera was solving household bill setup. Pointed at a shop, the same mechanism configures both ends of Stock ka Andaza.

1. Rate-card photo → catalogue (SKU + price). That is the missing bootstrap Stock ka Andaza needed.
2. Supplier-invoice photo → stock IN + unit cost + Paytm payable. That is the hard prior that makes amount-decomposition identifiable.
3. Paytm payment-amount stream → stock OUT.
4. Stock IN and stock OUT constrain each other. You cannot sell what you never bought.

Without the camera, inventory inference has no catalogue and a weak cold start.  
Without the payment stream, the camera is OCR with nowhere to act.  
Without Paytm, there is no input and no output.

---

## Binding constraint from the theme PDF

Every solution must plug into Paytm's current products, not stand alone. Theme 2 solutions must extend products a Paytm merchant already uses (payments, merchant stack, billing, inventory, reaching customers).

Ek Photo Dukaan lives inside **Paytm for Business**. Sensors = Paytm transaction amounts + Paytm vendor payouts. Action = Paytm payment to an existing supplier. Channel = WhatsApp, where supplier orders already happen.

If you swapped Paytm for another PSP, both sensors and the reorder action disappear. That is the test.

---

## Human story (use this in the pitch)

Ramesh runs a tea stall. Lunch rush, one pair of hands, a rate card taped to the wall, Sharma Traders sending invoice photos on WhatsApp. He never counted stock because counting is a second job. On Saturday evening the Thums Up is gone and he finds out from a customer. On Monday a crate of something nobody wanted is still sitting there.

He does not need a dashboard. He needs the shop to notice before he does.

---

## How the product works

```
Photo 1: rate card  ──vision──▶  catalogue (SKU + price)
Photo 2: invoice    ──vision──▶  stock IN + unit cost + supplier payable
Paytm amount stream ──decompose──▶  stock OUT (probability, not a fake integer)
                         │
                  predicted stockout
                         │
            ┌────────────┴────────────┐
   WhatsApp order to           pre-filled Paytm
   Sharma Traders              vendor payment
```

### States the demo must show

1. Empty shop (no typing forms).
2. Rate card photographed → catalogue appears.
3. Invoice photographed → stock IN + supplier configured.
4. Live / seeded Paytm payments arrive → stock distributions sharpen.
5. Stockout prediction appears with confidence.
6. One tap: WhatsApp order + Paytm payment queued.
7. After payment confirmation, stock IN updates.

---

## Why AI is necessary

Two jobs. Neither has a credible rule-based version.

1. **Vision.** Rate cards and distributor invoices are unstandardised, often bilingual, badly printed. Templated OCR fails. A vision-language model extracts items, prices, quantities, supplier name.
2. **Inverse inference.** A payment amount is a basket fingerprint, not a SKU scan. Mixture decomposition + Bayesian stock estimate, constrained by invoice inflows. A threshold or spreadsheet cannot do this.

Do **not** pitch this as a chatbot. Do **not** let an LLM authorise money. Merchant taps Approve on the quote/order. Paytm executes the payment. Webhook (or demo webhook) updates stock.

---

## Why Paytm is necessary

| Signal / action | Where it lives |
| --- | --- |
| Sale amounts (stock OUT) | Paytm merchant transaction stream |
| Supplier payouts (stock IN confirmation) | Paytm business payments |
| Reorder | Amount-locked Paytm payment / payment link |
| Catalogue bootstrap | Photo, then matched against typical ticket sizes in Paytm history |

A standalone inventory app would ask Ramesh to type sales. That is the product we are refusing to build.

---

## Why Meta / WhatsApp is natural (not bolted on)

Supplier invoices already arrive as WhatsApp photos. Reorders already happen as WhatsApp messages. The product reads the photo and sends the order in the same channel. Instagram is optional and should not be in the MVP.

Do not claim native WhatsApp Payments. Paytm is not in WhatsApp's listed India payment-gateway list. Send a Paytm payment link / queued Paytm payout. That is honest.

---

## Scope we will say out loud

- One vertical: tea stall / QSR counter.
- **10–15 items** with distinct prices (₹10 chai, ₹15 samosa, ₹40 combo). Overlapping prices break identifiability.
- Printed rate card, never handwritten live (handwriting is a demo killer).
- Cash sales are a known blind spot. Demo and pitch: "we see Paytm sales clearly; cash is a prior, not a claim of omniscience."
- A 2,000-SKU kirana is out of scope. Volunteer this before a judge finds it.

---

## What judges should remember

> "I haven't seen this exact approach: two photos of paper the shop already has, then Paytm payments become the stock register."

Five takeaways:

1. Zero data entry is the product, not OCR and not a forecast chart.
2. Camera solves cold start; payments solve ongoing inventory.
3. Invoices and sales constrain each other — that is the AI argument.
4. Reorder is a real Paytm payment, not a notification.
5. We scoped to one menu on purpose so the math is identifiable.

---

## Scoring (honest, after combining)

Parent scores: Ek Photo Setup **84**, Stock ka Andaza **88**. Combined is not 90+ because feasibility does not improve — we now have two AI pipelines.

| Criterion | Score | Why it is not 20 |
| --- | ---: | --- |
| Paytm Integration | 19 | Sensors + reorder are Paytm-native; live staging APIs may be mocked |
| AI Innovation | 20 | Inverse problem + vision; 20 is defensible only if we show distributions, not fake integers |
| User Impact | 18 | Real pain, but scoped to small menus |
| Demo Quality | 19 | Photo → catalogue → stockout → Paytm tap is memorable |
| Build Feasibility | 13 | Two model paths + decomposition in one day; must cache vision and seed payments |
| **Total** | **89** | Optimisation target, not a promise |

---

## Competitive trap

Inventory appeared in ~30% of a prior Mumbai field; OCR/vision in ~25%. If a judge files this as "another inventory app" or "they OCR'd a price list," we lost.

**Always lead with:** every inventory app asks you to enter stock; nobody does; we never ask.

Do not merge this with QR Rakshak, khata reminders, or a merchant chatbot in the same demo.

---

## MVP vs do not build

### MUST BUILD

- Paytm for Business-like mobile shell
- Camera / upload for printed rate card → catalogue
- Camera / upload for invoice → stock IN + supplier
- Seeded Paytm payment stream
- Decomposition against the 10–15 item menu (can be a constrained solver, not a research paper)
- Stock shown as a **range / probability**, never a fake exact count
- Stockout card with one-tap WhatsApp draft + Paytm payment queue
- Demo mode: cached vision by image hash, deterministic fallbacks, reset button
- Visible labels for seeded / demo Paytm vs live

### SHOULD BUILD

- Merchant approve before sending order
- Webhook / simulated payment confirmation updating stock
- Hindi/Hinglish copy on the stockout card

### DO NOT BUILD

- Consumer BBPS bill pay (that was the discarded half of Ek Photo Setup)
- 2,000-SKU kirana
- Live handwriting OCR as the judged path
- Chatbot / "ask your inventory"
- Native WhatsApp Payments claim
- Training a model on stage / fake learning curves
- Dashboards, GST, loans, ads

---

## 3-minute demo script

| Time | On screen | Say |
| --- | --- | --- |
| 0:00–0:20 | Empty shop + fridge story | "Ramesh guesses what's left. Saturday, Thums Up is gone." |
| 0:20–0:45 | Product name | "Every app says enter your stock. We ask for two photos." |
| 0:45–1:20 | Photo 1 rate card → catalogue | "Thirty seconds. That's the menu. He typed nothing." |
| 1:20–1:50 | Photo 2 invoice → stock IN | "This is what came in. Paytm can pay this supplier." |
| 1:50–2:20 | Payments stream → stock sharpening | "₹40 isn't ₹40. It's a basket. Watch the estimate tighten." |
| 2:20–2:45 | Stockout + Paytm tap | "Thums Up runs out Thursday. One tap: WhatsApp + Paytm pay." |
| 2:45–3:00 | Close | "Two photos. After that the shop keeps its own books." |

Guardrails: printed card only; cache VLM by hash; if camera fails, upload; if Wi-Fi dies, seeded replay so nobody can tell.

---

## Suggested architecture (hackathon)

- Frontend: React + TypeScript, mobile-width Paytm Business shell
- Backend: thin API or in-process demo service
- Vision adapter: real VLM optional via env; **demo mode must work offline**
- Inference: constrained decomposition over seeded menu + amounts
- Paytm adapter: interface with mock now, staging payment-link later
- WhatsApp: drafted message + optional Cloud API if credentials exist
- Seeded merchant: "Ramesh Tea Stall", 12 SKUs, Sharma Traders, 40 payment events

---

## Questions teammates should be ready for

**"Isn't this just POS?"**  
A POS requires ringing up every item. That is the labour this shop refused. We use the amount he already collected.

**"Isn't this just OCR?"**  
OCR without Paytm is a party trick. The photo only matters because it creates a catalogue and a payable the payment stream can run against.

**"Why not a kirana?"**  
Overlapping prices and 2,000 SKUs make the amount an unreadable mixture. We scoped to a menu where prices identify baskets. That is a product choice, not a shortcut we are hiding.

**"Cash?"**  
Paytm sales are observed. Cash is a prior. We do not pretend otherwise.

**"Did the model actually learn today?"**  
No. We have the label (payment happened / stock moved) and the constraint (invoices). Volume trains later. Do not fake a learning curve.

---

## Files in this folder

- `Paytm_Ek_Photo_Dukaan_Brief.md` — this document (share this with other chats / teammates)
- `Paytm_Ek_Photo_Dukaan_Brief.pdf` — printable copy of the same
- `Paytm_QR_Rakshak_Winning_Strategy.md` — **separate** concept. Do not mix in one demo.

---

*Source of truth for tracks: Paytm AI Hackathon Themes PDF. Parent ideas: Ek Photo Setup (consumer camera onboarding) and Stock ka Andaza (inventory from payments). Combined product: Ek Photo Dukaan.*
