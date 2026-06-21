# Profile Page Design
**Date:** 2026-04-18
**Project:** CannaPickForMe
**Status:** Approved, ready for implementation

---

## Overview

A full-screen profile page accessible via a cannabis leaf monogram avatar in the top-right corner of the home screen. The profile is gated behind account creation — signed-out users see a grayed-out leaf that opens the account modal instead. The profile has three tabs: Activity, Themes, and Settings.

Future path: the app will be wrapped in Capacitor for Play Store distribution. All design decisions should be mobile-first and touch-friendly.

---

## 1. Navigation & Avatar

### Leaf Monogram Button
- Positioned top-right of the home screen header
- Shape: cannabis leaf silhouette (SVG or CSS clip-path)
- **Signed out:** leaf rendered in muted gray (`var(--text-muted)`), no initials
- **Signed in:** leaf rendered in `var(--green-primary)` with the user's initials centered inside in white
- Initials derived from email: take the first letter before `@`, and the first letter after the last `.` before `@` if one exists (e.g. `twotales89@gmail.com` → **TT**, `jane.doe@email.com` → **JD**). Fall back to a single initial if pattern doesn't match.
- Tap when signed out → opens account modal with sign-in prompt
- Tap when signed in → `showScreen('profile')`
- Auth state listener updates leaf appearance in real time (no reload needed)

---

## 2. Profile Screen Structure

### Header
- Back arrow (←) top-left returns to home screen
- "Profile" title centered
- No additional controls

### Tabs
Three tabs rendered below the header using the existing `.tab` / `.stash__tabs` pattern:

```
[ Activity ]  [ Themes ]  [ Settings ]
```

Default active tab: **Activity**

---

## 3. Activity Tab

### 3a. Recent Picks
Scrollable list of past sessions, most recent first. Each row shows:
- Strain type color dot (indica = purple, sativa = green, hybrid = orange)
- Strain name (bold)
- Date picked (e.g. "Apr 17")
- Mood + Goal answers if available (stored from this update onward)

**Data change required:** `addSessionEntry()` in `store.js` must also save `{ mood, goal, intensity, vibe, matchScore }` alongside `{ strainId, name }`. Entries before this update show strain + date only.

Empty state: "No sessions yet. Run your first pick to see history here." with a 🌿 icon.

### 3b. Stat Charts (Accordion)
Below Recent Picks, a section labeled **"Your Stats"** with six expandable rows. Tapping a row title expands the bar chart; tapping again collapses it. **Only one chart open at a time** — opening a new one collapses any currently open chart.

Charts animate open/closed with a smooth CSS `max-height` transition.

**Chart list:**

| Title | Data source | Notes |
|---|---|---|
| Top Effects | User's stash strains (effects array) | Count occurrences across all stash strains |
| Top Flavors | User's stash strains (flavors array) | Count occurrences across all stash strains |
| Strain Type Split | User's stash strains (type field) | Indica / Hybrid / Sativa as % of stash |
| Mood Breakdown | Session history (mood answer) | Distribution across saved sessions |
| Your Most Picked | Session history (strainId + name) | Ranked by frequency, **personal only** — labeled "From your sessions" |
| Perfect Match Rate | Session history (matchScore) | % of sessions where matchScore ≥ 80. Shown as a single bold % + bar |

**Bar chart design:**
- Label on left, percentage on right, filled bar between
- Bar fill uses existing color tokens: green for effects/flavors, type colors for strain split, accent colors for mood
- Bars animate width from 0% on expand
- Minimum 3 sessions / 2 stash strains before charts render; otherwise show: "Add more strains to your stash" or "Complete more sessions to see this stat"

---

## 4. Themes Tab

### Access
- Signed in: full theme grid
- Signed out: grayed grid with overlay message "Sign in to unlock themes"

### Theme Cards
A 2-column grid of tappable cards. Each card:
- Theme name (bold)
- Mini live preview: 3 floating emojis animating in a small contained box (scaled-down version of the home screen animation)
- Active state: gold border + checkmark badge
- Inactive state: standard card border

### Theme Definitions

| Theme | Key | Emojis | Animation style |
|---|---|---|---|
| Default | `default` | 🌿 💨 🔥 | Slow drift, existing smoke haze |
| Fall | `fall` | 🍂 🍁 🌾 | Slow drift downward, gentle sway |
| Love | `love` | 💕 💖 🌹 | Float upward, slight wobble |
| Hallows | `hallows` | 🎃 👻 💀 | Slow spooky drift, slight flicker |
| Bubbles | `bubbles` | 🫧 ⚪ 🔵 | Rise steadily, scale up slightly then "pop" (fade out at top) |
| Fire | `fire` | 🌿 🔥 💨 | Dense, fast, heavy haze overlay |
| Real Fire | `realfire` | 🔥 🔥 🔥 | Fast upward flicker, high density |

### Theme Persistence
- Active theme stored in `localStorage` as `cpfm_theme`
- On sign-in, synced to Firestore under user profile doc (`users/{uid}/settings.theme`)
- On load, Firestore value takes precedence over localStorage if user is signed in
- Theme applied via `data-theme="<key>"` attribute on `<html>` element
- CSS selects which emoji set to render based on this attribute

---

## 5. Settings Tab

Items stacked vertically with section dividers.

### Bright Mode Toggle
- Toggle switch, label: "Bright Mode"
- Hover / long-press tooltip: *"wtf what stoner uses light mode sus 👀"*
- Tooltip dismisses on mouseout or tap outside
- When ON: adds `.theme-light` class to `<html>`, applies light CSS overrides
- Persists in `localStorage` as `cpfm_light_mode`

### Clear History
- Button: "Clear Session History"
- Confirm dialog: "This will delete all your session history on this device. Your stash and account are not affected."
- On confirm: clears sessions from localStorage, re-renders the Activity tab empty state
- Does NOT affect Firestore or account

### Reset Tips
- Small text link: "Reset app tips"
- Clears `cpfm_stash_tip_shown` from localStorage
- No confirmation needed — low-risk action
- Inline confirmation: link text briefly changes to "Tips reset ✓"

### Email Alerts (Coming Soon)
- Toggle switch, visually grayed out (`opacity: 0.4`, `pointer-events: none`)
- "Coming Soon" badge next to label
- No interactivity

### Delete Account
- Positioned at the bottom, separated by a divider
- Red-tinted destructive button: "Delete Account"
- Confirm dialog (matching existing language): *"This will delete your account and all cloud data. Your local stash stays on this device."*
- On confirm: calls existing `deleteAccount()`, navigates to home screen, shows signed-out state

---

## 6. Data Changes Required

| Change | Location | Purpose |
|---|---|---|
| Save mood/goal/intensity/vibe/matchScore in session entries | `store.js` → `addSessionEntry()` | Enables Mood Breakdown chart and richer history rows |
| Add `cpfm_theme` to localStorage | `store.js` or new `themeService.js` | Theme persistence |
| Add `cpfm_light_mode` to localStorage | Same | Bright mode persistence |
| Add theme + lightMode to Firestore user settings | `userService.js` | Cross-device theme sync |
| Derive initials from email | `main.js` | Leaf avatar display |

---

## 7. Out of Scope (Deferred)

- Default dispensary filter in Settings — deferred until live menu-to-strain matching is built
- Capacitor/Android packaging — future milestone, no action now
- Global leaderboards or social features
- Push notifications (Email Alerts placeholder covers future intent)
