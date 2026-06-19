# CannaPickForMe — First Partner Plan
### Goal: sign Cookies Hayward as founding partner #1, get a live placement + proof report running, then convert to paid and replicate.

*Built around your real constraints: ~2–5 hrs/week (nights), full-time at Cookies, free-founding-partner strategy, and "Claude builds the code with me."*

---

## The one-line objective
Get Cookies Hayward **live in the app as free founding partner #1** with a working "buy near you" click-out and a real monthly report — so you own a **proven, compliant placement + a reference logo**. That asset is what you sell (at paid charter rates) to the next dispensaries.

## The rule that makes this realistic
You have ~2–5 hrs/week. So **your hours go only to what literally requires you** — decisions, the Cookies conversation, deploys (your accounts), the testimonial. **I do the code.** Calendar is realistically ~3 weeks at this pace; the code itself can move faster than that since it's on me.

## Jack principles driving the plan
- **Freeze the game.** CannaGotchi is paused until partner #1 is live and reporting. Build the bottleneck, not the fun part.
- **Sell the outcome, not the space.** The pitch is "compliant customers at the *decision* moment," proven with a click-out + report — not a banner.
- **Speed to first logo.** The free founding deal deletes the two slowest blockers (price objection + Stripe). Get the yes, go live, prove it.
- **One blueprint, repeated.** Cookies is the template; the next dispensaries get the identical kit at paid rates.

## Why "free founding" is the smart-money move
It removes the Stripe/payments plumbing for now, makes the yes nearly frictionless (you already work there), and buys the one thing you can't fake: a real case study with real numbers. The money arrives 30–60 days later — Cookies upgrades to paid, and neighbors sign because they *saw it work*.

---

## The critical path — only 3 things must be TRUE to go live
1. A result screen shows a real **"📍 Buy at Cookies Hayward"** click-out for in-stock strains.
2. A **Sponsored Strain** can be published from the admin and actually **renders to users** (end-to-end), clearly labeled, never altering the match score.
3. The **222 SEO pages** are deployed, serving static, and submitted to **Google Search Console** (your unpaid growth engine — and a real talking point in the pitch).

Everything else waits behind these.

## Who does what
- **I build (in the repo; you review + deploy):** the click-out, the Sponsored-Strain publish fix/verify, the monthly-report query, SEO deploy prep, the placement-preview mockup.
- **You do (only you can):** approve each change, run deploys (your Vercel/Firebase/GSC access), have the Cookies conversation, sign the letter, send the first report.

---

## Week-by-week (≈3 weeks at 2–5 hrs/wk of *your* time)

### Week 0 — this week's nights (your ~2–3 hrs)
- **You:** confirm the **Cookies decision-maker** (GM? store manager? marketing?) and whether you pitch solo or co-pitch. You have the inside line — highest-value thing only you can do.
- **You:** 20-min access check — confirm cannapickforme.com is live on Vercel and you can reach the Firebase console, Vercel, and create a Google Search Console account.
- **Me:** audit the 3 blockers in code and report exactly what's broken vs. working — tracing the Sponsored-Strain publish path (`admin.js` → `sponsorshipService.js` → result render) and the dispensary click-out path (`dispensaryService.js` + `api/sync-menu.js` → result card). No guessing.

### Week 1 — close the revenue loop (mostly me)
- **Me:** wire the result-screen **"Buy at Cookies Hayward" click-out** — in-stock strains link to their Dutchie menu, labeled and compliant, kept separate from the honest match.
- **Me:** make a **Sponsored Strain publish end-to-end** and verify it renders with the "Sponsored" label and never touches the match score.
- **Me:** write the **monthly-report query** (impressions, taps, match-rate from your Firebase events) so "reporting" is real, not a promise.
- **You (≈1–2 hrs):** review diffs, deploy, and click through it on your phone as a user. Confirm the loop: 4 questions → pick → "Buy at Cookies Hayward" → (plus a labeled Sponsored Strain).

### Week 2 — deploy proof + pitch Cookies (mostly you)
- **Me:** finalize **SEO deploy** (confirm the 222 pages serve static) and generate the **placement-preview mockup** your kit references but doesn't have yet.
- **You:** submit the **sitemap to Search Console**.
- **You:** **the Cookies conversation.** Use your existing `cookies-hayward/DOSSIER.md`, `EMAIL_TOUCH_1.md`, and `DEMO_AND_VOICEMAIL.md`. The ask is small: *"You're founding partner #1 — free for 90 days. Here's your menu live on my app, and I'll send you a monthly report. If it's working, we lock you at the $199 charter rate."* Demo it live on your phone — you stock **148 of the 222 strains**, so it's real.
- **You:** get the verbal yes; send the **1-page founding-partner letter** to make it official.

### Week 3 — go live + first report (the proof)
- **You + me:** flip Cookies live as the featured dispensary; confirm the click-out points at their real Dutchie menu.
- **Me:** assemble the **first 1-page report** from real events after ~a week live.
- **You:** send Cookies the report. **That report is your sales weapon for partners #2–5.**

---

## Definition of done (what "won" looks like in ~3 weeks)
- Cookies Hayward **signed** as founding partner #1 (free), live in the app.
- A user can go pick → see **"Buy at Cookies Hayward"** → tap to their menu.
- One **Sponsored Strain** publishes and renders, labeled, without affecting the match.
- **SEO live** and in Search Console.
- **One real report sent.** → You now have proof + a logo.

## The money path (honest)
These 3 weeks produce **$0 directly — on purpose.** They produce the asset that makes money: a working, proven, compliant placement plus a reference logo. **Weeks 4–8** are where dollars start: convert Cookies to **$199**, and walk the *identical* kit — now with a live case study and a screenshot of Cookies' placement — to **3–5 nearby dispensaries at $99–$299 charter**. Realistic first revenue: a few hundred a month from 2–4 partners, then repeat. That's the base you compound toward the house — not this sprint.

## Explicitly NOT doing now (so you don't get pulled off-path)
- **CannaGotchi** — frozen until partner #1 is reporting.
- **Stripe/payments** — not needed until a paid partner; the free deal defers it.
- Per-strain OG images, blog posts, new features — all wait behind the first live partner.

## Risks / watch-outs
- **Dutchie endpoints are undocumented/public** — the menu sync can break if they change. Fine for one partner; note it before scaling.
- **Effect-tag quality** is the matcher's credibility — keep it honest; don't let a sponsor push fabricated effects (your Sales FAQ already holds this line).
- **Brand-vs-buyer tone** — keep the B2B materials serious; save "let the universe decide" for the consumer side.

## Your move to start
Tell me the **Cookies decision-maker**, confirm I can dig into the repo, and I'll run the blocker audit first — then start wiring the click-out.
