/**
 * Firestore에 확장 프로그램 최신 버전 정보 등록
 * 사용법: node scripts/set-extension-version.mjs [version]
 * 예: node scripts/set-extension-version.mjs 1.1.0
 */

import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyCDDAnbtu7HDM3JUbFf4jKSH4mS6GYYPkI",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: "231563652148",
  appId: "1:231563652148:web:4a217812ef96fa3aae2e61"
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
