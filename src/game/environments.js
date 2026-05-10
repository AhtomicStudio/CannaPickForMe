/**
 * CannaGotchi — Battle Environments
 *
 * One environment is rolled at battle start. It tints the viewport via a
 * CSS class and applies passive modifiers to BOTH combatants for the
 * fight (or just one type, in some cases). Cosmetic + tactical.
 *
 *   • bgClass        — CSS class on .battle-arena to set the backdrop
 *   • dmgMult        — { hybrid: 1.0, indica: 0.95, sativa: 1.10 }, applied
 *                       per-combatant on outgoing damage
 *   • critBonus      — flat +crit % for everyone in this fight
 *   • regenPerTurn   — flat HP regen per turn for both combatants
 *   • startStatus    — kick off with { side: 'both' | 'self' | 'foe', mod }
 */

export const ENVIRONMENTS = [
  { id: 'env_greenhouse',  name: 'Greenhouse',     emoji: '🌿', bgClass: 'env-greenhouse',
    desc: 'Filtered light, gentle humidity. Everyone heals slightly each turn.',
    dmgMult: {}, critBonus: 0, regenPerTurn: 0.02,
  },
  { id: 'env_grow_lights', name: 'Grow-Light Rig', emoji: '💡', bgClass: 'env-growlights',
    desc: 'Sativa-leaning strains hit harder under direct LEDs.',
    dmgMult: { sativa: 1.12 }, critBonus: 0,
  },
  { id: 'env_humid_tent',  name: 'Humid Tent',     emoji: '💧', bgClass: 'env-tent',
    desc: 'Indicas thrive; their HP regen ticks faster.',
    dmgMult: { indica: 1.08 }, regenPerTurn: 0.01,
  },
  { id: 'env_outdoor',     name: 'Outdoor Patch',  emoji: '☀️', bgClass: 'env-outdoor',
    desc: 'Full sun, big crits. +5% crit chance for everyone.',
    critBonus: 0.05,
  },
  { id: 'env_basement',    name: 'Basement',       emoji: '🕳️', bgClass: 'env-basement',
    desc: 'Cool and quiet. Damage variance is lower — fewer wild swings.',
    varianceClamp: 0.07, // ±7% instead of ±15%
  },
  { id: 'env_co2_lab',     name: 'CO₂ Lab',        emoji: '🧪', bgClass: 'env-co2',
    desc: 'Enriched atmosphere — Hybrids thrive, crit chance doubled.',
    dmgMult: { hybrid: 1.10 }, critBonus: 0.06,
  },
];

const ENV_BY_ID = Object.fromEntries(ENVIRONMENTS.map(e => [e.id, e]));

/** Roll an environment for a battle. Bosses can pin theirs. */
export function rollEnvironment(forcedId) {
  if (forcedId && ENV_BY_ID[forcedId]) return ENV_BY_ID[forcedId];
  return ENVIRONMENTS[Math.floor(Math.random() * ENVIRONMENTS.length)];
}

/** Look up an environment by id without rolling. */
export function getEnvironment(id) {
  return ENV_BY_ID[id] || null;
}
