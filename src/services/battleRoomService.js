/**
 * CannaGotchi — Battle Room Service
 *
 * Thin Firestore wrapper for real-time online PvP rooms.
 *
 * Collection: battleRooms/{code}
 * Schema:
 *   code            string   — 6-char room code
 *   seed            number   — shared RNG seed (host picks)
 *   status          string   — 'waiting' | 'active' | 'ended'
 *   hostUid         string
 *   hostName        string
 *   hostSnapshot    object   — Cannabud combatant snapshot
 *   guestUid        string | null
 *   guestName       string | null
 *   guestSnapshot   object | null
 *   round           number   — incremented by host after each round resolves
 *   hostAction      object | null   — cleared after each round
 *   guestAction     object | null
 *   winner          'host' | 'guest' | null
 *   hostEmote       string | null   — auto-cleared by client after 2.5 s
 *   guestEmote      string | null
 *   createdAt       Timestamp
 *
 * Determinism guarantee:
 *   Both clients call submitRound(battle, hostAction, guestAction) with
 *   identical arguments → identical result. The host then calls advanceRound
 *   to clear the actions and bump the round counter, which triggers the
 *   guest's onSnapshot so they know the round resolved.
 */

import { db } from '../firebase.js';
import {
  doc, setDoc, updateDoc, onSnapshot, deleteDoc, serverTimestamp,
} from 'firebase/firestore';

const ROOMS = 'battleRooms';

// Characters that are unambiguous to read aloud or type on a phone.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(len = 6) {
  let c = '';
  for (let i = 0; i < len; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

// ── Create ────────────────────────────────────────────────────
export async function createRoom({ hostUid, hostName, hostSnapshot }) {
  const code = genCode();
  const seed = Math.floor(Math.random() * 0xFFFFFFFF);
  await setDoc(doc(db, ROOMS, code), {
    code,
    seed,
    status: 'waiting',
    hostUid,
    hostName,
    hostSnapshot,
    guestUid: null,
    guestName: null,
    guestSnapshot: null,
    round: 0,
    hostAction: null,
    guestAction: null,
    winner: null,
    hostEmote: null,
    guestEmote: null,
    createdAt: serverTimestamp(),
  });
  return { code, seed };
}

// ── Join ──────────────────────────────────────────────────────
export async function joinRoom({ code, guestUid, guestName, guestSnapshot }) {
  await updateDoc(doc(db, ROOMS, code), {
    guestUid,
    guestName,
    guestSnapshot,
    status: 'active',
  });
}

// ── Listen ────────────────────────────────────────────────────
/** Returns unsubscribe fn. `callback` receives the full room doc data. */
export function listenRoom(code, callback) {
  return onSnapshot(doc(db, ROOMS, code), snap => {
    if (snap.exists()) callback(snap.data());
  });
}

// ── Actions ───────────────────────────────────────────────────
/** role: 'host' | 'guest' */
export async function submitAction({ code, role, action }) {
  const field = role === 'host' ? 'hostAction' : 'guestAction';
  await updateDoc(doc(db, ROOMS, code), { [field]: action });
}

/** Host calls this after resolving a round to reset actions and bump counter. */
export async function advanceRound({ code, nextRound }) {
  await updateDoc(doc(db, ROOMS, code), {
    round: nextRound,
    hostAction: null,
    guestAction: null,
  });
}

// ── End ───────────────────────────────────────────────────────
export async function endRoom({ code, winner }) {
  try {
    await updateDoc(doc(db, ROOMS, code), { status: 'ended', winner });
  } catch (_) {}
}

// ── Emotes ───────────────────────────────────────────────────
const EMOTE_CLEAR_MS = 2500;
export async function sendEmote({ code, role, emote }) {
  const field = role === 'host' ? 'hostEmote' : 'guestEmote';
  try {
    await updateDoc(doc(db, ROOMS, code), { [field]: emote });
    setTimeout(async () => {
      try { await updateDoc(doc(db, ROOMS, code), { [field]: null }); } catch (_) {}
    }, EMOTE_CLEAR_MS);
  } catch (_) {}
}

// ── Cleanup ───────────────────────────────────────────────────
export async function cleanupRoom(code) {
  try { await deleteDoc(doc(db, ROOMS, code)); } catch (_) {}
}
