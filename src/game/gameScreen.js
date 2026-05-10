/**
 * CannaGotchi — Game Screen (rewritten)
 *
 * A tabbed lounge-grade sim screen with five surfaces:
 *
 *   🪴 Garden  — Cannabud viewport, needs, care actions, garden upgrades
 *   ⚔️ Battle  — Wild encounters, boss arena, post-battle rewards
 *   🛒 Shop    — Spend Buds on items + garden tier upgrades
 *   📜 Quests  — Daily quests, achievements, prestige hub
 *   🆚 Versus  — Local hot-seat PvP today; BLE/QR pairing in next pass
 *
 * Architecture:
 *   • A single `state` object (this module's _gameState reference).
 *   • Each tab renders into the same container by replacing innerHTML
 *     of the tab body, leaving the persistent header/tab bar intact.
 *   • Auto-save is debounced; a single idle-tick drives passive XP +
 *     needs decay + need ↦ XP/stat multipliers + tempBuffs.
 *   • All gameplay events (xp, level, evo, buds, ach unlocks) flow
 *     through eventBus.js so SFX, toasts, and quest tracking can react
 *     without coupling.
 */

import { getMonsterType, MONSTER_TYPES } from './monsters.js';
import {
  getLevel, getLevelProgress, getStats, calcIdleXP,
  getCurrentEvolution, checkEvolution, xpForLevel,
} from './gameEngine.js';
import { getAvailableMoves } from './moves.js';
import { renderSprite, renderHat } from './pixelArt.js';
import {
  loadGameState, saveGameState, createInitialGameState, refreshLevelCache,
} from '../services/gameService.js';
import { renderOnboarding } from './onboardingScreen.js';
import { createTapReactor } from './companion.js';

import { NEEDS, XP, PACING, CURRENCY, PRESTIGE } from './economyConfig.js';
import { applyDecay, restoreNeed, pet, moodSummary, mostNeedy, NEED_META, NEED_KEYS } from './needs.js';
import {
  ITEMS, GARDEN_UPGRADES, getEquippedTier, getGardenBonuses,
  consumeItem, addItem, shopList,
} from './inventory.js';
import { ensureDaily, reportQuestProgress, claimQuest } from './quests.js';
import { getTrait, describeTrait } from './traits.js';
import { MOVES_BY_TYPE } from './moves.js';
import {
  HATS, FRAMES, AURAS, COSMETICS_BY_ID, COSMETIC_SLOTS,
  listCosmeticsForSlot, buyCosmetic, equipCosmetic, getEquipped,
  syncAchievementCosmetics,
} from './cosmetics.js';
import { THEMES, isThemeUnlocked, isPremiumTheme, unlockTheme, syncUnlockedThemesFromGame, applyTheme } from '../services/themeService.js';
import { getVariant } from './monsters.js';
import { checkTitles, getEquippedTitle, listEarnedTitles, equipTitle, TITLES } from './titles.js';
import { processLoginStreak, STREAK_REWARDS } from './loginStreak.js';
import {
  PLOT_IDS, PLOT_LABELS, PLOT_UNLOCK_COSTS, MAX_PLOTS,
  getActivePlotId, getPlotsUnlocked, plotIsLocked, plotIsEmpty, plotHasBud,
  switchToPlot, unlockNextPlot, plantBudInEmptyPlot, readPlotMeta, snapshotActiveTo,
} from './plots.js';
import {
  canBreed, isBreeding, isOffspringReady, getBreedingProgress,
  collectLivingBuds, startBreeding, skipBreedingWithSeeds, claimOffspring,
  cancelBreeding,
} from './breeding.js';
import {
  shouldPromptPathChoice, listPathsFor, getPath, pickPath,
  combinedPaletteRemap,
} from './evolutionPaths.js';
import { getTodaysEvent } from './worldEvents.js';
import { harvestTick, msUntilNextTrichome, TRICHOME_COSMETICS } from './trichomes.js';
import { tutorialSeen, startTutorial, resetTutorial } from './tutorial.js';
import { track } from '@vercel/analytics';
import { runMiniGame, RESULT_MULTIPLIERS } from './miniGames.js';

const MINIGAME_PREF_KEY = 'cpfm_cg_minigames_enabled';
// Defaults to ON — players opt OUT if they want zero-friction taps.
function miniGamesEnabled() {
  const v = localStorage.getItem(MINIGAME_PREF_KEY);
  return v === null ? true : v === 'true';
}
function setMiniGamesEnabled(on) { localStorage.setItem(MINIGAME_PREF_KEY, String(!!on)); }
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID, checkAchievements } from './achievements.js';
import { getPrestigeMultipliers, canPrestige, previewPrestige, doPrestige } from './prestige.js';
import { makeWildEncounter, makeBossEncounter, nextAvailableBoss, BOSSES, makePlayerCombatant } from './encounters.js';
import { sfx } from './sfx.js';
import { emit, on } from './eventBus.js';

// ── Module state ──────────────────────────────────────────────
let _gameState = null;
let _uid = null;
let _onBack = () => {};
let _container = null;
let _idleInterval = null;
let _saveDebounce = null;
let _tapReactor = null;
let _activeTab = 'garden';
let _busListeners = [];
let _battleSession = null; // populated when in a battle
let _versusSession = null; // populated when in a hot-seat duel

// ── Cooldowns / streak ────────────────────────────────────────
const _cd = { feed: 0, water: 0, clean: 0, pet: 0 };
let _streakCount = 0;
let _streakTimer = null;

// ── Public API ────────────────────────────────────────────────
export async function initGameScreen(container, uid, onBack) {
  _container = container;
  _uid       = uid;
  _onBack    = onBack;
  _gameState = await loadGameState(uid);

  // Analytics: cannagotchi opened
  try { track('cannagotchi_opened'); } catch (_) {}

  if (!_gameState) {
    renderOnboarding(container, async (choice) => {
      _gameState = createInitialGameState(choice.monsterType, choice.monsterName, choice.monsterVariant);
      await saveGameState(uid, _gameState);
      try { track('cannabud_planted', { type: choice.monsterType, variant: choice.monsterVariant, plot: 'plot_1', firstTime: true }); } catch (_) {}
      try {
        const { initCompanion } = await import('./companion.js');
        await initCompanion(uid);
      } catch (_) {}
      bootIntoTabs();
    });
  } else {
    collectIdleAndDailyBonuses();
    bootIntoTabs();
  }
}

export function destroyGameScreen() {
  if (_idleInterval) clearInterval(_idleInterval);
  if (_saveDebounce) clearTimeout(_saveDebounce);
  if (_streakTimer)  clearTimeout(_streakTimer);
  if (_tapReactor)   { _tapReactor.destroy(); _tapReactor = null; }
  _busListeners.forEach(off => off());
  _busListeners = [];
  _idleInterval = null;
  _streakCount  = 0;
  _battleSession = null;
  _versusSession = null;
}

/**
 * Award the player's Cannabud for completing a pick session.
 * Works whether or not the game screen is currently open:
 *   • In-screen → applies live to the active state and saves debounced.
 *   • Offline   → loads + mutates + saves the latest Firestore copy.
 */
export async function grantSessionXP(strain, uidOverride) {
  // Path A — active session
  if (_gameState && _uid) {
    const mult = combinedXpMult();
    const xp   = Math.floor(XP.PICK_SESSION_REWARD * mult);
    const buds = Math.floor(CURRENCY.BUDS_FROM_PICK * combinedBudMult());
    applyXP(xp, '🎯', 'Pick reward');
    giveBuds(buds, 'pick');
    if (strain?.id) {
      if (!_gameState.lifetime) _gameState.lifetime = {};
      if (!_gameState.lifetime.strainsDiscovered) _gameState.lifetime.strainsDiscovered = [];
      const lifeArr = _gameState.lifetime.strainsDiscovered;
      const isNew = !lifeArr.includes(strain.id);
      if (isNew) lifeArr.push(strain.id);
      // Discover unlock — strain skin + maybe a hat
      if (isNew) {
        const { recordStrainDiscovery } = await import('./strainUnlocks.js');
        const unlocks = recordStrainDiscovery(_gameState, strain);
        unlocks.forEach((u, i) => {
          setTimeout(() => {
            if (u.kind === 'skin') toast(`🎨 Unlocked ${u.strainName} skin!`, 'gold', 3000);
            else if (u.kind === 'hat') toast(`🎩 Unlocked a strain-themed hat from ${u.strainName}!`, 'gold', 3500);
          }, 1200 + i * 1300);
        });
      }
    }
    reportQuestProgress(_gameState, 'pick_session', 1);
    checkAchievements(_gameState);
    debouncedSave();
    return;
  }
  // Path B — game closed; load → mutate → save
  const uid = uidOverride;
  if (!uid) return;
  try {
    const state = await loadGameState(uid);
    if (!state) return; // user hasn't onboarded their Cannabud yet
    state.xp   = (state.xp   || 0) + XP.PICK_SESSION_REWARD;
    state.buds = (state.buds || 0) + CURRENCY.BUDS_FROM_PICK;
    if (strain?.id) {
      if (!state.lifetime) state.lifetime = {};
      if (!state.lifetime.strainsDiscovered) state.lifetime.strainsDiscovered = [];
      const lifeArr = state.lifetime.strainsDiscovered;
      const isNew = !lifeArr.includes(strain.id);
      if (isNew) {
        lifeArr.push(strain.id);
        const { recordStrainDiscovery } = await import('./strainUnlocks.js');
        recordStrainDiscovery(state, strain);
      }
    }
    reportQuestProgress(state, 'pick_session', 1);
    checkAchievements(state);
    await saveGameState(uid, state);
  } catch (err) {
    console.warn('[cannagotchi] offline grantSessionXP failed:', err);
  }
}

export async function grantStashAddBonus(uidOverride) {
  if (_gameState && _uid) {
    giveBuds(CURRENCY.BUDS_FROM_STASH_ADD, 'stash');
    debouncedSave();
    return;
  }
  const uid = uidOverride;
  if (!uid) return;
  try {
    const state = await loadGameState(uid);
    if (!state) return;
    state.buds = (state.buds || 0) + CURRENCY.BUDS_FROM_STASH_ADD;
    await saveGameState(uid, state);
  } catch (err) {
    console.warn('[cannagotchi] offline stash bonus failed:', err);
  }
}

// ── Boot ──────────────────────────────────────────────────────
function bootIntoTabs() {
  refreshLevelCache(_gameState);
  ensureDaily(_gameState);
  checkAchievements(_gameState);
  // Auto-grant achievement-locked cosmetics
  if (!_gameState.cosmetics) _gameState.cosmetics = { owned: {}, equipped: {} };
  syncAchievementCosmetics(_gameState);
  // Mirror unlocked themes from save → localStorage
  syncUnlockedThemesFromGame(_gameState);
  // Earned titles
  const newTitles = checkTitles(_gameState);
  // Login streak — fires once per calendar day
  const streak = processLoginStreak(_gameState);
  if (streak) {
    setTimeout(() => toast(`🔥 Day ${streak.day} — ${streak.label}`, 'gold', 3200), 1500);
  }
  // Welcome-back title-unlock toasts
  newTitles.forEach((t, i) => {
    setTimeout(() => toast(`🎖️ Title earned: ${t.label}`, 'gold', 2400), 2400 + i * 600);
  });
  // Catch-up Trichome harvest if user was offline for a day or more
  const tGain = harvestTick(_gameState);
  if (tGain > 0) {
    setTimeout(() => toast(`✨ While away: harvested ${tGain} Trichome${tGain > 1 ? 's' : ''}!`, 'gold', 3500), 3000);
  }
  wireBusListeners();
  renderShell();
  switchTab('garden');
  startIdleTick();
  // Pending evolution-path choice (e.g. they leveled past 30 while offline)
  if (shouldPromptPathChoice(_gameState)) {
    setTimeout(() => showPathChoiceModal(), 2000);
  }
  // First-time tutorial — fires once per device, after the Garden tab renders
  if (!tutorialSeen()) {
    setTimeout(() => startTutorial(), 1200);
  }
}

function wireBusListeners() {
  _busListeners.forEach(off => off());
  _busListeners = [
    on('game:xp-gained',     ({ amount, source }) => reportQuestProgress(_gameState, 'gain_xp', amount)),
    on('game:level-up',      () => { sfx.levelUp(); reportQuestProgress(_gameState, 'level_up', 1); }),
    on('game:evolved',       (e) => {
      sfx.evolution();
      showEvolutionNotice(e.evolution);
      _gameState.seeds = (_gameState.seeds||0) + CURRENCY.SEEDS_FROM_EVOLUTION;
      // Memory wall — keep last 30 entries
      if (!_gameState.memories) _gameState.memories = [];
      _gameState.memories.unshift({ ts: Date.now(), kind: 'evolve', sprite: e.evolution.sprite, caption: `${_gameState.monsterName} became a ${e.evolution.name}!` });
      _gameState.memories = _gameState.memories.slice(0, 30);
      checkTitles(_gameState);
      // Lv.30 evolution → prompt for branch choice if not already picked
      if (shouldPromptPathChoice(_gameState)) {
        // Brief delay so the evolution overlay isn't immediately covered
        setTimeout(() => showPathChoiceModal(), 1800);
      }
    }),
    on('game:achievement',   ({ def }) => { sfx.achievement(); toast(`🏆 ${def.name}!`, 'gold', 2400); }),
    on('game:quest-complete',() => { sfx.questDone(); }),
  ];
}

// ── Idle tick ─────────────────────────────────────────────────
function startIdleTick() {
  if (_idleInterval) clearInterval(_idleInterval);
  _idleInterval = setInterval(() => {
    if (!_gameState) return;

    // Decay needs based on real elapsed time + garden mult
    const garden = getGardenBonuses(_gameState.garden);
    // Slow decay further if garden upgrades are good
    const beforeDecay = { ..._gameState.needs };
    applyDecay(_gameState.needs);
    // Apply garden decay multiplier (already accounted for via cached lastDecayTick)
    // — we approximate by partially restoring needs back proportional to (1 - decayMult).
    // This is a pragmatic shortcut so each tick still does the right thing.
    if (garden.decayMult < 1) {
      for (const k of NEED_KEYS) {
        if (k === 'happiness') continue;
        const drained = Math.max(0, (beforeDecay[k] ?? NEEDS.MAX) - (_gameState.needs[k] ?? 0));
        const refund  = drained * (1 - garden.decayMult);
        _gameState.needs[k] = Math.min(NEEDS.MAX, (_gameState.needs[k] ?? 0) + refund);
      }
    }

    // Idle XP since last tick
    const now = Date.now();
    const opts = {
      ratePerMinute:  XP.IDLE_RATE_PER_MINUTE_OPEN,
      moodXpMult:     moodSummary(_gameState.needs).xpMult,
      gardenXpMult:   garden.xpMult,
      prestigeXpMult: getPrestigeMultipliers(_gameState).xpMult,
      doubleUntilMs:  _gameState.tempBuffs?.idleDoubleUntil || 0,
    };
    const earned = calcIdleXP(_gameState.lastTick, now, opts);
    if (earned > 0) applyXP(earned, '⚡', 'idle', /*silent=*/ true);
    _gameState.lastTick = now;

    // Idle Buds
    const budsEarned = Math.floor(((now - (_gameState._budTick || now)) / 60000) * CURRENCY.BUDS_PER_MINUTE_IDLE * combinedBudMult());
    if (budsEarned > 0) giveBuds(budsEarned, 'idle', /*silent=*/ true);
    _gameState._budTick = now;

    // Possible wild encounter on Battle tab
    maybeRollEncounter();

    // Trichome harvest tick (Lv.50+ only)
    const trichomesGained = harvestTick(_gameState);
    if (trichomesGained > 0) {
      toast(`✨ Harvested ${trichomesGained} Trichome${trichomesGained > 1 ? 's' : ''}!`, 'gold', 3000);
      sfx.evolution();
    }

    // Refresh whichever tab is open — but NEVER while a fight is in progress,
    // or we'd wipe the live battle/versus screen mid-round.
    if (!_battleSession && !_versusSession) {
      refreshActiveTab();
    } else {
      // Still keep the topbar in sync (XP/Buds tick) without touching body
      syncTopbar();
    }
    debouncedSave();
  }, PACING.IDLE_TICK_MS);
}

function collectIdleAndDailyBonuses() {
  if (!_gameState) return;
  const now = Date.now();
  refreshLevelCache(_gameState);

  // Decay first so idle reward reflects mood at the time of return
  applyDecay(_gameState.needs, now);

  const opts = {
    ratePerMinute:  XP.IDLE_RATE_PER_MINUTE_BASE,
    moodXpMult:     moodSummary(_gameState.needs).xpMult,
    gardenXpMult:   getGardenBonuses(_gameState.garden).xpMult,
    prestigeXpMult: getPrestigeMultipliers(_gameState).xpMult,
    doubleUntilMs:  _gameState.tempBuffs?.idleDoubleUntil || 0,
  };
  const xp = calcIdleXP(_gameState.lastTick, now, opts);
  if (xp > 0) {
    _gameState.xp = (_gameState.xp || 0) + xp;
    setTimeout(() => toast(`🌙 Welcome back! +${xp} XP while away`, 'gold'), 600);
  }
  _gameState.lastTick = now;
  _gameState._budTick = now;

  // Daily login
  const today = new Date().toDateString();
  const lastDaily = _gameState._lastDaily || '';
  if (lastDaily !== today) {
    _gameState._lastDaily = today;
    _gameState.xp   = (_gameState.xp   || 0) + XP.DAILY_LOGIN_BONUS;
    _gameState.buds = (_gameState.buds || 0) + CURRENCY.BUDS_DAILY_LOGIN;
    setTimeout(() => toast(`☀️ Daily Bonus: +${XP.DAILY_LOGIN_BONUS} XP, +${CURRENCY.BUDS_DAILY_LOGIN} Buds`, 'gold'), 1100);
  }
}

// ── Multipliers ──────────────────────────────────────────────
function combinedXpMult() {
  const m = moodSummary(_gameState.needs);
  const g = getGardenBonuses(_gameState.garden);
  const p = getPrestigeMultipliers(_gameState);
  const ev = getTodaysEvent();
  const eventXp = ev.mods?.xpMult ?? 1;
  return m.xpMult * g.xpMult * p.xpMult * eventXp;
}
function combinedBudMult() {
  const g = getGardenBonuses(_gameState.garden);
  const p = getPrestigeMultipliers(_gameState);
  const ev = getTodaysEvent();
  const eventBud = ev.mods?.budMult ?? 1;
  return g.budMult * p.budMult * eventBud;
}
function combinedStatMult() {
  const m = moodSummary(_gameState.needs);
  const p = getPrestigeMultipliers(_gameState);
  return m.statMult * p.statMult;
}

// ── Shell + tab system ────────────────────────────────────────
function renderShell() {
  if (!_gameState || !_container) return;
  const monType   = getMonsterType(_gameState.monsterType);
  const lvl       = getLevel(_gameState.xp);
  _gameState._level = lvl;
  const progress  = getLevelProgress(_gameState.xp);
  const evolution = getCurrentEvolution(monType.evolutions, lvl);

  _container.innerHTML = `
    <div class="game-view game-view--tabbed">
      <div class="game-topbar">
        <button id="game-back" class="btn btn--icon game-back-btn" aria-label="Back">←</button>
        <div class="game-topbar__info">
          <div class="game-topbar__name">${_gameState.monsterName}${(() => {
            const t = getEquippedTitle(_gameState);
            return t ? ` <span class="topbar-title">${t.label}</span>` : '';
          })()}</div>
          <div class="game-topbar__sub">
            <span style="color:${monType.color}">Lv.${lvl}</span>
            <span class="dim">${evolution.name}</span>
          </div>
        </div>
        <div class="game-topbar__resources">
          <span class="res-pill" title="Buds — primary currency">🪙 <b id="topbar-buds">${formatN(_gameState.buds)}</b></span>
          <span class="res-pill" title="Seeds — premium currency">🌱 <b id="topbar-seeds">${formatN(_gameState.seeds)}</b></span>
          ${(_gameState.trichomes > 0 || (_gameState._level ?? 1) >= 50) ? `
            <span class="res-pill" title="Trichomes — endgame currency from Lv.50+ buds">✨ <b id="topbar-trichomes">${formatN(_gameState.trichomes || 0)}</b></span>
          ` : ''}
        </div>
        <button id="game-mute" class="btn btn--icon game-mute-btn" aria-label="Toggle SFX" title="Toggle sound">${sfx.isMuted() ? '🔇' : '🔊'}</button>
      </div>

      <div class="game-xp-strip">
        <div class="game-xp-bar"><div class="game-xp-bar__fill" id="topbar-xp-fill" style="width:${progress.progress*100}%;background:${monType.color}"></div></div>
        <div class="game-xp-strip__label" id="topbar-xp-label">${progress.current} / ${progress.needed} XP</div>
      </div>

      ${(() => {
        const ev = getTodaysEvent();
        return `
          <div class="world-event-banner" title="${ev.desc}">
            <span class="world-event-banner__emoji">${ev.emoji}</span>
            <span class="world-event-banner__name">${ev.name}</span>
            <span class="dim small">${ev.desc}</span>
          </div>`;
      })()}

      <nav class="game-tabs" role="tablist">
        <button class="game-tab" data-tab="garden" role="tab">🪴 <span>Garden</span></button>
        <button class="game-tab" data-tab="battle" role="tab">⚔️ <span>Battle</span></button>
        <button class="game-tab" data-tab="shop"   role="tab">🛒 <span>Shop</span></button>
        <button class="game-tab" data-tab="quests" role="tab">📜 <span>Quests</span></button>
        <button class="game-tab" data-tab="versus" role="tab">🆚 <span>Versus</span></button>
      </nav>

      <main class="game-tab-body" id="game-tab-body" tabindex="0"></main>
    </div>
  `;

  _container.querySelector('#game-back').addEventListener('click', () => {
    sfx.click();
    destroyGameScreen();
    saveGameState(_uid, _gameState);
    _onBack();
  });
  _container.querySelector('#game-mute').addEventListener('click', (e) => {
    sfx.setMuted(!sfx.isMuted());
    e.currentTarget.textContent = sfx.isMuted() ? '🔇' : '🔊';
  });
  _container.querySelectorAll('.game-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(name) {
  _activeTab = name;
  sfx.click();
  _container.querySelectorAll('.game-tab').forEach(btn => {
    btn.classList.toggle('game-tab--active', btn.dataset.tab === name);
  });
  refreshActiveTab(/*animate=*/true);
}

function refreshActiveTab(animate = false) {
  if (!_container) return;
  const body = _container.querySelector('#game-tab-body');
  if (!body) return;
  // Tear down per-tab listeners by re-rendering
  if (_tapReactor) { _tapReactor.destroy(); _tapReactor = null; }
  if (animate) body.classList.remove('fade-in'), void body.offsetWidth, body.classList.add('fade-in');

  switch (_activeTab) {
    case 'garden': body.innerHTML = renderGardenTab(); wireGardenTab(body); break;
    case 'battle': body.innerHTML = renderBattleTab(); wireBattleTab(body); break;
    case 'shop':   body.innerHTML = renderShopTab();   wireShopTab(body);   break;
    case 'quests': body.innerHTML = renderQuestsTab(); wireQuestsTab(body); break;
    case 'versus': body.innerHTML = renderVersusTab(); wireVersusTab(body); break;
  }
  syncTopbar();
}

function syncTopbar() {
  const lvl = getLevel(_gameState.xp);
  _gameState._level = lvl;
  const progress = getLevelProgress(_gameState.xp);
  const fill = _container?.querySelector('#topbar-xp-fill');
  const lab  = _container?.querySelector('#topbar-xp-label');
  const buds = _container?.querySelector('#topbar-buds');
  const seeds= _container?.querySelector('#topbar-seeds');
  const tri  = _container?.querySelector('#topbar-trichomes');
  if (fill) fill.style.width = `${progress.progress*100}%`;
  if (lab)  lab.textContent  = `${progress.current} / ${progress.needed} XP`;
  if (buds) buds.textContent = formatN(_gameState.buds);
  if (seeds)seeds.textContent= formatN(_gameState.seeds);
  if (tri)  tri.textContent  = formatN(_gameState.trichomes || 0);
}

// ── GARDEN TAB ────────────────────────────────────────────────
function renderGardenTab() {
  const monType   = getMonsterType(_gameState.monsterType);
  const lvl       = getLevel(_gameState.xp);
  const evolution = getCurrentEvolution(monType.evolutions, lvl);
  const stats     = getStats(monType.baseStats, lvl);
  const mood      = moodSummary(_gameState.needs);
  const lowest    = mostNeedy(_gameState.needs);
  const prestigeMul = getPrestigeMultipliers(_gameState);

  const needsHTML = NEED_KEYS.map(k => {
    const meta = NEED_META[k];
    const v = _gameState.needs[k] ?? 100;
    const pct = Math.max(0, Math.min(100, v));
    const lowGlow = v < NEEDS.THRESHOLD_BAD ? ' need-row--low' : v < NEEDS.THRESHOLD_OK ? ' need-row--mid' : '';
    return `
      <div class="need-row${lowGlow}">
        <span class="need-row__icon" title="${meta.label}">${meta.emoji}</span>
        <div class="need-row__bar"><div class="need-row__fill" style="width:${pct}%;background:${meta.color}"></div></div>
        <span class="need-row__val">${Math.round(pct)}</span>
      </div>`;
  }).join('');

  const moodMultStr = mood.statMult >= 1
    ? `+${Math.round((mood.statMult-1)*100)}% stats`
    : `${Math.round((mood.statMult-1)*100)}% stats`;
  const moodXpStr   = mood.xpMult >= 1
    ? `+${Math.round((mood.xpMult-1)*100)}% XP`
    : `${Math.round((mood.xpMult-1)*100)}% XP`;

  const hat   = getEquipped(_gameState, 'hat');
  const frame = getEquipped(_gameState, 'frame');
  const aura  = getEquipped(_gameState, 'aura');
  const frameClass = frame?.cssClass || '';
  const auraClass  = aura?.cssClass  || '';

  // Garden upgrades — paint into the background so the player SEES their setup
  const potTier   = getEquippedTier(_gameState.garden, 'pot');
  const soilTier  = getEquippedTier(_gameState.garden, 'soil');
  const lightTier = getEquippedTier(_gameState.garden, 'light');

  return `
    <section class="tab-pane">
      ${renderPlotPicker()}

      <div class="garden-viewport ${frameClass} ${auraClass}"
           data-pot="${potTier.id}" data-soil="${soilTier.id}" data-light="${lightTier.id}"
           role="button" tabindex="0" aria-label="Pet ${_gameState.monsterName}">
        <div class="garden-light-layer"></div>
        <div class="garden-pot-layer"></div>
        <div class="garden-soil-layer"></div>
        <div class="game-viewport__scanlines"></div>
        <div class="aura-layer"></div>
        <div class="cg-stress" id="garden-stress">💢</div>
        <div class="cg-bubble hidden" id="garden-bubble"></div>
        <div class="game-monster" id="garden-sprite"></div>
        <div class="garden-viewport__caption">
          <span>${mood.emoji} ${mood.label}</span>
          <span class="dim">${moodMultStr} · ${moodXpStr}</span>
        </div>
      </div>

      <div class="needs-card">
        <div class="card-title">Needs</div>
        ${needsHTML}
        ${lowest.value < NEEDS.THRESHOLD_OK ? `
          <div class="needs-hint">${NEED_META[lowest.key].emoji} ${_gameState.monsterName} could really use some ${NEED_META[lowest.key].label.toLowerCase()}.</div>` : ''}
      </div>

      <div class="action-row">
        <button class="btn-juicy" id="act-water">💧 Water<span class="dim small">+${NEEDS.RESTORE_TAP_WATER}</span></button>
        <button class="btn-juicy" id="act-feed">🌿 Feed<span class="dim small">+${NEEDS.RESTORE_TAP_FEED}</span></button>
        <button class="btn-juicy" id="act-clean">✨ Clean<span class="dim small">+10</span></button>
        <button class="btn-juicy" id="act-pet">🤚 Pet<span class="dim small">+6 😊</span></button>
      </div>

      <label class="minigame-toggle">
        <input type="checkbox" id="minigame-toggle" ${miniGamesEnabled() ? 'checked' : ''} />
        <span>🎮 Skill mini-games on care actions <span class="dim small">(Perfect = 1.5× restore)</span></span>
      </label>

      <button class="btn-juicy compact" id="btn-replay-tutorial" style="margin-top:0.4rem">📖 Replay tutorial</button>

      <div class="stats-card">
        <div class="card-title">Stats <span class="dim small">x${combinedStatMult().toFixed(2)}</span></div>
        ${statBar('HP',  Math.floor(stats.hp  * combinedStatMult()), monType.color)}
        ${statBar('ATK', Math.floor(stats.atk * combinedStatMult()), '#f87171')}
        ${statBar('DEF', Math.floor(stats.def * combinedStatMult()), '#38bdf8')}
        ${statBar('SPD', Math.floor(stats.spd * combinedStatMult()), '#fbbf24')}
      </div>

      ${_gameState.trait ? `
        <div class="card trait-card">
          <div class="card-title">Trait</div>
          <div class="trait-line">${describeTrait(_gameState.trait)}</div>
        </div>` : ''}

      <div class="garden-card">
        <div class="card-title">Garden Setup <span class="dim small">tap to upgrade</span></div>
        ${['pot','soil','light'].map(slot => {
          const cfg = GARDEN_UPGRADES[slot];
          const tier = getEquippedTier(_gameState.garden, slot);
          const idx = cfg.tiers.findIndex(t => t.id === tier.id);
          const next = cfg.tiers[idx + 1];
          const canAfford = next ? (_gameState.buds || 0) >= next.cost : false;
          const decayPct = tier.decayMult < 1 ? Math.round((1-tier.decayMult)*100) : 0;
          const xpPct    = tier.xpMult   > 1 ? Math.round((tier.xpMult-1)*100)     : 0;
          const budPct   = tier.budMult  > 1 ? Math.round((tier.budMult-1)*100)    : 0;
          return `
            <div class="garden-slot-row">
              <div class="garden-slot-row__head">
                <span class="garden-slot-row__emoji">${cfg.emoji}</span>
                <div class="garden-slot-row__info">
                  <div class="garden-slot-row__label">${cfg.label} <span class="dim small">(${idx+1}/${cfg.tiers.length})</span></div>
                  <div class="garden-slot-row__name">${tier.name}</div>
                </div>
              </div>
              <div class="garden-slot-row__bonuses">
                ${decayPct ? `<span class="bonus-pill">⏳ -${decayPct}% decay</span>` : ''}
                ${xpPct    ? `<span class="bonus-pill">⚡ +${xpPct}% XP</span>`     : ''}
                ${budPct   ? `<span class="bonus-pill">🪙 +${budPct}% Buds</span>`  : ''}
              </div>
              ${next ? `
                <button class="btn-juicy compact" data-garden-upgrade="${slot}" ${canAfford ? '' : 'disabled'}>
                  → ${next.name} <span class="dim small">🪙 ${formatN(next.cost)}</span>
                </button>` : `<div class="dim small" style="text-align:center">⭐ MAX</div>`}
            </div>`;
        }).join('')}
      </div>

      <div class="prestige-strip">
        <div class="dim small">Prestige Lv.${_gameState.prestige?.count || 0} · ${(prestigeMul.xpMult*100-100).toFixed(0)}% XP boost</div>
      </div>

      <div class="inventory-card">
        <div class="card-title">Inventory</div>
        ${(() => {
          const owned = Object.entries(_gameState.inventory || {}).filter(([_,n]) => n>0);
          if (owned.length === 0) {
            return `<div class="inventory-empty">📦 No items yet — visit the <b>Shop</b> tab to stock up.</div>`;
          }
          return `<div class="inventory-grid">
            ${owned.map(([id, n]) => {
              const it = ITEMS[id]; if (!it) return '';
              return `<button class="inv-item" data-item="${id}" title="${it.desc}">
                <span class="inv-item__emoji">${it.emoji}</span>
                <span class="inv-item__name">${it.name}</span>
                <span class="inv-item__count">×${n}</span>
              </button>`;
            }).join('')}
          </div>`;
        })()}
      </div>
    </section>
  `;
}

function wireGardenTab(body) {
  const monType   = getMonsterType(_gameState.monsterType);
  const lvl       = getLevel(_gameState.xp);
  const evolution = getCurrentEvolution(monType.evolutions, lvl);

  const spriteEl = body.querySelector('#garden-sprite');
  const variant = getVariant(_gameState.monsterType, _gameState.monsterVariant || 'classic');
  const path    = getPath(_gameState.monsterType, _gameState.evolutionPath);
  const remap   = combinedPaletteRemap(variant?.paletteRemap, path?.paletteOverlay);
  renderSprite(spriteEl, evolution.sprite, 7, { paletteRemap: remap });
  // Equipped hat — pixel-art overlay anchored to the top of the bud sprite
  const hatEq = getEquipped(_gameState, 'hat');
  if (hatEq && hatEq.id !== 'hat_none') {
    renderHat(spriteEl, hatEq.id, 7);
  }
  const idleAnim = idleAnimFor(evolution.sprite);
  spriteEl.className = 'game-monster ' + idleAnim;

  const viewport = body.querySelector('.garden-viewport');
  _tapReactor = createTapReactor({
    wrapper: viewport,
    sprite:  spriteEl,
    bubble:  body.querySelector('#garden-bubble'),
    stress:  body.querySelector('#garden-stress'),
    idleAnim, idleTimer: false,
  });
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _tapReactor?.handleTap(); }
  });

  body.querySelector('#act-water').addEventListener('click', (e) => doCare(e, 'water'));
  body.querySelector('#act-feed').addEventListener('click',  (e) => doCare(e, 'feed'));
  body.querySelector('#act-clean').addEventListener('click', (e) => doCare(e, 'clean'));
  body.querySelector('#act-pet').addEventListener('click',   (e) => doCare(e, 'pet'));

  body.querySelectorAll('.inv-item').forEach(btn => {
    btn.addEventListener('click', () => useItemFromInventory(btn.dataset.item));
  });

  body.querySelector('#minigame-toggle')?.addEventListener('change', (e) => {
    setMiniGamesEnabled(e.target.checked);
    sfx.tap();
    toast(e.target.checked ? '🎮 Mini-games ON' : '🎮 Mini-games OFF', 'gold');
  });

  body.querySelector('#btn-replay-tutorial')?.addEventListener('click', () => {
    resetTutorial();
    sfx.tap();
    startTutorial();
  });

  // Inline garden upgrades on the Garden tab
  body.querySelectorAll('[data-garden-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => buyUpgrade(btn.dataset.gardenUpgrade));
  });

  // Plot picker
  body.querySelectorAll('[data-plot]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.plot;
      const action = btn.dataset.action;
      if (action === 'switch') handlePlotSwitch(pid);
      else if (action === 'plant') handlePlotPlant(pid);
      else if (action === 'unlock') handlePlotUnlock(pid);
    });
  });
}

function handlePlotSwitch(plotId) {
  if (plotId === getActivePlotId(_gameState)) return;
  const r = switchToPlot(_gameState, plotId);
  if (!r.ok) { sfx.error(); toast('Cannot switch to that plot.', 'red'); return; }
  // Re-init derived state for the newly active bud
  refreshLevelCache(_gameState);
  applyDecay(_gameState.needs);
  sfx.tap();
  toast(`🪴 Switched to ${PLOT_LABELS[plotId]}`, 'gold');
  renderShell();           // re-render topbar with new bud
  switchTab('garden');     // re-render Garden tab
  // Refresh the floating companion to mirror the new bud + variant
  import('./companion.js').then(m => m.initCompanion(_uid)).catch(() => {});
  debouncedSave();
}

function claimAndPlantOffspring() {
  if (!isOffspringReady(_gameState)) return;
  const offspring = claimOffspring(_gameState);
  if (!offspring) return;
  sfx.evolution();

  // Memory wall entry
  if (!_gameState.memories) _gameState.memories = [];
  _gameState.memories.unshift({
    ts: Date.now(),
    kind: 'breed',
    sprite: `${offspring.type}_seed`,
    caption: `${offspring.name} hatched! ${offspring.mythic ? '✨ MYTHIC trait!' : ''}`.trim(),
  });
  _gameState.memories = _gameState.memories.slice(0, 30);

  // Find an empty UNLOCKED plot, or prompt to unlock+plant
  const emptySlot = PLOT_IDS.find(pid => plotIsEmpty(_gameState, pid));
  if (emptySlot) {
    const planted = plantBudInEmptyPlot(_gameState, emptySlot, {
      monsterType:    offspring.type,
      monsterVariant: offspring.variant,
      monsterName:    offspring.name,
    });
    if (planted) {
      // Override the rolled trait with the inherited one
      _gameState.trait = offspring.trait;
      snapshotActiveTo(_gameState, getActivePlotId(_gameState));
    }
    toast(`🎁 ${offspring.name} planted in ${PLOT_LABELS[emptySlot]}!`, 'gold', 3500);
    renderShell();
    switchTab('garden');
    import('./companion.js').then(m => m.initCompanion(_uid)).catch(() => {});
    debouncedSave();
    return;
  }

  // No empty plots — keep the offspring as a "pending" entry for now
  if (!_gameState.pendingOffspring) _gameState.pendingOffspring = [];
  _gameState.pendingOffspring.push(offspring);
  toast(`🎁 ${offspring.name} ready, but no empty plots! Unlock a plot to plant.`, 'gold', 4000);
  refreshActiveTab();
  debouncedSave();
}

function handlePlotUnlock(plotId) {
  const r = unlockNextPlot(_gameState);
  if (!r.ok) {
    sfx.error();
    if (r.reason === 'broke') toast(`Need ${r.cost} 🌱 Seeds`, 'red');
    else if (r.reason === 'maxed') toast('All plots already unlocked', 'red');
    return;
  }
  sfx.buy();
  try { track('plot_unlocked', { plotId: r.plotId, cost: r.cost }); } catch (_) {}
  toast(`🌱 ${PLOT_LABELS[r.plotId]} unlocked! Plant a Cannabud now.`, 'gold', 3200);
  refreshActiveTab();
  syncTopbar();
  debouncedSave();
}

function handlePlotPlant(plotId) {
  // Show an in-place onboarding overlay reusing the existing flow
  const overlay = document.createElement('div');
  overlay.className = 'plot-plant-overlay';
  overlay.innerHTML = `
    <div class="plot-plant-card">
      <button class="plot-plant-close" id="plot-plant-close" aria-label="Cancel">✕</button>
      <div id="plot-plant-onboard"></div>
    </div>`;
  _container.appendChild(overlay);

  overlay.querySelector('#plot-plant-close').addEventListener('click', () => overlay.remove());

  // Lazy-import onboarding so we don't load it until needed
  import('./onboardingScreen.js').then(({ renderOnboarding }) => {
    renderOnboarding(overlay.querySelector('#plot-plant-onboard'), (choice) => {
      const ok = plantBudInEmptyPlot(_gameState, plotId, choice);
      if (!ok) { sfx.error(); overlay.remove(); return; }
      sfx.evolution();
      toast(`🌱 Planted ${choice.monsterName} in ${PLOT_LABELS[plotId]}!`, 'gold', 3200);
      refreshLevelCache(_gameState);
      overlay.remove();
      renderShell();
      switchTab('garden');
      // Re-init companion for the new active bud
      import('./companion.js').then(m => m.initCompanion(_uid)).catch(() => {});
      debouncedSave();
    });
  });
}

function doCare(e, kind) {
  const now = Date.now();
  if (now - _cd[kind] < PACING.ACTION_COOLDOWN_MS) {
    sfx.error(); shakeButton(e.currentTarget); return;
  }
  _cd[kind] = now;
  if (!_gameState.lifetime) _gameState.lifetime = {};
  _gameState.lifetime.totalActions = (_gameState.lifetime.totalActions || 0) + 1;

  if (miniGamesEnabled()) {
    runMiniGame(kind, _container).then(result => {
      const mult = RESULT_MULTIPLIERS[result] ?? 1;
      applyCareResolution(kind, mult, result);
    });
    return;
  }
  applyCareResolution(kind, 1, null);
}

function applyCareResolution(kind, mult, miniResult) {
  switch (kind) {
    case 'water': {
      const amt = Math.round(NEEDS.RESTORE_TAP_WATER * mult);
      restoreNeed(_gameState.needs, 'hydration', amt);
      sfx.water(); reactToCare('game-anim--sip'); spawnCareEffect('water');
      reportQuestProgress(_gameState, 'action_water', 1);
      applyXP(Math.max(1, Math.round(2 * mult)), '💧', 'water');
      break;
    }
    case 'feed': {
      const amt = Math.round(NEEDS.RESTORE_TAP_FEED * mult);
      restoreNeed(_gameState.needs, 'nutrition', amt);
      sfx.feed(); reactToCare('game-anim--munch'); spawnCareEffect('feed');
      reportQuestProgress(_gameState, 'action_feed', 1);
      applyXP(Math.max(1, Math.round(2 * mult)), '🌿', 'feed');
      break;
    }
    case 'clean': {
      const amt = Math.round(10 * mult);
      restoreNeed(_gameState.needs, 'cleanliness', amt);
      sfx.tap(); reactToCare('cg-react--happy'); spawnCareEffect('clean');
      applyXP(Math.max(1, Math.round(1 * mult)), '✨', 'clean');
      break;
    }
    case 'pet': {
      pet(_gameState.needs, Math.round(6 * mult));
      sfx.pet(); reactToCare('cg-react--excited'); spawnCareEffect('pet');
      reportQuestProgress(_gameState, 'action_pet', 1);
      applyXP(Math.max(1, Math.round(1 * mult)), '🤚', 'pet');
      break;
    }
  }
  if (miniResult) {
    if (miniResult === 'perfect') toast(`🌟 PERFECT! ${Math.round(mult * 100)}%`, 'gold');
    else if (miniResult === 'ok') toast(`👍 OK · 100%`, '');
    else                          toast(`Missed · 70%`, 'red');
  }
  registerStreak();
  checkAchievements(_gameState);
  refreshActiveTab(false);
  debouncedSave();
}

// ── Plot Picker ───────────────────────────────────────────────
function renderPlotPicker() {
  const active = getActivePlotId(_gameState);
  return `
    <div class="plot-picker">
      ${PLOT_IDS.map(pid => {
        const meta = readPlotMeta(_gameState, pid);
        const isActive = pid === active;
        if (meta.state === 'locked') {
          return `
            <button class="plot-slot plot-slot--locked" data-plot="${pid}" data-action="unlock">
              <div class="plot-slot__head">${PLOT_LABELS[pid]}</div>
              <div class="plot-slot__body">🔒 Unlock</div>
              <div class="plot-slot__cost">🌱 ${meta.cost}</div>
            </button>`;
        }
        if (meta.state === 'empty') {
          return `
            <button class="plot-slot plot-slot--empty" data-plot="${pid}" data-action="plant">
              <div class="plot-slot__head">${PLOT_LABELS[pid]}</div>
              <div class="plot-slot__body">＋ Plant</div>
              <div class="plot-slot__cost dim small">a Cannabud</div>
            </button>`;
        }
        // Occupied
        const variant = getVariant(meta.type, meta.variant);
        const monType = getMonsterType(meta.type);
        const lvl = getLevel(meta.xp);
        return `
          <button class="plot-slot ${isActive ? 'plot-slot--active' : ''}" data-plot="${pid}" data-action="switch">
            <div class="plot-slot__head">${PLOT_LABELS[pid]}${isActive ? ' ✓' : ''}</div>
            <div class="plot-slot__bud" style="color:${variant?.color || monType.color}">${monType.emoji} ${meta.name}</div>
            <div class="plot-slot__cost dim small">Lv. ${lvl}</div>
          </button>`;
      }).join('')}
    </div>
  `;
}

function reactToCare(animClass) {
  const el = _container?.querySelector('#garden-sprite');
  if (!el) return;
  const evo = getCurrentEvolution(getMonsterType(_gameState.monsterType).evolutions, getLevel(_gameState.xp));
  const idle = idleAnimFor(evo.sprite);
  el.className = 'game-monster ' + animClass;
  setTimeout(() => { el.className = 'game-monster ' + idle; }, 1100);
}

/**
 * One-shot themed effect overlay above the cannabud — water can / feed leaves /
 * broom sweep / petting hand. Adds a positioned element to the viewport, plays
 * a CSS animation, removes itself.
 */
function spawnCareEffect(kind) {
  const viewport = _container?.querySelector('.garden-viewport');
  if (!viewport) return;
  let html = '';
  switch (kind) {
    case 'water':
      html = `
        <div class="care-fx care-fx--water">
          <span class="care-fx__tool">🚿</span>
          <span class="care-fx__drop care-fx__drop--1">💧</span>
          <span class="care-fx__drop care-fx__drop--2">💧</span>
          <span class="care-fx__drop care-fx__drop--3">💧</span>
          <span class="care-fx__drop care-fx__drop--4">💧</span>
        </div>`;
      break;
    case 'feed':
      html = `
        <div class="care-fx care-fx--feed">
          <span class="care-fx__tool">🥬</span>
          <span class="care-fx__bit care-fx__bit--1">🌿</span>
          <span class="care-fx__bit care-fx__bit--2">🍃</span>
          <span class="care-fx__bit care-fx__bit--3">🌿</span>
        </div>`;
      break;
    case 'clean':
      html = `
        <div class="care-fx care-fx--clean">
          <span class="care-fx__tool">🧹</span>
          <span class="care-fx__sparkle care-fx__sparkle--1">✨</span>
          <span class="care-fx__sparkle care-fx__sparkle--2">✨</span>
          <span class="care-fx__sparkle care-fx__sparkle--3">✨</span>
        </div>`;
      break;
    case 'pet':
      html = `
        <div class="care-fx care-fx--pet">
          <span class="care-fx__tool">🤚</span>
          <span class="care-fx__heart care-fx__heart--1">💚</span>
          <span class="care-fx__heart care-fx__heart--2">💚</span>
        </div>`;
      break;
    default:
      return;
  }
  const el = document.createElement('div');
  el.innerHTML = html;
  const node = el.firstElementChild;
  viewport.appendChild(node);
  setTimeout(() => node.remove(), 1300);
}

function useItemFromInventory(id) {
  const result = consumeItem(_gameState, id);
  if (!result) { sfx.error(); return; }
  sfx.buy();
  reportQuestProgress(_gameState, 'use_item', 1);
  toast(`${result.item.emoji} ${result.desc}`);
  checkAchievements(_gameState);
  refreshActiveTab(false);
  debouncedSave();
}

// ── BATTLE TAB ────────────────────────────────────────────────
function renderBattleTab() {
  if (_battleSession) return renderBattleArena();
  const lvl = getLevel(_gameState.xp);
  const nextBoss = nextAvailableBoss(_gameState);
  const winsTotal = _gameState.wins || 0;

  return `
    <section class="tab-pane battle-tab">
      <div class="card">
        <div class="card-title">Wild Encounters</div>
        <div class="dim small">Brawl with random Cannabuds in your level range. Quick fights, light rewards.</div>
        <button class="btn-juicy big" id="btn-find-fight">⚡ Find a Fight</button>
      </div>

      <div class="card">
        <div class="card-title">Boss Arena</div>
        ${nextBoss ? `
          <div class="boss-card">
            <div class="boss-card__title">${nextBoss.name}</div>
            <div class="boss-card__flavor dim small">${nextBoss.flavor}</div>
            <div class="dim small">Type: ${nextBoss.type} · Required Lv. ${nextBoss.minPlayerLevel}</div>
            <button class="btn-juicy big danger" id="btn-fight-boss" ${lvl < nextBoss.minPlayerLevel ? 'disabled':''}>
              ${lvl < nextBoss.minPlayerLevel ? `🔒 Reach Lv.${nextBoss.minPlayerLevel}` : `⚔️ Challenge ${nextBoss.name}`}
            </button>
          </div>` : `<div class="dim">All current bosses defeated. New ones unlock as you level.</div>`}
      </div>

      <div class="card">
        <div class="card-title">Record</div>
        <div class="dim">🏆 ${winsTotal} W / ${_gameState.losses || 0} L</div>
        <div class="dim small">Bosses defeated: ${(_gameState.battle?.bossesDefeated?.length) || 0} / ${BOSSES.length}</div>
      </div>
    </section>
  `;
}

function wireBattleTab(body) {
  if (_battleSession) return wireBattleArena(body);
  body.querySelector('#btn-find-fight')?.addEventListener('click', () => {
    sfx.encounter();
    startBattle(makeWildEncounter(getLevel(_gameState.xp)), { kind: 'wild' });
  });
  body.querySelector('#btn-fight-boss')?.addEventListener('click', () => {
    const boss = nextAvailableBoss(_gameState);
    if (!boss) return;
    sfx.encounter();
    startBattle(makeBossEncounter(boss, getLevel(_gameState.xp)), { kind: 'boss', bossId: boss.id });
  });
}

function startBattle(encounter, meta) {
  // Lazy-import the battle UI
  import('./battleScreen.js').then(mod => {
    _battleSession = { encounter, meta };
    refreshActiveTab(true);
    mod.mountBattle({
      container: _container.querySelector('#game-tab-body'),
      gameState: _gameState,
      encounter,
      meta,
      onResolve: (result) => onBattleResolved(result, meta),
    });
  });
}

function renderBattleArena() {
  // Placeholder while battleScreen takes over the body.
  return `<section class="tab-pane"><div class="dim">Loading arena…</div></section>`;
}
function wireBattleArena() { /* battleScreen owns interactions */ }

function onBattleResolved(result, meta) {
  // result: { won, encounter, expEarned, budsEarned, seedsEarned }
  try { track('battle_finished', { won: !!result.won, kind: meta?.kind || 'wild', bossId: meta?.bossId || null }); } catch (_) {}
  if (result.won) {
    _gameState.wins = (_gameState.wins || 0) + 1;
    if (meta.kind === 'boss' && meta.bossId) {
      if (!_gameState.battle) _gameState.battle = { currentArenaTier: 1, bossesDefeated: [] };
      if (!_gameState.battle.bossesDefeated) _gameState.battle.bossesDefeated = [];
      const arr = _gameState.battle.bossesDefeated;
      if (!arr.includes(meta.bossId)) arr.push(meta.bossId);
    }
    applyXP(result.expEarned, '⚔️', 'battle', /*silent=*/ true);
    giveBuds(result.budsEarned, 'battle');
    if (result.seedsEarned) {
      _gameState.seeds = (_gameState.seeds || 0) + result.seedsEarned;
      toast(`🌱 +${result.seedsEarned} Seeds`, 'gold');
    }
    sfx.victory();
    reportQuestProgress(_gameState, 'win_battle', 1);
  } else {
    _gameState.losses = (_gameState.losses || 0) + 1;
    sfx.defeat();
  }
  _battleSession = null;
  checkAchievements(_gameState);
  debouncedSave();
  refreshActiveTab(true);
}

// ── SHOP TAB ──────────────────────────────────────────────────
let _shopSection = 'care';   // 'care' | 'cosmetics' | 'themes'

function renderShopTab() {
  return `
    <section class="tab-pane shop-tab">
      <div class="card shop-currency-banner">
        <div class="card-title">Cannagotchi Shop</div>
        <div class="dim small">
          Everything here is paid for with <b>in-game currency only</b>:
          🪙 Buds (earned from picks, idle, battles) and 🌱 Seeds (earned from
          quests, evolutions, bosses, prestige). <b>No real money — ever.</b>
        </div>
      </div>

      <nav class="shop-subtabs">
        <button class="shop-subtab ${_shopSection==='care'?'active':''}"      data-shop-tab="care">🌿 Care</button>
        <button class="shop-subtab ${_shopSection==='cosmetics'?'active':''}" data-shop-tab="cosmetics">🎩 Cosmetics</button>
        <button class="shop-subtab ${_shopSection==='themes'?'active':''}"    data-shop-tab="themes">🎨 Themes</button>
      </nav>

      <div id="shop-section-body">
        ${_shopSection === 'care'      ? renderShopCare()
         : _shopSection === 'cosmetics' ? renderShopCosmetics()
         :                                renderShopThemes()}
      </div>
    </section>
  `;
}

function renderShopCare() {
  const items = shopList();
  return `
    <div class="card">
      <div class="card-title">Consumables</div>
      <div class="shop-grid">
        ${items.map(it => `
          <div class="shop-card">
            <div class="shop-card__emoji">${it.emoji}</div>
            <div class="shop-card__name">${it.name}</div>
            <div class="dim small">${it.desc}</div>
            <button class="btn-juicy compact" data-buy="${it.id}" ${_gameState.buds < it.cost ? 'disabled' : ''}>
              🪙 ${it.cost}
            </button>
          </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Garden Upgrades</div>
      ${['pot','soil','light'].map(slot => renderGardenUpgradeBlock(slot)).join('')}
    </div>

    <div class="card">
      <div class="card-title">Move Library</div>
      <div class="dim small">Each Cannabud carries 4 active moves. Swap them here from your unlocked pool.</div>
      ${renderMoveLibrary()}
    </div>
  `;
}

function renderShopCosmetics() {
  return `
    <div class="card">
      <div class="card-title">🎩 Hats</div>
      <div class="dim small">Decorate your Cannabud's head with a little something.</div>
      ${renderCosmeticGrid('hat')}
    </div>
    <div class="card">
      <div class="card-title">🖼️ Frames</div>
      <div class="dim small">Reframe your Cannabud's viewport.</div>
      ${renderCosmeticGrid('frame')}
    </div>
    <div class="card">
      <div class="card-title">✨ Auras</div>
      <div class="dim small">Animated glow behind your Cannabud.</div>
      ${renderCosmeticGrid('aura')}
    </div>
  `;
}

function renderCosmeticGrid(slot) {
  const list = listCosmeticsForSlot(slot, _gameState);
  return `
    <div class="cosmetic-grid">
      ${list.map(c => {
        const equipped = _gameState.cosmetics?.equipped?.[slot] === c.id;
        const labelGlyph = c.glyph != null ? c.glyph || '∅' : (c.cssClass ? '🖼️' : '');
        let action;
        if (c.isOwned)              action = `<button class="btn-juicy compact ${equipped?'eq':''}" data-equip="${slot}::${c.id}">${equipped?'✓ Equipped':'Equip'}</button>`;
        else if (c.isAchievement)   action = `<span class="dim small">🏆 ${c.isAchievementMet ? 'Earned' : 'Locked: '+ c.desc}</span>`;
        else                         action = `<button class="btn-juicy compact" data-buy-cos="${c.id}" ${affordCheck(c) ? '' : 'disabled'}>${currencyGlyph(c.cur)} ${c.price}</button>`;
        return `
          <div class="cosmetic-card ${c.isOwned?'owned':''} ${c.isAchievement && !c.isOwned ? 'locked' : ''}">
            <div class="cosmetic-card__glyph">${labelGlyph}</div>
            <div class="cosmetic-card__name">${c.name}</div>
            <div class="dim small">${c.desc}</div>
            ${action}
          </div>`;
      }).join('')}
    </div>`;
}

function affordCheck(c) {
  if (c.cur === 'seeds')     return (_gameState.seeds     || 0) >= c.price;
  if (c.cur === 'trichomes') return (_gameState.trichomes || 0) >= c.price;
  return (_gameState.buds || 0) >= c.price;
}
function currencyGlyph(cur) {
  if (cur === 'seeds')     return '🌱';
  if (cur === 'trichomes') return '✨';
  return '🪙';
}

function renderShopThemes() {
  return `
    <div class="card">
      <div class="card-title">🎨 Premium Themes</div>
      <div class="dim small">Unlock app-wide themes. Locked themes appear greyed-out in the Profile → Themes page until you buy them here.</div>
      <div class="cosmetic-grid">
        ${THEMES.filter(t => isPremiumTheme(t.key)).map(t => {
          const unlocked = isThemeUnlocked(t.key);
          const canAfford = t.cur === 'seeds' ? (_gameState.seeds||0) >= t.price : (_gameState.buds||0) >= t.price;
          return `
            <div class="cosmetic-card ${unlocked?'owned':''}">
              <div class="cosmetic-card__theme-preview">${t.preview.join('')}</div>
              <div class="cosmetic-card__name">${t.label}</div>
              <div class="dim small">${t.desc || ''}</div>
              ${unlocked
                ? `<button class="btn-juicy compact eq" data-apply-theme="${t.key}">Apply</button>`
                : `<button class="btn-juicy compact" data-buy-theme="${t.key}" ${canAfford?'':'disabled'}>${t.cur==='seeds'?'🌱':'🪙'} ${t.price}</button>`}
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderMoveLibrary() {
  const lvl = getLevel(_gameState.xp);
  const pool = (MOVES_BY_TYPE[_gameState.monsterType] || MOVES_BY_TYPE.hybrid).filter(m => m.levelReq <= lvl);
  // Default equipped = first 4 of the unlocked pool
  const equipped = _gameState.equippedMoves && _gameState.equippedMoves.length
    ? _gameState.equippedMoves.slice(0, 4)
    : pool.slice(0, 4).map(m => m.id);

  if (pool.length === 0) return `<div class="dim small">Level up to unlock moves.</div>`;

  return `
    <div class="move-lib">
      ${pool.map(m => {
        const eq = equipped.includes(m.id);
        return `
          <div class="move-lib-row ${eq ? 'eq' : ''}">
            <span class="move-lib__emoji">${m.emoji}</span>
            <div class="move-lib__info">
              <div class="move-lib__name">${m.name}</div>
              <div class="dim small">${m.power > 0 ? 'PWR ' + m.power : 'STAT'} · ${m.description}</div>
            </div>
            <button class="btn-juicy compact" data-toggle-move="${m.id}">${eq ? '✓ Equipped' : 'Equip'}</button>
          </div>`;
      }).join('')}
    </div>
    <div class="dim small" style="margin-top:0.4rem">Equipped: ${equipped.length}/4</div>
  `;
}

function renderGardenUpgradeBlock(slot) {
  const cfg = GARDEN_UPGRADES[slot];
  const equipped = getEquippedTier(_gameState.garden, slot);
  const idx = cfg.tiers.findIndex(t => t.id === equipped.id);
  const next = cfg.tiers[idx + 1];

  return `
    <div class="upgrade-row">
      <span class="upgrade-row__emoji">${cfg.emoji}</span>
      <div class="upgrade-row__info">
        <div class="upgrade-row__label">${cfg.label}</div>
        <div class="upgrade-row__current">${equipped.name}</div>
      </div>
      ${next ? `
        <button class="btn-juicy compact" data-upgrade="${slot}" ${_gameState.buds < next.cost ? 'disabled' : ''}>
          → ${next.name} 🪙 ${formatN(next.cost)}
        </button>` : `<span class="dim small">MAX</span>`}
    </div>
  `;
}

function wireShopTab(body) {
  // Sub-tab switching
  body.querySelectorAll('[data-shop-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _shopSection = btn.dataset.shopTab;
      sfx.click();
      refreshActiveTab(false);
    });
  });
  // Care
  body.querySelectorAll('[data-buy]').forEach(btn => {
    btn.addEventListener('click', () => buyItem(btn.dataset.buy));
  });
  body.querySelectorAll('[data-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => buyUpgrade(btn.dataset.upgrade));
  });
  body.querySelectorAll('[data-toggle-move]').forEach(btn => {
    btn.addEventListener('click', () => toggleMove(btn.dataset.toggleMove));
  });
  // Cosmetics
  body.querySelectorAll('[data-buy-cos]').forEach(btn => {
    btn.addEventListener('click', () => buyCosmeticBtn(btn.dataset.buyCos));
  });
  body.querySelectorAll('[data-equip]').forEach(btn => {
    btn.addEventListener('click', () => equipCosmeticBtn(btn.dataset.equip));
  });
  // Themes
  body.querySelectorAll('[data-buy-theme]').forEach(btn => {
    btn.addEventListener('click', () => buyThemeBtn(btn.dataset.buyTheme));
  });
  body.querySelectorAll('[data-apply-theme]').forEach(btn => {
    btn.addEventListener('click', () => applyThemeBtn(btn.dataset.applyTheme));
  });
}

function buyCosmeticBtn(id) {
  const r = buyCosmetic(_gameState, id);
  if (!r.ok) {
    sfx.error();
    if (r.reason === 'broke')              toast('Not enough currency', 'red');
    else if (r.reason === 'achievement_only') toast('Earn this through achievements', 'red');
    else if (r.reason === 'owned')         toast('Already owned', 'red');
    return;
  }
  sfx.buy();
  toast(`${r.cosmetic.glyph || '🎨'} Got ${r.cosmetic.name}!`, 'gold');
  syncTopbar();
  refreshActiveTab();
  debouncedSave();
}

function equipCosmeticBtn(slotAndId) {
  const [slot, id] = slotAndId.split('::');
  if (!equipCosmetic(_gameState, slot, id)) { sfx.error(); return; }
  sfx.tap();
  refreshActiveTab();
  debouncedSave();
}

function buyThemeBtn(themeKey) {
  const t = THEMES.find(x => x.key === themeKey);
  if (!t) return;
  const cur = t.cur || 'buds';
  const have = cur === 'seeds' ? (_gameState.seeds || 0) : (_gameState.buds || 0);
  if (have < t.price) { sfx.error(); toast('Not enough currency', 'red'); return; }
  if (cur === 'seeds') _gameState.seeds -= t.price;
  else                  _gameState.buds  -= t.price;
  // Persist on both gameState and localStorage so the Profile page sees it.
  unlockTheme(themeKey);
  _gameState.unlockedThemes = Array.from(new Set([...(_gameState.unlockedThemes||[]), themeKey]));
  sfx.buy();
  try { track('theme_unlocked', { theme: themeKey, currency: cur, price: t.price }); } catch (_) {}
  toast(`🎨 Unlocked theme: ${t.label}!`, 'gold', 3000);
  syncTopbar();
  refreshActiveTab();
  debouncedSave();
}

function applyThemeBtn(themeKey) {
  applyTheme(themeKey);
  // Also persist via the proper service so it syncs to Firestore.
  import('../services/themeService.js').then(m => m.saveThemePreference(themeKey));
  sfx.click();
  toast(`Applied: ${THEMES.find(t=>t.key===themeKey)?.label}`, 'gold');
}

function toggleMove(moveId) {
  const lvl = getLevel(_gameState.xp);
  const pool = (MOVES_BY_TYPE[_gameState.monsterType] || MOVES_BY_TYPE.hybrid).filter(m => m.levelReq <= lvl);
  let eq = _gameState.equippedMoves && _gameState.equippedMoves.length
    ? _gameState.equippedMoves.slice(0, 4)
    : pool.slice(0, 4).map(m => m.id);
  if (eq.includes(moveId)) {
    if (eq.length <= 1) { sfx.error(); toast('Need at least 1 equipped', 'red'); return; }
    eq = eq.filter(x => x !== moveId);
  } else {
    if (eq.length >= 4) { sfx.error(); toast('Already 4 equipped', 'red'); return; }
    eq.push(moveId);
  }
  _gameState.equippedMoves = eq;
  sfx.tap();
  refreshActiveTab(false);
  debouncedSave();
}

function buyItem(itemId) {
  const it = ITEMS[itemId]; if (!it) return;
  if ((_gameState.buds || 0) < it.cost) { sfx.error(); toast(`Need ${it.cost} 🪙`, 'red'); return; }
  _gameState.buds -= it.cost;
  addItem(_gameState, itemId, 1);
  if (!_gameState.lifetime) _gameState.lifetime = {};
  _gameState.lifetime.itemsBought = (_gameState.lifetime.itemsBought || 0) + 1;
  reportQuestProgress(_gameState, 'spend_buds', it.cost);
  sfx.buy(); toast(`${it.emoji} +1 ${it.name}`);
  checkAchievements(_gameState);
  refreshActiveTab();
  debouncedSave();
}

function buyUpgrade(slot) {
  const cfg = GARDEN_UPGRADES[slot];
  const equipped = getEquippedTier(_gameState.garden, slot);
  const idx = cfg.tiers.findIndex(t => t.id === equipped.id);
  const next = cfg.tiers[idx + 1];
  if (!next) return;
  if (_gameState.buds < next.cost) { sfx.error(); toast(`Need ${next.cost} 🪙`, 'red'); return; }
  _gameState.buds -= next.cost;
  _gameState.garden[slot] = next.id;
  reportQuestProgress(_gameState, 'spend_buds', next.cost);
  sfx.buy(); toast(`${cfg.emoji} Upgraded to ${next.name}!`, 'gold');
  refreshActiveTab();
  debouncedSave();
}

// ── QUESTS TAB ────────────────────────────────────────────────
function renderQuestsTab() {
  ensureDaily(_gameState);
  const dailies = _gameState.quests.daily || [];
  const totalAch = ACHIEVEMENTS.length;
  const haveAch  = Object.keys(_gameState.achievements || {}).length;
  const showPrestige = canPrestige(_gameState);

  return `
    <section class="tab-pane quests-tab">
      <div class="card">
        <div class="card-title">Today's Quests <span class="dim small">streak: ${_gameState.quests.dailyStreak || 0}🔥</span></div>
        ${dailies.map(q => {
          const pct = Math.min(100, (q.progress / q.target) * 100);
          const done = q.progress >= q.target;
          return `
            <div class="quest-row ${done ? 'quest-row--done' : ''}">
              <span class="quest-row__emoji">${q.emoji}</span>
              <div class="quest-row__info">
                <div class="quest-row__name">
                  ${q.name}
                  ${q.howTo ? `<button class="quest-info-btn" data-quest-info="${q.id}" aria-label="How to complete">?</button>` : ''}
                </div>
                <div class="quest-row__bar"><div class="quest-row__fill" style="width:${pct}%"></div></div>
                <div class="dim small">${q.progress}/${q.target} · ${q.howTo || ''}</div>
              </div>
              ${q.claimed ? `<span class="dim small">✅ Claimed</span>`
                : done ? `<button class="btn-juicy compact" data-claim="${q.id}">Claim 🪙30 ⚡30</button>`
                : `<span class="dim small">…</span>`}
            </div>`;
        }).join('')}
        ${dailies.every(q => q.claimed) ? `
          <div class="dim small" style="margin-top:0.5rem">All cleared today! 🌟 Bonus +1 Seed claimed.</div>
        ` : ''}
      </div>

      ${renderLoginStreakCard()}

      ${renderBreedingCard()}

      ${renderTitlesCard()}

      ${renderMemoriesCard()}

      ${renderStrainDexCard()}

      <div class="card">
        <div class="card-title">Trophies <span class="dim small">${haveAch}/${totalAch}</span></div>
        <div class="achievement-grid">
          ${ACHIEVEMENTS.map(a => {
            const got = !!_gameState.achievements?.[a.id];
            const prog = !got && a.progress ? a.progress(_gameState) : null;
            const pct  = prog ? Math.min(100, (prog.current / prog.target) * 100) : 0;
            return `
              <div class="ach-card ${got ? 'ach-card--unlocked' : ''}" title="${a.desc}">
                <div class="ach-card__title">${got ? '🏆' : '🔒'} ${a.name}</div>
                <div class="dim small">${a.desc}</div>
                <div class="dim small">${a.budReward ? '+'+a.budReward+'🪙' : ''} ${a.seedReward ? '+'+a.seedReward+'🌱' : ''}</div>
                ${prog ? `
                  <div class="ach-progress">
                    <div class="ach-progress__bar"><div class="ach-progress__fill" style="width:${pct}%"></div></div>
                    <div class="ach-progress__text dim small">${prog.current} / ${prog.target}</div>
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Prestige</div>
        ${showPrestige ? `
          <div class="dim small">Harvest your Cannabud to gain permanent multipliers and ${previewPrestige(_gameState).seedReward} 🌱 Seeds. Resets level/needs/inventory.</div>
          <button class="btn-juicy big" id="btn-prestige">🌟 Harvest & Prestige</button>` : `
          <div class="dim">Reach Lv.${PRESTIGE.UNLOCK_LEVEL} to unlock prestige (Harvest cycle).</div>
          <div class="dim small">Current prestige: Lv.${_gameState.prestige?.count || 0}</div>`}
      </div>
    </section>
  `;
}

function renderBreedingCard() {
  // Active gestation in progress?
  if (isBreeding(_gameState)) {
    const a = _gameState.breeding.active;
    const prog = getBreedingProgress(_gameState);
    const ready = isOffspringReady(_gameState);
    const msLeft = prog?.msLeft || 0;
    const hh = Math.floor(msLeft / 3600000);
    const mm = Math.floor((msLeft % 3600000) / 60000);
    const offType = MONSTER_TYPES[a.offspring.type];
    return `
      <div class="card breed-card">
        <div class="card-title">🧬 Breeding Lab ${a.offspring.mythic ? '<span class="mythic-tag">✨ MYTHIC</span>' : ''}</div>
        <div class="dim small">${a.parentA.name} × ${a.parentB.name}</div>
        <div class="breed-progress">
          <div class="breed-progress__bar"><div class="breed-progress__fill" style="width:${(prog.pct*100).toFixed(1)}%"></div></div>
          <div class="dim small">${ready ? '🎉 Offspring ready!' : `${hh}h ${mm}m remaining`}</div>
        </div>
        <div class="breed-preview">
          <div class="dim small">Preview: ${offType?.emoji || ''} <b>${a.offspring.name}</b> — ${offType?.name || ''} · ${a.offspring.variant}</div>
        </div>
        <div class="breed-actions">
          ${ready
            ? `<button class="btn-juicy" id="breed-claim">🎁 Claim Offspring</button>`
            : `<button class="btn-juicy compact" id="breed-skip">⏩ Skip (5 🌱)</button>
               <button class="btn-juicy compact danger" id="breed-cancel">Cancel</button>`}
        </div>
      </div>`;
  }

  // Empty state — can the player breed?
  const eligible = collectLivingBuds(_gameState).filter(b => b.level >= 15);
  if (eligible.length < 2) {
    return `
      <div class="card breed-card">
        <div class="card-title">🧬 Breeding Lab</div>
        <div class="dim small">Cross two of your Cannabuds (both Lv.15+) into an offspring with mixed traits. <b>5% chance for a Mythic mutation.</b></div>
        <div class="dim small" style="margin-top:0.4rem">You need at least <b>2 buds at Lv.15+</b>. ${eligible.length}/2 ready.</div>
      </div>`;
  }

  // Eligible — show parent picker
  return `
    <div class="card breed-card">
      <div class="card-title">🧬 Breeding Lab</div>
      <div class="dim small">Pick two parents — both must be Lv.15+. Gestation is 24 hours. Offspring inherits a mix of traits, with a <b>5% chance to mutate</b> into a Mythic trait that's only obtainable here.</div>
      <div class="breed-parents">
        ${eligible.map(b => `
          <label class="breed-parent">
            <input type="checkbox" data-breed-parent="${b.plotId}" />
            <span class="breed-parent__name">${MONSTER_TYPES[b.type]?.emoji || ''} ${b.name}</span>
            <span class="dim small">Lv.${b.level} · ${b.type}</span>
          </label>`).join('')}
      </div>
      <button class="btn-juicy" id="breed-start" disabled>🧬 Start Breeding</button>
    </div>`;
}

function renderLoginStreakCard() {
  const day = _gameState.loginStreak?.day || 0;
  return `
    <div class="card">
      <div class="card-title">Daily Streak <span class="dim small">Day ${day} / 7</span></div>
      <div class="streak-row">
        ${STREAK_REWARDS.map(r => {
          const reached = r.day <= day;
          const today   = r.day === day;
          return `
            <div class="streak-cell ${reached ? 'reached' : ''} ${today ? 'today' : ''}" title="${r.label}">
              <div class="streak-cell__day">D${r.day}</div>
              <div class="streak-cell__reward">${r.kind === 'hat' ? '🎁' : r.kind === 'xp' ? '⚡' : r.kind === 'buds' ? '🪙' : '🌱'}</div>
            </div>`;
        }).join('')}
      </div>
      <div class="dim small" style="margin-top:0.4rem">Show up daily to climb the chain. Cycle resets on Day 7 — hat next round.</div>
    </div>`;
}

function renderTitlesCard() {
  const earned = listEarnedTitles(_gameState);
  const eq = getEquippedTitle(_gameState);
  if (earned.length === 0) {
    return `
      <div class="card">
        <div class="card-title">Titles</div>
        <div class="dim small">Earn epithets through play. They display next to your Cannabud's name.</div>
      </div>`;
  }
  return `
    <div class="card">
      <div class="card-title">Titles <span class="dim small">${earned.length} earned</span></div>
      <div class="titles-grid">
        ${earned.map(t => `
          <button class="title-chip ${eq?.id === t.id ? 'eq' : ''}" data-title="${t.id}">${t.label}</button>
        `).join('')}
        <button class="title-chip ${eq == null ? 'eq' : ''}" data-title="">∅ None</button>
      </div>
    </div>`;
}

function renderMemoriesCard() {
  const mems = _gameState.memories || [];
  if (mems.length === 0) {
    return `
      <div class="card">
        <div class="card-title">Memory Wall</div>
        <div class="dim small">Milestones with your Cannabud will appear here.</div>
      </div>`;
  }
  return `
    <div class="card">
      <div class="card-title">Memory Wall</div>
      <div class="memories-row">
        ${mems.slice(0, 8).map(m => `
          <div class="mem-card">
            <div class="mem-card__sprite" data-sprite="${m.sprite || ''}"></div>
            <div class="mem-card__caption">${m.caption || ''}</div>
            <div class="dim small">${formatDateShort(m.ts)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderStrainDexCard() {
  const discovered = new Set(_gameState.lifetime?.strainsDiscovered || []);
  const bossesBeat = new Set(_gameState.battle?.bossesDefeated || []);
  return `
    <div class="card">
      <div class="card-title">Strain Dex <span class="dim small">${discovered.size} strains · ${bossesBeat.size} bosses</span></div>
      <div class="dim small">Discover strains via Pick For Me; defeat bosses in the Battle tab.</div>
      <div class="dex-strip">
        <div class="dex-pill">🎯 ${discovered.size} <span class="dim small">strains found</span></div>
        <div class="dex-pill">⚔️ ${bossesBeat.size} <span class="dim small">bosses defeated</span></div>
        <div class="dex-pill">🏆 ${Object.keys(_gameState.achievements || {}).length} <span class="dim small">trophies</span></div>
      </div>
    </div>`;
}

function formatDateShort(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function wireQuestsTab(body) {
  // Quest help tooltips
  body.querySelectorAll('[data-quest-info]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const qid = btn.dataset.questInfo;
      const q = _gameState.quests?.daily?.find(x => x.id === qid);
      if (q?.howTo) {
        toast(`${q.emoji} ${q.name} — ${q.howTo}`, 'gold', 4500);
      }
    });
  });

  // Render any sprite placeholders in memories
  body.querySelectorAll('.mem-card__sprite').forEach(el => {
    const name = el.dataset.sprite;
    if (name) {
      const variant = getVariant(_gameState.monsterType, _gameState.monsterVariant || 'classic');
      renderSprite(el, name, 4, { paletteRemap: variant?.paletteRemap });
    }
  });
  // Title picker
  body.querySelectorAll('[data-title]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.title || null;
      equipTitle(_gameState, id);
      sfx.tap();
      refreshActiveTab(false);
      syncTopbar();
      debouncedSave();
    });
  });

  // Breeding parent picker — enable Start when exactly 2 are checked
  const breedChecks = body.querySelectorAll('[data-breed-parent]');
  const breedStart = body.querySelector('#breed-start');
  if (breedChecks.length && breedStart) {
    const updateState = () => {
      const checked = [...breedChecks].filter(c => c.checked);
      // Cap to 2: if user picks a third, untick the oldest
      if (checked.length > 2) {
        checked[0].checked = false;
      }
      breedStart.disabled = body.querySelectorAll('[data-breed-parent]:checked').length !== 2;
    };
    breedChecks.forEach(c => c.addEventListener('change', updateState));
    breedStart.addEventListener('click', () => {
      const picks = [...body.querySelectorAll('[data-breed-parent]:checked')];
      if (picks.length !== 2) return;
      const r = startBreeding(_gameState, picks[0].dataset.breedParent, picks[1].dataset.breedParent);
      if (!r.ok) {
        sfx.error();
        toast(r.reason === 'already' ? 'Already breeding' : r.reason === 'too_young' ? 'Both parents need Lv.15+' : 'Cannot start', 'red');
        return;
      }
      sfx.evolution();
      try { track('breeding_started', { mythic: !!r.offspring.mythic, type: r.offspring.type, variant: r.offspring.variant }); } catch (_) {}
      toast(`🧬 Breeding started — 24h until ${r.offspring.name}!${r.offspring.mythic ? ' ✨ MYTHIC!' : ''}`, 'gold', 3500);
      refreshActiveTab();
      debouncedSave();
    });
  }
  // Skip / Cancel breeding
  body.querySelector('#breed-skip')?.addEventListener('click', () => {
    const r = skipBreedingWithSeeds(_gameState, 5);
    if (!r.ok) { sfx.error(); toast(r.reason === 'broke' ? 'Need 5 🌱 Seeds' : 'Cannot skip', 'red'); return; }
    sfx.buy();
    refreshActiveTab();
    syncTopbar();
    debouncedSave();
  });
  body.querySelector('#breed-cancel')?.addEventListener('click', () => {
    if (!confirm('Cancel breeding? No refund.')) return;
    cancelBreeding(_gameState);
    sfx.click();
    refreshActiveTab();
    debouncedSave();
  });
  // Claim offspring
  body.querySelector('#breed-claim')?.addEventListener('click', () => claimAndPlantOffspring());
  body.querySelectorAll('[data-claim]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = claimQuest(_gameState, btn.dataset.claim);
      if (!r) { sfx.error(); return; }
      sfx.questDone();
      toast(`+${r.buds}🪙 +${r.xp}⚡${r.bonusSeed ? ` +${r.bonusSeed}🌱 BONUS!` : ''}`, 'gold');
      checkAchievements(_gameState);
      refreshActiveTab();
      debouncedSave();
    });
  });

  body.querySelector('#btn-prestige')?.addEventListener('click', () => {
    if (!canPrestige(_gameState)) return;
    const preview = previewPrestige(_gameState);
    if (!confirm(`Harvest your Cannabud for +${preview.seedReward} 🌱 and permanent boosts? (Resets level, needs, inventory.)`)) return;
    doPrestige(_gameState);
    sfx.prestige();
    toast(`🌟 Prestige ${_gameState.prestige.count}! Seeds banked.`, 'gold', 3500);
    refreshActiveTab(true); syncTopbar();
    debouncedSave();
  });
}

// ── VERSUS TAB (local hot-seat scaffold) ──────────────────────
function renderVersusTab() {
  return `
    <section class="tab-pane versus-tab">
      <div class="card">
        <div class="card-title">Versus Mode 🆚</div>
        <div class="dim small">Battle another Cannabud. Local hot-seat works today; Bluetooth nearby-pairing arrives in a follow-up build.</div>
      </div>

      <div class="card">
        <div class="card-title">Quick Match — Local Hot-Seat</div>
        <div class="dim small">Both players take turns picking moves on this device. Best for sharing a smoke session.</div>
        <button class="btn-juicy big" id="btn-versus-local">🤝 Start Hot-Seat Battle</button>
      </div>

      ${(() => {
        // Bluetooth host advertising isn't wired yet on any platform we ship.
        // Disable the button until we wire the platform-specific peripheral
        // plugin. Tooltip + label make it clear this is coming soon.
        return `
          <div class="card">
            <div class="card-title">Bluetooth Nearby <span class="dim small">soon</span></div>
            <div class="dim small">Auto-discover another Cannabud nearby and pair instantly. Coming in a follow-up build — needs a peripheral-mode plugin to advertise.</div>
            <button class="btn-juicy big" id="btn-versus-ble" disabled title="Bluetooth host pairing isn't wired up yet">📡 Find Nearby (soon)</button>
          </div>`;
      })()}

      <div class="card">
        <div class="card-title">QR Code Battle</div>
        <div class="dim small">No Bluetooth needed. Host shows a QR + short code, guest scans/types it; both phones run the same deterministic battle locally.</div>
        <button class="btn-juicy big" id="btn-versus-qr">📷 QR Battle</button>
      </div>

      <div class="card">
        <div class="card-title">🏆 Async Battle League</div>
        <div class="dim small">Publish your Cannabud to a global leaderboard. Pull challengers any time and fight their snapshots — no friend has to be online.</div>
        <button class="btn-juicy big" id="btn-versus-league">📡 Open League</button>
      </div>
    </section>
  `;
}

function wireVersusTab(body) {
  body.querySelector('#btn-versus-local')?.addEventListener('click', () => {
    import('./versusScreen.js').then(mod => {
      mod.mountLocalDuel({
        container: _container.querySelector('#game-tab-body'),
        gameState: _gameState,
        onExit: () => refreshActiveTab(true),
      });
    });
  });
  body.querySelector('#btn-versus-ble')?.addEventListener('click', () => {
    import('./versusPairing.js').then(mod => {
      mod.mountBlePairing({
        container: _container.querySelector('#game-tab-body'),
        gameState: _gameState,
        onExit: () => refreshActiveTab(true),
      });
    });
  });
  body.querySelector('#btn-versus-qr')?.addEventListener('click', () => {
    import('./versusPairing.js').then(mod => {
      mod.mountQrPairing({
        container: _container.querySelector('#game-tab-body'),
        gameState: _gameState,
        onExit: () => refreshActiveTab(true),
      });
    });
  });
  body.querySelector('#btn-versus-league')?.addEventListener('click', () => {
    import('./leagueScreen.js').then(mod => {
      mod.mountLeague({
        container: _container.querySelector('#game-tab-body'),
        gameState: _gameState,
        uid: _uid,
        onExit: () => refreshActiveTab(true),
      });
    });
  });
}

// ── XP / currency helpers ─────────────────────────────────────
function applyXP(amount, emoji, source, silent = false) {
  if (!amount || amount <= 0) return;
  const oldLevel = getLevel(_gameState.xp);
  _gameState.xp = (_gameState.xp || 0) + amount;
  _gameState.lastTick = Date.now();
  emit('game:xp-gained', { amount, source });
  if (!silent) {
    showFloater(`${emoji} +${amount} XP`);
    sfx.xpGain();
  }

  const newLevel = getLevel(_gameState.xp);
  if (newLevel > oldLevel) {
    emit('game:level-up', { from: oldLevel, to: newLevel });
    const evoCheck = checkEvolution(getMonsterType(_gameState.monsterType).evolutions, oldLevel, newLevel);
    if (evoCheck.evolved) emit('game:evolved', evoCheck);
    refreshLevelCache(_gameState);
  }
  syncTopbar();
}

function giveBuds(amount, source, silent = false) {
  if (!amount) return;
  _gameState.buds = (_gameState.buds || 0) + amount;
  if (!silent) showFloater(`🪙 +${amount}`, 'gold');
  syncTopbar();
}

function debouncedSave() {
  if (_saveDebounce) clearTimeout(_saveDebounce);
  _saveDebounce = setTimeout(() => saveGameState(_uid, _gameState), PACING.AUTOSAVE_DEBOUNCE_MS);
}

function maybeRollEncounter() {
  if (_activeTab !== 'battle' || _battleSession) return;
  if (_gameState.flags?.forceEncounter) {
    _gameState.flags.forceEncounter = false;
    sfx.encounter();
    toast('💣 Smoke bomb triggered an encounter!');
    startBattle(makeWildEncounter(getLevel(_gameState.xp)), { kind: 'wild' });
  }
}

// ── Streak ────────────────────────────────────────────────────
function registerStreak() {
  if (_streakTimer) clearTimeout(_streakTimer);
  _streakCount++;
  _streakTimer = setTimeout(() => { _streakCount = 0; }, XP.STREAK_WINDOW_MS);
  if (_streakCount === XP.STREAK_THRESHOLD) {
    showFloater(`🔥 On a roll! +${XP.STREAK_BONUS} XP`, 'streak');
  }
  if (_streakCount >= XP.STREAK_THRESHOLD) {
    _gameState.xp = (_gameState.xp || 0) + XP.STREAK_BONUS;
  }
}

// ── UI primitives ─────────────────────────────────────────────
function statBar(label, value, color) {
  const pct = Math.min(100, (value / 200) * 100);
  return `
    <div class="game-stat-row">
      <span class="game-stat-row__label">${label}</span>
      <div class="game-stat-row__bar"><div class="game-stat-row__fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="game-stat-row__val">${value}</span>
    </div>`;
}

function idleAnimFor(spriteName) {
  if (spriteName.includes('ancient')) return 'game-anim--ancient';
  if (spriteName.includes('bloom'))   return 'game-anim--bloom';
  if (spriteName.includes('sapling')) return 'game-anim--sapling';
  if (spriteName.includes('sprout'))  return 'game-anim--sprout';
  return 'game-anim--seed';
}

function showFloater(text, variant = '') {
  const viewport = _container?.querySelector('#game-tab-body');
  if (!viewport) return;
  const el = document.createElement('div');
  el.className = `game-floater ${variant ? 'floater--'+variant : ''}`;
  el.textContent = text;
  viewport.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

function toast(text, variant = '', life = 2200) {
  const t = document.createElement('div');
  t.className = `game-toast ${variant ? 'game-toast--'+variant : ''}`;
  t.textContent = text;
  _container.appendChild(t);
  setTimeout(() => { t.classList.add('game-toast--out'); setTimeout(() => t.remove(), 400); }, life);
}

function shakeButton(btn) {
  btn.classList.add('game-btn-shake');
  setTimeout(() => btn.classList.remove('game-btn-shake'), 400);
}

function showPathChoiceModal() {
  if (_container.querySelector('.path-choice-overlay')) return; // already up
  const paths = listPathsFor(_gameState.monsterType);
  const variant = getVariant(_gameState.monsterType, _gameState.monsterVariant || 'classic');
  const monType = getMonsterType(_gameState.monsterType);
  const evolution = getCurrentEvolution(monType.evolutions, getLevel(_gameState.xp));

  const overlay = document.createElement('div');
  overlay.className = 'path-choice-overlay';
  overlay.innerHTML = `
    <div class="path-choice-card">
      <h3 class="game-retro-title">🌸 Pick Your Bloom</h3>
      <p class="dim small">${_gameState.monsterName} has bloomed! Choose a permanent path that shapes how this Cannabud grows from here on out.</p>
      <div class="path-grid">
        ${paths.map(p => `
          <button class="path-option" data-path="${p.id}">
            <div class="path-option__sprite" id="path-sprite-${p.id}"></div>
            <div class="path-option__name">${p.emoji} ${p.name}</div>
            <div class="dim small">${p.desc}</div>
          </button>`).join('')}
      </div>
    </div>`;
  _container.appendChild(overlay);

  // Render preview sprites with combined variant + path palette
  paths.forEach(p => {
    const el = overlay.querySelector(`#path-sprite-${p.id}`);
    const remap = combinedPaletteRemap(variant?.paletteRemap, p.paletteOverlay);
    renderSprite(el, evolution.sprite, 5, { paletteRemap: remap });
  });

  overlay.querySelectorAll('[data-path]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.path;
      if (!pickPath(_gameState, id)) return;
      sfx.evolution();
      const p = getPath(_gameState.monsterType, id);
      toast(`${p.emoji} Locked in: ${p.name}`, 'gold', 3000);
      // Memory entry
      if (!_gameState.memories) _gameState.memories = [];
      _gameState.memories.unshift({
        ts: Date.now(), kind: 'path',
        sprite: evolution.sprite,
        caption: `${_gameState.monsterName} chose the ${p.name}!`,
      });
      _gameState.memories = _gameState.memories.slice(0, 30);
      overlay.remove();
      renderShell();
      switchTab('garden');
      import('./companion.js').then(m => m.initCompanion(_uid)).catch(() => {});
      debouncedSave();
    });
  });
}

function showEvolutionNotice(evolution) {
  const overlay = document.createElement('div');
  overlay.className = 'game-evolution-overlay';
  overlay.innerHTML = `
    <div class="game-evolution-card">
      <div class="game-evolution-card__flash"></div>
      <h3 class="game-retro-title">🎉 Evolution!</h3>
      <p>Your Cannabud evolved into</p>
      <p class="game-evolution-card__name">${evolution.name}</p>
      <div class="game-evolution-card__sprite" id="evo-sprite"></div>
      <button class="btn btn--primary btn--glow game-confirm-btn" id="evo-dismiss">Awesome!</button>
    </div>`;
  _container.appendChild(overlay);
  renderSprite(overlay.querySelector('#evo-sprite'), evolution.sprite, 7);
  overlay.querySelector('#evo-dismiss').addEventListener('click', () => overlay.remove());
}

// ── Number formatting ────────────────────────────────────────
function formatN(n) {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < 1000) return String(Math.floor(n));
  if (Math.abs(n) < 1e6)  return (n/1000).toFixed(1)+'k';
  if (Math.abs(n) < 1e9)  return (n/1e6).toFixed(2)+'M';
  return (n/1e9).toFixed(2)+'B';
}
