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

import { renderSprite, renderHat } from './pixelArt.js';
import { loadGameState } from '../services/gameService.js';
import { getLevel, getCurrentEvolution } from './gameEngine.js';
import { getMonsterType, getVariant } from './monsters.js';
import { COSMETICS_BY_ID } from './cosmetics.js';

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
    if (cfg.wrapper.dataset.wasDragged === 'true') return;
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

    const quip = getTimedQuip(_gameState) || r.quips[Math.floor(Math.random() * r.quips.length)];
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

// Trait-flavored personality quips. ~25% of taps fire one of these instead
// of the default cycle, biased by the bud's actual trait + lowest need.
const TRAIT_QUIPS = {
  dense:        ['💪 sturdy ✓', '🪨 i am wall', '🛡️ unbreakable.'],
  twitchy:      ['⚡ go fast!', '⚡⚡⚡', '🏃 zoom!', '⚡ wired'],
  hearty:       ['💖 big heart', '💖 hp 4 days', '💖 squish'],
  sharp:        ['🔪 ready to swing', '🔪 sharp boy', '⚔️ point first'],
  balanced:     ['⚖️ all is well', '⚖️ centered', '🧘 zen.'],
  crystalline:  ['💎 sparkle', '✨ ✨ ✨', '💎 shine bright'],
  slippery:     ['💨 woop missed me', '💨 too slick', '💨 slip n slide'],
  lucky:        ['🍀 lucky day', '🍀 fortune favors', '🍀 trust'],
  pungent:      ['👃 smell that?', '👃 strong notes', '🌿 funk forever'],
  resinous:     ['🍯 sticky vibes', '🍯 slow drip', '🍯 trichome time'],
  zen:          ['🧘 om', '🧘 still water', '🌸 breathe.'],
  thicc:        ['🍑 thick king', '🍑 chonk life', '🍑 cant rush this'],
  photosynthetic:['☀️ photosynthesizing', '☀️ recharging', '☀️ solar bath'],
  greedy:       ['🪙 gimme', '🪙 cha-ching', '🪙 more buds plz'],
  evergreen:    ['🌲 eternal vibes', '🌲 still here', '🌲 evergreen'],
};

const NEED_QUIPS = {
  hydration:   ['💧 thirsty…', '💧 a sip pls', '💧 kinda dry'],
  nutrition:   ['🌿 hangry', '🌿 feed me', '🌿 stomach rumble'],
  cleanliness: ['✨ feeling crusty', '✨ wash me', '🧹 dust everywhere'],
  happiness:   ['💔 lonely…', '😟 pet me?', '💔 down in the dumps'],
};

function getTimedQuip(gameState) {
  // Need-driven first — if a need is critically low, complain
  if (gameState?.needs) {
    const lows = Object.entries(gameState.needs)
      .filter(([k, v]) => k !== 'lastDecayTick' && v < 30);
    if (lows.length && Math.random() < 0.5) {
      const [key] = lows[Math.floor(Math.random() * lows.length)];
      const pool = NEED_QUIPS[key];
      if (pool) return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  // Trait-driven next
  const tid = gameState?.trait;
  if (tid && TRAIT_QUIPS[tid] && Math.random() < 0.40) {
    const pool = TRAIT_QUIPS[tid];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // Time-of-day fallback
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

// In-flight guard: initCompanion is called from several spots (auth state
// change, game-screen exit, plot switch, plot plant, offspring claim). If
// two calls overlap they could race — the second one's loadGameState may
// resolve AFTER the first has mounted, then the second runs unmountAll +
// mount with stale state, causing a flicker. We coalesce concurrent calls
// onto a single in-flight promise instead.
let _initInFlight = null;

export function initCompanion(uid) {
  if (_initInFlight) return _initInFlight;
  _initInFlight = (async () => {
    try {
      _uid     = uid;
      _enabled = loadPref();
      _gameState = await loadGameState(uid);
      if (!_gameState) return;
      mount();          // mount() already calls unmountAll() first → idempotent
      if (_enabled) show();
    } finally {
      _initInFlight = null;
    }
  })();
  return _initInFlight;
}

export function destroyCompanion() {
  _uid = null;
  _gameState = null;
  unmountAll();
}

export function setCompanionEnabled(on) {
  _enabled = on;
  savePref(on);
  if (on) show();
  else    hide();
}

export function getCompanionEnabled() { return loadPref(); }

export function hideCompanionForGameScreen() {
  for (const c of _mountedCompanions) {
    if (c.wrapper) c.wrapper.style.opacity = '0';
  }
}

export function showCompanionAfterGameScreen() {
  if (!_enabled || !_gameState) return;
  for (const c of _mountedCompanions) {
    if (c.wrapper) c.wrapper.style.opacity = '1';
  }
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

// ── Multi-companion infrastructure ──────────────────────────
// Each entry is { id, plotId, wrapper, reactor }. Plot 1 is the active /
// "main" companion in the bottom-right (existing position). Plot 2 + 3
// are quirky additions that peek from the top-left and bottom-left edges.
const COMPANION_BASE_ID = COMPANION_ID;
const POSITIONS = {
  plot_1: 'cg-pos--main',     // bottom-right (existing)
  plot_2: 'cg-pos--peek-tl',  // top-left, peeks from edge
  plot_3: 'cg-pos--peek-bl',  // bottom-left, peeks around the corner
};
let _mountedCompanions = []; // { id, plotId, wrapper, reactor }

function mount() {
  // Tear down ALL previous companions
  unmountAll();

  // Determine which plots have buds
  const plots = [];
  // Active plot — the live state
  plots.push({ plotId: _gameState.activePlotId || 'plot_1', data: _gameState, isActive: true });
  // Other plots — only those that have a bud
  if (_gameState.plots) {
    for (const pid of Object.keys(_gameState.plots)) {
      if (pid === (_gameState.activePlotId || 'plot_1')) continue;
      const snap = _gameState.plots[pid];
      if (snap && snap.monsterType) {
        plots.push({ plotId: pid, data: snap, isActive: false });
      }
    }
  }

  for (const p of plots) {
    mountOne(p.plotId, p.data, p.isActive);
  }
}

function makeDraggable(el) {
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let hasMoved = false;

  el.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    const rect = el.getBoundingClientRect();
    
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.classList.remove('cg-pos--main', 'cg-pos--peek-tl', 'cg-pos--peek-bl');

    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialLeft = rect.left;
    initialTop = rect.top;
    
    isDragging = true;
    hasMoved = false;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!isDragging || !el.hasPointerCapture(e.pointerId)) return;
    
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
    if (!hasMoved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      hasMoved = true;
      el.classList.add('cg-dragging');
    }
    
    if (hasMoved) {
      el.style.left = `${initialLeft + dx}px`;
      el.style.top = `${initialTop + dy}px`;
    }
  });

  el.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    el.releasePointerCapture(e.pointerId);
    
    if (hasMoved) {
      el.classList.remove('cg-dragging');
      el.dataset.wasDragged = 'true';
      setTimeout(() => { delete el.dataset.wasDragged; }, 100);
    }
  });
}

function mountOne(plotId, data, isActive) {
  const monType   = getMonsterType(data.monsterType);
  const level     = getLevel(data.xp || 0);
  const evolution = getCurrentEvolution(monType.evolutions, level);
  const idleAnim  = getIdleAnimClass(evolution.sprite);
  const variant   = getVariant(data.monsterType, data.monsterVariant || 'classic');

  const id = `${COMPANION_BASE_ID}--${plotId}`;
  const positionClass = POSITIONS[plotId] || POSITIONS.plot_1;

  const wrapper = document.createElement('div');
  wrapper.id = id;
  wrapper.className = `cannaguy-companion hidden ${positionClass}`;
  wrapper.dataset.plotId = plotId;
  wrapper.setAttribute('title', `${data.monsterName} • Lv.${level}`);
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('aria-label', `Pet ${data.monsterName}`);
  wrapper.tabIndex = 0;
  wrapper.innerHTML = `
    <div class="cg-stress" id="cg-stress--${plotId}">💢</div>
    <div class="cg-bubble hidden" id="cg-bubble--${plotId}"></div>
    <div class="game-monster ${idleAnim}" id="cg-sprite--${plotId}"></div>
    <div class="cg-label">${data.monsterName} <span class="cg-level">Lv.${level}</span></div>
  `;
  // Belt-and-suspenders: if a previous mount left an element with this id,
  // nuke it before we add the new one. Prevents any chance of duplicates.
  document.getElementById(id)?.remove();
  document.body.appendChild(wrapper);

  // Render sprite + equipped hat. Cosmetics are GLOBAL to the account, so all
  // floating companions share the player's currently-equipped hat — feels
  // unified and avoids needing per-plot equip slots.
  const spriteEl = wrapper.querySelector(`#cg-sprite--${plotId}`);
  renderSprite(spriteEl, evolution.sprite, 7, { paletteRemap: variant?.paletteRemap });
  const equippedHatId = _gameState?.cosmetics?.equipped?.hat;
  if (equippedHatId && equippedHatId !== 'hat_none') {
    renderHat(spriteEl, equippedHatId, 7);
  }
  spriteEl.className = `game-monster ${idleAnim}`;

  const reactor = createTapReactor({
    wrapper,
    sprite: spriteEl,
    bubble: wrapper.querySelector(`#cg-bubble--${plotId}`),
    stress: wrapper.querySelector(`#cg-stress--${plotId}`),
    idleAnim,
  });

  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      reactor?.handleTap();
    }
  });

  makeDraggable(wrapper);

  _mountedCompanions.push({ id, plotId, wrapper, reactor, isActive });

  // Active companion is the one event-bus reactions target
  if (isActive) _companionReactor = reactor;
}

function unmountAll() {
  for (const c of _mountedCompanions) {
    try { c.reactor?.destroy(); } catch (_) {}
    c.wrapper?.remove();
  }
  _mountedCompanions = [];
  _companionReactor = null;
  // Also remove any legacy single-id companion left over from older mounts
  document.getElementById(COMPANION_BASE_ID)?.remove();
}

let _enterTimer = null;
function show() {
  for (const c of _mountedCompanions) {
    if (!c.wrapper) continue;
    c.wrapper.classList.remove('hidden');
    c.wrapper.classList.add('cannaguy-companion--visible');
    c.wrapper.classList.add('cannaguy-companion--entering');
  }
  if (_enterTimer) clearTimeout(_enterTimer);
  _enterTimer = setTimeout(() => {
    for (const c of _mountedCompanions) {
      c.wrapper?.classList.remove('cannaguy-companion--entering');
    }
    _enterTimer = null;
  }, 550);
}

function hide() {
  for (const c of _mountedCompanions) {
    if (!c.wrapper) continue;
    c.wrapper.classList.remove('cannaguy-companion--visible');
    c.wrapper.classList.add('hidden');
  }
}
