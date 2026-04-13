/**
 * Strain Delta Service for CannaPickForMe
 * Reads and writes the single Firestore document that overlays strains.json.
 */

import { db } from '../firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
      overrides: data.overrides && typeof data.overrides === 'object' ? data.overrides : {},
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
  await setDoc(DELTA_REF(), {
    hidden:    delta.hidden    ?? [],
    overrides: delta.overrides ?? {},
    additions: delta.additions ?? [],
  });
}
