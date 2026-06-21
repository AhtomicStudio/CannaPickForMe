# Mobile Performance Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the slow initial load and runtime jank experienced by all iPhone users by splitting the bundle, lazy-loading Firebase, fetching strain data after first paint, and adding a Service Worker for repeat-visit caching.

**Architecture:** Three complementary layers — (1) bundle changes so the critical-path JS is smaller and parses faster, (2) CSS changes so the GPU isn't overwhelmed by heavy compositing effects on mobile, (3) a Service Worker so every visit after the first loads from local cache.

**Tech Stack:** Vanilla JS, Vite 8, Firebase SDK v12, plain Service Worker API (no Workbox)

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `public/data/strains.json` | Create (move) | Moved from `src/data/strains.json`; served as a static asset |
| `src/main.js` | Modify | Remove static strains + userService imports; add fetch-after-paint + lazy loader |
| `vite.config.js` | Modify | Add `manualChunks` to split Firebase + game into separate chunks |
| `src/style.css` | Modify | Add `will-change`/`contain` on animated elements; mobile `backdrop-filter` reduction |
| `public/sw.js` | Create | Service Worker — cache-first for hashed assets, network-first for HTML/data |
| `index.html` | Modify | Add SW registration script |

---

## Task 1: Move `strains.json` to `public/`

**Files:**
- Create: `public/data/strains.json` (copy of `src/data/strains.json`)

Vite serves everything in `public/` as static assets at the root URL. Moving here makes `strains.json` available at `/data/strains.json` without being bundled into JS.

- [ ] **Step 1: Copy the file**

```powershell
Copy-Item src\data\strains.json public\data\strains.json
```

Expected: `public/data/strains.json` now exists and `src/data/strains.json` still exists (keep the original for now — Task 2 removes the import, Task 2 commit is when the src copy becomes dead weight; delete it then).

- [ ] **Step 2: Verify it's accessible**

Run `npm run dev`, open `http://localhost:5173/data/strains.json` in a browser. You should see raw JSON, not a 404.

- [ ] **Step 3: Commit**

```bash
git add public/data/strains.json
git commit -m "chore: copy strains.json to public/ for fetch-after-paint"
```

---

## Task 2: Replace static strains import with fetch-after-paint

**Files:**
- Modify: `src/main.js` — lines 15, 184–187, 217–228

**What this does:** removes the 108KB `strains.json` from the JS bundle. The data is fetched in the background immediately when the app starts; the "Pick For Me" button stays disabled (it already is by default) until the data arrives.

- [ ] **Step 1: Remove the static import**

In `src/main.js`, delete line 15:
```js
import strainsData from './data/strains.json';
```

- [ ] **Step 2: Add module-level state and the loader function**

Directly after the `// === CONSTANTS ===` block (around line 46 after the deletion), add:

```js
// === STRAINS DATA ===
let strainsData = null;
let strainsReady = false;

async function loadStrains() {
  try {
    const res = await fetch('/data/strains.json');
    if (!res.ok) throw new Error(`strains fetch failed: ${res.status}`);
    strainsData = await res.json();
  } catch (err) {
    console.error('Failed to load strains:', err);
    strainsData = [];
  }
  strainsReady = true;
  updateStashUI();
}
```

- [ ] **Step 3: Update `getAllStrains()` to handle null strains**

Find the `getAllStrains` function (was line 184, now ~183 after line 15 deletion):

```js
function getAllStrains() {
  const customs = getCustomStrains();
  return applyDelta([...strainsData, ...customs], strainDelta);
}
```

Replace with:

```js
function getAllStrains() {
  const customs = getCustomStrains();
  return applyDelta([...(strainsData ?? []), ...customs], strainDelta);
}
```

- [ ] **Step 4: Guard the Pick For Me button with `strainsReady`**

Find `updateStashUI()` (was line 217). Find this line inside it:

```js
  if (pickBtn) pickBtn.disabled = count < 2;
```

Replace with:

```js
  if (pickBtn) pickBtn.disabled = !strainsReady || count < 2;
```

- [ ] **Step 5: Kick off the fetch at app start**

Find the `async function init()` (was line 1748). Add `loadStrains()` as the **first line** of the function body (before `loadSavedTheme()`):

```js
async function init() {
  loadStrains(); // start fetch immediately — no await, button stays disabled until ready
  loadSavedTheme();
  inject();
  // ... rest of init unchanged
```

- [ ] **Step 6: Delete the now-dead src copy**

```powershell
Remove-Item src\data\strains.json
```

- [ ] **Step 7: Verify in browser**

Run `npm run dev`. Open the app. Open DevTools → Network. You should see a request to `/data/strains.json` (not bundled in the main JS). The home screen should load, and the "Pick For Me" button should become enabled after the JSON loads (~200ms on localhost).

- [ ] **Step 8: Commit**

```bash
git add src/main.js src/data/strains.json
git commit -m "perf: fetch strains.json after first paint instead of bundling it"
```

---

## Task 3: Lazy-load `userService` (and transitively Firebase)

**Files:**
- Modify: `src/main.js` — lines 28–33 (static import), plus all call sites throughout

**Why this matters:** `userService.js` statically imports `firebase.js`, which pulls the entire Firebase SDK (Auth + Firestore + Storage) into the critical-path bundle. By lazy-loading `userService`, Firebase is excluded from the initial parse entirely and only downloaded when the user interacts with sign-in — or after the auth state check fires.

**Strategy:**
- Remove the static `import { ... } from './services/userService.js'`
- Add a `getUserService()` singleton that does `import('./services/userService.js')` once and caches the result
- Add a module-level `currentUser` variable (replaces `getCurrentUser()` calls in main.js)
- Add a `triggerSync()` fire-and-forget helper (replaces `scheduleSync()` calls)
- Update all call sites

- [ ] **Step 1: Remove the static import**

In `src/main.js`, delete lines 28–33:
```js
import {
  getCurrentUser, signInWithGoogle,
  scheduleSync, loadAndResolveProfile, signOutUser, deleteAccount, initAuth,
  sendSignInLink, handleSignInLink, completeSignInWithEmail, NEEDS_EMAIL_CONFIRMATION,
  requestSignInCode, verifySignInCode,
} from './services/userService.js';
```

- [ ] **Step 2: Add the lazy loader and helpers**

Directly below the last remaining `import` statement at the top of `src/main.js`, add:

```js
// === FIREBASE / USER SERVICE (lazy) ===
// userService statically imports firebase.js — lazy-loading this keeps the
// entire Firebase SDK out of the critical-path bundle.
let _userSvc = null;
async function getUserService() {
  if (!_userSvc) _userSvc = await import('./services/userService.js');
  return _userSvc;
}

// Mirrors userService.currentUser so callers in main.js don't need async access.
// Set/cleared by the initAuth callbacks in init().
let currentUser = null;

// Fire-and-forget sync — replaces direct scheduleSync() calls.
function triggerSync() {
  getUserService().then(({ scheduleSync }) => scheduleSync()).catch(() => {});
}
```

- [ ] **Step 3: Replace all `getCurrentUser()` calls with `currentUser`**

There are 4 occurrences. Replace each one:

- Around line 338 (in `handleProfileClick`):
  ```js
  // OLD:
  const user = getCurrentUser();
  // NEW:
  const user = currentUser;
  ```

- Around line 387 (in the CannaGotchi button handler):
  ```js
  // OLD:
  const user = getCurrentUser();
  // NEW:
  const user = currentUser;
  ```

- Around line 999 (in the result screen, session XP grant):
  ```js
  // OLD:
  const user = getCurrentUser();
  // NEW:
  const user = currentUser;
  ```

- Around line 1451 (in `openAccountModal` inside `initAccountModal`):
  ```js
  // OLD:
  const user = getCurrentUser();
  // NEW:
  const user = currentUser;
  ```

- [ ] **Step 4: Replace all `scheduleSync()` calls with `triggerSync()`**

There are 7 occurrences. Do a find-and-replace-all for `scheduleSync()` → `triggerSync()` in `src/main.js`.

Verify the 7 locations (approximate lines, adjust for prior edits):
- ~379: inside the clear-stash confirm handler
- ~667: inside the add-to-stash handler
- ~727: inside the remove-from-stash handler
- ~805: inside the stash item click handler
- ~842: inside the effect override set handler
- ~850: inside the effect override reset handler
- ~1117: inside the session result handler

- [ ] **Step 5: Update `requestCodeAndShowEntry` to use `getUserService()`**

Find `async function requestCodeAndShowEntry(email, errorEl)`. Replace the body:

```js
async function requestCodeAndShowEntry(email, errorEl) {
  errorEl?.classList.add('hidden');
  try {
    const { requestSignInCode } = await getUserService();
    await requestSignInCode(email);
    document.getElementById('account-code-email').textContent = email;
    document.getElementById('account-code-input').value = '';
    setAccountState('code');
    setTimeout(() => document.getElementById('account-code-input')?.focus(), 50);
  } catch (err) {
    const msg = err?.message || 'Could not send the code. Please try again.';
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    } else {
      alert(msg);
    }
    console.error('requestSignInCode error:', err);
  }
}
```

- [ ] **Step 6: Update Google sign-in handler**

Find the `account-google-btn` click listener inside `initAccountModal`. Replace the `await signInWithGoogle()` call:

```js
document.getElementById('account-google-btn').addEventListener('click', async () => {
  const btn = document.getElementById('account-google-btn');
  const errorEl = document.getElementById('account-google-error');
  errorEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    const { signInWithGoogle } = await getUserService();
    await signInWithGoogle();
    closeModal('account-modal');
  } catch (err) {
    const code = err.code || '';
    console.error('Google sign-in error:', code, err);
    if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      errorEl.textContent = code === 'auth/popup-blocked'
        ? 'Pop-up was blocked — please allow pop-ups for this site and try again.'
        : `Google sign-in failed (${code || 'unknown'}). Please try again.`;
      errorEl.classList.remove('hidden');
    }
    btn.disabled = false;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962l3.007 1.332C4.672 4.167 6.656 3.58 9 3.58z" fill="#EA4335"/></svg> Continue with Google`;
  }
});
```

- [ ] **Step 7: Update magic-link send handler**

Find the `account-email-form` submit listener. Replace `await sendSignInLink(email)`:

```js
document.getElementById('account-email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('account-email-input').value.trim();
  const errEl = document.getElementById('account-email-error');
  const btn   = document.getElementById('account-email-btn');
  if (!email) return;
  errEl.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const { sendSignInLink } = await getUserService();
    await sendSignInLink(email);
    document.getElementById('account-linksent-email').textContent = email;
    setAccountState('linksent');
  } catch (err) {
    errEl.textContent = 'Could not send link. Check the email and try again.';
    errEl.classList.remove('hidden');
    console.error('sendSignInLink error:', err);
  } finally {
    btn.disabled = false; btn.textContent = 'Send Magic Link';
  }
});
```

- [ ] **Step 8: Update OTP verify handler**

Find the `account-code-form` submit listener. Replace `await verifySignInCode(code)`:

```js
document.getElementById('account-code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('account-code-input').value.trim();
  const errEl = document.getElementById('account-code-error');
  const btn = document.getElementById('account-code-btn');
  if (!/^\d{6}$/.test(code)) {
    errEl.textContent = 'Please enter the 6-digit code from your email.';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  try {
    const { verifySignInCode } = await getUserService();
    await verifySignInCode(code);
    closeModal('account-modal');
  } catch (err) {
    const msg = err?.message || 'Incorrect or expired code.';
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    console.error('verifySignInCode error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});
```

- [ ] **Step 9: Update magic-link cross-device confirm handler**

Find the `account-confirm-form` submit listener. Replace `await completeSignInWithEmail(email)`:

```js
document.getElementById('account-confirm-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('account-confirm-input').value.trim();
  const errEl = document.getElementById('account-confirm-error');
  if (!email) return;
  errEl.classList.add('hidden');
  try {
    const { completeSignInWithEmail } = await getUserService();
    await completeSignInWithEmail(email);
    closeModal('account-modal');
  } catch (err) {
    errEl.textContent = 'Sign-in failed. Make sure this is the same email you used.';
    errEl.classList.remove('hidden');
    console.error('completeSignInWithEmail error:', err);
  }
});
```

- [ ] **Step 10: Update sign-out handlers**

Find the `account-signout-btn` click listener:
```js
document.getElementById('account-signout-btn').addEventListener('click', async () => {
  const { signOutUser } = await getUserService();
  await signOutUser();
  closeModal('account-modal');
});
```

Find the `profile-signout-btn` click listener:
```js
profileSignoutBtn.addEventListener('click', async () => {
  const { signOutUser } = await getUserService();
  await signOutUser();
  showScreen('home');
});
```

- [ ] **Step 11: Update delete-account handler**

Find the `account-delete-btn` click listener. Replace `await deleteAccount()`:

```js
document.getElementById('account-delete-btn').addEventListener('click', async () => {
  const confirmed = await showConfirm({
    icon: '⚠️',
    title: 'Delete your account?',
    message: 'This deletes your cloud data permanently. Your local data stays on this device.',
    confirmLabel: 'Delete Account',
    cancelLabel: 'Cancel',
    tone: 'danger',
  });
  if (!confirmed) return;
  try {
    const { deleteAccount } = await getUserService();
    await deleteAccount();
    closeModal('account-modal');
    showToast('Account deleted. Your local data is still on this device.', 'success');
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      showToast('For security, please sign out and sign back in before deleting your account.', 'error');
    } else {
      showToast('Something went wrong. Please try again.', 'error');
      console.error('deleteAccount error:', err);
    }
  }
});
```

- [ ] **Step 12: Update `init()` — replace `handleSignInLink` and `initAuth`**

At the end of `async function init()`, find this block (around line 1770–1785):

```js
  // Handle magic link return — must run after initAccountModal sets up the modal
  try {
    const result = await handleSignInLink();
    if (result === NEEDS_EMAIL_CONFIRMATION) {
      // Opened on a different device — ask for email to complete sign-in
      setAccountState('confirmemail');
      openModal('account-modal');
    }
    // true = signed in successfully, false = no link in URL — both silent
  } catch (err) {
    console.warn('handleSignInLink error:', err);
  }
```

Replace the entire block AND the `initAuth(...)` call (which is inside `initAccountModal`, around line 1620). 

First, find `initAuth(` inside `initAccountModal` and extract the two callbacks. The callbacks reference `loadAndResolveProfile`, `syncSettingsFromFirestore`, etc. Replace the `initAuth(...)` block inside `initAccountModal` with a call to a new helper, and move the `handleSignInLink` call to after the dynamic import:

Inside `initAccountModal`, find and **remove** the entire `initAuth(...)` call block (roughly lines 1620–1662). Leave the rest of `initAccountModal` intact.

Then, at the bottom of `init()`, replace the old `handleSignInLink` block with:

```js
  // Load Firebase / userService after synchronous UI setup — keeps it off
  // the critical path. handleSignInLink needs it to detect magic-link URLs.
  const userSvc = await getUserService();

  // Handle magic link return — must run after initAccountModal sets up the modal
  try {
    const result = await userSvc.handleSignInLink();
    if (result === userSvc.NEEDS_EMAIL_CONFIRMATION) {
      setAccountState('confirmemail');
      openModal('account-modal');
    }
  } catch (err) {
    console.warn('handleSignInLink error:', err);
  }

  // Auth state observer — updates avatar and syncs profile on sign-in.
  const authLinks = document.getElementById('auth-links');
  const resultCta = document.getElementById('result-signup-cta');
  const profileSignoutBtn = document.getElementById('profile-signout-btn');

  userSvc.initAuth(
    async (user) => {
      currentUser = user;
      authLinks.classList.add('hidden');
      if (resultCta) resultCta.classList.add('hidden');
      profileSignoutBtn.classList.remove('hidden');
      updateProfileAvatar(user);
      closeModal('account-modal');
      const gotchiBtn = document.getElementById('btn-cannagotchi');
      if (gotchiBtn) { gotchiBtn.disabled = false; gotchiBtn.classList.remove('btn--game-locked'); gotchiBtn.classList.add('btn--game-unlocked'); }
      try {
        await userSvc.loadAndResolveProfile(showConflictModal);
      } catch (err) {
        console.error('loadAndResolveProfile error:', err);
      }
      try {
        const { syncSettingsFromFirestore } = await getUserService();
        await syncSettingsFromFirestore(user.uid);
      } catch (err) {
        console.warn('Settings sync failed:', err);
      }
      try { await initCompanion(user.uid); } catch (e) { console.warn('companion init failed', e); }
      renderBrowseList();
      renderMyStashList();
      updateStashUI();
    },
    () => {
      currentUser = null;
      authLinks.classList.remove('hidden');
      if (resultCta) resultCta.classList.remove('hidden');
      profileSignoutBtn.classList.add('hidden');
      updateProfileAvatar(null);
      const gotchiBtn = document.getElementById('btn-cannagotchi');
      if (gotchiBtn) { gotchiBtn.disabled = true; gotchiBtn.classList.add('btn--game-locked'); gotchiBtn.classList.remove('btn--game-unlocked'); }
      destroyCompanion();
    }
  );
```

- [ ] **Step 13: Verify in browser**

Run `npm run dev`. Open DevTools → Network. On initial page load, confirm that **no Firebase-related requests** fire until you tap "Sign In" or the page has finished loading and the auth state check fires. The app should fully render without Firebase in the critical path.

Test the full sign-in flow: email magic link, OTP, Google sign-in. Verify sign-out works. Verify the profile avatar updates on sign-in.

- [ ] **Step 14: Commit**

```bash
git add src/main.js
git commit -m "perf: lazy-load Firebase/userService — remove from critical-path bundle"
```

---

## Task 4: Vite manual chunk splitting

**Files:**
- Modify: `vite.config.js`

This tells Rollup to put Firebase SDK modules and all game/animation modules into their own named chunks. Combined with the lazy imports from Task 3, Vite will correctly exclude them from the main entry chunk.

- [ ] **Step 1: Add `manualChunks` to the build config**

Open `vite.config.js`. Find the `build.rollupOptions` object. Replace it with:

```js
export default defineConfig({
  plugins: [forceExitAfterBuild()],
  build: {
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'chunk-firebase';
          if (id.includes('/src/game/') || id.includes('/src/animations/')) return 'chunk-game';
        },
      },
    },
  },
});
```

- [ ] **Step 2: Run a build and inspect chunk sizes**

```bash
npm run build
```

Expected output: you should see separate chunks named `chunk-firebase-*.js` and `chunk-game-*.js` in `dist/assets/`. The main chunk (`index-*.js`) should be significantly smaller than before.

- [ ] **Step 3: Verify the build works**

```bash
npm run preview
```

Open `http://localhost:4173`. The app should load fully. Sign-in should work. No console errors.

- [ ] **Step 4: Commit**

```bash
git add vite.config.js
git commit -m "perf: split Firebase and game code into separate Vite chunks"
```

---

## Task 5: CSS — `will-change` and `contain` on animated background

**Files:**
- Modify: `src/style.css` — around line 3418 (`#app-bg`) and line 3462 (`.app-bg__leaf`)

Adding `will-change: transform` tells the browser to promote each leaf to its own GPU compositor layer before animation starts, preventing leaf animation from triggering full-page repaints. `contain: layout style` on `#app-bg` limits style recalculation scope.

- [ ] **Step 1: Add `contain` to `#app-bg`**

Find the `#app-bg` rule (around line 3418):

```css
#app-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
```

Replace with:

```css
#app-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  contain: layout style;
}
```

- [ ] **Step 2: Add `will-change` to `.app-bg__leaf`**

Find the `.app-bg__leaf` rule (around line 3462):

```css
.app-bg__leaf {
  position: absolute;
  font-size: var(--size, 1.5rem);
  left: var(--x, 50%);
  bottom: -5vh;
  opacity: 0;
  animation: app-leaf-float var(--dur, 15s) linear infinite;
  animation-delay: var(--delay, 0s);
  user-select: none;
  pointer-events: none;
}
```

Replace with:

```css
.app-bg__leaf {
  position: absolute;
  font-size: var(--size, 1.5rem);
  left: var(--x, 50%);
  bottom: -5vh;
  opacity: 0;
  animation: app-leaf-float var(--dur, 15s) linear infinite;
  animation-delay: var(--delay, 0s);
  user-select: none;
  pointer-events: none;
  will-change: transform;
  contain: layout style;
}
```

- [ ] **Step 3: Verify no visual regression**

Run `npm run dev`. Check the home screen — leaves should still float. Check a few other screens.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "perf: promote animated leaves to compositor layers with will-change + contain"
```

---

## Task 6: CSS — reduce `backdrop-filter` blur values on mobile

**Files:**
- Modify: `src/style.css` — add a `@media (max-width: 768px)` block at the end of the file

iOS Safari forces a full GPU compositing pass for every `backdrop-filter` element. Halving the blur values on mobile preserves the glassmorphism look while cutting GPU work roughly in half.

The 9 `backdrop-filter` rules and their selectors are:

| Selector | Desktop blur | Mobile blur |
|----------|-------------|------------|
| `.stash__done-bar` | `blur(12px)` | `blur(6px)` |
| `.stash-tip` | `blur(3px)` | `blur(2px)` |
| `.modal--confirm .modal__backdrop` | `blur(6px)` | `blur(3px)` |
| `.scales__name` | `blur(4px)` | `blur(2px)` |
| `.result__card` | `blur(16px) saturate(1.4)` | `blur(8px)` |

- [ ] **Step 1: Add the mobile override block**

At the very end of `src/style.css`, append:

```css
/* ============================================================
   MOBILE PERFORMANCE — reduce backdrop-filter GPU cost on
   screens ≤ 768px (all phones). Halves blur values; removes
   saturate() which has no visible effect at low opacity.
   ============================================================ */
@media (max-width: 768px) {
  .stash__done-bar {
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  .stash-tip {
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  .modal--confirm .modal__backdrop {
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
  }

  .scales__name {
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  .result__card {
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
}
```

- [ ] **Step 2: Verify visually**

Run `npm run dev`. Open DevTools, set viewport to iPhone 14 Pro (393px wide). Check:
- The "done" bar at the bottom of the stash screen still looks frosted
- The result card still has the glassmorphism effect
- The confirm modal backdrop still blurs the background

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "perf: halve backdrop-filter blur values on mobile to reduce GPU load"
```

---

## Task 7: Create the Service Worker

**Files:**
- Create: `public/sw.js`

**Strategy:**
- Hashed assets (`/assets/…` — JS, CSS): **cache-first**. Vite hashes filenames, so a cached URL is forever valid.
- Static data (`/data/strains.json`, `/manifest.json`): **cache-first** after first fetch (SW caches it; repeat visits are instant).
- HTML (`/`, `index.html`): **network-first** with cache fallback (ensures users get fresh HTML on deploy).
- Everything else (Firebase API calls, external URLs): **pass-through** (no caching).

- [ ] **Step 1: Create `public/sw.js`**

```js
const CACHE = 'cpfm-v1';

// Assets to pre-cache on install (stable URLs only — no hashed filenames here)
const PRECACHE = ['/', '/data/strains.json', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Hashed Vite assets — cache-first (filename hash guarantees freshness)
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // Static data files — cache-first with network fallback
  if (url.pathname === '/data/strains.json' || url.pathname === '/manifest.json' || url.pathname === '/favicon.svg') {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // HTML (/, /index.html) — network-first so deploys reach users immediately
  if (request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat: add Service Worker with cache-first strategy for repeat visits"
```

---

## Task 8: Register the Service Worker in `index.html`

**Files:**
- Modify: `index.html` — add a `<script>` tag before `</body>`

- [ ] **Step 1: Add the registration script**

In `index.html`, find the closing `</body>` tag. Add this block immediately before it:

```html
    <!-- Service Worker — cache-first for JS/CSS/data, offline fallback for HTML -->
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch((err) => {
            console.warn('SW registration failed:', err);
          });
        });
      }
    </script>
  </body>
```

- [ ] **Step 2: Font optimization check**

Open `index.html` and confirm line 42 already has `display=swap` in the Google Fonts URL and that both `<link rel="preconnect">` tags are present (they are — this is already done, nothing to change).

- [ ] **Step 3: Build and test the Service Worker**

```bash
npm run build && npm run preview
```

Open `http://localhost:4173`. Open DevTools → Application → Service Workers. You should see `sw.js` registered and status "activated and running".

Open DevTools → Network. Hard-reload the page (Ctrl+Shift+R). Note which assets are served from the network.

Do a **soft reload** (Ctrl+R or F5). Now check Network again — JS and CSS files should show `(ServiceWorker)` in the Size column. The strains.json fetch should also show `(ServiceWorker)`.

Go offline (DevTools → Network → Offline toggle). Reload. The app shell should still appear.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: register Service Worker for offline support and repeat-visit caching"
```

---

## Final Verification Checklist

Run through these manually before shipping:

- [ ] Home screen loads and shows content without a white flash on simulated slow 3G (DevTools → Network → Slow 3G throttle)
- [ ] "Pick For Me" button is disabled on load, becomes enabled after strains load (~300ms on slow 3G)
- [ ] Selecting strains works, pick flow completes, result screen shows correctly
- [ ] Sign in with Google works, sign in with email/magic link works, sign out works
- [ ] Profile screen shows correct user info after sign-in
- [ ] CannaGotchi / game screen loads correctly
- [ ] DevTools → Network confirms no Firebase requests on initial load until sign-in is triggered
- [ ] Service Worker shows as "activated" in DevTools → Application → Service Workers
- [ ] Second page load serves JS/CSS from ServiceWorker cache
- [ ] No console errors in any of the above flows

---

## Notes

- **`prefers-reduced-motion` for leaves/haze:** The existing `tokens.css` comment (lines 143–177) documents a deliberate design decision NOT to stop leaf/haze animations for reduced-motion users, citing that the slow gentle movement doesn't trigger vestibular issues. This plan respects that decision — we improve performance without altering that UX choice.
- **Cache version bumping:** If you ever need to force-clear all users' SW caches (e.g., a breaking change in the app shell), change `'cpfm-v1'` in `public/sw.js` to `'cpfm-v2'`. The activate handler deletes old caches automatically.
- **`src/data/strains.json`:** The original file is deleted in Task 2. The source of truth is now `public/data/strains.json`. If you update strain data, update it there.
