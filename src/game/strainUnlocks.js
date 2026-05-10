/**
 * CannaGotchi — Strain-specific Cannabud Unlocks
 *
 * Discovering a strain in Pick For Me grants a *tied* cosmetic in the game:
 *
 *   • A "Strain Skin" — a per-strain palette tint applied as an alternate
 *     variant. Players see them in their Garden tab as a new look they can
 *     apply to their bud at any time.
 *   • For headline strains we tie a known hat (e.g. Gelato → Chef's Hat,
 *     Wedding Cake → Chef's Hat too).
 *
 * Every strain unlocks SOMETHING — even if the strain isn't headline-mapped
 * we generate a palette tint deterministically from its id+type so it always
 * feels personal. Discovering all strains becomes a real collection chase.
 *
 * State:
 *   gameState.strainSkinsOwned = { [strainId]: true }
 *   gameState.activeStrainSkin = strainId | null   (selected for current bud)
 */

const HEADLINE_HAT_MAP = {
  'gelato':            'hat_chefs',
  'wedding-cake':      'hat_chefs',
  'cookies-thin-mint': 'hat_chefs',
  'gsc-thin-mint':     'hat_chefs',
  'sour-diesel':       'hat_shades',
  'lemon-haze':        'hat_shades',
  'super-lemon-haze':  'hat_shades',
  'purple-haze':       'hat_top',
  'granddaddy-purple': 'hat_top',
  'pineapple-express': 'hat_party',
  'wedding-crasher':   'hat_party',
  'jealousy':          'hat_top',
  'banana-kush':       'hat_party',
  'maui-wowie':        'hat_party',
  'jack-herer':        'hat_grad',
  'durban-poison':     'hat_grad',
  'green-crack':       'hat_baseball',
  'bruce-banner':      'hat_battle_helm', // reach goal
  'king-louis':        'hat_crown',
  'platinum-og':       'hat_crown',
  'amnesia-haze':      'hat_grad',
  'cherry-pie':        'hat_chefs',
  'strawberry-cough':  'hat_rose',
  'london-pound-cake': 'hat_chefs',
  'apple-fritter':     'hat_chefs',
  'forbidden-fruit':   'hat_rose',
  'biscotti':          'hat_chefs',
  'larry-og':          'hat_baseball',
  'headband':          'hat_bandana',
};

/** Hash a strain id into a deterministic hue degree [-180, 180]. */
function strainToHue(strainId) {
  let h = 0;
  for (let i = 0; i < strainId.length; i++) h = (h * 31 + strainId.charCodeAt(i)) >>> 0;
  return ((h % 360) - 180);
}

/**
 * Build a palette remap for a strain. We hue-shift the type's signature greens
 * and purples, producing a colorway that's unique to that strain.
 */
export function strainSkinPalette(strain) {
  if (!strain?.id) return null;
  const hue = strainToHue(strain.id);
  // We can't compute hue rotation per-pixel via box-shadow, so we
  // alternate among a handful of pre-curated palette swaps based on the hash.
  // This keeps things deterministic + visually distinct.
  const SCHEMES = [
    null,                                          // classic
    { '#a78bfa': '#fca5a5', '#7c3aed': '#dc2626', '#c084fc': '#fcd34d',
      '#4a3660': '#7f1d1d', '#6d28d9': '#991b1b' },                       // crimson
    { '#a78bfa': '#71717a', '#7c3aed': '#27272a', '#c084fc': '#a1a1aa',
      '#4a3660': '#18181b', '#6d28d9': '#3f3f46' },                       // onyx
    { '#4ade80': '#facc15', '#22c55e': '#ca8a04', '#86efac': '#fde047',
      '#a3e635': '#fef08a' },                                              // lemon
    { '#4ade80': '#38bdf8', '#22c55e': '#0284c7', '#86efac': '#bae6fd',
      '#a3e635': '#7dd3fc' },                                              // sky
    { '#4ade80': '#ec4899', '#22c55e': '#a855f7', '#86efac': '#f472b6' }, // pink
    { '#4ade80': '#06b6d4', '#22c55e': '#0891b2', '#86efac': '#67e8f9' }, // teal
    { '#4ade80': '#f97316', '#22c55e': '#c2410c', '#86efac': '#fb923c' }, // orange
  ];
  const idx = Math.abs(hue) % SCHEMES.length;
  return SCHEMES[idx];
}

/** Headline hat unlock for a strain (or null). */
export function strainHatId(strain) {
  return strain?.id ? HEADLINE_HAT_MAP[strain.id] || null : null;
}

/**
 * Called when a strain is discovered (first time seen via Pick For Me).
 * Mutates gameState. Returns a list of unlock descriptors for UI toasts.
 */
export function recordStrainDiscovery(gameState, strain) {
  if (!strain?.id) return [];
  const owned = gameState.strainSkinsOwned || (gameState.strainSkinsOwned = {});
  if (owned[strain.id]) return [];
  owned[strain.id] = true;

  const unlocks = [];
  // Always grant the palette skin
  unlocks.push({
    kind: 'skin',
    strainId: strain.id,
    strainName: strain.name,
  });
  // Bonus hat (one-time) if this strain has a headline mapping
  const hatId = strainHatId(strain);
  if (hatId) {
    if (!gameState.cosmetics) gameState.cosmetics = { owned: {}, equipped: {} };
    if (!gameState.cosmetics.owned[hatId]) {
      gameState.cosmetics.owned[hatId] = true;
      unlocks.push({ kind: 'hat', hatId, strainName: strain.name });
    }
  }
  return unlocks;
}

/** Apply a previously-unlocked strain skin to the active bud. */
export function applyStrainSkin(gameState, strainId) {
  if (!gameState.strainSkinsOwned?.[strainId] && strainId !== null) return false;
  gameState.activeStrainSkin = strainId;
  return true;
}

/** Resolve the active palette remap from strainSkinsOwned + activeStrainSkin. */
export function resolveStrainSkinRemap(gameState, strainsById) {
  if (!gameState?.activeStrainSkin) return null;
  const strain = strainsById?.[gameState.activeStrainSkin];
  if (!strain) return null;
  return strainSkinPalette(strain);
}
