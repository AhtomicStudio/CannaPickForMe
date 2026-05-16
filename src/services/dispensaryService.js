/**
 * Dispensary Service for CannaPickForMe
 *
 * Replaces the hardcoded DISPENSARY_NAMES map that previously lived in
 * admin.js and main.js. Dispensaries are now a Firestore collection that
 * the admin can edit without a deploy.
 *
 * Schema: /dispensaries/{slug}
 *   - name:       display name shown on partner cards
 *   - city:       free-text city (optional)
 *   - active:     boolean — soft-delete flag
 *   - createdAt:  serverTimestamp
 *   - updatedAt:  serverTimestamp
 *
 * Reads are public (the user-facing app needs the display name when
 * rendering a partner strain card). Writes require admin auth.
 *
 * Names are cached for the lifetime of the page load so the user-facing
 * render path doesn't re-fetch on every result screen. Call
 * invalidateDispensaryCache() from the admin after a write to refresh.
 */

import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';

const COLLECTION = 'dispensaries';

let _cache = null;          // { [slug]: { name, city, active, ... } }
let _cachePromise = null;   // in-flight fetch, prevents thundering herd

/**
 * Fetch the full dispensary map, cached. Used by the user-facing app
 * when rendering a partner strain so we can show "📍 Cookies Hayward"
 * instead of the raw slug.
 *
 * Returns an object keyed by slug for O(1) lookup by id.
 */
export async function getDispensaryMap() {
  if (_cache) return _cache;
  if (_cachePromise) return _cachePromise;

  _cachePromise = (async () => {
    try {
      const snap = await getDocs(collection(db, COLLECTION));
      const map = {};
      snap.docs.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      _cache = map;
      return map;
    } catch (err) {
      console.warn('Failed to fetch dispensaries:', err);
      _cache = {};
      return _cache;
    } finally {
      _cachePromise = null;
    }
  })();

  return _cachePromise;
}

/**
 * Resolve a dispensary slug to its display name.
 * Falls back to the raw slug if the dispensary isn't in the cache —
 * so the UI never shows a blank where a name should be.
 */
export async function getDispensaryName(slug) {
  if (!slug) return '';
  const map = await getDispensaryMap();
  return map[slug]?.name || slug;
}

/**
 * Synchronous lookup against the in-memory cache. Returns null if the
 * cache hasn't been populated yet — callers should prefer the async
 * getDispensaryName() unless they've already awaited getDispensaryMap()
 * earlier in the same render pass.
 */
export function getDispensaryNameSync(slug) {
  if (!slug) return '';
  if (!_cache) return slug;
  return _cache[slug]?.name || slug;
}

/**
 * Fetch all dispensaries as an array (admin dashboard use).
 */
export async function listDispensaries() {
  const map = await getDispensaryMap();
  return Object.values(map).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Create or update a dispensary. Uses the slug as the doc ID so the
 * existing data shape (partnerStrain.dispensaryId = "cookies-hayward")
 * survives the migration unchanged.
 */
export async function saveDispensary(slug, { name, city = '', active = true }) {
  if (!slug || !name) throw new Error('saveDispensary requires slug and name');
  const ref = doc(db, COLLECTION, slug);
  const existing = await getDoc(ref);
  await setDoc(ref, {
    name: String(name).trim(),
    city: String(city).trim(),
    active: !!active,
    createdAt: existing.exists() ? (existing.data().createdAt || serverTimestamp()) : serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  invalidateDispensaryCache();
}

/**
 * Hard-delete a dispensary. Note: this does NOT clean up campaigns or
 * partner strains that reference it — those will just render the raw
 * slug as a fallback. We're explicit about this to avoid surprising
 * cascade deletes.
 */
export async function deleteDispensary(slug) {
  await deleteDoc(doc(db, COLLECTION, slug));
  invalidateDispensaryCache();
}

/**
 * Bust the in-memory cache. Call after writes in the admin so the
 * dropdowns reflect the latest state without a page reload.
 */
export function invalidateDispensaryCache() {
  _cache = null;
  _cachePromise = null;
}
