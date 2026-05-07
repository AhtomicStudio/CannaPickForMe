/**
 * CannaGotchi — Game Screen
 * Main idle game view: CannaGuy viewport, stats, XP bar, actions.
 *
 * Bells & whistles:
 *   • Daily login bonus (+25 XP, once per calendar day)
 *   • Action streak (3 actions in a row = +2 bonus XP + streak floater)
 *   • Evolution countdown hint when within 30 XP of next stage
 *   • Level-up XP bar gold flash
 *   • Companion re-init after first CannaGuy creation
 *   • Spam protection + debounced Firestore saves
 */

import { getMonsterType } from './monsters.js';
import {
  getLevel, getLevelProgress, getStats, calcIdleXP,
  getCurrentEvolution, checkEvolution, xpForLevel,
} from './gameEngine.js';
import { getAvailableMoves } from './moves.js';
import { renderSprite } from './pixelArt.js';
import { loadGameState, saveGameState, createInitialGameState } from '../services/gameService.js';
import { renderOnboarding } from './onboardingScreen.js';
import { createTapReactor } from './companion.js';

let _gameState = null;
let _uid = null;
let _onBack = () => {};
let _idleInterval = null;
let _container = null;
let _tapReactor = null;

// ── Spam Protection ──────────────────────────────────────────
const ACTION_COOLDOWN_MS = 1500;
let _lastFeedTime = 0;
let _lastWaterTime = 0;
let _saveDebounce = null;

// ── Animation Cycles ─────────────────────────────────────────
const FEED_ANIMS  = ['game-anim--munch', 'game-anim--nom', 'game-anim--chomp'];
const WATER_ANIMS = ['game-anim--sip', 'game-anim--splash', 'game-anim--gulp'];
let _feedAnimIdx  = 0;
let _waterAnimIdx = 0;
let _currentIdleAnim = 'game-anim--seed';

// ── Streak System ─────────────────────────────────────────────
let _streakCount = 0;
let _streakTimer  = null;
const STREAK_WINDOW_MS = 8000; // actions must happen within 8s of each other
const STREAK_BONUS_XP  = 2;

// ── Daily Bonus ───────────────────────────────────────────────
const DAILY_KEY     = 'cpfm_cg_last_daily';
const DAILY_BONUS   = 25;

function getIdleAnimForSprite(spriteName) {
  if (spriteName.includes('ancient')) return 'game-anim--ancient';
  if (spriteName.includes('bloom'))   return 'game-anim--bloom';
  if (spriteName.includes('sapling')) return 'game-anim--sapling';
  if (spriteName.includes('sprout'))  return 'game-anim--sprout';
  return 'game-anim--seed';
}

// ── Public API ────────────────────────────────────────────────

export async function initGameScreen(container, uid, onBack) {
  _container = container;
  _uid = uid;
  _onBack = onBack;

  _gameState = await loadGameState(uid);

  if (!_gameState) {
    renderOnboarding(container, async (choice) => {
      _gameState = createInitialGameState(choice.monsterType, choice.monsterName);
      await saveGameState(uid, _gameState);
      // Re-init companion so it appears immediately after first creation
      try {
        const { initCompanion } = await import('./companion.js');
        await initCompanion(uid);
      } catch (e) { /* companion is non-critical */ }
      renderIdleView();
    });
  } else {
    collectIdleXP();
    maybeGrantDailyBonus();
    renderIdleView();
  }
}

export function destroyGameScreen() {
  if (_idleInterval) clearInterval(_idleInterval);
  if (_saveDebounce) clearTimeout(_saveDebounce);
  if (_streakTimer)  clearTimeout(_streakTimer);
  if (_tapReactor)   { _tapReactor.destroy(); _tapReactor = null; }
  _idleInterval = null;
  _streakCount  = 0;
}

// ── Internal helpers ──────────────────────────────────────────

function collectIdleXP() {
  if (!_gameState) return;
  const now = Date.now();
  const earned = calcIdleXP(_gameState.lastTick, now, 10); // 10 XP/min
  if (earned > 0) {
    _gameState.xp += earned;
    _gameState.lastTick = now;
  }
}

function maybeGrantDailyBonus() {
  if (!_gameState) return;
  const today = new Date().toDateString();
  if (localStorage.getItem(DAILY_KEY) === today) return;
  localStorage.setItem(DAILY_KEY, today);
  _gameState.xp += DAILY_BONUS;
  _gameState.lastTick = Date.now();
  // Show bonus after view renders
  setTimeout(() => showFloater(`☀️ Daily bonus! +${DAILY_BONUS} XP`, 'floater--gold'), 600);
}

function debouncedSave() {
  if (_saveDebounce) clearTimeout(_saveDebounce);
  _saveDebounce = setTimeout(() => saveGameState(_uid, _gameState), 2000);
}

function startIdleTick() {
  if (_idleInterval) clearInterval(_idleInterval);
  _idleInterval = setInterval(() => {
    const oldLevel = getLevel(_gameState.xp);
    _gameState.xp += 1;
    _gameState.lastTick = Date.now();
    const newLevel = getLevel(_gameState.xp);

    if (newLevel > oldLevel) {
      const monType = getMonsterType(_gameState.monsterType);
      const evoCheck = checkEvolution(monType.evolutions, oldLevel, newLevel);
      if (evoCheck.evolved) showEvolutionNotice(evoCheck.evolution);
      renderIdleView();
      saveGameState(_uid, _gameState);
    } else {
      updateXPBar();
      updateEvoHint();
    }
  }, 6000);
}

function applyIdleAnim() {
  const el = _container?.querySelector('#game-monster-sprite');
  if (el) el.className = 'game-monster ' + _currentIdleAnim;
}

// ── Render ────────────────────────────────────────────────────

function renderIdleView() {
  if (!_gameState || !_container) return;

  const monType   = getMonsterType(_gameState.monsterType);
  const level     = getLevel(_gameState.xp);
  const progress  = getLevelProgress(_gameState.xp);
  const stats     = getStats(monType.baseStats, level);
  const evolution = getCurrentEvolution(monType.evolutions, level);
  const moves     = getAvailableMoves(_gameState.monsterType, level);

  // Evo hint — how many XP until next evolution?
  const nextEvo = monType.evolutions.find(e => e.level > level);
  const xpToNextEvo = nextEvo ? xpForLevel(nextEvo.level) - _gameState.xp : null;
  const nearEvo = xpToNextEvo !== null && xpToNextEvo <= 30;

  _container.innerHTML = `
    <div class="game-view">
      <div class="game-header">
        <button id="game-back" class="btn btn--icon game-back-btn">←</button>
        <div class="game-header__info">
          <span class="game-header__name">${_gameState.monsterName}</span>
          <span class="game-header__level" style="color:${monType.color}">Lv.${level}</span>
        </div>
        <span class="game-header__evo">${evolution.name}</span>
      </div>

      <div class="game-viewport" role="button" tabindex="0" aria-label="Pet ${_gameState.monsterName}">
        <div class="game-viewport__scanlines"></div>
        <div class="cg-stress" id="game-cg-stress">💢</div>
        <div class="cg-bubble hidden" id="game-cg-bubble"></div>
        <div class="game-monster" id="game-monster-sprite"></div>
      </div>

      <div class="game-xp-section">
        <div class="game-xp-label">
          <span>XP</span>
          <span id="game-xp-text">${progress.current} / ${progress.needed}</span>
        </div>
        <div class="game-xp-bar" id="game-xp-bar">
          <div class="game-xp-bar__fill" id="game-xp-fill"
            style="width:${progress.progress * 100}%;background:${monType.color}">
          </div>
        </div>
        ${nearEvo ? `
          <div class="game-evo-hint" id="game-evo-hint">
            ⚡ ${xpToNextEvo} XP to ${nextEvo.name}!
          </div>` : ''}
      </div>

      <div class="game-stats">
        ${renderStatBar('HP',  stats.hp,  monType.color)}
        ${renderStatBar('ATK', stats.atk, '#f87171')}
        ${renderStatBar('DEF', stats.def, '#38bdf8')}
        ${renderStatBar('SPD', stats.spd, '#fbbf24')}
      </div>

      <div class="game-moves-section">
        <div class="game-section-label">Moves</div>
        <div class="game-moves">
          ${moves.map(m => `
            <div class="game-move">
              <span class="game-move__emoji">${m.emoji}</span>
              <span class="game-move__name">${m.name}</span>
              <span class="game-move__power">${m.power > 0 ? 'PWR ' + m.power : 'Status'}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="game-record">
        <span>🏆 ${_gameState.wins}W / ${_gameState.losses}L</span>
        ${_streakCount >= 3 ? `<span class="game-streak">🔥 ${_streakCount} streak!</span>` : ''}
      </div>

      <div class="game-actions">
        <button class="btn btn--ghost game-action-btn" id="btn-game-feed">🌿 Feed</button>
        <button class="btn btn--ghost game-action-btn" id="btn-game-water">💧 Water</button>
        <button class="btn btn--secondary game-action-btn" id="btn-game-battle" disabled>
          ⚔️ Battle <span class="settings-badge">Soon</span>
        </button>
      </div>
    </div>
  `;

  // Render sprite
  const spriteEl = _container.querySelector('#game-monster-sprite');
  renderSprite(spriteEl, evolution.sprite, 6);
  _currentIdleAnim = getIdleAnimForSprite(evolution.sprite);
  applyIdleAnim();

  // Wire tap reactor — shares the same reaction cycle as the persistent companion.
  if (_tapReactor) { _tapReactor.destroy(); _tapReactor = null; }
  const viewportEl = _container.querySelector('.game-viewport');
  _tapReactor = createTapReactor({
    wrapper: viewportEl,
    sprite:  spriteEl,
    bubble:  _container.querySelector('#game-cg-bubble'),
    stress:  _container.querySelector('#game-cg-stress'),
    idleAnim: _currentIdleAnim,
    idleTimer: false, // no idle wiggle on a dedicated screen
  });
  // Keyboard activation — Enter/Space pet the sprite.
  viewportEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      _tapReactor?.handleTap();
    }
  });

  // Wire events
  _container.querySelector('#game-back').addEventListener('click', () => {
    destroyGameScreen();
    saveGameState(_uid, _gameState);
    _onBack();
  });

  _container.querySelector('#btn-game-feed').addEventListener('click', (e) => {
    const now = Date.now();
    if (now - _lastFeedTime < ACTION_COOLDOWN_MS) {
      showFloater('⏳ Wait...');
      shakeButton(e.currentTarget);
      return;
    }
    _lastFeedTime = now;
    feedCannaGuy();
  });

  _container.querySelector('#btn-game-water').addEventListener('click', (e) => {
    const now = Date.now();
    if (now - _lastWaterTime < ACTION_COOLDOWN_MS) {
      showFloater('⏳ Wait...');
      shakeButton(e.currentTarget);
      return;
    }
    _lastWaterTime = now;
    waterCannaGuy();
  });

  startIdleTick();
}

function renderStatBar(label, value, color) {
  const pct = Math.min(100, (value / 200) * 100);
  return `
    <div class="game-stat-row">
      <span class="game-stat-row__label">${label}</span>
      <div class="game-stat-row__bar">
        <div class="game-stat-row__fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="game-stat-row__val">${value}</span>
    </div>
  `;
}

function updateXPBar() {
  const progress = getLevelProgress(_gameState.xp);
  const fill  = _container?.querySelector('#game-xp-fill');
  const label = _container?.querySelector('#game-xp-text');
  if (fill)  fill.style.width = `${progress.progress * 100}%`;
  if (label) label.textContent = `${progress.current} / ${progress.needed}`;
}

function updateEvoHint() {
  if (!_gameState) return;
  const monType   = getMonsterType(_gameState.monsterType);
  const level     = getLevel(_gameState.xp);
  const nextEvo   = monType.evolutions.find(e => e.level > level);
  const xpToNext  = nextEvo ? xpForLevel(nextEvo.level) - _gameState.xp : null;
  const hintEl    = _container?.querySelector('#game-evo-hint');

  if (xpToNext !== null && xpToNext <= 30) {
    if (!hintEl) {
      // Inject hint dynamically
      const xpSection = _container?.querySelector('.game-xp-section');
      if (xpSection) {
        const hint = document.createElement('div');
        hint.id = 'game-evo-hint';
        hint.className = 'game-evo-hint';
        hint.textContent = `⚡ ${xpToNext} XP to ${nextEvo.name}!`;
        xpSection.appendChild(hint);
      }
    } else {
      hintEl.textContent = `⚡ ${xpToNext} XP to ${nextEvo.name}!`;
    }
  } else if (hintEl) {
    hintEl.remove();
  }
}

function flashXPBar() {
  const bar = _container?.querySelector('#game-xp-bar');
  if (!bar) return;
  bar.classList.add('game-xp-bar--levelup');
  setTimeout(() => bar.classList.remove('game-xp-bar--levelup'), 800);
}

function shakeButton(btn) {
  btn.classList.add('game-btn-shake');
  setTimeout(() => btn.classList.remove('game-btn-shake'), 400);
}

function playReactionAnim(animClass) {
  const el = _container?.querySelector('#game-monster-sprite');
  if (!el) return;
  el.className = 'game-monster ' + animClass;
  setTimeout(() => applyIdleAnim(), 1200);
}

// ── Streak logic ──────────────────────────────────────────────

function registerAction() {
  if (_streakTimer) clearTimeout(_streakTimer);
  _streakCount++;
  _streakTimer = setTimeout(() => { _streakCount = 0; }, STREAK_WINDOW_MS);

  if (_streakCount === 3) {
    showFloater(`🔥 On a roll! +${STREAK_BONUS_XP} XP`, 'floater--streak');
  }
  if (_streakCount >= 3) {
    _gameState.xp += STREAK_BONUS_XP;
  }

  // Update streak badge in record row without full re-render
  const record = _container?.querySelector('.game-record');
  if (record) {
    const existing = record.querySelector('.game-streak');
    if (_streakCount >= 3) {
      if (existing) existing.textContent = `🔥 ${_streakCount} streak!`;
      else {
        const s = document.createElement('span');
        s.className = 'game-streak';
        s.textContent = `🔥 ${_streakCount} streak!`;
        record.appendChild(s);
      }
    }
  }
}

// ── Actions ───────────────────────────────────────────────────

function applyXP(amount, floaterText) {
  const oldLevel = getLevel(_gameState.xp);
  _gameState.xp += amount;
  _gameState.lastTick = Date.now();
  registerAction();

  showFloater(floaterText);
  const newLevel = getLevel(_gameState.xp);

  if (newLevel > oldLevel) {
    flashXPBar();
    const monType = getMonsterType(_gameState.monsterType);
    const evoCheck = checkEvolution(monType.evolutions, oldLevel, newLevel);
    if (evoCheck.evolved) showEvolutionNotice(evoCheck.evolution);
    renderIdleView();
  } else {
    updateXPBar();
    updateEvoHint();
  }
  debouncedSave();
}

function feedCannaGuy() {
  const anim = FEED_ANIMS[_feedAnimIdx % FEED_ANIMS.length];
  _feedAnimIdx++;
  playReactionAnim(anim);
  applyXP(5, '🌿 +5 XP');
}

function waterCannaGuy() {
  const anim = WATER_ANIMS[_waterAnimIdx % WATER_ANIMS.length];
  _waterAnimIdx++;
  playReactionAnim(anim);
  applyXP(5, '💧 +5 XP');
}

// ── UI helpers ────────────────────────────────────────────────

function showFloater(text, extraClass = '') {
  const el = document.createElement('div');
  el.className = `game-floater ${extraClass}`;
  el.textContent = text;
  const viewport = _container?.querySelector('.game-viewport');
  if (!viewport) return;
  viewport.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

function showEvolutionNotice(evolution) {
  const overlay = document.createElement('div');
  overlay.className = 'game-evolution-overlay';
  overlay.innerHTML = `
    <div class="game-evolution-card">
      <div class="game-evolution-card__flash"></div>
      <h3 class="game-retro-title">🎉 Evolution!</h3>
      <p>Your CannaGuy evolved into</p>
      <p class="game-evolution-card__name">${evolution.name}</p>
      <div class="game-evolution-card__sprite" id="evo-sprite"></div>
      <button class="btn btn--primary btn--glow game-confirm-btn" id="evo-dismiss">Awesome!</button>
    </div>
  `;
  _container.appendChild(overlay);
  renderSprite(overlay.querySelector('#evo-sprite'), evolution.sprite, 7);
  overlay.querySelector('#evo-dismiss').addEventListener('click', () => overlay.remove());
}

// ── External XP grant ─────────────────────────────────────────

export function grantSessionXP() {
  if (!_gameState || !_uid) return;
  _gameState.xp += 50;
  _gameState.lastTick = Date.now();
  saveGameState(_uid, _gameState);
}
