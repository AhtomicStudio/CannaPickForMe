/**
 * Ad Service for CannaPickForMe
 * Handles CRUD operations for ad management via Firestore.
 * Ad display types: "card" (default, smaller) or "banner" (full-width)
 */

import { db, storage } from '../firebase.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from 'firebase/storage';

const ADS_COLLECTION = 'ads';

/**
 * Fetch active ads for a given placement (e.g., "home", "result")
 * Returns ads sorted by priority (highest first)
 */
export async function getActiveAds(placement) {
  try {
    const q = query(
      collection(db, ADS_COLLECTION),
      where('active', '==', true),
      where('placement', '==', placement),
      orderBy('priority', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('Failed to fetch ads:', err);
    return [];
  }
}

/**
 * Fetch ALL ads (admin dashboard use)
 */
export async function getAllAds() {
  try {
    const q = query(
      collection(db, ADS_COLLECTION),
      orderBy('priority', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Failed to fetch all ads:', err);
    return [];
  }
}

/**
 * Create a new ad
 */
export async function createAd(adData) {
  const docRef = await addDoc(collection(db, ADS_COLLECTION), {
    ...adData,
    active: adData.active ?? true,
    priority: adData.priority ?? 5,
    displayType: adData.displayType ?? 'card',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id, ...adData };
}

/**
 * Update an existing ad
 */
export async function updateAd(adId, adData) {
  const docRef = doc(db, ADS_COLLECTION, adId);
  await updateDoc(docRef, {
    ...adData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an ad (and its image from storage)
 */
export async function deleteAd(adId, imageUrl) {
  // Delete the Firestore document
  await deleteDoc(doc(db, ADS_COLLECTION, adId));

  // Try to delete the image from storage
  if (imageUrl) {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch {
      // Image may not exist or already deleted — that's OK
    }
  }
}

/**
 * Upload an ad image to Firebase Storage
 * Returns the public download URL
 */
export async function uploadAdImage(file) {
  const filename = `ads/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filename);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}
