# Resume Notes — Dispensary Outreach Kit

> ⚠️ **Historical snapshot (April 25, 2026).** Much of the "not done yet" list below has since shipped — terpene data, the SEO content engine, sponsored-strain publishing, the strain matcher/filter work, and the Cookies Hayward kit (`outreach-kit/cookies-hayward/`). Kept for the pricing reference and history; don't treat the "next steps" as current.

**Status as of bedtime, April 25, 2026:** Outreach kit is complete and shipped. SEO foundation (222 strain pages, sitemap, robots.txt) was completed earlier in the same session.

## What's done

### SEO foundation (earlier in the session)
- `scripts/generate-seo.mjs` — generator runs on every `npm run build`
- `public/strain/*.html` — 222 strain landing pages
- `public/sitemap.xml` — 225 URLs
- `public/robots.txt`
- `index.html` — added canonical URL + JSON-LD WebApplication schema
- `package.json` — `prebuild` and `generate:seo` scripts wired in

### Dispensary outreach kit (in `/outreach-kit/`)
- `CannaPickForMe_Dispensary_Partnership_Kit.pdf` — 7-page media kit
- `Dispensary_Outreach_Tracker.xlsx` — pipeline + pricing + playbook (3 sheets)
- `OUTREACH_EMAILS.md` — 3-touch email sequence + reply templates
- `SALES_FAQ.md` — 12 honest objection-handlers for live calls

## Pricing reference (consistent across all docs)
- Listed Partner — $0/mo (always-on baseline)
- Banner Partner — $99/mo charter
- Result Partner — $199/mo charter
- Sponsored Strain — $299/mo charter
- Result + Sponsored bundle — $399/mo charter
- Charter terms: locked 12 months, first 5 partners per tier, 30-day cancel

## What we have NOT done yet (pick from these in the morning)

Suggested next sessions, in rough priority order:

1. **First three SEO blog posts** — drafted as Markdown files in a new `/content/blog/` folder. Topics already scoped:
   - "Best Sativa Strains for Creativity"
   - "Sativa vs Indica: What the Effects Actually Feel Like"
   - "Top 10 Bay Area Dispensaries by Strain Selection"
   These internal-link to the new strain pages and give Google something to rank in the matcher's voice.

2. **Per-strain OG images** — currently every shared result uses the generic `icon-512.png`. Generate a per-strain Open Graph image (1200x630) at build time so iMessage / Discord / Twitter previews are strain-specific. Big lift on share-driven traffic.

3. **Cookies Hayward outreach prep** — Cookies Hayward stocks **148 of our 222 strains** (top of the tracker). They're the obvious first call. Could do a research pass on the buyer/GM, draft a personalized Touch 1, and prep the demo flow specifically for what they carry.

4. **Mockup screenshot for the kit** — the PDF references a "placement preview" but we haven't generated one. A 2-up mockup (home banner + result card with a real partner brand example) would tighten the kit.

5. **Wire the sponsored-strain Firestore writes** — the `ads` collection and admin dashboard are built, but I didn't touch them this session. Worth confirming the admin can actually publish a Sponsored Strain card end-to-end before the first partner signs.

## Open questions to resolve in the morning

- **Real domain confirmation:** every doc uses `cannapickforme.com`. If the live domain is different, find/replace before anything ships externally.
- **Vercel deploy verification:** the SEO changes haven't been deployed yet. After your next `git push` / Vercel deploy, verify `cannapickforme.com/strain/blue-dream` serves the static page (not the SPA shell), and submit the sitemap to Google Search Console.
- **Stripe / invoicing:** the kit promises Net-30 or stored card via Stripe. If Stripe isn't set up yet for the cannabis-adjacent SaaS use case, that's a small piece of plumbing to handle before the first signed letter.

## Decisions you'll want to make in the morning

- Do you want the blog posts ghostwritten in your voice, or in a more clinical "industry guide" voice? The first three posts will set the tone for everything downstream.
- For the mockup: do you have a real brand we can use as the example dispensary in the screenshot, or should we use a fictional "Sample Dispensary" placeholder?
- Cookies Hayward call: solo or co-pitch? The prep changes a bit either way.

Sleep well.
