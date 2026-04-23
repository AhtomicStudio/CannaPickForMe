/**
 * CannaGotchi — Game Service
 * Firestore CRUD for game state. Merges into the existing user document.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

/**
 * Load game state from Firestore user doc.
 * @param {string} uid
 * @returns {object|null} game state or null if none exists
 */
export async function loadGameState(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data().game || null;
  } catch (err) {
    console.error('[gameService] loadGameState failed:', err);
    return null;
  }
}

/**
 * Save game state to Firestore (merged into user doc).
 * @param {string} uid
 * @param {object} gameState
 */
export async function saveGameState(uid, gameState) {
  try {
    await setDoc(doc(db, 'users', uid), { game: gameState }, { merge: true });
  } catch (err) {
    console.error('[gameService] saveGameState failed:', err);
  }
}

/**
 * Create initial game state for a new monster.
 * @param {string} monsterType — 'indica' | 'sativa' | 'hybrid'
 * @param {string} monsterName
 * @returns {object}
 */
export function createInitialGameState(monsterType, monsterName) {
  return {
    monsterType,
    monsterName,
    xp: 0,
    lastTick: Date.now(),
    wins: 0,
    losses: 0,
    createdAt: Date.now(),
  };
}
