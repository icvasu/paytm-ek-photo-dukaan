# Ek Photo Dukaan · 5 minute speaker script

**Paytm AI Hackathon · Hyderabad · Theme 2, AI for Small Businesses**

The live app is the presentation. `PITCH.html` is a wrapper you leave on slide 1
while you talk, and return to at 4:30. If you have to choose between finishing a
slide and finishing a tap, finish the tap.

---

## Before you are called

Run this checklist. It takes ninety seconds and it is the difference between a
demo and an apology.

| Check | How | Why |
| --- | --- | --- |
| Phone width | Browser at roughly 390px wide, or DevTools device mode | The app is a merchant phone shell. Full desktop width looks like a website |
| Clean slate | Profile, Advanced, **Reset to sample data** | Removes any catalog from a rehearsal so slide 3 lands on an empty dukaan |
| Health | Open `/api/health` in a second tab | Confirms the API answered before you are on stage |
| QR target | Profile, check **UPI ID on your QR** | If it says `example.merchant@upi` you must say the word placeholder out loud |
| Second device | A phone on the same network, browser open, ready to scan | This is the 1:40 beat. Do not scramble for it live |
| Deck | `docs/PITCH.html` open in another window, slide 1 | Press `F` for fullscreen before you start talking |
| Fallback | `PITCH.html` slides 3, 4 and 6 are the whole demo as static visuals | If the app dies you keep talking, you do not stop |

Two things you say once, early, and never repeat: this is an unofficial
prototype, and the payment rails are simulated. Said once at 4:10 it reads as
confidence. Said five times it reads as apology.

---

# The five minutes

---

## 0:00 to 0:40 · The problem

**Tap:** Nothing. Deck on slide 2. Hands off the laptop.

**Say, verbatim:**

> Meena runs a kirana in Hyderabad. She has about four hundred items on her
> shelves, and she has never written down a single one.
>
> Every inventory app ever built starts the same way. Enter your items. Enter
> your prices. Enter your stock. At twenty seconds an item that is two hours of
> typing, and prices change, so it is never done once. Nobody with a queue at the
> counter has done that twice.
>
> So she guesses. She is usually close. Usually close is how a shop runs out of
> its best seller on a Saturday evening and finds out from a customer.

**Point at:** The number 400 on the slide. Nothing else. Let it sit.

**If a judge interrupts** with "so this is an inventory app":
> Every inventory app asks her to enter her stock. We never ask. That is the
> whole product.

**Backup:** This beat has no dependency. If the deck will not open, say it with
your hands.

---

## 0:40 to 1:40 · One photo becomes a catalog

**Tap sequence:**

1. Switch to the app, on **Home**.
2. Tap the **Ek Photo Dukaan** card at the top. It reads *Turn one photo into
   your catalog*.
3. On the scan screen, tap **Meena's kirana shelf** under *or start from a
   sample shop*.
4. Land on **Manage**.

**Say, while step 3 is running:**

> This is Paytm for Business. She is already in here every morning to check her
> settlement. One card, one tap.
>
> She photographs her shelf. The reading happens on the phone, not on a server.
> Twelve items, with prices, in about four seconds. She typed nothing.

**Then, on the Manage screen, tap the row that says "How this was read":**

> And it shows its work. Lines read, rows accepted, rows thrown away. If it is
> not sure about a price it says so, and she fixes it in one tap, because she is
> the source of truth and the model is not.

**Point at:** The twelve item rows first. Then the stock tags on the right,
specifically **Thums Up, Running low, 2 to 3 bottles**. Say:

> Notice it says two to three bottles. Not seven. It never claims a count it did
> not count.

**What NOT to say here:**

- Do not say "our vision model". You shipped OCR plus fuzzy matching. Call it
  reading the photo, and if pressed, name the engine.
- Do not claim the twelve rows were read out of that particular sample picture.
  The app itself says they ship with the prototype. Read what the app says.
- Do not linger on editing. One price edit at most. The edit is not the story.

**If a judge interrupts** with "did it actually read that, or is it hardcoded":
> That one is a sample fixture and the screen says so. Hand me a photo of any
> printed price list and I will run it through the real reader right now.

**Backup:** If the sample tap fails, tap **Take or choose a photo** and upload
any printed price list from the desktop. Real OCR runs. It is slower, about
fifteen seconds, so narrate the progress bar rather than standing in silence. If
both fail, PITCH.html slide 3 is this screen as a static visual.

---

## 1:40 to 2:20 · The public dukaan and a QR a judge can scan

**Tap sequence:**

1. On Manage, tap **Preview** in the top right. You are now on
   `/#/dukaan/meena-kirana`, the customer view.
2. Scroll to **Pay this shop**.

**Say:**

> Same twelve items, now the customer side. Read only, because a customer should
> not be able to edit her prices.
>
> And this QR is real. It is an NPCI UPI intent, `upi://pay`, the same string a
> Paytm QR encodes. Somebody scan it.

**Hand the second phone to a judge, or point at your own.** Let them scan. Their
UPI app opens with Meena Kirana already filled in as the payee.

**Then say, before they ask:**

> Their payment app opened. The payee ID on there is a placeholder, so no money
> can move, and the app says that on the screen. Set one environment variable and
> that QR lands in a real merchant account. The QR is real, the account is not.

**Point at:** The **What this QR encodes** row. Open it. It shows the exact
`upi://pay` string, field by field, so what they scanned can be checked against
what you claimed.

**If a judge interrupts** with "so it does not actually take money":
> The QR is spec correct and their app opened, which is the hard part. Whether
> money settles is decided by their bank, and a hackathon build should not be
> touching that.

**Backup:** If nobody has a UPI app, open the **What this QR encodes** panel and
read the string out. Reading the raw `upi://pay?pa=...&am=...` aloud is almost as
convincing as a scan, because it is checkable.

---

## 2:20 to 3:20 · Payments keep the register

This is the beat that wins or loses the room. Do not rush it and do not talk over
the taps.

**Tap sequence:**

1. Back to Manage, then back to **Home**.
2. Tap **Collect**.
3. Type **45**.
4. Tap **Collect ₹45**.
5. On the success screen, tap **View payment**.
6. Scroll to **What did this customer buy?**
7. Tap **Confirm items**.
8. Go back to **Manage** and scroll to **Restock**.

**Say, at step 4:**

> A customer pays forty five rupees. That is all Paytm sees. A number. Nothing
> was rung up, no item was scanned, she did not touch a POS.

**Say, at step 6, before you tap Confirm:**

> But forty five is not just forty five. It is a fingerprint of a basket. So we
> search every combination of her own prices that adds up to exactly forty five.
> Fourteen combinations searched. Exactly one fits. One Thums Up.

**Open "How this was inferred" and point at it:**

> Bounded subset sum. Fourteen combinations explored, one basket sums exactly,
> ranked by fewer items and smaller quantities. Ninety two percent, and that is
> the ceiling on purpose, because an amount can never prove a basket.

**Say, at step 7:**

> She confirms. One tap. The model proposes and the shopkeeper decides. Stock
> never moves on a guess.

**Say, at step 8, pointing at the Thums Up forecast row:**

> And now look. Thums Up was two to three bottles. It is one to two, with about
> two days of cover. She did not count anything. She did not type anything. She
> took one payment.
>
> That is the whole idea. Payments keep the register.

**Point at:** The forecast row, specifically the range changing. If you rehearsed
it, you know the number was 2 to 3 before and 1 to 2 after. Say both numbers out
loud so the change is audible, not just visible.

**What NOT to say:**

- Do not say "Bayesian". It is an exponentially weighted rate and the app says so.
- Do not say the stock is now one bottle. It is a range. The range is the point.
- Do not use the printed rate card sample for this beat. On that catalog ₹45 has
  eight valid baskets and the confidence drops to twenty eight percent, which
  turns your best moment into a hedge. The kirana shelf is the one where ₹45 is
  unique.

**If a judge interrupts** with "you just picked an amount that works":
> I did, and I will show you the failure too. Try any amount you like and if
> nothing sums exactly it refuses to guess and asks her to pick. That refusal is
> the feature.

**Backup:** If Collect fails, open any existing ₹45 payment from the Payments
list and go straight to the basket card. The attribution is the beat, not the
collection. If the whole API is down, PITCH.html slide 4 is this loop in four
steps.

---

## 3:20 to 4:10 · Restock, reorder, and the real prize

**Tap sequence:**

1. Still on Manage, scroll to the supplier section. Tap **Add supplier bill** if
   no supplier is on file, then **Use this sample bill instead**.
   (The button above it, **Take or choose a photo of the bill**, runs the real
   on-device read. Take that path only if a judge hands you a printed bill —
   the sample keeps the ₹7,175 reorder total repeatable on stage.)
2. Back on Manage, tap **Approve reorder**.
3. Tap **Send on WhatsApp**. Let the draft open. Do not send it.
4. Come back and tap **Mark as paid and received**.

**Say (this wording is true for the sample tap):**

> Second photo, the supplier bill. These arrive as WhatsApp images already. This
> one is our labelled sample so the number stays repeatable, and the same screen
> will photograph a real bill — it reads who supplied it, what came in and at
> what unit cost, and it checks that quantity times rate equals the printed
> amount before it believes a row. Now the system knows what a full shelf looks
> like, which is what makes the sales side identifiable. You cannot sell what
> you never bought.
>
> Four items are running low. She taps approve, and the order is drafted to Sri
> Balaji Distributors on WhatsApp, which is where she already orders, and a Paytm
> vendor payout is queued behind it for seven thousand one hundred and seventy
> five rupees.

**Point at:** The order card. Read the note on it out loud, because it is your
honesty and your credibility in one line:

> "Merchant approved. Simulated Paytm vendor payout queued, no bank API called."
> That is on our screen, not in our footnotes.

**Then the punchline. Slow down. This is the biggest thing you say:**

> Now multiply it. Ten thousand kiranas, each one quietly telling Paytm they need
> the same crate on Thursday. That is not ten thousand notifications. That is one
> purchase order Paytm can aggregate, price, finance and settle.
>
> Nobody can build that from the top down. It only exists because the demand
> signal came up from the payments.

**If a judge interrupts** with "did money move":
> No. The payout is simulated and the screen says so. What is real is the
> approval, the order, and the WhatsApp draft.

**Backup:** If the supplier flow errors, the aggregation punchline needs no
screen at all. Say it to the room. It is the strongest sentence in the pitch and
it survives a dead laptop.

---

## 4:10 to 4:30 · Volunteer what is fake

Switch to **PITCH.html slide 6**. Do not read the slide. Talk over it.

**Say:**

> Before you ask, here is what is real and what is not.
>
> Real: the OCR runs on the device, the basket solver is a real bounded search
> with the counts on screen, the UPI QR is spec correct and you just scanned it,
> and the catalog and stock are API backed and survive a refresh.
>
> Simulated: Paytm order and settlement webhooks, WhatsApp Cloud delivery, a
> production vision model, and the supplier payout. Cash sales are a blind spot
> we do not paper over. And Meena Kirana is a representative shop, not production
> data.
>
> Every one of those is labelled on the screen it appears on, because a merchant
> who cannot tell a guess from a fact will stop trusting the whole app.

**Why you volunteer this:** a judge who finds a hidden mock stops listening to
everything else. A judge who watches you name your own mocks starts trusting the
parts you did not label.

**If a judge interrupts** with "so most of it is fake":
> The inference is real and it is the hard part. What is mocked is plumbing we
> cannot get credentials for in a day, and every mock is one adapter behind an
> interface.

---

## 4:30 to 5:00 · Close

Advance to **slide 7**. Then look at the judges, not the screen.

**Say:**

> One photo to set it up. After that her own payments keep her books.
>
> This can only be Paytm. The sale amount is the sensor and it lives in the Paytm
> transaction stream. The reorder is the action and it is a Paytm payment to a
> supplier. Take Paytm out and there is no input and no output. A standalone
> catalog app would have to ask her to type her sales, and that is exactly the
> product we refused to build.
>
> Only Paytm sees the payments. So only Paytm can turn them into a stock
> register.
>
> Thank you.

**Then stop talking.** Do not add a summary. Do not offer to show one more thing.
The silence after that last line is doing work.

---

# Q&A pocket card

Print this. One line each. Answer, then stop.

**"Is this real Paytm?"**
> No, and we say so in the app. This is an unofficial prototype built on the
> Paytm for Business pattern. Nothing here is endorsed by Paytm and no live Paytm
> API is connected.

**"Is this real OCR, or real AI?"**
> The OCR is real and runs on the device with no server call. The basket solver is
> a real bounded subset sum search and it prints how many combinations it
> explored. The vision model is standard OCR plus fuzzy matching, not a
> production grade VLM, and we do not claim otherwise.

**"Why is it always ₹45 and always Thums Up?"**
> Because on this catalog forty five has exactly one valid basket, so it makes the
> mechanism legible in a five minute slot. Pick any amount and watch. If several
> baskets fit, it shows the alternates and drops its confidence. If none fit, it
> refuses and asks her to pick.

**"What if the photo is garbage?"**
> Then it says so and gives her a starter list to correct instead of inventing
> items. Blurry, handwritten and angled photos are the known weak case. We chose a
> printed list for the demo on purpose and we are telling you that rather than
> hoping you do not notice.

**"Does the stock persist if I open it on another phone?"**
> The public price list does, from the API. Edits persist across devices only when
> a shared store is configured, and `/api/health` tells you which mode it is in
> right now. Without it, edits live on the warm instance. We are not going to
> claim durable multi device sync we cannot show you.

**"What exactly is fake?"**
> Paytm order and settlement webhooks, WhatsApp Cloud delivery, the production
> vision model, calibrated forecasting, and the supplier payout. Each one is an
> adapter behind an interface, and each one is labelled on its own screen.

**"Why Paytm rather than a standalone catalog app?"**
> A standalone app has no sensor and no action. It would have to ask her to type
> every sale, which is the labour she already refused, and it could not pay her
> supplier at the end. The sale amount is the sensor, the vendor payout is the
> action, and both only exist inside Paytm.

**"Is this not just a POS?"**
> A POS needs every item rung up. That is the work she refused. We use the amount
> she already collected and infer backwards.

**"How is this different from the other inventory entries?"**
> They all start by asking the merchant to enter stock. We never ask. The camera
> solves the cold start and the payments solve the ongoing count.

**"Did the model learn anything today?"**
> No, and we did not fake a learning curve. What we have is the label, a confirmed
> basket, and the constraint, the supplier bill. Volume trains it later.

**"Two thousand SKUs?"**
> Out of scope today and we will say that before you ask. Overlapping prices make
> the amount an unreadable mixture. We scoped to a catalog where prices identify
> baskets so the math is honest. That is a product decision, not something we are
> hiding.

**"What about cash?"**
> A real blind spot. Paytm sales are observed, cash is a prior. We do not pretend
> to see the whole shop.

---

# One page cheat sheet

Tape this to the laptop.

```
0:00  400 items. Every app says type them. Two hours she does not have.
0:40  Home > Ek Photo Dukaan > Meena's kirana shelf > Manage
      "Twelve items. She typed nothing." Point: Thums Up, 2 to 3 bottles.
1:40  Preview > Pay this shop. JUDGE SCANS.
      "Real upi://pay. Payee is a placeholder, so no money moves."
2:20  Home > Collect > 45 > View payment > Confirm items > Manage > Restock
      "Fourteen combinations, one fits. 2 to 3 became 1 to 2."
3:20  Add supplier bill > Approve reorder > WhatsApp > Mark as paid
      "Ten thousand shops, one purchase order Paytm can finance."
4:10  Slide 6. Name every mock before they ask.
4:30  Slide 7. "Only Paytm sees the payments." Then stop.
```

**Numbers you must not get wrong**

| Claim | Value |
| --- | --- |
| Items in the seeded catalog | 12 |
| Payment used in the demo | ₹45 |
| Combinations searched for ₹45 | 14 |
| Baskets that sum exactly | 1, being one Thums Up 750 ml |
| Basket confidence, and its cap | 92 percent, capped at 92 |
| Thums Up before the sale | about 2 to 3 left |
| Thums Up after the sale | about 1 to 2 left, roughly 2 days of cover |
| Forecast confidence cap | 85 percent |
| Items flagged for reorder | 4 |
| Supplier | Sri Balaji Distributors |
| Reorder value | ₹7,175 |
| Public dukaan route | `/#/dukaan/meena-kirana` |

**Three sentences that carry the whole pitch.** If you forget everything else,
say these.

1. Every inventory app asks her to type her stock, and nobody does it twice, so
   we never ask.
2. Forty five rupees is not a number, it is a basket, and that is how the shelf
   count stays current without anyone counting.
3. Only Paytm sees the payments, so only Paytm can turn them into a stock
   register.
