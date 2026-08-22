# Ek Photo Dukaan, in easy words

Read this in two minutes. No jargon.

---

## The problem

Meena runs a small shop. She has about 200 things on her shelves. She does not
know what she sold today. She does not know what is about to run out. On
Saturday evening a customer asks for a cold drink and it is already finished.

Apps exist to fix this. They all begin the same way: type in every product and
every price. That is twenty seconds a product, so more than an hour of work.
And prices change, so it is never finished. She has better things to do. So the
app stays empty and she keeps guessing.

## The one-photo idea

She takes one photo. Of her shelf, or of the price list already stuck on her
wall.

The phone reads the words and the numbers in that photo, right there on the
phone. It turns them into a proper list: item name, price. She can fix anything
that looks wrong by tapping it. That is the whole setup. No typing.

Out of that one photo she also gets a small web page of her shop that she can
share on WhatsApp, and a payment QR code.

## How the payment tells us what she sold

This is the interesting part.

A customer pays her ₹45 on the QR. The app only receives one thing: the number
45. Nobody scanned a barcode. Nobody rang up an item.

But the app already knows all her prices. So it asks a simple question: which
of her items add up to exactly ₹45? It tries the combinations. On her shelf
there are 12 items, it tries 14 combinations, and exactly one adds up to ₹45 —
one bottle of Thums Up.

It shows her that answer and asks her to tap "confirm". Only then does the
stock go down. If several different baskets add up to the same amount, it says
so and lets her choose. If nothing adds up, it says so and asks her to enter
the items by hand. It never pretends to know.

Then, because it can see how fast things are selling, it tells her what to
reorder. She photographs the supplier's bill, and pays the supplier from the
same app.

So the money coming in is how the app *sees* what happened, and the money going
out is how the app *does* something about it. That is the whole loop, and she
never types a product name.

## Why this has to be Paytm

She already has a Paytm QR and she already opens Paytm for Business every
morning. That matters twice.

The payment is the only signal that shows something left the shelf without
asking her to record it. Nothing else in her day produces that signal for free.
And the reorder has to end in a real payment to a real supplier, or the advice
is just a notification she ignores.

Take Paytm away and this app has nothing coming in and nothing going out. It
would have to ask her to type what she sold — which is exactly the app we are
refusing to build.

## What is real and what is pretend

Real, working right now:

- The photo reading. It runs on the phone itself. Nothing is uploaded, there is
  no AI service being called, and it works with no internet.
- The maths that works out the basket from the amount.
- The payment QR code. It is a proper UPI QR. Scan it with your own phone and a
  real payment app opens with the amount already filled in.
- The catalog, the stock and the supplier orders. They are saved and survive a
  page refresh.
- WhatsApp sharing. It opens the real WhatsApp app with the message already
  written; she presses send herself.

Pretend, and clearly labelled inside the app:

- The moment a payment is "received", and the money reaching her bank. That is
  our own record, not a bank's.
- Paying the supplier. No bank is contacted.
- The reference number on the receipt is ours. It is labelled "App payment
  reference" and never called a UPI transaction ID, because we never spoke to
  the UPI network.

We faked that one layer on purpose. Doing it for real needs official Paytm
merchant credentials, which a hackathon team should not have. Printing a fake
bank confirmation is the one lie a shopkeeper would eventually catch, so we
labelled it instead — in the app, under **Profile → About**, and on each screen
where it happens.

This is an independent prototype. It is not an official Paytm product and is
not affiliated with or endorsed by Paytm.

---

## If someone asks for one sentence

> She photographs her shelf once, and after that the payments she already takes
> keep her stock register up to date by themselves.

## Numbers you can check, live

| Claim | Command |
| --- | --- |
| Photo reading: 13 lines, 94% average confidence, 12 priced rows kept | `node server/verifySamplePhotoOcr.mjs` |
| The whole demo path works: 40 checks, 40 pass | `node server/verifyJudgePath.mjs` |
| 155 tests across 12 files | `npx vitest run` |
