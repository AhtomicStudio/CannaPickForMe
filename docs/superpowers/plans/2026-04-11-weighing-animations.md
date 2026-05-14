# Weighing Animation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single scales animation shown during the 5-second weighing phase with a pool of 7 randomly selected animations (scales + 6 new), each revealing the winning strain name at 4.5 seconds.

**Architecture:** An `src/animations/` module holds one file per animation, each exporting a plain object with `{ id, name, render(container, ctx) }`. A central `index.js` registers all 7 and exports `pickAnimation()`. `main.js` calls `pickAnimation().render(host, ctx)` once per session; the host is cleared and refilled each time. All animation timing is self-contained — `main.js` only manages the 5-second outer timeout.

**Tech Stack:** Vanilla JS (ES modules), CSS keyframes, Vite dev server (`npm run dev`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `index.html` | Edit | Replace hard-coded scales markup with `#animation-host` div; add `id="weighing-quote"` to subtitle `<p>` |
| `src/main.js` | Edit | Import `pickAnimation`, call `render()`, set `WEIGH_DURATION = 5000`, remove scales loop |
| `src/animations/index.js` | Create | Registry array + `pickAnimation()` |
| `src/animations/scales.js` | Create | Migrated scales animation |
| `src/animations/eightball.js` | Create | Magic 8-Ball animation |
| `src/animations/plinko.js` | Create | Plinko Drop animation |
| `src/animations/box.js` | Create | Notes in a Box animation |
| `src/animations/tarot.js` | Create | Tarot Card Draw animation |
| `src/animations/slots.js` | Create | Slot Machine Pull animation |
| `src/animations/crystal.js` | Create | Crystal Ball Oracle animation |
| `src/style.css` | Edit | Append namespaced CSS for all 6 new animations + `.animation-host` container |

---

## Task 1: Restructure weighing phase HTML

**Files:**
- Edit: `index.html` lines 220–237

- [ ] **Step 1: Replace the hard-coded scales block with the animation host**

In `index.html`, find the `#weighing-phase` div (currently lines 220–237) and replace its entire contents with:

```html
    <!-- Result -->
    <div id="result-screen" class="screen result hidden">
      <div id="weighing-phase" class="result__weighing">
        <h2 class="result__weighing-title">Weighing Your Options...</h2>
        <div id="animation-host" class="animation-host"></div>
        <p id="weighing-quote" class="result__weighing-sub"></p>
      </div>
      <div id="reveal-phase" class="result__reveal hidden">
```

The key changes: the entire `.scales` block is removed; `<div id="animation-host" class="animation-host"></div>` takes its place; the `<p>` tag gains `id="weighing-quote"` (keeps its existing class for styling).

- [ ] **Step 2: Verify the HTML is valid**

Run: `npm run dev` (from `CannaPickForMe/` directory)

Navigate to the app, add 2+ strains to stash, complete the 4 questions. The weighing phase should show: title, blank space (empty host), and no quote yet (quote is populated by JS). No console errors. After 3 seconds the result screen appears (still on old timer — that changes in Task 2).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor: replace hard-coded scales markup with #animation-host"
```

---

## Task 2: Wire animation registry into main.js

**Files:**
- Create: `src/animations/index.js`
- Edit: `src/main.js`

- [ ] **Step 1: Create the animation registry stub**

Create `src/animations/index.js`:

```js
// Animation registry — add new animations to this array to include them in rotation
export const ANIMATIONS = [];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

- [ ] **Step 2: Update main.js — add import and rewrite startResult()**

At the top of `src/main.js`, add the import after the existing imports:

```js
import { pickAnimation } from './animations/index.js';
```

Then replace the entire `startResult()` function body with:

```js
function startResult() {
  showScreen('result');

  const stashStrains = getStashStrains();
  const result = matchStrains(stashStrains, sessionAnswers);

  if (!result) {
    showScreen('home');
    return;
  }

  const WEIGH_DURATION = 5000;

  // Show weighing phase
  document.getElementById('weighing-phase').classList.remove('hidden');
  document.getElementById('reveal-phase').classList.add('hidden');

  // Populate quote (visible the full 5s, below the animation)
  const quoteEl = document.getElementById('weighing-quote');
  if (quoteEl) {
    const quote = getNextQuote();
    quoteEl.textContent = quote.author
      ? `"${quote.text}" — ${quote.author}`
      : `"${quote.text}"`;
  }

  // Pick a random animation and render it into the host
  const anim = pickAnimation();
  const host = document.getElementById('animation-host');
  host.innerHTML = '';
  if (anim) {
    anim.render(host, {
      strainName: result.pickedStrain.name,
      allScores: result.allScores,
    });
  }

  // After 5 seconds, reveal the result
  setTimeout(() => {
    document.getElementById('weighing-phase').classList.add('hidden');
    document.getElementById('reveal-phase').classList.remove('hidden');
    renderResult(result);
  }, WEIGH_DURATION);
}
```

- [ ] **Step 3: Add .animation-host CSS to style.css**

At the very bottom of `src/style.css`, add:

```css
/* ============================================================
   ANIMATION HOST — shared container for all weighing animations
   ============================================================ */
.animation-host {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 260px;
  position: relative;
  overflow: hidden;
}
```

- [ ] **Step 4: Verify**

Run: `npm run dev`

Complete the 4 questions. The weighing phase should now show: title, empty box (host is empty since ANIMATIONS is empty), quote text below, and after exactly 5 seconds the result screen appears.

Open the browser console — no errors expected.

- [ ] **Step 5: Commit**

```bash
git add src/animations/index.js src/main.js src/style.css
git commit -m "feat: wire animation registry and 5s weighing phase into main.js"
```

---

## Task 3: Migrate scales animation

**Files:**
- Create: `src/animations/scales.js`
- Edit: `src/animations/index.js`

- [ ] **Step 1: Create scales.js**

Create `src/animations/scales.js`:

```js
export const scalesAnimation = {
  id: 'scales',
  name: 'Weighing Scales',

  render(container, { allScores }) {
    container.innerHTML = `
      <div class="scales">
        <div class="scales__beam">
          <div class="scales__pillar"></div>
          <div class="scales__arm">
            <div class="scales__plate scales__plate--left">
              <div class="scales__names" id="anim-scale-left"></div>
            </div>
            <div class="scales__plate scales__plate--right">
              <div class="scales__names" id="anim-scale-right"></div>
            </div>
          </div>
        </div>
        <div class="scales__base"></div>
      </div>
    `;

    const leftNames  = container.querySelector('#anim-scale-left');
    const rightNames = container.querySelector('#anim-scale-right');

    // Spread names evenly across the first 4 seconds (leave 1s for result reveal)
    const SPREAD_DURATION = 4000;
    const nameDelay = Math.min(
      200,
      (SPREAD_DURATION - 600) / Math.max(allScores.length, 1)
    );

    allScores.forEach((s, i) => {
      const side = i % 2 === 0 ? leftNames : rightNames;
      setTimeout(() => {
        if (!side) return; // host may have been cleared
        const span = document.createElement('span');
        span.className = 'scales__name';
        span.textContent = s.strainName;
        side.appendChild(span);
      }, 300 + i * nameDelay);
    });
  },
};
```

- [ ] **Step 2: Register it**

Update `src/animations/index.js`:

```js
import { scalesAnimation } from './scales.js';

export const ANIMATIONS = [
  scalesAnimation,
];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

- [ ] **Step 3: Verify**

Run: `npm run dev`

Complete the 4 questions. The scales animation should appear and behave exactly as before (strain names appearing on the pans), now running for 5 seconds instead of 3.

- [ ] **Step 4: Commit**

```bash
git add src/animations/scales.js src/animations/index.js
git commit -m "feat: migrate scales animation to animation module"
```

---

## Task 4: Magic 8-Ball animation

**Files:**
- Edit: `src/style.css`
- Create: `src/animations/eightball.js`
- Edit: `src/animations/index.js`

- [ ] **Step 1: Add 8-Ball CSS to style.css**

Append to `src/style.css`:

```css
/* ============================================================
   MAGIC 8-BALL ANIMATION
   ============================================================ */
.anim-ball-scene {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.anim-ball {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 30%, #4a4a4a 0%, #111 45%, #000 100%);
  box-shadow:
    0 0 0 3px #222,
    0 6px 24px rgba(0, 0, 0, 0.9),
    inset 0 -8px 24px rgba(255, 255, 255, 0.04),
    inset 0 4px 8px rgba(255, 255, 255, 0.08);
  position: relative;
  overflow: hidden;
  animation: anim-ball-shake 0.85s ease-in-out infinite;
}
.anim-ball::before {
  content: '';
  position: absolute;
  top: 14px;
  left: 22px;
  width: 30px;
  height: 18px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  filter: blur(4px);
  transform: rotate(-30deg);
}
.anim-ball-window {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: radial-gradient(circle, #001a08 0%, #002a10 60%, #000f05 100%);
  border: 2px solid #0a3a18;
  box-shadow: inset 0 0 16px rgba(74, 222, 128, 0.4), 0 0 8px rgba(74, 222, 128, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.anim-ball-mist {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(ellipse 80% 60% at 50% 100%, rgba(74, 222, 128, 0.5) 0%, transparent 70%),
    radial-gradient(ellipse 50% 50% at 30% 70%, rgba(74, 222, 128, 0.3) 0%, transparent 60%);
  animation: anim-ball-mist 0.85s ease-in-out infinite;
}
.anim-ball-reveal {
  position: relative;
  z-index: 2;
  font-size: 0.48rem;
  font-weight: 700;
  color: #4ade80;
  text-align: center;
  text-shadow: 0 0 6px #4ade80;
  line-height: 1.2;
  letter-spacing: 0.02em;
  opacity: 0;
  transition: opacity 0.5s ease;
}
.anim-ball-reveal.visible {
  opacity: 1;
}
.anim-ball-cloud {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 70px;
  height: 35px;
  background: radial-gradient(ellipse, rgba(74, 222, 128, 0.25) 0%, transparent 70%);
  filter: blur(8px);
  pointer-events: none;
  animation: anim-ball-cloud 1.5s ease-in-out infinite;
}
@keyframes anim-ball-shake {
  0%, 100% { transform: translateX(0) translateY(0) rotate(0deg); }
  8%        { transform: translateX(-7px) translateY(-4px) rotate(-6deg); }
  16%       { transform: translateX(8px) translateY(3px) rotate(7deg); }
  24%       { transform: translateX(-9px) translateY(-5px) rotate(-8deg); }
  32%       { transform: translateX(7px) translateY(6px) rotate(5deg); }
  40%       { transform: translateX(-5px) translateY(-3px) rotate(-4deg); }
  48%       { transform: translateX(6px) translateY(2px) rotate(3deg); }
  56%       { transform: translateX(-3px) translateY(-4px) rotate(-2deg); }
  64%       { transform: translateX(4px) translateY(1px) rotate(2deg); }
  72%       { transform: translateX(-2px) translateY(-1px) rotate(-1deg); }
  80%       { transform: translateX(0) translateY(0) rotate(0deg); }
}
@keyframes anim-ball-mist {
  0%, 100% { opacity: 0.8; transform: rotate(0deg) scale(1); }
  40%      { opacity: 0.3; transform: rotate(120deg) scale(1.2); }
  70%      { opacity: 1;   transform: rotate(240deg) scale(0.9); }
}
@keyframes anim-ball-cloud {
  0%, 100% { opacity: 0.3; transform: translateX(-50%) scaleY(0.6); bottom: 0; }
  50%      { opacity: 1;   transform: translateX(-50%) scaleY(1.4); bottom: 10px; }
}
```

- [ ] **Step 2: Create eightball.js**

Create `src/animations/eightball.js`:

```js
export const eightBallAnimation = {
  id: 'eightball',
  name: 'Magic 8-Ball',

  render(container, { strainName }) {
    container.innerHTML = `
      <div class="anim-ball-scene">
        <div class="anim-ball">
          <div class="anim-ball-window">
            <div class="anim-ball-mist"></div>
            <div class="anim-ball-reveal"></div>
          </div>
        </div>
        <div class="anim-ball-cloud"></div>
      </div>
    `;

    // Reveal strain name inside the window at 4.5s
    setTimeout(() => {
      const el = container.querySelector('.anim-ball-reveal');
      if (!el) return;
      el.textContent = strainName;
      el.classList.add('visible');
    }, 4500);
  },
};
```

- [ ] **Step 3: Register it**

Update `src/animations/index.js`:

```js
import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

- [ ] **Step 4: Force the animation temporarily to verify**

In `src/animations/index.js`, temporarily override `pickAnimation` to always return the 8-Ball:

```js
export function pickAnimation() {
  return ANIMATIONS.find(a => a.id === 'eightball');
}
```

Run: `npm run dev` — complete the 4 questions and verify:
- Black ball shakes with multi-directional physics throughout the 5s
- Green mist swirls inside the embedded window
- At 4.5s the strain name fades in glowing green inside the window
- At 5s the result screen appears

- [ ] **Step 5: Restore random pickAnimation, commit**

Restore `pickAnimation` to the random version:

```js
export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

```bash
git add src/style.css src/animations/eightball.js src/animations/index.js
git commit -m "feat: add Magic 8-Ball weighing animation"
```

---

## Task 5: Plinko Drop animation

**Files:**
- Edit: `src/style.css`
- Create: `src/animations/plinko.js`
- Edit: `src/animations/index.js`

- [ ] **Step 1: Add Plinko CSS to style.css**

Append to `src/style.css`:

```css
/* ============================================================
   PLINKO DROP ANIMATION
   ============================================================ */
.anim-plinko-board {
  width: 140px;
  height: 205px;
  background: #07070f;
  border: 1.5px solid #1e1e2e;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}
.anim-plinko-peg {
  position: absolute;
  width: 10px;
  height: 10px;
  background: radial-gradient(circle at 35% 30%, #d8b4fe, #7c3aed);
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(192, 132, 252, 0.7);
}
.anim-plinko-leaf {
  position: absolute;
  font-size: 0.72rem;
  line-height: 1;
  top: 6px;
  left: 62px;
  filter: drop-shadow(0 0 4px rgba(74, 222, 128, 0.8));
  animation: anim-plinko-drop 4.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  z-index: 5;
}
.anim-plinko-slots {
  display: flex;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 22px;
  border-top: 1px solid #2a2a3a;
}
.anim-plinko-slot {
  flex: 1;
  border-left: 1px solid #2a2a3a;
  font-size: 0.38rem;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  white-space: nowrap;
  transition: color 0.3s, background 0.3s;
}
.anim-plinko-slot--winner {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
  font-weight: 700;
}
@keyframes anim-plinko-drop {
  0%   { top: 6px;   left: 62px;  transform: rotate(0deg); }
  12%  { top: 30px;  left: 44px;  transform: rotate(-20deg); }
  24%  { top: 55px;  left: 70px;  transform: rotate(15deg); }
  36%  { top: 78px;  left: 48px;  transform: rotate(-22deg); }
  48%  { top: 100px; left: 66px;  transform: rotate(12deg); }
  60%  { top: 122px; left: 55px;  transform: rotate(-14deg); }
  72%  { top: 144px; left: 62px;  transform: rotate(8deg); }
  84%  { top: 158px; left: 63px;  transform: rotate(-4deg); }
  100% { top: 163px; left: 63px;  transform: rotate(0deg); }
}
```

- [ ] **Step 2: Create plinko.js**

Create `src/animations/plinko.js`:

```js
// Peg grid: rows of 4 and 3 pegs alternating on a 140×205px board
// x positions row A (4 pegs): 16, 42, 68, 94 — row B (3 pegs): 29, 55, 81
const PLINKO_PEGS = [
  // row 1 (y=22)
  { x: 16, y: 22 }, { x: 42, y: 22 }, { x: 68, y: 22 }, { x: 94, y: 22 },
  // row 2 (y=47)
  { x: 29, y: 47 }, { x: 55, y: 47 }, { x: 81, y: 47 },
  // row 3 (y=72)
  { x: 16, y: 72 }, { x: 42, y: 72 }, { x: 68, y: 72 }, { x: 94, y: 72 },
  // row 4 (y=97)
  { x: 29, y: 97 }, { x: 55, y: 97 }, { x: 81, y: 97 },
  // row 5 (y=122)
  { x: 16, y: 122 }, { x: 42, y: 122 }, { x: 68, y: 122 }, { x: 94, y: 122 },
  // row 6 (y=147)
  { x: 29, y: 147 }, { x: 55, y: 147 }, { x: 81, y: 147 },
];

export const plinkoAnimation = {
  id: 'plinko',
  name: 'Plinko Drop',

  render(container, { strainName, allScores }) {
    // Slot labels: winner always at index 2 (center), others fill around it
    const others = allScores.slice(1, 5).map(s => s.strainName);
    const slots = [
      others[0] || '???',
      others[1] || '???',
      strainName,          // index 2 = winner, leaf always lands here
      others[2] || '???',
      others[3] || '???',
    ];

    const pegsHTML = PLINKO_PEGS.map(
      p => `<div class="anim-plinko-peg" style="left:${p.x}px;top:${p.y}px"></div>`
    ).join('');

    const slotsHTML = slots.map((name, i) =>
      `<div class="anim-plinko-slot" data-slot="${i}">${name}</div>`
    ).join('');

    container.innerHTML = `
      <div class="anim-plinko-board">
        ${pegsHTML}
        <div class="anim-plinko-leaf">🍃</div>
        <div class="anim-plinko-slots">${slotsHTML}</div>
      </div>
    `;

    // Highlight winner slot when leaf lands (~4.2s animation end)
    setTimeout(() => {
      const slot = container.querySelector('[data-slot="2"]');
      if (slot) slot.classList.add('anim-plinko-slot--winner');
    }, 4300);
  },
};
```

- [ ] **Step 3: Register it**

Update `src/animations/index.js`:

```js
import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';
import { plinkoAnimation }    from './plinko.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
  plinkoAnimation,
];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

- [ ] **Step 4: Force and verify**

Temporarily in `pickAnimation`: `return ANIMATIONS.find(a => a.id === 'plinko');`

Run: `npm run dev` — verify:
- Purple pegs fill a dark board
- Small 🍃 leaf drops from the top, bouncing between pegs over ~4.2s
- Leaf is visibly smaller than the pegs
- At ~4.3s the center slot highlights green with the winning strain name
- Strain name in center slot matches the picked strain

- [ ] **Step 5: Restore random, commit**

```js
export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

```bash
git add src/style.css src/animations/plinko.js src/animations/index.js
git commit -m "feat: add Plinko Drop weighing animation"
```

---

## Task 6: Notes in a Box animation

**Files:**
- Edit: `src/style.css`
- Create: `src/animations/box.js`
- Edit: `src/animations/index.js`

- [ ] **Step 1: Add Box CSS to style.css**

Append to `src/style.css`:

```css
/* ============================================================
   NOTES IN A BOX ANIMATION
   ============================================================ */
.anim-box-scene {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 200px;
  width: 180px;
}
.anim-box-body {
  width: 130px;
  height: 80px;
  background: linear-gradient(160deg, #4a3520, #2e1f0f);
  border: 2px solid #8b6534;
  border-radius: 4px 4px 8px 8px;
  position: relative;
  overflow: visible;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.anim-box-lid {
  position: absolute;
  top: -16px;
  left: -2px;
  right: -2px;
  height: 18px;
  background: linear-gradient(160deg, #5c4228, #3d2812);
  border: 2px solid #8b6534;
  border-radius: 4px 4px 0 0;
  animation: anim-box-lid 5.5s ease-in-out infinite;
  transform-origin: bottom center;
}
.anim-box-note {
  position: absolute;
  width: 28px;
  height: 22px;
  background: #f5f0dc;
  border-radius: 2px;
  font-size: 0.32rem;
  color: #444;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.2;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.anim-box-note::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
}
.anim-box-note:nth-child(2) { top: 12px; left: 10px;  animation: anim-box-n1 5s ease-in-out infinite; }
.anim-box-note:nth-child(3) { top: 16px; left: 48px;  animation: anim-box-n2 5s ease-in-out infinite; }
.anim-box-note:nth-child(4) { top: 10px; left: 86px;  animation: anim-box-n3 5s ease-in-out infinite; }
.anim-box-chosen {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 42px;
  height: 32px;
  background: linear-gradient(160deg, #fffde0, #fff9c0);
  border: 1.5px solid #d4c040;
  border-radius: 3px;
  font-size: 0.4rem;
  font-weight: 700;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.2;
  padding: 2px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5), 0 0 12px rgba(212, 192, 64, 0.4);
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: 10;
}
.anim-box-chosen.visible {
  animation: anim-box-rise 0.6s ease-out forwards;
  opacity: 1;
}
@keyframes anim-box-lid {
  0%, 55%, 100% { transform: rotate(0deg) translateY(0); }
  60%            { transform: rotate(-20deg) translateY(-8px); }
  67%            { transform: rotate(6deg) translateY(-3px); }
  73%            { transform: rotate(-12deg) translateY(-5px); }
  80%            { transform: rotate(3deg) translateY(-1px); }
  86%            { transform: rotate(0deg) translateY(0); }
}
@keyframes anim-box-n1 {
  0%, 25%  { top: 12px; left: 10px;  transform: rotate(-14deg); }
  35%, 55% { top: 6px;  left: 38px;  transform: rotate(10deg); }
  65%, 100%{ top: 12px; left: 10px;  transform: rotate(-14deg); }
}
@keyframes anim-box-n2 {
  0%, 25%  { top: 16px; left: 48px;  transform: rotate(6deg); }
  35%, 55% { top: 8px;  left: 70px;  transform: rotate(-9deg); }
  65%, 100%{ top: 16px; left: 48px;  transform: rotate(6deg); }
}
@keyframes anim-box-n3 {
  0%, 25%  { top: 10px; left: 86px;  transform: rotate(-4deg); }
  35%, 55% { top: 14px; left: 18px;  transform: rotate(12deg); }
  65%, 100%{ top: 10px; left: 86px;  transform: rotate(-4deg); }
}
@keyframes anim-box-rise {
  from { transform: translateX(-50%) translateY(10px); opacity: 0; }
  to   { transform: translateX(-50%) translateY(-60px); opacity: 1; }
}
```

- [ ] **Step 2: Create box.js**

Create `src/animations/box.js`:

```js
export const boxAnimation = {
  id: 'box',
  name: 'Notes in a Box',

  render(container, { strainName, allScores }) {
    // Up to 3 competing notes (besides the winner)
    const competitors = allScores.slice(1, 4).map(s => s.strainName);
    while (competitors.length < 3) competitors.push('???');

    container.innerHTML = `
      <div class="anim-box-scene">
        <div class="anim-box-body">
          <div class="anim-box-lid"></div>
          <div class="anim-box-note">${competitors[0]}</div>
          <div class="anim-box-note">${competitors[1]}</div>
          <div class="anim-box-note">${competitors[2]}</div>
          <div class="anim-box-chosen"></div>
        </div>
      </div>
    `;

    // Reveal winner note rising from the box at 4.5s
    setTimeout(() => {
      const chosen = container.querySelector('.anim-box-chosen');
      if (!chosen) return;
      chosen.textContent = strainName;
      chosen.classList.add('visible');
    }, 4500);
  },
};
```

- [ ] **Step 3: Register it**

Update `src/animations/index.js`:

```js
import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';
import { plinkoAnimation }    from './plinko.js';
import { boxAnimation }       from './box.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
  plinkoAnimation,
  boxAnimation,
];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

- [ ] **Step 4: Force and verify**

Temporarily: `return ANIMATIONS.find(a => a.id === 'box');`

Run: `npm run dev` — verify:
- Wooden box visible with lid on top
- 3 paper notes (showing competing strain names) shuffle and slide around inside
- Lid bounces and rattles during the shuffle
- At 4.5s a gold-bordered note rises up from the box labeled with the winning strain name
- Note stays visible through 5s when result appears

- [ ] **Step 5: Restore random, commit**

```bash
git add src/style.css src/animations/box.js src/animations/index.js
git commit -m "feat: add Notes in a Box weighing animation"
```

---

## Task 7: Tarot Card Draw animation

**Files:**
- Edit: `src/style.css`
- Create: `src/animations/tarot.js`
- Edit: `src/animations/index.js`

- [ ] **Step 1: Add Tarot CSS to style.css**

Append to `src/style.css`:

```css
/* ============================================================
   TAROT CARD DRAW ANIMATION
   ============================================================ */
.anim-tarot-scene {
  position: relative;
  width: 200px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.anim-tarot-card {
  width: 52px;
  height: 90px;
  border-radius: 6px;
  position: absolute;
  border: 1.5px solid #4a3a6a;
  background: repeating-linear-gradient(
    45deg,
    #1a1030 0, #1a1030 4px,
    #261848 4px, #261848 8px
  );
  transform-origin: bottom center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
}
/* Fan positions — updated by JS inline styles */
.anim-tarot-card--c1 { animation: anim-tarot-fan1 4s ease-in-out infinite; }
.anim-tarot-card--c2 { animation: anim-tarot-fan2 4s ease-in-out infinite; }
/* Center card uses a single 5s forwards animation — flip at 4.0s, resolve at 4.5s */
.anim-tarot-card--c3 { animation: anim-tarot-fan3 5s ease-in-out forwards; z-index: 3; }
.anim-tarot-card--c4 { animation: anim-tarot-fan4 4s ease-in-out infinite; }
.anim-tarot-card--c5 { animation: anim-tarot-fan5 4s ease-in-out infinite; }
.anim-tarot-card--winner {
  background: linear-gradient(160deg, #0d2e16, #1a5c30);
  border-color: #4ade80;
  box-shadow: 0 0 24px rgba(74, 222, 128, 0.5), 0 4px 12px rgba(0, 0, 0, 0.6);
}
.anim-tarot-label {
  position: absolute;
  z-index: 4;
  font-size: 0.44rem;
  font-weight: 700;
  color: #4ade80;
  text-shadow: 0 0 8px #4ade80;
  text-align: center;
  line-height: 1.3;
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}
.anim-tarot-label.visible {
  opacity: 1;
}
.anim-tarot-spark {
  position: absolute;
  font-size: 0.85rem;
  opacity: 0;
  pointer-events: none;
  z-index: 5;
  transition: opacity 0.3s ease, transform 0.6s ease;
}
.anim-tarot-spark.pop {
  opacity: 1;
  transform: scale(1.3) translateY(-8px);
}
@keyframes anim-tarot-fan1 {
  0%, 30%  { transform: rotate(-32deg) translateX(-38px); }
  40%, 60% { transform: rotate(-38deg) translateX(-44px) translateY(-4px); }
  70%, 100%{ transform: rotate(-32deg) translateX(-38px); }
}
@keyframes anim-tarot-fan2 {
  0%, 30%  { transform: rotate(-16deg) translateX(-19px); }
  40%, 60% { transform: rotate(-20deg) translateX(-23px) translateY(-2px); }
  70%, 100%{ transform: rotate(-16deg) translateX(-19px); }
}
@keyframes anim-tarot-fan3 {
  /* 5s total: shuffle 0-3.5s, flip to edge at 4.0s, resolve face-front at 4.5s */
  0%, 70%  { transform: rotateY(0deg) rotate(0deg); }   /* 0–3.5s: face-front, shuffling */
  80%      { transform: rotateY(90deg) rotate(0deg); }  /* 4.0s: edge-on (invisible) — JS adds winner class here */
  90%, 100%{ transform: rotateY(0deg) rotate(0deg); }   /* 4.5s: face-front, winner face revealed */
}
@keyframes anim-tarot-fan4 {
  0%, 30%  { transform: rotate(16deg) translateX(19px); }
  40%, 60% { transform: rotate(20deg) translateX(23px) translateY(-2px); }
  70%, 100%{ transform: rotate(16deg) translateX(19px); }
}
@keyframes anim-tarot-fan5 {
  0%, 30%  { transform: rotate(32deg) translateX(38px); }
  40%, 60% { transform: rotate(38deg) translateX(44px) translateY(-4px); }
  70%, 100%{ transform: rotate(32deg) translateX(38px); }
}
```

- [ ] **Step 2: Create tarot.js**

Create `src/animations/tarot.js`:

```js
const SPARK_POSITIONS = [
  { top: '18%', left: '12%' },
  { top: '14%', left: '78%' },
  { top: '58%', left: '6%'  },
  { top: '62%', left: '82%' },
  { top: '8%',  left: '46%' },
];

export const tarotAnimation = {
  id: 'tarot',
  name: 'Tarot Card Draw',

  render(container, { strainName }) {
    const sparksHTML = SPARK_POSITIONS.map(
      pos => `<span class="anim-tarot-spark" style="top:${pos.top};left:${pos.left}">✦</span>`
    ).join('');

    container.innerHTML = `
      <div class="anim-tarot-scene">
        ${sparksHTML}
        <div class="anim-tarot-card anim-tarot-card--c1"></div>
        <div class="anim-tarot-card anim-tarot-card--c2"></div>
        <div class="anim-tarot-card anim-tarot-card--c3"></div>
        <div class="anim-tarot-card anim-tarot-card--c4"></div>
        <div class="anim-tarot-card anim-tarot-card--c5"></div>
        <div class="anim-tarot-label"></div>
      </div>
    `;

    // At 4.0s: card is edge-on (invisible) — swap to winner face while no one can see
    setTimeout(() => {
      const centerCard = container.querySelector('.anim-tarot-card--c3');
      if (centerCard) centerCard.classList.add('anim-tarot-card--winner');
    }, 4000);

    // At 4.5s: card has rotated back face-front showing winner face — show label + sparkles
    setTimeout(() => {
      const label = container.querySelector('.anim-tarot-label');
      if (label) {
        label.textContent = strainName;
        label.classList.add('visible');
      }
      container.querySelectorAll('.anim-tarot-spark').forEach((spark, i) => {
        setTimeout(() => spark.classList.add('pop'), i * 60);
      });
    }, 4500);
  },
};
```

- [ ] **Step 3: Register it**

Update `src/animations/index.js`:

```js
import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';
import { plinkoAnimation }    from './plinko.js';
import { boxAnimation }       from './box.js';
import { tarotAnimation }     from './tarot.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
  plinkoAnimation,
  boxAnimation,
  tarotAnimation,
];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

- [ ] **Step 4: Force and verify**

Temporarily: `return ANIMATIONS.find(a => a.id === 'tarot');`

Run: `npm run dev` — verify:
- 5 face-down cards in a wide fan, shuffling with lateral movement
- At 4.4s center card flips to show a green face
- Strain name appears centered over the flipped card
- 5 sparkles ✦ pop into view around the reveal
- All visible until result screen at 5s

- [ ] **Step 5: Restore random, commit**

```bash
git add src/style.css src/animations/tarot.js src/animations/index.js
git commit -m "feat: add Tarot Card Draw weighing animation"
```

---

## Task 8: Slot Machine Pull animation

**Files:**
- Edit: `src/style.css`
- Create: `src/animations/slots.js`
- Edit: `src/animations/index.js`

- [ ] **Step 1: Add Slot Machine CSS to style.css**

Append to `src/style.css`:

```css
/* ============================================================
   SLOT MACHINE PULL ANIMATION
   ============================================================ */
.anim-slots-scene {
  display: flex;
  align-items: center;
  gap: 10px;
}
.anim-slots-machine {
  width: 120px;
  height: 150px;
  background: linear-gradient(160deg, #1a1a2e, #12122a);
  border: 2px solid #44447a;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  box-shadow: 0 0 24px rgba(192, 132, 252, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
}
.anim-slots-top {
  font-size: 0.48rem;
  letter-spacing: 0.12em;
  color: #c084fc;
  text-transform: uppercase;
  font-weight: 700;
}
.anim-slots-reels {
  display: flex;
  gap: 4px;
}
.anim-slots-reel {
  width: 28px;
  height: 54px;
  background: #0a0a18;
  border-radius: 4px;
  border: 1px solid #333;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.anim-slots-reel::before,
.anim-slots-reel::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  height: 12px;
  z-index: 2;
  pointer-events: none;
}
.anim-slots-reel::before { top: 0;    background: linear-gradient(to bottom, #0a0a18, transparent); }
.anim-slots-reel::after  { bottom: 0; background: linear-gradient(to top,    #0a0a18, transparent); }
.anim-slots-reel-inner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  animation: anim-slots-spin 0.3s linear infinite;
}
.anim-slots-reel-inner span { font-size: 1rem; line-height: 1.4; }
.anim-slots-reel.locked .anim-slots-reel-inner {
  animation-play-state: paused; /* freeze at current position rather than snapping to start */
}
.anim-slots-winline {
  position: absolute;
  top: 50%;
  left: 0; right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent, rgba(74, 222, 128, 0.6), transparent);
  transform: translateY(-50%);
}
.anim-slots-readout {
  font-size: 0.45rem;
  font-weight: 700;
  color: #4ade80;
  letter-spacing: 0.04em;
  text-align: center;
  opacity: 0;
  transition: opacity 0.4s ease;
  min-height: 10px;
}
.anim-slots-readout.visible {
  opacity: 1;
}
.anim-slots-glitter {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.6s ease;
}
.anim-slots-glitter.burst {
  opacity: 1;
  transform: translate(var(--gx), var(--gy)) scale(0.3);
}
.anim-slots-star {
  position: absolute;
  font-size: 0.85rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.5s ease;
}
.anim-slots-star.pop {
  opacity: 1;
  transform: scale(1.3) translateY(-6px);
}
.anim-slots-lever {
  width: 7px;
  height: 34px;
  background: linear-gradient(to bottom, #c084fc, #7c3aed);
  border-radius: 4px;
  position: relative;
  animation: anim-slots-lever 3s ease-in-out infinite;
  transform-origin: top center;
  flex-shrink: 0;
}
.anim-slots-lever::after {
  content: '';
  width: 14px;
  height: 14px;
  background: radial-gradient(circle at 35% 35%, #f87171, #dc2626);
  border-radius: 50%;
  position: absolute;
  bottom: -5px;
  left: -3.5px;
  box-shadow: 0 0 10px rgba(248, 113, 113, 0.7);
}
@keyframes anim-slots-spin {
  from { transform: translateY(0); }
  to   { transform: translateY(-50%); }
}
@keyframes anim-slots-lever {
  0%, 25%, 100% { transform: rotate(0deg); }
  12%            { transform: rotate(32deg); }
}
```

- [ ] **Step 2: Create slots.js**

Create `src/animations/slots.js`:

```js
const REEL_SYMBOLS = ['🌿', '💜', '⭐', '🔥', '💚', '🌿', '💜', '⭐'];

const GLITTER_PARTICLES = [
  { color: '#4ade80', top: '50%', left: '20%', gx: '-18px', gy: '-28px' },
  { color: '#c084fc', top: '40%', left: '50%', gx: '12px',  gy: '-24px' },
  { color: '#fbbf24', top: '55%', left: '70%', gx: '22px',  gy: '-20px' },
  { color: '#38bdf8', top: '45%', left: '30%', gx: '-24px', gy: '-18px' },
  { color: '#f472b6', top: '50%', left: '60%', gx: '16px',  gy: '-30px' },
  { color: '#4ade80', top: '35%', left: '45%', gx: '-8px',  gy: '-34px' },
  { color: '#fbbf24', top: '60%', left: '25%', gx: '-28px', gy: '-22px' },
  { color: '#c084fc', top: '45%', left: '80%', gx: '30px',  gy: '-26px' },
];

const STAR_POSITIONS = [
  { top: '8px',  left: '8px'  },
  { top: '8px',  right: '8px' },
  { bottom: '10px', left: '10px'  },
  { bottom: '10px', right: '10px' },
];

export const slotsAnimation = {
  id: 'slots',
  name: 'Slot Machine Pull',

  render(container, { strainName }) {
    const reelHTML = (symbols) => `
      <div class="anim-slots-reel">
        <div class="anim-slots-reel-inner">
          ${symbols.map(s => `<span>${s}</span>`).join('')}
        </div>
      </div>
    `;

    const glitterHTML = GLITTER_PARTICLES.map(
      p => `<div class="anim-slots-glitter"
              style="background:${p.color};top:${p.top};left:${p.left};--gx:${p.gx};--gy:${p.gy}"></div>`
    ).join('');

    const starsHTML = STAR_POSITIONS.map(pos => {
      const style = Object.entries(pos).map(([k, v]) => `${k}:${v}`).join(';');
      return `<span class="anim-slots-star" style="${style}">✦</span>`;
    }).join('');

    container.innerHTML = `
      <div class="anim-slots-scene">
        <div class="anim-slots-machine">
          <div class="anim-slots-top">🍀 Strain Picker</div>
          <div class="anim-slots-reels">
            ${reelHTML(REEL_SYMBOLS.slice(0, 4))}
            ${reelHTML(REEL_SYMBOLS.slice(2, 6))}
            ${reelHTML(REEL_SYMBOLS.slice(4, 8))}
          </div>
          <div class="anim-slots-winline"></div>
          <div class="anim-slots-readout"></div>
          ${glitterHTML}
          ${starsHTML}
        </div>
        <div class="anim-slots-lever"></div>
      </div>
    `;

    const reels = container.querySelectorAll('.anim-slots-reel');

    // Lock reels one by one
    setTimeout(() => { if (reels[0]) reels[0].classList.add('locked'); }, 2500);
    setTimeout(() => { if (reels[1]) reels[1].classList.add('locked'); }, 3500);
    setTimeout(() => { if (reels[2]) reels[2].classList.add('locked'); }, 4250);

    // Celebrate and show strain name at 4.5s
    setTimeout(() => {
      // Burst glitter
      container.querySelectorAll('.anim-slots-glitter').forEach((el, i) => {
        setTimeout(() => el.classList.add('burst'), i * 30);
      });
      // Pop corner stars
      container.querySelectorAll('.anim-slots-star').forEach((el, i) => {
        setTimeout(() => el.classList.add('pop'), i * 50);
      });
      // Show readout
      const readout = container.querySelector('.anim-slots-readout');
      if (readout) {
        readout.textContent = strainName;
        readout.classList.add('visible');
      }
    }, 4500);
  },
};
```

- [ ] **Step 3: Register it**

Update `src/animations/index.js`:

```js
import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';
import { plinkoAnimation }    from './plinko.js';
import { boxAnimation }       from './box.js';
import { tarotAnimation }     from './tarot.js';
import { slotsAnimation }     from './slots.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
  plinkoAnimation,
  boxAnimation,
  tarotAnimation,
  slotsAnimation,
];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

- [ ] **Step 4: Force and verify**

Temporarily: `return ANIMATIONS.find(a => a.id === 'slots');`

Run: `npm run dev` — verify:
- Slot machine with 3 spinning reels visible
- Lever animates at start
- Reel 1 locks at ~2.5s, Reel 2 at ~3.5s, Reel 3 at ~4.25s
- At 4.5s: glitter + corner sparkles burst, strain name appears in readout
- Result screen at 5s

- [ ] **Step 5: Restore random, commit**

```bash
git add src/style.css src/animations/slots.js src/animations/index.js
git commit -m "feat: add Slot Machine Pull weighing animation"
```

---

## Task 9: Crystal Ball Oracle animation

**Files:**
- Edit: `src/style.css`
- Create: `src/animations/crystal.js`
- Edit: `src/animations/index.js`

- [ ] **Step 1: Add Crystal Ball CSS to style.css**

Append to `src/style.css`:

```css
/* ============================================================
   CRYSTAL BALL ORACLE ANIMATION
   ============================================================ */
.anim-crystal-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse 80% 60% at 50% 100%, rgba(120, 40, 180, 0.4) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 50% 50%,  rgba(80, 20, 140, 0.22) 0%, transparent 80%);
  overflow: hidden;
}
.anim-crystal-haze {
  position: absolute;
  border-radius: 50%;
  filter: blur(18px);
  pointer-events: none;
}
.anim-crystal-haze--1 {
  width: 90px; height: 44px;
  background: rgba(160, 80, 255, 0.22);
  bottom: 10%; left: 5%;
  animation: anim-crystal-haze 4s ease-in-out infinite;
}
.anim-crystal-haze--2 {
  width: 70px; height: 34px;
  background: rgba(120, 40, 220, 0.28);
  bottom: 20%; right: 6%;
  animation: anim-crystal-haze 4s ease-in-out infinite 1.2s;
}
.anim-crystal-haze--3 {
  width: 110px; height: 55px;
  background: rgba(74, 222, 128, 0.1);
  bottom: 5%; left: 18%;
  animation: anim-crystal-haze 4s ease-in-out infinite 0.6s;
}
.anim-crystal-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
}
.anim-crystal-ball {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 28%,
    rgba(200, 220, 255, 0.35) 0%,
    rgba(100, 140, 255, 0.15) 25%,
    rgba(60, 80, 200, 0.1) 55%,
    rgba(10, 5, 40, 0.9) 100%
  );
  border: 2px solid rgba(160, 180, 255, 0.35);
  box-shadow:
    0 0 40px rgba(120, 80, 255, 0.5),
    0 0 80px rgba(80, 40, 200, 0.25),
    inset 0 0 40px rgba(120, 80, 255, 0.15);
  position: relative;
  overflow: hidden;
  animation: anim-crystal-breath 3.5s ease-in-out infinite;
}
.anim-crystal-smoke {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
.anim-crystal-smoke--1 {
  background:
    radial-gradient(ellipse 70% 50% at 50% 90%, rgba(74, 222, 128, 0.4) 0%, transparent 65%),
    radial-gradient(ellipse 40% 60% at 20% 60%, rgba(192, 132, 252, 0.35) 0%, transparent 65%);
  animation: anim-crystal-rot1 2.8s linear infinite;
}
.anim-crystal-smoke--2 {
  background:
    radial-gradient(ellipse 55% 40% at 80% 40%, rgba(160, 60, 255, 0.4) 0%, transparent 60%),
    radial-gradient(ellipse 50% 55% at 30% 80%, rgba(74, 222, 128, 0.25) 0%, transparent 65%);
  animation: anim-crystal-rot2 3.5s linear infinite reverse;
}
.anim-crystal-smoke--3 {
  background: radial-gradient(ellipse 80% 30% at 50% 60%, rgba(255, 255, 255, 0.08) 0%, transparent 70%);
  animation: anim-crystal-rot3 4.2s ease-in-out infinite;
}
.anim-crystal-shine {
  position: absolute;
  top: 16px;
  left: 20px;
  width: 26px;
  height: 16px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  filter: blur(4px);
  transform: rotate(-30deg);
}
.anim-crystal-tendril {
  position: absolute;
  bottom: 100%;
  border-radius: 50%;
  filter: blur(6px);
  pointer-events: none;
  animation: anim-crystal-tendril 3s ease-in-out infinite;
}
.anim-crystal-tendril--1 { width: 12px; height: 28px; background: rgba(160, 80, 255, 0.4);  left: 38%; animation-delay: 0s; }
.anim-crystal-tendril--2 { width: 8px;  height: 20px; background: rgba(74, 222, 128, 0.3);  left: 54%; animation-delay: 0.7s; }
.anim-crystal-tendril--3 { width: 10px; height: 24px; background: rgba(160, 80, 255, 0.35); left: 46%; animation-delay: 1.4s; }
.anim-crystal-name {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.46rem;
  font-weight: 700;
  color: #e0d8ff;
  text-shadow: 0 0 10px rgba(180, 140, 255, 0.9);
  text-align: center;
  z-index: 3;
  line-height: 1.3;
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
}
.anim-crystal-name.visible {
  opacity: 1;
}
.anim-crystal-base {
  width: 75px;
  height: 16px;
  background: linear-gradient(to right, #120820, #3d1a7a, #120820);
  border-radius: 6px;
  margin-top: 6px;
  box-shadow: 0 4px 16px rgba(100, 0, 200, 0.3);
}
@keyframes anim-crystal-haze {
  0%, 100% { transform: translateY(0) scaleX(1); opacity: 0.5; }
  50%      { transform: translateY(-12px) scaleX(1.2); opacity: 1; }
}
@keyframes anim-crystal-breath {
  0%, 100% { box-shadow: 0 0 40px rgba(120,80,255,0.5),  0 0 80px rgba(80,40,200,0.25),  inset 0 0 40px rgba(120,80,255,0.15); }
  50%      { box-shadow: 0 0 60px rgba(120,80,255,0.85), 0 0 120px rgba(80,40,200,0.4), inset 0 0 60px rgba(120,80,255,0.25); }
}
@keyframes anim-crystal-rot1 {
  from { transform: rotate(0deg) scale(1); }
  50%  { transform: rotate(180deg) scale(1.15); }
  to   { transform: rotate(360deg) scale(1); }
}
@keyframes anim-crystal-rot2 {
  from { transform: rotate(0deg) scale(1.1); }
  50%  { transform: rotate(180deg) scale(0.9); }
  to   { transform: rotate(360deg) scale(1.1); }
}
@keyframes anim-crystal-rot3 {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.2); }
}
@keyframes anim-crystal-tendril {
  0%   { opacity: 0; transform: translateY(0) scaleX(1); }
  20%  { opacity: 0.8; }
  80%  { opacity: 0.2; transform: translateY(-28px) scaleX(1.8); }
  100% { opacity: 0;   transform: translateY(-40px) scaleX(2.4); }
}
```

- [ ] **Step 2: Create crystal.js**

Create `src/animations/crystal.js`:

```js
export const crystalAnimation = {
  id: 'crystal',
  name: 'Crystal Ball Oracle',

  render(container, { strainName }) {
    container.innerHTML = `
      <div class="anim-crystal-scene">
        <div class="anim-crystal-haze anim-crystal-haze--1"></div>
        <div class="anim-crystal-haze anim-crystal-haze--2"></div>
        <div class="anim-crystal-haze anim-crystal-haze--3"></div>
        <div class="anim-crystal-wrap">
          <div style="position:relative">
            <div class="anim-crystal-tendril anim-crystal-tendril--1"></div>
            <div class="anim-crystal-tendril anim-crystal-tendril--2"></div>
            <div class="anim-crystal-tendril anim-crystal-tendril--3"></div>
            <div class="anim-crystal-ball">
              <div class="anim-crystal-smoke anim-crystal-smoke--1"></div>
              <div class="anim-crystal-smoke anim-crystal-smoke--2"></div>
              <div class="anim-crystal-smoke anim-crystal-smoke--3"></div>
              <div class="anim-crystal-shine"></div>
              <div class="anim-crystal-name"></div>
            </div>
          </div>
          <div class="anim-crystal-base"></div>
        </div>
      </div>
    `;

    // Strain name materializes inside ball at 4.5s
    setTimeout(() => {
      const nameEl = container.querySelector('.anim-crystal-name');
      if (!nameEl) return;
      nameEl.textContent = strainName;
      nameEl.classList.add('visible');
    }, 4500);
  },
};
```

- [ ] **Step 3: Register all 7 animations**

Final `src/animations/index.js`:

```js
import { scalesAnimation }   from './scales.js';
import { eightBallAnimation } from './eightball.js';
import { plinkoAnimation }    from './plinko.js';
import { boxAnimation }       from './box.js';
import { tarotAnimation }     from './tarot.js';
import { slotsAnimation }     from './slots.js';
import { crystalAnimation }   from './crystal.js';

export const ANIMATIONS = [
  scalesAnimation,
  eightBallAnimation,
  plinkoAnimation,
  boxAnimation,
  tarotAnimation,
  slotsAnimation,
  crystalAnimation,
];

export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

- [ ] **Step 4: Force and verify**

Temporarily: `return ANIMATIONS.find(a => a.id === 'crystal');`

Run: `npm run dev` — verify:
- Deep purple ambient haze fills the background of the host
- Glowing crystal ball with rotating multi-layer smoke (green + purple)
- Smoke tendrils rising from the top of the ball
- Ball pulses brighter periodically
- At 4.5s the strain name materializes inside the ball in white-purple
- Result screen at 5s

- [ ] **Step 5: Restore random, commit**

```bash
git add src/style.css src/animations/crystal.js src/animations/index.js
git commit -m "feat: add Crystal Ball Oracle weighing animation"
```

---

## Task 10: Final integration pass

**Files:**
- Verify: all 7 animations, no debug code

- [ ] **Step 1: Confirm no forced overrides remain**

Check `src/animations/index.js` — `pickAnimation()` must be the random version:

```js
export function pickAnimation() {
  return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
}
```

- [ ] **Step 2: Full random rotation verification**

Run: `npm run dev`

Run through the app 7+ times (add 2 strains, complete 4 questions each time). Confirm:
- Different animations appear across sessions (pure random — repetition is possible but unlikely with 7 options)
- Each animation fills the full 5 seconds
- Strain name is visible inside the animation before the result screen appears
- Quote is visible below the animation the entire 5s
- Result screen appears exactly at 5s with correct strain name, score, and reasoning
- "Return Home" button works correctly after each animation

- [ ] **Step 3: Edge case — stash with only 2 strains**

Add exactly 2 strains. Run the picker. Verify:
- Plinko: only 2 strain names show in slots (remaining slots show '???') — leaf still lands in slot 2
- Box: fewer competitor notes visible (uses '???' for missing ones)
- All other animations show only `strainName` and are unaffected

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: 7-animation randomized weighing phase system (5s, strain revealed at 4.5s)"
```
