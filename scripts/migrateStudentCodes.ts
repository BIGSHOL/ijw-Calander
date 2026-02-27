/**
 * 기존 학생들의 고유번호 일괄 생성 마이그레이션 스크립트
 *
 * 실행 방법:
 * npx tsx --env-file=.env.local scripts/migrateStudentCodes.ts
 */

import { db } from '../firebaseConfig';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { generateBulkStudentCodes } from '../utils/studentCodeGenerator';

async function migrateStudentCodes() {
  console.log('🚀 학생 고유번호 마이그레이션 시작...');

  try {
    console.log('📚 학생 데이터 로딩 중...');
    const studentsRef = collection(db, 'students');
    const snapshot = await getDocs(studentsRef);

    if (snapshot.empty) {
      console.log('⚠️  학생 데이터가 없습니다.');
      return;
    }

    console.log(`✅ ${snapshot.size}명의 학생 데이터 로드 완료`);

    const students = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      studentCode: docSnap.data().studentCode,
    }));

    const studentsWithoutCode = students.filter(s => !s.studentCode);
    console.log(`🔍 고유번호 미설정 학생: ${studentsWithoutCode.length}명`);

    if (studentsWithoutCode.length === 0) {
      console.log('✅ 모든 학생에게 이미 고유번호가 설정되어 있습니다.');
      return;
    }

    console.log('🔢 고유번호 생성 중...');
    const codeMap = generateBulkStudentCodes(students);

    console.log('💾 Firestore 업데이트 중...');
    const batchSize = 500;
    let updatedCount = 0;

    // 고유번호 미설정 학생만 업데이트
    const toUpdate = studentsWithoutCode.map(s => ({
      id: s.id,
      code: codeMap.get(s.id)!,
    }));
    const batches = Math.ceil(toUpdate.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const batch = writeBatch(db);
      const start = i * batchSize;
      const end = Math.min(start + batchSize, toUpdate.length);
      const batchItems = toUpdate.slice(start, end);

      batchItems.forEach(item => {
        const docRef = doc(studentsRef, item.id);
        batch.update(docRef, {
          studentCode: item.code,
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      });

      await batch.commit();
      console.log(`  📦 배치 ${i + 1}/${batches} 완료 (${updatedCount}명 업데이트)`);
    }

    console.log('');
    console.log('✅ 마이그레이션 완료!');
    console.log(`📊 통계:`);
    console.log(`   - 총 학생 수: ${snapshot.size}명`);
    console.log(`   - 고유번호 생성: ${studentsWithoutCode.length}명`);
    console.log(`   - 기존 고유번호 유지: ${students.length - studentsWithoutCode.length}명`);
    console.log('');

    console.log('📋 생성된 고유번호 샘플 (처음 10명):');
    toUpdate.slice(0, 10).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.id} → ${item.code}`);
    });

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    throw error;
  }
}

migrateStudentCodes()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
