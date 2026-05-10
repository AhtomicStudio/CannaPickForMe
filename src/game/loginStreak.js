/**
 * CannaGotchi — Login Streak Rewards
 *
 * Rewards consecutive-day visits with escalating prizes. The streak resets
 * when the user misses a day. Day 7 is a hat — random pull from a small
 * pool, only awarding hats they don't already own.
 */

import { HATS, COSMETICS_BY_ID } from './cosmetics.js';

export const STREAK_REWARDS = [
  { day: 1, kind: 'xp',    amount: 25,  label: '+25 XP' },
  { day: 2, kind: 'buds',  amount: 15,  label: '+15 🪙' },
  { day: 3, kind: 'seeds', amount: 1,   label: '+1 🌱' },
  { day: 4, kind: 'buds',  amount: 30,  label: '+30 🪙' },
  { day: 5, kind: 'xp',    amount: 60,  label: '+60 XP' },
  { day: 6, kind: 'buds',  amount: 50,  label: '+50 🪙' },
  { day: 7, kind: 'hat',   amount: 1,   label: '🎁 Random Hat!' },
];

const STREAK_HAT_POOL = ['hat_baseball','hat_top','hat_cowboy','hat_grad','hat_party','hat_shades','hat_visor','hat_bandana','hat_flower','hat_rose','hat_chefs'];

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Call once per game-screen open. Updates streak counter, awards the day's
 * reward (if not already claimed today), and returns a descriptor for UI.
 *
 * @returns null | { day, reward, label }
 */
export function processLoginStreak(gameState) {
  if (!gameState) return null;
  const today = localDate();
  const streak = gameState.loginStreak || { day: 0, lastDate: '' };

  if (streak.lastDate === today) return null; // already claimed today

  // Was yesterday? then streak.day++. Else reset to 1.
  let newDay = 1;
  if (streak.lastDate) {
    const prev = new Date(streak.lastDate + 'T00:00:00');
    const cur  = new Date(today + 'T00:00:00');
    const diff = Math.round((cur - prev) / 86400000);
    newDay = diff === 1 ? Math.min(7, (streak.day || 0) + 1) : 1;
  }

  // Day 7 cycles back to 1 the *next* day so the cycle keeps repeating
  const reward = STREAK_REWARDS.find(r => r.day === newDay);
  applyReward(gameState, reward);

  gameState.loginStreak = { day: newDay, lastDate: today };
  return { day: newDay, reward, label: reward.label };
}

function applyReward(gameState, reward) {
  switch (reward.kind) {
    case 'xp':    gameState.xp    = (gameState.xp    || 0) + reward.amount; break;
    case 'buds':  gameState.buds  = (gameState.buds  || 0) + reward.amount; break;
    case 'seeds': gameState.seeds = (gameState.seeds || 0) + reward.amount; break;
    case 'hat': {
      // Pick a hat the player doesn't own
      gameState.cosmetics = gameState.cosmetics || { owned: {}, equipped: {} };
      const candidates = STREAK_HAT_POOL.filter(id => !gameState.cosmetics.owned[id]);
      const pick = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
      if (pick) {
        gameState.cosmetics.owned[pick] = true;
        reward.hatId = pick;
        reward.label = `🎁 Got ${COSMETICS_BY_ID[pick]?.name || 'a hat'}!`;
      } else {
        // Fallback if all are owned: 5 Seeds.
        gameState.seeds = (gameState.seeds || 0) + 5;
        reward.label = '🎁 Hat collection complete — +5 🌱 instead!';
      }
      break;
    }
  }
}
