/**
 * Firebase Configuration for CannaPickForMe
 * Used ONLY for ad management — no user data collected.
 *
 * ⚠️  SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a project named "CannaPickForMe" (or similar)
 * 3. Add a Web App and copy the config object below
 * 4. Enable Firestore Database (start in test mode, we'll lock down later)
 * 5. Enable Firebase Storage
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
