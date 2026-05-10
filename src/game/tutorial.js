/**
 * CannaGotchi — First-time Tutorial
 *
 * 6-step coach-mark walkthrough that fires the first time a user opens
 * Cannagotchi after creating their first Cannabud. Each step:
 *   • Tints the screen
 *   • Highlights one element with a glowing ring
 *   • Shows a short caption + Next/Skip buttons
 *
 * Persistence: a single localStorage flag `cpfm_cg_tutorial_seen` so we
 * never re-show. Players can replay it from the Garden tab settings.
 */

const TUTORIAL_KEY = 'cpfm_cg_tutorial_seen';

export function tutorialSeen() {
  try { return localStorage.getItem(TUTORIAL_KEY) === 'true'; }
  catch (_) { return false; }
}
export function markTutorialSeen() {
  try { localStorage.setItem(TUTORIAL_KEY, 'true'); }
  catch (_) {}
}
export function resetTutorial() {
  try { localStorage.removeItem(TUTORIAL_KEY); }
  catch (_) {}
}

const STEPS = [
  {
    selector: '.garden-viewport',
    title: '🪴 Meet your Cannabud',
    body: 'This is your bud — tap to pet. Care for it daily and it grows. Tap "Water", "Feed", "Clean", and "Pet" below to keep it thriving.',
    placement: 'bottom',
  },
  {
    selector: '.needs-card',
    title: '💚 Watch its needs',
    body: "Five needs decay slowly over real time. Don't worry — Cannagotchi is forgiving. A little neglect is fine, but a thriving bud earns you bigger XP and stat bonuses.",
    placement: 'top',
  },
  {
    selector: '[data-tab="battle"]',
    title: '⚔️ Battle wild Cannabuds',
    body: 'Tap the Battle tab to fight wild encounters and boss arenas. Win to earn 🪙 Buds, ⚡ XP, and 🌱 Seeds.',
    placement: 'bottom',
  },
  {
    selector: '[data-tab="shop"]',
    title: '🛒 Shop with Buds & Seeds',
    body: 'Spend your earnings on care items, garden upgrades, hats, frames, auras, and unlockable themes. Everything is in-game currency only — never real money.',
    placement: 'bottom',
  },
  {
    selector: '[data-tab="quests"]',
    title: '📜 Daily quests + Trophies',
    body: 'Three quests roll daily. Tap the ? icon next to any quest to see how to finish it. Clear all three for a bonus Seed.',
    placement: 'bottom',
  },
  {
    selector: '[data-tab="versus"]',
    title: '🆚 Battle your friends',
    body: 'Local hot-seat works today. Bluetooth nearby pairing, QR battles, and an async friends-leaderboard are all built in. Bring this out at smoke sessions.',
    placement: 'bottom',
  },
];

let _overlay = null;
let _step = 0;

/** Start the tutorial. Call after the Garden tab is rendered. */
export function startTutorial() {
  _step = 0;
  buildOverlay();
  showStep();
}

function buildOverlay() {
  cleanup();
  _overlay = document.createElement('div');
  _overlay.className = 'tutorial-overlay';
  _overlay.innerHTML = `
    <div class="tutorial-mask" id="tut-mask-1"></div>
    <div class="tutorial-mask" id="tut-mask-2"></div>
    <div class="tutorial-mask" id="tut-mask-3"></div>
    <div class="tutorial-mask" id="tut-mask-4"></div>
    <div class="tutorial-ring" id="tut-ring"></div>
    <div class="tutorial-card" id="tut-card">
      <div class="tutorial-card__step" id="tut-card-step"></div>
      <h3 class="tutorial-card__title" id="tut-card-title"></h3>
      <p class="tutorial-card__body" id="tut-card-body"></p>
      <div class="tutorial-card__actions">
        <button class="btn-juicy compact" id="tut-skip">Skip</button>
        <button class="btn-juicy compact" id="tut-back" disabled>← Back</button>
        <button class="btn-juicy" id="tut-next">Next →</button>
      </div>
    </div>`;
  document.body.appendChild(_overlay);

  _overlay.querySelector('#tut-skip').addEventListener('click', finish);
  _overlay.querySelector('#tut-back').addEventListener('click', () => { _step = Math.max(0, _step - 1); showStep(); });
  _overlay.querySelector('#tut-next').addEventListener('click', () => {
    if (_step >= STEPS.length - 1) finish();
    else { _step++; showStep(); }
  });
  window.addEventListener('resize', repositionForCurrentStep);
}

function showStep() {
  if (!_overlay) return;
  const step = STEPS[_step];
  if (!step) { finish(); return; }
  _overlay.querySelector('#tut-card-step').textContent = `Step ${_step + 1} / ${STEPS.length}`;
  _overlay.querySelector('#tut-card-title').textContent = step.title;
  _overlay.querySelector('#tut-card-body').textContent = step.body;
  _overlay.querySelector('#tut-back').disabled = _step === 0;
  _overlay.querySelector('#tut-next').textContent = _step === STEPS.length - 1 ? 'Done 🎉' : 'Next →';

  // If the target tab isn't currently visible, briefly flash it to draw eyes there
  positionForStep(step);
}

function positionForStep(step) {
  const target = document.querySelector(step.selector);
  if (!target) {
    // Element not visible (e.g. tab not yet rendered). Center the card and
    // skip the ring for this step.
    centerCard();
    hideRing();
    maskAll();
    return;
  }
  const rect = target.getBoundingClientRect();
  const ring = _overlay.querySelector('#tut-ring');
  const card = _overlay.querySelector('#tut-card');

  // Spotlight ring around the target
  const pad = 8;
  ring.style.cssText = `
    position: fixed;
    left: ${rect.left - pad}px;
    top: ${rect.top - pad}px;
    width: ${rect.width + pad * 2}px;
    height: ${rect.height + pad * 2}px;
    border: 3px solid #fde047;
    border-radius: 12px;
    box-shadow: 0 0 32px rgba(253, 224, 71, 0.6), 0 0 0 9999px rgba(0,0,0,0.65);
    pointer-events: none;
    z-index: 99999;
    transition: all 0.3s ease;
  `;

  // Place the card NEAR the highlight, biased to the requested placement
  const cardWidth = 320;
  const cardHeight = 220;
  let left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, rect.left + rect.width / 2 - cardWidth / 2));
  let top;
  if (step.placement === 'bottom' && rect.bottom + cardHeight + 16 < window.innerHeight) {
    top = rect.bottom + 16;
  } else if (step.placement === 'top' && rect.top - cardHeight - 16 > 0) {
    top = rect.top - cardHeight - 16;
  } else if (rect.bottom + cardHeight + 16 < window.innerHeight) {
    top = rect.bottom + 16;
  } else {
    top = Math.max(16, rect.top - cardHeight - 16);
  }
  card.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    width: ${cardWidth}px;
    z-index: 100000;
  `;
}

function centerCard() {
  const card = _overlay.querySelector('#tut-card');
  card.style.cssText = `
    position: fixed;
    left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: 320px;
    z-index: 100000;
  `;
}
function hideRing() {
  _overlay.querySelector('#tut-ring').style.cssText = 'display:none;';
}
function maskAll() {
  // No spotlight — the body of the tutorial card drops a full-screen scrim.
}

function repositionForCurrentStep() {
  const step = STEPS[_step];
  if (step) positionForStep(step);
}

function finish() {
  markTutorialSeen();
  cleanup();
}

function cleanup() {
  window.removeEventListener('resize', repositionForCurrentStep);
  if (_overlay) { _overlay.remove(); _overlay = null; }
}
