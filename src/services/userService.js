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
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut as fbSignOut,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
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

// Cloud Functions client — region must match setGlobalOptions in functions/index.js
const functions = getFunctions(undefined, 'us-central1');
const _requestSignInCode = httpsCallable(functions, 'requestSignInCode');
const _verifySignInCode = httpsCallable(functions, 'verifySignInCode');

const PENDING_EMAIL_KEY = 'cpfm_pending_email';
export const NEEDS_EMAIL_CONFIRMATION = 'needs-email-confirmation';

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
  const email = localStorage.getItem(PENDING_EMAIL_KEY);
  if (!email) {
    // Cross-device sign-in: caller must collect email and call completeSignInWithEmail
    return NEEDS_EMAIL_CONFIRMATION;
  }
  await signInWithEmailLink(auth, email, window.location.href);
  localStorage.removeItem(PENDING_EMAIL_KEY);
  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}

export async function completeSignInWithEmail(email) {
  await signInWithEmailLink(auth, email, window.location.href);
  localStorage.removeItem(PENDING_EMAIL_KEY);
  window.history.replaceState({}, document.title, window.location.pathname);
}

/**
 * Request a 6-digit OTP code be emailed to the given address.
 * Used as a fallback when the magic link doesn't arrive (or lands in spam).
 * Throws if the Cloud Function rejects (rate-limited, invalid email, SMTP failure).
 */
export async function requestSignInCode(email) {
  const result = await _requestSignInCode({ email });
  // Stash the email so the verify step doesn't need the user to retype it
  localStorage.setItem(PENDING_EMAIL_KEY, email);
  return result.data; // { ok: true, expiresInSeconds: 600 }
}

/**
 * Verify a 6-digit code. On success, signs the user in via custom token.
 * Throws if the code is wrong, expired, or attempts exhausted.
 */
export async function verifySignInCode(code) {
  const email = localStorage.getItem(PENDING_EMAIL_KEY);
  if (!email) {
    throw new Error('No pending sign-in. Request a new code.');
  }
  const result = await _verifySignInCode({ email, code });
  const { token } = result.data;
  await signInWithCustomToken(auth, token);
  localStorage.removeItem(PENDING_EMAIL_KEY);
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
    await setDoc(doc(db, 'users', uid), profile, { merge: true });
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

    // Normalize cloud.updatedAt to a number; Firestore may return a Timestamp object
    const cloudTs = (typeof cloud.updatedAt?.toMillis === 'function')
      ? cloud.updatedAt.toMillis()
      : Number(cloud.updatedAt ?? 0);

    if (cloudTs === localTs) return; // Already in sync — nothing to do

    // Timestamps differ: ask the user which copy to keep
    const winner = await showConflictFn(localTs, cloudTs);
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

export async function syncSettingsFromFirestore(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const settings = snap.data()?.settings || {};
    if (settings.theme || settings.lightMode !== undefined) {
      const { setTheme, setLightMode } = await import('../storage/store.js');
      const { applyTheme, applyLightMode } = await import('./themeService.js');
      if (settings.theme) { setTheme(settings.theme); applyTheme(settings.theme); }
      if (settings.lightMode !== undefined) { setLightMode(settings.lightMode); applyLightMode(settings.lightMode); }
    }
  } catch (err) {
    console.warn('Failed to sync settings from Firestore:', err);
  }
}

export async function saveSettingsToFirestore(uid, settings) {
  try {
    await setDoc(doc(db, 'users', uid), { settings }, { merge: true });
  } catch (err) {
    console.warn('Failed to save settings to Firestore:', err);
  }
}

/** Sign in with a Google popup. */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
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
