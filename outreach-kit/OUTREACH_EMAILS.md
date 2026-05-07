# Dispensary Outreach — 3-Touch Email Sequence

Personalization tokens are wrapped in `{{ }}`. Replace before sending. Send from a personal-looking sender (Adam at CannaPickForMe), not a generic `info@` alias. Plain-text formatting, no images, no signature graphics — these get filtered into Promotions otherwise.

**Cadence**
- Touch 1: Day 0 — cold email
- Touch 2: Day +5 — reply to the same thread, no new subject line
- Touch 3: Day +14 — final breakup email, in-thread

If they reply at any point, drop the sequence and respond live. If they say no, send the "graceful no" reply at the bottom of this doc and check back in 6 months.

---

## Touch 1 — Day 0

**Subject:** Quick question about {{Strain They Stock}} at {{Dispensary Name}}

Hi {{First Name}},

I'm Adam — I built CannaPickForMe, a strain-discovery app for California adult-use consumers. We list {{Dispensary Name}} in our catalog already, and {{Strain They Stock}} is one of {{N}} strains we send users to you for.

Quick reason I'm reaching out: when our app recommends {{Strain They Stock}} to a user, I'd like to put your store next to that recommendation — branded, with your hours and a tap-to-directions link. Charter pricing for the first five partners is $199/mo, locked for 12 months, 30-day cancel.

Worth a 15-minute call this week or next? Happy to walk you through the live placement on a screen-share — you can see the exact pixel.

— Adam
CannaPickForMe
twotales89@gmail.com
cannapickforme.com

---

## Touch 2 — Day +5 (reply in same thread)

**Subject:** (no change — reply to your own Touch 1 email)

Hi {{First Name}} — circling back on this. The placement runs at the moment a user has just been told what strain to consume — the highest-intent decision point in our flow, which is why I think it'd work for {{Dispensary Name}} specifically given {{Strain They Stock}} is on your shelf.

Attached is our partnership kit (7 pages) with the placement specs, charter pricing, and compliance posture. The 15-minute call ask still stands — or just reply with one of these:

- "Send a mockup" — I'll render your card in the live app and send the screenshot in 48 hours.
- "Try me Q3" — I'll close the loop and check back in July.
- "Not for us" — totally fine, I'll stop bothering you.

— Adam

*[Attach: CannaPickForMe_Dispensary_Partnership_Kit.pdf]*

---

## Touch 3 — Day +14 (final, in same thread)

**Subject:** (no change)

{{First Name}} — closing the loop on this one. No reply needed.

Should I check back in Q3, or is this a hard pass? Either answer is helpful.

— Adam

---

## Reply templates

### "Send a mockup"

Subject: (in-thread reply)

{{First Name}} — sending the mockup over by EOD {{Day, e.g., Thursday}}. To make it accurate, two quick questions:

1. Logo — do you have a square version (PNG, transparent background)? If not, I'll grab one from your site.
2. CTA — would you rather the card link to your store map, your delivery menu, or your phone number?

— Adam

### "What's the contract / what am I signing?"

Subject: (in-thread reply)

{{First Name}} — short answer: a one-page partnership letter. Here's the gist:

- Charter rate of ${{99/199/299}}/mo, locked for 12 months from go-live
- Cancel any month with 30 days' written notice — no annual commitment
- Monthly placement report by the 5th of each month
- One creative refresh per quarter, intra-quarter swaps free for time-sensitive promos
- Net-30 invoice or stored card (Stripe, your preference)

If you want, I'll send the letter pre-filled for review — no signature obligation until you've seen the mockup. That work?

— Adam

### "How many users do you have?"

Subject: (in-thread reply)

Fair question, and I'll give you the honest answer: we're charter-stage. That's why these prices are locked for 12 months — we want partners who are with us before the audience scales.

Here's what I can guarantee instead of a user count:

- Monthly reports drawn from real platform events, not estimates.
- 30-day cancel — if it's not delivering by month 3, walk away.
- 222 strain pages just shipped to Google search; organic traffic is starting to compound.
- Placement runs at the moment a user is being told what to consume, which is upstream of where Weedmaps and Leafly reach them.

If those terms don't work for {{Dispensary Name}}, I respect that. If they do, I'd like to show you the live product on a 15-minute call.

— Adam

### "Graceful no" (use when they pass)

Subject: (in-thread reply)

Understood, {{First Name}} — appreciate the straight answer.

{{Dispensary Name}} stays in our catalog at no charge, so users will keep finding you when they search for the strains you stock. If anything changes on your side later, my email's the same.

— Adam

---

## Personalization checklist (do this before every Touch 1)

Spend 3–5 minutes per dispensary. The 30-day reply rate triples when the email proves you actually looked.

1. Pull the dispensary row from `Dispensary_Outreach_Tracker.xlsx` → "Pipeline" sheet.
2. Pick one strain from the "Strains stocked" column. Confirm they actually carry it (5 seconds on their menu page).
3. Find the buyer or GM's first name — usually on the "About" / "Team" page or the most recent Instagram post.
4. Find the email — try `[firstname]@[domain]` first; if it bounces, try the website contact form or LinkedIn.
5. Send between Tue–Thu, 8:30–10:30 AM Pacific. Highest open rates for B2B in the cannabis vertical.

---

## What NOT to do

- Don't open with "I hope this finds you well." Cannabis buyers see 30 of these a day; it triggers an instant skim-and-delete.
- Don't attach the PDF on Touch 1. It looks like a mass send; it'll go to Promotions.
- Don't pitch impressions or user counts you can't back up with a screenshot.
- Don't follow up more than 3 times. The fourth follow-up converts at <0.2% and damages future deliverability for the whole domain.
- Don't ever forward this thread to a colleague without trimming the personalization tokens out of view.
