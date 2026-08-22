# Paytm AI Hackathon: Winning Strategy

**Hyderabad · 22 August 2026 · One-day sprint · Solo build**

Recommended concept: **Paytm QR Rakshak** — the AI that detects missing payments.

---

## Part A — Source analysis

### What the official material actually says

The Hyderabad theme PDF defines a one-day sprint with two problem spaces, and it is explicit that each theme "defines a problem space, not a solution."

**Track 1 — AI for Paytm Users.** Intelligent features that improve speed, trust, and experience across the Paytm ecosystem. The document names paying, recharging, transferring, investing, and transacting. Users care about three things: that it is fast, that it feels safe, and that it is effortless. First-time and regional-language users are explicitly in scope.

**Track 2 — AI for Small Businesses.** AI tools that help India's small and medium businesses grow, operate, and scale. The document names the kirana store, the chemist, the salon, the distributor, and the home-run brand. It spans understanding and reaching customers, managing money, inventory and billing, and planning ahead.

**The binding constraint appears in both themes.** Every solution must be built for the existing Paytm stack. It must plug into Paytm's current products and ecosystem rather than stand alone as an unrelated idea. A standalone product is explicitly out of scope.

### What the briefing photos add

The judging slide lists five criteria: **Innovation** ("novel approach, are you thinking outside the box?"), **Feasibility** ("can it work in the real world? technical viability"), **Impact** ("how many people will it help, and how much?"), **Execution** ("quality of build, a working prototype, not a concept"), and **Relevance** ("does it address the core challenge of your track?").

The slide carries a critical rule in its footer: **demos must be a working prototype. Slide decks or presentations alone are not allowed.**

### Rubric correction

The official material does not state the 5x20 point labels supplied in the brief. The photographed criteria are Innovation, Feasibility, Impact, Execution, and Relevance. The 100-point model used throughout this document is a strategic mapping, not a quoted official score sheet. The mapping applied is Relevance to Paytm Integration and Execution to Demo Quality. This is an explicit assumption.

### Evidence hierarchy

| Source | What it proves | What it does not prove |
| --- | --- | --- |
| Official Hyderabad PDF | Tracks, one-day format, native Paytm requirement | Weights, API availability, team size |
| Hyderabad briefing photos | Criteria labels and the working-prototype rule | Exact point allocation |
| Mumbai submission CSV | 44 prior concepts and saturation patterns | Winners, judge scores, or Hyderabad entrants |
| Current Paytm public pages | AI Soundbox, UPI Lite, UPI Circle, spend summary, merchant rails exist | Private API access at this event |
| Your input | Solo builder, no private API access | Exact remaining hours, preferred stack |

### Data hygiene note

The supplied CSV contains personal fields and at least one apparent API secret pasted by a prior entrant into a form field. This analysis deliberately excludes all names, emails, and secrets. Do not copy any credentials from that file.

### Previous submission analysis

You confirmed that none of the CSV entries belongs to your team. The file is therefore treated purely as Mumbai competitor intelligence. No "improve, pivot, combine, or abandon" decision applies to your own prior work, because there is none.

---

## Part B — Judge scoring psychology

### What each score band looks like

| Criterion | 5/20 | 10/20 | 15/20 | 20/20 |
| --- | --- | --- | --- | --- |
| Paytm Integration / Relevance | A logo, a payment link, or a standalone app | Uses a Paytm surface but could be any UPI app | Extends a real Paytm journey and uses plausible Paytm signals | Paytm has a structural advantage and can take a native action |
| AI Innovation / Innovation | LLM copy or a chatbot skin | Generic prompt plus retrieval | Purpose-built prediction or classification with grounding | New capability, visible intelligence, confidence, guardrails, no simpler substitute |
| User Impact / Impact | Vague convenience | Real pain, no quantified baseline | Frequent severe pain with defensible assumptions | Clear affected population, measurable money/time/trust outcome, validation path |
| Demo Quality / Execution | Slides or static screens | Clickable happy path | Working end-to-end flow with one clear AI reveal | Immediate problem, visible intelligence, Paytm action, quantified before/after, resilient live run |
| Build Feasibility / Feasibility | Architecture fiction | Mostly mocked with unclear boundaries | Real core intelligence plus an honest Paytm adapter | Small vertical slice, tested failure paths, seeded backup, no fragile dependency |

### Hidden implications in the wording

"Problem space, not a solution" rewards sharp problem selection far more than broad feature coverage. A team that picks one overlooked problem outscores a team that builds six shallow features.

"Existing Paytm stack" means a Paytm payment link is not enough. The idea needs a native surface, a proprietary signal, and a native action. If your product would work identically on PhonePe, Relevance collapses.

The one-day sprint rewards deterministic demos, seeded fallbacks, and one complete vertical slice. It punishes anything that needs training data you do not have.

The working-prototype rule makes deck-first and architecture-only entries noncompetitive regardless of idea quality.

Two product facts matter enormously and are easy to miss. Paytm has launched an **AI Soundbox** with a built-in assistant that interacts with merchants in 11 local languages and provides business summaries and payment insights. Paytm also already ships a **Monthly AI Spend Summary** that auto-categorises consumer spending. Building another multilingual merchant voice copilot or another spend-analysis chatbot means presenting a weaker clone of Paytm's own shipped product to Paytm's own judges.

---

## Part C — Opportunity map

### The prior field

The supplied CSV contains 44 submissions from the Mumbai event: 29 small-business concepts and 15 consumer concepts.

| Mechanism | Approximate share of 44 |
| --- | --- |
| Voice (STT/TTS/voice-first) | 70% |
| Chatbot or copilot | 61% |
| Inventory | 30% |
| Finance, GST, or P&L | 30% |
| OCR or vision | 25% |
| WhatsApp as the channel | 18% |
| Fraud overlay | 9% |

Percentages are hand-tagged from concept descriptions and are approximate.

Twelve teams built essentially the identical product: a vernacular merchant copilot answering "Aaj ka collection kitna hai?" over transaction data. The name collisions alone tell the story: Vyapar Saathi, Vyaparsaathi, Dukaan-Saathi, Paytm Sahayak, Paytm Saathi, Paytm Mitra.

### DO NOT BUILD THIS

**A multilingual merchant voice copilot.** Voice appeared in roughly 70% of the prior field, copilots in 61%, and Paytm has since shipped the AI Soundbox assistant in 11 languages. You would be competing against both a crowd and the host's own roadmap.

**Also avoid:** generic spend chatbots (Paytm ships Monthly AI Spend Summary), khata OCR digitisation, WhatsApp storefronts, broad "AI CFO" dashboards, screenshot-only fraud detection, and ungrounded revenue forecasts using Prophet on synthetic data.

Only one of the 44 prior submissions named any classical statistical or ML method. That is the opening.

### Twenty problem opportunities

| Problem | User | Frequency | Severity | Paytm advantage | AI potential | Demo potential | Feasibility | Competition risk | Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Silent QR replacement | Micro-merchant | Daily | Critical | Very high | Very high | Excellent | High | Very low | Money + trust |
| Payment acceptance outage | Merchant | Daily | High | Very high | High | Strong | High | Low | Lost sales |
| Stuck settlement ETA | Merchant | Weekly | High | Very high | High | Good | High | Low | Cash flow |
| Debited but not received | Consumer + merchant | Frequent | High | Very high | High | Strong | High | Medium | Trust + support |
| Recharge validity leakage | Prepaid user | Monthly | Medium | Very high | High | Good | Very high | Very low | Money saved |
| Wrong-payee / lookalike VPA | Consumer | Occasional | Critical | High | Very high | Excellent | Medium | Low | Fraud avoided |
| Autopay price creep | Consumer | Monthly | Medium | High | High | Good | High | Medium | Money saved |
| UPI Circle anomaly guard | Families | Weekly | High | High | High | Strong | High | Medium | Trust |
| Soundbox fleet fault prediction | Multi-store merchant | Daily | High | Very high | High | Strong | Medium | Very low | Uptime |
| Merchant dispute evidence pack | Merchant | Weekly | High | Very high | Medium | Strong | High | Low | Time saved |
| Queue/staffing from cadence | Retail/food merchant | Daily | Medium | High | High | Good | High | Very low | Time + sales |
| Privacy-safe peer benchmark | Merchant | Weekly | Medium | Very high | High | Good | Medium | Very low | Growth |
| Refund delay prediction | Consumer | Occasional | High | Very high | High | Good | High | Low | Trust |
| Agent-payment consent control | Power user | Occasional | High | Very high | Very high | Excellent | Medium | Medium | Future platform |
| Micro-contract escrow | Informal worker | Weekly | Critical | High | High | Excellent | Medium | Medium | Income security |
| Utility bill anomaly | Household | Monthly | Medium | Very high | High | Strong | High | Low | Money saved |
| Local demand spike detection | Kirana/pharmacy | Weekly | High | Very high | High | Strong | Medium | Low | Revenue |
| Merchant payout safety | Merchant | Weekly | High | Very high | High | Strong | Medium | Medium | Error prevention |
| Informal worker reputation | Gig worker | Monthly | Critical | High | Medium | Strong | Medium | Low | Credit access |
| Connectivity-aware rail choice | Commuter | Weekly | Medium | Very high | High | Strong | High | Medium | Reliability |

### White-space classification

**Obvious ideas** (many teams will build these): merchant voice copilot, spend chatbot, inventory forecast, fraud warning banner, bill OCR dashboard.

**Interesting ideas** (differentiated): recharge optimiser, autopay leakage audit, queue inference from payment cadence, refund ETA, adaptive UPI Circle guard.

**White-space ideas** (real competitive advantage): silent QR replacement detection, acceptance-interruption detection, rail-state resolution prediction, wrong-payee intent mismatch, privacy-safe network benchmarking.

**Moonshots** (transformational, too hard for one day): mule-ring graph intelligence, agent-payment consent rail, cross-PSP trust receipt standard, informal-worker reputation, counterfeit detection at checkout.

The sweet spot sits where Paytm has a structural advantage, AI creates a genuinely new capability, the problem recurs daily, existing solutions are reactive, the demo can be physical, and a solo developer can finish it.

---

## Part D — Twenty-two concepts, brutally scored

Scores are deliberately compressed. A high score requires a plausible solo build, not merely a compelling vision.

| Idea | Paytm /20 | AI /20 | Impact /20 | Demo /20 | Feasibility /20 | Total /100 | WOW /100 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| QR Rakshak | 19 | 17 | 18 | 19 | 18 | **91** | 94 |
| Paisa Kahan Hai | 19 | 17 | 19 | 16 | 18 | **89** | 84 |
| Sahi Payee | 18 | 17 | 18 | 18 | 18 | **89** | 85 |
| Sahi Plan | 19 | 16 | 17 | 16 | 20 | **88** | 80 |
| Bill Shock | 19 | 17 | 17 | 18 | 17 | **88** | 83 |
| Circle Guard | 19 | 17 | 17 | 17 | 18 | **88** | 82 |
| Soundbox Pulse | 20 | 17 | 16 | 17 | 17 | **87** | 85 |
| No-Network Checkout | 19 | 16 | 17 | 18 | 17 | **87** | 84 |
| Refund Radar | 19 | 16 | 17 | 16 | 19 | **87** | 76 |
| Dispute Pack | 19 | 15 | 18 | 17 | 20 | **89** | 78 |
| Mandate Mirror | 18 | 16 | 17 | 16 | 19 | **86** | 77 |
| Trust Receipt | 20 | 12 | 18 | 17 | 20 | **87** | 76 |
| Cashflow Circuit | 18 | 16 | 17 | 17 | 17 | **85** | 79 |
| Bheed | 17 | 18 | 15 | 17 | 18 | **85** | 80 |
| Payee Trust Graph | 18 | 19 | 19 | 19 | 13 | **88** | 95 |
| Merchant Benchmark | 20 | 17 | 16 | 15 | 14 | **82** | 78 |
| Sauda Signal | 19 | 18 | 17 | 18 | 13 | **85** | 88 |
| Payout Pilot | 19 | 18 | 17 | 18 | 14 | **86** | 86 |
| Festival Float | 18 | 18 | 17 | 18 | 12 | **83** | 85 |
| Zubaan Reputation | 18 | 17 | 18 | 17 | 12 | **82** | 84 |
| Pocket Pace | 20 | 15 | 14 | 14 | 20 | **83** | 70 |
| Payment Memory | 18 | 14 | 14 | 16 | 20 | **82** | 72 |
| Pakka Payment | 15 | 13 | 16 | 19 | 16 | **79** | 88 |
| Counterfeit Counter | 16 | 18 | 17 | 18 | 8 | **77** | 90 |

### The top eight in detail

#### 1. QR Rakshak — 91/100

**One-line pitch.** Detect when a merchant's QR silently stops earning, diagnose a replaced QR, and restore acceptance before the day's revenue is lost.

**Track.** Track 2, AI for Small Businesses.

**User.** Paytm QR and Soundbox micro-merchants during busy hours. The owner-operator who cannot watch a dashboard.

**Pain.** A pasted-over or swapped QR redirects payments to someone else. The Soundbox stays silent. The merchant assumes business is slow and may only discover the loss at closing time.

**Current workaround.** Wait for a customer complaint, manually inspect the QR sticker, or reconcile at day-end.

**AI mechanism.** Contextual transaction-cadence anomaly detection. The model estimates the merchant's expected payment count for this time bucket, detects abnormal silence against that expectation, and ranks likely causes. Deterministic VPA verification then confirms or rejects the replacement hypothesis.

**Paytm integration.** Paytm for Business home alert, AI Soundbox notification, QR self-check, and reissue or support action.

**Data and signals.** Transaction timestamps and amounts, business hours, merchant-specific baseline, anonymised cohort activity, Soundbox heartbeat, registered VPA, scanned QR payload.

**User flow.** The model observes abnormal silence, the merchant receives a cautious alert, scans the QR displayed at the counter, the app compares the parsed VPA against Paytm's registered VPA, one tap starts recovery, and the next payment confirms restoration.

**Magic moment.** The model draws eight expected payments that never arrived, then the camera scan exposes the pasted QR's wrong VPA.

**Why now.** QR acceptance is ubiquitous and Paytm now has an AI Soundbox surface capable of proactive merchant alerts.

**Why Paytm.** Only Paytm can combine the merchant's expected payment rhythm, the registered VPA, device telemetry, and the recovery workflow.

**Competitive differentiation.** It models the negative space, the payments that should have happened, rather than adding another assistant on top of payments that did.

**MVP.** Seeded live stream, expected-count anomaly scorer, explainable alert, camera and upload QR parser, VPA mismatch check, simulated recovery.

**Stretch.** Cohort baselines, device-fault classifier, geofenced self-test, automatic replacement order.

**Demo.** Swap a real printed QR with a wrong one. The stream goes silent, the alert fires, the scan reveals the mismatch, and the corrected QR receives a payment.

**Risks.** False alarms during genuine quiet periods, insufficient history for low-volume merchants, and unsupported assumptions about telemetry and API access.

**Hackathon feasibility.** High.

#### 2. Paisa Kahan Hai — 89/100

**Pitch.** Give a precise, confidence-scored ETA and next action for pending settlements and debited-but-not-received payments.

**User.** Consumers and merchants waiting for money. **Pain.** Uncertainty is worse than delay; users repeatedly refresh history or contact support. **AI.** A survival model predicts resolution time from bank, rail, status, hour, and amount. **Paytm fit.** Transaction and settlement detail screens; Paytm can update status, raise the correct dispute, and notify both parties. **Magic.** A vague PENDING becomes "94% likely by 6:42 PM" with a live timeline. **Risk.** Needs historical labels, and an inaccurate ETA damages trust. **Feasibility.** High.

#### 3. Sahi Payee — 89/100

**Pitch.** Catch wrong-recipient transfers using phonetic, visual, and behavioural mismatch before PIN entry.

**User.** Anyone paying a new or similarly named contact. **Pain.** One digit or one homoglyph sends irreversible money to a stranger. **AI.** Name and VPA similarity, contact context, prior-payee graph, amount novelty, QR-location consistency. **Paytm fit.** The payee confirmation screen. **Magic.** The app catches `ramesh@upi` versus `rarnesh@upi` and explains the visual trick. **Risk.** Privacy and false friction. **Feasibility.** High.

#### 4. Dispute Pack — 89/100

**Pitch.** Turn a failed-payment timeline into the exact evidence bundle and dispute route in one tap.

**AI.** State-sequence classification selects dispute type, missing evidence, and likely resolver. **Magic.** A twelve-screen complaint becomes one verified timeline with a case ID. **Weakness.** May read as support automation rather than innovative AI. **Feasibility.** Very high.

#### 5. Sahi Plan — 88/100

**Pitch.** Stop prepaid users wasting validity by building the lowest-cost annual recharge ladder from their real recharge rhythm.

**AI.** Usage-profile inference plus constrained optimisation over the plan catalogue. **Magic.** A family's habitual spend collapses into a cheaper plan with dozens fewer wasted validity days. **Weakness.** May be scored as optimisation rather than breakthrough AI, and the demo is a comparison table. **Feasibility.** Very high. This is the safest solo build on the list.

#### 6. Payee Trust Graph — 88/100

**Pitch.** Warn before money moves by detecting mule-ring topology and lookalike payees, not just scam words.

**AI.** Graph anomaly features, fan-in/fan-out ratios, fund velocity, cycle detection, community detection, phonetic similarity. **Magic.** A force-directed graph lights up the recipient's hidden mule ring before PIN entry. This has the highest raw visual wow on the entire list. **Fatal weakness for this event.** A solo developer would spend the day fabricating synthetic graph data and a visualisation layer with no time left to make the detection credible, and the data sensitivity invites regulatory objections. Keep as a moonshot only.

#### 7. Soundbox Pulse — 87/100

**Pitch.** Predict Soundbox or QR acceptance failures before merchants lose a full shift.

**AI.** Multivariate anomaly detection over heartbeat, signal, battery, payment cadence, and peer incidents. **Strength.** The most Paytm-native concept on the list; only Paytm controls device telemetry and field service. **Weakness.** Emotionally weaker than a visible physical attack, and more dependent on telemetry you do not have. **Feasibility.** High.

#### 8. Bill Shock — 88/100

**Pitch.** Detect abnormal utility bills before payment and explain the likely driver using the user's own history.

**AI.** Seasonal anomaly detection plus bill-line OCR and driver attribution. **Magic.** A 3x bill is traced to an impossible meter jump before checkout. **Paytm fit.** The bill-payment review screen, where Paytm already owns repeated bill history. **Feasibility.** High.

### The remaining concepts in brief

**Circle Guard** keeps UPI Circle convenient while flagging delegated spending that breaks a family member's normal pattern; adaptive trust rather than another family budget dashboard. **Mandate Mirror** exposes subscription price creep, duplicate mandates, and zombie AutoPay before the next debit using periodicity and changepoint detection. **Refund Radar** predicts refund arrival and detects when a refund has silently left its normal path. **No-Network Checkout** predicts connectivity risk before a low-value payment and prepares the most reliable Paytm rail; carries prior-art risk against a Mumbai entry. **Trust Receipt** creates a shared verifiable post-payment receipt that ends the "I paid / I didn't receive it" argument; excellent Paytm fit but the core value is deterministic, so AI innovation scores low. **Cashflow Circuit** warns merchants before settlement timing and scheduled payouts create a cash shortfall. **Bheed** infers queue pressure from payment inter-arrival times and applies queueing theory to recommend staffing, with no cameras and no new hardware. **Merchant Benchmark** shows a merchant how they compare with similar nearby businesses using k-anonymity and differential privacy, where the privacy engineering is itself the story. **Sauda Signal** detects a neighbourhood demand spike from privacy-safe payment patterns and triggers a small timely stock order. **Payout Pilot** lets merchants prepare supplier or staff payouts by voice while a deterministic policy engine prevents wrong or excessive transfers; the safety architecture is the product. **Festival Float** recommends one evidence-backed inventory bet and matching working capital before a local festival. **Zubaan Reputation** converts a completed informal-work payment trail into a portable consented reputation proof. **Pocket Pace** makes UPI Lite auto top-up adaptive to real micro-spending rhythm. **Payment Memory** turns ambiguous payment search into a visual memory query, but competes directly with Paytm's shipped AI spend features. **Pakka Payment** checks a customer's payment screenshot against the merchant ledger and highlights image tampering; the visual demo is strong but the AI is unnecessary because the ledger and Soundbox already provide the authoritative answer, and accusing a customer of forgery on a noisy forensic signal is a product and legal mistake. **Counterfeit Counter** verifies high-risk goods at payment time; spectacular but requires datasets and liability handling far beyond one day.

---

## Part E — Competitive analysis

Assume ten other teams. These are the predictable builds.

| Likely team | Why attractive | Why judges may like it | How QR Rakshak beats it | What to avoid |
| --- | --- | --- | --- | --- |
| Merchant voice copilot | Easy Sarvam demo | Inclusive and familiar | Paytm has productised this; Rakshak solves a new trust failure | Do not add chat |
| AI spend coach | Easy transaction dataset | Broad consumer reach | Spend summary already ships; Rakshak has a physical wow moment | Do not claim generic savings |
| Fraud risk score | Emotional problem | Trust fit | Rakshak has a specific attack and deterministic confirmation | Avoid a vague 0-100 score |
| Inventory forecaster | Merchant impact story | Growth narrative | Rakshak needs no item-level inventory | Avoid synthetic Prophet charts |
| Khata OCR | Camera demo | Regional relevance | Crowded cluster; Rakshak uses the camera to confirm a real Paytm object | Avoid document management scope |
| WhatsApp shop | Full commerce flow | Visually broad | Weak native-stack fit; Rakshak lives inside Paytm for Business | Avoid external channel dependency |
| Voice payments | Fast accessible demo | Consumer convenience | Crowded and security-sensitive; Rakshak protects existing payments | Avoid autonomous money movement |
| Loan readiness score | Large merchant impact | Paytm lending fit | Needs underwriting labels; Rakshak needs only cadence | Avoid unsupported eligibility claims |
| Agentic checkout | Future-facing | High novelty | Harder to build safely; Rakshak completes in a day | Avoid MCP theater |
| Bill scanner | Reliable OCR demo | Easy before/after | Limited Paytm moat; Rakshak depends on Paytm's registered identity | Avoid standalone utility |

### If another team copies us tomorrow

The concept name is copyable. The hard-to-copy unit is the combined mechanism: merchant-specific absence modelling, plus Paytm registered-VPA verification, plus Soundbox and device context, plus a native recovery action. Ship all four. If you ship only the alert, the moat is nothing.

---

## Part F & G — Red team on the top five

| Idea | Strongest objection | How to eliminate it |
| --- | --- | --- |
| QR Rakshak | "Traffic fluctuates naturally. This will annoy merchants every slow afternoon." | Use cautious "acceptance interruption" language, require multiple concurring signals, add snooze and feedback, and make the QR mismatch check deterministic rather than probabilistic. |
| QR Rakshak | "Why is this AI? A threshold would do." | A threshold ignores time of day, merchant rhythm, variance, device state, and comparable local activity. Show the expected distribution, the confidence band, and a counterfactual. |
| Paisa Kahan Hai | "An incorrect ETA damages trust more than no ETA." | Use calibrated ranges with explicit confidence and automatic escalation when the actual path deviates from prediction. |
| Sahi Plan | "This is a comparison engine, not AI." | Demonstrate constraint inference, annual optimisation under multiple constraints, full explainability, and real checkout. |
| Payee Trust Graph | "The data and the regulation make this impossible in a hackathon." | Use clearly labelled synthetic graph data and build only the scoring and visualisation. Do not make production claims. Retain as moonshot. |
| Soundbox Pulse | "This is internal device operations, not merchant value." | Lead with lost sales avoided and surface the diagnosis on the Soundbox itself. |

### The seven judge personas, answered for QR Rakshak

**"What is wrong with this?"** The base rate of QR replacement is unmeasured, and low-volume merchants will have weak baselines. Both are stated openly rather than hidden.

**"Why isn't this just another AI wrapper?"** There is no LLM in the must-ship path. The intelligence is an expected-count model over the merchant's own cadence, and the confirmation is a deterministic identity comparison.

**"Where is Paytm integration?"** The signal, the expected identity, the device context, and the recovery action are all Paytm-native. A standalone app has none of the four.

**"Can they actually build this?"** The real core is a typed event replay, a lightweight time-series scorer, a QR decoder, and a VPA comparison. Everything Paytm-side sits behind an honest mock adapter.

**"How many users does this help?"** The official material gives no verified merchant count, so we state the target population as Paytm QR and Soundbox merchants and refuse to invent a number.

**"Another team built something similar."** No prior submission modelled payment absence. If challenged, point to the four-part mechanism rather than the alert.

**"The demo is impressive but is the product useful?"** The outcome is a restored acceptance point and a measured detection delay, not a dashboard.

---

## Part H — The winner

### Paytm QR Rakshak

**Paytm already confirms the money that arrives. QR Rakshak detects the payments that should have arrived, and helps the merchant restore acceptance.**

**Why this one.** It has exactly one urgent problem: a merchant's acceptance point silently stops earning. One AI insight: detect absence relative to merchant-specific expected cadence. One Paytm-native confirmation: compare the displayed QR against the merchant's registered VPA. One Paytm action: restore or reissue the QR and verify recovery with the next payment. One memorable moment: a physical covered QR exposed on camera after the model detects the silence.

**Why not the others.** Paisa Kahan Hai needs labelled rail-state history and has a less visual demo. Sahi Plan is highly buildable but may be scored as optimisation. Payee Trust Graph has spectacular visuals but unacceptable data and feasibility risk for one solo day. Soundbox Pulse is the most Paytm-native but is emotionally weaker and more dependent on telemetry you cannot access.

**Expected judging score.** 91/100. This is an optimisation target, not a promise.

**Biggest competitive advantage.** The four-part mechanism. Absence modelling alone is copyable; absence modelling plus registered-identity verification plus device context plus native recovery is not reproducible overnight.

**Biggest risk.** Natural quiet periods look like incidents. A false alarm at every slow hour destroys merchant trust and the demo's credibility.

**Risk mitigation.** Require a high-confidence combination of cadence residual, comparable local activity, and device heartbeat. Say "acceptance interruption," never "fraud." Always ask for the deterministic QR self-check before asserting anything.

**Why Paytm should actually want this.** It protects merchant GMV, QR trust, Soundbox value, merchant retention, and support cost using assets Paytm already owns.

**Why judges will remember it.** "The AI that notices missing payments" is repeatable in one sentence, and the pasted-QR reveal is physical rather than another dashboard.

**Backup #1.** Paisa Kahan Hai — the best trust and support product if transaction-status data is available.

**Backup #2.** Sahi Plan — the safest solo build, with lower wow but exceptional feasibility.

### Concept combinations considered

| Combination | Strategic gain | Decision |
| --- | --- | --- |
| Cadence anomaly + QR identity + Soundbox heartbeat + recovery | Turns suspicion into confirmation and action | **Winner.** Smallest complete strategic unit |
| Screenshot forensics + ledger match | Visual heatmap | Reject. The ledger and Soundbox already answer this; image AI is unnecessary |
| Settlement ETA + dispute pack | Prediction becomes action | Strong Backup #1 expansion |
| Recharge optimiser + adaptive UPI Lite | Consumer savings suite | Reject. Two unrelated rails dilute the story |
| Payee graph + UPI Circle guard | Family fraud defence | Reject for a solo day. Sensitive graph data |

### Continuous optimisation pass

**How could this be 10x more impressive without being 10x harder?** Use a real printed replacement QR and a live camera scan while keeping the entire backend seeded.

**What single feature makes judges remember this tomorrow?** The expected-payments ghost line: draw the payments that should exist but do not.

**What can we remove while making the product stronger?** Remove chat, dashboards, multi-merchant fleet views, fraud heatmaps, and predictive inventory.

**What makes it feel like a real Paytm product?** The Paytm for Business entry point, the Soundbox heartbeat, the registered VPA, the recovery adapter, and restrained fintech microcopy.

---

## Part I — Product specification

**Product name.** Paytm QR Rakshak

**One-line pitch.** Detect when a merchant's QR silently stops earning and restore Paytm acceptance before revenue disappears.

**Track.** Track 2, AI for Small Businesses.

**Product thesis.** Payment products are optimised for events that occur: initiated, pending, credited, failed. A replaced QR creates no event at all in the rightful merchant's system. QR Rakshak treats that absence as the signal. It learns the merchant's normal payment rhythm, compares observed against expected activity alongside device and context signals, and asks for a deterministic QR identity check only when confidence is high. The intelligence detects; Paytm verifies and acts.

**User persona.** Ramesh, owner-operator of a busy kirana with one QR and one Soundbox. He has no staff to watch a dashboard and no time to reconcile mid-shift.

**Core problem, emotionally and economically.** The merchant hears nothing, sees customers leave, and concludes business is slow. Every payment sent to a covered QR is immediate loss and a trust incident. The existing workaround is entirely reactive: wait for a complaint, search history, or reconcile at closing. The impact figure in the demo must be labelled as a model estimate: expected payment count multiplied by normal ticket size across the interruption window.

**Product promise.** If you use QR Rakshak, Paytm will warn you when your acceptance point behaves abnormally, help you verify the QR on your counter, and guide recovery before a quiet counter becomes a lost day.

### Core user journey

| Step | What happens |
| --- | --- |
| 1. Entry point | Paytm for Business home, plus AI Soundbox notification |
| 2. Trigger | Observed credits fall materially below merchant-specific expected cadence |
| 3. User action | Merchant opens "Payments unusually quiet" |
| 4. AI processing | Model scores cadence residual, device health, local context, and confidence |
| 5. AI insight | "Possible acceptance interruption. QR check recommended," with ranked reasons |
| 6. User action | Merchant scans the QR displayed at the counter |
| 7. Paytm action | Registered VPA mismatch confirmed; recovery and reissue workflow starts |
| 8. Outcome | Test payment lands, Soundbox confirms, monitoring returns to normal |

### Screens

| Screen | Purpose | Components and microcopy | Primary CTA | Data shown | AI interaction | Next state |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Paytm for Business home | Make abnormal silence impossible to miss without causing panic | Status strip "Payments unusually quiet"; expected-versus-actual mini line; Soundbox online indicator | Review acceptance | Observed 0 versus expected 8; 92% confidence; estimated sales at risk | No chat. Tap the explanation or scan the QR | Opens incident detail |
| 2. Acceptance incident | Explain why the system interrupted the merchant | Timeline, contributing signals, benign-cause options, confidence, QR self-check entry | Check my QR | Last credit, normal cadence, nearby cohort activity, device heartbeat | Counterfactual: "if area traffic were also down, risk would be 31%, not 92%" | Launches camera or upload |
| 3. QR self-check | Turn probabilistic suspicion into deterministic confirmation | Camera frame, parsed payee, expected Paytm VPA, mismatch banner | Restore Paytm QR | Expected versus scanned VPA and merchant name | Vision only locates and reads the QR; validation is deterministic | Starts simulated reissue |
| 4. Recovery | Complete the Paytm action | Fresh dynamic QR, reprint option, support case, test-payment button | Run a test payment | New QR ID, case status, device status | AI monitors the recovery window | Moves to confirmation |
| 5. Restored | Show a measurable outcome | Soundbox confirmation, green payment event, downtime and modelled loss avoided | Done | Detected in 11 minutes; revenue at risk labelled as an estimate | Feedback improves future thresholds | Returns home |

**Design quality bar.** Mobile-first and Paytm-like. One primary action per screen. Restrained red used only for a confirmed mismatch. No generic AI badge, no chatbot, no decorative dashboard cards. Always visually separate observed facts, model estimates, and simulated Paytm actions.

---

## Part J — Technical architecture

```
USER (merchant at the counter)
      ↓
PAYTM FOR BUSINESS UI / AI SOUNDBOX
      ↓
APPLICATION API
      ↓
INCIDENT INTELLIGENCE LAYER
      ↓
TIME-SERIES MODEL + RULE ENGINE
      ↓
PAYTM ADAPTER / SEEDED DATA SERVICES
      ↓
QR VERIFICATION + RECOVERY ACTION
      ↓
PAYMENTS RESTORED (user outcome)
```

### Stack

**Frontend.** Vite or Next.js with React and TypeScript. A 390px mobile shell. A seed replay controller, an incident state machine, an SVG expected-versus-actual chart, and camera capture with an upload fallback.

**Backend.** A thin typed API or in-process demo service. The incident scorer, a `PaytmAdapter` interface, a QR parser and VPA validator, and an append-only event log. No authentication fiction in the MVP.

**AI.** An expected-count baseline with a calibrated anomaly score, plus a deterministic rule layer. No external model call is required in the must-ship path.

**Infrastructure.** Local-first seeded mode, optional Vercel deployment, structured logs, no secrets in the client, a frozen seed, and a fallback video.

### Data model

| Entity | Essential fields | Purpose |
| --- | --- | --- |
| Merchant | id, displayName, assignedVpa, timezone, businessHours, category | Identity and expected operating context |
| PaymentEvent | id, merchantId, amount, status, occurredAt, channel | Observed credit cadence |
| DeviceHeartbeat | deviceId, online, signal, battery, seenAt | Separate device failure from missing payments |
| ExpectedCadence | bucket, lambda, variance, source, updatedAt | Merchant-specific expected count |
| AcceptanceIncident | openedAt, score, confidence, reasons, state | Explainable model output |
| QrIdentity | rawPayload, parsedVpa, expectedVpa, matched | Deterministic confirmation |
| RecoveryAction | type, simulated, status, createdAt | Honest action boundary |
| ModelFeedback | incidentId, useful, benignReason | Threshold improvement and human override |

### APIs

| Endpoint or interface | Input | Output | MVP status |
| --- | --- | --- | --- |
| `GET /demo/stream` | scenario, replay time | payment and heartbeat events | Real seeded service |
| `POST /incidents/score` | recent events, baseline | score, confidence, reasons, expected count | Real |
| `POST /qr/verify` | QR image or decoded payload | parsed VPA, expected VPA, match | Real parser, seeded expected VPA |
| `POST /recovery/restore` | merchant, incident | action ID, status | Mock Paytm adapter |
| `POST /payments/test` | merchant, amount | seeded successful event | Simulated Paytm |
| `PaytmAdapter` | getTransactions, getDevice, restoreQr | typed domain objects | Mock now; production adapter documented |

### The AI system, designed properly

| Layer | Design |
| --- | --- |
| Inputs | Recent credits, historical five-minute buckets, business hours, weekday, device heartbeat, optional cohort-activity index, assigned and scanned VPA |
| Features | Count residual, inter-arrival z-score, EWMA drop, CUSUM statistic, amount-weighted shortfall, device-online-but-no-credit interaction, cohort residual |
| Model | Negative-binomial or Poisson expected-count baseline with a calibrated anomaly score. Simple enough to explain out loud and run locally |
| LLM usage | **None in the must-ship path.** Optionally, a vernacular paraphrase of an already-computed result. The LLM never scores risk and never authorises an action |
| Rules | Never alert outside business hours. Minimum history and volume required. Hard VPA comparison. Alert cooldown. Suppress when an area or device outage already explains the drop |
| Retrieval | Not needed for the MVP. Production could retrieve verified Paytm support procedures, never open-web content |
| Classification | Cause ranking across replaced QR, device outage, and normal quiet period |
| Prediction | Expected payment count and confidence band per time bucket |
| Recommendation | The single next action: check the QR |
| Agent behaviour | None. No autonomous action, no money movement |
| Confidence scoring | Probability band, observed and expected counts, and a data-sufficiency label. No fake precision when history is sparse |
| Human override | Merchant can mark normal quiet period, shop closed, device issue, or useful alert |
| Guardrails | Say "possible interruption," never "fraud." No automatic payment blocking. Never accuse the owner of the scanned VPA |
| Explainability | Three ranked factors plus one counterfactual. Clearly distinguish observed, estimated, and confirmed |
| Evaluation | Scenario-level precision and recall, detection delay, false alerts per merchant-day, and calibration. Not generic model accuracy |

### Paytm integration, in detail

**Where inside Paytm does this appear?** Paytm for Business home, the device and QR section, and the incident detail screen. Notifications can also surface through the AI Soundbox.

**What existing capability does it extend?** QR acceptance, Soundbox payment confirmation, device health, transaction analytics, merchant support, and QR replacement or reissue.

**What Paytm data could power it?** The merchant transaction stream, the registered VPA, device heartbeat, the business profile, and a privacy-safe cohort activity signal.

**What action can Paytm perform after the AI recommends?** A QR self-check, a dynamic QR replacement, a reprint or support ticket, a test payment, and continued incident monitoring.

**What makes it native?** Detection depends on Paytm's payment and device context. Confirmation depends on Paytm's registered acceptance identity. Recovery depends on Paytm's own QR lifecycle.

**What happens if this were a standalone app?** It would see neither authoritative credits nor the assigned VPA nor device state, and it could not restore Paytm acceptance. It would be reduced to asking the merchant to type in their own sales, which defeats the entire premise. The standalone version is not merely weaker; it is impossible.

---

## Part K — Real versus mock

| Boundary | What belongs there |
| --- | --- |
| **REAL** | Replay engine, anomaly scoring, confidence reasons, QR decoding, VPA comparison, UI state machine, error and loading paths |
| **MOCKED** | Paytm authentication, production transaction API, Soundbox telemetry, QR rotation and reissue, support ticket creation |
| **SEEDED** | Merchant profile, normal transaction history, incident stream, assigned VPA, replacement QR, cohort activity |
| **SIMULATED PAYTM** | `PaytmAdapter` responses, test payment, device heartbeat, recovery status |

Every mocked action must carry a visible "Demo Paytm service" label or appear in an architecture disclosure. Never imply production API access. Honest boundaries score higher than a convincing lie, and a judge who catches an overstated integration will discount the entire submission.

---

## Part L — The three-minute demo

| Time | Screen | Presenter action | What to say | Proof delivered |
| --- | --- | --- | --- | --- |
| 0:00-0:20 | Physical counter and merchant home | Point to a Paytm QR covered by another QR | "Ramesh's Soundbox usually speaks every 90 seconds at lunch. It has been silent for 18 minutes. He thinks the shop is slow. His QR was replaced." | Problem understood in seconds |
| 0:20-0:50 | Live transaction stream | Replay normal noon cadence, then zero credits while the heartbeat stays online | "Paytm sees what Ramesh cannot. Not a failed payment, but the payments that should have happened." | Visible expected-versus-actual gap |
| 0:50-1:30 | AI incident screen | Trigger the anomaly score, expand three contributing signals | "A merchant-specific model combines cadence, today's baseline, nearby activity, and device health. It reports an acceptance interruption at 92% confidence. Not fraud." | Core AI is visible and explainable |
| 1:30-2:10 | QR camera check and recovery | Scan the covering QR, reveal the wrong VPA, tap Restore, show the replacement QR | "Prediction tells us to look. Paytm's registered VPA gives the authoritative answer. One tap starts recovery inside Paytm for Business." | Strong Paytm-native action |
| 2:10-2:40 | Test payment and Soundbox confirmation | Run a seeded payment; the stream resumes and the incident closes | "The next payment lands, the Soundbox confirms it, and Rakshak verifies recovery. Revenue at risk is transparently modelled, not claimed as observed." | Before, intelligence, after |
| 2:40-3:00 | Scale view | Show three cause tiles: replaced QR, device outage, normal quiet period | "Paytm already confirms money that arrives. QR Rakshak understands dangerous silence. At scale, every Paytm acceptance point becomes self-monitoring." | Memorable one-line vision |

### The winning story

**Problem.** Today, a Paytm merchant can hear every payment that arrives, but a replaced QR creates only silence.

**Insight.** We realised the missing payments are themselves a signal, once Paytm understands the merchant's normal rhythm.

**Solution.** So we built QR Rakshak, which detects an acceptance interruption, verifies the displayed QR, and restores Paytm acceptance.

**AI.** Unlike a static threshold, our model learns expected cadence and explains why today's silence is abnormal.

**Paytm.** Because this is built into Paytm, a prediction becomes an authoritative identity check and a real recovery action.

**Impact.** This can reduce detection from end-of-day to minutes and protect revenue that would otherwise be redirected or lost. Pilot validation is required before any hard number.

**Vision.** At scale, every Paytm acceptance point becomes self-monitoring.

### Presenter safeguards

Start from the covered physical QR, not a title screen. Never say the model proves fraud; it detects an acceptance interruption and the VPA comparison confirms a mismatch. Label revenue protected as a modelled estimate. If the camera fails, switch to upload without explaining. If deployment fails, run local seeded mode, because nothing in the core demo should require a network. Finish by 2:50 to leave ten seconds for the closing line.

---

## Part M — Build plan for a solo developer

| Phase | Exact tasks | Definition of done | Cut if behind |
| --- | --- | --- | --- |
| Phase 1, 30 min | Lock one story. Seed 60-90 minutes of normal and incident transaction events. Define expected and scanned VPAs | Dataset replays deterministically and demo narration is frozen | Cut all extra incident types |
| Phase 2, 1 hour | Build the typed event model, expected-count baseline, EWMA/CUSUM score, confidence explanation, and unit cases | Normal period stays quiet; the replacement incident triggers at a known timestamp | Use fixed calibrated parameters instead of any training |
| Phase 3, 2 hours | Build the mobile Paytm Business shell, home alert, incident timeline, and expected-versus-actual visualisation | The AI moment is clickable and legible on one screen | Remove settings and navigation |
| Phase 4, 4 hours | Add QR camera and upload, parse the UPI payload, compare VPA, recovery action, and the test-payment event | The complete vertical slice works offline with seeded data | Use image upload if the live camera is unstable |
| Phase 5, 6 hours | Add the Soundbox audio cue, the normal and false-alarm path, error and loading states, and transparent mock badges | Every judge question has an on-screen answer | Cut audio first, then the cohort signal |
| Phase 6, polish | Rehearse three times, record the fallback video, test the mobile viewport, prewarm the app, freeze the seed, prepare backup screenshots | A three-minute run finishes under 2:50 with no network dependency | No new features |

### MUST SHIP

Normal-to-incident transaction replay. A real expected-versus-observed scorer. Three explainable factors. Physical or uploaded QR decode. Registered-VPA mismatch. Simulated recovery and a successful test payment. Visible mock and seed disclosure. A three-minute fallback recording.

### DO NOT BUILD

A chatbot or voice assistant. Inventory, GST, loans, loyalty, or generic analytics. Production Paytm authentication. A trained deep model with no data. A multi-merchant admin dashboard. Automatic accusations or payment blocking. Any backend work before the judge journey is demonstrable. Any external dependency inside the core demo.

### Team structure

The solo constraint changes sequencing, not standards. Work in vertical slices: seed, score, show, verify, recover. Product story and implementation cannot be separate workstreams, so freeze the narrative in the first 30 minutes and make every subsequent code decision serve that exact click path.

### Failure modes that would destroy the score

| Failure mode | Why fatal | Mitigation |
| --- | --- | --- |
| Looks like a static threshold | AI innovation collapses | Show the merchant-specific expected distribution, confidence, and a counterfactual |
| Claims fraud from silence | Trust and legal credibility collapse | Use acceptance-interruption language; confirm only the VPA mismatch |
| No real QR decode | The demo feels staged | Decode a printed QR live, with upload fallback |
| Paytm is only branding | Relevance collapses | Use the registered VPA, Soundbox heartbeat, and recovery adapter |
| False precision | Judges challenge the evidence | Label seeded data, confidence bands, and estimated revenue |
| Camera or network failure | Execution collapses | Local mode, preloaded QR, fallback video |
| Too many causes or features | The story becomes unclear | Demo only the replaced QR; mention device outage as future work |
| Generic dashboard UI | The prototype looks copied | One incident flow, one CTA, restrained hierarchy |
| No normal case shown | The model looks trigger-happy | Show quiet-period suppression in Q&A or on a backup screen |
| Hidden mock integration | Credibility loss | Explicit adapter boundary and visible demo labels |

---

## Part N — Judging scorecard

| Criterion | Target | Why | Evidence in demo |
| --- | ---: | --- | --- |
| Paytm Integration / Relevance | 19/20 | Uses transaction cadence, registered VPA, Soundbox and device context, and a recovery action | Native alert, QR identity check, Paytm recovery |
| AI Innovation / Innovation | 17/20 | Detects missing events with contextual time-series intelligence and explainability | Expected ghost line, confidence, factors, counterfactual |
| User Impact / Impact | 18/20 | Protects merchant revenue and trust on a frequent acceptance surface | Modelled sales at risk and detection delay |
| Demo Quality / Execution | 19/20 | Physical attack, visible AI, deterministic confirmation, successful recovery | Printed QR swap through to the next credited payment |
| Build Feasibility / Feasibility | 18/20 | Real core, seeded Paytm adapter, no fragile model API | A complete local vertical slice |
| **TOTAL** | **91/100** | High-probability strategy, not a promise | All five criteria visible within three minutes |

### What actually prevents 100/100

There is no production Paytm telemetry or API access. There is no merchant pilot and therefore no measured base rate for QR replacement. Model calibration is uncertain for low-volume merchants. Recovery and reissue are simulated rather than real. And the AI component, while rigorous, is less fashionable than generative AI, so its novelty must be demonstrated rather than asserted.

### Realistic redesigns that close the gap

Add a normal-quiet replay and a false-alarm feedback path to prove restraint. Show detection delay and false alerts per merchant-day across synthetic scenario tests. Use the physical QR and a real decoder so the confirmation step is genuinely not mocked. Expose the `PaytmAdapter` interface and name the production data it would require. If you use a vernacular Soundbox alert at all, generate it only after the score is computed, so language generation never becomes the product.

### What to say if judges challenge us

**"Why not just use the Soundbox?"** The Soundbox confirms credits. A replaced QR produces no credit to confirm. Rakshak interprets abnormal silence and then asks for an authoritative check.

**"Isn't this just a threshold?"** A threshold ignores time of day, merchant rhythm, variance, device state, and comparable local activity. The demo shows a contextual expected distribution and a counterfactual.

**"How do you know it is fraud?"** We do not, and we never claim to. The model identifies an acceptance interruption. The scan confirms only that the displayed VPA differs from Paytm's registered VPA.

**"Where is the Paytm integration?"** The signal, the expected identity, the Soundbox context, and the recovery action are all Paytm-native. A standalone app lacks all four.

**"How many users does this help?"** The official material gives no verified merchant count, so we state the target as Paytm QR and Soundbox merchants and avoid inventing a figure.

**"Could you build this today?"** Yes. The real core is a typed event replay, a lightweight time-series scorer, a QR decoder, and a VPA comparison. Paytm services are isolated behind an honest mock adapter.

**"What if another team copies it?"** The title is copyable. The complete mechanism and the physical demo are not. That is why we ship absence modelling, identity verification, device context, and recovery, rather than just an alert.

---

## Final build instruction

Do not begin implementation until the concept is approved. On approval, inspect the existing repository first: framework, entry points, existing components, existing APIs, environment variables, and storage. Do not rewrite working code.

Then implement in vertical slices, each independently demonstrable:

1. Render the seeded normal transaction stream in the existing app shell.
2. Add the real anomaly scorer and the incident alert, with tests.
3. Build the incident explanation and the expected-versus-actual visualisation.
4. Add QR decode and upload, plus deterministic VPA verification.
5. Add the `PaytmAdapter` mock recovery and test-payment confirmation.
6. Harden loading, error, and normal states, mobile responsiveness, mock labels, and demo controls.

Verify each slice before starting the next, so the judge journey stays continuously demonstrable.

---

## The standard

One extremely clear problem. One extremely strong AI insight. One extremely strong Paytm integration. One memorable demo moment. One measurable user outcome.

The product should make judges think: *why doesn't Paytm already have this?* And immediately after: *how did one person build this in a day?*

---

*Primary evidence: the supplied Hyderabad theme PDF and briefing photographs. Prior-field evidence: the supplied 44-entry Mumbai submission CSV. Product verification: public Paytm consumer, business, UPI, and AI Soundbox pages. All quantitative impact beyond stated source facts is labelled as an assumption or a seeded demo value.*
