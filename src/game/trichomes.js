/**
 * CannaGotchi — Trichome Harvesting
 *
 * Once a Cannabud reaches Lv.50, it produces ONE Trichome per real-world day.
 * Trichomes are an end-game currency that buys exclusive cosmetics in the
 * "Apothecary" section of the shop. They never reset on prestige.
 *
 * State:
 *   gameState.trichomes              — total balance (account-level)
 *   gameState.trichomeLastClaimedAt  — ms timestamp of last harvest tick (per active bud)
 *
 * Harvest tick:
 *   On every game-screen open + every idle tick, we check if the active bud
 *   is Lv.50+. If yes and ≥24h have passed since the last claim, we increment
 *   trichomes by floor(daysElapsed) and update the timestamp.
 */

const HARVEST_INTERVAL_MS = 24 * 60 * 60 * 1000;
const HARVEST_LEVEL = 50;

/** Run a harvest tick. Returns the number of trichomes added (0 if none). */
export function harvestTick(gameState) {
  if (!gameState) return 0;
  const lvl = gameState._level ?? 1;
  if (lvl < HARVEST_LEVEL) return 0;

  const last = gameState.trichomeLastClaimedAt || 0;
  const now = Date.now();
  if (!last) {
    // First time eligible — start the clock without giving a freebie
    gameState.trichomeLastClaimedAt = now;
    return 0;
  }
  const elapsed = now - last;
  if (elapsed < HARVEST_INTERVAL_MS) return 0;

  const days = Math.floor(elapsed / HARVEST_INTERVAL_MS);
  if (days <= 0) return 0;

  gameState.trichomes = (gameState.trichomes || 0) + days;
  gameState.trichomeLastClaimedAt = last + days * HARVEST_INTERVAL_MS;
  return days;
}

/** ms until next trichome — for UI countdown when eligible. */
export function msUntilNextTrichome(gameState) {
  const lvl = gameState?._level ?? 1;
  if (lvl < HARVEST_LEVEL) return null;
  const last = gameState.trichomeLastClaimedAt || Date.now();
  return Math.max(0, last + HARVEST_INTERVAL_MS - Date.now());
}

/** Trichome-only cosmetic catalog. Treated as "Apothecary" tier in the shop. */
export const TRICHOME_COSMETICS = [
  { id: 'hat_apothecary',  name: 'Apothecary Cowl',  glyph: '⚗️', price: 3, cur: 'trichomes', desc: 'A scientist\'s hood — for the master cultivator.' },
  { id: 'hat_diamond',     name: 'Diamond Crown',    glyph: '💠', price: 4, cur: 'trichomes', desc: 'Crystalline endgame elegance.' },
  { id: 'hat_lantern',     name: 'Glow Lantern',     glyph: '🏮', price: 3, cur: 'trichomes', desc: 'Soft amber that pulses on tap.' },
  { id: 'frame_lattice',   name: 'Trichome Lattice', cssClass: 'frame-lattice', price: 5, cur: 'trichomes', desc: 'A delicate crystalline border.' },
  { id: 'aura_kief',       name: 'Kief Mist',        cssClass: 'aura-kief',     price: 4, cur: 'trichomes', desc: 'Drifting golden particles.' },
  { id: 'aura_mythic',     name: 'Mythic Bloom',     cssClass: 'aura-mythic',   price: 8, cur: 'trichomes', desc: 'Iridescent shimmer for the bred-perfect bud.' },
];
