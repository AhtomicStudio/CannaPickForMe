/**
 * Advertiser Service for CannaPickForMe
 *
 * An Advertiser is the business that pays you — a dispensary, brand, or
 * other partner. They own one or more Campaigns (see campaignService.js),
 * each of which bundles together the inventory (ads, sponsored strains,
 * partner strain listings) they've purchased for a date range.
 *
 * Schema: /advertisers/{advertiserId}
 *   - name:          display name e.g. "Cookies Hayward"
 *   - contactName:   primary contact at the business
 *   - contactEmail:  for billing and account notifications
 *   - phone:         optional
 *   - dispensaryId:  optional FK to /dispensaries — the primary location.
 *                    A multi-location chain may have multiple campaigns
 *                    targeting different dispensaries; this is just the
 *                    default association.
 *   - status:        "active" | "paused" | "archived"
 *                    "paused" pauses ALL their campaigns regardless of
 *                    individual campaign status (a global kill switch).
 *   - notes:         free-text for the operator
 *   - createdAt, updatedAt
 *
 * Advertiser docs contain PII (contact email, name). Writes require
 * admin auth. Reads are also admin-only — the user-facing app should
 * never need to know who paid; it only needs campaign inventory.
 */

import { db } from '../firebase.js';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';

const COLLECTION = 'advertisers';

export const ADVERTISER_STATUS = Object.freeze({
  ACTIVE:   'active',
  PAUSED:   'paused',
  ARCHIVED: 'archived',
});

/**
 * Create a new advertiser. Returns { id, ...data }.
 */
export async function createAdvertiser({
  name,
  contactName = '',
  contactEmail = '',
  phone = '',
  dispensaryId = null,
  status = ADVERTISER_STATUS.ACTIVE,
  notes = '',
}) {
  if (!name) throw new Error('createAdvertiser requires a name');
  const data = {
    name:         String(name).trim(),
    contactName:  String(contactName).trim(),
    contactEmail: String(contactEmail).trim(),
    phone:        String(phone).trim(),
    dispensaryId: dispensaryId || null,
    status:       status || ADVERTISER_STATUS.ACTIVE,
    notes:        String(notes || '').trim(),
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), data);
  return { id: ref.id, ...data };
}

/**
 * Update an advertiser. Only the keys provided are written.
 */
export async function updateAdvertiser(id, patch) {
  if (!id) throw new Error('updateAdvertiser requires an id');
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get a single advertiser by id.
 */
export async function getAdvertiser(id) {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * List all advertisers, sorted by name. Used by the admin dashboard.
 */
export async function listAdvertisers() {
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (err) {
    console.warn('Failed to list advertisers:', err);
    return [];
  }
}

/**
 * Archive an advertiser. This is the soft-delete path — we never hard
 * delete because campaigns may still reference the advertiser for
 * historical reporting. To purge entirely, use deleteAdvertiser().
 */
export async function archiveAdvertiser(id) {
  await updateAdvertiser(id, { status: ADVERTISER_STATUS.ARCHIVED });
}

/**
 * Hard-delete an advertiser. Caller should pause/end their campaigns
 * first; this does NOT cascade.
 */
export async function deleteAdvertiser(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
