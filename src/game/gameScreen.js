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

  // Analytics: cannagotchi opened
  try { track('cannagotchi_opened'); } catch (_) {}

  // Attempt to load game state — wrap in try/catch so transient errors
  // (network, auth not ready yet, Firestore permission hiccup) never fall
  // through to onboarding. A null return means the user genuinely has no
  // Cannabud yet; a thrown error means we should retry, not wipe their data.
  let loadError = null;
  try {
    _gameState = await loadGameState(uid);
  } catch (err) {
    console.error('[cannagotchi] loadGameState error:', err);
    loadError = err;
  }

  if (loadError) {
    _renderLoadError(container, () => initGameScreen(container, uid, onBack), onBack);
    return;
  }

  if (!_gameState) {
    renderOnboarding(container, async (choice) => {
      _gameState = createInitialGameState(choice.monsterType, choice.monsterName, choice.monsterVariant);
      try {
        await saveGameState(uid, _gameState);
      } catch (saveErr) {
        console.error('[cannagotchi] initial saveGameState failed:', saveErr);
        // Show a warning but still let the user play — autosave will retry.
        // Do NOT abort bootIntoTabs; the user should not lose their session.
      }
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

/** Render a friendly error screen when game state fails to load. */
function _renderLoadError(container, onRetry, onBack) {
  container.innerHTML = `
    <div class="game-view" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2rem;padding:2rem;text-align:center">
      <div style="font-size:2.5rem">🌿</div>
      <h2 class="game-retro-title" style="margin:0">Couldn't Load Your Cannabud</h2>
      <p class="dim" style="max-width:300px;margin:0">There was a problem reaching the cloud. Your progress is safe — tap Retry to try again.</p>
      <button id="game-load-retry" class="btn btn--primary btn--glow" style="margin-top:0.5rem">Retry</button>
      <button id="game-load-back" class="btn-juicy compact" style="margin-top:0">← Go Back</button>
    </div>`;
  container.querySelector('#game-load-retry').addEventListener('click', onRetry);
  container.querySelector('#game-load-back').addEventListener('click', onBack);
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
