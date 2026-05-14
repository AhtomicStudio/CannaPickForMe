/**
 * CannaGotchi — Inventory, Items, Shop Catalog
 *
 * Items have effects that mutate gameState.needs / xp / etc. when "applied".
 * Garden upgrades are passive: they bend decay rates and drop tables.
 *
 * Schema in gameState:
 *   inventory: { itemId: count }
 *   garden:    { pot, soil, light, water } — equipped upgrade ids
 */

import { NEEDS } from './economyConfig.js';
import { restoreNeed } from './needs.js';

// ── Consumable items ─────────────────────────────────────────
// effect: function(gameState) — mutates and returns a description string.
export const ITEMS = {
  // ───── Water ─────
  water_basic: {
    id: 'water_basic', name: 'Tap Water', emoji: '💧', tier: 1, kind: 'consumable',
    desc: 'Restores 25 hydration.', cost: 8,
    effect: (gs) => { restoreNeed(gs.needs, 'hydration', 25); return '+25 💧'; },
  },
  water_filtered: {
    id: 'water_filtered', name: 'Filtered Water', emoji: '🚰', tier: 2, kind: 'consumable',
    desc: 'Restores 45 hydration. Cleaner = a touch happier.', cost: 24,
    effect: (gs) => {
      restoreNeed(gs.needs, 'hydration', 45);
      restoreNeed(gs.needs, 'happiness', 4);
      return '+45 💧 +4 😊';
    },
  },
  water_spring: {
    id: 'water_spring', name: 'Spring Water', emoji: '🏔️', tier: 3, kind: 'consumable',
    desc: 'Maxes hydration. Pure mineral goodness.', cost: 80,
    effect: (gs) => {
      restoreNeed(gs.needs, 'hydration', 100);
      restoreNeed(gs.needs, 'happiness', 8);
      return 'Hydration MAX +8 😊';
    },
  },

  // ───── Food ─────
  nutrient_npk: {
    id: 'nutrient_npk', name: 'NPK Mix', emoji: '🌱', tier: 1, kind: 'consumable',
    desc: 'Restores 25 nutrition.', cost: 10,
    effect: (gs) => { restoreNeed(gs.needs, 'nutrition', 25); return '+25 🌿'; },
  },
  nutrient_compost: {
    id: 'nutrient_compost', name: 'Compost Tea', emoji: '☕', tier: 2, kind: 'consumable',
    desc: 'Restores 45 nutrition. Live microbes = bonus growth.', cost: 28,
    effect: (gs) => {
      restoreNeed(gs.needs, 'nutrition', 45);
      gs.xp = (gs.xp ?? 0) + 10;
      return '+45 🌿 +10 XP';
    },
  },
  nutrient_bat: {
    id: 'nutrient_bat', name: 'Bat Guano', emoji: '🦇', tier: 3, kind: 'consumable',
    desc: 'Maxes nutrition. Maximum-bloom magic.', cost: 100,
    effect: (gs) => {
      restoreNeed(gs.needs, 'nutrition', 100);
      gs.xp = (gs.xp ?? 0) + 30;
      return 'Nutrition MAX +30 XP';
    },
  },

  // ───── Cleanliness ─────
  cleaner_neem: {
    id: 'cleaner_neem', name: 'Neem Oil', emoji: '🧴', tier: 2, kind: 'consumable',
    desc: 'Wipes out pests. +60 cleanliness.', cost: 22,
    effect: (gs) => { restoreNeed(gs.needs, 'cleanliness', 60); return '+60 ✨'; },
  },
  cleaner_pure: {
    id: 'cleaner_pure', name: 'Sterile Mist', emoji: '💨', tier: 3, kind: 'consumable',
    desc: 'Sparkling clean. Maxes cleanliness + happiness.', cost: 60,
    effect: (gs) => {
      restoreNeed(gs.needs, 'cleanliness', 100);
      restoreNeed(gs.needs, 'happiness', 12);
      return 'Sparkling ✨ +12 😊';
    },
  },

  // ───── Treats — small care + happy bumps, no raw-XP buys ─────
  treat_terps: {
    id: 'treat_terps', name: 'Terpene Treat', emoji: '🍬', tier: 1, kind: 'consumable',
    desc: '+15 happiness — your bud loves these.', cost: 18,
    effect: (gs) => { restoreNeed(gs.needs, 'happiness', 15); return '+15 😊'; },
  },

  // ───── HP potions (work in battle) ─────
  hp_potion_small: {
    id: 'hp_potion_small', name: 'Quick Heal', emoji: '🩹', tier: 1, kind: 'consumable',
    desc: 'Restores 30 HP in battle. Outside battle, just +5 happiness.', cost: 20,
    battleHeal: 30,
    effect: (gs) => { restoreNeed(gs.needs, 'happiness', 5); return '+5 😊'; },
  },
  hp_potion_med: {
    id: 'hp_potion_med', name: 'Med-Pack', emoji: '⛑️', tier: 2, kind: 'consumable',
    desc: 'Restores 60 HP in battle. Outside, +10 happiness.', cost: 50,
    battleHeal: 60,
    effect: (gs) => { restoreNeed(gs.needs, 'happiness', 10); return '+10 😊'; },
  },
  hp_potion_full: {
    id: 'hp_potion_full', name: 'Full Restore', emoji: '💉', tier: 3, kind: 'consumable',
    desc: 'Fully heals HP in battle. Outside, +15 happiness.', cost: 140,
    battleHeal: 9999,
    effect: (gs) => { restoreNeed(gs.needs, 'happiness', 15); return '+15 😊'; },
  },

  // ───── Repels & Encounter rolls ─────
  pest_smoke: {
    id: 'pest_smoke', name: 'Pest Smoke Bomb', emoji: '💣', tier: 2, kind: 'consumable',
    desc: 'Forces a wild encounter — bring it on.', cost: 15,
    effect: (gs) => { gs.flags = gs.flags || {}; gs.flags.forceEncounter = true; return 'Encounter incoming!'; },
  },
};

// ── Garden upgrades ─────────────────────────────────────────
// Each tier reduces decay (multiplier < 1) and may grant XP/Bud bonuses.
export const GARDEN_UPGRADES = {
  pot: {
    label: 'Pot',
    emoji: '🪴',
    tiers: [
      { id: 'pot_basic',   name: 'Plastic Pot',   cost: 0,    decayMult: 1.00, xpMult: 1.00, budMult: 1.00, desc: 'Functional.' },
      { id: 'pot_clay',    name: 'Clay Pot',      cost: 100,  decayMult: 0.92, xpMult: 1.00, budMult: 1.00, desc: 'Better airflow, slower decay.' },
      { id: 'pot_fabric',  name: 'Fabric Pot',    cost: 350,  decayMult: 0.84, xpMult: 1.05, budMult: 1.00, desc: 'Air-pruned roots — small XP bonus.' },
      { id: 'pot_smart',   name: 'Smart Pot Pro', cost: 1200, decayMult: 0.74, xpMult: 1.10, budMult: 1.05, desc: 'Self-watering ceramic. Premium tier.' },
    ],
  },
  soil: {
    label: 'Soil',
    emoji: '🟫',
    tiers: [
      { id: 'soil_basic',   name: 'Basic Mix',   cost: 0,    decayMult: 1.00, xpMult: 1.00, budMult: 1.00, desc: 'Cheap and cheerful.' },
      { id: 'soil_organic', name: 'Organic Mix', cost: 150,  decayMult: 0.94, xpMult: 1.05, budMult: 1.00, desc: 'Worm castings, kelp, the works.' },
      { id: 'soil_super',   name: 'Super Soil',  cost: 500,  decayMult: 0.86, xpMult: 1.10, budMult: 1.05, desc: 'Living soil ecosystem.' },
      { id: 'soil_living',  name: 'Old-Growth',  cost: 1800, decayMult: 0.78, xpMult: 1.18, budMult: 1.10, desc: 'Decades of mycelium.' },
    ],
  },
};

// ── Helpers ─────────────────────────────────────────────────

export function createInitialInventory() {
  return {
    water_basic: 3,
    nutrient_npk: 3,
    treat_terps: 1,
  };
}

export function createInitialGarden() {
  return {
    pot:  'pot_basic',
    soil: 'soil_basic',
  };
}

export function getEquippedTier(garden, slot) {
  const cfg = GARDEN_UPGRADES[slot];
  if (!cfg) return null;
  const id = garden?.[slot];
  return cfg.tiers.find(t => t.id === id) || cfg.tiers[0];
}

/** Aggregate multipliers from all equipped garden upgrades. */
export function getGardenBonuses(garden) {
  const pot  = getEquippedTier(garden, 'pot');
  const soil = getEquippedTier(garden, 'soil');
  return {
    decayMult: pot.decayMult * soil.decayMult, // < 1 = slower decay
    xpMult:    pot.xpMult   * soil.xpMult,     // > 1 = more XP
    budMult:   pot.budMult  * soil.budMult,     // > 1 = more buds
  };
}

/** Try to use one of an item from inventory. Returns descriptor or null. */
export function consumeItem(gameState, itemId) {
  const item = ITEMS[itemId];
  if (!item) return null;
  const inv = gameState.inventory || (gameState.inventory = {});
  if (!inv[itemId] || inv[itemId] <= 0) return null;
  const desc = item.effect(gameState);
  inv[itemId]--;
  return { item, desc };
}

export function addItem(gameState, itemId, qty = 1) {
  const inv = gameState.inventory || (gameState.inventory = {});
  inv[itemId] = (inv[itemId] || 0) + qty;
}

/** All consumables sorted by tier — used to render the shop. */
export function shopList() {
  return Object.values(ITEMS).sort((a, b) => a.tier - b.tier || a.cost - b.cost);
}
