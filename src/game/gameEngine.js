/**
 * CannaGotchi — Game Engine
 * Pure functions for XP, leveling, stats, and idle calculations.
 * No DOM, no Firebase — just math.
 */

// ── Logarithmic XP Constants ──
// Level = floor(A * ln(XP + B) - C)
// Tuned so early levels come fast (~15 min to level 5) but high levels
// take serious commitment, creating the classic idle-game dopamine curve.
const A = 8.5;
const B = 10;
const C = 15;

// Maximum passive idle accumulation window (8 hours)
const MAX_IDLE_MINUTES = 480;

// ── Level & XP ──

/**
 * Calculate a monster's level from its total accumulated XP.
 * @param {number} xp — Total XP
 * @returns {number} Level (minimum 1)
 */
export function getLevel(xp) {
  return Math.max(1, Math.floor(A * Math.log(xp + B) - C));
}

/**
 * Calculate the minimum XP required to reach a given level.
 * Inverse of the level formula.
 * @param {number} level
 * @returns {number} XP threshold
 */
export function xpForLevel(level) {
  return Math.ceil(Math.exp((level + C) / A) - B);
}

/**
 * Get current level progress as a 0-1 fraction.
 * @param {number} xp
 * @returns {{ level: number, current: number, needed: number, progress: number }}
 */
export function getLevelProgress(xp) {
  const level = getLevel(xp);
  const currentThreshold = xpForLevel(level);
  const nextThreshold = xpForLevel(level + 1);
  const current = xp - currentThreshold;
  const needed = nextThreshold - currentThreshold;
  return {
    level,
    current,
    needed,
    progress: needed > 0 ? Math.min(1, current / needed) : 1,
  };
}

// ── Stat Derivation ──

/**
 * Calculate a monster's stats at a given level from its base stats.
 * Linear scaling — keeps the math simple and predictable.
 * @param {{ hp: number, atk: number, def: number, spd: number }} baseStats
 * @param {number} level
 * @returns {{ hp: number, atk: number, def: number, spd: number }}
 */
export function getStats(baseStats, level) {
  return {
    hp:  Math.floor(baseStats.hp  + (level - 1) * 3.5),
    atk: Math.floor(baseStats.atk + (level - 1) * 1.2),
    def: Math.floor(baseStats.def + (level - 1) * 1.0),
    spd: Math.floor(baseStats.spd + (level - 1) * 0.8),
  };
}

// ── Idle XP ──

/**
 * Calculate passive XP earned between two timestamps.
 * Capped at MAX_IDLE_MINUTES to prevent infinite offline farming.
 * @param {number} lastTickMs — Unix ms of last tick
 * @param {number} nowMs — Current Unix ms
 * @param {number} ratePerMinute — XP earned per minute (default 5)
 * @returns {number} XP earned
 */
export function calcIdleXP(lastTickMs, nowMs, ratePerMinute = 5) {
  if (!lastTickMs || lastTickMs >= nowMs) return 0;
  const elapsedMinutes = (nowMs - lastTickMs) / 60000;
  const cappedMinutes = Math.min(elapsedMinutes, MAX_IDLE_MINUTES);
  return Math.floor(cappedMinutes * ratePerMinute);
}

// ── Active XP Reward ──

/** XP granted for completing a CannaPickForMe "Pick For Me" session. */
export const SESSION_XP_REWARD = 50;

// ── Evolution ──

/**
 * Find the current evolution stage for a monster at a given level.
 * @param {Array<{ name: string, level: number, sprite: string }>} evolutions
 * @param {number} level
 * @returns {{ name: string, level: number, sprite: string }}
 */
export function getCurrentEvolution(evolutions, level) {
  let current = evolutions[0];
  for (const evo of evolutions) {
    if (level >= evo.level) current = evo;
  }
  return current;
}

/**
 * Check if a level-up crossed an evolution boundary.
 * @param {Array} evolutions
 * @param {number} oldLevel
 * @param {number} newLevel
 * @returns {{ evolved: boolean, evolution: object|null }}
 */
export function checkEvolution(evolutions, oldLevel, newLevel) {
  for (const evo of evolutions) {
    if (oldLevel < evo.level && newLevel >= evo.level) {
      return { evolved: true, evolution: evo };
    }
  }
  return { evolved: false, evolution: null };
}
