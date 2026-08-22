# Ek Photo Dukaan alignment audit

Source of truth: `Paytm_Ek_Photo_Dukaan_Brief.md`. QR Rakshak is a separate concept and is not part of this product.

## Current score: 58/100

The prototype now delivers a coherent **one photo → editable digital dukaan → shareable price list** vertical slice inside a Paytm-for-Business-style shell. It does not yet deliver the full brief's second-photo supplier setup, payment-basket decomposition, probabilistic inventory loop, or reorder/payment action. The score reflects implemented behavior, not intended architecture.

| Brief requirement | Status | Evidence / gap |
| --- | --- | --- |
| Paytm-for-Business-like mobile shell | Complete | Existing Home, payments, QR, settlements and Business routes provide the host shell. Every screen identifies the build as an unofficial prototype. |
| Clear Ek Photo Dukaan Home entry | Complete | Home CTA opens `/#/dukaan/scan` or the existing catalog manager. |
| Photo 1: printed rate card → catalog | V0 complete, production gap | Seeded demo image and uploads produce editable items and prices. `DemoVisionService` uses deterministic filename/size mapping; it is explicitly not OCR/VLM. |
| Zero typing for initial setup | V0 complete | The sample creates six items without typing. Merchant review/edit remains possible and appropriate. |
| Editable 10–15 item scoped menu | Partial | Create/edit/add/remove/availability works, but the judged tea-counter sample has six items, below the brief's 10–15 target. |
| Customer-facing price list | Complete | `/#/dukaan/:slug` shows merchant-confirmed prices and availability. |
| Shareable QR, link and WhatsApp draft | Complete | Manager renders a QR, copies a hash URL and opens a prefilled WhatsApp share. It does not claim WhatsApp sending or payments. |
| Stock as range/probability, never fake exact count | Partial | Seeded visual ranges are shown and labelled demo estimates. They are static catalog fields, not calibrated distributions. |
| Payment-derived restock hints | Partial | A deterministic rule combines visual low/out flags with exact payment-amount matches. It is visibly labelled heuristic/demo; there is no basket decomposition. |
| Seeded Paytm payment stream | Partial | Seeded merchant transactions exist, but there is no dedicated replay that visibly sharpens stock estimates. |
| Photo 2: supplier invoice → stock IN and supplier | Missing | No invoice capture, line-item extraction, supplier entity, normal order or payable. |
| Invoice inflows constrain payment-derived outflows | Missing | No stock ledger or inference loop exists. |
| Predicted stockout with confidence | Missing | The UI gives low/out hints, not a date/time prediction or confidence band. |
| One-tap WhatsApp supplier order | Missing | Customer catalog sharing exists; supplier reorder drafting does not. |
| Queued Paytm supplier payment with approval | Missing | No supplier payout adapter, approval step or amount-locked demo action. |
| Payment confirmation updates stock IN | Missing | No supplier payment webhook/simulation or resulting stock update. |
| Cached/offline deterministic demo and reset | Mostly complete | Demo mapping is deterministic and offline; reset clears the API catalog. Image-hash caching and a visible replay controller are absent. |
| Honest real/mock/seeded disclosure | Complete | Home, capture, catalog, public list, QR and insights identify prototype, demo, seeded or heuristic boundaries. No official affiliation is claimed. |

## V0 interpretation

The implemented V0 is intentionally narrower than the complete concept: it proves the memorable cold-start and distribution surface—**one printed photo becomes a useful, editable, shareable dukaan**—without rewriting the merchant app. Payments remain the host data rail, not the pitch.

## Highest-priority gaps

1. Add the second, supplier-invoice photo and persist supplier, quantity, unit cost and stock-in events.
2. Expand the tea-counter seed to 10–15 distinct-price items and implement constrained basket decomposition over seeded successful payments.
3. Replace static stock labels with ranges/confidence that visibly update during a seeded payment replay.
4. Add a predicted stockout card with merchant approval, supplier WhatsApp draft and clearly simulated Paytm payout.
5. Simulate payout confirmation and update stock-in, completing the loop.
6. Add tests for vision fallback, catalog mutations, reset, inference constraints and the complete demo path.
