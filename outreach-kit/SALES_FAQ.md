# Dispensary Sales — Objection Handler & FAQ

The questions a real dispensary buyer will ask, and the honest, defensible answers. Read this before any call. Memorize the first sentence of each answer — those are the lines that stop a buyer from disengaging.

The rule: every claim in here is backed by either (a) the source code of the app, (b) a published policy of a third party (Google, Meta, Apple, etc.), or (c) something we are committing to do in writing in the partnership letter. Nothing is invented.

---

## 1. "How many users do you have?"

**Short answer:** We're charter-stage and not pitching impression numbers we can't deliver.

**Long answer:** That's exactly why the rate is locked at $99–$299 for 12 months. The proposition isn't "buy our reach today" — it's "lock pricing now, before the audience grows." Concretely, what we *can* commit to:

- Monthly reports drawn from real platform events (impressions, taps, match-rate). If a number is too small to be meaningful in a given month, we'll say so in the report.
- 30 days' notice to cancel any month — if it isn't delivering by month 3, you walk away with no annual commitment.
- 222 strain pages just went live on Google search. Organic discovery traffic is starting to compound; you'll see it in the monthly report.

Buyers respect honest framing more than fake numbers. The ones who don't aren't going to be good partners anyway.

---

## 2. "Why should I pay you instead of Weedmaps / Leafly?"

**Short answer:** We're upstream of them. We're not asking you to swap.

**Long answer:** Weedmaps and Leafly catch the user at the *where to buy* moment — they're directories. CannaPickForMe is at the *what to buy* moment. The user has just been asked what mood and intensity they want, and we're handing them a strain. That's a different placement, earlier in the funnel, with a different intent signal.

You can absolutely run both. Most charter partners will. The two pitches don't compete — they cover different decisions.

---

## 3. "What's your reporting actually look like?"

**Short answer:** Placement-level events from Firebase, delivered as a 1-page monthly report by the 5th.

**What's in the report:**
- Impressions: count of times your card was rendered.
- Engagement events: taps to your dispensary, expansions of your card.
- Sponsored Strain partners: match-rate (count of user matches that surfaced your strain).
- Geographic split where statistically meaningful (city-level, derived from anonymous IP — never user-identifying).
- Top 3 matched strains across the platform that month, for context.

We don't pad. If a metric is below 50 events, the report says "below threshold for meaningful interpretation" — same standard you'd want for any analytics deliverable.

---

## 4. "Are you compliant? My team will ask."

**Short answer:** Yes, and we built it that way on purpose. The compliance officer's checklist is in the media kit, page 6.

**Specifics for the call:**

| Concern | Our position |
|---|---|
| Age gating | 21+ verification required before any cannabis content renders. Affirmation per device. |
| Sale facilitation | We don't take orders, process payments for cannabis goods, route deliveries, or hold inventory. Apple App Review Guideline 1.4.3 compliant. |
| FDA language | All disclaimer surfaces carry the standard "not evaluated by FDA / not intended to diagnose, treat, cure, or prevent any disease." |
| Federal status | Disclaimers explicitly note cannabis is Schedule I under federal law. |
| Data privacy | Cookieless analytics (Vercel Analytics). No PII collected from anonymous users. Authenticated users can delete their account from in-app settings. |
| Auth | Firebase Auth — Google standard, passwordless email magic link or Google OAuth. |

If their compliance officer wants to see source code or a written compliance memo, we'll provide both. We'd rather over-document than have a partnership unwound.

---

## 5. "Can I cancel?"

**Short answer:** Any month, with 30 days' written notice. No annual commitment.

The charter rate is *locked for you* for 12 months — but you're not locked in for 12 months. The asymmetry is intentional. We want you to stay because the partnership is working, not because of a contract clause.

---

## 6. "What happens to my charter rate after 12 months?"

**Short answer:** We will give you 60 days' notice before any rate change, and you'll get the lowest rate of any then-published tier in the same category.

We'll publish standard pricing at the end of charter. Charter partners are grandfathered to the better of (a) their charter rate plus a stated cap, or (b) the new published rate. The exact terms are in the partnership letter.

---

## 7. "How long until my placement goes live?"

Standard onboarding: ~2 weeks from signed letter.

1. Partnership letter signed (1 day)
2. Creative intake form (logo, copy, CTA target) — 2 days
3. Mockup screenshot for sign-off — 5 days
4. Placement activated — within 2 weeks of letter

For Sponsored Strain partners, we'll also confirm the up-to-three SKUs you want featured during creative intake.

---

## 8. "What if I want to feature a strain you don't have?"

If it's a real strain with documented effects and genetics, we add it. We do this routinely — it's a few minutes of catalog work. We'll add it as part of the Sponsored Strain onboarding at no charge for charter partners.

If you're asking us to fabricate effects for a generic SKU — we won't, because that breaks the matcher's value to users. We can talk about how to position the SKU honestly within the existing effect taxonomy.

---

## 9. "Who else is using this?"

**Short answer:** Charter cohort is being assembled now. Five slots per tier.

If pressed: "I'm not going to drop other partners' names without their permission, and they wouldn't drop yours either. If you want a reference call from a confirmed charter partner once we have one in your tier, I'll set that up."

This is the answer that wins respect from professional buyers. The buyer who would press past this is rare; the buyer who'd take "trust me" as the answer instead is also rare.

---

## 10. "Can I buy this on a one-month trial?"

**Short answer:** No, because that's worse for both of us.

Charter pricing is what it is precisely because we're asking for a measured commitment — not 12 months locked, but at least 90 days of good-faith partnership. Three months is the floor for any monthly metric to be readable. A one-month trial generates noise, not signal, and we'd both walk away with a conclusion that wasn't really earned.

What we will do instead:
- 30-day notice to cancel after month 3.
- Pause-and-resume option if a single month is genuinely off (store closure, weather event, etc.) — once per 12 months.
- Mockup-before-signature so you know exactly what you're getting before paperwork.

---

## 11. "What if cannabis advertising rules change?"

**Short answer:** They will, and that's part of why this conversation is happening now.

Two scenarios:

**Federal de-scheduling / Google or Meta open up cannabis ads.** When this happens, supply of placements opens up and pricing on every cannabis-vertical channel will compress. Charter partners are insulated by the 12-month rate lock and the 60-day notice clause described in #6.

**California-level rules tighten further (e.g., advertising restrictions on dispensaries).** We'd review the change with counsel and adjust placement specs if needed. The partnership letter has a regulatory-change clause that gives both sides a clean exit if the change makes the placement unworkable.

---

## 12. "Can you guarantee I'll see ROI?"

**Short answer:** No. Anyone who says yes is lying or about to take your money.

What we'll commit to:
- Honest reporting that lets you measure ROI yourself.
- 30-day cancel so you don't carry a non-performing line item.
- Quarterly creative refreshes, plus free intra-quarter swaps for time-sensitive promotions, so we can iterate on what's converting.

If after 90 days the report is genuinely flat, we want you to walk. A non-performing partnership hurts our reputation more than the lost MRR helps it.

---

## Closing principles for every call

- **Don't oversell.** Buyers in this category have been burned. The strongest move is honesty.
- **Show, don't tell.** If you can do a live product walkthrough on your phone during the call, do it. Pixel-level proof beats slideware.
- **Names of competitors are okay.** Acknowledging Weedmaps and Leafly explicitly lowers the buyer's defensiveness — it shows you've thought about positioning rather than pretending you exist alone.
- **Always offer the no.** "If this isn't a fit, just tell me — I'd rather get a clean no than waste your follow-up time." Buyers respect this and remember it next quarter.
- **Don't negotiate on charter rate.** Charter pricing is a published rate, not a starting point. Discounting it undermines the entire framing of "early partners get the best deal."
