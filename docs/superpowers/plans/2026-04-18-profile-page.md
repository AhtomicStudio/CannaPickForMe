# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen profile page with Activity, Themes, and Settings tabs, a cannabis leaf monogram avatar on the home screen, and a seven-theme ambient animation system.

**Architecture:** New SPA screen (`profile-screen`) added to `index.html` following the existing screen pattern. A new `profile.js` module handles all profile tab logic, imported by `main.js`. A new `themeService.js` handles theme persistence (localStorage + Firestore sync). The theme system drives ambient background emoji changes via JS-swapped text content on the existing `.app-bg__leaf` spans, with CSS `data-theme` overrides for animation variants.

**Tech Stack:** Vanilla JS (ES modules), CSS custom properties, Firebase Firestore (existing), localStorage (existing pattern via `store.js`)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/storage/store.js` | Extend `addSessionEntry` with session answers; add THEME/LIGHT_MODE keys + helpers |
| Create | `src/services/themeService.js` | `applyTheme`, `saveThemePreference`, `loadThemeFromFirestore` |
| Modify | `src/services/userService.js` | Sync theme + lightMode to/from Firestore on sign-in |
| Modify | `src/main.js` | Leaf avatar, `showScreen('profile')`, pass `sessionAnswers` + `matchScore` to `addSessionEntry`, import `initProfile` |
| Create | `src/profile.js` | All profile screen logic (tabs, Activity, Themes, Settings) |
| Create | `src/profile.css` | Profile screen styles, stat bars, theme cards, settings items |
| Modify | `index.html` | Leaf avatar button, profile screen HTML shell |
| Modify | `src/style.css` | Leaf avatar styles, theme animation CSS overrides, light mode CSS |

---

## Task 1: Extend `store.js` — session entry schema + theme/lightMode helpers

**Files:**
- Modify: `src/storage/store.js`

The existing `addSessionEntry` accepts `{ strainId, name }`. We need it to also persist `mood`, `goal`, `intensity`, `vibe`, `matchScore` so the Activity tab can build stat charts. `getSessionHistory` and `clearSessionHistory` already exist — no changes needed there. We also add THEME and LIGHT_MODE keys.

- [ ] **Open `src/storage/store.js` and locate the KEYS object (line ~6)**

- [ ] **Add THEME and LIGHT_MODE keys to the KEYS object:**

```js
const KEYS = {
  STASH: 'cpfm_stash',
  CUSTOM_STRAINS: 'cpfm_custom_strains',
  EFFECT_OVERRIDES: 'cpfm_effect_overrides',
  DISPENSARY_OVERRIDES: 'cpfm_dispensary_overrides',
  AGE_VERIFIED: 'cpfm_age_verified',
  SESSION_HISTORY: 'cpfm_session_history',
  SYNC_AT: 'cpfm_sync_at',
  THEME: 'cpfm_theme',
  LIGHT_MODE: 'cpfm_light_mode',
};
```

- [ ] **Replace the existing `addSessionEntry` function (line ~152) with the extended version:**

```js
export function addSessionEntry(entry) {
  const history = getSessionHistory();
  history.unshift({
    strainId:   entry.strainId   ?? null,
    name:       entry.name       ?? null,
    mood:       entry.mood       ?? null,
    goal:       entry.goal       ?? null,
    intensity:  entry.intensity  ?? null,
    vibe:       entry.vibe       ?? null,
    matchScore: entry.matchScore ?? null,
    timestamp:  Date.now(),
  });
  if (history.length > 50) history.length = 50;
  setJSON(KEYS.SESSION_HISTORY, history);
  return history;
}
```

- [ ] **Add theme and lightMode helpers after `clearSessionHistory`:**

```js
export function getTheme() {
  return localStorage.getItem(KEYS.THEME) || 'default';
}

export function setTheme(key) {
  localStorage.setItem(KEYS.THEME, key);
}

export function getLightMode() {
  return localStorage.getItem(KEYS.LIGHT_MODE) === 'true';
}

export function setLightMode(on) {
  localStorage.setItem(KEYS.LIGHT_MODE, String(on));
}
```

- [ ] **Verify manually:** Open browser console, call `localStorage.setItem('cpfm_theme', 'fall')`, reload — key persists. No runtime errors in `store.js`.

- [ ] **Commit:**
```bash
git add src/storage/store.js
git commit -m "feat: extend session entry schema + add theme/lightMode store helpers"
```

---

## Task 2: Create `themeService.js`

**Files:**
- Create: `src/services/themeService.js`

Centralises all theme-apply logic. The ambient background uses twelve `.app-bg__leaf` spans in `index.html` whose text content is the emoji. Swapping theme = updating those spans + setting `data-theme` on `<html>` for CSS animation overrides.

- [ ] **Create `src/services/themeService.js`:**

```js
import { getTheme, setTheme, getLightMode, setLightMode } from '../storage/store.js';

const THEME_EMOJIS = {
  default:  ['🍃','🌿','🍃','🌿','🍃','🌿','🌿','🍃','🌿','🍃','🌿','🍃'],
  fall:     ['🍂','🍁','🍂','🍁','🌾','🍂','🍁','🍂','🍁','🌾','🍂','🍁'],
  love:     ['💕','💖','🌹','💕','💖','💕','🌹','💖','💕','🌹','💖','💕'],
  hallows:  ['🎃','👻','💀','🎃','👻','💀','🎃','👻','💀','🎃','👻','💀'],
  bubbles:  ['🫧','⚪','🔵','🫧','⚪','🫧','🔵','🫧','⚪','🔵','🫧','⚪'],
  fire:     ['🌿','🔥','💨','🌿','🔥','💨','🌿','🔥','💨','🌿','🔥','💨'],
  realfire: ['🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥','🔥'],
};

export const THEMES = [
  { key: 'default',  label: 'Default',   preview: ['🌿','💨','🔥'] },
  { key: 'fall',     label: 'Fall',      preview: ['🍂','🍁','🌾'] },
  { key: 'love',     label: 'Love',      preview: ['💕','💖','🌹'] },
  { key: 'hallows',  label: 'Hallows',   preview: ['🎃','👻','💀'] },
  { key: 'bubbles',  label: 'Bubbles',   preview: ['🫧','⚪','🔵'] },
  { key: 'fire',     label: 'Fire',      preview: ['🌿','🔥','💨'] },
  { key: 'realfire', label: 'Real Fire', preview: ['🔥','🔥','🔥'] },
];

function updateLeafEmojis(key) {
  const emojis = THEME_EMOJIS[key] || THEME_EMOJIS.default;
  document.querySelectorAll('.app-bg__leaf').forEach((el, i) => {
    el.textContent = emojis[i % emojis.length];
  });
}

export function applyTheme(key) {
  document.documentElement.setAttribute('data-theme', key || 'default');
  updateLeafEmojis(key || 'default');
}

export function applyLightMode(on) {
  document.documentElement.classList.toggle('light-mode', on);
}

export function loadSavedTheme() {
  applyTheme(getTheme());
  applyLightMode(getLightMode());
}

export async function saveThemePreference(key) {
  setTheme(key);
  applyTheme(key);
  // Firestore sync handled by userService after sign-in
}

export async function saveLightModePreference(on) {
  setLightMode(on);
  applyLightMode(on);
}
```

- [ ] **Import and call `loadSavedTheme()` in `main.js` near the top of the init block** (find the `init()` or `DOMContentLoaded` entry point):

```js
import { loadSavedTheme } from './services/themeService.js';
// ... at the start of init:
loadSavedTheme();
```

- [ ] **Verify manually:** Set `localStorage.setItem('cpfm_theme', 'fall')`, reload app — leaf emojis change to 🍂🍁.

- [ ] **Commit:**
```bash
git add src/services/themeService.js src/main.js
git commit -m "feat: add themeService with emoji swap + CSS data-theme system"
```

---

## Task 3: Add theme animation CSS overrides

**Files:**
- Modify: `src/style.css`

The default `.app-bg__leaf` floats upward (existing animation). Each theme variant overrides animation name and/or direction via `[data-theme]` attribute selector.

- [ ] **Append to the end of `src/style.css`:**

```css
/* ============================================================
   THEME SYSTEM — animation overrides per data-theme
   ============================================================ */

/* Fall: leaves drift downward */
[data-theme="fall"] .app-bg__leaf {
  bottom: auto;
  top: -5vh;
  animation-name: app-leaf-fall;
}
@keyframes app-leaf-fall {
  0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
  5%   { opacity: var(--op, 0.20); }
  50%  { transform: translateY(55vh) translateX(var(--dx, 12px)) rotate(180deg); }
  95%  { opacity: var(--op, 0.20); }
  100% { transform: translateY(112vh) translateX(calc(var(--dx, 12px) * 2)) rotate(360deg); opacity: 0; }
}

/* Hallows: slow spooky sway */
[data-theme="hallows"] .app-bg__leaf {
  animation-name: app-leaf-spooky;
}
@keyframes app-leaf-spooky {
  0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
  5%   { opacity: var(--op, 0.20); }
  25%  { transform: translateY(-25vh) translateX(15px) rotate(5deg); }
  50%  { transform: translateY(-55vh) translateX(-10px) rotate(-5deg); }
  75%  { transform: translateY(-80vh) translateX(10px) rotate(3deg); }
  95%  { opacity: var(--op, 0.20); }
  100% { transform: translateY(-112vh) translateX(0) rotate(0deg); opacity: 0; }
}

/* Bubbles: rise and pop */
[data-theme="bubbles"] .app-bg__leaf {
  animation-name: app-leaf-bubble;
}
@keyframes app-leaf-bubble {
  0%   { transform: translateY(0) scale(0.8); opacity: 0; }
  5%   { opacity: 0.35; }
  75%  { transform: translateY(-85vh) scale(1.3); opacity: 0.35; }
  100% { transform: translateY(-112vh) scale(0.1); opacity: 0; }
}

/* Fire: denser haze via stronger blob opacity */
[data-theme="fire"] .app-bg__haze {
  opacity: 1;
  filter: blur(70px) hue-rotate(40deg);
}
[data-theme="fire"] .app-bg__leaf {
  --op: 0.35;
}

/* Real Fire: fast flicker */
[data-theme="realfire"] .app-bg__leaf {
  animation-name: app-leaf-fire;
  animation-duration: calc(var(--dur, 15s) * 0.35) !important;
  --op: 0.55;
}
@keyframes app-leaf-fire {
  0%   { transform: translateY(0) scaleX(1); opacity: 0; }
  5%   { opacity: var(--op, 0.55); }
  50%  { transform: translateY(-55vh) scaleX(1.15); }
  95%  { opacity: var(--op, 0.55); }
  100% { transform: translateY(-112vh) scaleX(0.85); opacity: 0; }
}

/* Light mode overrides */
html.light-mode {
  --bg-primary: #f0f4f0;
  --bg-card: #ffffff;
  --bg-modal: rgba(0, 0, 0, 0.25);
  --text-primary: #1a2e1a;
  --text-muted: #5a6b5a;
  --border: rgba(0, 0, 0, 0.12);
}

html.light-mode .app-bg__haze {
  opacity: 0.3;
}
```

- [ ] **Verify manually:** In browser console run `document.documentElement.setAttribute('data-theme', 'fall')` — leaves should drift downward. Try `realfire` — leaves should flicker fast.

- [ ] **Commit:**
```bash
git add src/style.css
git commit -m "feat: add per-theme CSS animation overrides + light mode variables"
```

---

## Task 4: Pass session answers to `addSessionEntry` in `main.js`

**Files:**
- Modify: `src/main.js`

The result picker calls `addSessionEntry` with just `strainId` and `name`. We need to also pass `sessionAnswers` and `matchScore` so history rows and stat charts have real data.

- [ ] **Find the `addSessionEntry` call in `main.js` (inside `renderResult`):**

It currently reads:
```js
addSessionEntry({ strainId: pickedStrain.id, name: pickedStrain.name });
```

- [ ] **Replace with:**

```js
addSessionEntry({
  strainId:   pickedStrain.id,
  name:       pickedStrain.name,
  mood:       sessionAnswers.mood       ?? null,
  goal:       sessionAnswers.goal       ?? null,
  intensity:  sessionAnswers.intensity  ?? null,
  vibe:       sessionAnswers.vibe       ?? null,
  matchScore: matchScore,
});
```

(`sessionAnswers` and `matchScore` are already in scope inside `renderResult`.)

- [ ] **Verify manually:** Run a full pick session, then check `JSON.parse(localStorage.getItem('cpfm_session_history'))[0]` in the console — it should contain `mood`, `goal`, `intensity`, `vibe`, `matchScore` fields.

- [ ] **Commit:**
```bash
git add src/main.js
git commit -m "feat: persist session answers + matchScore in session history"
```

---

## Task 5: Leaf avatar — HTML + CSS

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`

A circular button with a faded 🌿 watermark. Signed-out state: gray + low opacity. Signed-in state: green border, user initials on top.

- [ ] **In `index.html`, add the avatar button as the first child of `#home-screen`** (before `home__header`):

```html
<div id="home-screen" class="screen home">
  <button id="btn-profile" class="profile-avatar profile-avatar--signed-out" aria-label="Open profile">
    <span class="profile-avatar__bg-leaf" aria-hidden="true">🌿</span>
    <span id="profile-avatar-initials" class="profile-avatar__initials"></span>
  </button>
  <!-- existing home__header, home__actions, etc. unchanged -->
```

- [ ] **Append leaf avatar CSS to `src/style.css`:**

```css
/* ============================================================
   LEAF AVATAR — home screen top-right profile button
   ============================================================ */
.profile-avatar {
  position: absolute;
  top: var(--space-lg);
  right: var(--space-lg);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--green-primary);
  background: rgba(74, 222, 128, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s var(--ease-out);
  z-index: 10;
  overflow: hidden;
  padding: 0;
}

.profile-avatar:hover {
  background: rgba(74, 222, 128, 0.22);
  transform: scale(1.05);
}

.profile-avatar--signed-out {
  border-color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
  filter: grayscale(1);
  opacity: 0.45;
}

.profile-avatar__bg-leaf {
  position: absolute;
  font-size: 1.75rem;
  line-height: 1;
  opacity: 0.18;
  user-select: none;
}

.profile-avatar--signed-in .profile-avatar__bg-leaf {
  opacity: 0.1;
}

.profile-avatar__initials {
  position: relative;
  z-index: 1;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--green-glow);
  letter-spacing: 0.05em;
  line-height: 1;
}
```

- [ ] **Make `#home-screen` position relative** — find `.home` or `#home-screen` in `src/style.css` and ensure it has `position: relative`. If `.screen` already has it, no change needed. Check with:

```bash
grep -n "position" src/style.css | head -20
```

If `.screen` does not have `position: relative`, add it to `.screen.home { position: relative; }` in `src/style.css`.

- [ ] **Verify manually:** Open app — a small circle button appears top-right of home screen, grayed out.

- [ ] **Commit:**
```bash
git add index.html src/style.css
git commit -m "feat: add leaf avatar button to home screen"
```

---

## Task 6: Leaf avatar — JS behavior + auth state

**Files:**
- Modify: `src/main.js`

Wire click handler and update avatar appearance based on auth state.

- [ ] **Add `getInitials` helper near the top of `src/main.js` (after imports):**

```js
function getInitials(email) {
  if (!email) return '';
  const local = email.split('@')[0];
  const parts = local.split('.');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
```

- [ ] **Add `updateProfileAvatar` helper in `src/main.js`:**

```js
function updateProfileAvatar(user) {
  const btn = document.getElementById('btn-profile');
  const initials = document.getElementById('profile-avatar-initials');
  if (!btn || !initials) return;

  if (user) {
    initials.textContent = getInitials(user.email);
    btn.classList.remove('profile-avatar--signed-out');
    btn.classList.add('profile-avatar--signed-in');
  } else {
    initials.textContent = '';
    btn.classList.add('profile-avatar--signed-out');
    btn.classList.remove('profile-avatar--signed-in');
  }
}
```

- [ ] **Add click handler for `btn-profile` in the home screen init block (near the `btn-stash` listener):**

```js
document.getElementById('btn-profile').addEventListener('click', () => {
  const user = getCurrentUser();
  if (!user) {
    // Open account modal — profile requires sign-in
    document.getElementById('account-modal').classList.remove('hidden');
    setAccountState('signedout');
    return;
  }
  renderProfileScreen();
  showScreen('profile');
});
```

- [ ] **Call `updateProfileAvatar` in both branches of the `initAuth` callback in `initAccountModal`** (the signed-in callback and signed-out callback):

```js
initAuth(
  async (user) => {
    authLinks.classList.add('hidden');
    if (resultCta) resultCta.classList.add('hidden');
    updateProfileAvatar(user);          // ← add this line
    modal.classList.add('hidden');
    // ... rest of existing signed-in handler unchanged
  },
  () => {
    authLinks.classList.remove('hidden');
    if (resultCta) resultCta.classList.remove('hidden');
    updateProfileAvatar(null);          // ← add this line
  }
);
```

- [ ] **Verify manually:** Sign in — avatar turns green with initials. Sign out — avatar grays out.

- [ ] **Commit:**
```bash
git add src/main.js
git commit -m "feat: wire leaf avatar click + auth state appearance"
```

---

## Task 7: Profile screen HTML shell

**Files:**
- Modify: `index.html`

Add the profile screen following the same pattern as stash-screen and result-screen.

- [ ] **Add the profile screen to `index.html` after the stash screen closing `</div>` (around line 186):**

```html
<!-- Profile -->
<div id="profile-screen" class="screen profile hidden">
  <div class="screen__header">
    <button id="profile-back" class="btn btn--icon">←</button>
    <h2>Profile</h2>
  </div>
  <div class="profile__tabs">
    <button class="tab tab--active" data-profile-tab="activity">Activity</button>
    <button class="tab" data-profile-tab="themes">Themes</button>
    <button class="tab" data-profile-tab="settings">Settings</button>
  </div>
  <div id="profile-activity-panel" class="profile__panel"></div>
  <div id="profile-themes-panel" class="profile__panel hidden"></div>
  <div id="profile-settings-panel" class="profile__panel hidden"></div>
</div>
```

Note: tabs use `data-profile-tab` (not `data-tab`) to avoid collision with the stash screen tab logic.

- [ ] **Verify markup:** Open browser, navigate to `showScreen('profile')` via console — blank screen with header and three tab buttons appears. No JS errors.

- [ ] **Commit:**
```bash
git add index.html
git commit -m "feat: add profile screen HTML shell with tab structure"
```

---

## Task 8: Profile screen CSS

**Files:**
- Create: `src/profile.css`
- Modify: `src/main.js` (import the CSS)

- [ ] **Create `src/profile.css`:**

```css
/* ============================================================
   PROFILE SCREEN
   ============================================================ */
.screen.profile {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.profile__tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.profile__tabs .tab {
  flex: 1;
  padding: 0.75rem 0.5rem;
  font-size: 0.82rem;
}

.profile__panel {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* ── Activity Tab ── */
.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.history-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.history-row__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.history-row__dot[data-type="indica"]  { background: #818cf8; }
.history-row__dot[data-type="sativa"]  { background: #4ade80; }
.history-row__dot[data-type="hybrid"]  { background: #fb923c; }

.history-row__name {
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.history-row__meta {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-align: right;
  line-height: 1.4;
}

/* ── Stat Charts ── */
.stats-section-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-top: var(--space-md);
}

.stat-section {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.stat-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  font-size: 0.9rem;
}

.stat-section__chevron {
  font-size: 0.75rem;
  color: var(--text-muted);
  transition: transform 0.25s;
}

.stat-section--open .stat-section__chevron {
  transform: rotate(180deg);
}

.stat-section__body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease;
}

.stat-section--open .stat-section__body {
  max-height: 500px;
}

.stat-section__content {
  padding: 0 var(--space-lg) var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.stat-bar-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-bar-row__label {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--text-primary);
}

.stat-bar-row__pct {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.stat-bar-track {
  height: 7px;
  background: rgba(255,255,255,0.07);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  width: 0%;
  transition: width 0.5s ease;
  background: var(--green-primary);
}

.stat-bar-fill--indica  { background: #818cf8; }
.stat-bar-fill--sativa  { background: #4ade80; }
.stat-bar-fill--hybrid  { background: #fb923c; }
.stat-bar-fill--mood    { background: #c084fc; }
.stat-bar-fill--picked  { background: #f59e0b; }

.stat-empty {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
  padding: var(--space-md) 0;
}

.perfect-match-rate {
  text-align: center;
  padding: var(--space-md) 0 var(--space-sm);
}

.perfect-match-rate__number {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--green-glow);
  line-height: 1;
}

.perfect-match-rate__label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 4px;
}

/* ── Themes Tab ── */
.themes-locked {
  text-align: center;
  padding: var(--space-xl) var(--space-lg);
}

.themes-locked__icon { font-size: 2rem; }

.themes-locked__text {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-top: var(--space-md);
  line-height: 1.5;
}

.themes-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.theme-card {
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  padding: var(--space-md);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  position: relative;
}

.theme-card--active {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
}

.theme-card__preview {
  display: flex;
  gap: 4px;
  font-size: 1.4rem;
  height: 32px;
  align-items: center;
  overflow: hidden;
}

.theme-card__name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
}

.theme-card__check {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 0.7rem;
  color: #f59e0b;
  font-weight: 700;
  opacity: 0;
}

.theme-card--active .theme-card__check {
  opacity: 1;
}

/* ── Settings Tab ── */
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-card);
  gap: var(--space-md);
  position: relative;
}

.settings-row__label {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
}

.settings-row__sub {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.settings-toggle {
  position: relative;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
}

.settings-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.settings-toggle__track {
  position: absolute;
  inset: 0;
  border-radius: 13px;
  background: var(--border);
  transition: background 0.2s;
  cursor: pointer;
}

.settings-toggle__track::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  top: 3px;
  left: 3px;
  transition: transform 0.2s;
}

.settings-toggle input:checked + .settings-toggle__track {
  background: var(--green-primary);
}

.settings-toggle input:checked + .settings-toggle__track::after {
  transform: translateX(18px);
}

.settings-toggle--disabled {
  opacity: 0.35;
  pointer-events: none;
}

.settings-badge {
  font-size: 0.65rem;
  background: var(--border);
  color: var(--text-muted);
  padding: 2px 6px;
  border-radius: var(--radius-full);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.settings-btn-row {
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-card);
}

.settings-divider {
  height: 1px;
  background: var(--border);
  margin: var(--space-lg) 0;
}

.settings-danger-zone {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.btn--settings-action {
  width: 100%;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.btn--settings-action:hover {
  border-color: var(--text-muted);
}

.btn--settings-action.btn--danger {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

.btn--settings-action.btn--danger:hover {
  background: rgba(248, 113, 113, 0.08);
  border-color: #f87171;
}

/* Bright Mode tooltip */
.settings-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: var(--space-lg);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;
  font-style: italic;
}

.settings-row:hover .settings-tooltip,
.settings-row:focus-within .settings-tooltip {
  opacity: 1;
}
```

- [ ] **Import `profile.css` in `src/main.js`** (add near top with other CSS imports):

```js
import './profile.css';
```

- [ ] **Verify:** No CSS parse errors in browser devtools.

- [ ] **Commit:**
```bash
git add src/profile.css src/main.js
git commit -m "feat: add profile screen CSS (tabs, history, charts, themes, settings)"
```

---

## Task 9: Create `profile.js` — shell + tab switching

**Files:**
- Create: `src/profile.js`
- Modify: `src/main.js`

- [ ] **Create `src/profile.js` with the shell:**

```js
import { getSessionHistory, clearSessionHistory, getTheme, getLightMode } from './storage/store.js';
import { THEMES, saveThemePreference, saveLightModePreference } from './services/themeService.js';
import { deleteAccount } from './services/userService.js';

let _getAllStrains;
let _getStash;

export function initProfile({ getAllStrains, getStash }) {
  _getAllStrains = getAllStrains;
  _getStash = getStash;

  document.getElementById('profile-back').addEventListener('click', () => {
    // showScreen imported via callback to avoid circular dep
    _onBack();
  });

  document.querySelectorAll('[data-profile-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-profile-tab]').forEach(t => t.classList.remove('tab--active'));
      tab.classList.add('tab--active');

      ['activity', 'themes', 'settings'].forEach(name => {
        document.getElementById(`profile-${name}-panel`).classList.toggle('hidden', name !== tab.dataset.profileTab);
      });

      renderTab(tab.dataset.profileTab);
    });
  });
}

let _onBack = () => {};
export function setProfileBackHandler(fn) { _onBack = fn; }

export function renderProfileScreen() {
  // Reset to activity tab
  document.querySelectorAll('[data-profile-tab]').forEach(t =>
    t.classList.toggle('tab--active', t.dataset.profileTab === 'activity')
  );
  ['activity', 'themes', 'settings'].forEach(name => {
    document.getElementById(`profile-${name}-panel`).classList.toggle('hidden', name !== 'activity');
  });
  renderTab('activity');
}

function renderTab(name) {
  if (name === 'activity')  renderActivityTab();
  if (name === 'themes')    renderThemesTab();
  if (name === 'settings')  renderSettingsTab();
}
```

- [ ] **Add `initProfile` call in `main.js`** near the bottom init block, and wire the back handler:

```js
import { initProfile, setProfileBackHandler, renderProfileScreen } from './profile.js';

// In init():
initProfile({ getAllStrains, getStash: getStashStrains });
setProfileBackHandler(() => showScreen('home'));
```

- [ ] **Expose `renderProfileScreen` to the `btn-profile` click handler** (update Task 6's click handler to call `renderProfileScreen()` before `showScreen('profile')`):

```js
document.getElementById('btn-profile').addEventListener('click', () => {
  const user = getCurrentUser();
  if (!user) {
    document.getElementById('account-modal').classList.remove('hidden');
    setAccountState('signedout');
    return;
  }
  renderProfileScreen();
  showScreen('profile');
});
```

- [ ] **Verify:** Clicking the leaf avatar (when signed in) opens the profile screen. Tabs switch panels. Back arrow returns to home.

- [ ] **Commit:**
```bash
git add src/profile.js src/main.js
git commit -m "feat: profile screen shell + tab switching"
```

---

## Task 10: Activity tab — Recent Picks list

**Files:**
- Modify: `src/profile.js`

- [ ] **Add `renderActivityTab` to `src/profile.js`:**

```js
function renderActivityTab() {
  const panel = document.getElementById('profile-activity-panel');

  const sessions = getSessionHistory();
  const allStrains = _getAllStrains();

  // ── Recent Picks ──
  let historyHTML;
  if (sessions.length === 0) {
    historyHTML = `<div class="empty-state">
      <span class="empty-state__icon">🌿</span>
      <p>No sessions yet.</p>
      <p class="empty-state__sub">Run your first pick to see history here.</p>
    </div>`;
  } else {
    const rows = sessions.map(s => {
      const strain = allStrains.find(st => st.id === s.strainId);
      const type = strain?.type || 'hybrid';
      const date = s.timestamp ? new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const metaLine = [s.mood, s.goal].filter(Boolean).join(' · ');
      return `<div class="history-row">
        <span class="history-row__dot" data-type="${type}"></span>
        <span class="history-row__name">${s.name || 'Unknown'}</span>
        <span class="history-row__meta">
          ${date}${metaLine ? `<br>${metaLine}` : ''}
        </span>
      </div>`;
    }).join('');
    historyHTML = `<div class="history-list">${rows}</div>`;
  }

  // ── Stats accordion ──
  const statsHTML = buildStatsHTML(sessions, allStrains);

  panel.innerHTML = `
    <div>
      <div class="stats-section-label">Recent Picks</div>
      ${historyHTML}
    </div>
    <div>
      <div class="stats-section-label">Your Stats</div>
      ${statsHTML}
    </div>
  `;

  // Wire accordion after innerHTML set
  wireAccordion(panel);
}
```

- [ ] **Verify:** Open Activity tab after running a pick — history row appears with strain name, date, mood/goal.

- [ ] **Commit:**
```bash
git add src/profile.js
git commit -m "feat: activity tab recent picks list"
```

---

## Task 11: Activity tab — stat chart data + accordion

**Files:**
- Modify: `src/profile.js`

- [ ] **Add `buildStatsHTML` and `wireAccordion` to `src/profile.js`:**

```js
function buildStatsHTML(sessions, allStrains) {
  const stashIds = _getStash().map(s => typeof s === 'string' ? s : s.id || s);
  const stashStrains = stashIds.map(id => allStrains.find(s => s.id === id)).filter(Boolean);

  const sections = [
    buildEffectsChart(stashStrains),
    buildFlavorsChart(stashStrains),
    buildTypeChart(stashStrains),
    buildMoodChart(sessions),
    buildMostPickedChart(sessions),
    buildPerfectMatchRate(sessions),
  ];

  return sections.map(s => `
    <div class="stat-section">
      <div class="stat-section__header">
        <span>${s.title}</span>
        <span class="stat-section__chevron">▾</span>
      </div>
      <div class="stat-section__body">
        <div class="stat-section__content">${s.content}</div>
      </div>
    </div>
  `).join('');
}

function wireAccordion(panel) {
  panel.querySelectorAll('.stat-section__header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.stat-section');
      const isOpen = section.classList.contains('stat-section--open');

      // Close all
      panel.querySelectorAll('.stat-section--open').forEach(s => s.classList.remove('stat-section--open'));

      if (!isOpen) {
        section.classList.add('stat-section--open');
        // Animate bars after max-height transition begins
        setTimeout(() => {
          section.querySelectorAll('.stat-bar-fill[data-pct]').forEach(bar => {
            bar.style.width = bar.dataset.pct + '%';
          });
        }, 50);
      }
    });
  });
}

function barRow(label, pct, colorClass = '') {
  return `<div class="stat-bar-row">
    <div class="stat-bar-row__label">
      <span>${label}</span>
      <span class="stat-bar-row__pct">${pct}%</span>
    </div>
    <div class="stat-bar-track">
      <div class="stat-bar-fill ${colorClass}" data-pct="${pct}"></div>
    </div>
  </div>`;
}

function buildEffectsChart(stashStrains) {
  const counts = {};
  stashStrains.forEach(s => (s.effectOverrides || s.effects || []).forEach(e => { counts[e] = (counts[e] || 0) + 1; }));
  const total = stashStrains.length;
  if (total < 2) return { title: 'Top Effects', content: `<p class="stat-empty">Add at least 2 strains to your stash to see this stat.</p>` };
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 6);
  return { title: 'Top Effects', content: top.map(([e, c]) => barRow(e, Math.round(c/total*100))).join('') };
}

function buildFlavorsChart(stashStrains) {
  const counts = {};
  stashStrains.forEach(s => (s.flavors || []).forEach(f => { counts[f] = (counts[f] || 0) + 1; }));
  const total = stashStrains.length;
  if (total < 2) return { title: 'Top Flavors', content: `<p class="stat-empty">Add at least 2 strains to your stash to see this stat.</p>` };
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 6);
  return { title: 'Top Flavors', content: top.map(([f, c]) => barRow(f, Math.round(c/total*100))).join('') };
}

function buildTypeChart(stashStrains) {
  const counts = { indica: 0, hybrid: 0, sativa: 0 };
  stashStrains.forEach(s => { const t = (s.type || 'hybrid').toLowerCase(); if (counts[t] !== undefined) counts[t]++; });
  const total = stashStrains.length;
  if (total < 1) return { title: 'Strain Type Split', content: `<p class="stat-empty">Add strains to your stash to see this stat.</p>` };
  const content = [
    barRow('Indica', Math.round(counts.indica/total*100), 'stat-bar-fill--indica'),
    barRow('Hybrid', Math.round(counts.hybrid/total*100), 'stat-bar-fill--hybrid'),
    barRow('Sativa', Math.round(counts.sativa/total*100), 'stat-bar-fill--sativa'),
  ].join('');
  return { title: 'Strain Type Split', content };
}

function buildMoodChart(sessions) {
  const counts = {};
  sessions.forEach(s => { if (s.mood) counts[s.mood] = (counts[s.mood] || 0) + 1; });
  const total = Object.values(counts).reduce((a,b) => a+b, 0);
  if (total < 3) return { title: 'Mood Breakdown', content: `<p class="stat-empty">Complete at least 3 sessions to see this stat.</p>` };
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const labels = { chill:'Chill', social:'Social', creative:'Creative', energetic:'Energetic', introspective:'Introspective' };
  return { title: 'Mood Breakdown', content: sorted.map(([m,c]) => barRow(labels[m] || m, Math.round(c/total*100), 'stat-bar-fill--mood')).join('') };
}

function buildMostPickedChart(sessions) {
  const counts = {};
  sessions.forEach(s => {
    if (!s.strainId) return;
    if (!counts[s.strainId]) counts[s.strainId] = { name: s.name, count: 0 };
    counts[s.strainId].count++;
  });
  const total = sessions.length;
  if (total < 3) return { title: 'Your Most Picked', content: `<p class="stat-empty">Complete at least 3 sessions to see this stat.</p>` };
  const top = Object.values(counts).sort((a,b) => b.count-a.count).slice(0, 5);
  const content = `<p class="stat-empty" style="margin-bottom:0.5rem;text-align:left;">From your sessions only</p>` +
    top.map(({ name, count }) => barRow(name, Math.round(count/total*100), 'stat-bar-fill--picked')).join('');
  return { title: 'Your Most Picked', content };
}

function buildPerfectMatchRate(sessions) {
  const withScore = sessions.filter(s => s.matchScore !== null && s.matchScore !== undefined);
  if (withScore.length < 3) return { title: 'Perfect Match Rate', content: `<p class="stat-empty">Complete at least 3 sessions to see this stat.</p>` };
  const perfect = withScore.filter(s => s.matchScore >= 80).length;
  const rate = Math.round(perfect / withScore.length * 100);
  return {
    title: 'Perfect Match Rate',
    content: `<div class="perfect-match-rate">
      <div class="perfect-match-rate__number">${rate}%</div>
      <div class="perfect-match-rate__label">of your sessions scored ≥ 80% match</div>
    </div>`
  };
}
```

- [ ] **Verify:** Open Activity tab with stash + history — stat sections appear. Tap a section — bar chart expands and bars animate. Tap another — first closes, second opens.

- [ ] **Commit:**
```bash
git add src/profile.js
git commit -m "feat: activity tab stat charts with accordion + animated bars"
```

---

## Task 12: Themes tab

**Files:**
- Modify: `src/profile.js`

- [ ] **Add `renderThemesTab` to `src/profile.js`:**

```js
function renderThemesTab() {
  const panel = document.getElementById('profile-themes-panel');
  const currentTheme = getTheme();

  const cards = THEMES.map(t => `
    <button class="theme-card ${t.key === currentTheme ? 'theme-card--active' : ''}" data-theme-key="${t.key}">
      <div class="theme-card__preview">${t.preview.join('')}</div>
      <div class="theme-card__name">${t.label}</div>
      <span class="theme-card__check">✓</span>
    </button>
  `).join('');

  panel.innerHTML = `<div class="themes-grid">${cards}</div>`;

  panel.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', async () => {
      const key = card.dataset.themeKey;
      await saveThemePreference(key);
      // Update active state without full re-render
      panel.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('theme-card--active', c.dataset.themeKey === key));
    });
  });
}
```

- [ ] **Verify:** Open Themes tab — 7 theme cards appear in a 2-column grid. Tap a card — ambient background emojis change instantly. Active card gets gold border.

- [ ] **Commit:**
```bash
git add src/profile.js
git commit -m "feat: themes tab — 7 theme cards with live preview and persistence"
```

---

## Task 13: Settings tab

**Files:**
- Modify: `src/profile.js`

- [ ] **Add `renderSettingsTab` to `src/profile.js`:**

```js
function renderSettingsTab() {
  const panel = document.getElementById('profile-settings-panel');
  const lightOn = getLightMode();

  panel.innerHTML = `
    <div class="settings-group">
      <div class="settings-row" id="bright-mode-row">
        <div>
          <div class="settings-row__label">Bright Mode</div>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" id="toggle-light-mode" ${lightOn ? 'checked' : ''} />
          <span class="settings-toggle__track"></span>
        </label>
        <div class="settings-tooltip">wtf what stoner uses light mode sus 👀</div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row__label">Email Alerts</div>
          <div class="settings-row__sub">Personalised picks and updates</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span class="settings-badge">Coming Soon</span>
          <label class="settings-toggle settings-toggle--disabled">
            <input type="checkbox" disabled />
            <span class="settings-toggle__track"></span>
          </label>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-btn-row">
        <button class="btn--settings-action" id="btn-clear-history">🗑 Clear Session History</button>
      </div>
      <div class="settings-btn-row">
        <button class="btn--settings-action" id="btn-reset-tips">Reset App Tips</button>
      </div>
    </div>

    <div class="settings-divider"></div>

    <div class="settings-danger-zone">
      <button class="btn--settings-action btn--danger" id="btn-delete-account-profile">Delete Account</button>
    </div>
  `;

  // Bright mode toggle
  document.getElementById('toggle-light-mode').addEventListener('change', e => {
    saveLightModePreference(e.target.checked);
  });

  // Clear history
  document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (!confirm('Clear all session history on this device? Your stash and account are not affected.')) return;
    clearSessionHistory();
    renderActivityTab(); // refresh Activity tab content
    const btn = document.getElementById('btn-clear-history');
    if (btn) { btn.textContent = 'History cleared ✓'; setTimeout(() => { btn.textContent = '🗑 Clear Session History'; }, 2000); }
  });

  // Reset tips
  document.getElementById('btn-reset-tips').addEventListener('click', () => {
    localStorage.removeItem('cpfm_stash_tip_shown');
    const btn = document.getElementById('btn-reset-tips');
    btn.textContent = 'Tips reset ✓';
    setTimeout(() => { btn.textContent = 'Reset App Tips'; }, 2000);
  });

  // Delete account
  document.getElementById('btn-delete-account-profile').addEventListener('click', async () => {
    const confirmed = confirm('This will delete your account and all cloud data. Your local stash stays on this device.');
    if (!confirmed) return;
    try {
      await deleteAccount();
      _onBack();
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        alert('For security, please sign out and sign back in before deleting your account.');
      } else {
        alert('Something went wrong. Please try again.');
      }
    }
  });
}
```

- [ ] **Verify:**
  - Toggle Bright Mode — app background lightens. Reload — setting persists.
  - Hover over Bright Mode row — tooltip appears.
  - Clear History — confirms, clears, Activity tab shows empty state.
  - Reset Tips — button text confirms, stash tip reappears on next stash visit.
  - Delete Account — confirms, calls `deleteAccount()`, returns to home.

- [ ] **Commit:**
```bash
git add src/profile.js
git commit -m "feat: settings tab — bright mode, clear history, reset tips, delete account"
```

---

## Task 14: Firestore user settings sync

**Files:**
- Modify: `src/services/userService.js`

On sign-in, load theme + lightMode from Firestore and apply them (overriding localStorage). On theme/lightMode change, `themeService` already calls `setTheme`/`setLightMode` locally — we only need to sync TO Firestore on change and FROM Firestore on sign-in.

- [ ] **Open `src/services/userService.js` and locate `loadAndResolveProfile` or the sign-in success handler.**

- [ ] **Import `applyTheme`, `applyLightMode` from themeService at the top of `userService.js`:**

```js
import { applyTheme, applyLightMode } from './themeService.js';
import { setTheme, setLightMode } from '../storage/store.js';
```

- [ ] **Add `syncSettingsFromFirestore` function in `userService.js`:**

```js
export async function syncSettingsFromFirestore(uid) {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase.js');
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const settings = snap.data()?.settings || {};
    if (settings.theme) {
      setTheme(settings.theme);
      applyTheme(settings.theme);
    }
    if (settings.lightMode !== undefined) {
      setLightMode(settings.lightMode);
      applyLightMode(settings.lightMode);
    }
  } catch (err) {
    console.warn('Failed to sync settings from Firestore:', err);
  }
}
```

- [ ] **Add `saveSettingsToFirestore` function in `userService.js`:**

```js
export async function saveSettingsToFirestore(uid, settings) {
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase.js');
    await setDoc(doc(db, 'users', uid), { settings }, { merge: true });
  } catch (err) {
    console.warn('Failed to save settings to Firestore:', err);
  }
}
```

- [ ] **Call `syncSettingsFromFirestore(user.uid)` inside `loadAndResolveProfile` (or the sign-in callback in `main.js`'s `initAuth` signed-in handler):**

In `main.js` signed-in callback, after the existing `loadAndResolveProfile` call:

```js
async (user) => {
  // ... existing code ...
  await loadAndResolveProfile(showConflictModal);
  // Sync settings (theme, light mode) from Firestore
  const { syncSettingsFromFirestore } = await import('./services/userService.js');
  await syncSettingsFromFirestore(user.uid);
  // ...
}
```

- [ ] **Update `saveThemePreference` in `themeService.js`** to call Firestore save:

```js
import { saveSettingsToFirestore } from './userService.js';
import { getCurrentUser } from './userService.js';

export async function saveThemePreference(key) {
  setTheme(key);
  applyTheme(key);
  const user = getCurrentUser();
  if (user) {
    await saveSettingsToFirestore(user.uid, { theme: key });
  }
}

export async function saveLightModePreference(on) {
  setLightMode(on);
  applyLightMode(on);
  const user = getCurrentUser();
  if (user) {
    await saveSettingsToFirestore(user.uid, { lightMode: on });
  }
}
```

- [ ] **Verify:** Sign in on device A, set theme to "Fall". Open app on device B (signed in same account) — Fall theme loads automatically.

- [ ] **Commit:**
```bash
git add src/services/userService.js src/services/themeService.js src/main.js
git commit -m "feat: sync theme + lightMode to/from Firestore on sign-in"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Leaf avatar — grayed signed-out, initials signed-in | Tasks 5, 6 |
| Profile screen with 3 tabs | Tasks 7, 9 |
| Activity — Recent Picks list | Task 10 |
| Activity — stat charts accordion (one at a time) | Task 11 |
| Charts: Top Effects, Top Flavors, Strain Type Split, Mood, Most Picked (personal), Perfect Match Rate | Task 11 |
| Themes — 7 themes, unlocked on sign-in | Task 12 |
| Themes — live preview cards, active state | Task 12 |
| Theme persists localStorage + Firestore | Tasks 1, 2, 14 |
| Settings — Bright Mode + tooltip | Task 13 |
| Settings — Clear History | Task 13 |
| Settings — Reset Tips | Task 13 |
| Settings — Email Alerts placeholder | Task 13 |
| Settings — Delete Account | Task 13 |
| Theme CSS animation variants (fall, hallows, bubbles, fire, realfire) | Task 3 |
| Light mode CSS | Task 3 |
| Firestore sync on sign-in | Task 14 |
| addSessionEntry extended with answers | Tasks 1, 4 |

All spec requirements covered. ✓
