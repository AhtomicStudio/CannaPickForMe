import { db } from '../firebase.js';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

const INFO_REF = (slug) => doc(db, 'info', slug);
const INFO_COLLECTION = () => collection(db, 'info');

export async function getInfoTopics() {
  try {
    const snap = await getDocs(INFO_COLLECTION());
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  } catch (err) {
    console.error('getInfoTopics error:', err);
    return [];
  }
}

export async function saveInfoTopic(slug, data) {
  await setDoc(INFO_REF(slug), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function deleteInfoTopic(slug) {
  await deleteDoc(INFO_REF(slug));
}
