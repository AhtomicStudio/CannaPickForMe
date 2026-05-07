/**
 * CannaGotchi — Persistent Companion
 *
 * A floating pixel-art sprite riding over all screens for logged-in users.
 * Default ON. Toggle in Settings.
 *
 * Features:
 *   • 3-cycle tap reactions (happy → excited → chill) with speech bubbles
 *   • Spam protection — 3+ taps within 800ms triggers annoyed state
 *   • Time-of-day quips (sleepy 💤 at night, energetic ☀️ in the morning)
 *   • Idle attention getter — subtle wiggle after 25s of inactivity
 *   • App-event reactivity — reacts to toasts, results, stash adds
 *
 * The tap-reactor is exported as a factory so the in-game viewport
 * (CannaGotchi screen) can share the same reaction behavior.
 */

import { renderSprite } from './pixelArt.js';
import { loadGameState } from '../services/gameService.js';
import { getLevel, getCurrentEvolution } from './gameEngine.js';
import { getMonsterType } from './monsters.js';

const STORAGE_KEY  = 'cpfm_companion_enabled';
const COMPANION_ID = 'cannaguy-companion';

let _uid       = null;
let _enabled   = true;
let _gameState = null;
let _companionReactor = null;

// ── Constants shared by all tap-reactors ──────────────────────
const TAP_SPAM_WINDOW = 800;
const TAP_SPAM_COUNT  = 3;
const ANNOY_COOLDOWN  = 2200;
const IDLE_TIMEOUT    = 25000;

// ── Reaction definitions ──────────────────────────────────────
const REACTIONS = [
  { anim: 'cg-react--happy',   quips: ['❤️ love u!', '😊 hi there!', '💚 so happy!'] },
  { anim: 'cg-react--excited', quips: ['✨ lets go!', '🌟 woo!',       '🎉 yay!']    },
  { anim: 'cg-react--chill',   quips: ['🌿 vibing~',  '😎 chill.',     '💨 mellow…']  },
];

// App-event reaction map — consumed by reactToEvent()
const EVENT_REACTIONS = {
  'result-revealed': { anim: 'cg-react--happy',   quip: '🎉 dope pick!' },
  'stash-add':       { anim: 'cg-react--excited', quip: '✨ noice!'     },
  'toast-success':   { anim: 'cg-react--happy',   quip: '💚 nice!'      },
  'toast-error':     { anim: 'cg-react--annoyed', quip: '😟 uh oh…'     },
  'theme-change':    { anim: 'cg-react--excited', quip: '🌈 ooh!'       },
};

// ══════════════════════════════════════════════════════════════
// REUSABLE TAP REACTOR — factory that pairs any sprite with
// the same reaction behavior (tap cycle, spam, bubble, idle).
// ══════════════════════════════════════════════════════════════
/**
 * @param {object} cfg
 * @param {HTMLElement} cfg.wrapper   Outer element — gets the bounce/shake
 * @param {HTMLElement} cfg.sprite    Inner sprite — gets reaction anim classes
 * @param {HTMLElement} cfg.bubble    Speech bubble element
 * @param {HTMLElement} [cfg.stress]  Optional 💢 stress element
 * @param {string} cfg.idleAnim       Class name for the baseline idle animation
 * @param {boolean} [cfg.idleTimer=true]  Enable the idle-attention wiggle
 */
export function createTapReactor(cfg) {
  const state = {
    tapTimes: [],
    reactionIdx: 0,
    annoyed: false,
    idleTimer: null,
    destroyed: false,
  };

  function handleTap() {
    if (state.annoyed || state.destroyed) return;
    const now = Date.now();
    state.tapTimes = state.tapTimes.filter(t => now - t < TAP_SPAM_WINDOW);
    state.tapTimes.push(now);

    if (state.tapTimes.length >= TAP_SPAM_COUNT) {
      triggerAnnoyed();
      state.tapTimes = [];
      return;
    }
    triggerReaction();
  }

  function triggerReaction() {
    const r = REACTIONS[state.reactionIdx % REACTIONS.length];
    state.reactionIdx++;

    cfg.sprite.className = `game-monster ${r.anim}`;
    const dur = r.anim === 'cg-react--chill' ? 2000 : 1000;
    setTimeout(() => {
      if (!state.destroyed) cfg.sprite.className = `game-monster ${cfg.idleAnim}`;
    }, dur);

    const quip = getTimedQuip() || r.quips[Math.floor(Math.random() * r.quips.length)];
    showBubble(cfg.bubble, quip, false);

    cfg.wrapper.classList.add('cg-tap-bounce');
    setTimeout(() => cfg.wrapper.classList.remove('cg-tap-bounce'), 600);
    resetIdle();
  }

  function triggerAnnoyed() {
    state.annoyed = true;
    cfg.sprite.className = 'game-monster cg-react--annoyed';
    cfg.wrapper.classList.add('cg-annoyed-shake');

    if (cfg.stress) {
      cfg.stress.classList.add('cg-stress--visible');
      setTimeout(() => cfg.stress.classList.remove('cg-stress--visible'), ANNOY_COOLDOWN);
    }
    showBubble(cfg.bubble, '😤 hey stop!', true);

    setTimeout(() => {
      if (state.destroyed) return;
      cfg.sprite.className = `game-monster ${cfg.idleAnim}`;
      cfg.wrapper.classList.remove('cg-annoyed-shake');
      state.annoyed = false;
    }, ANNOY_COOLDOWN);
    resetIdle();
  }

  // Event-driven reaction (not from a tap) — used for app events.
  function playEventReaction(def) {
    if (state.annoyed || state.destroyed) return;
    cfg.sprite.className = `game-monster ${def.anim}`;
    const dur = def.anim === 'cg-react--chill' ? 2000 : 1000;
    setTimeout(() => {
      if (!state.destroyed) cfg.sprite.className = `game-monster ${cfg.idleAnim}`;
    }, dur);
    if (def.quip) showBubble(cfg.bubble, def.quip, def.anim === 'cg-react--annoyed');
    cfg.wrapper.classList.add('cg-tap-bounce');
    setTimeout(() => cfg.wrapper.classList.remove('cg-tap-bounce'), 600);
    resetIdle();
  }

  // Idle attention
  function startIdle() {
    stopIdle();
    if (cfg.idleTimer === false) return;
    state.idleTimer = setTimeout(doIdleWiggle, IDLE_TIMEOUT);
  }
  function stopIdle() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
  function resetIdle() { stopIdle(); startIdle(); }
  function doIdleWiggle() {
    if (state.destroyed) return;
    cfg.wrapper.classList.add('cg-idle-attention');
    setTimeout(() => {
      cfg.wrapper.classList.remove('cg-idle-attention');
      startIdle();
    }, 2000);
  }

  cfg.wrapper.addEventListener('click', handleTap);
  startIdle();

  return {
    handleTap,
    playEventReaction,
    destroy() {
      state.destroyed = true;
      stopIdle();
      cfg.wrapper.removeEventListener('click', handleTap);
    },
  };
}

function showBubble(bubble, text, isAngry) {
  if (!bubble) return;
  bubble.textContent = text;
  bubble.className = `cg-bubble cg-bubble--show${isAngry ? ' cg-bubble--angry' : ''}`;
  setTimeout(() => { bubble.className = 'cg-bubble hidden'; },
    isAngry ? ANNOY_COOLDOWN : 2000);
}

function getTimedQuip() {
  const h = new Date().getHours();
  if (Math.random() > 0.35) return null;
  if (h >= 22 || h < 4)  return '😴 sleepy…';
  if (h >= 4  && h < 7)  return '🌅 up early!';
  if (h >= 7  && h < 11) return '☀️ good morning!';
  if (h >= 14 && h < 17) return '🌤️ afternoon vibe';
  if (h >= 20 && h < 22) return '🌙 night session~';
  return null;
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API — Persistent companion
// ══════════════════════════════════════════════════════════════

export async function initCompanion(uid) {
  _uid     = uid;
  _enabled = loadPref();

  _gameState = await loadGameState(uid);
  if (!_gameState) return;

  mount();
  if (_enabled) show();
}

export function destroyCompanion() {
  _uid = null;
  _gameState = null;
  if (_companionReactor) { _companionReactor.destroy(); _companionReactor = null; }
  const el = document.getElementById(COMPANION_ID);
  if (el) el.remove();
}

export function setCompanionEnabled(on) {
  _enabled = on;
  savePref(on);
  if (on) show();
  else    hide();
}

export function getCompanionEnabled() { return loadPref(); }

export function hideCompanionForGameScreen() {
  const el = document.getElementById(COMPANION_ID);
  if (el) el.style.opacity = '0';
}

export function showCompanionAfterGameScreen() {
  if (!_enabled || !_gameState) return;
  const el = document.getElementById(COMPANION_ID);
  if (el) el.style.opacity = '1';
}

/**
 * Trigger a mascot reaction from elsewhere in the app.
 * Throttled so it never spams; safe to call from toasts etc.
 */
let _lastEventAt = 0;
const EVENT_COOLDOWN = 1500;
export function reactToEvent(eventName) {
  const def = EVENT_REACTIONS[eventName];
  if (!def) return;
  if (!_companionReactor) return;
  if (!_enabled) return;
  const now = Date.now();
  if (now - _lastEventAt < EVENT_COOLDOWN) return;
  _lastEventAt = now;
  _companionReactor.playEventReaction(def);
}

// ── Internal ──────────────────────────────────────────────────

function loadPref() {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === 'true';
}
function savePref(val) { localStorage.setItem(STORAGE_KEY, String(val)); }

function getIdleAnimClass(spriteName) {
  if (spriteName.includes('ancient')) return 'game-anim--ancient';
  if (spriteName.includes('bloom'))   return 'game-anim--bloom';
  if (spriteName.includes('sapling')) return 'game-anim--sapling';
  if (spriteName.includes('sprout'))  return 'game-anim--sprout';
  return 'game-anim--seed';
}

function mount() {
  const existing = document.getElementById(COMPANION_ID);
  if (existing) existing.remove();
  if (_companionReactor) { _companionReactor.destroy(); _companionReactor = null; }

  const monType   = getMonsterType(_gameState.monsterType);
  const level     = getLevel(_gameState.xp);
  const evolution = getCurrentEvolution(monType.evolutions, level);
  const idleAnim  = getIdleAnimClass(evolution.sprite);

  const wrapper = document.createElement('div');
  wrapper.id = COMPANION_ID;
  wrapper.className = 'cannaguy-companion hidden';
  wrapper.setAttribute('title', `${_gameState.monsterName} • Lv.${level}`);
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('aria-label', `Pet ${_gameState.monsterName}`);
  wrapper.tabIndex = 0;
  wrapper.innerHTML = `
    <div class="cg-stress" id="cg-stress">💢</div>
    <div class="cg-bubble hidden" id="cg-bubble"></div>
    <div class="game-monster ${idleAnim}" id="cg-sprite"></div>
    <div class="cg-label">${_gameState.monsterName} <span class="cg-level">Lv.${level}</span></div>
  `;
  document.body.appendChild(wrapper);

  // Render sprite — scale 7 so he's unmissable on mobile and desktop.
  const spriteEl = wrapper.querySelector('#cg-sprite');
  renderSprite(spriteEl, evolution.sprite, 7);
  spriteEl.className = `game-monster ${idleAnim}`;

  // Keyboard activation mirrors tap.
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      _companionReactor?.handleTap();
    }
  });

  _companionReactor = createTapReactor({
    wrapper,
    sprite: spriteEl,
    bubble: wrapper.querySelector('#cg-bubble'),
    stress: wrapper.querySelector('#cg-stress'),
    idleAnim,
  });
}

let _enterTimer = null;
function show() {
  const el = document.getElementById(COMPANION_ID);
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('cannaguy-companion--visible');
  // One-shot entrance — kept as a class we remove in JS so future class
  // toggles (like cg-tap-bounce) don't restart the enter animation
  // from its opacity:0 keyframe and flicker the mascot on mobile taps.
  el.classList.add('cannaguy-companion--entering');
  if (_enterTimer) clearTimeout(_enterTimer);
  _enterTimer = setTimeout(() => {
    el.classList.remove('cannaguy-companion--entering');
    _enterTimer = null;
  }, 550);
}

function hide() {
  const el = document.getElementById(COMPANION_ID);
  if (el) {
    el.classList.remove('cannaguy-companion--visible');
    el.classList.add('hidden');
  }
}
