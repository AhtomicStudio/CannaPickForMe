/**
 * CannaGotchi — Cannabud Titles
 *
 * Auto-earned epithets that append to your bud's name based on accomplishments.
 * "Purps" → "Purps the Knockout Kid" once they win 25 battles, etc.
 *
 * Schema: gameState.titles = { earned: { [id]: true }, equippedId: 'id'|null }
 * The user can also manually pick a different earned title to display.
 */

export const TITLES = [
  // Onboarding
  { id: 'sproutling',        label: 'Sproutling',          when: gs => (gs._level ?? 1) >= 5 },
  { id: 'branched',          label: 'the Branching One',   when: gs => (gs._level ?? 1) >= 15 },
  { id: 'flowered',          label: 'the Bloomed',         when: gs => (gs._level ?? 1) >= 30 },
  { id: 'ancient',           label: 'the Ancient',         when: gs => (gs._level ?? 1) >= 50 },

  // Care-led
  { id: 'devoted',           label: 'the Devoted',         when: gs => (gs.lifetime?.totalActions ?? 0) >= 100 },
  { id: 'cultivar_master',   label: 'Cultivar Master',     when: gs => (gs.lifetime?.totalActions ?? 0) >= 1000 },

  // Battle
  { id: 'knockout_kid',      label: 'the Knockout Kid',    when: gs => (gs.wins ?? 0) >= 25 },
  { id: 'champion',          label: 'the Champion',        when: gs => (gs.wins ?? 0) >= 100 },
  { id: 'untouchable',       label: 'the Untouchable',     when: gs => (gs.wins ?? 0) >= 50 && (gs.losses ?? 0) <= 5 },
  { id: 'boss_slayer',       label: 'Boss Slayer',         when: gs => (gs.battle?.bossesDefeated?.length ?? 0) >= 3 },
  { id: 'arena_god',         label: 'Arena God',           when: gs => (gs.battle?.bossesDefeated?.length ?? 0) >= 6 },

  // Discovery
  { id: 'connoisseur',       label: 'the Connoisseur',     when: gs => (gs.lifetime?.strainsDiscovered?.length ?? 0) >= 25 },
  { id: 'living_codex',      label: 'the Living Codex',    when: gs => (gs.lifetime?.strainsDiscovered?.length ?? 0) >= 100 },

  // Wealth
  { id: 'baron',             label: 'Bud Baron',           when: gs => (gs.buds ?? 0) >= 5000 },
  { id: 'tycoon',            label: 'the Tycoon',          when: gs => (gs.lifetime?.itemsBought ?? 0) >= 50 },

  // Prestige
  { id: 'reborn',            label: 'the Reborn',          when: gs => (gs.prestige?.count ?? 0) >= 1 },
  { id: 'eternal',           label: 'the Eternal',         when: gs => (gs.prestige?.count ?? 0) >= 5 },
];

export function checkTitles(gameState) {
  if (!gameState) return [];
  if (!gameState.titles) gameState.titles = { earned: {}, equippedId: null };
  const newly = [];
  for (const t of TITLES) {
    if (gameState.titles.earned[t.id]) continue;
    let ok = false;
    try { ok = !!t.when(gameState); } catch (_) {}
    if (ok) {
      gameState.titles.earned[t.id] = true;
      newly.push(t);
      // First earned title auto-equips
      if (!gameState.titles.equippedId) gameState.titles.equippedId = t.id;
    }
  }
  return newly;
}

export function getEquippedTitle(gameState) {
  const id = gameState?.titles?.equippedId;
  if (!id) return null;
  return TITLES.find(t => t.id === id) || null;
}

export function listEarnedTitles(gameState) {
  const earned = gameState?.titles?.earned || {};
  return TITLES.filter(t => earned[t.id]);
}

export function equipTitle(gameState, id) {
  if (!gameState?.titles?.earned?.[id] && id != null) return false;
  gameState.titles = gameState.titles || { earned: {}, equippedId: null };
  gameState.titles.equippedId = id;
  return true;
}
