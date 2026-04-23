/**
 * CannaGotchi — Monster Definitions
 *
 * Three base types inspired by cannabis genetics.
 * No mechanical type advantages — differences are cosmetic + stat distribution.
 *
 * Stat philosophy:
 *   Indica  → Tanky (high HP/DEF, low SPD)
 *   Sativa  → Glass cannon (high ATK/SPD, low HP/DEF)
 *   Hybrid  → Balanced all-rounder
 */

export const MONSTER_TYPES = {
  indica: {
    id: 'indica',
    name: 'Indica',
    emoji: '🌙',
    color: '#a78bfa',
    colorRgb: '167, 139, 250',
    description: 'A chill, heavy-bodied creature. Slow but incredibly resilient.',
    baseStats: { hp: 120, atk: 8, def: 12, spd: 5 },
    evolutions: [
      { name: 'Indica Seed',    level: 1,  sprite: 'indica_seed' },
      { name: 'Purple Sprout',  level: 5,  sprite: 'indica_sprout' },
      { name: 'Kush Sapling',   level: 15, sprite: 'indica_sapling' },
      { name: 'Purple Bloom',   level: 30, sprite: 'indica_bloom' },
      { name: 'Ancient Indica', level: 50, sprite: 'indica_ancient' },
    ],
  },
  sativa: {
    id: 'sativa',
    name: 'Sativa',
    emoji: '☀️',
    color: '#4ade80',
    colorRgb: '74, 222, 128',
    description: 'An energetic, fast-growing creature. Quick and creative.',
    baseStats: { hp: 90, atk: 12, def: 7, spd: 12 },
    evolutions: [
      { name: 'Sativa Seed',     level: 1,  sprite: 'sativa_seed' },
      { name: 'Green Sprout',    level: 5,  sprite: 'sativa_sprout' },
      { name: 'Haze Sapling',    level: 15, sprite: 'sativa_sapling' },
      { name: 'Solar Bloom',     level: 30, sprite: 'sativa_bloom' },
      { name: 'Ancient Sativa',  level: 50, sprite: 'sativa_ancient' },
    ],
  },
  hybrid: {
    id: 'hybrid',
    name: 'Hybrid',
    emoji: '🔥',
    color: '#fbbf24',
    colorRgb: '251, 191, 36',
    description: 'A balanced, adaptable creature. The best of both worlds.',
    baseStats: { hp: 100, atk: 10, def: 10, spd: 9 },
    evolutions: [
      { name: 'Hybrid Seed',     level: 1,  sprite: 'hybrid_seed' },
      { name: 'Blended Sprout',  level: 5,  sprite: 'hybrid_sprout' },
      { name: 'Cross Sapling',   level: 15, sprite: 'hybrid_sapling' },
      { name: 'Hybrid Bloom',    level: 30, sprite: 'hybrid_bloom' },
      { name: 'Ancient Hybrid',  level: 50, sprite: 'hybrid_ancient' },
    ],
  },
};

/**
 * Get a monster type definition by id.
 * @param {string} typeId — 'indica' | 'sativa' | 'hybrid'
 * @returns {object}
 */
export function getMonsterType(typeId) {
  return MONSTER_TYPES[typeId] || MONSTER_TYPES.hybrid;
}
