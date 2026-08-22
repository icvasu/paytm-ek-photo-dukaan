# Judge defense — likely questions

Short, honest answers. Do not over-claim. Product: **one photo → digital dukaan**, hosted in a Paytm-for-Business-style shell.

---

**Is this official Paytm?**
No. Unofficial hackathon prototype. No Paytm credentials, no production tenant, no endorsement.

**Show me where the app says that.**
**Profile → About.** One place, two sentences, not a scattering of badges: *Ek Photo Dukaan is an independent hackathon prototype. It is not an official Paytm product and is not affiliated with or endorsed by Paytm.* Then: *Payments, settlements and supplier payouts on this build are simulated on-device. No live Paytm, bank or WhatsApp Business integration is connected, and no real money moves. Merchant, customer and supplier records are sample data.* Individual screens still label their own simulated part where it appears — the placeholder-VPA notice under a QR, the fixture-vs-read note on scan and manage, *Simulated Paytm vendor payout queued; no bank API called* on the order card — but the affiliation claim is made once, in full, where a merchant would look for it.

**Does money actually move?**
The QR is a real NPCI `upi://pay` string. If you set `VITE_MERCHANT_VPA` to a real handle, a phone can open Paytm / GPay / PhonePe with the amount filled. Everything *after* that — “Payment received”, settlement, refund, supplier payout — is a **local ledger**. We never call Paytm Orders, never verify a checksum, never instruct a bank.

**That reference on the receipt — is it a real UPI transaction ID?**
No, and the field does not claim to be. It is labelled **App payment reference** and its value is prefixed `EPD-`, because this app generated it. A genuine UPI transaction ID is returned by the network, and we never contact the network — so presenting ours as one would be the exact kind of quiet dishonesty a merchant would eventually catch. The receipt's other identifier, **Order reference**, is ours too. Simulated settlements get an `EPD-STL-` bank reference on the same principle.

**Is the catalog real OCR or a fake?**
Three paths, labelled differently on the same screen. **Sample shops** are fixtures — rows we wrote next to a drawing (use one for the judged run, because it is repeatable). A **photo the merchant takes** runs tesseract.js on the device, no upload. And two **sample photos** run that identical function on photographs that ship with the app, with no fixture to fall back on. Printed type only; handwriting is out of scope.

**Prove the OCR is real without using my phone.**
Tap **Photo of a printed rate card**. It reads 13 lines at 94% mean text confidence and keeps 11 of the 12 printed rows, every price exactly as printed. Then tap **Photo of a cluttered shelf**: zero lines, and the app refuses instead of producing a catalog. Same code path, opposite outcome — that pair is the honesty claim. `node server/verifySamplePhotoOcr.mjs` reprints both results from the shipped assets.

**Why 11 rows and not 12?**
OCR ran "Aashirvaad Atta 5 kg" together as `Atta5kg`, and the name filter rejects a 6+ character run mixing letters and digits because that is what a GSTIN or a bank reference looks like. The price ₹295 was read correctly; the name was refused. We would rather drop a row we cannot name than show a row we guessed, and it is visible in **How this was read from your photo** with the reason attached.

**Why not a live vision model?**
A judged demo cannot depend on an API key or a network. The adapter seam is `VisionService` / `analyzePhoto`. Production VLM can replace the engine; the merchant-edit + API catalog stay.

**Why ranges instead of “12 bottles”?**
A photo cannot count inventory. A fake integer would be the first thing a kirana owner stops trusting. We show a range plus a capped-confidence days-of-cover number, and we say so on screen.

**How do payments become stock?**
An amount is not a basket. The solver proposes exact-sum combinations; the merchant confirms. Confirmed lines update velocity. Without confirmation we do not decrement.

**Where is photo two (supplier bill)?**
`/#/dukaan/invoice` can photograph a bill (on-device OCR, qty × rate check, fuzzy SKU link) or load the **sample bill that matches the loaded shop**. On the judged path — Meena's kirana shelf — that is **Sri Balaji Distributors**, usual order **₹7,175**, and the reorder flags exactly the four items the bill covers. (The tea-counter rate card pairs with Sharma Traders instead; do not name that supplier on stage.) Use the sample so the total is repeatable, and call it a sample.

**Do you send WhatsApp?**
No. We open a `wa.me` draft. Cloud API send is out of scope.

**Will this work for a 2,000-SKU kirana?**
Not this V0. Scoped to ~10–15 items so the owner can review every row in one sitting.

**What happens on Vercel if two phones hit different instances?**
Without Redis, state is per-instance memory. `/api/health` tells you. The public slug `meena-kirana` always seeds a demo catalog so a customer QR never 404s on a cold start.

**Why is QR Rakshak in the repo?**
Abandoned parallel idea. Not this product. Do not demo it.

More: [FEATURES.md](./FEATURES.md) · [PAYTM_INTEGRATION.md](./PAYTM_INTEGRATION.md) · [DEMO.md](./DEMO.md).
