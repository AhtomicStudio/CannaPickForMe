# CannaPickForMe — Matching Animation Polish Plan

**Audience:** Claude Sonnet 4.6, working in the `CannaPickForMe` repo.
**Mission:** Take six of the seven existing matching animations from "functional" to "delightful," **retire `plinko`**, and **add four brand-new scenes** so the picker rotates through ten total. Add anticipation, climax, follow-through, kinetic punch, and tactile feedback. Do **not** lengthen the 5-second window. Do **not** rewrite the architecture. Each scene should still feel like itself — only more alive. The four new scenes follow the same three-act model and use the shared kinetic toolkit so they belong to the family from day one.

**Why plinko is being retired (not just polished):** the leaf's path is a single hardcoded `@keyframes`, so the winner is *always* `data-slot="2"` (the middle slot) and the path never varies — players notice this on the second view. The 140×205px board also forces 0.38rem text on the slot labels, which is unreadable on a phone. Tonally, casino-show plinko is the odd one out among six mystical/tactile/playful metaphors. We replace it with four richer scenes (see §9) and remove `plinko.js` from the picker.

---

## 1. Where everything lives

| Concern | Path |
|---|---|
| Scene controllers (HTML + JS timing) — surviving | `src/animations/{scales,eightball,box,tarot,slots,crystal}.js` |
| Scene controllers — to be created | `src/animations/{bee,wheel,bingo,ember}.js` |
| Scene controllers — to be removed | `src/animations/plinko.js` (delete after picker is updated) |
| Picker | `src/animations/index.js` (random pick from `ANIMATIONS[]`) |
| All keyframes + scene CSS | `src/style.css` lines ~1304–2698 |
| Design tokens (colors, easings, durations) | `src/tokens.css` |
| Reduced-motion overrides | `src/tokens.css` lines ~153–178 |
| Mount point + duration contract | `src/main.js` ~line 924 (`WEIGH_DURATION = 5000`), render call ~line 945 |
| Render contract | `anim.render(host, { strainName, allScores })` — `allScores[].strainName` is available everywhere even if the current scene ignores it |

**Hard constraints:**
- Total scene budget = **5000 ms** (the result screen swaps in at exactly 5s — see `main.js:958`).
- Reveal copy must be readable by ~4500 ms so it has at least 500 ms on screen before swap.
- Use **`var(--…)` tokens** for colors, easings, durations. Never hardcode `#4ade80`, etc.
- Honor `prefers-reduced-motion`: ambient loops `paused`, climax effects suppressed. Pattern already exists in `tokens.css` — extend it, don't fight it.
- All transforms must be GPU-friendly: `transform` + `opacity` only inside loops. No animating `top`/`left` in 60fps loops (the existing `plinko-drop` is the lone exception because it runs once).

---

## 2. The three-act model — apply to every scene

Right now most scenes are: **ambient loop the whole time → fade in name at 4.5s.** That's two beats. We want three:

```
0.0 ─────── 1.4s ────────── 3.8s ─────────── 4.4s ──── 5.0s
│  ACT 1   │      ACT 2     │   ACT 3 climax │  hold  │
│  ANTICIP │     ACTION     │     REVEAL     │        │
│          │                │                │        │
└ enter +  └ the "doing" of └ stop, flash,   └ name   ┘
  settle    the metaphor     burst, settle    visible
```

**Act 1 (0 → 1.4s) — Anticipation.** The scene assembles or charges up. Examples:
- Scales: pillar drops in from below, plates settle with a gentle bounce.
- 8-ball: enters from off-screen with a small overshoot, then begins shaking.
- Crystal ball: dim, then pulse-charges as haze gathers.
- Slots: machine "boots" — top label scans on, lever cocks back.

**Act 2 (1.4 → 3.8s) — Action.** The metaphor does its job. This is the existing animation, but with **secondary motion** layered on (see toolkit §4).

**Act 3 (3.8 → 4.4s) — Climax + reveal.** The "stop the press" moment. Hard easing change (`cubic-bezier(.2,.9,.3,1.4)` style overshoot), color flash, particle burst, brief container shake (4–6 px, 250 ms, `cubic-bezier(.36,.07,.19,.97)`), then the strain name lands with a `scale(0.6) → scale(1.05) → scale(1)` pop.

**Act 4 (4.4 → 5.0s) — Hold.** Name is visible, secondary glow continues, scene settles. Don't keep shaking — let the user read.

Add a token cluster to `tokens.css`:

```css
--ease-snap:    cubic-bezier(0.2, 0.9, 0.3, 1.4);   /* overshoot punch */
--ease-thwack:  cubic-bezier(0.36, 0.07, 0.19, 0.97); /* shake */
--ease-charge:  cubic-bezier(0.4, 0, 0.6, 1);       /* hold then release */
--anim-act1-end: 1400ms;
--anim-act2-end: 3800ms;
--anim-climax:   4200ms;
--anim-reveal:   4500ms;
```

Use these as keyframe percentages and JS `setTimeout` values. **Single source of truth for timing.**

---

## 3. The shared kinetic toolkit (build once, reuse everywhere)

Add a new file `src/animations/_kinetic.js` exporting tiny helpers. Every scene imports from it. This is what makes the family feel coherent.

### 3a. `burstParticles(container, opts)`
Spawns N small DOM nodes at a center point, each with a random angle/distance, and removes them after the animation ends. Use for the climax in **every** scene.

```js
// Spawns 14 particles in a ring. Each gets a random hue from the scene palette,
// a random distance 40–80px, and travels along a CSS custom-property vector.
burstParticles(host, {
  count: 14,
  origin: { x: '50%', y: '50%' },
  palette: ['var(--green-glow)', 'var(--purple-glow)', 'var(--gold-glow)'],
  duration: 800,
  className: 'kfx-spark',
});
```

CSS in `style.css`:
```css
.kfx-spark {
  position: absolute; width: 6px; height: 6px; border-radius: 50%;
  pointer-events: none; opacity: 0;
  animation: kfx-spark 800ms var(--ease-out) forwards;
  transform: translate(-50%, -50%);
}
@keyframes kfx-spark {
  0%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  60%  { opacity: 1; }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2); }
}
```

### 3b. `shake(el, { magnitude, duration })`
Adds a class that runs a brief positional jitter, then removes it. Use on the **scene root** at climax for plinko (impact), 8-ball (final shake), slots (last reel lock), box (lid slam), crystal (vision crystallizes).

### 3c. `flashGlow(el, { color, duration })`
Pulses a `box-shadow` once. Use on the strain-name container the instant it becomes visible.

### 3d. `confetti(host, { count, palette, gravity, spread })`
Top-down falling pieces (4×6 px rotated rects). Reserve for the **biggest** wins — slots three-in-a-row, scales tipping decisively. Don't use on every scene or it loses meaning.

### 3e. `screenPunch(host, { scale })`
Briefly scales the *entire scene container* `1 → 1.04 → 1` over 240ms at the climax. Tactile "thud" without actual sound. Use on box, plinko, slots.

### 3f. Reduced-motion guard
All helpers should bail to "static end-state" when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. Centralize this check in `_kinetic.js`.

---

## 4. Secondary-motion catalog

The single biggest reason these scenes feel "boring" is everything moves *together* on the same beat. Add **counter-motion**:

- **Light follows action.** When the plinko leaf lands, the board's inner glow brightens for 200ms.
- **Things react to other things.** When a scales plate gets a name, the *opposite* plate dips slightly. When a slots reel locks, the machine frame jitters 1px down.
- **Anticipation snap.** Right before the climax, every scene does a 100ms "wind-up" — the 8-ball pauses dead still for one frame before the final shake; the crystal ball dims for 80ms before the name materializes; the tarot card pauses edge-on slightly longer than feels natural before flipping.
- **Follow-through.** After the climax, motion *decays* — don't stop dead. The 8-ball shakes more gently for 400ms after revealing. The plinko leaf wobbles in its slot. The crystal ball's smoke calms but doesn't freeze.
- **Idle breathing.** Add a 2% scale `breathe` animation at 6s loop to the *outer* scene container of every scene during Act 4 so the reveal doesn't feel frozen.

---

## 5. Per-animation prescriptions

Each section below is the spec for that one file. Keep the existing `id` and `name`. Keep the render signature.

### 5a. `scales.js` — Weighing Scales

**Current problems:** Beam pivots on a generic loop. Names plop in. No payoff — the scales never "decide."

**Upgrade:**
1. **Anticipation (0–1.2s):** Pillar slides up from below the base (`translateY(40px) → 0`, `--ease-snap`). Beam stays level. Empty plates wobble once on settle.
2. **Action (1.2–3.6s):** As each name appears on its plate, the beam tips toward that side proportional to *index weight* (heavier names later — make later additions thump harder). Use `transform: rotate()` with discrete keyframe stops keyed off name count, not a generic infinite weigh loop. Each name appearance triggers a small `screenPunch` on its plate (1.06 scale, 180ms).
3. **Climax (3.6–4.4s):** Beam decisively tips to the **winning side** (which is `allScores[0]` — pass it through). Plate on losing side flies up; plate on winning side slams down with a `shake` and a `burstParticles` from the winning plate (gold + green palette).
4. **Reveal (4.4–5.0s):** A small "WINNER" ribbon appears above the heavy plate — but since this scene already shows multiple names, the *winner pill* on the heavy side gets a **golden border, scale 1.15, and a glow flash**. No separate readout needed; the scene's metaphor already declared a winner.

**New animation parameter:** Pass `winnerName = allScores[0].strainName` into `render()` from `main.js`. Update the call in `main.js:945`.

---

### 5b. `eightball.js` — Magic 8-Ball

**Current problems:** Continuous shake the whole time = visual noise. No moment of truth. Reveal text is small and dim.

**Upgrade:**
1. **Anticipation (0–1.0s):** Ball flies in from bottom (`translateY(180%) rotate(-25deg)` → settled) with `--ease-snap`. A tiny bounce on landing (2 oscillations).
2. **Action (1.0–3.6s):** Three discrete "shake bursts" — each is a hard `--ease-thwack` jitter for 350ms followed by 400ms of stillness. **Stillness between bursts is the key** — that's the anticipation that's missing now. During each shake, the inner mist swirls faster.
3. **Wind-up (3.6–3.9s):** Ball goes completely still. Mist clears (opacity 1 → 0.2). Window goes slightly darker.
4. **Climax (3.9–4.4s):** Mist *snaps* back in bright green, window glows hot, `flashGlow` on the window border, `burstParticles` (green palette, 8 particles, escaping through the bottom seam of the ball).
5. **Reveal (4.4–5.0s):** Strain name fades up **at 0.62rem** (currently 0.48rem — too small to read). Add a 1px `text-shadow` chain for that classic 8-ball oracle look. Ball does a slow gentle wobble (follow-through) for the last 600ms.

---

### 5c. ~~`plinko.js`~~ — **RETIRED**

Removed from the picker and replaced by the four new scenes in §9. After §6/step 1 (updating `index.js`) and §9 are complete, **delete `src/animations/plinko.js`** and remove its CSS block from `style.css` (lines ~2120–2187, the `/* PLINKO DROP ANIMATION */` section). Don't keep dead code.

---

### 5d. `box.js` — Notes in a Box

**Current problems:** Lid opens on a loop forever. Notes wiggle on a loop. There's no "pick" gesture. The chosen note rises straight up — no drama.

**Upgrade:**
1. **Anticipation (0–1.0s):** Box drops in from above with `--ease-snap` overshoot. Lid is closed. A `?` shimmers on the lid.
2. **Action 1 (1.0–2.4s):** Lid opens **once** with a satisfying creak motion (rotate -75deg with a small overshoot). Three notes pop up out of the box and float in a slow shuffle — they swap positions twice, like a shell game.
3. **Action 2 (2.4–3.8s):** A tiny "hand" emoji or a glowing cursor (your call) reaches in. Notes shuffle faster (anticipation building). Container has a faint `screenPunch` rumble.
4. **Wind-up (3.8–4.0s):** Hand selects one note — that note glows but stays inside the box for one beat. Other two notes fade to 30% opacity.
5. **Climax (4.0–4.4s):** Chosen note **shoots up out of the box** with `--ease-snap` (overshoot to ~80px above box, settle to 60px), trailing a `burstParticles` of gold sparks. Lid slams shut behind it (`screenPunch` on the box at the slam moment). The two losing notes flutter back into the box.
6. **Reveal (4.4–5.0s):** Chosen note hovers in place with a gentle 3-degree sway and a soft golden glow. Make the chosen-note text **0.55rem** so it's actually legible.

---

### 5e. `tarot.js` — Tarot Card Draw

**Current problems:** This one's the closest to good. The flip works. But the fan is static, the sparks are tiny, the reveal feels small.

**Upgrade:**
1. **Anticipation (0–1.0s):** Cards deal in one at a time from off-screen-bottom (right edge), each landing into its fan position with a 120ms delay between cards. Use `--ease-snap`.
2. **Action (1.0–3.6s):** Cards do a slow synchronized hover (existing fan keyframes are fine — just shorten and don't loop forever, run twice). A faint mystic glow pulses behind the fan center, building intensity.
3. **Wind-up (3.6–4.0s):** Outer four cards fade to 60% and shift outward another 8px. Center card pauses dead still — the others recede to make it the focus.
4. **Flip (4.0–4.3s):** Center card flips. **Improve the flip** by combining `rotateY` with a slight `scale(1.1)` at the midpoint so the card feels like it has weight.
5. **Climax (4.3–4.5s):** Card face appears with green glow, `flashGlow`, and **5 large sparks** (currently 0.85rem — bump to 1.4rem) explode outward from the card center using `burstParticles`. Add a brief `screenPunch` on the scene (1.03 scale).
6. **Reveal (4.5–5.0s):** Label appears below the card at **0.58rem** (currently 0.44rem). Card does a slow gentle 2° sway. Outer cards stay dim — the chosen one is the star.

---

### 5f. `slots.js` — Slot Machine

**Current problems:** Reels lock in but with no individual punch. Lever pulls on a loop instead of being tied to the action. The "win" doesn't feel like a casino win.

**Upgrade:**
1. **Anticipation (0–1.0s):** Machine drops in from above, lands with a `--ease-snap` bounce. Top label scans on letter-by-letter. Lever is fully cocked back, holding.
2. **Pull (1.0–1.4s):** Lever snaps down hard (`--ease-snap`, 250ms), reels start spinning. **One pull, not a loop.** After the snap, lever returns slowly to neutral.
3. **Spin (1.4–2.4s):** Reels blur (CSS `filter: blur(1px)` on `.anim-slots-reel-inner` while spinning, removed when locked).
4. **Sequential lock (2.4–4.2s):** Each reel locks with a hard stop + a small `shake` on the reel + a 1px downward jitter on the whole machine + a quick yellow flash on the reel border. Reel 1 at 2.5s, reel 2 at 3.3s, reel 3 at 4.2s. **Slow the gaps** between locks — anticipation is what makes slots feel exciting.
5. **Wind-up (4.2–4.3s):** All three reels are locked. Machine is dead still. Win-line dims.
6. **Climax (4.3–4.6s):** Win-line flares bright green, **all three reel symbols swap to 🌿** for the win frame, machine `screenPunch` 1.06, `confetti` (the only scene that earns confetti), `burstParticles` from the win-line center, glitter and stars trigger as currently designed but **bigger and faster**.
7. **Reveal (4.6–5.0s):** Readout text at **0.62rem**. Lever does a small celebratory wobble. Top label flashes "WINNER!" alternating with "🍀 Strain Picker".

---

### 5g. `crystal.js` — Crystal Ball Oracle

**Current problems:** The most ambient of all. Beautiful but inert. The smoke just rotates forever; there's no moment of revelation.

**Upgrade:**
1. **Anticipation (0–1.2s):** Scene starts dim (background overlay 60% black). Base slides up from below. Ball is dark glass — barely glowing. Hands/tendrils enter from below the ball (existing tendrils animation can play but slower).
2. **Action (1.2–3.4s):** Ball begins to "wake up" — purple glow grows in 3 stages (subtle, medium, strong). Smoke layers swirl faster as glow intensifies. Haze plumes enter from sides and converge into the ball.
3. **Wind-up (3.4–3.8s):** Ball goes **almost dark** for 400ms — a held breath. All smoke pulls toward center. Tendrils pause.
4. **Climax (3.8–4.4s):** Ball *flashes* white-purple (`flashGlow` brightness 2× for 200ms), shoots out radial lines of light (5 lines, expanding `border-radius` element behind the ball), `burstParticles` (purple + green palette, 12 particles, escaping outward through the surface). `screenPunch` 1.04.
5. **Reveal (4.4–5.0s):** Strain name materializes — but **letter-by-letter** typewriter effect over 400ms (use a tiny JS helper to append characters with a `transform: scale(0.5) → 1` per letter). Text at **0.6rem**. Ball settles into a slow breathing glow. Tendrils resume softly.

---

## 6. Cross-cutting tasks

In addition to the six scene rewrites and four new scenes, do these:

1. **Pass `winnerName` into every render call.** Edit `src/main.js` ~line 945 to add `winnerName: result.allScores[0].strainName`. Update each animation's render signature to accept it (most already use `strainName`, which is the same value — harmonize).
2. **Update the picker.** Replace `src/animations/index.js` with:
   ```js
   import { scalesAnimation }   from './scales.js';
   import { eightBallAnimation } from './eightball.js';
   import { boxAnimation }       from './box.js';
   import { tarotAnimation }     from './tarot.js';
   import { slotsAnimation }     from './slots.js';
   import { crystalAnimation }   from './crystal.js';
   import { beeAnimation }       from './bee.js';
   import { wheelAnimation }     from './wheel.js';
   import { bingoAnimation }     from './bingo.js';
   import { emberAnimation }     from './ember.js';

   export const ANIMATIONS = [
     scalesAnimation, eightBallAnimation, boxAnimation, tarotAnimation,
     slotsAnimation, crystalAnimation, beeAnimation, wheelAnimation,
     bingoAnimation, emberAnimation,
   ];

   export function pickAnimation() {
     return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
   }
   ```
   Then **delete `src/animations/plinko.js`** and the `/* PLINKO DROP ANIMATION */` CSS block in `style.css` (~lines 2120–2187).
3. **Introduce shared utility file `src/animations/_kinetic.js`** with the toolkit from §3. Every scene imports from it.
4. **Add the new tokens** in §2 to `tokens.css`.
5. **Centralize timing constants.** Each scene file should declare `const ACT1=1400, ACT2=3800, CLIMAX=4200, REVEAL=4500;` at the top so timings are readable and tweakable.
6. **Reveal text sizes:** raise minimums to **0.55rem–0.62rem** depending on container (see per-scene specs). The current 0.4rem range is a polish tax.
7. **Reduced-motion paths:** every climax effect (particles, screen punch, confetti, shake) should no-op when reduced motion is preferred. Already-present infrastructure in `tokens.css` covers ambient loops; add JS-side guards in `_kinetic.js`.
8. **Performance audit after each scene:** verify only `transform` / `opacity` / `filter` / `box-shadow` are animated. No `top`/`left`/`width`/`height` in keyframes that loop.
9. **No new asset files.** Everything is CSS + DOM. Particles are divs. Sparks are unicode glyphs scaled up. Confetti is rotated rects. Bee, lighter, joint — all CSS shapes.
10. **Track a new analytics value.** `main.js:954` already logs `animation: anim?.id`. Confirm the new ids (`bee`, `wheel`, `bingo`, `ember`) flow through without code changes. They will, because `id` is read off the animation object.

---

## 7. Order of operations (for Sonnet)

Don't try to ship all ten at once. Work in this order so each scene benefits from infrastructure built in the prior step:

**Phase A — Foundations (do these first, in order, no shortcuts):**
1. Add new tokens to `tokens.css`.
2. Create `src/animations/_kinetic.js` with `burstParticles`, `shake`, `flashGlow`, `screenPunch`, `confetti`, reduced-motion guard. Add the small CSS that backs these helpers to `style.css` (under a new `/* === KINETIC TOOLKIT === */` banner).
3. Update `main.js` to pass `winnerName` in the render call.
4. Update `src/animations/index.js` per §6/step 2 (add the four new imports, drop plinko). The four new files won't exist yet — add them as empty exports stubs first so the import doesn't crash, then fill them in below.

**Phase B — Polish surviving scenes (validates the toolkit):**
5. Rewrite **`eightball.js`** first — simplest scene, proves the three-act model.
6. Rewrite **`crystal.js`** — exercises typewriter reveal + flash + dim-and-burst climax.
7. Rewrite **`box.js`** — exercises the "select" gesture and `screenPunch`.
8. Rewrite **`tarot.js`** — exercises sequential entry + dim-and-focus.
9. Rewrite **`scales.js`** — exercises "decide a winner" using `allScores[0]`.
10. Rewrite **`slots.js`** — exercises sequential lock-ins + the only `confetti` use.

**Phase C — Build the four new scenes (per §9):**
11. Build **`bee.js`** first of the new four — closest in spirit to the existing scenes (organic, garden-themed, similar to scales/box in DOM complexity).
12. Build **`wheel.js`** — exercises JS-computed final rotation matched to `winnerName`.
13. Build **`bingo.js`** — exercises multi-body randomized motion inside a container.
14. Build **`ember.js`** last — most ambitious; exercises smoke text materialization. Save the gnarliest scene for when the toolkit is most polished.

**Phase D — Cleanup:**
15. Delete `src/animations/plinko.js` and its CSS block.
16. Run a full questionnaire pass that re-rolls until each of the ten scenes is observed at least once. Record per-scene timing/legibility notes.

After each scene, **manually test it in the browser** by completing the questionnaire flow. Record any timing that feels too fast/slow and adjust the constants.

---

## 8. Four new scenes (replacing plinko)

These four are net-new files in `src/animations/`. Each follows the same render contract:

```js
export const xxxAnimation = {
  id: 'xxx',
  name: 'Display Name',
  render(container, { strainName, winnerName, allScores }) { /* ... */ },
};
```

Each scene file should declare the timing constants at top, import from `_kinetic.js`, and follow the four-act model. CSS for each scene goes into `style.css` under a clearly-banner-commented section, e.g. `/* === BEE GARDEN ANIMATION === */`. Use only design tokens for color/easing — no hex literals.

---

### 8a. `bee.js` — Bee in the Garden

**Concept:** A bee enters from off-screen, weaves over a row of cannabis flowers, hovers as it "considers" each, then lands on the chosen one. The flower blooms with a pollen burst, name appears.

**Why it works:** Organic motion (bee zigzag + wing flutter) is automatically more lifelike than mechanical motion. Five flowers means five visible candidates — the user *sees* the bee considering, which sells fairness in a way plinko's hardcoded slot never could.

**DOM scaffold:**
```html
<div class="anim-bee-scene">
  <div class="anim-bee-sun"></div>
  <div class="anim-bee-pollen"></div>             <!-- ambient drifting dots -->
  <div class="anim-bee-flowers">
    <!-- 5 flowers, winner is index computed from allScores -->
    <div class="anim-bee-flower" data-flower="0">
      <div class="anim-bee-flower-stem"></div>
      <div class="anim-bee-flower-petals">🌿</div>
      <div class="anim-bee-flower-label">Strain Name</div>
    </div>
    <!-- × 5 -->
  </div>
  <div class="anim-bee">
    <div class="anim-bee-wing anim-bee-wing--l"></div>
    <div class="anim-bee-wing anim-bee-wing--r"></div>
    <div class="anim-bee-body"></div>
    <div class="anim-bee-trail"></div>
  </div>
</div>
```

**Names:** Use `allScores.slice(0, 5).map(s => s.strainName)`. Place winner (`winnerName`) at a random index 0-4 (compute once per render so it's not predictable). Other four flowers get the next four scores.

**Acts:**
1. **Anticipation (0–1.0s):** Garden assembles. Sun fades in top-right. Five stems pop up from below with 80ms stagger (`--ease-snap`). Petals scale in `0 → 1` after each stem lands. Labels fade in dim. Pollen begins drifting ambiently.
2. **Action (1.0–3.6s):** Bee enters from off-screen-left, wings vibrate (a 60ms `scaleY(1) ↔ scaleY(0.4)` infinite loop on each wing — this is the bee's signature). Bee follows a JS-driven path that hovers ~250ms over each flower in sequence. While the bee is over a flower, that flower's petals tilt 8° toward it and brighten slightly. Bee body bobs vertically 4px on a 200ms loop while moving (animal locomotion).
3. **Wind-up (3.6–4.0s):** Bee arrives over the winner flower and *circles* it twice (small 30px orbit). Other four flowers desaturate to 50% opacity.
4. **Climax (4.0–4.4s):** Bee descends onto winner. Flower petals **bloom** — scale `1 → 1.5`, with each petal also rotating outward 15°. `burstParticles` pollen-yellow + green from the flower center (count: 16, gold/green palette). `screenPunch` 1.03.
5. **Reveal (4.4–5.0s):** Strain name pillar (a small rounded label) rises 20px above the bloomed flower with a soft glow. Bee continues hovering above with wings still vibrating (so the scene reads "alive" through to the swap).

**Tech notes:**
- The bee's path is JS-controlled with `transform: translate()` updates via `requestAnimationFrame` or via swapping CSS classes with different `translate` values plus `transition: transform 250ms var(--ease-snap)`. Class-swapping is simpler — recommend it.
- Wings use two separate `<div>`s so they can flutter independently with a 30ms phase offset (more lifelike than synchronized).
- Trail is an optional faint blur behind the bee — `box-shadow: -8px 0 12px rgba(255, 220, 100, 0.3)` aligned to the direction of travel. Only show when bee is in transit.

**Reveal text size:** 0.6rem on the pillar, with `font-weight: 700` and a subtle text-shadow.

---

### 8b. `wheel.js` — Wheel of Buds

**Concept:** A spinning wheel divided into wedges, each wedge labeled with a strain name. Pointer at top. Wheel decelerates with audible (visual) "tick-tick-tick" past the pointer. Settles on the winner.

**Why it works:** The wheel's final position is **computed in JS** to land on the winner. Unlike plinko, every spin shows visibly different motion. The deceleration is the entire payoff — it builds tension as the wheel slows past wedge after wedge.

**DOM scaffold:**
```html
<div class="anim-wheel-scene">
  <div class="anim-wheel-stand"></div>
  <div class="anim-wheel-pointer">▼</div>
  <div class="anim-wheel">
    <!-- 8 wedges, alternating purple/green -->
    <div class="anim-wheel-wedge" data-wedge="0">
      <span class="anim-wheel-wedge-label">Name</span>
    </div>
    <!-- × 8 -->
    <div class="anim-wheel-hub"></div>
  </div>
</div>
```

**Wedge construction:** 8 wedges, 45° each. Use `clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 50% 100%)` rotated by `n × 45deg`. Or use SVG — SVG is cleaner here. Recommend SVG: one `<svg viewBox="0 0 200 200">` with 8 `<path>` arcs, each filled with alternating `var(--purple-glow)` and `var(--green-glow)` at 0.4 opacity. Labels are `<text>` elements inside the SVG, rotated to follow each wedge.

**Names:** Use `allScores.slice(0, 8).map(s => s.strainName)`. Pad with `'???'` if fewer than 8. Winner at a random wedge index (computed at render time).

**Acts:**
1. **Anticipation (0–0.9s):** Stand drops in. Wheel scales up `0.6 → 1` with `--ease-snap`. Pointer wiggles once. Wheel sits dim (overlay 30% black) so the colors are muted.
2. **Pull (0.9–1.2s):** Hub clicks once (scale pulse). Wheel begins to spin — set `transform: rotate(${totalDeg}deg)` with `transition: transform 3s cubic-bezier(0.15, 0.6, 0.2, 1)`. The transition curve does the deceleration. `totalDeg = (5 × 360) + (360 - winnerIndex × 45 - 22.5)` so it always lands with the winner wedge directly under the pointer.
3. **Spin (1.2–4.0s):** Wheel decelerates. **Tick-tick-tick:** use a JS interval that fires faster early, slower late, calculated to match the wheel's deceleration curve — at each tick, briefly translate the pointer left 3px then back (`--ease-thwack`). Generate ticks via `setTimeout` chain rather than `setInterval` (more accurate). Pre-compute the times of each wedge boundary crossing.
4. **Wind-up (4.0–4.2s):** Last 2-3 ticks. Wheel almost stopped. Wedge labels start to be readable as motion blur fades.
5. **Climax (4.2–4.5s):** Wheel stops. Winner wedge **flashes bright** (white-yellow flash for 200ms via `box-shadow` + `filter: brightness(1.6)`). Pointer flares with `flashGlow`. `burstParticles` from the pointer tip (12 particles, gold + winner-wedge palette). `screenPunch` 1.04 on the whole wheel.
6. **Reveal (4.5–5.0s):** Winner wedge stays bright; other wedges desaturate to 30%. Winner's label scales up to 1.3× with `--ease-snap`. Pointer continues a slow wobble (follow-through) so the scene doesn't freeze.

**Tech notes:**
- Use SVG, not 8 `<div>` clip-paths — cleaner geometry, easier text rotation.
- The deceleration curve is the entire feel of the scene. Test multiple cubic-beziers; `cubic-bezier(0.15, 0.6, 0.2, 1)` is a starting point but feel free to tune. The right curve has a *long tail* — most of the time spent in the last 30% of rotation.
- Tick frequency: use `requestAnimationFrame` to read the current rotation each frame and emit a tick whenever the rotation crosses a wedge boundary. Simpler than pre-computing.

**Reveal text size:** 0.55rem inside the wedge; the winning wedge's label scales to ~0.72rem effective size.

---

### 8c. `bingo.js` — Lottery Cage

**Concept:** A glass spherical cage holds 6 strain-name balls. The cage tumbles, balls bounce around inside, then a chute opens at the bottom and one ball drops onto a tray.

**Why it works:** A clear "fair random pick" read — the user *sees* every ball is in play. The drop-out moment is uniquely tactile, unlike any of the other scenes. Glass cage is a strong visual.

**DOM scaffold:**
```html
<div class="anim-cage-scene">
  <div class="anim-cage-frame">
    <div class="anim-cage-glass">
      <div class="anim-cage-ball" data-ball="0">N1</div>
      <!-- × 6 -->
    </div>
    <div class="anim-cage-bars"></div>             <!-- decorative metal frame -->
  </div>
  <div class="anim-cage-chute"></div>              <!-- closed flap -->
  <div class="anim-cage-stand"></div>
  <div class="anim-cage-tray">
    <div class="anim-cage-winner-ball"></div>      <!-- empty until reveal -->
  </div>
</div>
```

**Names:** 6 balls using `allScores.slice(0, 6).map(s => s.strainName)`. Each ball renders with a 2-3 letter abbreviation (first letters of first/last word) or just the first 4 chars — full text doesn't fit on a small ball. The full name shows on the **winner ball after it lands on the tray**, where there's room.

**Acts:**
1. **Anticipation (0–1.0s):** Stand drops in. Cage drops onto stand with a settle bounce. Chute is closed. Balls visible inside but motionless, sitting in a pile at the bottom of the cage.
2. **Action (1.0–3.6s):** Cage starts to **tumble** — rotate `±25deg` on a 600ms loop. Balls inside bounce around with their own keyframe animations. Each ball has a unique 6-step bounce path (use `transform: translate()` with random-ish stops, but precomputed and put in CSS so they're not actually random — predictability is fine here, what matters is that *together* they look chaotic). Balls catch glints of light (`::before` pseudo with `radial-gradient`).
3. **Wind-up (3.6–4.0s):** Cage stops mid-tumble (slight overshoot then settle). Balls fall to the bottom and pile up (a brief settling animation — they don't all freeze on the same frame). A red light above the chute starts blinking.
4. **Climax (4.0–4.5s):** Chute flap rotates open (`rotate: 0 → -75deg` over 180ms). Winner ball drops out (translateY animation, 280ms with bounce on landing). Ball bounces twice on the tray. `burstParticles` on landing (small confetti-like bits). `screenPunch` 1.03 on the tray.
5. **Reveal (4.5–5.0s):** Winner ball settled on tray, scales up 1.3× and **shows the full strain name** on a label that appears next to/below it. Cage stays dim in background, remaining 5 balls visible inside (they "lost"). A subtle green glow pulses around the winner ball.

**Tech notes:**
- For the bouncing balls inside the cage, generate 6 different keyframe animations (`@keyframes ball-bounce-1` through `@keyframes ball-bounce-6`), each with different stop positions inside the cage's bounding circle. Use `transform: translate()` only — never animate `top`/`left`.
- The chute is a small `<div>` with a `transform-origin: top center` so it swings open like a flap. The "ball drops out" is the same `<div>` that was inside the cage, which gets a class added that takes over its animation and gives it gravity.
- Glass effect: `background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), transparent 60%)` plus a `box-shadow: inset 0 0 30px rgba(255,255,255,0.1)` for depth.

**Reveal text size:** Ball label is 0.45rem inside the ball, full name on the tray label is 0.6rem.

---

### 8d. `ember.js` — Ember Spark

**Concept:** A rolled joint sits horizontally on screen. A lighter slides in. Spark catches. Ember glows. Smoke rises. The strain name materializes *in the smoke* letter-by-letter.

**Why it works:** Most on-brand for the audience — it's the only scene that directly references the actual ritual of consuming the product. Sensory: warmth (orange ember), sound-implied (the spark), texture (smoke). The reveal-in-smoke is the most cinematic moment of any of the ten scenes.

**DOM scaffold:**
```html
<div class="anim-ember-scene">
  <div class="anim-ember-bg"></div>                 <!-- soft warm gradient -->
  <div class="anim-ember-joint">
    <div class="anim-ember-joint-paper"></div>
    <div class="anim-ember-joint-tip"></div>        <!-- where it lights -->
    <div class="anim-ember-joint-glow"></div>       <!-- ember glow, hidden until lit -->
  </div>
  <div class="anim-ember-lighter">
    <div class="anim-ember-lighter-body"></div>
    <div class="anim-ember-lighter-flame"></div>   <!-- hidden until clicked -->
    <div class="anim-ember-lighter-sparks"></div>  <!-- spark burst container -->
  </div>
  <div class="anim-ember-smoke">
    <div class="anim-ember-smoke-puff" style="--delay: 0s"></div>
    <!-- × 6 puffs with staggered delays -->
  </div>
  <div class="anim-ember-name">
    <!-- letters appended one at a time -->
  </div>
</div>
```

**Acts:**
1. **Anticipation (0–1.2s):** Background warm gradient fades in (deep purple → warm orange-tinted dark). Joint slides in from the left, settles horizontally in the lower-middle of the scene. Lighter slides in from the right, stops just to the right of the joint's tip. Both items have a small landing wobble.
2. **Action (1.2–2.6s):** Lighter rotates upward to vertical (its striker faces up). Lighter does **two failed strikes** — spark particles fire (small white-yellow bursts), but no flame. Each failed strike is `--ease-thwack` jitter on the lighter + a 200ms spark burst with `burstParticles` (small palette). This is anticipation — the user is mentally rooting for the lighter to catch.
3. **Wind-up (2.6–3.2s):** Third strike. Lighter jitters harder, sparks bigger. Joint tip darkens 40% (it's "ready").
4. **Climax — ignition (3.2–4.0s):** Flame appears on the lighter (`scale: 0 → 1` with flame-flicker keyframe). Lighter tilts toward the joint tip. **Joint tip catches** — the `.anim-ember-joint-glow` element fades in over 300ms, going from transparent → orange → bright orange-red. `burstParticles` orange/yellow at the tip. Lighter pulls away (slides back to the right and tilts back down). `screenPunch` 1.03 at the moment of catch.
5. **Smoke + reveal (4.0–5.0s):** Six smoke puffs rise from the ember in stagger (every 80ms, each rises 100px over 800ms while expanding `scale: 0.4 → 1.4` and fading `opacity: 0.7 → 0`). Letter-by-letter, the **strain name materializes inside the smoke column** — each letter starts as a small glowing dot at the ember and rises with the smoke, expanding into a readable letter as it ascends. By 4.7s all letters are visible. Ember pulses gently throughout (follow-through).

**Tech notes:**
- The joint is just two `<div>`s: a long thin rounded rectangle (`width: 80px; height: 8px; border-radius: 4px; background: linear-gradient(...)`), with a `::before` for the filter end (slightly different color/shape).
- The ember glow is a circular `radial-gradient` at the tip that fades in over 300ms then pulses gently.
- Smoke puffs are 30px circular `<div>`s with `filter: blur(8px)` and `background: radial-gradient(rgba(180,180,180,0.6), transparent 70%)`. Each animates `transform: translateY(-100px) scale(1.4)` and `opacity` over 800ms.
- **Letter-by-letter reveal:** use a JS helper that appends `<span>` elements with staggered `setTimeout`s. Each `<span>` has CSS `animation: ember-letter-rise 700ms var(--ease-out) forwards` that handles the dot-to-letter expansion. Position letters absolutely inside `.anim-ember-name`, spaced horizontally.
- The lighter is a small rounded rectangle (`16px × 22px`) with a striker wheel `<div>` on top. The flame is a teardrop made with `border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%` and a yellow-orange gradient.

**Reveal text size:** 0.62rem for each letter, with `font-weight: 700`, `text-shadow: 0 0 6px rgba(255, 200, 100, 0.8)` so the letters glow as they rise through the smoke.

**Sensitivity note:** This scene depicts smoking. Confirm with product before shipping that this is on-brand for the audience tier (it should be — it's a cannabis app). If the team wants a tamer alternative, the same mechanic can be reskinned as **a candle being lit and the strain name rising in the wisp of smoke** with no other changes — same DOM, swap `joint` → `candle`, swap `tip` → `wick`. Recommend keeping the joint version; flagging the option.

---

## 9. Acceptance criteria

A scene is "done" when:
- It has a clear three-act structure (anticipation → action → climax → hold).
- The reveal text is **legible without leaning in** on a phone.
- There's a tactile climax moment — particles, flash, and either `shake` or `screenPunch`.
- Motion **decays** after climax instead of stopping dead.
- Tokens are used for all colors, easings, durations.
- It still completes inside 5000ms with the strain name visible by 4500ms.
- `prefers-reduced-motion` produces a calm static-end version with no flashing.
- Only `transform`/`opacity`/`filter`/`box-shadow` animate inside loops.
- The `winnerName` parameter is accepted (even if unused) so the render contract is uniform.

When all seven hit those marks, the matching screen will feel like a polished slot of micro-celebrations instead of seven uniform 5-second loaders.
