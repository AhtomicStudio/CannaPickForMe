# CannaPickForMe — Deep UX/UI Re-Audit (April 2026)

Benchmarked against Leafly, Weedmaps, Jane, Eaze (cannabis) and Calm, Headspace, Noom, Co-Star, Finch (consumer wellness/delight) as of early 2026.

Tone: honest, specific, not sugarcoated. Assume the reader ships code.

---

## 1. Age Gate / Disclaimer

**Working:** Two-step gate (age → disclaimer) is legally defensible and matches category convention. Clean typography, focused single-action screen, no distractions.

**Substandard:**
- No region/state selector. Leafly/Weedmaps both capture state on age gate to tailor legal messaging and product visibility. You can't ship real commerce without this — and once you add it, it's also a useful piece of personalization data.
- "Are you 21+?" is binary and boring. The field standard now is a DOB spinner with remembered device flag, which feels slightly more serious and is less trivially defeated.
- No brand moment. The age gate is the very first impression and yours is a functional shrug. Compare to Leafly's slow-fading leaf or Eaze's big wordmark.

**Missing:**
- "Remember my choice on this device" checkbox — users re-gate every visit and it's annoying.
- Compliance footer (link to Terms, Privacy, CA prop-65 if applicable).
- Accessible keyboard handling: tab order is fine but there's no visible "skip" path for returning users.

---

## 2. Home / Landing

**Working:** The cherry-ember backdrop + floating leaves + logotype hierarchy is genuinely on-trend. This is one of the strongest screens. The hero CTA ("Find My Strain") is unambiguous and the color/contrast is correct. Theme-aware backgrounds are a delight moment competitors don't do.

**Substandard:**
- The home screen is essentially a splash page with one button. Modern home screens are **dashboards** — last pick, streak, CannaGuy mood, "continue where you left off", quick-tap to Stash. You're wasting the most valuable real estate on a launcher.
- Secondary actions (Stash, Profile, Game) are buried in icon-sized affordances that don't read as equal citizens to the hero CTA. New users don't discover the game or stash until they finish a quiz.
- No social proof, no "X picks made today", no sense of community or aliveness. Leafly puts strain-of-the-day and recent activity front and center.
- Bottom links (About / Lore / Legal) are now safe-area-correct but still feel like afterthoughts visually — small, underlined, unstyled compared to everything above.

**Missing:**
- Personalized "Welcome back, Adam" + last session recap (you're already storing sessionHistory).
- A "Quick Pick" shortcut that re-runs the last quiz answers — one-tap re-roll is the killer feature here.
- Streak/usage indicator ("3 picks this week 🔥") — wellness apps bury users in these because they work.
- Push-style nudges: "Your CannaGuy hasn't been fed in 6 hours" as an inline chip, not a modal. Finch and Duolingo do this beautifully.

---

## 3. Quiz / Session Flow

**Working:** The radio-pill pattern is clean, the 4-question pacing feels right, and the cherry-ember progress indicator is genuinely novel. No other cannabis app has a signature progress visual.

**Substandard:**
- Every question is the same pattern (pill buttons). Top-tier quiz flows vary input types — slider for intensity, multi-select for "all that apply", quick-tap emoji scale for mood. Typeform, Co-Star, and BetterHelp all do this. Variety = engagement.
- No way to skip a question or say "no preference". This produces biased matches for users who genuinely don't care about one axis.
- No back button state memory. If you back out mid-quiz, the next entry restarts from Q1. (Verify this — if fixed, strike it.)
- The transition between questions is a plain opacity fade. A horizontal slide or card-stack would reinforce "progression" and feel more tactile.

**Missing:**
- Progress count ("2 of 4") as explicit text, not just embers. People like to see a fraction.
- Haptic feedback on selection (`navigator.vibrate(10)`) on supported devices — massive perceived-quality lift for zero effort.
- Mid-quiz encouragement: after Q2, a tiny CannaGuy speech bubble ("almost there"). You already have the infrastructure.
- Celebratory micro-moment at quiz completion before the weighing starts — confetti, a bloom, *anything* to mark the threshold.

---

## 4. Weighing / Reveal

**Working:** The scales + smoke reveal is the single best moment in the app. It has theater. It justifies the wait. This is your "oh cool" screenshot for App Store listings.

**Substandard:**
- The Magic 8-Ball animation feels inconsistent with scales-and-smoke. Pick a metaphor and commit. Scales-only is more premium; 8-ball is more playful. Mixing reads as "we couldn't decide".
- Weighing animation is locked to ~fixed duration. Users who've seen it 20 times want to skip. There's no "tap to reveal" shortcut.
- Reveal card typography is dense — name, type, effects, flavors, match score, THC/CBD, grow info, description, sponsored slot all stacked without strong hierarchy. The match score should dominate (it's the payoff); everything else is supporting.
- Sponsored strain card + ad banner on the same screen. Ads I understand, but back-to-back feels aggressive. Consider alternating: show the sponsored strain OR the ad banner per session, not both.

**Missing:**
- Share sheet. You have shareCard.js — where's the primary "Share your match" CTA on the reveal screen? Make it prominent. Every result is a potential viral post.
- "Why this match?" expandable — show the 2-3 reasoning tags that drove the score ("high match on mood → uplifting, flavor → citrus"). Builds trust, teaches users the system.
- Rate-the-pick feedback thumbs — you're collecting zero quality signal right now. Even a "did this match your vibe?" yes/no trains your algorithm and gives users agency.
- Save-to-stash as a first-class reveal action, not buried under a secondary icon.

---

## 5. Browse / Stash

**Working:** Multi-select filter panels with chips are best-in-class. Search + filter + sort are all present and keyboard-accessible. The strain-row layout with type-dot is clean.

**Substandard:**
- Filter chips show applied filters but you have to scroll to see the filter panel to remove them. "Chip = remove" convention is expected — tapping an applied chip should remove it inline.
- No empty state illustration. "No strains match" is currently just text; this is a missed delight moment. A tiny CannaGuy shrug would be perfect here.
- Sort header and "Done" bar at bottom compete visually — two bars sandwiching the list, eats ~30% of mobile height. Merge sort into the filter panel header.
- Strain rows don't communicate density (how many effects match, THC range, grow difficulty) at a glance. Every row looks the same priority. Leafly uses a subtle colored bar or percentage indicator.
- No way to see which strains are already in your stash from the browse view. Add a small stash-dot on already-saved strains.

**Missing:**
- Bulk actions: swipe-to-add, long-press to multi-select, then "Add 5 to Stash".
- Recently viewed strains (cookie/storage-backed).
- Recommended-for-you ribbon at the top of browse, driven by stash + history.
- Strain detail view is apparently absent — tapping a row should open a rich detail screen with grower notes, community rating, related strains. This is table stakes for cannabis apps in 2026.

---

## 6. Stash

**Working:** Local-first approach is respectable and privacy-sensible. Custom strain entry is a genuine competitive edge — Leafly doesn't let users track strains not in their DB.

**Substandard:**
- No stash-level analytics. What are your favorite types? What effects dominate your stash? Top flavors? This is a gold mine of insight you're not surfacing. Spotify Wrapped your stash.
- No notes or ratings per strain in stash. Users want to remember "the one from Trulieve, clicked hard, saved for evening".
- No photo attachment. Every cannabis power user takes photos. Locally-cached blob storage is cheap and would radically increase sticky engagement.
- Stash and browse use the same row template — confusingly similar. Stash rows should feel richer (personal notes preview, last-smoked date, rating stars).

**Missing:**
- Import/export (JSON or CSV) — your users will want to migrate data and your privacy-forward users will want receipts.
- "Rotate through my stash" quick pick — random strain from stash for tonight.
- Tags (e.g. "sleep", "creative", "social"). Users self-organize better than rigid categories.
- Sharing a single stash entry as a public card (link-out for IG).

---

## 7. Profile / Settings

**Working:** Three-tab split (Activity / Themes / Settings) is a clean information architecture. The activity stats strip is a good touch (Sessions, Perfect Match, Top Pick). Theme cards with emoji previews are on-brand and fun.

**Substandard:**
- "Perfect Match %" and "Top Pick" without any context-of-time feel static. Add "this month" / "all time" toggle so the stats breathe.
- Settings tab is sparse — just companion toggle + destructive actions. Compare to Headspace's 15+ preference rows. You're not offering enough knobs.
- Theme previews show 3 emojis in a row — pretty, but doesn't convey how the theme actually changes the *app*. A tiny card-preview thumbnail would be far more persuasive and bump theme adoption.
- "Delete Account" sits in a danger zone — good — but the flow after recent-login required isn't handled in-modal (user has to sign out and back in manually). That's a known friction point.

**Missing:**
- Notification preferences (when push is added, this needs to exist).
- Data export ("Download my data") — GDPR-useful, competitive differentiator.
- Sign-out button (it's not in the profile screen at all — is this intentional?).
- Appearance options beyond themes: font size, motion reduction is handled by OS but no in-app override, haptics toggle.
- Account email / username prominently displayed — currently you see it nowhere on the profile screen.

---

## 8. About / Lore

**Working:** Lore is a genuine brand differentiator. Having a world is something Leafly and Weedmaps will never have. Keep investing here.

**Substandard:**
- These screens feel unfinished relative to the rest of the app — long prose blocks, no imagery, no chapter nav, no animation. If Lore is a differentiator, it should look expensive. Right now it reads as a README.
- "About" is bone-dry version/copyright info. Should include team/mission/"why we built this" to humanize the brand.

**Missing:**
- Illustrated chapter headers for Lore.
- Progress tracking ("You've read 3 of 7 chapters") — Duolingo lesson pattern.
- Lore-unlocks tied to game/companion progression — leveling up CannaGuy unlocks the next chapter. This creates a real reason to engage the game.
- Share-a-quote-from-Lore card (re-use the shareCard infrastructure).

---

## 9. CannaGotchi / Game

**Working:** Novel concept, decent pixel-art direction, evolution mechanic. Nothing in the cannabis category has this. It is the thing that makes this app genuinely weird and lovable.

**Substandard:**
- Game stats (hunger, mood, etc. — whatever the specific metric model is) aren't explained anywhere. New users don't know what they're looking at.
- Tap-to-pet is the only interaction. Feed/play should be distinct verbs with their own animations and meaningful differences in effect.
- The viewport framing (scanlines, CRT feel?) clashes with the glassmorphic rest of the app. Commit to CRT everywhere or soften the scanlines in-viewport.
- No progression dashboard — "You're 30% to the next evolution" as a progress bar. Games run on this; yours doesn't.

**Missing:**
- A mini-game. Literally anything — rolling a joint, catching leaves, watering a plant. Gives users reason to return when their CannaGuy is healthy.
- Achievements/badges (first pick, 10-strain stash, 7-day streak, fed CannaGuy daily for a week). Bind these to Lore unlocks.
- Daily "check in with your CannaGuy" push (once notifications exist).
- Friend/social system — trade or visit friends' CannaGuys. Not urgent, but the foundation for viral growth.

---

## 10. Persistent Companion

**Working:** The companion is now genuinely lovable. Tap-disappear bug is fixed, he reacts to events, size is better, bubbles work. The idle attention nudge is a great touch.

**Substandard:**
- He still sits in the same corner every screen. Consider letting him "walk" between positions on route change — tiny delight, big personality payoff.
- Speech bubbles are functional but their copy is largely placeholder/generic. This is where voice and tone make or break the brand. Hire (or spend an afternoon) writing 40-50 variant bubbles per event type with brand voice locked down.
- He's the same mascot whether you've leveled him up or not. Stash the companion's evolution state — a newly-hatched CannaGuy should look different from a mature one, even in the floating companion.

**Missing:**
- Long-press for a "quick menu" on the companion (feed, pet, check stats, go to game screen) — turns him into a universal navigation element.
- Hide-on-scroll behavior — he overlaps content on long-scroll screens. Auto-fade during downward scroll, return on up-scroll. Standard mobile pattern.
- Accessibility: he has no aria-label explaining his role, and screen readers will narrate bubble text without context.

---

## 11. Modals

**Working:** Consistent modal system, confirm/cancel pattern, destructive tone styling. Better Matches modal is genuinely useful. Account modal states (signedout/linksent/confirmemail/signedin) are thoughtful.

**Substandard:**
- Too many modals, especially around stash flow. Custom-strain, override, better-match all interrupt the main task. Consolidate where possible into inline bottom-sheet patterns (modern iOS/Android convention).
- Modals appear with a scale+fade — fine, but they come from nowhere. Bottom-sheet style (slide up from bottom) is both more mobile-native and feels less intrusive.
- No backdrop tap to dismiss on some modals (check each) — that's a regression vs. platform conventions.
- Stash-tip modal on first use is a good instinct, but it's a dialog where it could be a coach-mark pointer (ghost overlay + arrow). Much less disruptive.

**Missing:**
- Undo toast after destructive confirm ("Session history cleared — Undo"). You have the history, so undo is ~10 lines of code.
- Dismiss-via-swipe-down on mobile (standard bottom-sheet gesture).
- Focus return after modal close — verify focus returns to the invoking element for a11y.

---

## 12. Toasts

**Working:** Toast service exists, ties into companion reactions, has success/error/info tones. Good foundation.

**Substandard:**
- Single-line only — no action button inside toasts. Modern toasts are mini-actionable ("Added to Stash · Undo" / "View").
- Position is fixed bottom — competes with the companion and bottom nav. Stack rules when multiple toasts fire in quick succession are unclear.
- Timing is probably too fast for longer messages and too slow for confirmations. Dynamic duration based on content length is standard.

**Missing:**
- Queueing with visual stack (at most 2 visible, rest queued).
- Rich toasts with emoji/icon + action button + optional inline progress.
- Toast history / notification center — users want to see what they missed.

---

## 13. Navigation

**Working:** Bottom nav for About/Lore/Legal is safe-area-correct now. Routing is clean. Back buttons exist where they should.

**Substandard:**
- No primary bottom tab bar. Home/Stash/Browse/Profile live inside the home screen as secondary affordances. This is a fundamental IA problem — every modern mobile-first app has persistent bottom tabs, and you don't. It's the single biggest structural gap vs. Leafly/Weedmaps.
- Back navigation sometimes relies on custom in-screen back buttons, sometimes on browser back. Inconsistent and confusing.
- No breadcrumb / screen-title bar — users don't always know where they are.

**Missing:**
- Persistent primary tab bar (Home / Browse / Stash / Game / Profile) — this is the #1 structural change the app needs.
- Deep-link support (share a strain detail URL and it opens to that screen).
- In-app search across strains + stash + lore, accessible from a top search icon.

---

# Prioritized Roadmap

## Quick wins (<30 min each) — ship this sprint

1. **Chip = remove convention** in filter bar. Already-applied filter chips should be tappable to remove.
2. **"Quick Pick" shortcut** on home — button that re-runs last quiz answers.
3. **Undo toast** after "Clear Session History" and other destructive actions.
4. **Haptic feedback** (`navigator.vibrate(10)`) on quiz selections and major actions.
5. **Empty-state illustrations** with tiny CannaGuy — browse no-results, empty stash, empty history.
6. **"Why this match?" expandable** on reveal card — just surface the top 2-3 score contributors.
7. **Explicit progress text** ("Question 2 of 4") in quiz — alongside the embers.
8. **Sign-out button** on profile screen. (Currently missing — this is embarrassing.)
9. **Account email prominently displayed** on profile screen.
10. **Stash-dot badge** on browse rows that are already in your stash.
11. **Remember age gate** on device — checkbox.
12. **Skip button** on weighing animation for returning users ("tap to reveal").
13. **Share button** prominently on reveal screen, not buried.
14. **Dynamic toast duration** — 2.5s for short, 5s for longer copy.
15. **Merge sort into filter panel header** — reclaim bottom real estate.

## Medium lifts (<2hr each) — next 2-3 sprints

1. **Primary bottom tab bar** — Home / Browse / Stash / Game / Profile. This is the single highest-leverage change in the app.
2. **Strain detail screen** — rich view on row tap with description, grow info, related strains, rating.
3. **Bottom-sheet modal pattern** for stash flows — replaces centered dialogs with slide-up sheets, dismiss-by-swipe.
4. **Home screen dashboard rework** — last pick, streak, CannaGuy mood, quick pick, stash summary. Stop using home as a splash.
5. **Stash-level analytics** — favorite types, top effects, top flavors, most-saved time period.
6. **Rate-the-match thumbs** on reveal — binary feedback stored per session.
7. **Variety in quiz input types** — slider + multi-select + emoji scale mixed with pills.
8. **Achievements system** — 6-8 starter badges (first pick, full stash, 7-day streak, CannaGuy cared for X days).
9. **State/region selector** on age gate — needed for any real commerce/location features.
10. **Notes + rating + photo per stash entry** — localStorage + IndexedDB blob for photos.
11. **Hide-on-scroll** for companion.
12. **Long-press quick menu** on companion — feed/pet/stats/game.
13. **Accessibility pass** — aria-labels, focus-return after modal close, screen-reader narration for companion.
14. **Lore chapter illustrations** + progress tracking + per-chapter quote-share card.
15. **Import/export stash** (JSON) — differentiates on privacy.

## Big bets — major features / redesigns

1. **Full social layer** — friends, shared stashes, CannaGuy visits, "strains your friends rated highly". This is how you become viral vs. a nice one-shot.
2. **Mini-game inside CannaGotchi** — rolling a joint, watering a plant, catching leaves. Needed to make the game a reason-to-return rather than a novelty.
3. **Rich strain database expansion** with community ratings, reviews, photos — either via API partnership or user-generated. Currently your DB is the ceiling of the product.
4. **Commerce integration** — dispensary availability by zip, "find this strain near you", affiliate links. Leafly's moat. Needed to be a real business.
5. **Push notifications** (companion nudges, daily pick, strain drops in your area). Requires a service worker, backend, and content strategy.
6. **Full mobile-native app** via Capacitor/Tauri — biometric unlock, true haptics, OS push, app store presence. The PWA ceiling is real.
7. **Onboarding redesign** — 3-4 screens post-age-gate introducing the product, collecting baseline preferences, and meeting your CannaGuy. First-run experience is currently nonexistent.
8. **Brand voice document + copy overhaul** — the UX writing is the weakest layer of the app and also the cheapest to fix if you commit. Hire a writer for 2 weeks or spend a focused week yourself.

---

# Benchmark Summary

| Axis | CannaPickForMe today | Leafly/Weedmaps | Delta |
|---|---|---|---|
| Visual polish | 8/10 | 7/10 | **You're ahead.** Keep pressing. |
| Motion/delight | 7/10 | 5/10 | **You're ahead.** Biggest moat. |
| IA/navigation | 4/10 | 8/10 | **Behind.** Fix with tab bar. |
| Data depth | 3/10 | 9/10 | **Far behind.** Need partnership/API. |
| Personalization | 4/10 | 6/10 | **Behind.** Dashboard + quick pick. |
| Community/social | 1/10 | 7/10 | **Far behind.** Big bet. |
| Accessibility | 5/10 | 7/10 | **Behind.** Medium effort. |
| Brand/voice | 7/10 | 4/10 | **You're ahead.** Lean into Lore + CannaGuy. |

**The story:** You are building a product that feels better than the incumbents but is structurally less complete. Your moat is brand/delight/motion. Your gap is IA/data/community. The quick wins are shockingly impactful given the current state; the medium lifts define whether this becomes a daily-use app; the big bets decide whether it's a business.

Keep the delight. Fix the structure. Earn the data.
