/**
 * CannaGotchi — Cosmetics System
 *
 * Three slots:
 *   • hat        — emoji or pixel decoration that floats over the sprite head
 *   • frame      — viewport border style (e.g. "Neon Trim", "Wood Frame")
 *   • aura       — animated glow/particle behind the sprite
 *
 * Cosmetics are owned (gameState.cosmetics.owned[id] = true), and one per
 * slot is equipped (gameState.cosmetics.equipped = { hat, frame, aura }).
 *
 * Acquisition:
 *   • Buds — common cosmetics from the cosmetic shop
 *   • Seeds — premium cosmetics (rarer, signature pieces)
 *   • Achievements — gifted on unlock (always free, never sold)
 *   • Strains — every unique strain you discover via Pick For Me grants
 *     a "Strain Skin" badge (a small color tint / themed hat)
 */

// ── HATS ─────────────────────────────────────────────────────
// `glyph` is the emoji shown above the sprite. `top` is the Y-offset (in px)
// from the sprite's top — most hats sit at -10 to -16. Achievement hats are
// flagged so the shop knows to show "Earned" instead of a price.
export const HATS = [
  // Free / starter
  { id: 'hat_none',         name: 'No Hat',           glyph: '',     price: 0,    cur: 'buds',  starter: true,  desc: 'Bare-headed and proud.' },
  // Common buds
  { id: 'hat_baseball',     name: 'Baseball Cap',     glyph: '🧢',   price: 60,   cur: 'buds',  desc: 'Casual, classic.' },
  { id: 'hat_top',          name: 'Top Hat',          glyph: '🎩',   price: 90,   cur: 'buds',  desc: 'Distinguished.' },
  { id: 'hat_cowboy',       name: 'Cowboy Hat',       glyph: '🤠',   price: 90,   cur: 'buds',  desc: 'Yeehaw vibes.' },
  { id: 'hat_grad',         name: 'Grad Cap',         glyph: '🎓',   price: 90,   cur: 'buds',  desc: 'Cum laude bud.' },
  { id: 'hat_party',        name: 'Party Hat',        glyph: '🥳',   price: 75,   cur: 'buds',  desc: 'Always a good time.' },
  { id: 'hat_shades',       name: 'Sunglasses',       glyph: '🕶️',  price: 70,   cur: 'buds',  desc: 'Permanently chill.' },
  { id: 'hat_visor',        name: 'Welder Visor',     glyph: '🥽',   price: 80,   cur: 'buds',  desc: 'Industrial lookin.' },
  { id: 'hat_bandana',      name: 'Bandana',          glyph: '🪢',   price: 65,   cur: 'buds',  desc: 'Pirate energy.' },
  { id: 'hat_flower',       name: 'Flower Crown',     glyph: '🌸',   price: 100,  cur: 'buds',  desc: 'Petals and peace.' },
  { id: 'hat_rose',         name: 'Single Rose',      glyph: '🌹',   price: 110,  cur: 'buds',  desc: 'Romantic.' },
  { id: 'hat_chefs',        name: 'Chef\'s Hat',      glyph: '👨‍🍳', price: 85,  cur: 'buds',  desc: 'Garden-to-table.' },
  // Premium / Seed-only
  { id: 'hat_crown',        name: 'Royal Crown',      glyph: '👑',   price: 5,    cur: 'seeds', desc: 'A bud truly fit for royalty.' },
  { id: 'hat_halo',         name: 'Halo',             glyph: '😇',   price: 4,    cur: 'seeds', desc: 'A heavenly touch.' },
  { id: 'hat_devil',        name: 'Devil Horns',      glyph: '😈',   price: 4,    cur: 'seeds', desc: 'A mischievous touch.' },
  { id: 'hat_unicorn',      name: 'Unicorn Horn',     glyph: '🦄',   price: 6,    cur: 'seeds', desc: 'Mythical in nature.' },
  { id: 'hat_butterfly',    name: 'Butterfly Friend', glyph: '🦋',   price: 5,    cur: 'seeds', desc: 'A tiny passenger.' },
  { id: 'hat_rocket',       name: 'Rocket Cap',       glyph: '🚀',   price: 7,    cur: 'seeds', desc: 'To the moon.' },
  // Achievement-only (never priced)
  { id: 'hat_battle_helm',  name: 'Battle Helm',      glyph: '🪖',   ach: 'wins_25',         desc: 'For 25 battle wins.' },
  { id: 'hat_champ_belt',   name: 'Champion Belt',    glyph: '🏆',   ach: 'wins_100',        desc: 'For 100 battle wins.' },
  { id: 'hat_dex_glasses',  name: 'Researcher Glasses', glyph: '🤓', ach: 'pick_25',         desc: 'For discovering 25 strains.' },
  { id: 'hat_living_book',  name: 'Pollen Halo',      glyph: '📖',   ach: 'pick_100',        desc: 'For discovering 100 strains.' },
  { id: 'hat_phoenix',      name: 'Phoenix Plume',    glyph: '🔥',   ach: 'prestige_first',  desc: 'For your first prestige.' },
  { id: 'hat_dragon',       name: 'Dragon Crest',     glyph: '🐉',   ach: 'prestige_5',      desc: 'For 5 prestiges.' },
  // Seasonal (for future drops — flagged so we can rotate them)
  { id: 'hat_pumpkin',      name: 'Pumpkin Head',     glyph: '🎃',   price: 2,    cur: 'seeds', seasonal: 'halloween', desc: 'Halloween special.' },
  { id: 'hat_santa',        name: 'Santa Hat',        glyph: '🎅',   price: 2,    cur: 'seeds', seasonal: 'december',  desc: 'Holiday cheer.' },
  { id: 'hat_420',          name: '4/20 Crown',       glyph: '💚',   price: 4,    cur: 'seeds', seasonal: 'apr20',     desc: 'Earth-day attire.' },
];

// ── FRAMES ───────────────────────────────────────────────────
// Each frame is a CSS class on the .garden-viewport / .battler__sprite.
export const FRAMES = [
  { id: 'frame_default',  name: 'Standard',     cssClass: 'frame-default',  price: 0,   cur: 'buds', starter: true, desc: 'Clean default look.' },
  { id: 'frame_neon',     name: 'Neon Trim',    cssClass: 'frame-neon',     price: 120, cur: 'buds', desc: 'Glowing magenta border.' },
  { id: 'frame_wood',     name: 'Wood Frame',   cssClass: 'frame-wood',     price: 100, cur: 'buds', desc: 'Rustic timber.' },
  { id: 'frame_gold',     name: 'Gilded',       cssClass: 'frame-gold',     price: 200, cur: 'buds', desc: 'For the cultivator with refined taste.' },
  { id: 'frame_purple',   name: 'Velvet',       cssClass: 'frame-velvet',   price: 150, cur: 'buds', desc: 'Soft purple drape.' },
  { id: 'frame_arcade',   name: 'Arcade',       cssClass: 'frame-arcade',   price: 180, cur: 'buds', desc: '8-bit nostalgia.' },
  { id: 'frame_crystal',  name: 'Crystal',      cssClass: 'frame-crystal',  price: 8,   cur: 'seeds', desc: 'Shimmering edges.' },
  { id: 'frame_obsidian', name: 'Obsidian',     cssClass: 'frame-obsidian', price: 6,   cur: 'seeds', desc: 'Sleek and dark.' },
];

// ── AURAS ────────────────────────────────────────────────────
// Animated background glow / particles behind the sprite.
export const AURAS = [
  { id: 'aura_none',     name: 'No Aura',       cssClass: '',                price: 0,   cur: 'buds', starter: true, desc: 'Subtle.' },
  { id: 'aura_glow',     name: 'Soft Glow',     cssClass: 'aura-glow',       price: 80,  cur: 'buds', desc: 'Gentle ambient light.' },
  { id: 'aura_sparkle',  name: 'Sparkle',       cssClass: 'aura-sparkle',    price: 130, cur: 'buds', desc: 'Twinkling pixels.' },
  { id: 'aura_smoke',    name: 'Smoke Plume',   cssClass: 'aura-smoke',      price: 110, cur: 'buds', desc: 'A wisp of green smoke.' },
  { id: 'aura_rainbow',  name: 'Rainbow',       cssClass: 'aura-rainbow',    price: 6,   cur: 'seeds', desc: 'Full spectrum aura.' },
  { id: 'aura_cosmic',   name: 'Cosmic Dust',   cssClass: 'aura-cosmic',     price: 8,   cur: 'seeds', desc: 'Space vibes.' },
  // Achievement-only
  { id: 'aura_thriving', name: 'Sun-Soaked Aura', cssClass: 'aura-sunsoaked', ach: 'thriving_30d', desc: 'Earned through devotion.' },
  { id: 'aura_boss',     name: 'Boss Aura',       cssClass: 'aura-boss',     ach: 'boss_5',       desc: 'For 5 boss defeats.' },
];

// Trichome-priced cosmetics (registered lazily by trichomes.js)
import { TRICHOME_COSMETICS } from './trichomes.js';

// Mark each trichome cosmetic with its slot
const TRICHOME_AS_SLOTS = TRICHOME_COSMETICS.map(c => {
  if (c.id.startsWith('hat_'))   return { ...c, _slot: 'hat' };
  if (c.id.startsWith('frame_')) return { ...c, _slot: 'frame' };
  if (c.id.startsWith('aura_'))  return { ...c, _slot: 'aura' };
  return c;
});

// Append trichome cosmetics into the slot lists too
const TRI_HATS  = TRICHOME_AS_SLOTS.filter(c => c._slot === 'hat');
const TRI_FRAMES= TRICHOME_AS_SLOTS.filter(c => c._slot === 'frame');
const TRI_AURAS = TRICHOME_AS_SLOTS.filter(c => c._slot === 'aura');
HATS.push(...TRI_HATS);
FRAMES.push(...TRI_FRAMES);
AURAS.push(...TRI_AURAS);

export const COSMETICS_BY_ID = Object.fromEntries(
  [...HATS, ...FRAMES, ...AURAS].map(c => [c.id, c])
);

export const COSMETIC_SLOTS = ['hat', 'frame', 'aura'];

export function createInitialCosmetics() {
  return {
    owned: {
      hat_none:        true,
      frame_default:   true,
      aura_none:       true,
    },
    equipped: {
      hat:   'hat_none',
      frame: 'frame_default',
      aura:  'aura_none',
    },
  };
}

/** All cosmetics for a given slot, with locked/unlocked state attached. */
export function listCosmeticsForSlot(slot, gameState) {
  const list = slot === 'hat' ? HATS : slot === 'frame' ? FRAMES : AURAS;
  const owned = gameState?.cosmetics?.owned || {};
  const ach = gameState?.achievements || {};
  return list.map(c => ({
    ...c,
    isOwned: !!owned[c.id],
    isAchievement: !!c.ach,
    isAchievementMet: !!c.ach && !!ach[c.ach],
    isSeasonal: !!c.seasonal,
  }));
}

export function buyCosmetic(gameState, id) {
  const c = COSMETICS_BY_ID[id];
  if (!c) return { ok: false, reason: 'unknown' };
  if (gameState.cosmetics.owned[id]) return { ok: false, reason: 'owned' };
  if (c.ach) return { ok: false, reason: 'achievement_only' };
  const cur = c.cur || 'buds';
  const balanceField = cur === 'seeds' ? 'seeds' : cur === 'trichomes' ? 'trichomes' : 'buds';
  const have = gameState[balanceField] || 0;
  if (have < c.price) return { ok: false, reason: 'broke' };
  gameState[balanceField] = have - c.price;
  gameState.cosmetics.owned[id] = true;
  return { ok: true, cosmetic: c };
}

export function equipCosmetic(gameState, slot, id) {
  if (!COSMETIC_SLOTS.includes(slot)) return false;
  if (!gameState.cosmetics.owned[id]) return false;
  gameState.cosmetics.equipped[slot] = id;
  return true;
}

export function getEquipped(gameState, slot) {
  const id = gameState?.cosmetics?.equipped?.[slot];
  return id ? COSMETICS_BY_ID[id] : null;
}

/**
 * Returns true if the given seasonal tag is currently active.
 * Seasons:
 *   halloween — Oct 1–31
 *   december   — Dec 1–26
 *   apr20      — Apr 15–21
 */
export function isSeasonalActive(seasonTag) {
  const now = new Date();
  const m = now.getMonth() + 1; // 1-based
  const d = now.getDate();
  switch (seasonTag) {
    case 'halloween': return m === 10;
    case 'december':  return m === 12 && d <= 26;
    case 'apr20':     return m === 4 && d >= 15 && d <= 21;
    default:          return false;
  }
}

/** Auto-grant any achievement-locked cosmetics whose ach is now satisfied. */
export function syncAchievementCosmetics(gameState) {
  const ach = gameState.achievements || {};
  const owned = gameState.cosmetics.owned;
  const newly = [];
  for (const c of [...HATS, ...FRAMES, ...AURAS]) {
    if (c.ach && ach[c.ach] && !owned[c.id]) {
      owned[c.id] = true;
      newly.push(c);
    }
  }
  return newly;
}
