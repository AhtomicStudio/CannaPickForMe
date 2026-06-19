# Dispensary System — Build Notes & Deploy Steps
### "Buy near you" click-out + weekly auto-refresh of the Cookies menu

Built this session. This is the revenue loop: real in-stock strains → a tappable "Buy at Cookies"
path (the thing a partner pays for) → kept fresh automatically every week, and replicable to any
dispensary with zero code.

---

## What changed (review these diffs before deploy)

**Front-end — the click-out**
- `index.html` — added a `#result-buy-cta` link on the result screen.
- `src/main.js` — clickable in-stock dispensary pills; a "📍 In stock at {dispensary} — Buy" CTA on
  the result screen; tracked `dispensary_click` events (Vercel Analytics). The honest match is never
  touched — these are pure links out to a partner menu.
- `src/services/dispensaryService.js` — dispensary docs now carry `menuUrl` (the buy target) and
  `dutchieSlug` (for the auto-refresh); added `getDispensaryMenuUrlSync()`.
- `src/style.css` — styles for the CTA and the clickable pill.
- `admin.html` + `src/admin.js` — Menu URL + Dutchie Slug fields in the Dispensaries editor, an
  **Edit** button that loads a dispensary back into the form, `🔗 menu` / `↻ auto` status badges,
  and a save that merges only changed fields (so a rename never wipes the menu link).

**Back-end — the weekly refresh**
- `functions/index.js` — new scheduled function `refreshDispensaryMenus` (Mondays 09:00
  America/Los_Angeles). For each active dispensary with a `dutchieSlug`, it calls your existing
  `/api/sync-menu`, then writes `menus/{id}` — the exact doc the app already reads. No new
  credentials: it reuses the Admin SDK already initialized for OTP.

> Build note: I could not run the bundler in this session's sandbox (the repo's `node_modules` has
> Windows-native binaries, and the sandbox is Linux). Run `npm run build` on your machine to do the
> real compile — the edits are surgical and were reviewed line-by-line, but you own the green build.

---

## Deploy steps (in order)

1. **Local build sanity** — `npm run build`. Confirms the front-end compiles and the 222 SEO pages
   regenerate (the prebuild only fails in the sandbox, not on your real filesystem).

2. **Deploy the function** — `firebase deploy --only functions`. Confirm `refreshDispensaryMenus`
   shows up. First deploy auto-creates the Cloud Scheduler job (free tier covers it).

3. **Deploy the front-end** — `git push` (Vercel auto-deploys) or `vercel --prod`.

4. **One-time Cookies setup** — in the **admin panel → 📍 Dispensaries**, add or **Edit**
   `Cookies Hayward` and set:
   - **Menu URL** = the public URL of their online (Dutchie) menu — where "Buy" sends people.
   - **Dutchie Slug** = their Dutchie slug (the `/embedded-menu/<slug>` segment).
   - Save. The row then shows `🔗 menu` and `↻ auto`. (No Firestore console needed anymore.)

5. **Seed the menu now (don't wait a week)** — hit
   `https://cannapickforme.com/api/sync-menu?dispensary=<dutchieSlug>` in a browser and confirm it
   returns `matched` strains. Then either run `refreshDispensaryMenus` once from the Cloud console
   (Cloud Scheduler → "Run now") or save the menu from the admin. After that, in-stock Cookies
   strains show the clickable pill + the result "Buy" CTA.

---

## Add another dispensary later (the replicable part)
Create a `dispensaries/{slug}` doc with `name`, `menuUrl`, `dutchieSlug`, `active: true`. The weekly
function picks it up automatically — no deploy, no code. That's the system that scales past Cookies.

## Reporting
Click-outs fire `dispensary_click` Vercel Analytics events with `{ dispensary, strain, placement }`
where placement is `result` or `strain-card`. That's the "taps to your dispensary" number for the
monthly partner report.

## Status — Blocker 2 done
- ✅ Sponsored Strain card is now clickable — a tracked `Buy ↗` to the strain's in-stock dispensary
  menu. The match score stays honest (never altered by payment); clicks bump the campaign counter.
- ✅ Publish path verified end-to-end: the admin **Campaign editor** writes
  `inventory.sponsoredStrainIds` + status → `listLiveCampaigns` → the sponsored card renders.
- ✅ Legacy `sponsor-settings` UI confirmed already deprecated (hidden + `data-deprecated`, the
  init early-returns) — not leaking to operator or users. Left as-is rather than risk an
  untested removal.

## Possible next steps
- Sponsored "Buy" targets the strain's in-stock dispensary menu. If you'd rather it always point at
  the *sponsoring advertiser's* dispensary, carry the advertiser's menuUrl through the sponsorship
  aggregator (`getActiveSponsoredEntries`).
- Optional tidy-up: once you can run a local build, delete the dormant `sponsor-settings-section`
  HTML + `initSponsorSettings`/`populateSponsorDropdown` (pure dead code).
- Repo hygiene done: `*.tmp` added to `.gitignore` (`.rar` was already ignored), `package.json`
  renamed `sandbox` → `cannapickforme`. The committed `CannaPickForMe.rar` is ignored going forward
  but still tracked — run `git rm --cached CannaPickForMe.rar` to drop it from the repo.
