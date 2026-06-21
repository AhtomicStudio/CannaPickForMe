# Persistent Auth (Stay Logged In) — Design Spec
**Date:** 2026-05-18
**Scope:** Fix auth session persistence so users stay logged in after closing and reopening the browser

---

## Problem

Firebase Auth is initialized with `indexedDBLocalPersistence` as the first persistence tier. IndexedDB reports itself as available on all browsers, but is silently cleared on browser close by Safari's ITP and certain mobile WebViews. Firebase picks the first "available" tier, lands on IndexedDB, and the session is lost when the browser closes. The fallback chain never reaches `browserLocalPersistence` (localStorage), which is universally reliable.

Result: users must sign in again every time they reopen the browser.

---

## Solution

Swap `browserLocalPersistence` to the top of the persistence chain in `src/firebase.js`. Keep `indexedDBLocalPersistence` as a secondary fallback — it is better when it works (more secure, more storage headroom).

**File changed:** `src/firebase.js`

```js
// Before
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

---

## Behaviour After Fix

- Users who sign in (Google or email OTP) stay signed in across browser restarts indefinitely
- Explicit sign-out clears the session as before
- No UI changes required
- Applies to all sign-in methods (Google, email magic link, email OTP, custom token)

---

## Files Changed

| File | Change |
|---|---|
| `src/firebase.js` | Swap `browserLocalPersistence` to position 0 in the persistence array |
