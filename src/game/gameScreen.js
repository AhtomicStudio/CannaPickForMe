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
  getLevel, getLevelProgress, calcIdleXP,
  getCurrentEvolution, checkEvolution, xpForLevel,
} from './gameEngine.js';
import { getAvailableMoves } from './moves.js';
import { renderSprite } from './pixelArt.js';
import {
  loadGameState, saveGameState, createInitialGameState, refreshLevelCache,
} from '../services/gameService.js';
import { renderOnboarding } from './onboardingScreen.js';

import { NEEDS, XP, PACING, CURRENCY, PRESTIGE } from './economyConfig.js';
import { applyDecay, moodSummary, NEED_KEYS } from './needs.js';
import {
  GARDEN_UPGRADES, getEquippedTier, getGardenBonuses,
} from './inventory.js';
import { ensureDaily, reportQuestProgress, claimQuest } from './quests.js';
import {
  syncAchievementCosmetics,
} from './cosmetics.js';
import { syncUnlockedThemesFromGame } from '../services/themeService.js';
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
import { tutorialSeen, startTutorial } from './tutorial.js';
import { track } from '@vercel/analytics';

import { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID, checkAchievements } from './achievements.js';
import { getPrestigeMultipliers, canPrestige, previewPrestige, doPrestige } from './prestige.js';
import { makeWildEncounter } from './encounters.js';
import { sfx } from './sfx.js';
import { emit, on } from './eventBus.js';

// ── Tab modules ──────────────────────────────────────────────
import { renderGardenTab, wireGardenTab } from './tabs/tabGarden.js';
import { renderBattleTab, wireBattleTab, startBattle } from './tabs/tabBattle.js';
import { renderShopTab,   wireShopTab   } from './tabs/tabShop.js';
import { renderQuestsTab, wireQuestsTab } from './tabs/tabQuests.js';
import { renderVersusTab, wireVersusTab } from './tabs/tabVersus.js';

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

// ── Streak ────────────────────────────────────────────────────
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
  // Don't allow tab switching while a versus session is live — the user
  // needs to exit the versus mode deliberately via the in-screen Back button.
  if (_versusSession && name !== 'versus') return;
  _activeTab = name;
  sfx.click();
  _container.querySelectorAll('.game-tab').forEach(btn => {
    btn.classList.toggle('game-tab--active', btn.dataset.tab === name);
  });
  refreshActiveTab(/*animate=*/true);
}

function makeTabContext() {
  return {
    gameState:        _gameState,
    uid:              _uid,
    container:        _container,
    onSave:           debouncedSave,
    onRefresh:        (animate) => refreshActiveTab(animate),
    onTopbar:         syncTopbar,
    onShell:          renderShell,
    onSwitchTab:      switchTab,
    toast,
    formatN,
    getTapReactor:    () => _tapReactor,
    setTapReactor:    (r) => { _tapReactor = r; },
    getVersusSession: () => _versusSession,
    setVersusSession: (v) => { _versusSession = v; },
    getBattleSession: () => _battleSession,
    setBattleSession: (s) => { _battleSession = s; },
    getShopSection:   () => _shopSection,
    setShopSection:   (s) => { _shopSection = s; },
    buyUpgrade,
    applyXP,
    giveBuds,
    registerStreak,
  };
}

function refreshActiveTab(animate = false) {
  if (!_container) return;
  // Never re-render the tab body while a versus session owns it.
  // The versus modules manage their own DOM; forcing a re-render here
  // would wipe the live battle or QR screen mid-session.
  if (_versusSession) { syncTopbar(); return; }
  const body = _container.querySelector('#game-tab-body');
  if (!body) return;
  // Tear down per-tab listeners by re-rendering
  if (_tapReactor) { _tapReactor.destroy(); _tapReactor = null; }
  if (animate) body.classList.remove('fade-in'), void body.offsetWidth, body.classList.add('fade-in');
  const ctx = makeTabContext();
  switch (_activeTab) {
    case 'garden': body.innerHTML = renderGardenTab(ctx); wireGardenTab(body, ctx); break;
    case 'battle': body.innerHTML = renderBattleTab(ctx); wireBattleTab(body, ctx); break;
    case 'shop':   body.innerHTML = renderShopTab(ctx);   wireShopTab(body, ctx);   break;
    case 'quests': body.innerHTML = renderQuestsTab(ctx); wireQuestsTab(body, ctx); break;
    case 'versus': body.innerHTML = renderVersusTab(ctx); wireVersusTab(body, ctx); break;
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


// ── SHOP TAB ──────────────────────────────────────────────────
let _shopSection = 'care';   // 'care' | 'cosmetics' | 'themes'

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
function renderQuestsTab_legacy() {
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

function wireQuestsTab_legacy(body) {
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
function renderVersusTab_legacy() {
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
        <div class="card-title">🌐 Online Battle</div>
        <div class="dim small">Real-time versus over the internet. Host creates a 6-char room code; Guest types it in. Both pick moves simultaneously.</div>
        <button class="btn-juicy big" id="btn-versus-online">⚡ Online Battle</button>
      </div>

      <div class="card">
        <div class="card-title">🏆 Async Battle League</div>
        <div class="dim small">Publish your Cannabud to a global leaderboard. Pull challengers any time and fight their snapshots — no friend has to be online.</div>
        <button class="btn-juicy big" id="btn-versus-league">📡 Open League</button>
      </div>
    </section>
  `;
}

function wireVersusTab_legacy(body) {
  // Guard: marks a versus session active so refreshActiveTab / switchTab
  // won't overwrite the container while a live session is running.
  function enterVersus(tabBody) {
    _versusSession = true;
    // Immediately show a loading placeholder so the tab body isn't blank
    // during the async import(). This also prevents a split-second where
    // another call to refreshActiveTab could wipe the tab before the module
    // mounts its own HTML.
    tabBody.innerHTML = `
      <section class="tab-pane pairing-pane" style="display:flex;align-items:center;justify-content:center;min-height:200px">
        <div class="dim small">⏳ Loading versus screen…</div>
      </section>`;
  }
  function exitVersus() {
    _versusSession = null;
    _activeTab = 'versus'; // ensure we land back on the versus tab menu
    // Re-render the versus tab menu cleanly
    const b = _container?.querySelector('#game-tab-body');
    if (b) {
      _container.querySelectorAll('.game-tab').forEach(btn => {
        btn.classList.toggle('game-tab--active', btn.dataset.tab === 'versus');
      });
      b.innerHTML = renderVersusTab_legacy();
      wireVersusTab_legacy(b);
    }
    syncTopbar();
  }

  const tabBody = _container.querySelector('#game-tab-body');

  // Show a visible error card when a versus mode can't load, rather than
  // silently snapping back to the menu with no explanation.
  // NOTE: _versusSession stays truthy until the user clicks Back so the
  // idle tick doesn't wipe the error card before they can read it.
  function versusLoadFailed(label, err) {
    console.error(`[Versus] ${label} error:`, err);
    // Do NOT clear _versusSession here — keep it truthy so the idle tick
    // can't overwrite the error card with the versus menu before the user
    // has a chance to read it. We clear it only when they click Back.
    _activeTab = 'versus';
    const b = _container?.querySelector('#game-tab-body');
    if (!b) { _versusSession = null; syncTopbar(); return; }
    // Keep the Versus tab button highlighted while showing the error
    _container.querySelectorAll('.game-tab').forEach(btn =>
      btn.classList.toggle('game-tab--active', btn.dataset.tab === 'versus'));
    b.innerHTML = `
      <section class="tab-pane pairing-pane">
        <div class="card">
          <div class="card-title">⚠️ Couldn't Start</div>
          <div class="dim small">${label} failed to load.</div>
          <div class="dim small" style="color:#f87171;font-size:0.6rem;word-break:break-all;margin-top:0.3rem">${err instanceof Error ? (err.message || err.toString()) : (err != null ? String(err) : 'Unknown error')}</div>
          <button class="btn-juicy compact" id="vs-err-back" style="margin-top:0.8rem">← Back</button>
        </div>
      </section>`;
    syncTopbar();
    // Clear _versusSession HERE, when the user explicitly dismisses the error.
    b.querySelector('#vs-err-back')?.addEventListener('click', () => {
      _versusSession = null;
      b.innerHTML = renderVersusTab_legacy();
      wireVersusTab_legacy(b);
    });
  }

  body.querySelector('#btn-versus-local')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('./versusScreen.js').then(mod => {
      if (!_versusSession) return; // user exited before module loaded
      mod.mountLocalDuel({
        container: tabBody,
        gameState: _gameState,
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('Hot-seat battle', err));
  });
  body.querySelector('#btn-versus-ble')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('./versusPairing.js').then(mod => {
      if (!_versusSession) return;
      return mod.mountBlePairing({      // return Promise so async errors reach .catch
        container: tabBody,
        gameState: _gameState,
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('Bluetooth pairing', err));
  });
  body.querySelector('#btn-versus-qr')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('./versusPairing.js').then(mod => {
      if (!_versusSession) return;
      return mod.mountQrPairing({       // return Promise so async errors reach .catch
        container: tabBody,
        gameState: _gameState,
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('QR pairing', err));
  });
  body.querySelector('#btn-versus-online')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('./versusPairing.js').then(mod => {
      if (!_versusSession) return;
      return mod.mountOnlineBattle({
        container: tabBody,
        gameState: _gameState,
        uid: _uid,
        displayName: _gameState?.monsterName || 'Trainer',
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('Online Battle', err));
  });
  body.querySelector('#btn-versus-league')?.addEventListener('click', () => {
    enterVersus(tabBody);
    import('./leagueScreen.js').then(mod => {
      if (!_versusSession) return;
      return mod.mountLeague({          // return Promise so async errors reach .catch
        container: tabBody,
        gameState: _gameState,
        uid: _uid,
        onExit: exitVersus,
      });
    }).catch(err => versusLoadFailed('Battle League', err));
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
    startBattle(makeWildEncounter(getLevel(_gameState.xp)), { kind: 'wild' }, makeTabContext());
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
