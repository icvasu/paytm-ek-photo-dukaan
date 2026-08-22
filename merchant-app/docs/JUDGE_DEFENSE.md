# Judge defense — likely questions

Short, honest answers. Do not over-claim. Product: **one photo → digital dukaan**, hosted in a Paytm-for-Business-style shell.

---

**Is this official Paytm?**
No. Unofficial hackathon prototype. No Paytm credentials, no production tenant, no endorsement.

**Does money actually move?**
The QR is a real NPCI `upi://pay` string. If you set `VITE_MERCHANT_VPA` to a real handle, a phone can open Paytm / GPay / PhonePe with the amount filled. Everything *after* that — “Payment received”, settlement, refund, supplier payout — is a **local ledger**. We never call Paytm Orders, never verify a checksum, never instruct a bank.

**Is the catalog real OCR or a fake?**
Both paths exist and are labelled. **Sample shops** are fixtures (use these on stage). A **photo the merchant takes** runs tesseract.js on the device: no upload. Printed type only; handwriting is out of scope.

**Why not a live vision model?**
A judged demo cannot depend on an API key or a network. The adapter seam is `VisionService` / `analyzePhoto`. Production VLM can replace the engine; the merchant-edit + API catalog stay.

**Why ranges instead of “12 bottles”?**
A photo cannot count inventory. A fake integer would be the first thing a kirana owner stops trusting. We show a range plus a capped-confidence days-of-cover number, and we say so on screen.

**How do payments become stock?**
An amount is not a basket. The solver proposes exact-sum combinations; the merchant confirms. Confirmed lines update velocity. Without confirmation we do not decrement.

**Where is photo two (supplier bill)?**
`/#/dukaan/invoice` can photograph a bill (on-device OCR, qty × rate check, fuzzy SKU link) or load the matching **sample** (Sharma Traders / Sri Balaji). Use the sample on stage so the reorder total is repeatable.

**Do you send WhatsApp?**
No. We open a `wa.me` draft. Cloud API send is out of scope.

**Will this work for a 2,000-SKU kirana?**
Not this V0. Scoped to ~10–15 items so the owner can review every row in one sitting.

**What happens on Vercel if two phones hit different instances?**
Without Redis, state is per-instance memory. `/api/health` tells you. The public slug `meena-kirana` always seeds a demo catalog so a customer QR never 404s on a cold start.

**Why is QR Rakshak in the repo?**
Abandoned parallel idea. Not this product. Do not demo it.

More: [FEATURES.md](./FEATURES.md) · [PAYTM_INTEGRATION.md](./PAYTM_INTEGRATION.md) · [DEMO.md](./DEMO.md).
