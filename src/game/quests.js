/**
 * CannaGotchi — Quests
 *
 * Daily quests roll at local midnight. Three per day.
 * Each grants Buds + XP. Clearing all three grants a bonus Seed.
 *
 * Schema:
 *   gameState.quests = {
 *     dailyDate: 'YYYY-MM-DD',
 *     daily: [{ id, target, progress, claimed }],
 *     dailyStreak: number,
 *     bonusClaimed: boolean,
 *   }
 */

import { QUEST_REWARD } from './economyConfig.js';
import { emit } from './eventBus.js';

// ── Quest templates ─────────────────────────────────────────
// `kind` matches an event name we increment progress against.
// `howTo` is a one-line explanation surfaced to the user via the info-tap.
export const QUEST_TEMPLATES = [
  { id: 'water_x',        name: 'Stay Hydrated',     emoji: '💧', kind: 'action_water',    range: [3, 8],    tier: 1, howTo: 'Tap the 💧 Water button on the Garden tab.' },
  { id: 'feed_x',         name: 'Feeding Time',      emoji: '🌿', kind: 'action_feed',     range: [3, 8],    tier: 1, howTo: 'Tap the 🌿 Feed button on the Garden tab.' },
  { id: 'pet_x',          name: 'Pet Therapy',       emoji: '🤚', kind: 'action_pet',      range: [4, 10],   tier: 1, howTo: 'Tap the 🤚 Pet button on the Garden tab.' },
  { id: 'gain_xp',        name: 'Power Surge',       emoji: '⚡', kind: 'gain_xp',         range: [200, 500],tier: 2, howTo: 'Earn XP from any source — idle ticks, picks, battles, or care actions all count.' },
  { id: 'spend_buds',     name: 'Treat Yo Bud',      emoji: '🛒', kind: 'spend_buds',      range: [40, 120], tier: 2, howTo: 'Spend Buds in the Cannagotchi Shop — items, garden upgrades, or cosmetics.' },
  { id: 'win_battles',    name: 'Battle Royale',     emoji: '⚔️', kind: 'win_battle',      range: [1, 4],    tier: 2, howTo: 'Win battles in the Battle tab (wild, boss, rival, league, or hot-seat).' },
  { id: 'use_item',       name: 'Apothecary',        emoji: '🧪', kind: 'use_item',        range: [2, 5],    tier: 2, howTo: 'Apply an inventory item from the Garden tab — taps on stocked items count.' },
  { id: 'pick_session',   name: 'Pick Master',       emoji: '🎯', kind: 'pick_session',    range: [1, 2],    tier: 1, howTo: 'Complete a Pick For Me session in the main app (the strain reveal counts).' },
  { id: 'thriving_check', name: 'In the Zone',       emoji: '✨', kind: 'thriving_tick',   range: [3, 6],    tier: 3, howTo: 'Hold "Thriving" status (≥70 average needs) across multiple idle ticks.' },
  { id: 'level_up_quest', name: 'Level Up',          emoji: '🌟', kind: 'level_up',        range: [1, 2],    tier: 3, howTo: 'Level up your active Cannabud. XP from any source counts.' },
];

// ── Daily roll ──────────────────────────────────────────────
function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function pickRandom(arr, n) {
  const pool = arr.slice();
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function rollDaily() {
  // Pick 3 quest templates (no duplicates), random target within their range.
  return pickRandom(QUEST_TEMPLATES, 3).map(t => ({
    id: t.id,
    name: t.name,
    emoji: t.emoji,
    kind: t.kind,
    target: Math.max(1, Math.floor(t.range[0] + Math.random() * (t.range[1] - t.range[0]))),
    progress: 0,
    claimed: false,
    tier: t.tier,
    howTo: t.howTo || '',
  }));
}

export function ensureDaily(gameState) {
  if (!gameState) return;
  if (!gameState.quests) gameState.quests = { dailyDate: '', daily: [], dailyStreak: 0, bonusClaimed: false };

  const today = localDateKey();
  if (gameState.quests.dailyDate !== today) {
    // Streak: only count if previous date was yesterday
    if (gameState.quests.dailyDate) {
      const prev = new Date(gameState.quests.dailyDate + 'T00:00:00');
      const cur  = new Date(today + 'T00:00:00');
      const diffDays = Math.round((cur - prev) / 86400000);
      gameState.quests.dailyStreak = diffDays === 1
        ? (gameState.quests.dailyStreak ?? 0) + 1
        : 0;
    }
    gameState.quests.dailyDate    = today;
    gameState.quests.daily        = rollDaily();
    gameState.quests.bonusClaimed = false;
  }
}

/** Increment quest progress for a kind. Returns array of newly completed quest ids. */
export function reportQuestProgress(gameState, kind, amount = 1) {
  ensureDaily(gameState);
  const newlyCompleted = [];
  for (const q of gameState.quests.daily) {
    if (q.kind !== kind || q.progress >= q.target) continue;
    q.progress = Math.min(q.target, q.progress + amount);
    emit('game:quest-progress', { questId: q.id, progress: q.progress, target: q.target });
    if (q.progress >= q.target) {
      newlyCompleted.push(q.id);
      emit('game:quest-complete', { questId: q.id });
    }
  }
  return newlyCompleted;
}

/**
 * Claim rewards on a completed daily quest.
 *
 * Returns the reward amounts WITHOUT applying them — the caller is responsible
 * for applying XP via `applyXP()` (so level-ups / evolutions fire correctly)
 * and Buds via `giveBuds()`. Seeds are still applied here since there's no
 * special level-up logic needed for them.
 */
export function claimQuest(gameState, questId) {
  ensureDaily(gameState);
  const q = gameState.quests.daily.find(x => x.id === questId);
  if (!q || q.claimed || q.progress < q.target) return null;
  q.claimed = true;
  // NOTE: XP and Buds are intentionally NOT applied here — the UI layer
  // routes them through applyXP / giveBuds so level-up checks fire.

  // Bonus seed for clearing all 3 (seeds have no level-up hook, apply directly)
  const allClear = gameState.quests.daily.every(x => x.claimed);
  let bonus = null;
  if (allClear && !gameState.quests.bonusClaimed) {
    gameState.quests.bonusClaimed = true;
    gameState.seeds = (gameState.seeds ?? 0) + QUEST_REWARD.SEED_FOR_DAILY_SET;
    bonus = QUEST_REWARD.SEED_FOR_DAILY_SET;
  }

  emit('game:quest-claimed', { questId });
  return {
    buds: QUEST_REWARD.BUDS_DAILY,
    xp:   QUEST_REWARD.XP_DAILY,
    bonusSeed: bonus,
    allClear,
  };
}
