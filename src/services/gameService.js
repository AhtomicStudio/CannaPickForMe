/**
 * CannaGotchi — Game Service
 *
 * Persists the full game state in Firestore (merged into the user doc).
 * Migrates old saves forward by filling in any missing modern fields.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { createInitialNeeds } from '../game/needs.js';
import { createInitialInventory, createInitialGarden } from '../game/inventory.js';
import { getLevel } from '../game/gameEngine.js';
import { rollTrait } from '../game/traits.js';
import { createInitialCosmetics } from '../game/cosmetics.js';

export const SAVE_SCHEMA_VERSION = 2;

/**
 * Build the canonical default game state.
 * If `partial` is provided, missing fields are filled in (used for migrations).
 */
export function migrateGameState(partial = {}) {
  const xp = partial.xp ?? 0;
  return {
    schema: SAVE_SCHEMA_VERSION,

    // Identity
    monsterType:    partial.monsterType    ?? 'hybrid',
    monsterVariant: partial.monsterVariant ?? 'classic',
    monsterName:    partial.monsterName    ?? 'Bud',
    createdAt:      partial.createdAt      ?? Date.now(),
    trait:          partial.trait          ?? rollTrait(),
    equippedMoves:  partial.equippedMoves  ?? null,
    cosmetics:      partial.cosmetics      ?? createInitialCosmetics(),
    unlockedThemes: partial.unlockedThemes ?? [],
    titles:         partial.titles         ?? { earned: {}, equippedId: null },
    loginStreak:    partial.loginStreak    ?? { day: 0, lastDate: '' },
    memories:       partial.memories       ?? [],

    // Multi-plot — flat fields above are the ACTIVE plot. Other plots stored
    // as snapshots in `plots`. Existing single-bud players auto-migrate to
    // plotsUnlocked=1 / activePlotId='plot_1'.
    activePlotId:   partial.activePlotId   ?? 'plot_1',
    plotsUnlocked:  partial.plotsUnlocked  ?? 1,
    plots:          partial.plots          ?? {},

    // Evolution path picked at Lv.30 (per active bud)
    evolutionPath:  partial.evolutionPath  ?? null,
    // Breeding lab state
    breeding:       partial.breeding       ?? { active: null, totalCrossbreeds: 0, mythicCount: 0 },
    // Strain-skin unlocks from Pick For Me discoveries
    strainSkinsOwned: partial.strainSkinsOwned ?? {},
    activeStrainSkin: partial.activeStrainSkin ?? null,

    // Progression
    xp,
    lastTick: partial.lastTick ?? Date.now(),
    wins:     partial.wins   ?? 0,
    losses:   partial.losses ?? 0,

    // Currency
    buds:      partial.buds      ?? 0,
    seeds:     partial.seeds     ?? 0,
    trichomes: partial.trichomes ?? 0,

    // Care + economy
    needs:     partial.needs     ?? createInitialNeeds(),
    inventory: partial.inventory ?? createInitialInventory(),
    garden:    partial.garden    ?? createInitialGarden(),

    // Quests, achievements
    quests: partial.quests ?? {
      dailyDate: '',
      daily: [],
      dailyStreak: 0,
      bonusClaimed: false,
    },
    achievements: partial.achievements ?? {},
    lifetime: partial.lifetime ?? {
      totalActions: 0,
      totalBattlesWon: 0,
      strainsDiscovered: [],
      itemsBought: 0,
      thrivingDays: 0,
    },

    // Battle progress
    battle: partial.battle ?? {
      currentArenaTier: 1,
      bossesDefeated: [],
    },

    // Prestige
    prestige: partial.prestige ?? {
      count: 0,
      bestLevel: 1,
      lastReset: 0,
    },

    // Temp buffs (from items)
    tempBuffs: partial.tempBuffs ?? {},
    flags:     partial.flags ?? {},
  };
}

/** Load + migrate the user's game state. */
export async function loadGameState(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data().game;
    if (!data) return null;
    return migrateGameState(data);
  } catch (err) {
    console.error('[gameService] loadGameState failed:', err);
    return null;
  }
}

/** Save to Firestore (merged into user doc).
 *  Snapshots the live (active-plot) flat fields into `plots[activePlotId]` so
 *  the next load can read the latest state for any plot. */
export async function saveGameState(uid, gameState) {
  if (!uid || !gameState) return;
  try {
    // Mirror current active fields into the plots map before persisting.
    // Doing it lazy-import to avoid a circular dep at module-load time.
    try {
      const { snapshotActiveTo, getActivePlotId } = await import('../game/plots.js');
      snapshotActiveTo(gameState, getActivePlotId(gameState));
    } catch (_) {}
    const { _level, ...persistable } = gameState;
    await setDoc(doc(db, 'users', uid), { game: persistable }, { merge: true });
  } catch (err) {
    console.error('[gameService] saveGameState failed:', err);
  }
}

/** Build a fresh state for first-time players. */
export function createInitialGameState(monsterType, monsterName, monsterVariant = 'classic') {
  return migrateGameState({
    monsterType,
    monsterVariant,
    monsterName,
    createdAt: Date.now(),
    lastTick:  Date.now(),
  });
}

/** Convenience — refresh the cached level on a state object. */
export function refreshLevelCache(gameState) {
  if (!gameState) return;
  gameState._level = getLevel(gameState.xp ?? 0);
}
