/**
 * CannaGotchi — Crossbreeding
 *
 * Take TWO of your plots' Cannabuds, send them to a 24-hour gestation, and
 * receive an OFFSPRING that:
 *   • Type    — 50/50 from either parent
 *   • Variant — picks one of the two parents' variants
 *   • Trait   — picks one parent's trait, with a 5% chance to MUTATE into a
 *               brand-new "MYTHIC" trait that's only obtainable this way
 *   • Stats   — inherits the higher parent's monsterType base; gets a small
 *               (+5%) boost on its strongest stat
 *   • Name    — auto-suggested as a portmanteau, but the user can rename
 *
 * Restrictions:
 *   • Both parents must be Lv.15+ (ensures the player has invested in them)
 *   • You can only run one gestation at a time per account
 *   • Gestation runs in real time — the offspring is "ready" 24h after the
 *     start. The player can speed it up with Seeds (5 🌱 to skip).
 *   • The two parents are NOT consumed — they remain in their plots.
 *
 * Storage shape:
 *   gameState.breeding = {
 *     active: null | {
 *       parentA, parentB,            — minimal snapshots {type, variant, trait, name, level}
 *       startedAt, readyAt,
 *       offspring: { type, variant, trait, name, mythic, statBoost }
 *     },
 *     totalCrossbreeds: 0,
 *     mythicCount: 0,
 *   }
 *
 * Gameplay surfacing:
 *   • New "Lab" card on the Quests tab when player has 2+ buds at Lv.15+
 *   • A toast + memory wall entry when offspring is ready
 *   • Once claimed, the offspring becomes a new Cannabud the player can
 *     plant in any open plot.
 */

import { MONSTER_TYPES, getVariant } from './monsters.js';
import { TRAITS, TRAIT_LIST } from './traits.js';

// Mythic traits — only obtainable through breeding mutations.
export const MYTHIC_TRAITS = {
  ascendant:  { id: 'ascendant',  name: 'Ascendant',  emoji: '🌟', desc: '+15% all stats',
                mods: { hpMult: 1.15, atkMult: 1.15, defMult: 1.15, spdMult: 1.15 }, mythic: true },
  void_kissed:{ id: 'void_kissed',name: 'Void-Kissed',emoji: '🕳️', desc: '+10% crit, immune to confusion + spd_down',
                mods: { critBonus: 0.10, confuseImmune: true, spdLockImmune: true }, mythic: true },
  primordial: { id: 'primordial', name: 'Primordial', emoji: '🦴', desc: '+25% HP, heal 6%/turn while ≥40% HP',
                mods: { hpMult: 1.25, regenAbove: 0.06 }, mythic: true },
  starborn:   { id: 'starborn',   name: 'Starborn',   emoji: '✨', desc: 'Status moves last +2 turns, +5% crit',
                mods: { statusBonus: 2, critBonus: 0.05 }, mythic: true },
  empyrean:   { id: 'empyrean',   name: 'Empyrean',   emoji: '🪽', desc: '12% dodge, +20% Bud rewards',
                mods: { dodgeChance: 0.12, budRewardMult: 1.20 }, mythic: true },
};

// Make mythic traits resolvable through getTrait() — register on global so
// the trait-system can look them up without a circular import.
const MYTHIC_LIST = Object.values(MYTHIC_TRAITS);
if (typeof window !== 'undefined') {
  window.__cgMythicTraits = MYTHIC_TRAITS;
}

/** Augmented trait lookup that knows about mythic traits too. */
export function getAnyTrait(id) {
  return MYTHIC_TRAITS[id] || TRAITS[id] || null;
}

const GESTATION_HOURS = 24;
const MYTHIC_MUTATION_CHANCE = 0.05;

/** True if the player has at least two Lv.15+ buds across their plots. */
export function canBreed(gameState) {
  const live = collectLivingBuds(gameState);
  return live.filter(b => (b.level ?? 1) >= 15).length >= 2;
}

/** Already gestating? */
export function isBreeding(gameState) {
  return !!gameState?.breeding?.active;
}

/** True if the active gestation has finished. */
export function isOffspringReady(gameState) {
  const a = gameState?.breeding?.active;
  if (!a) return false;
  return Date.now() >= a.readyAt;
}

export function getBreedingProgress(gameState) {
  const a = gameState?.breeding?.active;
  if (!a) return null;
  const total = a.readyAt - a.startedAt;
  const passed = Math.min(total, Date.now() - a.startedAt);
  return { pct: total > 0 ? passed / total : 1, msLeft: Math.max(0, a.readyAt - Date.now()) };
}

/** List of (plotId → bud snapshot) eligible for breeding. */
export function collectLivingBuds(gameState) {
  const out = [];
  const active = gameState?.activePlotId || 'plot_1';
  const addFrom = (pid, src) => {
    if (!src || !src.monsterType) return;
    const lvl = computeLevelFromXP(src.xp || 0);
    out.push({ plotId: pid, name: src.monsterName, type: src.monsterType, variant: src.monsterVariant || 'classic', trait: src.trait, level: lvl });
  };
  addFrom(active, gameState);
  if (gameState?.plots) {
    for (const pid of Object.keys(gameState.plots)) {
      if (pid === active) continue;
      addFrom(pid, gameState.plots[pid]);
    }
  }
  return out;
}

/** Lift the level fn here without circular import gymnastics. */
function computeLevelFromXP(xp) {
  return Math.max(1, Math.floor(8.5 * Math.log(xp + 10) - 15));
}

/** Begin gestation. Returns the new offspring blueprint (so UI can preview). */
export function startBreeding(gameState, parentAPlotId, parentBPlotId) {
  if (isBreeding(gameState)) return { ok: false, reason: 'already' };
  if (parentAPlotId === parentBPlotId) return { ok: false, reason: 'same_plot' };
  const all = collectLivingBuds(gameState);
  const a = all.find(b => b.plotId === parentAPlotId);
  const b = all.find(b => b.plotId === parentBPlotId);
  if (!a || !b) return { ok: false, reason: 'missing' };
  if (a.level < 15 || b.level < 15) return { ok: false, reason: 'too_young' };

  const offspring = rollOffspring(a, b);
  if (!gameState.breeding) gameState.breeding = { active: null, totalCrossbreeds: 0, mythicCount: 0 };
  gameState.breeding.active = {
    parentA: a, parentB: b,
    startedAt: Date.now(),
    readyAt:   Date.now() + GESTATION_HOURS * 60 * 60 * 1000,
    offspring,
  };
  return { ok: true, offspring };
}

/** Speed up active gestation by spending Seeds. */
export function skipBreedingWithSeeds(gameState, cost = 5) {
  if (!isBreeding(gameState)) return { ok: false, reason: 'none' };
  if ((gameState.seeds || 0) < cost) return { ok: false, reason: 'broke', cost };
  gameState.seeds -= cost;
  gameState.breeding.active.readyAt = Date.now();
  return { ok: true };
}

/** Claim the offspring — returns the chosen blueprint, or null if not ready. */
export function claimOffspring(gameState) {
  if (!isOffspringReady(gameState)) return null;
  const a = gameState.breeding.active;
  gameState.breeding.totalCrossbreeds = (gameState.breeding.totalCrossbreeds || 0) + 1;
  if (a.offspring?.mythic) {
    gameState.breeding.mythicCount = (gameState.breeding.mythicCount || 0) + 1;
  }
  gameState.breeding.active = null;
  return a.offspring;
}

/** Cancel an active gestation (no refund). */
export function cancelBreeding(gameState) {
  if (gameState.breeding) gameState.breeding.active = null;
}

// ── Offspring generation ─────────────────────────────────────
function rollOffspring(a, b) {
  const type    = Math.random() < 0.5 ? a.type : b.type;
  // Variant inherits from the parent of the same type, else random of the two
  const variantPool = [a, b].filter(p => p.type === type).map(p => p.variant);
  const variant = variantPool.length ? variantPool[Math.floor(Math.random() * variantPool.length)] : a.variant;

  // Trait roll
  const mythic = Math.random() < MYTHIC_MUTATION_CHANCE;
  let trait;
  if (mythic) {
    const m = MYTHIC_LIST[Math.floor(Math.random() * MYTHIC_LIST.length)];
    trait = m.id;
  } else {
    // 50/50 from parents
    trait = Math.random() < 0.5 ? a.trait : b.trait;
    if (!trait || !TRAITS[trait]) {
      // Fallback to a fresh roll if a parent's trait was empty
      trait = TRAIT_LIST[Math.floor(Math.random() * TRAIT_LIST.length)].id;
    }
  }

  const name = portmanteau(a.name, b.name);
  return { type, variant, trait, name, mythic };
}

function portmanteau(n1, n2) {
  if (!n1) return n2 || 'Lil Bud';
  if (!n2) return n1;
  const half1 = n1.slice(0, Math.max(2, Math.floor(n1.length / 2)));
  const half2 = n2.slice(Math.floor(n2.length / 2));
  const candidate = (half1 + half2).slice(0, 16);
  // Capitalize, strip any clearly bad chars
  return candidate.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/^./, c => c.toUpperCase()) || 'Lil Bud';
}
