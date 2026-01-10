/**
 * Firebase의 system/config 문서에서 tabPermissions 업데이트
 * 새로운 탭 (classes, student-consultations)을 master 권한에 추가
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

// Firebase 설정 (firebaseConfig.ts에서 가져오기)
const firebaseConfig = {
  // 여기에 Firebase 설정 붙여넣기
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateTabPermissions() {
  try {
    console.log('🔧 tabPermissions 업데이트 시작...');

    const configRef = doc(db, 'system', 'config');
    const configSnap = await getDoc(configRef);

    if (!configSnap.exists()) {
      console.log('❌ system/config 문서가 존재하지 않습니다.');
      console.log('💡 Firebase Console에서 수동으로 생성해야 합니다.');
      return;
    }

    const currentConfig = configSnap.data();
    const currentPermissions = currentConfig.tabPermissions || {};

    console.log('📋 현재 tabPermissions:', JSON.stringify(currentPermissions, null, 2));

    // 업데이트할 권한 설정
    const updatedPermissions = {
      ...currentPermissions,
      master: [
        'calendar',
        'timetable',
        'attendance',
        'payment',
        'gantt',
        'consultation',
        'students',
        'grades',
        'classes',                    // ✨ 새로 추가
        'student-consultations',      // ✨ 새로 추가
      ],
      admin: [
        'calendar',
        'timetable',
        'attendance',
        'payment',
        'students',
        'grades',
        'classes',                    // ✨ 새로 추가
        'student-consultations',      // ✨ 새로 추가
      ],
      manager: [
        'calendar',
        'attendance',
        'students',
        'grades',
        'classes',                    // ✨ 새로 추가
        'student-consultations',      // ✨ 새로 추가
      ],
      math_lead: [
        'timetable',
        'attendance',
        'students',
        'grades',
        'classes',                    // ✨ 새로 추가
        'student-consultations',      // ✨ 새로 추가
      ],
      english_lead: [
        'timetable',
        'attendance',
        'students',
        'grades',
        'classes',                    // ✨ 새로 추가
        'student-consultations',      // ✨ 새로 추가
      ],
    };

    // Firestore 업데이트
    await updateDoc(configRef, {
      tabPermissions: updatedPermissions
    });

    console.log('✅ tabPermissions 업데이트 완료!');
    console.log('📋 업데이트된 tabPermissions:', JSON.stringify(updatedPermissions, null, 2));
    console.log('');
    console.log('💡 브라우저를 새로고침하면 새로운 탭이 표시됩니다.');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

updateTabPermissions();
