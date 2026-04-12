# Weighing Animation System — Design Spec
**Date:** 2026-04-11  
**Project:** CannaPickForMe  
**Status:** Approved

---

## Overview

Replace the single static scales animation shown during the "weighing phase" with a pool of 7 randomized animations. Each time the user taps "Pick For Me" and completes the 4 questions, the app picks one animation at random and plays it for exactly 5 seconds before revealing the result. This keeps repeat engagement fresh and gives the app a more playful, varied feel.

---

## Goals

- 7 animations in the pool (1 existing scales + 6 new)
- Randomly selected each session — no repeats guaranteed, pure random
- All animations run for exactly 5 seconds
- Strain name is revealed inside the animation at ~4.5s
- Quote is visible below the animation for the full 5 seconds
- Architecture makes it easy to add future animations (drop in new object, register it)

---

## Architecture — Option B

### New file: `src/animations/index.js`

Central registry. Imports all animation objects and exports two things:

```js
export const ANIMATIONS = [ /* 7 objects */ ];
export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

Each animation is a plain object:

```js
{
  id: 'eightball',           // unique string identifier
  name: 'Magic 8-Ball',      // human-readable label
  render(container, ctx) {   // called once when the phase starts
    // ctx = { strainName: string, allScores: [{ strainId, strainName, score }] }
    // Injects HTML into container, sets up any JS-driven animation steps
    // Must not return a promise — fire-and-forget, runs for 5s and stops
  }
}
```

The `render()` function is responsible for the entire animation lifecycle. It injects HTML into the host container and uses `setTimeout` internally for any sequenced steps (e.g., revealing the strain name at 4.5s). It does not call back to `main.js`.

---

## HTML Changes — `index.html`

Inside `#weighing-phase`, remove the hard-coded scales markup and replace with:

```html
<div id="weighing-phase" class="result__weighing">
  <h2 class="result__weighing-title">Weighing Your Options...</h2>
  <div id="animation-host" class="animation-host"></div>
  <p class="result__weighing-sub" id="weighing-quote"></p>
</div>
```

Layout order (top to bottom):
1. Title — "Weighing Your Options..."
2. `#animation-host` — active animation renders here
3. Quote — `#weighing-quote`, populated once before animation starts, visible the full 5s

---

## `main.js` Changes

In `startResult()`:

1. Select animation: `const anim = pickAnimation()`
2. Populate quote: `document.getElementById('weighing-quote').textContent = ...` (same `getNextQuote()` logic as today)
3. Clear host: `document.getElementById('animation-host').innerHTML = ''`
4. Run animation: `anim.render(document.getElementById('animation-host'), { strainName: result.pickedStrain.name, allScores: result.allScores })`
5. Change `WEIGH_DURATION` from `3000` to `5000`
6. Remove the old scales name-population loop (the `sortedStrains.forEach` block that appended `<span>` elements to `#scale-left-names` / `#scale-right-names`)

Import addition at top of file:
```js
import { pickAnimation } from './animations/index.js';
```

---

## CSS Changes — `style.css`

All new animation keyframes and layout classes go at the bottom of `style.css` under clearly labeled sections. Class names are namespaced to avoid collisions:

- `.anim-host` — shared container sizing/centering
- `.anim-ball-*` — Magic 8-Ball classes
- `.anim-plinko-*` — Plinko classes
- `.anim-box-*` — Notes in Box classes
- `.anim-tarot-*` — Tarot Card classes
- `.anim-slots-*` — Slot Machine classes
- `.anim-crystal-*` — Crystal Ball classes

Existing scales CSS (`.scales`, `.scales__*`) is untouched.

---

## The 7 Animations

### 1. Scales (existing — migrated)
**File:** `src/animations/scales.js`  
**What moves:** The existing scales HTML (currently hard-coded in `index.html`) and the name-population JS loop (currently in `main.js`) both move into `render()`. Visually identical to today.  
**Uses allScores:** Yes — strain names fill the two pans, spread evenly over 4s.  
**Reveal moment:** No explicit strain name reveal — the scales just weigh until cutoff.

### 2. Magic 8-Ball
**File:** Defined inline in `src/animations/index.js` or extracted to `src/animations/eightball.js`  
**Description:** A black sphere shakes with heavy multi-directional physics. A circular window is embedded in the face of the ball; green mist swirls inside it. At 4.5s the mist clears and the strain name glows inside the window. A smoke cloud drifts up from behind the ball throughout.  
**Uses allScores:** No — only `strainName`.  
**Reveal moment:** 4.5s — strain name fades in inside the ball window.

### 3. Plinko Drop
**File:** `src/animations/plinko.js`  
**Description:** A vertical board of purple glowing pegs. A small green leaf 🍃 (smaller than the pegs) drops from the top, bouncing realistically between pegs. Strain names from `allScores` (up to 5) label the slots at the bottom. At ~4.5s the leaf settles into the winning slot, which highlights green.  
**Uses allScores:** Yes — slot labels use `allScores[0..4].strainName`. Winning slot is `allScores[0]` (the picked strain).  
**Reveal moment:** 4.5s — leaf lands, winning slot glows.

### 4. Notes in a Box
**File:** `src/animations/box.js`  
**Description:** A wooden box with a bouncing lid. Paper slips (up to 4, labeled with competing strain names from `allScores`) fold, then shuffle around inside the box as the lid rattles. At 4.5s the winning slip rises dramatically out of the box labeled with the strain name, with a gold glow.  
**Uses allScores:** Yes — competing slips use `allScores[1..4].strainName`. The rising note uses `strainName`.  
**Reveal moment:** 4.5s — chosen note floats upward.

### 5. Tarot Card Draw
**File:** `src/animations/tarot.js`  
**Description:** 5 face-down cards in a wide fan. Cards shuffle with lateral movement. The center card is the "chosen" one — at 4s it begins a flip (rotateY), revealing a green-faced card at 4.5s with the strain name. Sparkles ✦ burst from the corners on reveal.  
**Uses allScores:** No — only `strainName` on the revealed card.  
**Reveal moment:** 4.5s — green card face visible, sparkles fire.

### 6. Slot Machine Pull
**File:** `src/animations/slots.js`  
**Description:** A stylized slot machine with 3 reels spinning with cannabis emojis. A pull lever animates at the start. Reels lock in one-by-one (reel 1 at 2.5s, reel 2 at 3.5s, reel 3 at 4.25s). When the last reel locks, glitter particles and corner star sparkles ✦ burst across the machine. A readout below the reels shows the strain name at 4.5s.  
**Uses allScores:** No — only `strainName` on the readout.  
**Reveal moment:** 4.5s — readout fades in with strain name.

### 7. Crystal Ball Oracle
**File:** `src/animations/crystal.js`  
**Description:** A glowing crystal ball with 3 rotating smoke layers (green + purple) and smoke tendrils rising from the top. The entire background of the host has a deep purple ambient haze. The ball pulses in brightness. At 4.5s the smoke parts and the strain name materializes inside the ball, glowing white-purple.  
**Uses allScores:** No — only `strainName`.  
**Reveal moment:** 4.5s — strain name fades in inside ball.

---

## Timing Contract

| Milestone | Time |
|---|---|
| Animation starts, host populated | 0s |
| Quote visible below animation | 0s |
| Animation reaches peak activity | ~2–3s |
| Strain name reveal inside animation | ~4.5s |
| `main.js` hides weighing phase | 5.0s |
| Result screen shown | 5.0s |

Animations must not rely on callbacks or promises. They run fire-and-forget. The 5s `WEIGH_DURATION` timeout in `main.js` is the only thing that ends the phase.

---

## Extensibility

To add an 8th animation later:
1. Write the render function (inline in `index.js` or a new file)
2. Add the CSS to `style.css` under `.anim-newname-*`
3. Push the object into the `ANIMATIONS` array in `index.js`

No other files need to change.

---

## Files Touched

| File | Change |
|---|---|
| `src/animations/index.js` | **Create** — registry + `pickAnimation()`, imports all animation modules |
| `src/animations/scales.js` | **Create** — migrated scales animation |
| `src/animations/eightball.js` | **Create** — Magic 8-Ball animation |
| `src/animations/plinko.js` | **Create** — Plinko Drop animation |
| `src/animations/box.js` | **Create** — Notes in a Box animation |
| `src/animations/tarot.js` | **Create** — Tarot Card Draw animation |
| `src/animations/slots.js` | **Create** — Slot Machine Pull animation |
| `src/animations/crystal.js` | **Create** — Crystal Ball Oracle animation |
| `index.html` | **Edit** — replace hard-coded scales markup with `#animation-host`, add `id="weighing-quote"` to subtitle `<p>` |
| `src/main.js` | **Edit** — import `pickAnimation`, update `startResult()`, change `WEIGH_DURATION` to 5000 |
| `src/style.css` | **Edit** — add namespaced keyframes for all 6 new animations |
