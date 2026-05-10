/**
 * CannaGotchi — Pixel Art Sprite Renderer
 * Renders sprites as CSS box-shadow grids for crisp pixel art at any scale.
 *
 * Design Philosophy:
 *   Indica  — Heavy, round, surrounded by purple gas/haze
 *   Sativa  — Tall, energetic, Ancient has Super Saiyan aura
 *   Hybrid  — Angular/diamond shapes, balanced green with sparse accents
 */

const PX = 5;

// Color palette
const _ = null;          // transparent
const P = '#a78bfa';     // purple (indica)
const G = '#4ade80';     // green
const D = '#6b4c2a';     // dirt/brown
const L = '#86efac';     // light green
const K = '#1e1e2e';     // dark outline
const W = '#f5f5f5';     // white highlight
const R = '#7c3aed';     // deep purple
const E = '#22c55e';     // emerald
const O = '#f59e0b';     // orange
const T = '#fb923c';     // light orange (trichome hairs)
const H = '#a3e635';     // lime highlight
const V = '#c084fc';     // violet (light purple)
const S = '#4a3660';     // smoke/haze (dark purple haze)
const F = '#6d28d9';     // faint purple fog
const A = '#fef08a';     // aura/energy (light yellow)
const Z = '#fde047';     // bright energy (yellow)

// ══════════════════════════════════════════════
//  INDICA — Heavy round shapes + purple haze/gas
// ══════════════════════════════════════════════
const INDICA = {
  indica_seed: [
    [_,_,_,_,_,_,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,K,D,D,K,_,_],
    [_,_,K,D,P,K,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,_,_,_,_,_,_],
  ],
  indica_sprout: [
    [_,_,_,_,P,_,_,_],
    [_,_,_,P,K,P,_,_],
    [_,_,_,_,P,_,_,_],
    [_,_,_,_,K,_,_,_],
    [_,_,_,K,D,K,_,_],
    [_,_,K,D,D,D,K,_],
    [_,_,_,K,K,K,_,_],
  ],
  // Sapling — haze starts to appear as faint wisps
  indica_sapling: [
    [_,_,S,P,P,S,_,_],
    [_,S,P,R,R,P,S,_],
    [_,P,R,P,P,R,P,_],
    [_,_,P,R,R,P,_,_],
    [_,_,_,P,P,_,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,K,D,D,K,_,_],
    [_,K,D,D,D,D,K,_],
    [_,_,K,K,K,K,_,_],
  ],
  // Bloom — thicker purple gas cloud around it
  indica_bloom: [
    [_,S,_,S,S,_,S,_],
    [S,_,P,W,W,P,_,S],
    [_,P,R,P,P,R,P,_],
    [S,R,P,W,W,P,R,S],
    [S,R,P,P,P,P,R,S],
    [_,P,R,P,P,R,P,_],
    [S,_,P,R,R,P,_,S],
    [_,_,_,K,K,_,_,_],
    [_,_,K,K,K,K,_,_],
    [_,K,D,D,D,D,K,_],
    [K,D,D,D,D,D,D,K],
    [_,K,K,K,K,K,K,_],
  ],
  // Ancient — dense fog/gas surrounds the massive creature
  indica_ancient: [
    [S,_,S,_,_,S,_,S],
    [_,S,W,P,P,W,S,_],
    [S,W,P,R,R,P,W,S],
    [F,R,W,P,P,W,R,F],
    [S,R,P,W,W,P,R,S],
    [F,P,R,P,P,R,P,F],
    [S,_,P,R,R,P,_,S],
    [_,S,_,P,P,_,S,_],
    [_,_,_,K,K,_,_,_],
    [_,_,K,K,K,K,_,_],
    [_,K,D,K,K,D,K,_],
    [K,D,D,D,D,D,D,K],
    [K,D,D,D,D,D,D,K],
    [_,K,K,K,K,K,K,_],
  ],
};

// ══════════════════════════════════════════════
//  SATIVA — Tall, energetic, orange trichome hairs
//  Ancient = Super Saiyan energy aura
// ══════════════════════════════════════════════
const SATIVA = {
  sativa_seed: [
    [_,_,_,_,_,_,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,K,D,D,K,_,_],
    [_,_,K,D,G,K,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,_,_,_,_,_,_],
  ],
  sativa_sprout: [
    [_,_,_,T,G,_,_,_],
    [_,_,_,G,K,G,_,_],
    [_,_,G,_,G,T,_,_],
    [_,_,_,_,K,_,_,_],
    [_,_,_,K,D,K,_,_],
    [_,_,K,D,D,D,K,_],
    [_,_,_,K,K,K,_,_],
  ],
  sativa_sapling: [
    [_,_,T,_,_,T,_,_],
    [_,G,L,G,G,L,G,_],
    [T,_,G,E,E,G,_,T],
    [_,_,G,L,L,G,_,_],
    [_,_,T,G,G,T,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,K,D,D,K,_,_],
    [_,K,D,D,D,D,K,_],
    [_,_,K,K,K,K,_,_],
  ],
  // Bloom — getting energetic, slight glow pixels
  sativa_bloom: [
    [_,T,L,W,W,L,T,_],
    [_,G,E,L,L,E,G,_],
    [T,E,L,W,W,L,E,T],
    [G,E,G,G,G,G,E,G],
    [T,G,E,G,G,E,G,T],
    [_,_,G,E,E,G,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,K,K,K,K,_,_],
    [_,K,D,D,D,D,K,_],
    [K,D,D,D,D,D,D,K],
    [_,K,K,K,K,K,K,_],
  ],
  // Ancient — Super Saiyan aura: energy lines radiating outward
  sativa_ancient: [
    [A,_,Z,_,_,Z,_,A],
    [_,A,W,G,G,W,A,_],
    [Z,G,L,E,E,L,G,Z],
    [_,E,W,L,L,W,E,_],
    [A,E,G,W,W,G,E,A],
    [_,G,E,G,G,E,G,_],
    [Z,T,G,E,E,G,T,Z],
    [_,_,T,G,G,T,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,K,K,K,K,_,_],
    [_,K,D,K,K,D,K,_],
    [K,D,D,D,D,D,D,K],
    [K,D,D,D,D,D,D,K],
    [_,K,K,K,K,K,K,_],
  ],
};

// ══════════════════════════════════════════════
//  HYBRID — Angular/diamond shapes, balanced green
//  with very sparse purple+orange accents.
//  Vibe: versatile, adaptable, shapeshifter
// ══════════════════════════════════════════════
const HYBRID = {
  // Seed — split green+violet to hint at duality
  hybrid_seed: [
    [_,_,_,_,_,_,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,K,G,V,K,_,_],
    [_,_,K,D,D,K,_,_],
    [_,_,_,K,K,_,_,_],
    [_,_,_,_,_,_,_,_],
  ],
  // Sprout — angular leaf shape, one side green one side lighter
  hybrid_sprout: [
    [_,_,_,_,G,_,_,_],
    [_,_,_,G,K,L,_,_],
    [_,_,L,_,G,_,_,_],
    [_,_,_,_,K,_,_,_],
    [_,_,_,K,D,K,_,_],
    [_,_,K,D,D,D,K,_],
    [_,_,_,K,K,K,_,_],
  ],
  // Sapling — diamond silhouette, balanced green with tiny accents
  hybrid_sapling: [
    [_,_,_,_,G,_,_,_,_],
    [_,_,_,G,E,G,_,_,_],
    [_,_,G,E,L,E,G,_,_],
    [_,G,E,G,W,G,E,G,_],
    [_,_,G,E,L,E,G,_,_],
    [_,_,_,G,E,G,_,_,_],
    [_,_,_,_,K,_,_,_,_],
    [_,_,_,K,K,K,_,_,_],
    [_,_,K,D,D,D,K,_,_],
    [_,_,_,K,K,K,_,_,_],
  ],
  // Bloom — larger diamond with faint purple+orange at tips only
  hybrid_bloom: [
    [_,_,_,_,V,_,_,_,_],
    [_,_,_,G,E,G,_,_,_],
    [_,_,G,L,W,L,G,_,_],
    [_,T,E,G,W,G,E,O,_],
    [_,_,G,L,W,L,G,_,_],
    [_,_,_,G,E,G,_,_,_],
    [_,_,_,_,P,_,_,_,_],
    [_,_,_,_,K,_,_,_,_],
    [_,_,_,K,K,K,_,_,_],
    [_,_,K,D,D,D,K,_,_],
    [_,K,D,D,D,D,D,K,_],
    [_,_,K,K,K,K,K,_,_],
  ],
  // Ancient — crystalline diamond form, accents at cardinal tips
  hybrid_ancient: [
    [_,_,_,_,_,O,_,_,_,_,_],
    [_,_,_,_,G,E,G,_,_,_,_],
    [_,_,_,G,E,W,E,G,_,_,_],
    [_,_,G,E,W,W,W,E,G,_,_],
    [_,V,E,W,W,W,W,W,E,T,_],
    [_,_,G,E,W,W,W,E,G,_,_],
    [_,_,_,G,E,W,E,G,_,_,_],
    [_,_,_,_,G,E,G,_,_,_,_],
    [_,_,_,_,_,P,_,_,_,_,_],
    [_,_,_,_,_,K,_,_,_,_,_],
    [_,_,_,_,K,K,K,_,_,_,_],
    [_,_,_,K,D,K,D,K,_,_,_],
    [_,_,K,D,D,D,D,D,K,_,_],
    [_,_,K,D,D,D,D,D,K,_,_],
    [_,_,_,K,K,K,K,K,_,_,_],
  ],
};

// ══════════════════════════════════════════════
//  BOSSES — bigger, more detailed silhouettes.
//  Each has a custom palette / silhouette so they
//  read as obviously NOT a generic wild bud.
// ══════════════════════════════════════════════
const BOSSES_SPRITES = {
  // Seed Lord — heavy purple Indica with a crown of trichomes.
  boss_seed_lord: [
    [_,_,_,_,O,_,_,O,_,_,_,_],
    [_,_,_,O,T,O,T,O,_,_,_,_],
    [_,_,_,_,P,W,P,_,_,_,_,_],
    [_,_,S,P,R,W,W,R,P,S,_,_],
    [_,S,P,W,V,P,P,V,W,P,S,_],
    [S,P,R,W,P,W,W,P,W,R,P,S],
    [F,P,V,P,W,W,W,W,P,V,P,F],
    [S,P,R,W,P,P,P,P,W,R,P,S],
    [_,S,P,W,V,P,P,V,W,P,S,_],
    [_,_,S,P,R,P,P,R,P,S,_,_],
    [_,_,_,_,P,P,P,P,_,_,_,_],
    [_,_,_,_,K,K,K,K,_,_,_,_],
    [_,_,_,K,D,D,D,D,K,_,_,_],
    [_,_,K,D,D,D,D,D,D,K,_,_],
    [_,K,D,D,D,D,D,D,D,D,K,_],
    [_,_,K,K,K,K,K,K,K,K,_,_],
  ],
  // Haze Baron — tall sativa wreathed in glittering aura.
  boss_haze_baron: [
    [Z,_,A,_,_,_,_,A,_,Z],
    [_,A,Z,W,W,W,W,Z,A,_],
    [A,W,T,L,G,G,L,T,W,A],
    [_,T,L,W,E,E,W,L,T,_],
    [Z,G,L,E,W,W,E,L,G,Z],
    [_,G,E,W,L,L,W,E,G,_],
    [A,T,L,W,G,G,W,L,T,A],
    [_,_,T,L,E,E,L,T,_,_],
    [_,_,_,T,L,L,T,_,_,_],
    [_,_,_,_,K,K,_,_,_,_],
    [_,_,_,K,K,K,K,_,_,_],
    [_,_,K,D,D,D,D,K,_,_],
    [_,K,D,D,D,D,D,D,K,_],
    [_,_,K,K,K,K,K,K,_,_],
  ],
  // Root Witch — gnarled hybrid with mycelium trails.
  boss_root_witch: [
    [_,_,V,_,_,_,_,V,_,_],
    [_,V,P,O,T,T,O,P,V,_],
    [V,P,W,L,E,E,L,W,P,V],
    [P,W,E,W,V,V,W,E,W,P],
    [O,W,L,E,W,W,E,L,W,O],
    [T,V,W,L,E,E,L,W,V,T],
    [_,P,W,E,L,L,E,W,P,_],
    [_,_,V,W,E,E,W,V,_,_],
    [_,_,_,P,W,W,P,_,_,_],
    [_,_,K,V,K,K,V,K,_,_],
    [_,K,D,K,D,D,K,D,K,_],
    [K,D,D,D,D,D,D,D,D,K],
    [_,K,D,D,D,D,D,D,K,_],
    [_,_,K,K,K,K,K,K,_,_],
  ],
  // Blue Dreamer — shimmering crystalline hybrid.
  boss_blue_dream: [
    [_,_,_,_,W,_,_,_,_,_],
    [_,_,_,W,V,W,_,_,_,_],
    [_,_,W,V,W,V,W,_,_,_],
    [_,W,V,W,W,W,V,W,_,_],
    [W,V,W,W,V,V,W,W,V,_],
    [_,W,V,W,V,V,W,V,W,_],
    [_,_,W,V,W,W,V,W,_,_],
    [_,_,_,W,V,V,W,_,_,_],
    [_,_,_,_,W,W,_,_,_,_],
    [_,_,_,_,K,K,_,_,_,_],
    [_,_,_,K,K,K,K,_,_,_],
    [_,_,K,D,D,D,D,K,_,_],
    [_,K,D,D,D,D,D,D,K,_],
    [_,_,K,K,K,K,K,K,_,_],
  ],
  // Kush King — massive purple Indica wearing a crown.
  boss_kush_king: [
    [_,Z,_,_,Z,Z,_,_,Z,_],
    [Z,A,Z,A,W,W,A,Z,A,Z],
    [_,Z,_,_,O,O,_,_,Z,_],
    [_,S,P,W,P,P,W,P,S,_],
    [S,P,R,W,V,V,W,R,P,S],
    [F,P,V,P,W,W,P,V,P,F],
    [S,R,W,P,P,P,P,W,R,S],
    [_,P,W,V,V,V,V,W,P,_],
    [_,_,P,R,W,W,R,P,_,_],
    [_,_,_,K,K,K,K,_,_,_],
    [_,_,K,D,D,D,D,K,_,_],
    [_,K,D,D,D,D,D,D,K,_],
    [K,D,D,D,D,D,D,D,D,K],
    [_,K,K,K,K,K,K,K,K,_],
  ],
  // Sun God — radiant Sativa with a halo of light.
  boss_sun_god: [
    [Z,_,A,_,Z,Z,_,A,_,Z],
    [_,Z,A,Z,A,A,Z,A,Z,_],
    [A,Z,W,L,G,G,L,W,Z,A],
    [Z,L,W,E,W,W,E,W,L,Z],
    [A,G,E,W,Z,Z,W,E,G,A],
    [Z,L,W,Z,A,A,Z,W,L,Z],
    [A,G,E,W,Z,Z,W,E,G,A],
    [Z,L,W,E,W,W,E,W,L,Z],
    [_,_,L,E,L,L,E,L,_,_],
    [_,_,_,K,K,K,K,_,_,_],
    [_,_,K,D,D,D,D,K,_,_],
    [_,K,D,D,D,D,D,D,K,_],
    [K,D,D,D,D,D,D,D,D,K],
    [_,K,K,K,K,K,K,K,K,_],
  ],
};

// ══════════════════════════════════════════════
//  HATS — small pixel-art overlays that sit
//  centered above a Cannabud's head. Keep heights
//  short (≤4 rows) so they don't dominate.
//  Extra colors used by hats only:
// ══════════════════════════════════════════════
const X = '#ef4444';   // red
const Q = '#3b82f6';   // blue
const Y = '#facc15';   // yellow / gold
const N = '#8b5a2b';   // saddle brown (cowboy)
const M = '#ec4899';   // magenta / pink
const C = '#06b6d4';   // cyan / teal
const B = '#1e3a8a';   // navy (baseball cap)

const HAT_SPRITES = {
  hat_baseball: [
    [_,Q,Q,Q,_],
    [Q,Q,Q,Q,Q],
    [Q,Q,Q,_,_],
  ],
  hat_top: [
    [_,K,K,K,_],
    [_,K,K,K,_],
    [_,X,X,X,_],
    [K,K,K,K,K],
  ],
  hat_cowboy: [
    [_,_,N,N,N,_,_],
    [_,N,W,N,W,N,_],
    [N,N,N,N,N,N,N],
  ],
  hat_grad: [
    [K,K,K,K,K],
    [_,K,K,K,_],
    [_,_,Y,_,_],
  ],
  hat_party: [
    [_,_,M,_,_],
    [_,M,W,M,_],
    [M,W,M,W,M],
    [G,G,G,G,G],
  ],
  hat_shades: [
    [K,K,K,K,K],
    [K,_,K,_,K],
  ],
  hat_visor: [
    [K,K,K,K,K],
    [K,Q,Q,Q,K],
    [K,K,K,K,K],
  ],
  hat_bandana: [
    [X,X,X,X,X,X,X],
    [W,_,W,_,W,_,W],
  ],
  hat_flower: [
    [M,_,Y,_,M,_,Y],
    [G,G,G,G,G,G,G],
  ],
  hat_rose: [
    [_,X,_],
    [X,Y,X],
    [_,G,_],
  ],
  hat_chefs: [
    [_,W,W,W,_],
    [W,W,W,W,W],
    [_,W,W,W,_],
    [W,W,W,W,W],
  ],
  hat_crown: [
    [Y,_,Y,_,Y],
    [Y,Y,Y,Y,Y],
    [O,O,O,O,O],
  ],
  hat_halo: [
    [A,A,A,A,A],
    [_,A,_,A,_],
  ],
  hat_devil: [
    [X,_,_,_,X],
    [X,_,_,_,X],
  ],
  hat_unicorn: [
    [_,Y,_],
    [Y,Y,Y],
    [_,W,_],
    [_,W,_],
  ],
  hat_butterfly: [
    [M,_,_,_,V],
    [M,M,B,V,V],
    [M,_,_,_,V],
  ],
  hat_rocket: [
    [_,_,W,_,_],
    [_,W,X,W,_],
    [_,W,X,W,_],
    [W,_,X,_,W],
  ],
  hat_battle_helm: [
    [_,K,K,K,_],
    [K,K,W,K,K],
    [K,_,_,_,K],
  ],
  hat_champ_belt: [
    [_,Y,Y,Y,_],
    [Y,W,Y,W,Y],
    [_,Y,Y,Y,_],
  ],
  hat_dex_glasses: [
    [K,_,K,_,K],
    [K,W,K,W,K],
  ],
  hat_living_book: [
    [W,W,W,W,W],
    [W,K,W,K,W],
    [W,W,W,W,W],
  ],
  hat_phoenix: [
    [_,_,O,_,_],
    [_,O,Z,O,_],
    [O,Z,A,Z,O],
    [_,O,_,O,_],
  ],
  hat_dragon: [
    [G,_,G,_,G],
    [E,G,E,G,E],
    [G,_,_,_,G],
  ],
  hat_pumpkin: [
    [_,_,G,_,_],
    [O,O,O,O,O],
    [O,K,O,K,O],
  ],
  hat_santa: [
    [_,W,W,W,W],
    [X,X,X,X,_],
    [W,W,W,W,W],
  ],
  hat_420: [
    [G,_,G,_,G],
    [G,G,G,G,G],
    [W,_,W,_,W],
  ],
  hat_apothecary: [
    [_,K,K,K,_],
    [K,W,K,W,K],
    [K,K,K,K,K],
    [K,_,_,_,K],
  ],
  hat_diamond: [
    [_,W,_],
    [W,A,W],
    [_,W,_],
  ],
  hat_lantern: [
    [_,K,_],
    [O,Z,O],
    [O,Z,O],
    [_,K,_],
  ],
};

const SPRITES = { ...INDICA, ...SATIVA, ...HYBRID, ...BOSSES_SPRITES, ...HAT_SPRITES };

/**
 * Render a named sprite into a container element using box-shadow technique.
 *
 * Optional palette remap lets a single sprite shape support multiple visual
 * variants (Classic / Crimson / Onyx, etc.) with no extra art.
 *
 * @param {HTMLElement} container
 * @param {string} spriteName
 * @param {number} scale
 * @param {object} [opts] — { paletteRemap?: { [hex]: hex }, hueShift?: number }
 */
export function renderSprite(container, spriteName, scale = PX, opts = {}) {
  const data = SPRITES[spriteName];
  if (!data) { container.innerHTML = '<span style="font-size:3rem">🌱</span>'; return; }
  const remap = opts.paletteRemap || null;

  const shadows = [];
  for (let y = 0; y < data.length; y++) {
    for (let x = 0; x < data[y].length; x++) {
      let color = data[y][x];
      if (!color) continue;
      if (remap && remap[color]) color = remap[color];
      shadows.push(`${x * scale}px ${y * scale}px 0 0 ${color}`);
    }
  }

  const width = Math.max(...data.map(r => r.length));
  const height = data.length;

  const pixel = document.createElement('div');
  pixel.className = 'pixel-sprite';
  pixel.style.cssText = `
    width: ${scale}px;
    height: ${scale}px;
    box-shadow: ${shadows.join(',')};
    margin: ${scale}px;
  `;

  const wrapper = document.createElement('div');
  wrapper.className = 'pixel-sprite-wrap';
  wrapper.style.cssText = `
    width: ${(width + 1) * scale}px;
    height: ${(height + 1) * scale}px;
    margin: 0 auto;
    ${opts.hueShift ? `filter: hue-rotate(${opts.hueShift}deg);` : ''}
  `;
  wrapper.appendChild(pixel);

  container.innerHTML = '';
  container.appendChild(wrapper);
}

export function getSpriteNames() {
  return Object.keys(SPRITES);
}

/**
 * Render a hat sprite anchored to the top-center of an already-rendered bud.
 * Mounts as an absolutely positioned child of the bud-sprite's wrapper so it
 * inherits all bud animations (idle bounce, hit, etc.).
 *
 * @param {HTMLElement} budContainer  The element you previously passed to renderSprite()
 * @param {string}      hatName       e.g. 'hat_baseball'
 * @param {number}      [scale=PX]    must match the bud scale you used
 */
export function renderHat(budContainer, hatName, scale = PX) {
  if (!budContainer || !hatName) return;
  const budWrap = budContainer.querySelector('.pixel-sprite-wrap');
  if (!budWrap) return;

  // Remove any previous hat
  budWrap.querySelectorAll('.pixel-hat-wrap').forEach(el => el.remove());

  const data = SPRITES[hatName];
  if (!data) return;

  const hatRows = data.length;
  const hatCols = Math.max(...data.map(r => r.length));

  const shadows = [];
  for (let y = 0; y < hatRows; y++) {
    for (let x = 0; x < data[y].length; x++) {
      const c = data[y][x];
      if (c) shadows.push(`${x * scale}px ${y * scale}px 0 0 ${c}`);
    }
  }

  // Bud wrapper is positioned relative; we make the hat absolute inside.
  if (getComputedStyle(budWrap).position === 'static') {
    budWrap.style.position = 'relative';
  }

  const hatWrap = document.createElement('div');
  hatWrap.className = 'pixel-hat-wrap';
  const hatPx = document.createElement('div');
  hatPx.className = 'pixel-sprite';
  hatPx.style.cssText = `
    width: ${scale}px;
    height: ${scale}px;
    box-shadow: ${shadows.join(',')};
  `;
  hatWrap.appendChild(hatPx);

  // The bud's pixels sit inside the wrapper offset by `margin: scale` (so
  // the sprite's first painted row lives at y = scale within the wrapper).
  // We want the hat's BOTTOM row to overlap that first row by ~1 pixel so
  // it visually sits ON the head instead of floating above it.
  //
  // Wrapper width = (cols + 1) * scale → so logical cols = (width / scale) - 1.
  const budCols = parseInt(budWrap.style.width, 10) / scale - 1;
  const hatLeftPx = ((budCols - hatCols) / 2 + 0.5) * scale;
  const hatTopPx  = (2 - hatRows) * scale;   // overlap last row with bud's first painted row

  hatWrap.style.cssText = `
    position: absolute;
    left: ${hatLeftPx}px;
    top: ${hatTopPx}px;
    width: ${hatCols * scale}px;
    height: ${hatRows * scale}px;
    pointer-events: none;
    image-rendering: pixelated;
    z-index: 5;
  `;

  budWrap.appendChild(hatWrap);
}

/** Remove any hat from a previously-rendered bud. */
export function removeHat(budContainer) {
  budContainer?.querySelectorAll('.pixel-hat-wrap').forEach(el => el.remove());
}
