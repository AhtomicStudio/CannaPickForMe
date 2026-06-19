# Menu Sources & Dispensary Onboarding

How CannaPickForMe pulls a dispensary's live in-stock menu, and how to add a new one without code.

## What we learned about Cookies Hayward
Cookies Hayward is **not** a standard `dutchie.com` menu. Their site is **WordPress + a "Dovetail"
plugin**, and the menu data (ultimately **Dutchie Plus**) is served from *their own* domain at:

```
https://cookiesdispensary.com/wp-json/dovetail-api/v1/products?retailer=hayward&repository=dutchie_plus&categories[]=premium-flower
```

It's public, needs no API key, is paginated (`results[]`, ~20/page, ~237 products), and each result's
top-level `name` is the strain. This is the cleanest possible no-key method — the exact data the menu
itself loads. (Confirmed live via the browser: 93 KB of real product JSON.)

**This is why earlier sync attempts failed** — the old script aimed at `dutchie.com`, but Cookies'
menu lives behind their Dovetail API.

## How the sync works now (adapter pattern)
Each dispensary gets a **`menuSource`** config. `api/sync-menu.js` dispatches to the right adapter
(`api/_menuAdapters.mjs`), normalises products to `{ name, brand, thc }`, and matches `name` against
`strains.json` — returning matched / unmatched. The weekly function (`refreshDispensaryMenus`) reads
each dispensary's `menuSource` and writes `menus/{id}` exactly as before, so **nothing downstream
changes**.

## Cookies Hayward setup (admin → 📍 Dispensaries → Edit "Cookies Hayward")
- **Menu URL:** `https://cookiesdispensary.com/hayward/shop/?category=premium-flower`
- **Menu source (JSON):**
  ```json
  {"provider":"dovetail","baseUrl":"https://cookiesdispensary.com","retailer":"hayward","categories":["premium-flower","flower"]}
  ```
- Leave **Dutchie Slug** blank. Save → then run `refreshDispensaryMenus` once (Cloud Scheduler →
  Run now) to seed the menu immediately.

## Onboard ANOTHER dispensary (config, not code)
In admin → Dispensaries, add the dispensary and set its **Menu source**:
- **Another Dovetail/Cookies-style site:** same JSON — just change `baseUrl` and `retailer`.
- **A direct dutchie.com menu:** leave Menu source blank, fill **Dutchie Slug** (existing path).
- **A new platform (Jane, Meadow, etc.):** add one adapter function in `api/_menuAdapters.mjs`
  (~30 lines, mirroring `fetchDovetail`) + one dispatch line. Then it's config from there.

The weekly job auto-discovers any dispensary that has a `menuSource` **or** a `dutchieSlug`. The
`menus/{id}` data shape is unchanged, so existing dispensaries and the app keep working.

## Real match check (Cookies live sample vs your 222 strains)
Already in your DB: **Nerdz, Kush Mints, Cereal Milk** (+ common Runtz, Gelato).
Not yet: **L'Orange, Gluetopia, Kush Mountains** (Cannabiotix house cuts) → these surface as
"unmatched" so you can add them. ~Half of a typical drop maps automatically.

## Name cleanup (done + verified)
Product names carry grow-type suffixes ("Nerdz - **Indoor**", "Animal Cookies - **Smalls**") and
trailing weights. The matcher now strips those to the core strain name, then matches **exact →
cleaned → longest contained name** (with a min-length guard so short names can't false-match). And
`sync-menu.js` was **unified onto this one shared, tested matcher** (it previously had a duplicate
copy that was never wired in).

Verified against the **real 222-strain DB** with real Cookies name formats: **11/15 sample products
matched** — e.g. `Nerdz - Indoor → Nerdz`, `Georgia Pie - Indoor → Georgia Pie`, `Animal Cookies -
Smalls → Animal Cookies`. The 4 misses (L'Orange, Gluetopia, Kush Mountains, Super Teds) are
boutique cuts genuinely not yet in the DB — they correctly surface as "unmatched / add". The
cleanup's win is **correctness** (picks *Animal Cookies* over a bare *Cookies*) and avoiding false
positives, which the unit tests cover.

## Verification status
- **Adapter logic: 31/31 unit tests green** (parser extracts only top-level strain names, ignores
  nested brand/deal/weight/cannabinoid names; pagination; brand/THC extraction — `test/menu-adapters.test.mjs`).
- **Live endpoint: confirmed** returning real data via the browser.
- The wiring (sync-menu dispatch, weekly function, admin field) compiles into your build — verify with
  `npm run build` + CI, since it can't run in the Cowork sandbox.
