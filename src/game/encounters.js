/**
 * CannaGotchi — Encounters
 *
 * Generate enemies for the player's level. Three sources:
 *   • Wild — randomly spawned during open-game ticks. Quick scrappy fights.
 *   • Boss — a milestone fight every 5 levels. Big rewards.
 *   • Rival — generated from a strain id (Pick For Me integration).
 *
 * An encounter is a serializable shape:
 *   {
 *     id, name, type, level, color, sprite,
 *     baseStats: { hp, atk, def, spd },
 *     moves: [moveDef],   // 2-4 moves picked from the type's move pool
 *     flavor: '...',
 *     rewardBuds, rewardXP, isBoss, bossId?,
 *   }
 */

import { MONSTER_TYPES, getMonsterType } from './monsters.js';
import { MOVES_BY_TYPE } from './moves.js';
import { BATTLE, CURRENCY } from './economyConfig.js';
import { getStats } from './gameEngine.js';
import { rollTrait } from './traits.js';

// ── Wild names — playful, lightly themed ────────────────────
const WILD_NAMES = {
  indica:  ['Couch-Locker', 'Purple Drifter', 'Kush Mole', 'Bedrock Bud', 'Hazey Daze', 'Mooncrush'],
  sativa:  ['Zippy Zip', 'Solar Sprite', 'Buzzkin', 'Lemon Streak', 'Skybound Sap', 'Daydream'],
  hybrid:  ['Crossbreed', 'Twinleaf', 'Splice', 'Halfsies', 'Mixmaster', 'Echo Bud'],
};

// ── Boss roster — one per arena tier ────────────────────────
// Each boss gets a known trait and a custom sprite key (defined in pixelArt.js).
export const BOSSES = [
  { id: 'boss_seed_lord', name: 'Seed Lord',    type: 'indica', minPlayerLevel: 5,  flavor: 'A grizzled grower who refuses to evolve.', trait: 'dense',         sprite: 'boss_seed_lord',  hueShift: -20 },
  { id: 'boss_haze_baron',name: 'Haze Baron',   type: 'sativa', minPlayerLevel: 12, flavor: 'Floats in a perpetual cloud of glitter.',   trait: 'twitchy',       sprite: 'boss_haze_baron', hueShift: 60  },
  { id: 'boss_root_witch',name: 'Root Witch',   type: 'hybrid', minPlayerLevel: 20, flavor: 'Her mycelium runs through every garden.',   trait: 'pungent',       sprite: 'boss_root_witch', hueShift: 90 },
  { id: 'boss_blue_dream',name: 'Blue Dreamer', type: 'hybrid', minPlayerLevel: 30, flavor: 'A creature spun entirely from terpenes.',   trait: 'crystalline',   sprite: 'boss_blue_dream', hueShift: 200 },
  { id: 'boss_kush_king', name: 'Kush King',    type: 'indica', minPlayerLevel: 40, flavor: 'The original couch.',                       trait: 'hearty',        sprite: 'boss_kush_king',  hueShift: -40 },
  { id: 'boss_sun_god',   name: 'Sun God',      type: 'sativa', minPlayerLevel: 50, flavor: 'Pure photosynthesis incarnate.',           trait: 'photosynthetic',sprite: 'boss_sun_god',    hueShift: 0  },
];

function rng() { return Math.random(); }

function pickMoves(type, level, count) {
  const all = (MOVES_BY_TYPE[type] || MOVES_BY_TYPE.hybrid).filter(m => m.levelReq <= Math.max(1, level));
  if (all.length <= count) return all.slice();
  const pool = all.slice();
  const picked = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picked;
}

function spriteFor(type, level) {
  if (level >= 50) return `${type}_ancient`;
  if (level >= 30) return `${type}_bloom`;
  if (level >= 15) return `${type}_sapling`;
  if (level >= 5)  return `${type}_sprout`;
  return `${type}_seed`;
}

// Hue palette options — applied via CSS filter:hue-rotate so a single sprite
// grid covers a wide visual range with no extra art. 0deg = base palette.
const HUE_OPTIONS = [0, 0, 0, 30, -25, 60, -60, 90, -90, 120, 180, -150];

/** Random wild encounter scaled to player level. */
export function makeWildEncounter(playerLevel) {
  const types = Object.keys(MONSTER_TYPES);
  const type  = types[Math.floor(rng() * types.length)];
  const variance = Math.floor((rng() * 2 - 1) * BATTLE.WILD_LEVEL_VARIANCE);
  const lvl   = Math.max(1, playerLevel + variance);
  const def   = getMonsterType(type);
  const name  = WILD_NAMES[type][Math.floor(rng() * WILD_NAMES[type].length)];
  const stats = getStats(def.baseStats, lvl, def.statGrowth);
  const hue   = HUE_OPTIONS[Math.floor(rng() * HUE_OPTIONS.length)];

  // Random variant for visual variety
  const variant = def.variants
    ? def.variants[Math.floor(rng() * def.variants.length)]
    : null;
  return {
    id: `wild_${Date.now()}_${Math.floor(rng() * 9999)}`,
    name,
    type,
    variant: variant?.id || 'classic',
    paletteRemap: variant?.paletteRemap || null,
    level: lvl,
    color: variant?.color || def.color,
    sprite: spriteFor(type, lvl),
    hueShift: hue,
    baseStats: stats,
    moves: pickMoves(type, lvl, 3),
    trait: rollTrait(),
    flavor: '',
    rewardBuds: Math.floor(CURRENCY.BUDS_BATTLE_WIN_BASE + lvl * 1.4),
    rewardXP:   Math.floor(20 + lvl * BATTLE.XP_REWARD_MULT * 6),
    isBoss: false,
  };
}

/** Boss encounter — bigger, scarier, juicier rewards. */
export function makeBossEncounter(boss, playerLevel) {
  const def = getMonsterType(boss.type);
  const lvl = Math.max(boss.minPlayerLevel + BATTLE.BOSS_LEVEL_BONUS, playerLevel + BATTLE.BOSS_LEVEL_BONUS);
  // Bosses get 4 moves, a stat tilt, a known trait, and (optionally) a custom
  // boss-only sprite name (resolves against pixelArt.js BOSSES section).
  const baseScaled = getStats(def.baseStats, lvl, def.statGrowth);
  const stats = {
    hp:  baseScaled.hp  + 40,
    atk: baseScaled.atk + 4,
    def: baseScaled.def + 4,
    spd: baseScaled.spd + 2,
  };
  return {
    id: boss.id,
    name: boss.name,
    type: boss.type,
    level: lvl,
    color: def.color,
    sprite: boss.sprite || spriteFor(boss.type, lvl),
    hueShift: boss.hueShift ?? 0,
    baseStats: stats,
    moves: pickMoves(boss.type, lvl, 4),
    trait: boss.trait || rollTrait(),
    flavor: boss.flavor,
    rewardBuds: Math.floor(CURRENCY.BUDS_BATTLE_WIN_BASE * 4 + lvl * 6),
    rewardXP:   Math.floor(80 + lvl * BATTLE.XP_REWARD_MULT * 10 * BATTLE.XP_REWARD_BOSS_MULT),
    rewardSeeds: CURRENCY.SEEDS_FROM_BOSS,
    isBoss: true,
    bossId: boss.id,
  };
}

/** First boss the player can fight that they haven't defeated yet. */
export function nextAvailableBoss(gameState) {
  const lvl = gameState._level ?? 1;
  const defeated = new Set(gameState.battle?.bossesDefeated || []);
  return BOSSES.find(b => b.minPlayerLevel <= lvl && !defeated.has(b.id)) || null;
}

/** Build a Rival from a strain — used when integrating with Pick For Me. */
export function makeStrainRival(strain, playerLevel) {
  const type = strain?.type === 'indica' || strain?.type === 'sativa' ? strain.type : 'hybrid';
  const def = getMonsterType(type);
  const lvl = Math.max(1, playerLevel - 1);
  return {
    id: `rival_${strain?.id || 'unknown'}`,
    name: strain?.name || 'Mystery Strain',
    type,
    level: lvl,
    color: def.color,
    sprite: spriteFor(type, lvl),
    baseStats: { ...def.baseStats },
    moves: pickMoves(type, lvl, 3),
    flavor: strain?.description?.slice(0, 80) || '',
    rewardBuds: Math.floor(CURRENCY.BUDS_BATTLE_WIN_BASE + lvl * 2),
    rewardXP:   Math.floor(30 + lvl * 8),
    isBoss: false,
    isRival: true,
  };
}

/** Snapshot the player into the same shape as an encounter — used by battle.js. */
export function makePlayerCombatant(gameState) {
  const monType = getMonsterType(gameState.monsterType);
  const lvl     = gameState._level ?? 1;
  const stats   = getStats(monType.baseStats, lvl, monType.statGrowth);
  const allMoves = (MOVES_BY_TYPE[gameState.monsterType] || MOVES_BY_TYPE.hybrid)
    .filter(m => m.levelReq <= lvl);
  const equipped = gameState.equippedMoves
    ? gameState.equippedMoves.map(id => allMoves.find(m => m.id === id)).filter(Boolean)
    : allMoves.slice(0, 4);
  // Resolve variant + evolution-path overlay for visual (palette remap).
  const variantId = gameState.monsterVariant || 'classic';
  const variant = monType.variants?.find(v => v.id === variantId) || monType.variants?.[0] || null;
  // Path stat mods compound on top of the base
  let finalStats = stats;
  let pathOverlay = null;
  if (gameState.evolutionPath) {
    // Lazy-resolve the path so encounters.js doesn't drag evolutionPaths.js if unused
    try {
      const evoMod = window.__cgEvolutionPaths;
      const path = evoMod ? evoMod.getPath(gameState.monsterType, gameState.evolutionPath) : null;
      if (path) {
        const m = path.mods;
        finalStats = {
          hp:  Math.floor(stats.hp  * (m.hpMult  ?? 1)),
          atk: Math.floor(stats.atk * (m.atkMult ?? 1)),
          def: Math.floor(stats.def * (m.defMult ?? 1)),
          spd: Math.floor(stats.spd * (m.spdMult ?? 1)),
        };
        pathOverlay = path.paletteOverlay;
      }
    } catch (_) {}
  }
  // Combine variant + path palette
  const combinedRemap = (variant?.paletteRemap || pathOverlay)
    ? { ...(variant?.paletteRemap || {}), ...(pathOverlay || {}) }
    : null;
  return {
    id: 'player',
    name: gameState.monsterName || 'Your Bud',
    type: gameState.monsterType,
    variant: variantId,
    paletteRemap: combinedRemap,
    level: lvl,
    color: variant?.color || monType.color,
    sprite: spriteFor(gameState.monsterType, lvl),
    baseStats: finalStats,
    moves: equipped,
    trait: gameState.trait || null,
    evolutionPath: gameState.evolutionPath || null,
    hueShift: 0,
    flavor: '',
  };
}
