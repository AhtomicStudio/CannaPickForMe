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

const SPRITES = { ...INDICA, ...SATIVA, ...HYBRID };

/**
 * Render a named sprite into a container element using box-shadow technique.
 */
export function renderSprite(container, spriteName, scale = PX) {
  const data = SPRITES[spriteName];
  if (!data) { container.innerHTML = '<span style="font-size:3rem">🌱</span>'; return; }

  const shadows = [];
  for (let y = 0; y < data.length; y++) {
    for (let x = 0; x < data[y].length; x++) {
      const color = data[y][x];
      if (color) {
        shadows.push(`${x * scale}px ${y * scale}px 0 0 ${color}`);
      }
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
  `;
  wrapper.appendChild(pixel);

  container.innerHTML = '';
  container.appendChild(wrapper);
}

export function getSpriteNames() {
  return Object.keys(SPRITES);
}
