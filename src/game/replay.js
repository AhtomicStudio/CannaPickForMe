/**
 * CannaGotchi — Battle Replay Codec
 *
 * Encode the inputs (both combatant snapshots + seed + each round's actions)
 * into a short Base64 string. Decoding rebuilds the same battle deterministically
 * because the engine is pure, so receivers can re-watch a friend's fight by
 * pasting the code.
 *
 * Output format (JSON, base64-encoded):
 *   { v:1, p:<playerSnapshot>, o:<opponentSnapshot>, s:<seed>,
 *     a:[ [pAction, oAction], … ], envId:<id?> }
 */

import { createBattle, submitRound, isOver } from './battle.js';

export function encodeReplay({ player, opponent, seed, actions, envId }) {
  const json = JSON.stringify({ v: 1, p: player, o: opponent, s: seed, a: actions, envId });
  return btoa(unescape(encodeURIComponent(json))).replace(/=+$/, '');
}

export function decodeReplay(code) {
  try {
    const json = decodeURIComponent(escape(atob(code.replace(/\s+/g, ''))));
    const obj = JSON.parse(json);
    if (obj.v !== 1) return null;
    return obj;
  } catch (_) { return null; }
}

/** Run the full replay forward to the final state, collecting all events. */
export function runReplay(replay) {
  let state = createBattle({
    player:   replay.p,
    opponent: replay.o,
    seed:     replay.s,
    envId:    replay.envId,
  });
  const allEvents = [];
  for (const [pAct, oAct] of (replay.a || [])) {
    if (isOver(state)) break;
    const r = submitRound(state, pAct, oAct);
    state = r.state;
    allEvents.push(...r.events);
  }
  return { finalState: state, events: allEvents };
}
