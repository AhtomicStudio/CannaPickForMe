/**
 * CannaGotchi — Async Battle League (Firestore-backed)
 *
 * Each player publishes a "challenger" snapshot of their best Cannabud to a
 * single shared collection. Other players can pull the leaderboard, pick a
 * challenger, and fight against the snapshot using the deterministic battle
 * engine. No live sync needed — both players see the same outcome on next
 * publish + fetch.
 *
 * Collection: `leagueChallengers/{uid}`
 *   { uid, displayName, snapshot, level, type, variant, traitId,
 *     publishedAt, wins, losses }
 *
 * The snapshot is what `exportMySnapshot` returns from multiplayer.js, so
 * it plugs straight into createBattle as the opponent.
 *
 * Reads + writes are GUARDED so this module fails gracefully if the user
 * isn't signed in, isn't online, or Firestore rules block them.
 */

import { collection, doc, getDoc, getDocs, setDoc, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase.js';

const COLL = 'leagueChallengers';

/** Publish/update the player's challenger snapshot. */
export async function publishChallenger({ uid, displayName, snapshot, level, type, variant, traitId }) {
  if (!uid) return { ok: false, reason: 'no-uid' };
  try {
    await setDoc(doc(db, COLL, uid), {
      uid,
      displayName: displayName || 'Anonymous Bud',
      snapshot,
      level: level || 1,
      type, variant, traitId,
      publishedAt: Date.now(),
    }, { merge: true });
    return { ok: true };
  } catch (err) {
    console.warn('[league] publish failed:', err);
    return { ok: false, reason: err.code || 'unknown' };
  }
}

/** Fetch the top N challengers by level.
 *  Throws on actual fetch errors so the UI can distinguish "no challengers
 *  in the league yet" (returns []) from "couldn't reach Firestore" (throws).
 */
export async function fetchLeaderboard(maxN = 25) {
  const q = query(collection(db, COLL), orderBy('level', 'desc'), limit(maxN));
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(d => list.push(d.data()));
  return list;
}

/** Fetch a single challenger by uid (for direct friend code lookup). */
export async function fetchChallenger(uid) {
  if (!uid) return null;
  try {
    const s = await getDoc(doc(db, COLL, uid));
    return s.exists() ? s.data() : null;
  } catch (err) {
    console.warn('[league] fetchOne failed:', err);
    return null;
  }
}

/** Increment win/loss counter on the OPPONENT's record after a match.
 *  We only call this for the local user, not the opponent (would need that user's auth). */
export async function recordMyResult(uid, didIWin) {
  if (!uid) return;
  try {
    const ref = doc(db, COLL, uid);
    const cur = await getDoc(ref);
    const data = cur.exists() ? cur.data() : { wins: 0, losses: 0 };
    if (didIWin) data.wins = (data.wins || 0) + 1;
    else         data.losses = (data.losses || 0) + 1;
    await setDoc(ref, { wins: data.wins, losses: data.losses }, { merge: true });
  } catch (err) {
    console.warn('[league] recordResult failed:', err);
  }
}
