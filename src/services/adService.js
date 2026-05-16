/**
 * Ad Service for CannaPickForMe
 *
 * Handles CRUD for ad creatives in Firestore + Storage. Ads are now
 * tied to a parent Campaign (see campaignService.js); the user-facing
 * app should NOT call getActiveAds directly — it goes through
 * sponsorshipService.getActiveAdsForPlacement(), which gates ads on
 * their campaign's live window.
 *
 * Schema: /ads/{adId}
 *   - title:         string
 *   - description:   string (card-style only)
 *   - clickUrl:      string
 *   - placement:     "home" | "result"
 *   - displayType:   "card" | "banner"
 *   - priority:      1–10 (higher = shown first)
 *   - imageUrl:      Firebase Storage download URL
 *   - imagePosition: { x: 0–100, y: 0–100 } object-position percentages
 *   - active:        boolean (legacy on/off — campaign window also gates)
 *   - campaignId:    FK to /campaigns (added in Phase 1; legacy ads
 *                    without this field are still served for back-compat,
 *                    and the migration sweeps them into the Legacy
 *                    campaign on first admin load)
 *   - impressions:   atomic counter (Phase 1)
 *   - clicks:        atomic counter (Phase 1)
 *   - lastImpressionAt, lastClickAt: timestamps
 *   - createdAt, updatedAt
 */

import { db, storage } from '../firebase.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  increment, serverTimestamp,
} from 'firebase/firestore';

// Compound queries (multiple where + orderBy) require Firestore composite
// indexes — we filter/sort client-side instead so deploying this service
// has no infra dependency.
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';

const ADS_COLLECTION = 'ads';

/**
 * Fetch active ads for a given placement.
 *
 * Note for new callers: prefer
 *   sponsorshipService.getActiveAdsForPlacement(placement)
 * which additionally honours the campaign live-window. This direct
 * function is retained for the admin dashboard and for back-compat
 * with any code path that hasn't been migrated yet.
 */
export async function getActiveAds(placement) {
  try {
    const snapshot = await getDocs(collection(db, ADS_COLLECTION));
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(ad => ad.placement === placement && ad.active)
      .sort((a, b) => (b.priority || 5) - (a.priority || 5));
  } catch (err) {
    console.warn('Failed to fetch ads:', err);
    return [];
  }
}

/**
 * Fetch ALL ads (admin dashboard + sponsorshipService aggregator).
 */
export async function getAllAds() {
  try {
    const snapshot = await getDocs(collection(db, ADS_COLLECTION));
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.priority || 5) - (a.priority || 5));
  } catch (err) {
    console.error('Failed to fetch all ads:', err);
    return [];
  }
}

/**
 * Create a new ad. Accepts an optional campaignId so the admin form
 * can wire the ad to its purchasing campaign in one step.
 */
export async function createAd(adData) {
  const docRef = await addDoc(collection(db, ADS_COLLECTION), {
    ...adData,
    active:        adData.active ?? true,
    priority:      adData.priority ?? 5,
    displayType:   adData.displayType ?? 'card',
    campaignId:    adData.campaignId ?? null,
    impressions:   0,
    clicks:        0,
    lastImpressionAt: null,
    lastClickAt:      null,
    createdAt:     serverTimestamp(),
    updatedAt:     serverTimestamp(),
  });
  return { id: docRef.id, ...adData };
}

/**
 * Update an existing ad. Partial patch.
 */
export async function updateAd(adId, adData) {
  const docRef = doc(db, ADS_COLLECTION, adId);
  await updateDoc(docRef, {
    ...adData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an ad and its image from Storage.
 */
export async function deleteAd(adId, imageUrl) {
  await deleteDoc(doc(db, ADS_COLLECTION, adId));
  if (imageUrl && imageUrl.includes('firebasestorage')) {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch {
      // Image may not exist — that's OK
    }
  }
}

/**
 * Upload an ad image to Firebase Storage. Returns the public download URL.
 */
export async function uploadAdImage(file) {
  const filename = `ads/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filename);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

// ─── Counters ───────────────────────────────────────────────────────────────
//
// Atomic, fire-and-forget. Errors are logged but never re-thrown into
// the render path — a failed counter must never break the user-facing
// app.

export async function incrementAdImpression(adId) {
  if (!adId) return;
  try {
    await updateDoc(doc(db, ADS_COLLECTION, adId), {
      impressions:      increment(1),
      lastImpressionAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to increment ad impression:', err);
  }
}

export async function incrementAdClick(adId) {
  if (!adId) return;
  try {
    await updateDoc(doc(db, ADS_COLLECTION, adId), {
      clicks:      increment(1),
      lastClickAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to increment ad click:', err);
  }
}
