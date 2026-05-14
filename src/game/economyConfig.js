/**
 * CannaGotchi — Economy & Balance Constants
 *
 * Single source of truth for tuning. Edit here, the whole game retunes.
 *
 * Design goals:
 *   • Early levels (1–10) feel snappy: noticeable progress every minute of play.
 *   • Mid game (10–30) needs strategy — care + battles + items matter more than spam.
 *   • Late game (30–50) is a long-tail commitment, with prestige as the off-ramp.
 *   • Pick sessions in CannaPickForMe are the primary external income — picks pay.
 */

// ── XP curve (matches gameEngine.js) ─────────────────────────
// Live-tuned for real users: roughly 4× slower than the testing values.
// Approximate pacing now: Lv.5 in ~5 min open, Lv.15 in ~1 day, Lv.30 in
// a couple weeks of casual play, Lv.50 a real long-tail commitment.
export const XP = Object.freeze({
  IDLE_RATE_PER_MINUTE_BASE: 1.5,  // offline / closed-game
  IDLE_RATE_PER_MINUTE_OPEN: 3,    // game-screen open
  MAX_IDLE_MINUTES: 480,           // 8h cap
  PICK_SESSION_REWARD: 15,         // a Pick For Me reveal
  STREAK_BONUS: 1,
  STREAK_THRESHOLD: 3,
  STREAK_WINDOW_MS: 8000,
  DAILY_LOGIN_BONUS: 10,
});

// ── Currency ─────────────────────────────────────────────────
export const CURRENCY = Object.freeze({
  // Buds — primary in-game currency. Also slowed ~3-4×.
  BUDS_FROM_PICK: 12,
  BUDS_FROM_STASH_ADD: 2,
  BUDS_PER_MINUTE_IDLE: 0.15,
  BUDS_BATTLE_WIN_BASE: 8,
  BUDS_BATTLE_WIN_PER_TIER: 4,
  BUDS_DAILY_LOGIN: 6,

  // Seeds — premium currency
  SEEDS_FROM_EVOLUTION: 1,
  SEEDS_FROM_BOSS: 2,
  SEEDS_FROM_DAILY_QUEST_CLEAR: 1,
  SEEDS_FROM_PRESTIGE_BASE: 5,

  // Trichomes — harvested at high levels, used for prestige multipliers
  TRICHOMES_PER_HARVEST: 1,
  HARVEST_LEVEL: 50,
});

// ── Needs ────────────────────────────────────────────────────
// Each need is 0–100, decays slowly over real time.
// CannaGotchi is forgiving by design — the game rewards engagement
// rather than punishing neglect. Cared-for cannabuds get nice buffs;
// neglected ones get small soft penalties only at the deep end.
export const NEEDS = Object.freeze({
  MAX: 100,
  // Hours to drain from 100 → 0 if untouched. Slow & forgiving.
  HYDRATION_DRAIN_HOURS: 16,    // ~2 days
  NUTRITION_DRAIN_HOURS: 24,
  CLEANLINESS_DRAIN_HOURS: 48,  // pests appear over 2 days
  HAPPINESS_DRAIN_HOURS: 20,

  THRESHOLD_HAPPY: 70,    // ≥ this → "Thriving" buffs
  THRESHOLD_OK: 35,       // ≥ this → neutral
  THRESHOLD_BAD: 15,      // < this → soft debuffs

  // Asymmetric: big upside for caring, small downside for neglect.
  STAT_PENALTY_MAX: 0.15,    // up to -15% stats when fully neglected
  STAT_BUFF_MAX:    0.25,    // up to +25% stats when fully thriving
  XP_PENALTY_MAX:   0.20,    // up to -20% idle XP earn rate
  XP_BUFF_MAX:      0.40,    // up to +40% idle XP earn rate

  // Restore amounts from basic free actions (Feed/Water tap)
  RESTORE_TAP_FEED:  18,    // Feed → +18 nutrition
  RESTORE_TAP_WATER: 22,    // Water → +22 hydration
});

// ── Quest payouts ────────────────────────────────────────────
export const QUEST_REWARD = Object.freeze({
  BUDS_DAILY: 18,
  XP_DAILY: 12,
  SEED_FOR_DAILY_SET: 1,    // clear all 3 daily quests → bonus seed
});

// ── Battle balance ───────────────────────────────────────────
export const BATTLE = Object.freeze({
  // Damage formula: floor(power * (atk / def) * randomMult * stab)
  RAND_MIN: 0.85,
  RAND_MAX: 1.15,
  STAB_MULTIPLIER: 1.20,        // Same-type attack bonus
  CRIT_CHANCE_BASE: 0.06,
  CRIT_MULTIPLIER: 1.6,

  // Wild-encounter scaling around the player's level
  WILD_LEVEL_VARIANCE: 2,       // ±2 around player level
  BOSS_LEVEL_BONUS: 3,          // bosses are +3 levels
  XP_REWARD_MULT: 0.18,         // base wild XP (slowed for live)
  XP_REWARD_BOSS_MULT: 2.5,     // bosses still meaningful
});

// ── Pacing & cooldowns ───────────────────────────────────────
export const PACING = Object.freeze({
  ACTION_COOLDOWN_MS: 1200,
  AUTOSAVE_DEBOUNCE_MS: 2000,
  IDLE_TICK_MS: 6000,           // open-game tick
  ENCOUNTER_COOLDOWN_MS: 60_000, // 1 wild encounter / minute max
  ENCOUNTER_CHANCE_PER_TICK: 0.18,
  QUEST_REROLL_HOUR: 0,         // dailies roll at local midnight
});

// ── Prestige ─────────────────────────────────────────────────
export const PRESTIGE = Object.freeze({
  UNLOCK_LEVEL: 50,
  // Per prestige: permanent multiplier boost
  XP_RATE_PER_PRESTIGE: 0.10,    // +10% XP earn rate per prestige
  BUD_RATE_PER_PRESTIGE: 0.12,   // +12% Bud earn rate per prestige
  STAT_BUFF_PER_PRESTIGE: 0.05,  // +5% stat buff per prestige
  MAX_PRESTIGE: 10,              // hard cap
});

// ── UI feel ──────────────────────────────────────────────────
export const UI = Object.freeze({
  FLOATER_LIFETIME_MS: 1400,
  TOAST_LIFETIME_MS: 2200,
  TAB_TRANSITION_MS: 220,
});
