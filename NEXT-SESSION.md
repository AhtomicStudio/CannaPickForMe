# Next Session — Build, Deploy, Verify

Everything built this session, in the order to ship it. Start here.

## 1) Deploy order (do this)
1. Open the project in AntiGravity → terminal → **`npm run build`**. Must finish with no errors —
   this is the real compile check (the Cowork sandbox couldn't run it).
2. **`npm test`** — the engine / filter / menu-matching tests should pass.
3. **Commit + push** (Source Control panel). Vercel auto-deploys the site + `/api`; GitHub **Actions**
   runs tests + build (watch it go green).
4. **`firebase deploy --only functions`** — ships the weekly menu auto-refresh (`refreshDispensaryMenus`).
5. **Firebase Console → Authentication → Sign-in method** → enable **"Email link (passwordless sign-in)"**
   (the admin login now uses it).

## 2) After deploy — config in `/admin`
- Sign in via the **magic link** button (or you're already in from the main app).
- **📍 Dispensaries → Edit "Cookies Hayward":** set **Menu URL** + paste the **Menu source** JSON
  (it's in `outreach-kit/MENU-SOURCES.md`). Save.
- **Menu Sync → 🔄 Sync Now → Confirm** → unmatched strains drop into the **Review Queue** to flesh out.
- **Campaigns → New:** Cookies advertiser, sponsored strain(s), "Sponsored Buy goes to" = Cookies,
  status **live**.

## 3) Verify on the live site
- Do a pick → **"📍 In stock at Cookies Hayward — Buy"** shows on in-stock strains.
- Strains screen → tap **Effect/Flavor** chips → they cycle **include ＋ → exclude － → clear**.
- Admin → a campaign's **📊 Report** opens a printable 1-pager.

## What changed this session (summary)
- **Dispensary "Buy near you"** click-out (result CTA + clickable in-stock pills, tracked).
- **Weekly menu auto-refresh** (Firebase scheduled function).
- **Pluggable menu sources** — Dovetail adapter so Cookies' real menu syncs (not just dutchie.com),
  config-driven per dispensary; **smarter strain-name matching** (strips "- Indoor", picks the right
  strain).
- **Sponsored Strain card** clickable + **advertiser attribution**.
- **Monthly partner report** (admin → 📊 Report).
- **Tri-state filter chips** (include / exclude / clear) for Effects & Flavors.
- **Magic-link admin login** (no password).
- **Test suite + GitHub Actions CI**; repo hygiene (package name, `.gitignore`).
- **Docs** in `/outreach-kit/`: `FIRST-PARTNER-PLAN`, `DISPENSARY-SYSTEM`, `DEPLOY-RUNBOOK`, `MENU-SOURCES`.

## Honest status
The **engine/logic is unit-tested and green** in the sandbox. The **UI, admin, and Firebase functions**
were carefully edited and compile into the build, but the Cowork sandbox can't run npm/the bundler —
so **`npm run build` + CI are the real verification**. If either goes red, paste me the error and I'll
fix it fast.

## Onboarding another dispensary later (no code)
Admin → Dispensaries → add it → set **Menu source** (same JSON, different `baseUrl`/`retailer` for a
Dovetail site; or a Dutchie slug for a direct dutchie.com menu). The weekly job picks it up
automatically. A brand-new platform (Jane, etc.) = one ~30-line adapter in `api/_menuAdapters.mjs`.
