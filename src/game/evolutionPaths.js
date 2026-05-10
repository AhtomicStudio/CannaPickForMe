/**
 * CannaGotchi — Evolution Path Choice
 *
 * At Lv.30 (the Bloom evolution), the player picks between TWO distinct
 * branches. Each branch tilts the bud's stat growth, recolors the sprite
 * (palette overlay on top of the variant's), and slightly changes the
 * displayed evolution name.
 *
 * Choices:
 *   • Indica   →  Patience (defensive) | Pressure (offensive)
 *   • Sativa   →  Solar (high-XP)      | Stellar (high-crit)
 *   • Hybrid   →  Adaptive (balanced)  | Wild (chaotic)
 *
 * The pick is permanent for that bud (stored as `evolutionPath`).
 *
 * Storage:
 *   gameState.evolutionPath = 'patience' | 'pressure' | ... | null
 *   Set on the per-plot snapshot, so each bud has its own path.
 */

export const EVOLUTION_PATHS = {
  indica: [
    {
      id: 'patience', name: 'Bloom of Patience', emoji: '🛡️',
      desc: '+15% DEF, status moves last +1 turn. The wall.',
      mods: { defMult: 1.15, statusBonus: 1 },
      paletteOverlay: { '#a78bfa': '#67e8f9' }, // lightens the purple toward cyan
    },
    {
      id: 'pressure', name: 'Bloom of Pressure', emoji: '💥',
      desc: '+12% ATK, +5% crit. Heavy hitter.',
      mods: { atkMult: 1.12, critBonus: 0.05 },
      paletteOverlay: { '#a78bfa': '#ec4899' }, // pushes toward magenta
    },
  ],
  sativa: [
    {
      id: 'solar', name: 'Bloom of Sol', emoji: '☀️',
      desc: '+20% XP from all sources, +5% SPD.',
      mods: { spdMult: 1.05, xpRateBonus: 0.20 },
      paletteOverlay: { '#4ade80': '#fde047' }, // green → solar gold
    },
    {
      id: 'stellar', name: 'Bloom of Stellar', emoji: '🌟',
      desc: '+10% crit, +8% ATK. Burst damage.',
      mods: { atkMult: 1.08, critBonus: 0.10 },
      paletteOverlay: { '#4ade80': '#a78bfa' }, // green → cosmic violet
    },
  ],
  hybrid: [
    {
      id: 'adaptive', name: 'Bloom of Adapt', emoji: '⚖️',
      desc: '+8% all stats. Jack-of-all-trades.',
      mods: { hpMult: 1.08, atkMult: 1.08, defMult: 1.08, spdMult: 1.08 },
      paletteOverlay: null,
    },
    {
      id: 'wild', name: 'Bloom of Wild', emoji: '🌪️',
      desc: '+15% crit, ±20% damage variance. Chaos.',
      mods: { critBonus: 0.15, varianceBoost: 0.05 },
      paletteOverlay: { '#fbbf24': '#ef4444', '#f59e0b': '#dc2626' },
    },
  ],
};

/** Has this bud been to Lv.30+ AND not yet picked a path? */
export function shouldPromptPathChoice(gameState) {
  if (!gameState) return false;
  if (gameState.evolutionPath) return false;
  const lvl = gameState._level ?? 1;
  return lvl >= 30;
}

export function listPathsFor(monsterType) {
  return EVOLUTION_PATHS[monsterType] || EVOLUTION_PATHS.hybrid;
}

export function getPath(monsterType, pathId) {
  if (!pathId) return null;
  return listPathsFor(monsterType).find(p => p.id === pathId) || null;
}

export function pickPath(gameState, pathId) {
  const p = getPath(gameState.monsterType, pathId);
  if (!p) return false;
  gameState.evolutionPath = pathId;
  return true;
}

// Register helpers globally so encounters.js can resolve paths without
// dragging this module into its eager bundle.
if (typeof window !== 'undefined') {
  window.__cgEvolutionPaths = { getPath, listPathsFor };
}

/** Build the combined palette remap = variant remap → path overlay. */
export function combinedPaletteRemap(variantRemap, pathOverlay) {
  if (!variantRemap && !pathOverlay) return null;
  const out = { ...(variantRemap || {}), ...(pathOverlay || {}) };
  return out;
}

/** Trait-style stat mods to apply on top of base for a chosen path. */
export function applyPathStatMods(stats, pathId, monsterType) {
  const p = getPath(monsterType, pathId);
  if (!p) return stats;
  const m = p.mods;
  return {
    hp:  Math.floor(stats.hp  * (m.hpMult  ?? 1)),
    atk: Math.floor(stats.atk * (m.atkMult ?? 1)),
    def: Math.floor(stats.def * (m.defMult ?? 1)),
    spd: Math.floor(stats.spd * (m.spdMult ?? 1)),
  };
}
