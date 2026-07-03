# CannaPickForMe — Project State & Handoff

*Last updated: 2026-06-22. **New chat? Read this first**, then invoke the `cannapickforme-brand` skill. This is the living "current state" index — other docs go deeper.*

## What it is
CannaPickForMe (cannapickforme.com) — a cannabis strain-recommendation web app. Mood/effect quiz → deterministic weighted matcher → strain pick. Goal: monetize via dispensary/brand ad partnerships. Owner (Adam) is floor lead at Cookies Hayward.

## Stack & deploy
- Vanilla JS ES modules + Vite 8, Capacitor, Firebase (Auth / Firestore / Functions), Vercel.
- Deploy = `git push` → Vercel runs `prebuild` (`scripts/generate-seo.mjs` + `scripts/generate-content.mjs`) → builds. Repo: `G:\Projects\CannaPickForMe`.
- Static SEO output (regenerated every build): 221 `/strain/<id>.html` + 10 `/lore/` collection hubs + `sitemap.xml` + `robots.txt`.

## Current state (live; last live audit graded A−)
- **221 strains** in `public/data/strains.json` — the single source of truth.
- **Terpenes**: 31 top strains carry sourced, dominant-first profiles (via Nimble), stored as additive `terpenes: [{name}]` with provenance in `dataSources[]`. The ~190 exotics are intentionally blank (no reliable public data).
- **Effect taxonomy** (`ALL_EFFECTS`, `src/main.js`): Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly, Body High, Head High.
- **Head High = 52 / Body High = 62**, applied **selectively** via `scripts/tag-highs.mjs` (threshold-gated, NOT blanket). Keep it selective — this has been a recurring request.
- Tagline: **"Your perfect strain, matched to your mood, not the hype."**

## Conventions & invariants (don't break)
- `genetics` is the canonical lineage field (string `"A × B"`). There is **no** `lineage` field.
- Enrichment is **additive / fill-if-absent** via `scripts/apply-enrichment.mjs` (reads `data-review/*.json`; `--write` applies; `--effects` is gated so effect/tag changes need explicit opt-in). Existing values are never overwritten.
- **No unsourced star ratings** (removed from matcher + pages). **No medical claims** (compliance). Age-gated; sponsored content labeled.
- Voice: casual, grounded in cannabis culture, expert on the facts; NOT a caricature; **no em-dashes** (reads AI-written).
- `normaliseName()` strips punctuation, so e.g. "Do-Si-Dos" == "Dosidos". Watch for name collisions — the apply-enrichment name map is last-wins.

## Working agreements (environment gotchas learned the hard way)
- The AI sandbox **cannot delete files** (`rm`) or modify `.git` (unlink is blocked) — attempting it leaves stale `index.lock` / `HEAD.lock`. **All `git` commits/pushes and file deletions are done by Adam on his machine.** Claude prepares; Adam runs git.
- Sandbox bash sometimes serves **stale copies** of host-edited files. After a host Write/Edit, verify via the host Read/Grep tools, not bash.
- Windows CRLF line endings are normalized via `.gitattributes`.

## Open threads / backlog
*Full prioritized list: `docs/ROADMAP.md` (2026-07-02).*
- **[in progress]** Deploy the terpene + cleanup commit (Adam finishing `git push`).
- **[done 2026-07-02, needs commit]** Matcher: terpene-alignment bonus (max +8), THC↔intensity adjustment (±6), deterministic tiebreaker, personal hit/miss feedback (±5). Strain pages: About prose + FAQ (+ FAQPage JSON-LD), THC in meta row, on-shelf availability. NEW: 48 `/compare/<a>-vs-<b>` pages (`scripts/generate-compare.mjs`, in prebuild) interlinked from strain pages + sitemap. NEW: 6 occasion hubs (movie night, hiking, date night, gaming, social, munchies). NEW: shelf-sourced THC for 40 strains via `scripts/pull-menu-potency.mjs` + availability snapshot via `scripts/pull-menu-availability.mjs` (both Cookies Hayward Dovetail; infused products filtered, 38% cap; re-run before deploys for freshness). NEW: post-session feedback prompt ("How was X? Hit/Miss") on home screen, browser-verified; verdicts stored in session history and fed to the matcher.
- **CSS split deferred:** game.css (97KB) can't be blindly split out of the main bundle — the always-visible companion widget uses `.cannaguy-companion`/`.game-monster` styles from it. Needs companion styles extracted first, with visual verification.
- **Next feature:** terpene filter + clickable aroma tags + terpene hub pages (matcher now uses terpenes; filter UI still pending).
- Enrich more strains' terpenes; keep deepening strain-page content.
- Close out the Cookies Hayward kit — it already exists in `outreach-kit/cookies-hayward/` (task #30 just needs marking done); then expand to more Bay Area dispensaries.
- Optional: Nimble keyword research / AI-visibility audit via the `seo-intel` skill.
- Hygiene: `git rm --cached .env` (tracked despite gitignore; Firebase client keys, not secret, but untrack going forward).

## Key references
- `docs/STRAIN-DATA-METHODOLOGY.md` — the no/low-cost enrichment pipeline (Layers 1–3 + consolidation + tagging).
- `docs/SEO-AUDIT-LIVE.md` — last crawl-based audit + prioritized levers.
- `docs/CONTENT-ENGINE.md` — SEO content engine (hubs + posts + interlinking).
- `data-review/nimble-terpenes.json` — the terpene proposals audit trail (`_superseded/` holds retired files).
- `outreach-kit/` — dispensary sales kit. (`RESUME_HERE.md` is a historical April-2026 snapshot — don't treat its "next steps" as current.)
- `cannapickforme-brand` skill — design tokens, tech stack, and voice/tone.
