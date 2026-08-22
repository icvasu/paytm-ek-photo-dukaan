Team SEER · Vasu Gupta & Jai

# Judge grill — hostile Q&A

Rehearsal sheet for mentor and jury questioning. Grouped by the five scoring
criteria, plus a sixth group for the "this is fake" line of attack.

**Answer rules:** short, confident, honest. Never invent a metric. If you do not
know, say "I don't have that number" and offer the number you do have.

**Never say:** "accuracy", "we integrated with Paytm", "it learns", "real-time
sync", "it's live".

---

## Numbers you are allowed to say

| Number | What it actually is |
| --- | --- |
| **12 items** | Meena's kirana sample shelf catalog |
| **₹45 → 1 basket, 14 combinations** | Solver on that catalog: exactly one exact-sum basket, 1× Thums Up 750 ml |
| **92%** | Hard confidence **cap** in the solver, not an accuracy figure |
| **13 lines · 94% mean confidence · 12 of 12 priced rows** | Real OCR on the shipped rate-card photo; the one dropped line is the card's heading, which has no price |
| **12 lines · 93% · 10 of 10 priced rows · 0 price errors** | Real OCR on the printed Gupta General Store sheet a judge can photograph live |
| **2–3 → 1–2 left, ~2 days** | Thums Up forecast before and after one confirmed basket |
| **over 150 tests, 13 files** | `npx vitest run` |
| **40 / 40** | `node server/verifyJudgePath.mjs` walk of the judged path |
| **11 distinct price points** | Available prices on Meena's catalog, which is what makes ₹45 identifiable |

---

## The ten most likely questions

### 1. "Why does this need to be Paytm? Build it standalone."

Paytm is both ends of the loop. Money-in is the only signal that tells us
something left the shelf without asking Meena to record a sale, and money-out is
how the restock actually happens. Take Paytm away and I have to ask her to type
what she sold — which is exactly the app we refused to build.

**Don't say:** "it could work on any PSP." That kills your integration score.

### 2. "Is this actually integrated with Paytm, or is it a mock?"

The UPI layer is real and production-correct: `upi://pay` intent URIs built to
NPCI spec, validated field by field, with 17 tests. Scan a QR in this app with
your own phone and a real payment app opens with the amount filled in.
Authorisation, the status callback, settlement and the supplier payout are
simulated, labelled on every screen, and behind a one-file adapter seam.

**Don't say:** "we integrated with Paytm APIs." We did not. We built the seam.

### 3. "So this is just OCR plus a QR code."

OCR alone gives you a price list, which is a party trick. The product is what
happens after: a bare payment amount gets decomposed against those prices into a
basket, and that basket is what moves stock. The photo exists to make the
payment stream interpretable — neither half is a product on its own.

### 4. "How can an amount tell you what was sold? ₹45 could be anything."

It can, and when it can, we say so. On Meena's 12-item shelf the solver searches
14 combinations and finds exactly one that sums to ₹45 — one Thums Up. Type ₹73
on the same catalog and there are two exact baskets, so the app ranks them and
waits for her to tap. Stock never moves on a guess.

### 5. "Is 92% your accuracy?"

No. Ninety-two percent is a hard ceiling we wrote into the solver, because an
amount can never prove a basket. It is the posterior over the exact-sum baskets
we found, clamped so we can never print a number that implies certainty we do
not have. We have no accuracy figure, because we have no field data.

### 6. "Is the OCR real, or did you hard-code the price list?"

Both exist and they are labelled differently on screen. The judged tap is a
sample shop — pre-written rows, and the panel says so. Under "read a sample
photo for real" and on any photo you hand me, tesseract.js runs on-device: 13
lines at 94% mean confidence, 12 of 12 priced rows kept on our shipped card, and
you can print our external sheet and photograph it live for 10 of 10.

### 7. "What happens on a bad photo?"

It refuses and tells you why. There is no silent fallback catalog anywhere in
the app — we ship a cluttered-shelf photo specifically to demonstrate the
refusal, and it reads zero lines of text and stops. Every accepted row carries
its own confidence and stays editable, because Meena is the source of truth, not
the model.

### 8. "Scale this to a 2,000-SKU kirana."

It does not, and that is a stated product boundary rather than a bug. Once prices
overlap heavily an amount is an unreadable mixture, so we scoped to a 10–15 item
catalog with distinct prices where the maths is identifiable. Beyond that the
honest path is more signal — a scanned item, a supplier invoice constraint — not a
bigger search.

### 9. "Why not a vision LLM? GPT-4o would read that card better."

Probably, on a good photo. It also costs money per scan, needs the venue's
network, and sends a shopkeeper's shelf to someone else's server. On-device
Tesseract is zero marginal cost, works with the network unplugged, and uploads
nothing — and the vision adapter is one interface, so a VLM can be swapped in
where the economics justify it.

### 10. "Where do you tell a user that none of this money is real?"

Profile → About carries the full disclosure: independent prototype, not
affiliated with or endorsed by Paytm, payments and settlements and payouts
simulated. Then each screen labels its own simulated part — the placeholder-VPA
notice under every QR, "Simulated Paytm vendor payout queued" on the order card,
and a receipt reference labelled "App payment reference", never "UPI transaction
ID".

---

## 1 · Paytm Integration

**Q. "Which Paytm API did you call?"**
None, and we say so plainly. We had no merchant credentials, and faking a bank
confirmation is the one lie a shopkeeper would eventually catch. What we built
instead is the seam — `PaytmService` with a demo implementation today and a
`LivePaytmService` slot — plus the exact call-by-call mapping to Create Order,
Initiate Transaction, Payment Status and Settlement in our integration doc.

**Q. "So how long to make it real?"**
Merchant ID and key, one registered HTTPS callback URL, and persistent storage
for the order-reference mapping. Nothing outside `PaytmService.ts`, one new
webhook route and one line in the DI container has to change. The ledger schema
already uses Paytm-shaped order and transaction identifiers.

**Q. "Show me the webhook. What stops me from POSTing myself a fake payment?"**
The webhook is designed, written up and deliberately not built, because an
unsigned endpoint is an invitation to invent payments. Four properties are
non-negotiable in that design: checksum verification with the merchant key,
idempotency on `txnId` because Paytm retries until it gets a 200, an assertion
that the webhook amount equals the amount we encoded in the QR, and an ambiguity
gate so stock waits for the merchant when several baskets fit.

**Q. "How would the webhook know which QR it belongs to?"**
Every dynamic QR we render carries a `tr` reference we generate. That is the join
key: the webhook arrives with the order, we look up the `tr` we issued, and we
assert the amount matches before anything touches stock.

**Q. "Settlement — is that real?"**
No. Instant settlement moves the balance in our own ledger and prints a
reference we generated ourselves, prefixed `EPD-STL-`. In production that call
becomes the Settlement API and the reference becomes a real UTR. The label on the
screen changes when the source of the number changes, not before.

**Q. "What about Soundbox?"**
The confirmation line and the preference toggle are in the app; no Soundbox
device is spoken to. It matters as a product point though — Soundbox is where
the merchant already hears "payment received", so it is the natural place to
also hear "one Thums Up, confirm?" without her looking at a screen.

**Q. "Refunds?"**
Not real. The ledger flips a status, no bank is contacted, and the app refuses
outright to refund a payment that has already been settled rather than pretending
it can unwind one. That refusal is deliberate — it is the honest version of a
capability we do not have.

**Q. "WhatsApp — you said you send the order. Do you?"**
We open a real `wa.me` draft with the order text pre-filled and the merchant
presses send. That is not the WhatsApp Business Cloud API and we never claim
delivery. It is also the honest design: a supplier order is money, so a human
sends it.

**Q. "Why not WhatsApp Payments?"**
Because Paytm is not in WhatsApp's listed India payment-gateway set, so claiming
native WhatsApp Payments would be false. The honest version is what we built: the
order goes out on WhatsApp because that is where supplier orders already happen,
and the payment stays inside Paytm.

**Q. "Could you not have used a Paytm-managed dynamic QR?"**
That is exactly the production upgrade path, and it is in the integration doc —
`qrPayload()` becomes Create Dynamic QR and we get a `qrCodeId` back. We built
the client-side NPCI intent instead because it is a standard, not an API, so it
is already production-correct with no credentials.

**Q. "Is Paytm actually necessary, or is this a payments-agnostic app?"**
Swap Paytm out and both the sensor and the actuator vanish. The amounts we
decompose come from the merchant transaction stream, and the reorder is a vendor
payout. That is the test the theme brief itself sets, and this product fails it
without Paytm — which is the point.

**Q. "Are you affiliated with Paytm?"**
No. Independent hackathon prototype, not affiliated with or endorsed by Paytm,
and that sentence is in the app under Profile → About, not just in a README.

---

## 2 · AI Innovation

**Q. "Walk me through the basket inference. Precisely."**
It is a bounded multi-subset-sum search over the catalog's real prices. Items at
the same price collapse to one representative, because two items at ₹20 are
indistinguishable from an amount alone. Then a depth-first search enumerates
combinations up to four distinct SKUs, twelve units per SKU and twenty-four
units total, inside a 250,000-node budget, and every exact-sum basket it finds
gets scored.

**Q. "Scored how? Where does the ranking come from?"**
A plausibility cost with three stated shop-floor assumptions: shorter baskets
beat longer ones, small quantities beat large ones, and items the shop has
actually sold beat items it has not. That cost goes through a softmax to a
posterior across the baskets found, which is what the confidence number is —
capped at 92%. Every input is printed in the "How this was inferred" panel, so
the number is auditable rather than decorative.

**Q. "Combinatorial explosion. What happens at 200 SKUs?"**
The node budget stops the search and the app says the search limit was reached
and more baskets may exist — it does not quietly return a truncated answer as if
it were complete. But the real answer is that at 200 SKUs the answer stops being
useful before it stops being computable, because the amount becomes ambiguous.
That is why the scope is a small distinct-price catalog.

**Q. "What if nothing adds up?"**
It returns `no_solution` with the reason and the number of combinations it
searched, and asks the merchant to enter items by hand. Try ₹1 or ₹9,999 on
stage. The refusal states are the part of this we are proudest of.

**Q. "Show me ambiguity, not the case that works."**
Happy to. On the printed rate-card catalog ₹45 has eight exact baskets and
confidence drops to 28%. On the external Gupta sheet, ₹90 gives three baskets at
49% and ₹120 gives four at 37%. In every one of those the app lists alternatives
and moves no stock.

**Don't say:** don't use ₹20 on the Gupta sheet as an ambiguity demo. Three items
share ₹20, and the solver collapses same-price SKUs, so it answers with one
basket at 92% and you will look wrong.

**Q. "Is the OCR yours or a library?"**
The engine is tesseract.js — we did not write an OCR engine in a day and would
not claim to. What is ours is the pipeline around it: downscale to a 1600-pixel
long edge, greyscale, contrast stretch, single-column page segmentation, then a
line parser that decides what is an item and what is a price, then a thresholded
fuzzy match against a product lexicon.

**Q. "So the parser is regexes. Where is the AI?"**
Two places. Tesseract's LSTM recogniser is a neural model doing the reading, and
the basket inference is an inverse problem — recovering a basket from its sum —
which no spreadsheet rule does. The parsing and matching in between is
deliberately boring engineering, because that is what makes the output
inspectable.

**Q. "Handwriting?"**
Out of scope, stated up front, and never the judged path. We ship an English
print model; handwriting needs a different model and a different confidence
story, and pretending otherwise on stage would be a demo suicide.

**Q. "Hindi? Devanagari? Bilingual cards?"**
Today we ship the English model only, so a Devanagari card is not read. The
parser tolerates Devanagari characters and the restock prompt copy is already
Hinglish, so the gap is a language model to add, not an architecture to change.
I would rather tell you that than claim a bilingual read I cannot show you.

**Q. "How is the restock forecast computed? Is it a model?"**
An exponentially weighted moving average of daily units sold with a 3.5-day
half-life, so a sale a week old carries about a quarter of today's weight. On-hand
is the photographed range minus units from confirmed baskets, cover is on-hand
divided by that rate, and we flag a reorder under four days. Below two observed
units or two days of history it says the rate is a hint and not a forecast.

**Q. "Did the model learn anything today?"**
No, and we will not draw you a learning curve. We have the two things a learning
system needs — the label, which is the merchant confirming a basket, and the
constraint, which is the supplier invoice saying what came in. Volume trains
later; today it is a stated heuristic with its inputs on screen.

**Q. "Are the insight cards LLM-generated?"**
No. They are rules over the transaction ledger, and no insight names a customer,
a weekday or a figure that was not derived from the data. There is a test that
renames the customers and reshapes the week and asserts the copy moves with it.
We would rather have text we can defend than text that sounds smarter.

**Q. "The invoice reading — how do you know it did not hallucinate a quantity?"**
Every row has to satisfy `qty × rate = amount` arithmetically or it is rejected
with the reason shown. A row with only one number on it is rejected rather than
having a quantity guessed for it, and a line that does not clear the fuzzy-match
threshold stays unmatched instead of being forced onto a catalog item.

**Q. "'Limca 750 ml 32.00' — did you just order 750 bottles?"**
No. A number immediately followed by a measurement unit is treated as a pack
size, not a quantity, so 750 ml never becomes an order quantity. That specific
case is a named test.

**Q. "A rate card has a GSTIN and a phone number on it. Do those become items?"**
No. Header words like GSTIN, MRP and phone are in a not-an-item list, and the
junk-name rules reject long digit runs, dates, and mixed letter-digit reference
codes. The interesting edge is the opposite direction: OCR often glues a pack
size to the word before it as "Atta5kg", which looks exactly like a reference
code, so we unglue a unit only when it ends its token — and a GSTIN never ends in
a printed unit.

**Q. "Your lexicon says Surf Excel 500 g and the card says 1 kg. Which wins?"**
The printed text wins, always. The lexicon does the matching, but the pack size
the photo actually stated survives to the displayed name, because putting a size
on screen the photo never showed is a fact we invented. Same rule made a row read
`Aashirvaad Atta5kg 295` resolve to Aashirvaad Atta 5 kg at ₹295 with the raw
text shown beside it.

**Q. "Why no barcodes? Every shop has them."**
A barcode means a scan per item, which is the labour this merchant already
refused — that is why her inventory app is empty. Barcodes are also the obvious
future signal, and they fit the same loop: a scan is just a stronger constraint
on the same basket. We started with the signal that costs her nothing.

**Q. "This is a POS, and POS already exists."**
A POS requires ringing up every item, which is exactly the work that never gets
done at a one-person counter. We use the amount she already collected. That is
the whole difference, and it is the reason her catalog exists at all.

**Q. "Cash sales — your stock is wrong the moment she takes a note."**
Correct, and we say it on stage before you ask. Paytm sales are observed; cash is
a prior, not a claim of omniscience. It is also why stock is a range and why the
merchant confirms — the design assumes it is partially blind.

**Q. "Why is stock a range?"**
Because a photo of a shelf cannot produce a count, and a fake integer is the
fastest way to lose a shopkeeper's trust — she opens the fridge, sees five, the
app said four, and never opens it again. So the app says "about 2–3 left" and
narrows the band as confirmed baskets come in.

---

## 3 · User Impact

**Q. "You have zero users. What is your evidence any of this helps?"**
None from the field, and I will not dress up a demo as a pilot. What I can defend
is the mechanism: every inventory app starts by asking for a couple of hundred
items typed in at roughly twenty seconds each, which is over an hour of unpaid
work that also never finishes because prices change. We removed that step
entirely, and that is the claim on trial — not a retention number.

**Don't say:** any adoption, revenue or time-saved figure. There is no field
data.

**Q. "Who exactly is this for?"**
Meena Reddy's kind of shop: one pair of hands, a queue at the counter, a rate
card already on the wall, and Paytm collections she already takes. She does not
want a dashboard. She wants a price list that exists after one photo and a
warning before the best-seller is gone.

**Q. "She cannot read English. Now what?"**
Then today's build is not for her, and that is a language-model gap rather than a
redesign. What is already in her favour: nothing has to be typed, stock is shown
as a range with a shape and a number rather than colour alone, the restock prompt
copy is Hinglish, and the confirm step is one tap on a picture of a basket.

**Q. "What does she get on day one, before any payments come in?"**
A catalog from one photo, a shareable price-list page, a WhatsApp draft of her
prices, and a QR. That is value with zero payments attributed. The inventory
intelligence is what accumulates after.

**Q. "She already has a Paytm QR. What is new?"**
The QR was already there; what was missing is that the amount meant nothing
afterwards. We give the amount a catalog to be interpreted against, so the same
payment she was already taking now also updates a stock register she never had.

**Q. "Vyapar, Khatabook, Dukaan apps — how are you different?"**
Every one of them starts with data entry, and that is where they lose the
merchant with one pair of hands. We never ask her to enter stock, and we live
inside the app she already opens every morning rather than being a twelfth icon
she has to remember. If you file this as "another inventory app", we have lost —
the difference is the cold start.

**Q. "Isn't this a feature Paytm could ship in a sprint?"**
I hope so — that is the strongest thing about it. It is an add-on under "More for
your business", it needs no hardware, no new merchant behaviour and no new
onboarding, and the AI runs on the merchant's own phone at zero marginal cost.
A feature Paytm can actually ship is worth more than a startup Paytm has to buy.

**Q. "What if she does not confirm the baskets? Your loop dies."**
Then she still has a catalog, a storefront and a QR, and the forecast simply says
it has no demand signal for that item rather than inventing one. The confirm is
one tap on a receipt she already opens, and in production the webhook makes it
one tap on an unambiguous basket only. Non-confirmation degrades the product; it
does not break it.

**Q. "What is the actual harm you prevent?"**
Two things she loses money on every week: running out of the best-seller on a
Saturday evening, and a crate the supplier pushed on her sitting unsold. Both are
consequences of not knowing what is left, and both come from the same gap — no
register, because no one will maintain one by hand.

---

## 4 · Demo Quality

**Q. "You tapped a sample. Nothing was read from that picture, was it?"**
Correct, and the app says exactly that. The judged tap is a labelled sample shop
whose evidence panel reads "How this catalog was made" and states the rows ship
with the prototype and were not read out of the picture. A real read gets a
different panel — "How this was read from your photo" — with the engine, lines
read, mean confidence, rows kept and the reason for every skip.

**Q. "Then show me a real read, right now, on something you have not seen."**
Print our A4 sheet from `docs/print/` — it is deliberately not registered as a
sample and nothing in the source references it — and photograph it. Measured
through the shipped path: 12 lines, 93% mean confidence, 10 of 10 priced rows,
zero price errors. Six of the ten matched the lexicon; the four that did not are
kept with the name the card printed and scored lower for review.

**Q. "Why is ₹45 not in the payments list you showed me?"**
Because it is not seeded — I create it live. My QR, type 45, record a counter
payment, then open it. That is deliberate: if ₹45 were pre-seeded you would be
right to suspect the whole attribution beat.

**Q. "Your Wi-Fi dies mid-demo. Then what?"**
OCR is on-device and the engine, WASM core and language model are served from our
own origin rather than a CDN, so a read still works. Sample shops and the seeded
payment stream need no network at all. Worst case I continue on the screenshots
embedded in the deck.

**Q. "Show me it failing."**
Three taps. The cluttered-shelf photo reads zero lines of text and refuses.
Collecting ₹13 always fails, so you can see the failure screen on demand. Break
the network and the public storefront gives up after twelve seconds with "This
shop isn't available" and a retry, instead of an infinite skeleton.

**Q. "Everything is reversible? Nothing destructive?"**
Deleting a catalog row offers Undo for five seconds and nothing reaches the API
until it expires. Approving a reorder is idempotent, so a double tap cannot
double-order. Profile → Advanced → Reset to sample data puts the whole demo back,
which is also the proof that this is demo state and not a production tenant.

**Q. "Why does the receipt have no way back to your feature?"**
Because a payment receipt in a real merchant app has no bottom tab bar, and we
did not add one just to make our own demo shorter. Two backs to Home, then
Business → Ek Photo Dukaan. Walking that path is itself the point: the feature
lives inside the merchant app.

**Q. "Which number moved after the confirm? Say it out loud."**
Thums Up goes from "about 2–3 left, 35% confidence, low on shelf" with no cover
figure — because nothing had been attributed yet — to "about 1–2 left, 60%
confidence, roughly two days". One confirmed basket produced both the narrowing
and the first cover estimate.

**Q. "What are you not going to show me?"**
GST, khata reminders, loans, ads, a chatbot, and any learning curve. They are all
out of scope on purpose and listed as such. Adding them would have made the demo
longer and the claim weaker.

---

## 5 · Build Feasibility

**Q. "What is this actually built on?"**
React 19 and TypeScript on Vite, Zustand for state, tesseract.js for on-device
OCR, and a small in-process API that runs both as Vite middleware locally and as
one Vercel serverless function in production. No paid AI service, no key in the
client, no external model call on the judged path.

**Q. "How do I know any of it works?"**
Three commands. `npx vitest run` is over 150 tests across 13 files.
`node server/verifyJudgePath.mjs` walks the judged path against a running API for
40 checks and prints a pass line for each — including that the server rejects a
basket which does not total the payment. `node server/verifySamplePhotoOcr.mjs`
re-measures the OCR claims on the shipped photos.

**Q. "This is a hackathon deploy on a free tier. Is it production?"**
No, and it does not pretend to be. Without a Redis store, state lives in one warm
serverless instance and can reset or differ across instances — `/api/health`
reports which mode it is in, and only claims shared storage after a real round
trip. So I will not promise you cross-device sync today. Attaching Upstash is an
environment variable pair, not a rewrite.

**Q. "So if I open it on my phone while you use yours?"**
The public storefront always resolves, because a cold instance seeds the sample
catalog on demand and a scanned QR therefore never 404s. Your merchant-side edits
and mine may not be the same state. I would rather tell you that than have you
discover it mid-demo.

**Q. "Cost to run at scale?"**
The AI is the cheap part: OCR runs on the merchant's phone, so it is zero
marginal cost per scan and no images are stored or transferred. The solver is
milliseconds of CPU inside a node budget. What actually costs money in production
is persistence and the webhook path, which are ordinary infrastructure.

**Q. "What ships in 90 days, realistically?"**
The live adapter and the signed webhook with checksum, idempotency and the amount
assertion; shared persistence so a catalog is durable across devices; and a
Devanagari model so a Hindi card reads. Then a small pilot with real shops, which
is the only way to get the accuracy number I currently do not have. Everything
past that depends on what the pilot says.

**Don't say:** any headcount, budget or launch commitment. Stick to the
engineering.

**Q. "What did you cut?"**
Dark mode, GST, loans, ads, a chatbot, live handwriting, and any claim of a
trained model. We also cut the second half of the original concept — consumer
bill onboarding — to keep one loop. Cutting is why the judged path has a harness
instead of a demo script and a prayer.

**Q. "Team SEER — who did what?"**
Team SEER is two of us, Vasu and Jai. Rather than hand you an org chart, ask
either of us about any screen and we will answer for it — everything on stage is
ours and there is nothing in the repo neither of us can explain.

**Don't say:** any invented split of the work. Agree the real one with Jai before
you walk in, or use the answer above verbatim.

**Q. "What is the hardest thing left?"**
Ambiguity at scale. A larger catalog makes more amounts unidentifiable, and the
answer is not a cleverer search — it is more evidence: the invoice constraint that
you cannot sell what you never bought, and eventually a stronger per-sale signal.
That is a data problem, and it needs a pilot rather than a weekend.

**Q. "What would you rebuild given another week?"**
The persistence layer first, so cross-device is real rather than caveated. Then
the webhook, because it converts the confirm step from a chore into a
one-tap-only-when-ambiguous step. Both are already designed; neither changes the
UI.

---

## 6 · Gotchas, honesty, "this is fake"

**Q. "Be straight with me. How much of this is real?"**
The reading, the maths and the QR are real. The photo is read on the device with
no upload, the basket inference is a real search over real prices, the catalog
and the supplier bill persist through an API, and the `upi://pay` QR is
production-correct. One layer is simulated: the moment money is confirmed
received, settled or paid out. It is labelled everywhere it appears.

**Q. "Why should I trust a number your own app printed?"**
Don't — recompute it. The evidence panels print their inputs: lines read, mean
confidence, rows kept and each skip reason for a photo; distinct price points,
combinations explored, exact-sum baskets and the ranking prior for a basket. The
harnesses re-measure the OCR and walk the judged path so you get the numbers
without taking my word.

**Q. "Your reference number looks like a UPI transaction ID."**
It is labelled "App payment reference" precisely so it cannot be mistaken for
one, and the string is prefixed `EPD-`. A real UPI transaction ID is issued by the
network on authorisation, and we never contact the network — mislabelling ours
would break the one field a merchant uses to reconcile a disputed payment.

**Q. "That QR — is it safe? Whose account does it pay?"**
Nobody's. With no VPA configured it encodes `example.merchant@upi`, a
deliberately fake placeholder, and every QR card says in words that scanning
opens a payment app but no money can move. No real VPA is hardcoded anywhere.
Point it at a real account by setting one environment variable.

**Q. "Could someone tamper with the QR amount?"**
Today it does not matter, because nothing settles. In the production design it is
handled at the webhook: we assert the amount Paytm reports equals the amount we
encoded in the QR, and reject on mismatch. That check exists because a reused or
edited QR is the obvious attack on this flow.

**Q. "Your notifications say a payout was queued. Was it?"**
No bank was instructed and the notification says so in its own title —
"Supplier order queued (simulated payout)", and later "Stock-in confirmed
(simulated)". We put the label in the title rather than in small print, because
the notification is the surface most likely to be screenshotted out of context.

**Q. "The supplier bill on stage is a fixture, isn't it?"**
Yes, and I will call it a sample when I tap it, because it makes the reorder
total repeatable on stage. The photo path next to it runs the same on-device OCR
and the same arithmetic check on a bill you hand me, and unreadable rows are
listed with the reason rather than guessed.

**Q. "Sample-shop stock ranges — those are made up."**
Authored, yes, and the provenance panel says so. If you want a genuinely read
catalog, tap a sample photo or hand me a printed card, and the panel changes to
report what was actually read off the image. The two paths are never labelled the
same way.

**Q. "What is the weakest part of this?"**
Cash, and ambiguity in a bigger catalog. Cash sales are invisible so the register
drifts, and the more prices overlap the more often the app can only say "one of
these three". Both are on the limits slide, because a judge finding them is worse
than us stating them.

**Q. "If I had one hour to break this, where would I look?"**
Cross-device state without Redis, and OCR on a genuinely bad photo — angled,
dark, glossy packaging. The first is documented and reported by the health
endpoint; the second ends in the refusal state rather than a wrong catalog, which
is the behaviour we chose. If you find something else, I would rather hear it now
than believe a number that is wrong.
