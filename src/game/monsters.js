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

/**
 * VARIANTS — three palette-distinct evolution lines per strain.
 *
 * Each variant shares the underlying sprite shapes (defined in pixelArt.js)
 * but applies a `paletteRemap` that swaps the strain's signature hexes for a
 * different color family. Result: 9 unique-looking evolution lines from
 * 15 hand-authored sprite arrays. Variant doesn't affect stats — purely
 * visual identity. Players pick at onboarding; wild encounters roll random.
 */

// Indica original palette = purples (#a78bfa / #7c3aed / #c084fc / #4a3660 / #6d28d9)
const INDICA_VARIANTS = [
  { id: 'classic', name: 'Classic Purple', color: '#a78bfa',
    desc: 'The OG Indica — heavy, hazy, purple.', paletteRemap: null },
  { id: 'crimson', name: 'Crimson Kush',   color: '#f87171',
    desc: 'Fiery red phenotype. Looks angry, plays patient.',
    paletteRemap: { '#a78bfa': '#fca5a5', '#7c3aed': '#dc2626', '#c084fc': '#fcd34d',
                    '#4a3660': '#7f1d1d', '#6d28d9': '#991b1b' } },
  { id: 'onyx',    name: 'Onyx Kush',      color: '#52525b',
    desc: 'A jet-black, glittering nightshade.',
    paletteRemap: { '#a78bfa': '#71717a', '#7c3aed': '#27272a', '#c084fc': '#a1a1aa',
                    '#4a3660': '#18181b', '#6d28d9': '#3f3f46' } },
];

// Sativa original palette = greens (#4ade80 / #22c55e / #86efac) + accents (orange T/O)
const SATIVA_VARIANTS = [
  { id: 'classic', name: 'Solar Green', color: '#4ade80',
    desc: 'Bright, fast, classic green.', paletteRemap: null },
  { id: 'lemon',   name: 'Lemon Buzz',  color: '#facc15',
    desc: 'Citrusy yellow phenotype with a punchy aroma.',
    paletteRemap: { '#4ade80': '#facc15', '#22c55e': '#ca8a04', '#86efac': '#fde047',
                    '#a3e635': '#fef08a' } },
  { id: 'sky',     name: 'Skyburst',    color: '#38bdf8',
    desc: 'Cyan-blue strain with electric trichomes.',
    paletteRemap: { '#4ade80': '#38bdf8', '#22c55e': '#0284c7', '#86efac': '#bae6fd',
                    '#a3e635': '#7dd3fc' } },
];

// Hybrid base palette = greens with violet/orange accents
const HYBRID_VARIANTS = [
  { id: 'classic', name: 'Crystal Cross', color: '#fbbf24',
    desc: 'Diamond-cut balance. Adapts to anything.', paletteRemap: null },
  { id: 'rainbow', name: 'Rainbow Splice', color: '#ec4899',
    desc: 'A genetic kaleidoscope.',
    paletteRemap: { '#4ade80': '#ec4899', '#22c55e': '#a855f7', '#86efac': '#f472b6',
                    '#fbbf24': '#22d3ee', '#f59e0b': '#3b82f6', '#fb923c': '#06b6d4' } },
  { id: 'frost',   name: 'Frosty Fade', color: '#e2e8f0',
    desc: 'Snow-dusted hybrid. Pale and serene.',
    paletteRemap: { '#4ade80': '#cbd5e1', '#22c55e': '#94a3b8', '#86efac': '#f1f5f9',
                    '#fbbf24': '#e2e8f0', '#f59e0b': '#cbd5e1', '#fb923c': '#bae6fd',
                    '#a3e635': '#f1f5f9' } },
];

export const MONSTER_VARIANTS = {
  indica: INDICA_VARIANTS,
  sativa: SATIVA_VARIANTS,
  hybrid: HYBRID_VARIANTS,
};

export function getVariant(typeId, variantId) {
  const list = MONSTER_VARIANTS[typeId];
  if (!list) return null;
  return list.find(v => v.id === variantId) || list[0];
}

export const MONSTER_TYPES = {
  indica: {
    id: 'indica',
    name: 'Indica',
    emoji: '🌙',
    color: '#a78bfa',
    colorRgb: '167, 139, 250',
    description: 'A chill, heavy-bodied creature. Slow but incredibly resilient.',
    baseStats: { hp: 120, atk: 8, def: 12, spd: 6 },
    statGrowth: { hp: 1.00, atk: 1.00, def: 1.30, spd: 0.85 },
    variants: INDICA_VARIANTS,
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
    baseStats: { hp: 90, atk: 12, def: 7, spd: 11 },
    statGrowth: { hp: 0.90, atk: 1.20, def: 0.90, spd: 1.00 },
    variants: SATIVA_VARIANTS,
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
    statGrowth: { hp: 1.00, atk: 1.00, def: 1.00, spd: 1.00 },
    variants: HYBRID_VARIANTS,
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
