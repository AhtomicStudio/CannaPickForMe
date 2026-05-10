/**
 * CannaGotchi — Game Engine
 * Pure functions for XP, leveling, stats, idle, multipliers, evolution.
 *
 * NOTE on backwards compatibility: the original engine used A=8.5 / B=10 / C=15.
 * Existing saves rely on those exact numbers, so they stay frozen. New mechanics
 * layer ON TOP without changing the base XP curve.
 */

import { NEEDS, XP, PRESTIGE } from './economyConfig.js';

// ── Logarithmic XP Constants (frozen for save compatibility) ──
const A = 8.5;
const B = 10;
const C = 15;

const MAX_IDLE_MINUTES = XP.MAX_IDLE_MINUTES;

// ── Level & XP ──

export function getLevel(xp) {
  return Math.max(1, Math.floor(A * Math.log(xp + B) - C));
}

export function xpForLevel(level) {
  return Math.ceil(Math.exp((level + C) / A) - B);
}

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
 * Base stats at level. Linear scaling, optionally biased by `statGrowth`
 * supplied on each MONSTER_TYPE definition (Indica gains more DEF, Sativa
 * gains more ATK, etc.). Backward compatible: missing growth = 1.0 across.
 */
export function getStats(baseStats, level, statGrowth) {
  const g = statGrowth || { hp: 1, atk: 1, def: 1, spd: 1 };
  return {
    hp:  Math.floor(baseStats.hp  + (level - 1) * 3.5 * (g.hp  ?? 1)),
    atk: Math.floor(baseStats.atk + (level - 1) * 1.2 * (g.atk ?? 1)),
    def: Math.floor(baseStats.def + (level - 1) * 1.0 * (g.def ?? 1)),
    spd: Math.floor(baseStats.spd + (level - 1) * 0.8 * (g.spd ?? 1)),
  };
}

/**
 * Effective stats with all current multipliers applied.
 * Used for the in-game display and as the base for battle hydration.
 */
export function getEffectiveStats(baseStats, level, multipliers = {}) {
  const base = getStats(baseStats, level);
  const m = (multipliers.statMult ?? 1) * (multipliers.prestigeStat ?? 1);
  return {
    hp:  Math.floor(base.hp  * m),
    atk: Math.floor(base.atk * m),
    def: Math.floor(base.def * m),
    spd: Math.floor(base.spd * m),
  };
}

// ── Idle XP ──

/**
 * Calculate passive XP earned between two timestamps.
 * Honors mood (needs.statMult), garden upgrades, prestige multiplier, and
 * a temporary "idle double" buff (Focus Elixir).
 *
 * @param {number} lastTickMs
 * @param {number} nowMs
 * @param {object} opts — { ratePerMinute, moodXpMult, gardenXpMult, prestigeXpMult, doubleUntilMs }
 */
export function calcIdleXP(lastTickMs, nowMs, opts = {}) {
  const ratePerMinute  = opts.ratePerMinute  ?? XP.IDLE_RATE_PER_MINUTE_BASE;
  const moodMult       = opts.moodXpMult     ?? 1;
  const gardenMult     = opts.gardenXpMult   ?? 1;
  const prestigeMult   = opts.prestigeXpMult ?? 1;
  const doubleUntilMs  = opts.doubleUntilMs  ?? 0;

  if (!lastTickMs || lastTickMs >= nowMs) return 0;

  const elapsedMs       = nowMs - lastTickMs;
  const cappedMs        = Math.min(elapsedMs, MAX_IDLE_MINUTES * 60_000);

  // Split into "doubled" period and normal period if a buff covers part of it.
  const buffEndsAt      = doubleUntilMs;
  const buffWindowEnd   = Math.min(buffEndsAt, nowMs);
  const buffWindowStart = Math.max(lastTickMs, nowMs - cappedMs);
  const buffMs          = Math.max(0, Math.min(buffWindowEnd, nowMs) - buffWindowStart);
  const baseMs          = cappedMs - buffMs;

  const baseRate = ratePerMinute * moodMult * gardenMult * prestigeMult;
  const buffRate = baseRate * 2;

  const xp = (baseMs / 60_000) * baseRate + (buffMs / 60_000) * buffRate;
  return Math.floor(xp);
}

// ── Active reward ──

export const SESSION_XP_REWARD = XP.PICK_SESSION_REWARD;

// ── Evolution ──

export function getCurrentEvolution(evolutions, level) {
  let current = evolutions[0];
  for (const evo of evolutions) {
    if (level >= evo.level) current = evo;
  }
  return current;
}

export function checkEvolution(evolutions, oldLevel, newLevel) {
  for (const evo of evolutions) {
    if (oldLevel < evo.level && newLevel >= evo.level) {
      return { evolved: true, evolution: evo };
    }
  }
  return { evolved: false, evolution: null };
}
