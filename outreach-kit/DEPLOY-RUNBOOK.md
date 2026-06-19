# CannaPickForMe — Deploy Runbook + First-Partner Pitch
### Ship this session's work, set up Cookies, and run the founding-partner conversation.

Work top-to-bottom. Commands are for your machine (where `node_modules` works). Each step says
what you should see.

---

## 0. What shipped this session (context)
- **Test suite** (`/test`) — Node's built-in runner; covers the recommendation engine and the
  Dutchie name-matching. 17 tests, green.
- **CI** (`.github/workflows/ci.yml`) — runs the tests + a full Vite build on every push.
- **Dispensary system** — clickable "Buy at <dispensary>" on results + in-stock pills; weekly
  Firebase function refreshing menus; admin fields for Menu URL + Dutchie Slug.
- **Sponsored card** — clickable, now attributed to the sponsoring advertiser's dispensary.
- **Partner report** — a 📊 Report button on each campaign → printable 1-pager.

---

## 1. Verify locally (5 min)
```
npm install            # first time only / after dependency changes
npm test               # expect: tests 17 ... pass 17 ... fail 0
npm run build          # expect: SEO prebuild runs, Vite build completes, no errors
```
If `npm test` or `npm run build` is red, paste the output to me and stop here.

## 2. Push → CI (2 min)
```
git add -A
git commit -m "Dispensary buy-out + weekly menu refresh + sponsored attribution + tests/CI + partner report"
git push
```
Then open GitHub → the repo → **Actions** tab → watch the **CI** run go green.
*(Connect the GitHub connector in Cowork and I can read that run for you.)*

## 3. Deploy the weekly refresh function (3 min)
```
firebase deploy --only functions
```
Expect `refreshDispensaryMenus` in the deployed list. First deploy creates the Cloud Scheduler job
(runs Mondays 9am PT). To test immediately: Google Cloud Console → Cloud Scheduler → the job → **Run
now**.

## 4. Deploy the front-end (2 min)
Your `git push` likely already triggered a Vercel deploy. If not: `vercel --prod`. Confirm
`cannapickforme.com` loads and `cannapickforme.com/strain/blue-dream` still serves the static page.

## 5. One-time Cookies setup (in the admin panel)
1. Open `cannapickforme.com/admin`.
2. **📍 Dispensaries** → add/Edit **Cookies Hayward**:
   - **Menu URL** = their public Dutchie menu link (where "Buy" sends people).
   - **Dutchie Slug** = the `/embedded-menu/<slug>` segment of that link.
   - Save → the row should show `🔗 menu` and `↻ auto`.
3. **Seed the menu now** (don't wait for Monday): visit
   `cannapickforme.com/api/sync-menu?dispensary=<dutchieSlug>` — confirm it returns `matched` strains.
   Then run `refreshDispensaryMenus` once (Cloud Scheduler → Run now) so in-stock Cookies strains
   light up with the clickable pill + result "Buy" CTA.

## 6. Create the Cookies campaign (makes the Sponsored card live)
1. Admin → **Campaigns** → New. Pick/create the **Cookies** advertiser (set its dispensary to
   Cookies Hayward).
2. Set **Sponsored "Buy" goes to** = Cookies Hayward.
3. Add 1–3 **sponsored strains** Cookies stocks. Set **Status = live**, dates covering now.
4. Save.

## 7. Verify the full loop (as a user, on your phone)
- Add a couple of strains → answer the 4 questions → on the result you should see **"📍 In stock at
  Cookies Hayward — Buy"**.
- If the picked strain is a sponsored one, the **⭐ Sponsored Strain** card shows a **Buy ↗** that
  opens Cookies' menu.
- Both taps are tracked (Vercel Analytics `dispensary_click`; sponsored taps also bump the campaign).

## 8. Generate the report you'll hand Cookies
Admin → Campaigns → the Cookies campaign → **📊 Report** → **Print / Save PDF**. That's the 1-pager:
impressions, taps, tap-rate, the strains, the period.

---

## The Cookies founding-partner pitch
Use your existing kit in `outreach-kit/cookies-hayward/` (`DOSSIER.md`, `EMAIL_TOUCH_1.md`,
`DEMO_AND_VOICEMAIL.md`).

1. **The ask (small):** *"You're founding partner #1 — free for 90 days. Here's your live menu on my
   app and a clickable Buy that sends people to you. I'll send a monthly report. If it's working,
   we lock you at the $199 charter rate."*
2. **Demo live** on your phone — you stock ~148 of the 222 strains, so the in-stock Buy is real.
3. **Get the verbal yes**, send the 1-page founding-partner letter.
4. **After ~1 week live**, send the 📊 report. That report is your proof to sign partners #2–5 at
   paid charter rates.

## Add the next dispensary later (zero code)
Admin → Dispensaries → add it with a Menu URL + Dutchie Slug. The weekly function picks it up
automatically. Create their campaign the same way. That's the system that scales past Cookies.

---

## Honest notes
- This session's edits were verified by the unit tests + careful review; the full Vite build runs in
  CI (and your local `npm run build`), not in the Cowork sandbox (no package registry there).
- "Taps" in the report are placement-level click events. Non-sponsored result/pill taps also flow to
  Vercel Analytics (`dispensary_click`) if you want the raw event stream.
- Revenue is still $0 until Cookies converts to paid / neighbors sign — this sprint built the proven,
  compliant asset that makes those conversations real.
