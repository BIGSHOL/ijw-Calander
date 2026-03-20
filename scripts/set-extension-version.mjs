/**
 * Firestore에 확장 프로그램 최신 버전 정보 등록
 * 사용법: node scripts/set-extension-version.mjs [version]
 * 예: node scripts/set-extension-version.mjs 1.1.0
 */

import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID"
});
const db = initializeFirestore(app, {}, 'restore260202');

const version = process.argv[2] || '1.1.0';

try {
  await setDoc(doc(db, 'settings', 'extension-version'), {
    version,
    updatedAt: new Date().toISOString()
  });
  console.log(`✅ extension-version = ${version} 등록 완료`);
} catch (error) {
  console.error('❌ 실패:', error.message);
}

process.exit(0);
