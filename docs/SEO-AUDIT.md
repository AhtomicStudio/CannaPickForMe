# CannaPickForMe — SEO Audit

*Snapshot of the site's search-engine standing, grounded in the actual codebase.
Organized: what's working, what to improve, what to add, what to delete — then a
prioritized action plan.*

**Date:** 2026-06-20

---

## The big picture

You're in a strong position most strain apps never reach: you ship **real static
HTML** for the content that matters. The architecture is a deliberate split:

- **Static, indexable (the SEO engine):** 222 strain pages (`/strain/<id>`), the
  content hubs and posts (`/lore/<slug>`), `sitemap.xml`, `robots.txt`. These are
  pre-rendered at build time with full content, JSON-LD, and internal links.
- **Client-rendered SPA (the app):** the homepage matcher, `/lore` landing,
  `/about`. Google *can* render JavaScript, but it does so slower and less
  reliably, so these carry less SEO weight.

The strategy is right: let the app be an app, and let a fleet of static pages do
the ranking. The work below is about widening that static moat.

---

## What's doing well ✅

1. **Programmatic strain pages.** 222 unique `/strain/<id>` pages, each with a
   unique `<title>`, meta description, canonical, Open Graph, **Product +
   BreadcrumbList JSON-LD**, and internal links. This is the backbone and it's
   genuinely good — depth most competitors don't have.
2. **A real content engine.** Static hubs (CollectionPage schema) + editorial
   posts (Article schema), interlinked into the strain pages. Brand-new and
   already structurally sound.
3. **Bidirectional internal linking.** Strain → hub ("Related guides"), hub →
   strains, post → hub, related-strains → strains. This tight cluster is exactly
   what Google rewards, and it's the part you nailed.
4. **Clean technical baseline.** `cleanUrls`, a correct `sitemap.xml` (home +
   about + lore + 222 strains + content), `robots.txt` that allows crawling and
   **disallows `/admin`**, canonical tags, one `<h1>` per page.
5. **Strong homepage head.** Title, description, OG, Twitter card, canonical to
   root, and WebApplication JSON-LD (price, 21+ audience). Well done.
6. **Trust / E-E-A-T signals.** Age-gate, "educational, not medical advice"
   footers, cited sources in posts, no medical claims. For a cannabis (YMYL-adjacent)
   topic where trust is everything, this matters.
7. **Mobile + PWA.** Viewport, theme-color, manifest, apple-touch-icon, font
   preconnects, lazy-loaded images on the static pages.
8. **You just removed a liability.** The fake `★ rating` / `aggregateRating` was
   unsourced structured data — exactly the kind of thing Google penalizes.
   Killing it was a real SEO win, not just an honesty one.

---

## What to improve 🔧

1. **The homepage has almost no crawlable body text.** `<body>` is the SPA — the
   age gate + hidden screens filled by JS. Google sees your head tags but little
   indexable content for `/`. **Add a static intro section** (below the app or in
   a `<noscript>`/always-present block): a paragraph on what the matcher does, plus
   links to your top hubs and a few strain pages. This turns the homepage into a
   real ranking + internal-linking asset.
2. **`/lore` and `/about` (SPA routes) inherit the homepage's title/meta.** Every
   SPA route serves `index.html`, so they share its `<title>`. The static
   `/lore/<slug>` pages have unique meta (good); the SPA `/lore` landing is thin.
   Lean on the static pages for ranking; treat the SPA `/lore` as the in-app view.
3. **Strain meta descriptions don't use your new data.** You now have **terpenes
   and genetics** — fold them into `buildMetaDescription` in `generate-seo.mjs`
   ("…limonene-forward, Blueberry × Haze genetics…"). Richer snippets, more
   long-tail coverage.
4. **No per-strain images.** Every page shares one OG icon. When you have strain
   photos, add them (with alt text) and dynamic OG images — better rankings and
   social click-through.
5. **Core Web Vitals on the app shell.** The app loads Firebase + analytics +
   heavy CSS/animations. The static pages are light (good — they're what ranks),
   but the homepage LCP could hurt. Worth a Lighthouse pass on `/`.
6. **Crawl depth to strain pages.** Right now a strain page is reachable via
   sitemap + related-strains + hub links. That's okay, but link equity is diffuse.
   (See "Add: static /strains directory.")

---

## What to add ➕ (ranked by ROI)

1. **More hub pages — highest ROI, near-zero cost.** You have 2 (body/head high).
   Add one per major effect (Sleepy, Energetic, Relaxed, Creative, Focused…),
   per dominant terpene (Limonene, Myrcene, Caryophyllene…), and per type (Best
   Indicas / Sativas / Hybrids). Each is one line in the `HUBS` array and ranks
   for high-intent "best X strains" queries while funneling links to strain pages.
   *Add a matching row to `HUB_LINKS` in `generate-seo.mjs` so strain pages link
   up to each new hub.*
2. **Location / dispensary hubs — ties straight to revenue.** "Best Flower at
   Cookies Hayward," "Cannabis Strains in Hayward, CA." Local-intent SEO **and**
   a literally partner-sponsorable page. This is where SEO meets your ad-sales goal.
3. **A static `/strains` directory.** One crawlable, paginated index linking to
   all 222 strain pages (by type/effect). Strengthens crawl depth and spreads
   link equity better than the sitemap alone.
4. **More editorial posts.** "What Are Terpenes?", "Indica vs Sativa (the real
   answer)", "How to Read a Dispensary Menu", "THC % Is Lying to You". Topical
   authority + links down to hubs and strains. Run each through the voice filter
   in `CONTENT-ENGINE.md`.
5. **FAQ schema.** A short FAQ on strain pages (or a dedicated FAQ page) with
   FAQPage JSON-LD → eligible for rich results and "People Also Ask".
6. **Homepage static content block** (also listed under Improve) — counts as an
   addition since there's none today.

---

## What to delete / fix 🗑️

1. **Fake rating — already done.** Removed from the matcher, strain pages, and
   JSON-LD this session. Keep the test guard so it never returns.
2. **Guard against thin hubs.** A hub with only 2–3 strains is thin content. Add
   a minimum-strain threshold in `generate-content.mjs` — skip (or `noindex`) a
   hub that doesn't clear it, so you don't publish low-value pages.
3. **`?strain=` parameter URLs.** The strain-page CTA now links to `/?strain=<id>`.
   The homepage canonical (`→ /`) already consolidates these, so there's no
   duplicate-content problem — but watch crawl budget in Search Console. If Google
   over-crawls them, add `Disallow: /*?strain=` to `robots.txt`.
4. **Make sure no private routes leak.** `/admin` is disallowed; confirm any
   referral (`/r/`) or preview routes you don't want indexed are covered.

---

## Prioritized action plan

**Quick wins (this week):**
- Add 6–10 effect/terpene/type **hub pages** (HUBS config + HUB_LINKS rows).
- Fold **terpenes + genetics into strain meta descriptions**.
- Add a **homepage static intro** block with links to top hubs + strains.

**High-value (this month):**
- A **`/strains` directory** page.
- 3–4 more **editorial posts**.
- A **Cookies Hayward location hub** (SEO + a sellable sponsored page).

**Ongoing:**
- Connect **Google Search Console** + submit `sitemap.xml`; watch indexation,
  crawl budget, and Core Web Vitals.
- Add **FAQ schema**; add **per-strain images + OG images** when available.

The foundation is genuinely strong. The fastest needle-mover is simply **more
hub pages** — you've already built the engine and the data moat; now point it at
more queries.
