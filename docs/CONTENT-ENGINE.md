# CannaPickForMe — SEO Content Engine

How `/lore` content is authored, generated, and interlinked. Two complementary
sources feed one experience; both can carry photos, formatted text, and links to
strain pages.

---

## The two sources

| | **Static pages** (SEO-primary) | **Admin posts** (instant) |
|---|---|---|
| Authored in | markdown files in `content/lore/` + the `HUBS` config | the admin **Lore Topics** editor (Firestore) |
| Rendered | build-time → real `/lore/<slug>.html` | client-side in the SPA `/lore` screen |
| SEO | **Strong** — real HTML, JSON-LD, in sitemap | Secondary — JS-rendered, not in sitemap |
| Best for | evergreen guides, collections, anything you want ranking | quick rich updates, in-app reading |
| Updates on | next `npm run build` + push | instantly (Firestore) |

Both render with the same look on `/lore` and both support **photos, markdown
text, and `/strain/<id>` links**.

---

## Static pages — `scripts/generate-content.mjs`

Runs in `prebuild` (after `generate-seo.mjs`). Produces:

- `/public/lore/<slug>.html` for every editorial post + hub (Article /
  CollectionPage JSON-LD, internal links to strain pages, compliance footer).
- Appends each page to `/public/sitemap.xml` (idempotent, non-destructive).
- Writes `/public/lore-index.json` — the manifest the SPA `/lore` screen reads to
  list the pages as cards.

### Add an editorial post

Drop a markdown file in `content/lore/`, e.g. `content/lore/terpenes-101.md`:

```markdown
---
title: Terpenes 101 — The Aromas Behind Your High
slug: terpenes-101
description: A plain-English guide to the terpenes that shape how a strain feels.
date: 2026-06-20
overline: Cannabis 101
relatedHubs: best-body-high-strains, best-head-high-strains
---

## What is a terpene?

Body text. **Bold**, [a link](https://example.com), and a strain link like
[Blue Dream](/strain/blue-dream).

![A caption for the photo](https://your-image-url.jpg)

- bullet one
- bullet two
```

Front-matter `title` + `slug` are required. `relatedHubs` (comma-separated hub
slugs) renders "Explore the collections" links. Rebuild to generate it.

### Add a hub (data-driven collection)

Edit the `HUBS` array in `scripts/generate-content.mjs`. One entry = one
collection page that auto-pulls matching strains:

```js
{ slug: 'sleepy-strains', title: 'Best Strains for Sleep', overline: 'Strain Collection',
  intro: 'Heavy indicas and sedating hybrids for winding down.',
  match: (s) => (s.effects || []).includes('Sleepy') },
```

`match` is any predicate over a strain. Rebuild to generate it.

---

## Admin posts — Lore Topics editor

In the admin (**📜 Lore Topics**), each post now has: Icon, Teaser, **Header
Image URL**, and a **Markdown** content box. The content box supports:

- `**bold**`, `[link text](https://…)`, bullet lists with `-`
- photos: `![caption](https://image-url.jpg)`
- strain links: `[Blue Dream](/strain/blue-dream)`

These render richly on the `/lore` screen (hero image + formatted body) and show
in the same card area as the static pages. They publish instantly via Firestore.

> **Note on SEO:** admin posts are client-rendered, so they're great for in-app
> content but don't get the static-page SEO boost. For a post you want ranking on
> Google, author it as a markdown file (above). A future upgrade can generate
> static pages from Firestore at build time to make admin posts SEO-strong too.

---

## Voice — the style filter

Every post (markdown or admin) should read like a knowledgeable head, not a press
release. Run drafts through two filters:

1. **Casual** — short sentences, active voice, a little personality. Contractions
   and rhetorical asides welcome. Cut the textbook tone.
2. **Culture, not caricature** — real terms used naturally (terps, loud,
   couch-lock, crack the jar, flower), never a forced "420 dude" parody.
   Grounded in the culture *and* expert on the facts.

Hard rails (from the brand voice guide):

- **No medical claims** — no "treats / cures / helps with [condition]." Hedge:
  "often described as," "a popular pick for winding down at night."
- **Responsible-use cue** where natural — "start low and go slow."
- **21+ only** — nothing that could appeal to minors.
- **Honest facts** — flag what research hasn't proven (e.g. the entourage
  effect). Confidence, not overstatement.

`content/lore/head-high-vs-body-high.md` is the reference for the target voice.

## Internal-linking flywheel

The whole point — a tight topical cluster Google rewards:

- **Hub → strains** (each collection links to its strains)
- **Post → hubs** (`relatedHubs`)
- **Strain → hubs** (`guideLinksHtml` in `generate-seo.mjs`: a strain tagged
  Body/Head High links up to its hub)
- **`/lore` → everything** (the manifest listing)

When you add a hub for a new effect, add a matching row to `HUB_LINKS` in
`generate-seo.mjs` so strain pages link up to it too.

---

## Build, deploy, verify

```
npm run build      # prebuild runs generate-seo + generate-content
npm run preview    # then open the URLs below
```

- `localhost:4173/lore` → lists the static pages as cards (+ any admin posts)
- `localhost:4173/lore/best-body-high-strains.html` → a hub page
- `localhost:4173/lore/head-high-vs-body-high.html` → the editorial post

(In `vite preview`, use the `.html` suffix; Vercel's `cleanUrls` serves them at
`/lore/<slug>` in production.)

Then `git push` — CI + Vercel regenerate everything clean-room.

---

## File map

- `scripts/generate-content.mjs` — the engine (posts + hubs → static HTML, sitemap, manifest)
- `content/lore/*.md` — editorial posts
- `public/lore-index.json` — generated manifest (do not edit by hand)
- `src/router.js` — `/lore` SPA screen: lists static pages + renders admin posts (`mdLite`)
- `src/admin.js` / `admin.html` — Lore Topics editor (icon, teaser, image, markdown)
- `scripts/generate-seo.mjs` — strain pages, incl. `guideLinksHtml` (strain → hub backlinks)
- `src/pages.css` — `.lore-page-card` + rich-content styles
