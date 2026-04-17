import { db } from '../firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PAGE_REF = (pageId) => doc(db, 'pages', pageId);

export async function getPageContent(pageId) {
  try {
    const snap = await getDoc(PAGE_REF(pageId));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('getPageContent error:', err);
    return null;
  }
}

export async function savePageContent(pageId, content) {
  await setDoc(PAGE_REF(pageId), {
    content,
    updatedAt: new Date().toISOString(),
  });
}
