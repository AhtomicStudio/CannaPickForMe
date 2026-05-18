# Persistent Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Firebase Auth session persistence so users stay logged in after closing and reopening the browser.

**Architecture:** The Firebase Auth instance in `src/firebase.js` is initialized with a persistence fallback chain. `indexedDBLocalPersistence` is currently first but is silently cleared on browser close by Safari ITP and certain mobile WebViews. Swapping `browserLocalPersistence` (localStorage) to position 0 makes sessions survive browser restarts universally.

**Tech Stack:** Firebase Auth v9 modular SDK (`firebase/auth`)

---

### Task 1: Fix the persistence chain in firebase.js

**Files:**
- Modify: `src/firebase.js:58-63`

- [ ] **Step 1: Make the change**

In `src/firebase.js`, swap the first two entries in the `persistence` array:

```js
// Before (lines 58-63)
persistence: [
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
],

// After
persistence: [
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
],
```

No other changes to this file.

- [ ] **Step 2: Verify the build is clean**

```bash
npm run build
```

Expected: `✓ built in <N>ms` with no errors. Warnings about dynamic imports are pre-existing and can be ignored.

- [ ] **Step 3: Verify behaviour in the browser**

```bash
npm run dev
```

1. Open the app in your browser
2. Sign in with Google (or email OTP)
3. Confirm the avatar/signed-in state appears
4. Close the browser completely (not just the tab — quit the browser)
5. Reopen the browser and navigate to the app
6. Expected: you are still signed in — no sign-in prompt appears

- [ ] **Step 4: Commit**

```bash
git add src/firebase.js
git commit -m "fix: use browserLocalPersistence first to survive browser restarts"
```
