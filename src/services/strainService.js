/**
 * Strain Delta Service for CannaPickForMe
 * Reads and writes the single Firestore document that overlays strains.json.
 */

import { db } from '../firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const DELTA_REF = () => doc(db, 'strains', 'delta');

const EMPTY_DELTA = { hidden: [], overrides: {}, additions: [] };

/**
 * Fetch the strain delta from Firestore.
 * Returns EMPTY_DELTA on error or if the document doesn't exist yet.
 */
export async function getStrainDelta() {
  try {
    const snap = await getDoc(DELTA_REF());
    if (!snap.exists()) return { ...EMPTY_DELTA };
    const data = snap.data();
    return {
      hidden:    Array.isArray(data.hidden)    ? data.hidden    : [],
      overrides: data.overrides !== null && typeof data.overrides === 'object' && !Array.isArray(data.overrides) ? data.overrides : {},
      additions: Array.isArray(data.additions) ? data.additions : [],
    };
  } catch (err) {
    console.warn('Failed to fetch strain delta:', err);
    return { ...EMPTY_DELTA };
  }
}

/**
 * Write the full delta object back to Firestore.
 */
export async function saveStrainDelta(delta) {
  try {
    await setDoc(DELTA_REF(), {
      hidden:    delta.hidden    ?? [],
      overrides: delta.overrides ?? {},
      additions: delta.additions ?? [],
    });
  } catch (err) {
    console.error('Failed to save strain delta:', err);
    throw err;
  }
}

// ─── Menu Sync ──────────────────────────────────────────────────────────────

const MENU_REF = (dispensaryId) => doc(db, 'menus', dispensaryId);

/**
 * Fetch the live menu snapshot for a dispensary.
 * Returns empty defaults if the document doesn't exist yet.
 */
export async function getMenuData(dispensaryId) {
  try {
    const snap = await getDoc(MENU_REF(dispensaryId));
    if (!snap.exists()) return { strainIds: [], unknowns: [], lastSynced: null };
    const data = snap.data();
    return {
      strainIds:  Array.isArray(data.strainIds)  ? data.strainIds  : [],
      unknowns:   Array.isArray(data.unknowns)   ? data.unknowns   : [],
      lastSynced: data.lastSynced ?? null,
    };
  } catch (err) {
    console.warn('Failed to fetch menu data:', err);
    return { strainIds: [], unknowns: [], lastSynced: null };
  }
}

/**
 * Persist the menu snapshot for a dispensary.
 * Automatically stamps lastSynced.
 */
export async function saveMenuData(dispensaryId, { strainIds, unknowns }) {
  try {
    await setDoc(MENU_REF(dispensaryId), {
      strainIds:  strainIds  ?? [],
      unknowns:   unknowns   ?? [],
      lastSynced: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to save menu data:', err);
    throw err;
  }
}
