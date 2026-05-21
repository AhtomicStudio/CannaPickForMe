/**
 * CannaGotchi — Battle Engine
 *
 * Pure, deterministic, turn-based combat. No DOM. No globals. No randomness
 * that isn't seeded. This is intentional so the same engine can run:
 *
 *   1. Locally — Player vs AI (default).
 *   2. Locally — Player vs Player (same device).
 *   3. Remote   — Player vs Player over Bluetooth LE / WebRTC / QR.
 *
 * For remote play both peers run this engine on identical state with the
 * same RNG seed and exchange only PlayerActions. Either side can verify
 * the other by re-running the resulting state from a known checkpoint.
 *
 * Public surface
 * ──────────────
 *   createBattle({ player, opponent, seed })  → BattleState
 *   submitAction(state, side, action)         → { state, log[] }
 *   pickAIAction(state, side)                 → action
 *   isOver(state)                             → 'player' | 'opponent' | null
 *
 * BattleState shape (fully serializable):
 *   {
 *     turn: number,
 *     seed: number,
 *     rngCount: number,
 *     player:   CombatantRuntime,
 *     opponent: CombatantRuntime,
 *     log: string[],
 *     winner: 'player' | 'opponent' | null,
 *   }
 *
 * CombatantRuntime:
 *   { ...combatant, hp, hpMax, atk, def, spd,
 *     buffs: { atk: 0, def: 0, spd: 0 },     // turn counters
 *     buffMods: { atk: 1, def: 1, spd: 1 },  // current multipliers
 *     statuses: { confused: 0 },             // turn counters
 *   }
 */

import { BATTLE } from './economyConfig.js';
import { getTrait } from './traits.js';
import { MOVES_BY_TYPE } from './moves.js';
import { rollEnvironment, getEnvironment } from './environments.js';
import { flavorLineFor } from './encounterFlavor.js';

// Build a move-id → monster-type reverse map for accurate STAB calculation.
// Parsing move IDs was brittle; this is authoritative and future-proof.
const MOVE_TYPE_MAP = new Map();
for (const [monType, moves] of Object.entries(MOVES_BY_TYPE)) {
  for (const m of moves) MOVE_TYPE_MAP.set(m.id, monType);
}

// ── Mulberry32: tiny seeded RNG so battles are reproducible ────────────
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rng(state) {
  state.rngCount = (state.rngCount || 0) + 1;
  return makeRng(state.seed + state.rngCount * 31)();
}

function rand(state, min, max) {
  return min + rng(state) * (max - min);
}

// ── Convert an Encounter/Combatant snapshot to runtime ─────────────────
function hydrateCombatant(c) {
  // baseStats already has level scaling applied (encounters.js / makePlayerCombatant
  // call getStats with level + statGrowth). Trait modifiers apply on top.
  const trait = getTrait(c.trait);
  const m = trait?.mods || {};

  // Resolve evolution-path mods for in-battle effects (critBonus, varianceBoost).
  // Stat mods (hp/atk/def/spd) are already baked into baseStats by encounters.js,
  // so we only need the combat-behaviour mods here.
  let pathMods = {};
  if (c.evolutionPath && typeof window !== 'undefined') {
    try {
      const path = window.__cgEvolutionPaths?.getPath(c.type, c.evolutionPath);
      if (path) pathMods = path.mods || {};
    } catch (_) {}
  }

  const hpMax = Math.floor(c.baseStats.hp  * (m.hpMult  ?? 1));
  const atk   = Math.floor(c.baseStats.atk * (m.atkMult ?? 1));
  const def   = Math.floor(c.baseStats.def * (m.defMult ?? 1));
  const spd   = Math.floor(c.baseStats.spd * (m.spdMult ?? 1));
  return {
    ...c,
    hpMax,
    hp: hpMax,
    atk, def, spd,
    buffs:    { atk: 0, def: 0, spd: 0 },
    buffMods: { atk: 1, def: 1, spd: 1 },
    statuses: { confused: 0 },
    traitMods: m,    // exposed so applyMove etc. can read crit/dodge/regen
    pathMods,        // evolution-path combat mods (critBonus, varianceBoost)
  };
}

export function createBattle({ player, opponent, seed = Date.now(), envId }) {
  const env = rollEnvironment(envId);
  const log = [flavorLineFor(opponent), `${env.emoji} ${env.name} — ${env.desc}`];
  return {
    turn: 1,
    seed,
    rngCount: 0,
    player:   hydrateCombatant(player),
    opponent: hydrateCombatant(opponent),
    env: env ? { id: env.id, name: env.name, emoji: env.emoji, bgClass: env.bgClass, desc: env.desc } : null,
    envMods: env ? {
      dmgMult: env.dmgMult || {},
      critBonus: env.critBonus || 0,
      regenPerTurn: env.regenPerTurn || 0,
      varianceClamp: env.varianceClamp || 0,
    } : null,
    log,
    winner: null,
  };
}

// ── Action submission ─────────────────────────────────────────────────
//
//   action: { kind: 'move',   moveId } | { kind: 'item',   itemId }
//         | { kind: 'flee' }
//
// We resolve one full round: both sides act, faster goes first, end-of-turn
// effects tick down. Returns { state, events[] } where events are atomic UI
// hints (animations, floaters, log lines).

export function submitRound(state, playerAction, opponentAction) {
  if (state.winner) return { state, events: [] };
  const events = [];

  // Record the player's last action so the Advanced AI can read it next turn.
  if (playerAction?.kind === 'move') {
    const move = state.player.moves?.find(m => m.id === playerAction.moveId);
    state._lastFoeAction = { kind: 'move', moveId: playerAction.moveId, effect: move?.effect ?? null };
  } else {
    state._lastFoeAction = playerAction ?? null;
  }

  // Determine order — higher SPD first; ties broken by RNG.
  const pSpd = state.player.spd   * state.player.buffMods.spd;
  const oSpd = state.opponent.spd * state.opponent.buffMods.spd;
  let order;
  if      (pSpd > oSpd) order = ['player', 'opponent'];
  else if (oSpd > pSpd) order = ['opponent', 'player'];
  else                  order = rng(state) < 0.5 ? ['player', 'opponent'] : ['opponent', 'player'];

  const actions = { player: playerAction, opponent: opponentAction };

  for (const side of order) {
    if (state.winner) break;
    const events2 = applyAction(state, side, actions[side]);
    events.push(...events2);
    checkKO(state, events);
  }
  if (!state.winner) {
    tickEndOfTurn(state, events);
    state.turn++;
  }

  return { state, events };
}

function applyAction(state, side, action) {
  const events = [];
  const me  = state[side];
  const foe = state[side === 'player' ? 'opponent' : 'player'];

  if (!action) action = { kind: 'move', moveId: me.moves?.[0]?.id };

  // Confusion check — 40% chance to hurt yourself instead.
  if (me.statuses.confused > 0 && rng(state) < 0.40) {
    const dmg = Math.max(1, Math.floor(me.atk * 0.45));
    me.hp = Math.max(0, me.hp - dmg);
    events.push({ kind: 'hurt-self', side, dmg, msg: `${me.name} is confused — hurt itself for ${dmg}!` });
    state.log.push(`💫 ${me.name} hit itself in confusion (${dmg}).`);
    return events;
  }

  if (action.kind === 'flee' && side === 'player') {
    state.log.push('🏃 You fled!');
    state.winner = 'opponent';
    events.push({ kind: 'flee', side });
    return events;
  }

  if (action.kind === 'item') {
    state.log.push(`🧪 ${me.name} used an item.`);
    events.push({ kind: 'item-used', side, itemId: action.itemId });
    return events;
  }

  if (action.kind === 'move') {
    const move = me.moves.find(m => m.id === action.moveId) || me.moves[0];
    if (!move) return events;
    return applyMove(state, side, move);
  }

  return events;
}

function applyMove(state, side, move) {
  const events = [];
  const me  = state[side];
  const foe = state[side === 'player' ? 'opponent' : 'player'];

  state.log.push(`${move.emoji ?? '⚔️'} ${me.name} used ${move.name}!`);
  events.push({ kind: 'move-used', side, move });

  // Status / buff moves
  if (move.power === 0 || move.type === 'status') {
    applyEffect(state, side, move.effect, events);
    return events;
  }

  // Damage formula:
  //   base = power * (atk * buffAtk) / (def * buffDef)
  //   * STAB (same-type attack)
  //   * randomness (BATTLE.RAND_MIN..RAND_MAX)
  //   * crit (BATTLE.CRIT_MULTIPLIER)
  const atkEff = me.atk  * me.buffMods.atk;
  const defEff = Math.max(1, foe.def * foe.buffMods.def);
  const stab   = (me.type === foeMoveOriginType(move)) ? BATTLE.STAB_MULTIPLIER : 1.0;
  // Dodge (foe trait) — slip the attack entirely.
  const dodgeChance = foe.traitMods?.dodgeChance ?? 0;
  if (dodgeChance > 0 && rng(state) < dodgeChance) {
    state.log.push(`💨 ${foe.name} slipped the attack!`);
    events.push({ kind: 'dodge', side: side === 'player' ? 'opponent' : 'player' });
    return events;
  }

  // Variance — environments can clamp it (e.g. Basement = ±7% only).
  // Wild evolution path expands it (+0.05 each direction → ±20%).
  const clamp    = state.envMods?.varianceClamp ?? 0;
  const varBoost = !clamp ? (me.pathMods?.varianceBoost ?? 0) : 0;
  const lo = clamp ? (1 - clamp) : (BATTLE.RAND_MIN - varBoost);
  const hi = clamp ? (1 + clamp) : (BATTLE.RAND_MAX + varBoost);
  const variance = rand(state, lo, hi);
  // Crit bonus stacks: trait + evolution path + environment
  const critBonus = (me.traitMods?.critBonus ?? 0) + (me.pathMods?.critBonus ?? 0) + (state.envMods?.critBonus ?? 0);
  const crit   = rng(state) < (BATTLE.CRIT_CHANCE_BASE + critBonus) ? BATTLE.CRIT_MULTIPLIER : 1.0;
  // Environment damage tilt for the attacker's strain type.
  const envTypeMult = state.envMods?.dmgMult?.[me.type] ?? 1.0;

  // Confused targets are off-balance — they take +20% damage when struck.
  const confusedMult = (foe.statuses?.confused > 0) ? 1.20 : 1.0;

  let dmg = (move.power * (atkEff / defEff)) * stab * variance * crit * confusedMult * envTypeMult;
  dmg = Math.max(1, Math.floor(dmg));

  foe.hp = Math.max(0, foe.hp - dmg);
  state.log.push(`💥 ${foe.name} took ${dmg}${crit > 1 ? ' (CRIT!)' : ''}.`);
  events.push({ kind: 'damage', side, foeSide: side === 'player' ? 'opponent' : 'player', dmg, crit: crit > 1, move });

  if (move.effect) applyEffect(state, side, move.effect, events);
  return events;
}

function foeMoveOriginType(move) {
  // Use the authoritative MOVE_TYPE_MAP (built from MOVES_BY_TYPE at module load).
  // This is immune to ID-naming surprises and covers every move automatically.
  if (!move?.id) return 'hybrid';
  return MOVE_TYPE_MAP.get(move.id) ?? 'hybrid';
}

function applyEffect(state, side, effect, events) {
  if (!effect) return;
  const me  = state[side];
  const foe = state[side === 'player' ? 'opponent' : 'player'];
  switch (effect) {
    case 'atk_up': {
      const dur = 3 + (me.traitMods?.statusBonus ?? 0);
      me.buffs.atk = dur; me.buffMods.atk = 1.25;
      state.log.push(`📈 ${me.name}'s attack rose!`);
      events.push({ kind: 'buff', side, stat: 'atk', mult: 1.25 });
      break;
    }
    case 'def_up': {
      const dur = 3 + (me.traitMods?.statusBonus ?? 0);
      me.buffs.def = dur; me.buffMods.def = 1.25;
      state.log.push(`🛡️ ${me.name}'s defense rose!`);
      events.push({ kind: 'buff', side, stat: 'def', mult: 1.25 });
      break;
    }
    case 'spd_down':
      if (foe.traitMods?.spdLockImmune) {
        state.log.push(`🍑 ${foe.name} stays unbothered.`);
        break;
      }
      foe.buffs.spd = 2 + (me.traitMods?.statusBonus ?? 0);
      foe.buffMods.spd = 0.75;
      state.log.push(`🐌 ${foe.name}'s speed fell!`);
      events.push({ kind: 'debuff', side: side === 'player' ? 'opponent' : 'player', stat: 'spd', mult: 0.75 });
      break;
    case 'confuse':
      if (foe.traitMods?.confuseImmune) {
        state.log.push(`🧘 ${foe.name} resists the confusion!`);
        break;
      }
      foe.statuses.confused = 3 + (me.traitMods?.statusBonus ?? 0); // duration extended by inflicter's trait/path
      state.log.push(`💫 ${foe.name} got confused!`);
      events.push({ kind: 'status', side: side === 'player' ? 'opponent' : 'player', status: 'confused' });
      break;
    case 'heal_small': {
      const amt = Math.floor(me.hpMax * 0.15);
      me.hp = Math.min(me.hpMax, me.hp + amt);
      state.log.push(`🌿 ${me.name} recovered ${amt} HP.`);
      events.push({ kind: 'heal', side, amt });
      break;
    }
    case 'heal_medium': {
      const amt = Math.floor(me.hpMax * 0.25);
      me.hp = Math.min(me.hpMax, me.hp + amt);
      state.log.push(`🌈 ${me.name} recovered ${amt} HP.`);
      events.push({ kind: 'heal', side, amt });
      break;
    }
  }
}

function tickEndOfTurn(state, events) {
  for (const side of ['player', 'opponent']) {
    const c = state[side];
    for (const stat of ['atk', 'def', 'spd']) {
      if (c.buffs[stat] > 0) {
        c.buffs[stat]--;
        if (c.buffs[stat] <= 0) c.buffMods[stat] = 1;
      }
    }
    if (c.statuses.confused > 0) c.statuses.confused--;

    // Environment — flat regen for everyone (Greenhouse, Humid Tent)
    if (state.envMods?.regenPerTurn && c.hp > 0) {
      const envHeal = Math.max(1, Math.floor(c.hpMax * state.envMods.regenPerTurn));
      const before = c.hp;
      c.hp = Math.min(c.hpMax, c.hp + envHeal);
      if (c.hp > before) {
        events.push({ kind: 'heal', side, amt: c.hp - before });
      }
    }

    // Trait — resinous regen while above 50% HP
    if (c.traitMods?.regenAbove && c.hp / c.hpMax >= 0.5) {
      const heal = Math.max(1, Math.floor(c.hpMax * c.traitMods.regenAbove));
      const before = c.hp;
      c.hp = Math.min(c.hpMax, c.hp + heal);
      if (c.hp > before) {
        state.log.push(`🍯 ${c.name}'s resin self-heals ${c.hp - before} HP.`);
        events.push({ kind: 'heal', side, amt: c.hp - before });
      }
    }
    // Trait — photosynthetic XP-per-turn for the player only
    if (side === 'player' && c.traitMods?.xpPerTurn) {
      state.pendingPlayerXP = (state.pendingPlayerXP || 0) + c.traitMods.xpPerTurn;
    }
  }
}

function checkKO(state, events) {
  if (state.player.hp <= 0 && !state.winner) {
    state.winner = 'opponent';
    state.log.push(`☠️ ${state.player.name} fainted!`);
    events.push({ kind: 'ko', side: 'player' });
  } else if (state.opponent.hp <= 0 && !state.winner) {
    state.winner = 'player';
    state.log.push(`🏆 ${state.opponent.name} was defeated!`);
    events.push({ kind: 'ko', side: 'opponent' });
  }
}

// ── Three-tier AI difficulty ─────────────────────────────────────────
//
// Scales opponent intelligence based on player level:
//   Basic (Lv1–15): original heuristic behaviour
//   Intermediate (Lv16–30): higher heal threshold, reacts to player buffs
//   Advanced (Lv31+): reads player's last move, uses debuffs, exploits weakness

function getAITier(playerLevel) {
  if (playerLevel >= 31) return 'advanced';
  if (playerLevel >= 16) return 'intermediate';
  return 'basic';
}

export function pickAIAction(state, side) {
  const me  = state[side];
  const foe = state[side === 'player' ? 'opponent' : 'player'];
  const moves = me.moves || [];
  if (moves.length === 0) return { kind: 'flee' };

  const playerLevel = state.player?.level || 1;
  const tier = getAITier(playerLevel);

  // ── Basic (Lv1–15): original behaviour ───────────────────────
  if (tier === 'basic') {
    if (me.hp / me.hpMax < 0.35) {
      const heal = moves.find(m => m.effect && m.effect.startsWith('heal_'));
      if (heal && rng(state) < 0.7) return { kind: 'move', moveId: heal.id };
    }
    if (me.buffMods.atk === 1 && me.buffMods.def === 1) {
      const buff = moves.find(m => m.effect === 'atk_up' || m.effect === 'def_up');
      if (buff && rng(state) < 0.35) return { kind: 'move', moveId: buff.id };
    }
    const dmgMoves = moves.filter(m => m.power > 0);
    if (dmgMoves.length === 0) return { kind: 'move', moveId: moves[0].id };
    const scored = dmgMoves.map(m => ({
      m,
      score: m.power * (me.atk / Math.max(1, foe.def)) * (0.85 + rng(state) * 0.30),
    }));
    scored.sort((a, b) => b.score - a.score);
    return { kind: 'move', moveId: scored[0].m.id };
  }

  // ── Intermediate (Lv16–30): raised heal threshold, responds to player buffs ─
  if (tier === 'intermediate') {
    if (me.hp / me.hpMax < 0.50) {
      const heal = moves.find(m => m.effect && m.effect.startsWith('heal_'));
      if (heal && rng(state) < 0.7) return { kind: 'move', moveId: heal.id };
    }
    const playerBoostedAtk = foe.buffMods?.atk > 1;
    if (playerBoostedAtk && me.buffMods.def === 1) {
      const defBuff = moves.find(m => m.effect === 'def_up');
      if (defBuff && rng(state) < 0.65) return { kind: 'move', moveId: defBuff.id };
    }
    if (me.buffMods.atk === 1 && me.buffMods.def === 1) {
      const buff = moves.find(m => m.effect === 'atk_up' || m.effect === 'def_up');
      if (buff && rng(state) < 0.35) return { kind: 'move', moveId: buff.id };
    }
    const dmgMoves = moves.filter(m => m.power > 0);
    if (dmgMoves.length === 0) return { kind: 'move', moveId: moves[0].id };
    const scored = dmgMoves.map(m => ({
      m,
      score: m.power * (me.atk / Math.max(1, foe.def)) * (0.85 + rng(state) * 0.30),
    }));
    scored.sort((a, b) => b.score - a.score);
    const pick = scored.length > 1 && rng(state) < 0.20 ? scored[1] : scored[0];
    return { kind: 'move', moveId: pick.m.id };
  }

  // ── Advanced (Lv31+): reads player's last move, debuffs, exploits weaknesses ─
  if (me.hp / me.hpMax < 0.60) {
    const heal = moves.find(m => m.effect && m.effect.startsWith('heal_'));
    if (heal && rng(state) < 0.75) return { kind: 'move', moveId: heal.id };
  }
  const playerJustBuffed = state._lastFoeAction?.kind === 'move' &&
    (state._lastFoeAction?.effect === 'atk_up' || state._lastFoeAction?.effect === 'def_up');
  if (playerJustBuffed) {
    const dmgMoves = moves.filter(m => m.power > 0);
    if (dmgMoves.length > 0) {
      const best = dmgMoves.reduce((a, b) =>
        (b.power * (me.atk / Math.max(1, foe.def))) > (a.power * (me.atk / Math.max(1, foe.def))) ? b : a
      );
      return { kind: 'move', moveId: best.id };
    }
  }
  const playerJustHealed = state._lastFoeAction?.kind === 'move' &&
    state._lastFoeAction?.effect?.startsWith('heal_');
  if (playerJustHealed) {
    const dmgMoves = moves.filter(m => m.power > 0);
    if (dmgMoves.length > 0) {
      const best = dmgMoves.reduce((a, b) => b.power > a.power ? b : a);
      return { kind: 'move', moveId: best.id };
    }
  }
  if ((foe.hp / foe.hpMax) > 0.70) {
    const debuff = moves.find(m => m.effect === 'atk_down' || m.effect === 'def_down' || m.effect === 'spd_down');
    if (debuff && rng(state) < 0.50) return { kind: 'move', moveId: debuff.id };
  }
  if (me.buffMods.atk === 1 && me.buffMods.def === 1) {
    const buff = moves.find(m => m.effect === 'atk_up' || m.effect === 'def_up');
    if (buff && rng(state) < 0.40) return { kind: 'move', moveId: buff.id };
  }
  const dmgMoves = moves.filter(m => m.power > 0);
  if (dmgMoves.length === 0) return { kind: 'move', moveId: moves[0].id };
  const scored = dmgMoves.map(m => ({
    m,
    score: m.power * (me.atk / Math.max(1, foe.def)) * (0.85 + rng(state) * 0.30),
  }));
  scored.sort((a, b) => b.score - a.score);
  return { kind: 'move', moveId: scored[0].m.id };
}

export function isOver(state) {
  return state.winner;
}

// ── For multiplayer — serialize a state checkpoint ────────────────────
export function snapshot(state) {
  return JSON.parse(JSON.stringify({
    turn: state.turn,
    seed: state.seed,
    rngCount: state.rngCount,
    player:   state.player,
    opponent: state.opponent,
    winner:   state.winner,
  }));
}
