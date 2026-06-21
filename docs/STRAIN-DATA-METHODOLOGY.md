# CannaPickForMe — Strain Data Research Methodology

*How the app sources better-backed strain data — crosses/lineage, terpenes, and
effects — before a card goes live, at no or low cost, without sacrificing the
credibility we're selling to dispensaries.*

**Status:** Plan, for approval · **Last updated:** 2026-06-19

---

## TL;DR

Stack three sources, **cheapest and most trustworthy first**, all funneling
through the **Review Queue you already built** so nothing unverified ships:

1. **Seed once** from an openly-licensed dataset (Kushy, MIT) → instantly fills
   lineage / effects / flavors for the well-known strains.
2. **Capture on every menu sync** the terpene / THC / genetics the dispensary
   menu already returns → the most trustworthy data, free and ongoing.
3. **Draft the long tail with AI** (your Gemini/Claude), *with cited sources*,
   into the Review Queue → you approve before publish.

**Net new cost to start: $0.** A paid API ($50/mo) is a fallback only if the
free coverage proves too thin — a decision we make with data, not upfront.

---

## 1. The problem

Cards today are largely hand-built, with effects/flavors but **no genetics
(crosses/lineage) and no terpene data**, and the effect tags are best-guess.
That's three costs:

- **Weaker recommendations.** The matcher only knows effect tags. Terpenes and
  lineage are the *real* signal behind "head high vs body high," and we don't
  capture them.
- **Thin cards / weak SEO.** "Blue Dream — Blueberry x Haze, limonene-dominant"
  is a richer card *and* a stronger search page than a one-line blurb.
- **It doesn't scale.** Every new strain from a menu sync needs a human to type
  a profile. That's the bottleneck you're trying to remove.

The goal: **the app researches a strain before a card exists for it.**

## 2. Honest constraints (read this first)

This is the part that protects the business, so it's first:

- **Most free strain data is crowd-voted, not lab-measured.** Leafly/Weedmaps
  effects are user upvotes; community lineage is often disputed. It's good
  enough for a *recommendation* app, but it is not ground truth.
- **Terpene profiles vary batch-to-batch.** A strain's "profile" is an *average*
  at best; the same cultivar from two growers can differ. The most accurate
  terpene number is the one on the actual jar (Layer 2).
- **Licensing/ToS is real.** Scraping Leafly/Weedmaps live can violate their
  terms. We use **openly-licensed datasets** (e.g. Kushy = MIT) and **our own
  menu data**, and we *cite sources* rather than silently copying.
- **Compliance.** No medical claims (we already purged "Pain Relief"-type tags).
  Effect descriptors like "Body High" are fine; framing that implies treatment
  is not. Age-gate and "informational only" framing stay.

**Design consequence:** real sources beat AI invention, and **a human reviews
anything before it's published.** We already have the gate — the Review Queue.

## 3. Design principles

1. **Provenance over vibes.** Every enriched field records where it came from
   (`dataSources`), so we can audit and re-check.
2. **Trust ranking.** Jar/menu lab data > openly-licensed dataset > AI draft.
   Higher-trust sources win merge conflicts.
3. **Human gate, always.** AI and bulk imports *propose*; Adam *approves*.
   Nothing auto-publishes to a live card.
4. **Reuse what we built.** The name-matcher (`coreStrainName` /
   `findKnowledgeMatch` in `api/_menuMatch.mjs`), the Review Queue
   (`renderReviewQueue`, `strainDelta.additions` with `needsReview`), the
   menuSource adapters, and the CI data-quality test all already exist.

## 4. The methodology — three layers

### Layer 1 — Bulk-seed from an open dataset (free, one-time, real)

Match an openly-licensed strain dataset against our 222 strains **by name**
(reusing `coreStrainName`), and fill the gaps: lineage/cross, effects, flavors,
description seed.

- **Source:** [Kushy cannabis-dataset](https://github.com/kushyapp/cannabis-dataset)
  — **MIT licensed** (verified), CSV + SQL, categories include Strains. One-time
  static dump (note: low commit activity, so treat as a *seed*, not a live feed).

- **Vetting result (2026-06-19)** — inspected the actual file
  (`strains-kushy_api.2017-11-14.csv`, ~2k+ strains). Columns:
  `id, status, sort, name, slug, image, description, type, crosses, breeder,
  effects, ailment, flavor, location, terpenes, thc, thca … cbl`. Verdict:
  **usable but narrow.**
  - ✅ `crosses` (lineage, as strain-ID refs we resolve to names) and `flavor`
    are populated for classic strains — genuinely useful; we have none today.
  - ✅ `effects` present (Leafly-style) — usable as a cross-reference after
    mapping to our taxonomy and **dropping side-effects** (Dry Mouth, Paranoid,
    Anxious).
  - ❌ `terpenes` column exists but is **~99% empty** (a stray single terpene
    here and there) — **not a terpene source.**
  - ❌ `thc` / cannabinoid columns are **placeholder junk** ("127", "1300") —
    unusable.
  - ❌ `ailment` column is medical (Pain, Insomnia, Depression) and some
    descriptions say "pain relief" — **excluded entirely for compliance.**
  - ⚠️ **Dated 2017** — no modern strains (Runtz/Gelato-era, Cookies exclusives);
    those come from Layers 2–3.
  - **Net scope for Layer 1:** lineage + flavors (+ effect cross-ref) on classic
    strains only. Hard filters: drop `ailment`, drop cannabinoid columns, strip
    medical phrasing from any imported description.
- **Build:** `scripts/enrich-strains.mjs` — loads the dataset, name-matches,
  and writes **proposals to a review file**, never auto-applying. You eyeball a
  diff and accept.
- **Why first:** biggest free coverage jump, real (not invented) data, and it's
  what lets us auto-assign Head High / Body High from actual effect/lineage data
  (see §7).

### Layer 2 — Capture from menu syncs (free, ongoing, most trustworthy)

Dutchie/Dovetail product JSON frequently carries **terpene %, THC/CBD, and
genetics** already. Our sync fetches the payload — we just need to *keep* those
fields.

- **Build:** extend the Dovetail adapter (`api/_menuAdapters.mjs`) to retain
  terpene/cannabinoid/lineage fields when present, attach to the matched strain,
  flag for review.
- **Why it's the best data:** it's the *actual product on the shelf* this week —
  the one number that isn't a community average.
- **Limit:** only as good as what each menu publishes; coverage varies by store.

- **Built (2026-06-19)** — probed the live Cookies Dovetail payload (13 products
  sampled) and extended `api/_menuAdapters.mjs`. Real coverage is sparser than
  hoped:
  - THC range ~100% · `strain_type` ~38% (often "Not Applicable") · `effects`
    ~38% · `terpenes` ~23%, and **names only — no percentages** in this feed.
  - **No structured lineage** — genetics appear only in description prose, so
    lineage stays a Layer 1 / Layer 3 job.
  - `api/sync-menu.js` now returns an `enrichment[]` array of review proposals
    (same shape as the Kushy ones), additive to `matched`/`unmatched`. Effects
    are taxonomy-filtered; only fields a strain lacks are proposed. THC/CBD
    captured as `{min,max}`. Unit-tested (`test/menu-adapters.test.mjs`).
  - **Apply step (built 2026-06-19):** `scripts/apply-enrichment.mjs` merges
    reviewed proposals from BOTH layers into strains.json — additive /
    fill-if-absent, provenance in `dataSources`, effects behind `--effects`,
    `typeMismatch` never auto-applied, dry-run by default, `git diff` as the
    final gate. Surfacing proposals in the admin Review Queue UI is a later
    nicety; the CLI is the robust path since strains.json is a versioned repo file.

### Layer 3 — AI-draft the long tail (low-cost, gated)

For strains in **neither** the dataset **nor** the menu payload, an AI step
drafts lineage/terpenes/effects **with sources**, dropped into the Review Queue.

- **Cost:** uses your existing Gemini/Claude — effectively free at this volume.
- **Guardrail:** AI output is *always* a proposal with citations, *never* a live
  card. Hallucinated genetics can't reach users because a human signs off.
- **This is the "research before the card" hook:** when a sync surfaces an
  unknown strain, Layer 3 generates the first draft so you're editing, not
  authoring from scratch.

- **Built (2026-06-20)** — `scripts/draft-research.mjs`, no API key required.
  Scans strains.json for gaps, writes a strict paste-ready prompt pack
  (`data-review/ai-research-prompt.md`) for your Claude/Gemini chat, then
  `--ingest` validates the JSON reply and sanitizes it hard — terpene allowlist,
  taxonomy-only effects, and a medical-claim filter that rejects anything like
  "eases anxiety" — into proposals for `apply-enrichment.mjs`. Nothing
  auto-publishes. Unit-tested.

## 5. Research-before-card flow

```
New / unknown strain detected (menu sync)
        │
        ▼
[1] Open dataset lookup (Kushy)         ──┐
        │  (lineage, effects, flavors)     │
        ▼                                   │
[2] Menu payload capture (Dovetail)      ──┤  merge by trust rank
        │  (terpenes, THC/CBD, genetics)   │  (jar > dataset > AI)
        ▼                                   │
[3] AI draft for remaining gaps          ──┘
        │  (with cited sources)
        ▼
   REVIEW QUEUE  ←—— Adam approves / edits  (human gate)
        │
        ▼
   Published strain card  +  richer SEO page
```

## 6. Schema changes (backward-compatible)

All new fields are **optional**, so existing cards keep working. Added to each
object in `public/data/strains.json`:

```jsonc
{
  "name": "Blue Dream",
  "type": "hybrid",
  "effects": ["Happy", "Relaxed", "Euphoric", "Creative", "Head High"],
  "flavors": ["Blueberry", "Sweet", "Berry"],
  "description": "...",

  "genetics": "Blueberry × Haze",          // EXISTING field — the canonical cross

  // NEW (all optional)
  "terpenes": [
    { "name": "Myrcene",  "dominant": true },
    { "name": "Pinene" },
    { "name": "Caryophyllene" }
  ],
  "thc": { "min": 17, "max": 24 },        // optional, from menu when available
  "cbd": { "min": 0,  "max": 1 },
  "dataSources": [                          // provenance / audit trail
    { "field": "genetics", "source": "kushy",   "fetchedAt": "2026-06-19" },
    { "field": "terpenes", "source": "dovetail:hayward", "fetchedAt": "2026-06-19" }
  ]
}
```

The CI data-quality test (`test/strain-data.test.mjs`) gets extended to validate
the new shapes; strain cards and SEO pages (`scripts/generate-seo.mjs`) get a
lineage line and a dominant-terpene chip.

## 7. How this powers Head High / Body High

Once strains carry real terpene + type + effect data, we can assign the two new
effects **from evidence** instead of guessing — and only then add their matcher
weights (avoiding the score-deflation problem of tagging zero strains):

| New effect | Lean | Terpene signal | Effect signal |
|---|---|---|---|
| **Body High** | indica | myrcene, linalool, caryophyllene | relaxed, sleepy, hungry |
| **Head High** | sativa | limonene, terpinolene, pinene | energetic, creative, focused, uplifted |

Body High is already live on 12 strains. Head High stays schema-only until this
pass tags it from data — then we add its `effect-map.json` weights for the
cerebral answers (creative, energetic, social, productive, adventure, gaming).

## 8. Source candidates

| Source | Data | Cost | License / ToS | Use |
|---|---|---|---|---|
| **Kushy** (github.com/kushyapp/cannabis-dataset) | strains, lineage, effects, flavors | Free | **MIT** ✅ | **Primary seed (Layer 1)** |
| **Dispensary menu** (Dutchie/Dovetail) | terpenes, THC/CBD, genetics, desc | Free | our own integration | **Primary terpene source (Layer 2)** |
| Leafly/Kaggle dump (kingburrito666) | ~2k strains, effects, flavors | Free | murky (Leafly-derived) | cross-reference only, don't redistribute |
| Terpene-Profile-Parser (MaxValue, GitHub) | terpene profiles | Free | check repo license | candidate terpene seed, vet first |
| Kannapedia (kannapedia.net) | lab genetic/chemotype | Free-ish | check ToS | spot-verify genetics, not bulk |
| strain-database.com | claims 51k + terpene API | "free" | **unverified** | investigate before relying |
| Strainpedia API | structured strain data | ~$50/mo | paid | fallback if free too thin |

**First action of Layer 1 is to vet the chosen source** — confirm the license
file, check field coverage against our 222, and spot-check accuracy on 10 known
strains before importing anything.

## 9. Accuracy & compliance guardrails

- **Nothing auto-publishes.** Imports and AI drafts land in the Review Queue.
- **Provenance on every field.** `dataSources` records origin + date.
- **Trust-ranked merges.** Lab/menu data overrides dataset overrides AI.
- **No medical claims.** Keep the CI taxonomy test as the backstop; effect
  descriptors only.
- **Cite, don't copy.** We store facts (lineage, terpene names) with source
  attribution, not wholesale text from ToS-protected sites.
- **"Informational only" + age-gate** stay on every surface.

## 10. Cost

| Item | Cost |
|---|---|
| Kushy dataset (Layer 1) | $0 (MIT) |
| Menu-sync capture (Layer 2) | $0 (already fetching) |
| AI drafts (Layer 3) | $0 at this volume (your existing plans) |
| Engineering | our time |
| **Optional** paid API (Strainpedia) | $50/mo — only if free coverage is insufficient |

## 11. Phased rollout (recommended order)

1. **Schema** ✓ — optional `lineage`/`terpenes`/`thc`/`cbd`/`dataSources` + CI guard.
2. **Layer 1 (Kushy)** ✓ — `scripts/enrich-strains.mjs` → `data-review/` proposals.
3. **Layer 2 (menu)** ✓ — adapter captures terpenes/THC/effects; sync returns `enrichment[]`.
4. **Consolidation** ✓ — `scripts/apply-enrichment.mjs` merges reviewed proposals → strains.json.
5. **Tag Head/Body High** from enriched data + add matcher weights. *(next)*
6. **Render** ✓ — genetics line + terpene chips on cards + SEO pages.
7. **Layer 3** ✓ — `scripts/draft-research.mjs` (prompt pack + sanitizing ingest).

Each phase is shippable on its own and improves cards immediately.

## 12. Verification / success criteria

- CI green: schema test passes; no off-taxonomy effects; no medical claims.
- Coverage metric: % of 222 strains with lineage, with ≥1 terpene, with
  Head/Body High where warranted — tracked before/after each layer.
- Spot-check: 10 known strains audited by hand against the enriched data.
- No regression: existing cards/matcher behave identically for un-enriched
  strains (all new fields optional).

## 13. Decisions (resolved 2026-06-19)

1. **Source vetting:** ✅ Vet Kushy first (done — see Layer 1 vetting result).
   Outcome: use it narrowly (lineage + flavors for classic strains), not as a
   terpene or modern-strain source.
2. **Terpene depth:** ✅ **Full profile with percentages** where available —
   `terpenes: [{ name, dominant?, pct? }]`. (So terpene data flows from menu /
   AI, since Kushy has none.)
3. **AI drafting (Layer 3):** ✅ Approved — AI-proposed profiles allowed in the
   Review Queue, human-approved before publish.
