/**
 * CannaGotchi — Achievements
 *
 * Achievements unlock once and never reset (not even on prestige).
 * Each grants Buds and/or Seeds and lights up the Trophy Room.
 *
 * Schema: gameState.achievements = { [id]: true }
 *         gameState.lifetime     = { totalActions, totalBattlesWon, strainsDiscovered: [] }
 */

import { emit } from './eventBus.js';

// Each achievement carries an optional `progress(gs) → { current, target }` so
// the UI can render a "23 / 25" progress bar on locked entries.
export const ACHIEVEMENTS = [
  // Onboarding
  { id: 'first_seed',     name: 'First Seed',          desc: 'Plant your CannaGotchi.',                budReward: 25,  seedReward: 0, check: gs => !!gs.monsterType,                                            progress: gs => ({ current: gs.monsterType ? 1 : 0, target: 1 }) },
  { id: 'first_evo',      name: 'Sproutling',          desc: 'Reach Lv.5 (first evolution).',          budReward: 50,  seedReward: 0, check: gs => (gs._level ?? 1) >= 5,                                       progress: gs => ({ current: Math.min(gs._level ?? 1, 5), target: 5 }) },
  { id: 'sapling_stage',  name: 'Branching Out',       desc: 'Reach Lv.15.',                           budReward: 100, seedReward: 1, check: gs => (gs._level ?? 1) >= 15,                                      progress: gs => ({ current: Math.min(gs._level ?? 1, 15), target: 15 }) },
  { id: 'bloom_stage',    name: 'In Full Bloom',       desc: 'Reach Lv.30.',                           budReward: 250, seedReward: 2, check: gs => (gs._level ?? 1) >= 30,                                      progress: gs => ({ current: Math.min(gs._level ?? 1, 30), target: 30 }) },
  { id: 'ancient_stage',  name: 'Ancient One',         desc: 'Reach Lv.50.',                           budReward: 1000,seedReward: 5, check: gs => (gs._level ?? 1) >= 50,                                      progress: gs => ({ current: Math.min(gs._level ?? 1, 50), target: 50 }) },

  // Care
  { id: 'care_50',        name: 'Caring Hand',         desc: 'Perform 50 care actions (feed/water/clean).',           budReward: 60,  seedReward: 0, check: gs => (gs.lifetime?.totalActions ?? 0) >= 50,        progress: gs => ({ current: Math.min(gs.lifetime?.totalActions ?? 0, 50),  target: 50 }) },
  { id: 'care_500',       name: 'Devoted Cultivator',  desc: 'Perform 500 care actions.',                              budReward: 200, seedReward: 1, check: gs => (gs.lifetime?.totalActions ?? 0) >= 500,       progress: gs => ({ current: Math.min(gs.lifetime?.totalActions ?? 0, 500), target: 500 }) },
  { id: 'thriving_30d',   name: 'Sun-Soaked',          desc: 'Maintain Thriving status for a full session day.',     budReward: 100, seedReward: 1, check: gs => (gs.lifetime?.thrivingDays ?? 0) >= 1,         progress: gs => ({ current: Math.min(gs.lifetime?.thrivingDays ?? 0, 1),   target: 1 }) },

  // Battle
  { id: 'first_win',      name: 'First Blood',         desc: 'Win your first battle.',                                 budReward: 30,  seedReward: 0, check: gs => (gs.wins ?? 0) >= 1,                          progress: gs => ({ current: Math.min(gs.wins ?? 0, 1),   target: 1 }) },
  { id: 'wins_25',        name: 'Battle-Tested',       desc: 'Win 25 battles.',                                        budReward: 150, seedReward: 0, check: gs => (gs.wins ?? 0) >= 25,                         progress: gs => ({ current: Math.min(gs.wins ?? 0, 25),  target: 25 }) },
  { id: 'wins_100',       name: 'Champion',            desc: 'Win 100 battles.',                                       budReward: 600, seedReward: 2, check: gs => (gs.wins ?? 0) >= 100,                        progress: gs => ({ current: Math.min(gs.wins ?? 0, 100), target: 100 }) },
  { id: 'boss_first',     name: 'Boss Slayer',         desc: 'Defeat your first arena boss.',                          budReward: 200, seedReward: 1, check: gs => (gs.battle?.bossesDefeated?.length ?? 0) >= 1, progress: gs => ({ current: Math.min(gs.battle?.bossesDefeated?.length ?? 0, 1), target: 1 }) },
  { id: 'boss_5',         name: 'Boss Rush',           desc: 'Defeat 5 different bosses.',                             budReward: 800, seedReward: 3, check: gs => (gs.battle?.bossesDefeated?.length ?? 0) >= 5, progress: gs => ({ current: Math.min(gs.battle?.bossesDefeated?.length ?? 0, 5), target: 5 }) },

  // Economy
  { id: 'rich_500',       name: 'Pocket Money',        desc: 'Hold 500 Buds.',                                         budReward: 50,  seedReward: 0, check: gs => (gs.buds ?? 0) >= 500,                        progress: gs => ({ current: Math.min(gs.buds ?? 0, 500),  target: 500 }) },
  { id: 'rich_5k',        name: 'Bud Baron',           desc: 'Hold 5,000 Buds.',                                       budReward: 500, seedReward: 1, check: gs => (gs.buds ?? 0) >= 5000,                       progress: gs => ({ current: Math.min(gs.buds ?? 0, 5000), target: 5000 }) },
  { id: 'shopaholic',     name: 'Shopaholic',          desc: 'Buy 50 items from the shop.',                            budReward: 250, seedReward: 1, check: gs => (gs.lifetime?.itemsBought ?? 0) >= 50,        progress: gs => ({ current: Math.min(gs.lifetime?.itemsBought ?? 0, 50), target: 50 }) },

  // Pick integration
  { id: 'pick_first',     name: 'Strain Sleuth',       desc: 'Discover your first strain via Pick For Me.',           budReward: 25,  seedReward: 0, check: gs => (gs.lifetime?.strainsDiscovered?.length ?? 0) >= 1,   progress: gs => ({ current: Math.min(gs.lifetime?.strainsDiscovered?.length ?? 0, 1),   target: 1 }) },
  { id: 'pick_25',        name: 'Connoisseur',         desc: 'Discover 25 unique strains.',                            budReward: 250, seedReward: 1, check: gs => (gs.lifetime?.strainsDiscovered?.length ?? 0) >= 25,  progress: gs => ({ current: Math.min(gs.lifetime?.strainsDiscovered?.length ?? 0, 25),  target: 25 }) },
  { id: 'pick_100',       name: 'Living Encyclopedia', desc: 'Discover 100 unique strains.',                           budReward: 1500,seedReward: 5, check: gs => (gs.lifetime?.strainsDiscovered?.length ?? 0) >= 100, progress: gs => ({ current: Math.min(gs.lifetime?.strainsDiscovered?.length ?? 0, 100), target: 100 }) },

  // Prestige
  { id: 'prestige_first', name: 'Reborn',              desc: 'Prestige once.',                                         budReward: 0,   seedReward: 3,  check: gs => (gs.prestige?.count ?? 0) >= 1, progress: gs => ({ current: Math.min(gs.prestige?.count ?? 0, 1), target: 1 }) },
  { id: 'prestige_5',     name: 'Eternal Cultivator',  desc: 'Prestige 5 times.',                                      budReward: 0,   seedReward: 10, check: gs => (gs.prestige?.count ?? 0) >= 5, progress: gs => ({ current: Math.min(gs.prestige?.count ?? 0, 5), target: 5 }) },
];

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/** Re-evaluate every achievement. Mutates gameState; returns newly unlocked defs. */
export function checkAchievements(gameState) {
  if (!gameState) return [];
  if (!gameState.achievements) gameState.achievements = {};
  const newlyUnlocked = [];

  for (const def of ACHIEVEMENTS) {
    if (gameState.achievements[def.id]) continue;
    let ok = false;
    try { ok = !!def.check(gameState); } catch (_) {}
    if (ok) {
      gameState.achievements[def.id] = true;
      gameState.buds  = (gameState.buds  ?? 0) + (def.budReward  ?? 0);
      gameState.seeds = (gameState.seeds ?? 0) + (def.seedReward ?? 0);
      newlyUnlocked.push(def);
      emit('game:achievement', { id: def.id, def });
    }
  }
  return newlyUnlocked;
}
