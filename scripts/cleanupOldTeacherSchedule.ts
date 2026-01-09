/**
 * 기존 강사명 문서 삭제 스크립트
 * 강사명 변경 후 기존 문서가 남아있을 때 사용
 *
 * 실행 방법:
 * npx ts-node scripts/cleanupOldTeacherSchedule.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  // firebaseConfig.ts에서 복사
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupOldTeacherSchedule(oldTeacherName: string) {
  const docRef = doc(db, 'english_schedules', oldTeacherName);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    console.log(`🗑️  "${oldTeacherName}" 문서 발견. 삭제 중...`);
    await deleteDoc(docRef);
    console.log(`✅ "${oldTeacherName}" 문서 삭제 완료`);
  } else {
    console.log(`ℹ️  "${oldTeacherName}" 문서를 찾을 수 없습니다.`);
  }
}

// 실행
const oldName = '부원장';
cleanupOldTeacherSchedule(oldName)
  .then(() => {
    console.log('✅ 정리 완료');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 오류:', err);
    process.exit(1);
  });
