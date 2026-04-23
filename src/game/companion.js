/**
 * CannaGotchi — Persistent Companion
 *
 * A floating pixel-art sprite riding over all screens for logged-in users.
 * Default ON. Toggle in Settings.
 *
 * Tap reactions (3 cycling):
 *   1. Happy — jump bounce + ❤️ bubble
 *   2. Excited — rapid wiggle + ✨ bubble
 *   3. Chill — slow sway + 🌿 bubble
 *
 * Spam tap annoyance (3+ taps within 800ms):
 *   → Red 💢 stress symbol, angry shake, 2s cooldown
 *
 * Extras:
 *   • Time-of-day quips (sleepy 💤 at night, energetic ☀️ in the morning)
 *   • Idle attention getter — subtle wiggle after 25s of page inactivity
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

// ── Tap / reaction state ──────────────────────────────────────
let _tapTimes    = [];       // timestamps of recent taps
let _reactionIdx = 0;        // cycles 0→1→2→0...
let _annoyed     = false;    // locked out during annoyance cooldown
let _idleTimer   = null;     // attention-getter timer

const TAP_SPAM_WINDOW = 800;  // ms — 3 taps within this = annoyed
const TAP_SPAM_COUNT  = 3;
const ANNOY_COOLDOWN  = 2200;
const IDLE_TIMEOUT    = 25000; // 25s before attention wiggle

// ── Reaction definitions ──────────────────────────────────────
const REACTIONS = [
  {
    anim:  'cg-react--happy',
    quips: ['❤️ love u!', '😊 hi there!', '💚 so happy!'],
  },
  {
    anim:  'cg-react--excited',
    quips: ['✨ lets go!', '🌟 woo!', '🎉 yay!'],
  },
  {
    anim:  'cg-react--chill',
    quips: ['🌿 vibing~', '😎 chill.', '💨 mellow...'],
  },
];

// ── Public API ────────────────────────────────────────────────

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
  stopIdleTimer();
  const el = document.getElementById(COMPANION_ID);
  if (el) el.remove();
}

export function setCompanionEnabled(on) {
  _enabled = on;
  savePref(on);
  if (on) { show(); startIdleTimer(); }
  else    { hide(); stopIdleTimer(); }
}

export function getCompanionEnabled() { return loadPref(); }

export function hideCompanionForGameScreen() {
  const el = document.getElementById(COMPANION_ID);
  if (el) el.style.opacity = '0';
  stopIdleTimer();
}

export function showCompanionAfterGameScreen() {
  if (!_enabled || !_gameState) return;
  const el = document.getElementById(COMPANION_ID);
  if (el) el.style.opacity = '1';
  startIdleTimer();
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

  const monType   = getMonsterType(_gameState.monsterType);
  const level     = getLevel(_gameState.xp);
  const evolution = getCurrentEvolution(monType.evolutions, level);
  const idleAnim  = getIdleAnimClass(evolution.sprite);

  const wrapper = document.createElement('div');
  wrapper.id = COMPANION_ID;
  wrapper.className = 'cannaguy-companion hidden';
  wrapper.setAttribute('title', `${_gameState.monsterName} • Lv.${level}`);
  wrapper.innerHTML = `
    <div class="cg-stress" id="cg-stress">💢</div>
    <div class="cg-bubble hidden" id="cg-bubble"></div>
    <div class="game-monster ${idleAnim}" id="cg-sprite"></div>
    <div class="cg-label">${_gameState.monsterName} <span class="cg-level">Lv.${level}</span></div>
  `;
  document.body.appendChild(wrapper);

  // Render sprite
  const spriteEl = wrapper.querySelector('#cg-sprite');
  renderSprite(spriteEl, evolution.sprite, 4);
  spriteEl.className = `game-monster ${idleAnim}`;

  // Tap handler
  wrapper.addEventListener('click', handleTap.bind(null, wrapper, idleAnim));

  startIdleTimer();
}

function handleTap(wrapper, idleAnim) {
  if (_annoyed) return;

  const now = Date.now();
  _tapTimes = _tapTimes.filter(t => now - t < TAP_SPAM_WINDOW);
  _tapTimes.push(now);

  if (_tapTimes.length >= TAP_SPAM_COUNT) {
    triggerAnnoyed(wrapper, idleAnim);
    _tapTimes = [];
    return;
  }

  triggerReaction(wrapper, idleAnim);
}

function triggerReaction(wrapper, idleAnim) {
  const r    = REACTIONS[_reactionIdx % REACTIONS.length];
  _reactionIdx++;

  const sprite = wrapper.querySelector('#cg-sprite');
  if (!sprite) return;

  // Apply reaction animation
  sprite.className = `game-monster ${r.anim}`;
  const dur = r.anim === 'cg-react--chill' ? 2000 : 1000;
  setTimeout(() => {
    if (sprite) sprite.className = `game-monster ${idleAnim}`;
  }, dur);

  // Pick quip — inject time-of-day override on first react of each group
  const quip = getTimedQuip() || r.quips[Math.floor(Math.random() * r.quips.length)];
  showBubble(wrapper, quip);

  // Bounce the whole wrapper
  wrapper.classList.add('cg-tap-bounce');
  setTimeout(() => wrapper.classList.remove('cg-tap-bounce'), 600);

  resetIdleTimer();
}

function triggerAnnoyed(wrapper, idleAnim) {
  _annoyed = true;

  const sprite  = wrapper.querySelector('#cg-sprite');
  const stressEl = wrapper.querySelector('#cg-stress');

  // Angry shake
  if (sprite) sprite.className = `game-monster cg-react--annoyed`;
  wrapper.classList.add('cg-annoyed-shake');

  // Show 💢 stress mark
  if (stressEl) {
    stressEl.classList.add('cg-stress--visible');
    setTimeout(() => stressEl.classList.remove('cg-stress--visible'), ANNOY_COOLDOWN);
  }

  showBubble(wrapper, '😤 hey stop!', true);

  setTimeout(() => {
    if (sprite) sprite.className = `game-monster ${idleAnim}`;
    wrapper.classList.remove('cg-annoyed-shake');
    _annoyed = false;
  }, ANNOY_COOLDOWN);

  resetIdleTimer();
}

function showBubble(wrapper, text, isAngry = false) {
  const bubble = wrapper.querySelector('#cg-bubble');
  if (!bubble) return;
  bubble.textContent = text;
  bubble.className = `cg-bubble cg-bubble--show${isAngry ? ' cg-bubble--angry' : ''}`;
  setTimeout(() => {
    bubble.className = 'cg-bubble hidden';
  }, isAngry ? ANNOY_COOLDOWN : 2000);
}

/** Return a time-of-day quip occasionally, null otherwise */
function getTimedQuip() {
  const h = new Date().getHours();
  if (Math.random() > 0.35) return null; // only 35% chance to override
  if (h >= 22 || h < 4)   return '😴 sleepy...';
  if (h >= 4  && h < 7)   return '🌅 up early!';
  if (h >= 7  && h < 11)  return '☀️ good morning!';
  if (h >= 14 && h < 17)  return '🌤️ afternoon vibe';
  if (h >= 20 && h < 22)  return '🌙 night session~';
  return null;
}

// ── Idle attention getter ─────────────────────────────────────

function startIdleTimer() {
  stopIdleTimer();
  if (!_enabled) return;
  _idleTimer = setTimeout(() => doIdleWiggle(), IDLE_TIMEOUT);
}

function stopIdleTimer() {
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = null;
}

function resetIdleTimer() {
  stopIdleTimer();
  startIdleTimer();
}

function doIdleWiggle() {
  const wrapper = document.getElementById(COMPANION_ID);
  if (!wrapper || !_enabled) return;
  wrapper.classList.add('cg-idle-attention');
  setTimeout(() => {
    wrapper.classList.remove('cg-idle-attention');
    startIdleTimer(); // loop
  }, 2000);
}

function show() {
  const el = document.getElementById(COMPANION_ID);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('cannaguy-companion--visible');
  }
  startIdleTimer();
}

function hide() {
  const el = document.getElementById(COMPANION_ID);
  if (el) {
    el.classList.remove('cannaguy-companion--visible');
    el.classList.add('hidden');
  }
  stopIdleTimer();
}
