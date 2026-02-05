/**
 * 기존 학생들의 출결번호 일괄 생성 마이그레이션 스크립트
 *
 * 실행 방법:
 * npx ts-node scripts/migrateAttendanceNumbers.ts
 *
 * 또는 Firebase Functions로 배포하여 실행
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { generateBulkAttendanceNumbers } from '../utils/attendanceNumberGenerator';

// Firebase 설정 (firebaseConfig.ts에서 가져오거나 직접 입력)
const firebaseConfig = {
  // 여기에 Firebase 설정을 입력하세요
  // 또는 환경 변수에서 가져오세요
};

async function migrateAttendanceNumbers() {
  console.log('🚀 출결번호 마이그레이션 시작...');

  try {
    // Firebase 초기화
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, 'restore260202');

    // 모든 학생 데이터 로드
    console.log('📚 학생 데이터 로딩 중...');
    const studentsRef = collection(db, 'students');
    const snapshot = await getDocs(studentsRef);

    if (snapshot.empty) {
      console.log('⚠️  학생 데이터가 없습니다.');
      return;
    }

    console.log(`✅ ${snapshot.size}명의 학생 데이터 로드 완료`);

    // 학생 데이터 변환
    const students = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      parentPhone: docSnap.data().parentPhone,
      attendanceNumber: docSnap.data().attendanceNumber,
    }));

    // 출결번호가 없는 학생 수 확인
    const studentsWithoutAttendance = students.filter(s => !s.attendanceNumber);
    console.log(`🔍 출결번호 미설정 학생: ${studentsWithoutAttendance.length}명`);

    if (studentsWithoutAttendance.length === 0) {
      console.log('✅ 모든 학생에게 출결번호가 이미 설정되어 있습니다.');
      return;
    }

    // 출결번호 일괄 생성
    console.log('🔢 출결번호 생성 중...');
    const attendanceNumberMap = generateBulkAttendanceNumbers(students);

    // Firestore 배치 업데이트
    console.log('💾 Firestore 업데이트 중...');
    const batchSize = 500;
    const studentIds = Array.from(attendanceNumberMap.keys());
    const batches = Math.ceil(studentIds.length / batchSize);

    let updatedCount = 0;

    for (let i = 0; i < batches; i++) {
      const batch = writeBatch(db);
      const start = i * batchSize;
      const end = Math.min(start + batchSize, studentIds.length);
      const batchIds = studentIds.slice(start, end);

      batchIds.forEach(studentId => {
        const attendanceNumber = attendanceNumberMap.get(studentId);
        if (attendanceNumber) {
          const docRef = doc(studentsRef, studentId);
          batch.update(docRef, {
            attendanceNumber,
            updatedAt: new Date().toISOString(),
          });
          updatedCount++;
        }
      });

      await batch.commit();
      console.log(`  📦 배치 ${i + 1}/${batches} 완료 (${updatedCount}명 업데이트)`);
    }

    console.log('');
    console.log('✅ 마이그레이션 완료!');
    console.log(`📊 통계:`);
    console.log(`   - 총 학생 수: ${snapshot.size}명`);
    console.log(`   - 출결번호 생성: ${studentsWithoutAttendance.length}명`);
    console.log(`   - 기존 출결번호 유지: ${students.length - studentsWithoutAttendance.length}명`);
    console.log('');

    // 출결번호 샘플 출력
    console.log('📋 생성된 출결번호 샘플 (처음 10명):');
    Array.from(attendanceNumberMap.entries())
      .filter(([id]) => studentsWithoutAttendance.some(s => s.id === id))
      .slice(0, 10)
      .forEach(([id, number], idx) => {
        const student = students.find(s => s.id === id);
        console.log(`   ${idx + 1}. ${id} → ${number} (전화: ${student?.parentPhone || '없음'})`);
      });

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    throw error;
  }
}

// 스크립트 실행
if (require.main === module) {
  migrateAttendanceNumbers()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export { migrateAttendanceNumbers };
