# Better-Match "Add to Stash" — Design Spec
**Date:** 2026-05-18
**Scope:** Add a stash toggle button to organic strain cards in the better-match modal

---

## Problem

Users see higher-scoring strains in the better-match modal but have no way to act on them. Adding a strain to their stash requires closing the modal, finding the strain in the browse list, and adding it there — too much friction for what should be a one-tap action.

---

## Solution

Add a `＋ Stash` / `✓ In Stash` toggle button to each organic strain card in the better-match modal. The button reflects real-time stash state and updates immediately on tap.

---

## Behaviour

### Button states

| State | Label | Style |
|---|---|---|
| Not in stash | `＋ Stash` | Standard compact button |
| Already in stash | `✓ In Stash` | Muted/success style (`.btn--in-stash`) |

### Interactions

- **Tap "＋ Stash":** calls `addToStash(strain.id)`, updates button to in-stash state, calls `updateStashUI()` to refresh the count badge
- **Tap "✓ In Stash":** calls `removeFromStash(strain.id)`, reverts button to not-in-stash state, calls `updateStashUI()`
- Button click stops propagation so it does not trigger the card's expand/collapse handler
- Partner card (sponsored) is excluded — it has its own CTA

---

## Files Changed

| File | Change |
|---|---|
| `src/main.js` | Add stash button HTML to `organicCards` map in `showBetterMatchesModal`; wire stash button listeners after `list.innerHTML` is set |
| `src/style.css` | Add `.btn--in-stash` style (muted green/success tone) |

---

## Implementation Notes

All required functions are already imported in `main.js`:
- `addToStash(id)` — `src/storage/store.js`
- `removeFromStash(id)` — `src/storage/store.js`
- `isInStash(id)` — `src/storage/store.js`
- `updateStashUI()` — defined in `main.js`

The stash button is added to `.strain-card__info` alongside the name and meta rows. Click listener is wired in the same post-render block as the expand listener.
