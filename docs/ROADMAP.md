# Roadmap — Prioritized Improvements

*Created 2026-07-02 from the full-app audit + monetization/traffic brainstorm. Ordered by impact. Status lives here; details in the session that created it. See `docs/PROJECT-STATE.md` for conventions.*

## Tier 1 — Biggest impact

1. **Deepen the 221 strain pages (+ FAQ schema).** The #1 SEO lever from the live audit. 2-4 unique sentences per strain, terpene/genetics prose, short per-strain FAQ with FAQ JSON-LD. Raises the floor for every other content play.
2. **Surface live menu data to users ("in stock now near you").** Menu sync already exists (admin-only `menus` collection). Exposing inventory on strain pages + result screen = freshness signal for SEO, conversion for users, and the core partner value prop.
3. **White-label quiz / kiosk pilot with Cookies Hayward.** Recurring B2B revenue reusing the matcher + menu-match code. Outreach kit is the sales material. (Business motion, runs in parallel with code work.)
4. **Comparison pages for top ~50 strain pairs ("X vs. Y").** High-intent, low-competition searches; effect/terpene data generates most of each page. New generator on the existing SEO pipeline.

## Tier 2 — High value, moderate effort

5. **Add THC/potency data; make the intensity question real.** The `scoreMultiplier` scales all strains equally so intensity never changes ranking. Dovetail sync already extracts `potency_thc` — pipe into strains.json, weight on it.
6. **Terpene-aware matching + terpene filter + terpene hubs.** Data exists for 31 strains; make the matcher use it, then build the filter + hub pages.
7. **Archetype-first share cards.** Make the archetype the shareable payload (strain rides along). `shareCard.js` + `generateArchetype()` already exist.
8. **Post-session feedback loop ("did this pick hit?").** Feeds personal effect sensitivities back into matching; proprietary data over time.
9. **Occasion hubs** (movie night, hiking, date night). Map 1:1 to quiz vibe answers; natural quiz CTA.
10. **QR card at the Cookies register + budtender channel.** Offline-to-online, perfect intent.

## Tier 3 — Worth doing, smaller/slower payoff

11. ~~Consumption-format question~~ — dropped 2026-07-02: the app is flower + genetics only, by design.
12. Affiliate links on strain pages (seed banks, accessories, glass).
13. Newsletter with sponsored slots.
14. "Strains like X" pages (matcher computes the list).
15. Demand-insight reports for dispensaries (needs session volume; upsell on #3).
16. Nimble keyword research + AI-visibility audit (cheap; validates #4 vs #9 ordering).
17. "Stash Wrapped" seasonal share moment (4/20, New Year's).

## Tier 4 — Hygiene (quick)

18. `git rm --cached .env` (tracked despite gitignore; client keys, not a leak — Adam runs).
19. Homepage single `<h1>` + hub breadcrumb title fix (open items from SEO audit).
20. Split/purge the 210KB CSS bundle (2.5x main JS on critical path).
21. Matcher tiebreaker (ties currently favor first-in-file order).
