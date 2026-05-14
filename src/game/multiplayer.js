/**
 * CannaGotchi — Multiplayer Versus
 *
 * Transport-agnostic peer protocol so the same engine + UI can run vs:
 *   • LOCAL  — hot-seat on one device. Implemented today.
 *   • BLE    — Capacitor BLE on iOS/Android. Stubbed; ready to wire.
 *   • WEB-BT — Web Bluetooth (Chrome/Edge desktop). Stubbed.
 *   • QR     — show a QR with our Cannabud snapshot, opponent scans, both
 *              sides run the deterministic engine locally with the same
 *              seed. Stubbed; uses the same protocol below.
 *
 * Protocol (every transport sends/receives these JSON messages):
 *
 *   { type: 'hello',  payload: <CombatantSnapshot>, seed: number }
 *      → both peers exchange Cannabud snapshots. The connecting peer
 *        chooses the seed; the other accepts it.
 *
 *   { type: 'action', payload: <PlayerAction>, turn: number }
 *      → each peer locally picks its move; resolves the round once
 *        both actions arrived. Opponent action is authoritative for
 *        what the other peer did.
 *
 *   { type: 'sync',   payload: <BattleSnapshot>, turn: number }
 *      → optional state checkpoint. If snapshots disagree, the round
 *        is forfeited as a desync (rare with deterministic engine).
 *
 *   { type: 'bye' } → graceful disconnect.
 *
 * NOTE on Bluetooth: the actual BLE implementation lives in `mpBleAdapter`
 * (Capacitor) and `mpWebBleAdapter` (Web Bluetooth). Both stubs throw
 * 'NOT_IMPLEMENTED' for now. The local adapter works end-to-end.
 */

import { createBattle, submitRound, pickAIAction } from './battle.js';
import { makePlayerCombatant } from './encounters.js';
import { emit } from './eventBus.js';

// ── Capability detection ─────────────────────────────────────
export function detectTransports() {
  const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
  const platform    = isCapacitor ? (window.Capacitor.getPlatform?.() || 'web') : 'web';
  const hasWebBT    = typeof navigator !== 'undefined' && !!navigator.bluetooth;
  return {
    local:    true,
    capBle:   isCapacitor && (platform === 'ios' || platform === 'android'),
    webBle:   hasWebBT,
    qr:       true,    // QR battle exchange always works
    platform,
  };
}

// ── Transport interface ──────────────────────────────────────
//
// A Transport is just:
//   { open({ role: 'host'|'guest' }), send(msg), onMessage(fn), close(), describe }
//
// The shell that turns it into a battle session is `createSession()`.

export function createSession({ transport, mySnapshot, role }) {
  let opponentSnapshot = null;
  let battle = null;
  let myAction = null, theirAction = null;
  let listeners = { state: [], end: [] };

  const isHost = role === 'host';
  const seed = isHost ? Math.floor(Math.random() * 0xFFFFFFFF) : null;
  let agreedSeed = seed;

  function on(event, fn) { listeners[event]?.push(fn); }
  function emitLocal(event, payload) { (listeners[event] || []).forEach(fn => fn(payload)); }

  transport.onMessage((msg) => {
    switch (msg.type) {
      case 'hello':
        opponentSnapshot = msg.payload;
        if (!isHost && msg.seed) agreedSeed = msg.seed;
        if (mySnapshot && opponentSnapshot && agreedSeed != null && !battle) {
          startBattle();
        }
        break;
      case 'action':
        theirAction = msg.payload;
        maybeResolve();
        break;
      case 'bye':
        end('opponent-left');
        break;
    }
  });

  // Send hello with our Cannabud snapshot and (host-only) seed.
  transport.send({ type: 'hello', payload: mySnapshot, seed: isHost ? seed : undefined });

  function startBattle() {
    battle = createBattle({
      player:   isHost ? mySnapshot : opponentSnapshot, // P1 always = host
      opponent: isHost ? opponentSnapshot : mySnapshot,
      seed: agreedSeed,
    });
    emitLocal('state', { phase: 'started', battle });
  }

  function chooseAction(action) {
    if (!battle || battle.winner) return;
    myAction = action;
    transport.send({ type: 'action', payload: action, turn: battle.turn });
    maybeResolve();
  }

  function maybeResolve() {
    if (!battle || battle.winner) return;
    if (myAction && theirAction) {
      const playerAct   = isHost ? myAction    : theirAction;
      const opponentAct = isHost ? theirAction : myAction;
      const { state, events } = submitRound(battle, playerAct, opponentAct);
      battle = state;
      myAction = null;
      theirAction = null;
      emitLocal('state', { phase: 'round', battle, events });
      if (battle.winner) {
        emitLocal('end', { winner: battle.winner, mineWon: (battle.winner === 'player') === isHost });
      }
    }
  }

  function end(reason) {
    transport.send({ type: 'bye' });
    transport.close();
    emitLocal('end', { reason });
  }

  return {
    on,
    chooseAction,
    end,
    get battle() { return battle; },
    get isHost() { return isHost; },
  };
}

// ── LOCAL adapter — both players on one device ───────────────
// The "transport" here is just an in-memory pipe between two halves
// that take turns picking moves. Used for hot-seat.
export function createLocalDuel(snapshotA, snapshotB) {
  let battle = createBattle({
    player:   snapshotA,
    opponent: snapshotB,
    seed: Date.now(),
  });
  let queued = { player: null, opponent: null };
  let listeners = [];

  function on(fn) { listeners.push(fn); }
  function fire(payload) { listeners.forEach(l => l(payload)); }

  function chooseAction(side, action) {
    if (!battle || battle.winner) return;
    queued[side] = action;
    if (queued.player && queued.opponent) {
      const { state, events } = submitRound(battle, queued.player, queued.opponent);
      battle = state;
      queued = { player: null, opponent: null };
      fire({ phase: 'round', battle, events });
      if (battle.winner) fire({ phase: 'end', winner: battle.winner });
    }
  }

  return {
    on,
    chooseAction,
    get battle() { return battle; },
  };
}

// ── Real transport adapters ──────────────────────────────────
// Implemented in mpAdapters.js so the protocol layer stays clean.
export { capBleAdapter as mpBleAdapter, webBleAdapter as mpWebBleAdapter, qrCodeAdapter as mpQrAdapter } from './mpAdapters.js';

// ── Convenience — snapshot the current player for sending ────
export function exportMySnapshot(gameState) {
  const me = makePlayerCombatant(gameState);
  return {
    name: me.name,
    type: me.type,
    level: me.level,
    color: me.color,
    sprite: me.sprite,
    baseStats: me.baseStats,
    moves: me.moves,
    trait: me.trait || null,
    hueShift: me.hueShift || 0,
    variant: me.variant || 'classic',
    paletteRemap: me.paletteRemap || null,
    evolutionPath: me.evolutionPath || null,
  };
}
