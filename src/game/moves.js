/**
 * CannaGotchi — Move Definitions
 *
 * Each monster type has 4 moves, learned at specific levels.
 * No type advantages — all damage is flat power scaled by ATK vs DEF.
 * Effects are cosmetic/tactical: buffs, debuffs, heals, confusion.
 *
 * Move types:
 *   'physical' — Damage based on ATK
 *   'special'  — Damage based on ATK with visual flair
 *   'status'   — No damage, applies an effect
 *
 * Effects:
 *   'atk_up'     — Boost own ATK by 25% for 3 turns
 *   'def_up'     — Boost own DEF by 25% for 3 turns
 *   'spd_down'   — Lower opponent SPD by 25% for 2 turns
 *   'confuse'    — 30% chance opponent hurts itself next turn
 *   'heal_small' — Recover 15% max HP
 *   'heal_medium'— Recover 25% max HP
 */

export const INDICA_MOVES = [
  {
    id: 'body_press',
    name: 'Body Press',
    power: 15,
    type: 'physical',
    levelReq: 1,
    effect: null,
    description: 'A heavy body slam.',
    emoji: '💪',
  },
  {
    id: 'purple_haze',
    name: 'Purple Haze',
    power: 20,
    type: 'special',
    levelReq: 5,
    effect: 'confuse',
    description: 'A disorienting cloud of purple smoke.',
    emoji: '🟣',
  },
  {
    id: 'couch_lock',
    name: 'Couch Lock',
    power: 10,
    type: 'status',
    levelReq: 15,
    effect: 'spd_down',
    description: 'Weighs the opponent down, slowing them.',
    emoji: '🛋️',
  },
  {
    id: 'knockout',
    name: 'Knockout',
    power: 35,
    type: 'physical',
    levelReq: 30,
    effect: null,
    description: 'A devastating haymaker. Lights out.',
    emoji: '💥',
  },
];

export const SATIVA_MOVES = [
  {
    id: 'quick_strike',
    name: 'Quick Strike',
    power: 12,
    type: 'physical',
    levelReq: 1,
    effect: null,
    description: 'A lightning-fast jab.',
    emoji: '⚡',
  },
  {
    id: 'brain_boost',
    name: 'Brain Boost',
    power: 0,
    type: 'status',
    levelReq: 5,
    effect: 'atk_up',
    description: 'Heightened focus sharpens attacks.',
    emoji: '🧠',
  },
  {
    id: 'solar_beam',
    name: 'Solar Beam',
    power: 25,
    type: 'special',
    levelReq: 15,
    effect: null,
    description: 'A concentrated blast of solar energy.',
    emoji: '☀️',
  },
  {
    id: 'hyper_grow',
    name: 'Hyper Grow',
    power: 30,
    type: 'physical',
    levelReq: 30,
    effect: 'heal_small',
    description: 'Rapid growth fuels a powerful strike and heals.',
    emoji: '🌿',
  },
];

export const HYBRID_MOVES = [
  {
    id: 'cross_cut',
    name: 'Cross Cut',
    power: 13,
    type: 'physical',
    levelReq: 1,
    effect: null,
    description: 'A balanced slashing strike.',
    emoji: '✂️',
  },
  {
    id: 'adapt',
    name: 'Adapt',
    power: 0,
    type: 'status',
    levelReq: 5,
    effect: 'def_up',
    description: 'Toughens up, raising defenses.',
    emoji: '🛡️',
  },
  {
    id: 'terpene_blast',
    name: 'Terpene Blast',
    power: 22,
    type: 'special',
    levelReq: 15,
    effect: null,
    description: 'An aromatic burst of concentrated terpenes.',
    emoji: '💨',
  },
  {
    id: 'full_spectrum',
    name: 'Full Spectrum',
    power: 28,
    type: 'special',
    levelReq: 30,
    effect: 'heal_medium',
    description: 'Channels the full entourage effect to attack and recover.',
    emoji: '🌈',
  },
];

/**
 * All moves indexed by monster type for easy lookup.
 */
export const MOVES_BY_TYPE = {
  indica: INDICA_MOVES,
  sativa: SATIVA_MOVES,
  hybrid: HYBRID_MOVES,
};

/**
 * Get the moves available to a monster at a given level.
 * @param {string} monsterType — 'indica' | 'sativa' | 'hybrid'
 * @param {number} level
 * @returns {Array} Available moves
 */
export function getAvailableMoves(monsterType, level) {
  const allMoves = MOVES_BY_TYPE[monsterType] || MOVES_BY_TYPE.hybrid;
  return allMoves.filter(m => level >= m.levelReq);
}
