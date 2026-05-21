/**
 * CannaGotchi — Multi-Plot System
 *
 * Each player can raise up to 3 Cannabuds simultaneously across 3 plot slots.
 * Plot 1 is free at signup; plots 2 and 3 are unlocked with Seeds.
 *
 * ─── Storage shape ────────────────────────────────────────────
 *
 * Live state lives in flat fields on gameState (`monsterType`, `xp`, etc.) —
 * the existing schema. The CURRENTLY ACTIVE PLOT is the flat fields. Other
 * plots are snapshotted into `gameState.plots[plotId]`.
 *
 *   gameState.activePlotId     — 'plot_1' | 'plot_2' | 'plot_3'
 *   gameState.plotsUnlocked    — 1..3 (how many slots they own)
 *   gameState.plots            — { plot_1: {...snap}, plot_2: null|{...}, plot_3: ...}
 *
 * Switching plots is a swap: snapshot the current flat fields into
 * `plots[currentId]`, then copy `plots[targetId]` back into the flat fields.
 *
 * Account-level state (Buds, Seeds, achievements, prestige, cosmetics,
 * battle.bossesDefeated, login streak, quests) is GLOBAL and never
 * snapshotted — it stays on the root regardless of active plot.
 *
 * This design keeps all existing readers (`_gameState.xp`, `_gameState.needs`,
 * etc.) working unchanged — we only mutate flat fields on plot switch.
 */

import { createInitialNeeds } from './needs.js';
import { createInitialInventory, createInitialGarden } from './inventory.js';
import { rollTrait } from './traits.js';
import { calcIdleXP } from './gameEngine.js';
import { XP } from './economyConfig.js';

export const MAX_PLOTS = 3;
export const PLOT_IDS = ['plot_1', 'plot_2', 'plot_3'];
export const PLOT_LABELS = { plot_1: 'Plot 1', plot_2: 'Plot 2', plot_3: 'Plot 3' };

/** Seed cost to unlock each plot. plot_1 is free, plot_2 = 5 Seeds, plot_3 = 15. */
export const PLOT_UNLOCK_COSTS = { plot_1: 0, plot_2: 5, plot_3: 15 };

/** Fields that move with the active plot (per-bud state). */
export const PER_PLOT_FIELDS = [
  'monsterType', 'monsterVariant', 'monsterName', 'createdAt',
  'xp', 'lastTick', '_budTick',
  'needs', 'inventory', 'garden',
  'trait', 'equippedMoves', 'evolutionPath',
  'wins', 'losses',
  'memories', 'titles',
  'tempBuffs', 'flags',
  'trichomeLastClaimedAt',  // per-bud: each bud has its own Lv.50 harvest clock
];

export function getActivePlotId(gs) { return gs?.activePlotId || 'plot_1'; }
export function getPlotsUnlocked(gs) { return Math.max(1, Math.min(MAX_PLOTS, gs?.plotsUnlocked || 1)); }

/** True if the given plot id is unlocked (slot purchased + has a bud). */
export function plotHasBud(gs, plotId) {
  if (plotId === getActivePlotId(gs)) return !!gs?.monsterType;
  const p = gs?.plots?.[plotId];
  return !!(p && p.monsterType);
}

/** True if the slot is purchased but no bud has been planted yet. */
export function plotIsEmpty(gs, plotId) {
  const idx = PLOT_IDS.indexOf(plotId);
  if (idx < 0) return false;
  if (idx + 1 > getPlotsUnlocked(gs)) return false;   // slot not even unlocked
  return !plotHasBud(gs, plotId);
}

/** True if the slot needs to be purchased with Seeds first. */
export function plotIsLocked(gs, plotId) {
  const idx = PLOT_IDS.indexOf(plotId);
  return idx + 1 > getPlotsUnlocked(gs);
}

/** Snapshot the live (active-plot) flat fields into gs.plots[plotId]. */
export function snapshotActiveTo(gs, plotId) {
  if (!gs.plots) gs.plots = {};
  const snap = {};
  for (const k of PER_PLOT_FIELDS) snap[k] = gs[k];
  gs.plots[plotId] = snap;
}

/** Copy a snapshot back into the live flat fields. */
function applyPlotSnapshot(gs, snap) {
  for (const k of PER_PLOT_FIELDS) {
    if (snap && k in snap) gs[k] = snap[k];
  }
}

/**
 * Switch to a different plot. Returns:
 *   { ok: true, switched: true }                if a swap happened
 *   { ok: true, switched: false }               if already on that plot
 *   { ok: false, reason: 'locked' | 'empty' }   if can't switch
 *
 * Caller is responsible for re-rendering after a switch.
 */
export function switchToPlot(gs, plotId) {
  if (!PLOT_IDS.includes(plotId)) return { ok: false, reason: 'unknown' };
  const cur = getActivePlotId(gs);
  if (cur === plotId) return { ok: true, switched: false };
  if (plotIsLocked(gs, plotId)) return { ok: false, reason: 'locked' };
  if (!plotHasBud(gs, plotId)) return { ok: false, reason: 'empty' };

  // Snapshot current → save it
  snapshotActiveTo(gs, cur);

  // Award idle XP that accrued on the target plot while it sat dormant.
  // Use the offline rate (same as collectIdleAndDailyBonuses) so the player
  // is rewarded without double-counting the open-screen rate.
  let idleXpAwarded = 0;
  const targetSnap = gs.plots[plotId];
  if (targetSnap?.lastTick) {
    const now = Date.now();
    idleXpAwarded = calcIdleXP(targetSnap.lastTick, now, {
      ratePerMinute:  XP.IDLE_RATE_PER_MINUTE_BASE,
      moodXpMult:     1,   // mood unknown while dormant — neutral
      gardenXpMult:   1,
      prestigeXpMult: 1,
      doubleUntilMs:  0,
    });
    if (idleXpAwarded > 0) {
      // Credit the XP into the snapshot before applying it to flat state
      const updatedSnap = { ...targetSnap, xp: (targetSnap.xp || 0) + idleXpAwarded };
      gs.plots[plotId] = updatedSnap;
    }
  }

  // Load target into flat fields
  applyPlotSnapshot(gs, gs.plots[plotId]);
  gs.activePlotId = plotId;
  // Reset tick so we don't double-count on the next open-screen tick
  gs.lastTick = Date.now();
  gs._budTick = Date.now();
  return { ok: true, switched: true, idleXpAwarded };
}

/**
 * Buy an additional plot slot with Seeds.
 *   { ok: true, plotId, cost }
 *   { ok: false, reason: 'maxed' | 'broke' | 'unknown' }
 */
export function unlockNextPlot(gs) {
  const have = getPlotsUnlocked(gs);
  if (have >= MAX_PLOTS) return { ok: false, reason: 'maxed' };
  const nextIdx = have + 1;
  const nextId = PLOT_IDS[nextIdx - 1];
  const cost = PLOT_UNLOCK_COSTS[nextId];
  if ((gs.seeds || 0) < cost) return { ok: false, reason: 'broke', cost };
  gs.seeds -= cost;
  gs.plotsUnlocked = nextIdx;
  if (!gs.plots) gs.plots = {};
  gs.plots[nextId] = null;   // unlocked but empty until they plant
  return { ok: true, plotId: nextId, cost };
}

/**
 * Plant a brand-new Cannabud in an unlocked but empty plot, and switch to it.
 * Snapshots the current active plot first so it isn't lost.
 */
export function plantBudInEmptyPlot(gs, plotId, choice) {
  if (!PLOT_IDS.includes(plotId)) return false;
  if (plotIsLocked(gs, plotId)) return false;
  // Snapshot current first
  const cur = getActivePlotId(gs);
  if (cur !== plotId) snapshotActiveTo(gs, cur);

  const fresh = {
    monsterType:    choice.monsterType,
    monsterVariant: choice.monsterVariant || 'classic',
    monsterName:    choice.monsterName,
    createdAt:      Date.now(),
    lastTick:       Date.now(),
    _budTick:       Date.now(),
    xp:             0,
    needs:          createInitialNeeds(),
    inventory:      createInitialInventory(),
    garden:         createInitialGarden(),
    trait:          rollTrait(),
    equippedMoves:  null,
    wins:           0,
    losses:         0,
    memories:       [],
    titles:         { earned: {}, equippedId: null },
    tempBuffs:      {},
    flags:          {},
  };
  if (!gs.plots) gs.plots = {};
  gs.plots[plotId] = fresh;
  applyPlotSnapshot(gs, fresh);
  gs.activePlotId = plotId;
  return true;
}

/**
 * Quick metadata for the plot picker UI — name, type, level, sprite key,
 * variant. Reads from the active flat fields if it's the active plot,
 * otherwise from the snapshot.
 */
export function readPlotMeta(gs, plotId) {
  if (plotIsLocked(gs, plotId)) {
    return { state: 'locked', cost: PLOT_UNLOCK_COSTS[plotId] };
  }
  const isActive = getActivePlotId(gs) === plotId;
  const data = isActive ? gs : gs.plots?.[plotId];
  if (!data || !data.monsterType) return { state: 'empty' };
  return {
    state: 'occupied',
    isActive,
    name: data.monsterName || 'Bud',
    type: data.monsterType,
    variant: data.monsterVariant || 'classic',
    xp: data.xp || 0,
  };
}
