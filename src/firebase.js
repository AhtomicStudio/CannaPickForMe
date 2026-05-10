/**
 * Firebase Configuration for CannaPickForMe
 * Provides Firestore (with offline persistence), Storage, and Auth.
 *
 * HMR-safe: Vite hot-module reloads can re-execute this module, which would
 * otherwise throw on the second `initializeFirestore` / `initializeAuth`
 * call. Each init is wrapped in a try/catch that falls back to the getter.
 *
 * Auth persistence: explicit IndexedDB-first chain. Critical for Capacitor's
 * WebView, which otherwise defaults to in-memory persistence and signs users
 * out every relaunch.
 *
 * Auth popup resolver: required so signInWithPopup / Google sign-in works
 * with `initializeAuth`. (`getAuth` includes it by default; `initializeAuth`
 * does not.)
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  initializeAuth, getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Reuse the existing FirebaseApp if HMR already ran initializeApp.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore — try the persistent-cache init; fall back to getter on second runs.
let _db;
try {
  _db = initializeFirestore(app, { localCache: persistentLocalCache() });
} catch (_) {
  _db = getFirestore(app);
}
export const db = _db;

export const storage = getStorage(app);

// Auth — initializeAuth only works once. After HMR, fall back to getAuth.
let _auth;
try {
  _auth = initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence,
      browserLocalPersistence,
      browserSessionPersistence,
      inMemoryPersistence,
    ],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch (_) {
  _auth = getAuth(app);
}
export const auth = _auth;
