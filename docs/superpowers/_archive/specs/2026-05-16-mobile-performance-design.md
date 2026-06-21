# Mobile Performance Overhaul — Design Spec
**Date:** 2026-05-16  
**Scope:** Full performance pass targeting slow load and runtime jank on all iPhones  
**Approach:** Option C — full overhaul (bundle splitting + animation tuning + Service Worker)

---

## Problem Statement

iPhone users across all device generations (iPhone X through iPhone 15) experience two compounded issues:
1. **Slow initial load** — white screen before anything renders
2. **Runtime jank** — stuttering animations after the app loads

Root causes identified:
- `strains.json` (108KB) bundled into the critical-path JS
- Firebase SDK (Firestore + Auth + Storage) loaded eagerly even for unauthenticated users
- Game module code included in the main bundle despite being behind dynamic imports in most paths
- 9,000+ lines of CSS loaded all at once
- 12 continuously-animating leaf elements + 3 haze divs with no compositor-layer hints
- 9 `backdrop-filter: blur()` calls with values up to `blur(16px) saturate(1.4)` — very expensive on iOS Safari
- Two Google Fonts families loaded without explicit `font-display` handling

---

## Section 1 — Bundle & Load Time

### 1a. Lazy-load Firebase
**Current:** `firebase.js` is a top-level import in `main.js`, pulling Firebase into the critical-path bundle.  
**Change:** Remove the static import. Replace with a `loadFirebase()` async helper that does `await import('./firebase.js')` on first call and caches the result. Call this helper only when the user initiates sign-in or when `initAuth()` is actually needed post-age-gate.  
**Files:** `src/main.js`, `src/services/userService.js`, `src/firebase.js`

### 1b. Vite manual chunk splitting
**Current:** `vite.config.js` has no `manualChunks` — Vite decides chunk boundaries automatically, and the game + Firebase code bleeds into the main chunk.  
**Change:** Add `build.rollupOptions.output.manualChunks` with three explicit groups:
- `chunk-firebase` — everything from the `firebase` npm package
- `chunk-game` — everything under `src/game/` and `src/animations/`
- `chunk-core` — everything else (age gate, home, matcher, router)

**Files:** `vite.config.js`

### 1c. Strains data fetch-after-paint
**Current:** `strains.json` (108KB) is imported statically in `main.js` via `import strainsData from './data/strains.json'`, which bundles it into the main JS chunk.  
**Change:**
- Remove the static import
- Move `strains.json` to `public/data/strains.json` so Vite serves it as a static asset (not bundled)
- After the age gate resolves, kick off `fetch('/data/strains.json')` and store the result in a module-level variable
- The "Pick For Me" button is already disabled by default — keep it disabled until the fetch resolves (add a `strainsReady` flag checked before enabling)
- Cache the parsed JSON in `sessionStorage` so navigating away and back doesn't re-fetch

**Files:** `src/main.js`, `public/data/strains.json` (move from `src/data/`)

### 1d. Font optimization
**Current:** Google Fonts loaded with `preconnect` hints but no explicit `font-display` in CSS.  
**Change:**
- Verify `&display=swap` is appended to the Google Fonts URL in `index.html`
- Add `font-display: swap` in `src/tokens.css` for any local `@font-face` declarations
- Ensure both `<link rel="preconnect">` tags (googleapis.com and gstatic.com) are present and ordered before the stylesheet link

**Files:** `index.html`, `src/tokens.css`

---

## Section 2 — Runtime Animation & GPU Performance

### 2a. Leaf animation compositor hints (12 leaves kept)
The 12 animated leaf elements are staying at full count on all screen sizes per product decision.  
**Change:** Add `will-change: transform` and `contain: layout style` to the `.app-bg__leaf` rule in `style.css`. This promotes each leaf to its own GPU compositor layer upfront, preventing leaf animation from triggering full-page repaints.  
**Files:** `src/style.css`

### 2b. `prefers-reduced-motion` support
**Change:** Add a single `@media (prefers-reduced-motion: reduce)` block in `style.css` that sets `animation: none` and `transition: none` on `.app-bg__leaf`, `.app-bg__haze`, and any other non-essential animated elements. Functional transitions (screen navigation, button presses) are preserved.  
**Files:** `src/style.css`

### 2c. Reduce `backdrop-filter` blur values on mobile
**Current:** Up to `backdrop-filter: blur(16px) saturate(1.4)` across 9 selectors — each forces a full GPU compositing pass of everything behind the element.  
**Change:** Add a `@media (max-width: 768px)` block that halves all blur values:
- `blur(16px)` → `blur(8px)`
- `blur(12px)` → `blur(6px)`
- `blur(6px)` → `blur(3px)`
- `blur(4px)` → `blur(2px)`
- `blur(3px)` → `blur(2px)`

Saturate modifiers are removed on mobile. Visual glassmorphism effect is preserved.  
**Files:** `src/style.css`

### 2d. `contain` on app background container
**Change:** Add `contain: layout style` to `#app-bg` in `style.css`. This tells the browser the background layer's layout changes are self-contained and don't affect the rest of the document, reducing repaint scope.  
**Files:** `src/style.css`

---

## Section 3 — Service Worker & Repeat Visit Caching

### 3a. Cache-first Service Worker
**File:** `public/sw.js`  
**Strategy:**
- **Static assets** (JS chunks, CSS, fonts, images, manifest): cache-first. On install, pre-cache the app shell. Serve from cache on subsequent requests; update cache in background.
- **Data files** (`/data/strains.json`): cache-first with network fallback. Cached after first fetch.
- **Firebase / API calls**: network-first (never cache dynamic auth or Firestore traffic).

### 3b. Versioned cache with auto-update
Vite already hashes all asset filenames at build time (e.g. `main-a3f2c1.js`). The SW uses a `CACHE_VERSION` constant (e.g. `'v1'`) in its name. On each new deploy:
1. New asset hashes cause cache misses → new files fetched and cached under the new version key
2. The SW `activate` event deletes all caches that don't match the current version key
3. Users automatically receive the update on next page load — no manual cache clearing needed

### 3c. Offline fallback
The SW caches `index.html` as part of the app shell. If the network is unavailable, `index.html` is served from cache. Since `strains.json` is also cached after first fetch, the core pick flow works offline after one visit.

### 3d. SW registration
Register at the bottom of `index.html` inside a `<script>` tag:
```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
```
No third-party library (Workbox). Plain SW API only.  
**Files:** `public/sw.js`, `index.html`

---

## Files Changed Summary

| File | Change |
|------|--------|
| `vite.config.js` | Add `manualChunks` for firebase / game / core |
| `src/main.js` | Remove static Firebase + strains imports; add fetch-after-paint for strains; lazy Firebase |
| `src/services/userService.js` | Use `loadFirebase()` helper instead of direct firebase import |
| `src/firebase.js` | No change — just loaded lazily now |
| `src/style.css` | `will-change` + `contain` on leaves; `prefers-reduced-motion`; mobile backdrop-filter reductions; `contain` on `#app-bg` |
| `index.html` | Font `display=swap`; SW registration script |
| `src/tokens.css` | `font-display: swap` on any `@font-face` rules |
| `public/data/strains.json` | Moved from `src/data/strains.json` |
| `public/sw.js` | New file — Service Worker |

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Strains not ready when user reaches picker | "Pick For Me" button already disabled by default; add `strainsReady` flag before enabling |
| SW caching stale app version | Vite asset hashing + versioned cache key + activate-event cleanup |
| Firebase lazy-load race condition | `loadFirebase()` is a singleton — concurrent callers await the same promise |
| CSS unstyled flash from dynamic route styles | N/A — not splitting CSS per-route in this pass; all CSS stays bundled |

---

## Success Criteria

- Time-to-interactive on iPhone (simulated throttled connection) improves by ≥ 40%
- No animation jank on the age gate or home screen at 60fps on iPhone 12 or newer
- Repeat visits load the app shell from SW cache (network tab shows `(ServiceWorker)` for JS/CSS assets)
- No regressions in the pick flow, game screen, or sign-in flow
