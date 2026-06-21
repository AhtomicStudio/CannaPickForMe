# Live SEO Audit — cannapickforme.com

*Crawl-based audit via Nimble (real fetches of the deployed site), not a static
read of the repo.*

**Date:** 2026-06-21 · **Crawled:** homepage (JS-rendered), sample strain page,
sample hub page, `sitemap.xml`, `robots.txt`, full URL map (150+ URLs)

---

## TL;DR

**Overall health: A−.** Your latest deploy is **live and correct**, and the SEO
foundation is genuinely strong: 222 static strain pages, 10 collection hubs, a
clean sitemap/robots, and a working internal-linking flywheel I verified on the
live site (strain → hub → strain). Three concrete fixes below; the biggest lever
is **content depth on the 222 strain pages** plus applying the terpene data.

---

## What the crawl confirmed is LIVE and working ✅

- **Deploy is current.** `sitemap.xml` lists all **222 `/strain/<slug>` pages +
  all 10 `/lore/` hubs + the editorial post**, every entry `lastmod 2026-06-21`.
  Your quick-win hubs shipped.
- **`robots.txt` correct** — allows crawling, blocks `/admin` + `/admin.html`,
  points to the sitemap.
- **Strain pages render full static HTML.** `/strain/blue-dream` returned a clean
  page: one `<h1>` (Blue Dream), genetics ("Blueberry × Haze"), effects, flavors,
  6 related-strain links, a **"Related guides"** block linking to 3 hubs, the
  `?strain=` deep-link CTA, and the compliance footer.
- **Hub pages are strong.** `/lore/best-indica-strains` lists **60 internal strain
  links** + 5 cross-hub links + intro + CTA.
- **Internal-linking flywheel is live** — strain → hub, hub → strain (×60),
  home → hubs. This is the hardest part to get right and it's working.
- **Homepage renders for crawlers** (601 KB rendered DOM) and the `<noscript>`
  fallback with hub links is present in the markup.

---

## Issues (by severity)

### Medium

| # | Page | Issue | Fix |
|---|------|-------|-----|
| 1 | `/` homepage | **5 `<h1>` tags in the DOM** — the noscript H1 plus a separate H1 on each hidden SPA screen (age-gate, home, result, about). Multiple H1s blur the page's topic signal. | Keep **one** semantic `<h1>`; demote the per-screen titles to `<h2>` or styled `<div>`. |
| 2 | `/strain/*` (×222) | **Thin content** — ~150 words and a single-sentence description per page. Across 222 near-identical templates, Google can judge these low-value. | Enrich descriptions (2–4 unique sentences), add terpene + genetics prose, consider a short per-strain FAQ. This is the #1 content lever. |

### Low

| # | Page | Issue | Fix |
|---|------|-------|-----|
| 3 | `/lore/*` hubs | The breadcrumb's last crumb shows **"Best Indica Strains \| CannaPickForMe"** — the full `<title>` leaked into the visible crumb. | Use the bare hub title in the breadcrumb, not the page `<title>`. |
| 4 | `/` homepage | Couldn't confirm the `<title>`/meta through the crawler (SPA quirk; the new tagline is in source). | Verify in **Google Search Console → URL Inspection** that the static `<title>` + "matched to your mood" description render. |
| 5 | `/strain/*` | **Terpenes applied ✓** — 31 top strains now carry sourced dominant-terpene profiles (via Nimble), rendering on pages + in meta descriptions. | Remaining: build the terpene filter + aroma-tag hub pages to fully exploit the data. |

**No Critical or High issues found.** The fake-rating liability you removed last
session would have been a High — good that it's gone.

---

## Category scorecard (from sampled pages)

| Category | Result |
|---|---|
| Meta tags | Per-page title/description/canonical/OG built statically — **verify in GSC** |
| Heading structure | Strain + hub pages clean (1 `<h1>`); **homepage fails (5 `<h1>`)** |
| Schema (JSON-LD) | Product + BreadcrumbList (strains), CollectionPage (hubs), Article (post), WebApplication (home) — present in source |
| Internal links | **Excellent** — flywheel verified live |
| Content quality | Hubs strong; **strain pages thin** |
| Technical foundations | sitemap ✓ · robots ✓ · HTTPS ✓ · clean URLs ✓ |
| Core Web Vitals | Not measured here — run Lighthouse on `/` (the app shell is heavy; static pages are light) |

---

## Quick wins (< 2 hrs each)

1. **Collapse the homepage to one `<h1>`** (demote the per-screen titles).
2. **Trim the `| CannaPickForMe` suffix** from hub breadcrumbs.
3. **Enrich your top 10–20 strain descriptions** — start with the strains most
   likely to get search traffic (Blue Dream, GSC, Runtz, Gelato, etc.).

## Biggest levers (highest impact)

1. **Content depth on strain pages** — the thin-content fix, at scale. This is
   what separates a 222-page thin directory from an authoritative strain library.
2. **Apply the terpene data** — richer pages + meta + a terpene filter and hubs.
3. **A Cookies Hayward location hub** ("Best Flower at Cookies Hayward") — local
   SEO *and* a literally sellable sponsored page.

---

## Next — sibling workflows I can run on demand

- **Keyword research** — real search volumes + difficulty for "best [effect]
  strains", "indica vs sativa", and strain-name queries, so you write to demand.
- **AI visibility** — whether ChatGPT / Perplexity / Google AI Overviews cite you.
- **Competitor keywords** — what Leafly / Weedmaps rank for that you're missing.
