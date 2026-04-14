/**
 * userService.js
 * Firebase Auth (magic link) + debounced Firestore write-through sync.
 *
 * Firestore path: users/{uid}  — one document per user, replaced wholesale on each write.
 * localStorage is the primary read source; Firestore is the cloud mirror.
 */

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  signOut as fbSignOut,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import {
  getStash,
  getCustomStrains,
  getEffectOverrides,
  getSessionHistory,
  getUpdatedAt,
  setUpdatedAt,
  setStashBulk,
  setCustomStrainsBulk,
  setEffectOverridesBulk,
  setSessionHistoryBulk,
} from '../storage/store.js';

const PENDING_EMAIL_KEY = 'cpfm_pending_email';

let currentUser = null;
let syncTimer = null;

function actionCodeSettings() {
  return {
    url: import.meta.env.VITE_APP_URL || window.location.origin,
    handleCodeInApp: true,
  };
}

/** Returns the currently signed-in Firebase user, or null. */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Send a magic sign-in link to the given email.
 * Stores the email in localStorage so this device can complete sign-in.
 */
export async function sendSignInLink(email) {
  await sendSignInLinkToEmail(auth, email, actionCodeSettings());
  localStorage.setItem(PENDING_EMAIL_KEY, email);
}

/**
 * Call on every page load. If the current URL contains a Firebase email-link
 * sign-in payload, complete the sign-in and clean up the URL.
 * Returns true if a sign-in was completed, false otherwise.
 */
export async function handleSignInLink() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return false;
  let email = localStorage.getItem(PENDING_EMAIL_KEY);
  if (!email) {
    // Cross-device sign-in: email not stored on this device
    email = window.prompt('Please confirm your email to complete sign-in:');
    if (!email) return false;
  }
  try {
    await signInWithEmailLink(auth, email, window.location.href);
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  } finally {
    localStorage.removeItem(PENDING_EMAIL_KEY);
  }
}

/**
 * Schedule a Firestore write 1.5 s after the last mutation.
 * Rapid changes (e.g. toggling stash items quickly) produce a single write.
 */
export function scheduleSync() {
  if (!currentUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncProfile, 1500);
}

/**
 * Write all four local data sources to Firestore and stamp updatedAt.
 * Safe to call directly for immediate sync (e.g. after conflict resolution).
 */
export async function syncProfile() {
  if (!currentUser) return;
  const uid = currentUser.uid;
  const ts = Date.now();
  const profile = {
    stash: getStash(),
    overrides: getEffectOverrides(),
    customStrains: getCustomStrains(),
    sessionHistory: getSessionHistory(),
    updatedAt: ts,
  };
  try {
    await setDoc(doc(db, 'users', uid), profile);
    setUpdatedAt(ts);
  } catch (err) {
    console.error('[userService] syncProfile failed:', err);
  }
}

/**
 * Called once on sign-in. Fetches the cloud profile and resolves any conflict.
 * @param {function(number, number): Promise<'local'|'cloud'>} showConflictFn
 *   Receives (localTs, cloudTs) and returns a promise resolving to which copy wins.
 */
export async function loadAndResolveProfile(showConflictFn) {
  if (!currentUser) return;
  const uid = currentUser.uid;
  try {
    const snap = await getDoc(doc(db, 'users', uid));

    if (!snap.exists()) {
      // First sign-in ever — push local data up to cloud silently
      await syncProfile();
      return;
    }

    const cloud = snap.data();
    const localTs = getUpdatedAt();

    if (cloud.updatedAt === localTs) return; // Already in sync — nothing to do

    // Timestamps differ: ask the user which copy to keep
    const winner = await showConflictFn(localTs, cloud.updatedAt || 0);
    if (winner === 'local') {
      await syncProfile();
    } else {
      // Restore cloud data into localStorage
      setStashBulk(cloud.stash || []);
      setCustomStrainsBulk(cloud.customStrains || []);
      setEffectOverridesBulk(cloud.overrides || {});
      setSessionHistoryBulk(cloud.sessionHistory || []);
      setUpdatedAt(cloud.updatedAt || 0);
    }
  } catch (err) {
    console.error('[userService] loadAndResolveProfile failed:', err);
  }
}

/** Sign out the current user. */
export async function signOutUser() {
  clearTimeout(syncTimer);
  await fbSignOut(auth);
}

/**
 * Delete the user's Firestore profile doc then delete their Auth account.
 * Requires the user to have signed in recently (within ~5 minutes).
 * Throws auth/requires-recent-login if the session is too old — caller should handle.
 */
export async function deleteAccount() {
  if (!currentUser) return;
  const userToDelete = currentUser;
  await deleteDoc(doc(db, 'users', userToDelete.uid));
  await deleteUser(userToDelete); // Signs out automatically; triggers onAuthStateChanged
}

/**
 * Initialize the Firebase Auth state listener.
 * @param {function(User): void} onSignIn  Called when a user signs in.
 * @param {function(): void}     onSignOut Called when the user signs out.
 */
export function initAuth(onSignIn, onSignOut) {
  return onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      onSignIn(user);
    } else {
      onSignOut();
    }
  });
}
