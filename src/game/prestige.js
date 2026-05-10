/**
 * CannaGotchi — Prestige (Harvest Cycle)
 *
 * At max level (50) the player can "harvest" — reset XP/level/needs in exchange
 * for permanent multipliers and seeds. The CannaGotchi keeps its name, achievements,
 * and lifetime stats; everything else resets.
 */

import { PRESTIGE, CURRENCY } from './economyConfig.js';
import { createInitialNeeds } from './needs.js';
import { createInitialInventory, createInitialGarden } from './inventory.js';
import { emit } from './eventBus.js';

export function canPrestige(gameState) {
  if (!gameState) return false;
  const lvl = gameState._level ?? 1;
  return lvl >= PRESTIGE.UNLOCK_LEVEL && (gameState.prestige?.count ?? 0) < PRESTIGE.MAX_PRESTIGE;
}

export function previewPrestige(gameState) {
  const next = (gameState.prestige?.count ?? 0) + 1;
  const seedReward = CURRENCY.SEEDS_FROM_PRESTIGE_BASE + next * 2;
  return {
    nextCount: next,
    seedReward,
    bonusXP:    PRESTIGE.XP_RATE_PER_PRESTIGE,
    bonusBud:   PRESTIGE.BUD_RATE_PER_PRESTIGE,
    bonusStat:  PRESTIGE.STAT_BUFF_PER_PRESTIGE,
  };
}

export function doPrestige(gameState) {
  if (!canPrestige(gameState)) return null;

  const preview = previewPrestige(gameState);
  const prevPrestige = gameState.prestige || { count: 0, bestLevel: 1 };

  // Reward
  gameState.seeds = (gameState.seeds ?? 0) + preview.seedReward;

  // Reset progression
  gameState.xp        = 0;
  gameState.lastTick  = Date.now();
  gameState.needs     = createInitialNeeds();
  gameState.inventory = createInitialInventory();
  gameState.garden    = createInitialGarden();

  // Battle progress carries over for variety, but bosses reset.
  if (gameState.battle) {
    gameState.battle.bossesDefeated = [];
    gameState.battle.currentArenaTier = 1;
  }

  gameState.prestige = {
    count:     preview.nextCount,
    bestLevel: Math.max(prevPrestige.bestLevel ?? 1, gameState._level ?? 1),
    lastReset: Date.now(),
  };

  emit('game:prestige', { count: gameState.prestige.count });
  return preview;
}

export function getPrestigeMultipliers(gameState) {
  const n = gameState?.prestige?.count ?? 0;
  return {
    xpMult:   1 + n * PRESTIGE.XP_RATE_PER_PRESTIGE,
    budMult:  1 + n * PRESTIGE.BUD_RATE_PER_PRESTIGE,
    statMult: 1 + n * PRESTIGE.STAT_BUFF_PER_PRESTIGE,
  };
}
