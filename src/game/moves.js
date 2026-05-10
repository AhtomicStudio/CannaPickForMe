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
  { id: 'body_press',    name: 'Body Press',    power: 15, type: 'physical', levelReq: 1,  effect: null,        description: 'A heavy body slam.',                                emoji: '💪' },
  { id: 'rock_drop',     name: 'Rock Drop',     power: 13, type: 'physical', levelReq: 1,  effect: null,        description: 'A grounded slam — short range, big impact.',         emoji: '🪨' },
  { id: 'purple_haze',   name: 'Purple Haze',   power: 20, type: 'special',  levelReq: 5,  effect: 'confuse',   description: '40% chance/turn the foe hurts itself; +20% dmg while confused.', emoji: '🟣' },
  { id: 'mossy_armor',   name: 'Mossy Armor',   power: 0,  type: 'status',   levelReq: 5,  effect: 'def_up',    description: 'A layer of moss hardens defenses.',                  emoji: '🛡️' },
  { id: 'couch_lock',    name: 'Couch Lock',    power: 10, type: 'status',   levelReq: 15, effect: 'spd_down',  description: 'Weighs the opponent down, slowing them.',           emoji: '🛋️' },
  { id: 'fog_bank',      name: 'Fog Bank',      power: 18, type: 'special',  levelReq: 15, effect: 'spd_down',  description: 'A heavy fog dulls the foe and bruises on impact.',  emoji: '🌫️' },
  { id: 'root_grip',     name: 'Root Grip',     power: 12, type: 'physical', levelReq: 20, effect: 'heal_small',description: 'Grips with deep roots, healing on contact.',         emoji: '🌳' },
  { id: 'knockout',      name: 'Knockout',      power: 35, type: 'physical', levelReq: 30, effect: null,        description: 'A devastating haymaker. Lights out.',                emoji: '💥' },
  { id: 'avalanche',     name: 'Avalanche',     power: 32, type: 'special',  levelReq: 30, effect: 'spd_down',  description: 'Crushes the foe; they end up slow under the weight.', emoji: '❄️' },
];

export const SATIVA_MOVES = [
  { id: 'quick_strike',  name: 'Quick Strike',  power: 12, type: 'physical', levelReq: 1,  effect: null,        description: 'A lightning-fast jab.',                              emoji: '⚡' },
  { id: 'pollen_dart',   name: 'Pollen Dart',   power: 10, type: 'special',  levelReq: 1,  effect: null,        description: 'A pinpoint pollen volley.',                          emoji: '🌼' },
  { id: 'brain_boost',   name: 'Brain Boost',   power: 0,  type: 'status',   levelReq: 5,  effect: 'atk_up',    description: 'Heightened focus sharpens attacks.',                 emoji: '🧠' },
  { id: 'sprint',        name: 'Sprint',        power: 14, type: 'physical', levelReq: 5,  effect: null,        description: 'Builds speed for a clean opener.',                   emoji: '🏃' },
  { id: 'solar_beam',    name: 'Solar Beam',    power: 25, type: 'special',  levelReq: 15, effect: null,        description: 'A concentrated blast of solar energy.',              emoji: '☀️' },
  { id: 'static_buzz',   name: 'Static Buzz',   power: 18, type: 'special',  levelReq: 15, effect: 'confuse',   description: 'Crackling energy can leave the foe confused.',       emoji: '⚡' },
  { id: 'sunbreak',      name: 'Sunbreak',      power: 22, type: 'special',  levelReq: 20, effect: 'heal_small',description: 'A photonic strike that warms you back up.',          emoji: '🌞' },
  { id: 'hyper_grow',    name: 'Hyper Grow',    power: 30, type: 'physical', levelReq: 30, effect: 'heal_small',description: 'Rapid growth fuels a powerful strike and heals.',    emoji: '🌿' },
  { id: 'star_burst',    name: 'Star Burst',    power: 33, type: 'special',  levelReq: 30, effect: null,        description: 'A blinding climax of solar energy.',                 emoji: '🌟' },
];

export const HYBRID_MOVES = [
  { id: 'cross_cut',     name: 'Cross Cut',     power: 13, type: 'physical', levelReq: 1,  effect: null,         description: 'A balanced slashing strike.',                       emoji: '✂️' },
  { id: 'mirror_punch',  name: 'Mirror Punch',  power: 11, type: 'physical', levelReq: 1,  effect: null,         description: 'A textbook fundamentals jab.',                      emoji: '🥊' },
  { id: 'adapt',         name: 'Adapt',         power: 0,  type: 'status',   levelReq: 5,  effect: 'def_up',     description: 'Toughens up, raising defenses.',                    emoji: '🛡️' },
  { id: 'sharpen',       name: 'Sharpen',       power: 0,  type: 'status',   levelReq: 5,  effect: 'atk_up',     description: 'Calms the mind for a sharper strike.',              emoji: '🔪' },
  { id: 'terpene_blast', name: 'Terpene Blast', power: 22, type: 'special',  levelReq: 15, effect: null,         description: 'An aromatic burst of concentrated terpenes.',       emoji: '💨' },
  { id: 'mid_kick',      name: 'Mid Kick',      power: 19, type: 'physical', levelReq: 15, effect: 'spd_down',   description: 'A leg sweep that slows the foe.',                   emoji: '🦵' },
  { id: 'rainbow_burst', name: 'Rainbow Burst', power: 17, type: 'special',  levelReq: 20, effect: 'confuse',    description: 'Dazzling colors disorient the opponent.',           emoji: '🌈' },
  { id: 'full_spectrum', name: 'Full Spectrum', power: 28, type: 'special',  levelReq: 30, effect: 'heal_medium',description: 'Channels the full entourage effect to attack and recover.', emoji: '✨' },
  { id: 'cross_strike',  name: 'Cross Strike',  power: 33, type: 'physical', levelReq: 30, effect: null,         description: 'A measured haymaker — perfect form.',                emoji: '✖️' },
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
