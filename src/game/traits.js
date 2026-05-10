/**
 * CannaGotchi — Trait / Passive System
 *
 * Every Cannabud (player and wild) is rolled with one trait at creation.
 * Traits are small, never broken — each tilts a couple of stats or
 * gameplay knobs. They show up in fights and on the bud's profile card.
 *
 * The trait is a frozen ID + a few numeric modifiers; battle.js applies
 * them at hydration time, gameScreen.js displays them in the Garden tab.
 */

export const TRAITS = {
  // ── Stat tilts ──
  dense:   { id: 'dense',   name: 'Dense',          emoji: '🪨', desc: '+10% DEF, -5% SPD',
              mods: { defMult: 1.10, spdMult: 0.95 } },
  twitchy: { id: 'twitchy', name: 'Twitchy',        emoji: '⚡', desc: '+15% SPD, -5% HP',
              mods: { spdMult: 1.15, hpMult: 0.95 } },
  hearty:  { id: 'hearty',  name: 'Hearty',         emoji: '💖', desc: '+12% HP, -8% ATK',
              mods: { hpMult: 1.12, atkMult: 0.92 } },
  sharp:   { id: 'sharp',   name: 'Sharp',          emoji: '🔪', desc: '+10% ATK',
              mods: { atkMult: 1.10 } },
  balanced:{ id: 'balanced',name: 'Balanced',       emoji: '⚖️', desc: '+5% all stats',
              mods: { hpMult: 1.05, atkMult: 1.05, defMult: 1.05, spdMult: 1.05 } },

  // ── Crit/dodge ──
  crystalline:{ id: 'crystalline', name: 'Crystalline', emoji: '💎', desc: '+5% crit chance',
                mods: { critBonus: 0.05 } },
  slippery:   { id: 'slippery',    name: 'Slippery',    emoji: '🌬️', desc: '8% chance to dodge attacks',
                mods: { dodgeChance: 0.08 } },
  lucky:      { id: 'lucky',       name: 'Lucky',       emoji: '🍀', desc: '+3% crit, +3% dodge',
                mods: { critBonus: 0.03, dodgeChance: 0.03 } },

  // ── Status tilts ──
  pungent:   { id: 'pungent',   name: 'Pungent',   emoji: '👃', desc: 'Status moves last +1 turn',
              mods: { statusBonus: 1 } },
  resinous:  { id: 'resinous',  name: 'Resinous',  emoji: '🍯', desc: 'Heal 4% max HP per turn while ≥50% HP',
              mods: { regenAbove: 0.04 } },
  zen:       { id: 'zen',       name: 'Zen',       emoji: '🧘', desc: 'Immune to confusion',
              mods: { confuseImmune: true } },
  thicc:     { id: 'thicc',     name: 'Thicc',     emoji: '🍑', desc: 'Immune to spd_down',
              mods: { spdLockImmune: true } },

  // ── Quirky ──
  photosynthetic: { id: 'photosynthetic', name: 'Photosynthetic', emoji: '☀️', desc: 'Gain 4 XP per turn in battle',
                    mods: { xpPerTurn: 4 } },
  greedy:         { id: 'greedy',         name: 'Greedy',         emoji: '🪙', desc: '+15% Buds from battles',
                    mods: { budRewardMult: 1.15 } },
  evergreen:      { id: 'evergreen',      name: 'Evergreen',      emoji: '🌲', desc: 'Needs decay 10% slower',
                    mods: { decayMult: 0.90 } },
};

export const TRAIT_LIST = Object.values(TRAITS);

/** Roll a random trait. Used at Cannabud creation and for wild encounters. */
export function rollTrait() {
  return TRAIT_LIST[Math.floor(Math.random() * TRAIT_LIST.length)].id;
}

export function getTrait(id) {
  if (TRAITS[id]) return TRAITS[id];
  // Mythic traits (from breeding) live in breeding.js to avoid a circular dep.
  // Lazy-resolve via a window-globally-cached lookup if it's been registered.
  if (typeof window !== 'undefined' && window.__cgMythicTraits?.[id]) {
    return window.__cgMythicTraits[id];
  }
  return null;
}

/** Apply trait stat multipliers to a base stat block. */
export function applyTraitToStats(stats, traitId) {
  const t = getTrait(traitId);
  if (!t) return stats;
  const m = t.mods;
  return {
    hp:  Math.floor(stats.hp  * (m.hpMult  ?? 1)),
    atk: Math.floor(stats.atk * (m.atkMult ?? 1)),
    def: Math.floor(stats.def * (m.defMult ?? 1)),
    spd: Math.floor(stats.spd * (m.spdMult ?? 1)),
  };
}

/** Format trait for display: "💎 Crystalline — +5% crit". */
export function describeTrait(id) {
  const t = getTrait(id);
  if (!t) return '';
  return `${t.emoji} ${t.name} — ${t.desc}`;
}
