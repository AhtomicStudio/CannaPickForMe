/**
 * CannaGotchi — Needs System
 *
 * Four needs decay over real time and shape your monster's mood:
 *   💧 Hydration     — drained fastest, most visible
 *   🌿 Nutrition     — drains medium speed
 *   ✨ Cleanliness   — pests appear if low
 *   😊 Happiness     — derived; rises with the others + petting
 *
 * Pure functions. No DOM, no Firebase. Stateless except for the gameState
 * object passed in.
 */

import { NEEDS } from './economyConfig.js';

export const NEED_KEYS = ['hydration', 'nutrition', 'cleanliness', 'happiness'];

export const NEED_META = {
  hydration:   { label: 'Hydration',   emoji: '💧', color: '#38bdf8', drainHours: NEEDS.HYDRATION_DRAIN_HOURS },
  nutrition:   { label: 'Nutrition',   emoji: '🌿', color: '#22c55e', drainHours: NEEDS.NUTRITION_DRAIN_HOURS },
  cleanliness: { label: 'Cleanliness', emoji: '✨', color: '#a78bfa', drainHours: NEEDS.CLEANLINESS_DRAIN_HOURS },
  happiness:   { label: 'Happiness',   emoji: '😊', color: '#f472b6', drainHours: NEEDS.HAPPINESS_DRAIN_HOURS },
};

export function createInitialNeeds() {
  return {
    hydration:   NEEDS.MAX,
    nutrition:   NEEDS.MAX,
    cleanliness: NEEDS.MAX,
    happiness:   NEEDS.MAX,
    lastDecayTick: Date.now(),
  };
}

/**
 * Mutate the needs block in-place so it reflects elapsed time.
 * @param {object} needs   gameState.needs
 * @param {number} nowMs   current time
 */
export function applyDecay(needs, nowMs = Date.now()) {
  if (!needs) return;
  const last = needs.lastDecayTick || nowMs;
  const elapsedMs = Math.max(0, nowMs - last);
  if (elapsedMs <= 0) return;
  const hours = elapsedMs / (1000 * 60 * 60);

  for (const key of NEED_KEYS) {
    if (key === 'happiness') continue; // happiness is derived, see below
    const meta = NEED_META[key];
    const drainPerHour = NEEDS.MAX / meta.drainHours;
    const next = (needs[key] ?? NEEDS.MAX) - drainPerHour * hours;
    needs[key] = clamp01_100(next);
  }

  // Happiness drifts toward the average of the other three needs,
  // with its own slow drain so a fully-cared-for monster still
  // benefits from being interacted with.
  const others = (needs.hydration + needs.nutrition + needs.cleanliness) / 3;
  const baseDrainPerHour = NEEDS.MAX / NEEDS.HAPPINESS_DRAIN_HOURS;
  const happDelta = (others - (needs.happiness ?? NEEDS.MAX)) * Math.min(1, hours / 4)  // pull toward others
                  - baseDrainPerHour * hours * 0.4;                                      // gentle drain
  needs.happiness = clamp01_100((needs.happiness ?? NEEDS.MAX) + happDelta);

  needs.lastDecayTick = nowMs;
}

/** Restore a need by `amount`, clamped to [0, MAX]. */
export function restoreNeed(needs, key, amount) {
  if (!needs || !(key in needs)) return;
  needs[key] = clamp01_100((needs[key] ?? 0) + amount);
}

/** Direct petting boost — bumps happiness only. */
export function pet(needs, amount = 6) {
  restoreNeed(needs, 'happiness', amount);
}

/**
 * Compute current mood + multiplier based on average need value.
 * Returns: { avg, label, emoji, statMult, xpMult }
 *
 *   statMult / xpMult: 1.0 is neutral. > 1 = thriving. < 1 = struggling.
 */
export function moodSummary(needs) {
  if (!needs) {
    return { avg: 100, label: 'Thriving', emoji: '✨', statMult: 1 + NEEDS.STAT_BUFF_MAX, xpMult: 1 + NEEDS.XP_BUFF_MAX };
  }
  const avg = (needs.hydration + needs.nutrition + needs.cleanliness + needs.happiness) / 4;

  let label, emoji;
  if (avg >= NEEDS.THRESHOLD_HAPPY)      { label = 'Thriving';   emoji = '✨'; }
  else if (avg >= NEEDS.THRESHOLD_OK)    { label = 'Content';    emoji = '🙂'; }
  else if (avg >= NEEDS.THRESHOLD_BAD)   { label = 'Stressed';   emoji = '😟'; }
  else                                    { label = 'Suffering';  emoji = '😩'; }

  // Asymmetric mapping — neutral pivots at 35 (THRESHOLD_OK), so most of
  // a normal play session sits in "neutral or buff" territory. Penalties
  // only kick in at deep neglect.
  let statMult, xpMult;
  if (avg >= NEEDS.THRESHOLD_OK) {
    const t = (avg - NEEDS.THRESHOLD_OK) / (100 - NEEDS.THRESHOLD_OK);
    statMult = 1 + t * NEEDS.STAT_BUFF_MAX;
    xpMult   = 1 + t * NEEDS.XP_BUFF_MAX;
  } else {
    const t = (NEEDS.THRESHOLD_OK - avg) / NEEDS.THRESHOLD_OK;
    statMult = 1 - t * NEEDS.STAT_PENALTY_MAX;
    xpMult   = 1 - t * NEEDS.XP_PENALTY_MAX;
  }

  return { avg, label, emoji, statMult, xpMult };
}

/** Lowest current need — useful for nudges in the UI. */
export function mostNeedy(needs) {
  let lowestKey = 'hydration', lowestVal = Infinity;
  for (const key of NEED_KEYS) {
    if (key === 'happiness') continue;
    const v = needs?.[key] ?? NEEDS.MAX;
    if (v < lowestVal) { lowestVal = v; lowestKey = key; }
  }
  return { key: lowestKey, value: lowestVal };
}

function clamp01_100(v) {
  if (v < 0) return 0;
  if (v > NEEDS.MAX) return NEEDS.MAX;
  return v;
}
