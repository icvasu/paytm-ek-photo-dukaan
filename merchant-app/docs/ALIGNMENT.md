# Ek Photo Dukaan alignment audit

Source of truth: `Paytm_Ek_Photo_Dukaan_Brief.md`. QR Rakshak is a separate concept and is not part of this product.

## Current implementation: complete V1 demo loop

The prototype now delivers the coherent **one shop photo → editable digital dukaan** hero plus the brief's supporting loop: supplier invoice heuristic, merchant-confirmed payment baskets, rule-based stockout ranges, supplier WhatsApp-ready order context, and an explicitly simulated payout/stock-in confirmation.

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
| Photo 2: supplier invoice → stock IN and supplier | Demo complete | Deterministic invoice vision persists supplier, line quantities, unit costs and normal order value. |
| Invoice inflows constrain payment-derived outflows | Demo complete | Invoice lines establish reorder quantities; confirmed baskets reduce displayed stock ranges. |
| Predicted stockout with confidence | Demo complete | Rule-based range, observed velocity, days-to-stockout and confidence are shown; no fake exact count. |
| Supplier reorder | Demo complete | Merchant-approved supplier order creates a notification and order state. |
| Queued Paytm supplier payment with approval | Demo complete | Explicitly simulated payout note; no bank or Paytm API claim. |
| Payment confirmation updates stock IN | Demo complete | Simulated confirmation marks the order confirmed and updates catalog stock ranges. |
| Cached/offline deterministic demo and reset | Mostly complete | Demo mapping is deterministic and offline; reset clears the API catalog. Image-hash caching and a visible replay controller are absent. |
| Honest real/mock/seeded disclosure | Complete | Home, capture, catalog, public list, QR and insights identify prototype, demo, seeded or heuristic boundaries. No official affiliation is claimed. |

## V0 interpretation

The implemented V0 is intentionally narrower than the complete concept: it proves the memorable cold-start and distribution surface—**one printed photo becomes a useful, editable, shareable dukaan**—without rewriting the merchant app. Payments remain the host data rail, not the pitch.

## Honest remaining production gaps

Production OCR/VLM, calibrated Bayesian inference, cash-sale reconciliation, live Paytm vendor payouts and WhatsApp Cloud delivery remain intentionally out of scope. The V1 path is deterministic, offline-capable and labelled DEMO throughout.
