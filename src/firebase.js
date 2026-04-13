/**
 * Firebase Configuration for CannaPickForMe
 * Used for ad management (Firestore + Storage).
 * Vercel Analytics handles usage tracking separately.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD7UinFOkdKefYbaiDxzkU7cLCx7PmxEso",
  authDomain: "cannapickforme.firebaseapp.com",
  projectId: "cannapickforme",
  storageBucket: "cannapickforme.firebasestorage.app",
  messagingSenderId: "563331444056",
  appId: "1:563331444056:web:e3885b11144d41eff3092d",
  measurementId: "G-CDZTV0HG2F"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
