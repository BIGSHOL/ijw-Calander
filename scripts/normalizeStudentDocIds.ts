/**
 * 학생 문서 ID 정규화 스크립트
 *
 * 목적:
 * - Firebase 자동 생성 ID (예: yeft9S10zXXTApRnSmx2)를
 * - 이름_학교_학년 형식 (예: 이우민_칠성초_초3)으로 변환
 *
 * 로직:
 * 1. 잘못된 ID를 가진 학생 목록 조회
 * 2. 해당 학생의 올바른 ID (이름_학교_학년) 생성
 * 3. 올바른 ID가 이미 존재하면 → 잘못된 ID 문서 삭제 (중복)
 * 4. 존재하지 않으면 → 새 ID로 이동
 * 5. 상담 기록의 studentId도 함께 업데이트
 *
 * 실행 방법:
 * 1. 브라우저 콘솔에서 실행 (개발 환경)
 * 2. 또는 Node.js 환경에서 실행
 *
 * 주의사항:
 * - DRY_RUN = true로 먼저 실행하여 변경 사항 확인
 */

import {
  collection,
  doc,
  getDocs,
  writeBatch,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent } from '../types';

// 설정
const DRY_RUN = true; // true면 실제 변경 없이 로그만 출력
const BATCH_SIZE = 500;

type MigrationAction = 'DELETE' | 'MOVE';

interface MigrationResult {
  oldId: string;
  newId: string;
  studentName: string;
  school: string;
  grade: string;
  action: MigrationAction; // 'DELETE' = 이미 존재하므로 삭제, 'MOVE' = 새 ID로 이동
  hasConsultations: number;
}

/**
 * 문서 ID가 이름_학교_학년 형식인지 확인
 */
function isValidDocIdFormat(docId: string): boolean {
  // 한글 이름으로 시작하고 _ 구분자가 있는 경우
  const pattern = /^[가-힣]+_/;
  return pattern.test(docId);
}

/**
 * 학생 데이터로 새 문서 ID 생성
 */
function generateNewDocId(student: UnifiedStudent): string {
  const name = student.name || '미상';
  const school = student.school || '미정';
  const grade = student.grade || '0';
  return `${name}_${school}_${grade}`;
}

/**
 * 메인 마이그레이션 함수
 */
export async function normalizeStudentDocIds(): Promise<void> {
  console.log('='.repeat(60));
  console.log('학생 문서 ID 정규화 스크립트');
  console.log(`모드: ${DRY_RUN ? 'DRY RUN (테스트)' : '실제 실행'}`);
  console.log('='.repeat(60));

  // 1. 모든 학생 조회
  const studentsRef = collection(db, 'students');
  const studentsSnapshot = await getDocs(studentsRef);

  console.log(`\n총 학생 수: ${studentsSnapshot.size}명`);

  // 2. 정상 ID 목록 먼저 수집 (이미 올바른 형식의 문서들)
  const existingCorrectIds = new Set<string>();
  const alreadyCorrect: string[] = [];

  for (const docSnap of studentsSnapshot.docs) {
    const oldId = docSnap.id;
    if (isValidDocIdFormat(oldId)) {
      existingCorrectIds.add(oldId);
      alreadyCorrect.push(oldId);
    }
  }

  console.log(`✅ 이미 정상 ID: ${alreadyCorrect.length}명`);

  // 3. 변환 필요한 학생 목록 생성
  const migrationList: MigrationResult[] = [];

  for (const docSnap of studentsSnapshot.docs) {
    const student = docSnap.data() as UnifiedStudent;
    const oldId = docSnap.id;

    // 이미 올바른 형식이면 스킵
    if (isValidDocIdFormat(oldId)) {
      continue;
    }

    const newId = generateNewDocId(student);

    // 이미 올바른 ID를 가진 문서가 존재하는지 확인
    if (existingCorrectIds.has(newId)) {
      // 이미 존재함 → 이 문서는 중복이므로 삭제 대상
      migrationList.push({
        oldId,
        newId,
        studentName: student.name,
        school: student.school || '',
        grade: student.grade || '',
        action: 'DELETE', // 삭제
        hasConsultations: 0
      });
    } else {
      // 존재하지 않음 → 새 ID로 이동
      existingCorrectIds.add(newId); // 이동 후 중복 방지
      migrationList.push({
        oldId,
        newId,
        studentName: student.name,
        school: student.school || '',
        grade: student.grade || '',
        action: 'MOVE', // 이동
        hasConsultations: 0
      });
    }
  }

  const deleteList = migrationList.filter(m => m.action === 'DELETE');
  const moveList = migrationList.filter(m => m.action === 'MOVE');

  console.log(`🗑️ 삭제 대상 (중복): ${deleteList.length}명`);
  console.log(`🔄 이동 대상: ${moveList.length}명`);

  if (migrationList.length === 0) {
    console.log('\n모든 학생 ID가 이미 올바른 형식입니다.');
    return;
  }

  // 4. 상담 기록 확인 (studentId 참조)
  console.log('\n상담 기록 확인 중...');
  const consultationsRef = collection(db, 'student_consultations');
  const consultationsSnapshot = await getDocs(consultationsRef);

  const consultationsByStudentId = new Map<string, string[]>();
  consultationsSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.studentId) {
      const list = consultationsByStudentId.get(data.studentId) || [];
      list.push(docSnap.id);
      consultationsByStudentId.set(data.studentId, list);
    }
  });

  // 상담 기록 수 업데이트
  for (const item of migrationList) {
    const consultationIds = consultationsByStudentId.get(item.oldId) || [];
    item.hasConsultations = consultationIds.length;
  }

  // 5. 변환 목록 출력
  console.log('\n' + '='.repeat(80));
  console.log('🗑️ 삭제 대상 (이미 올바른 ID가 존재하는 중복 문서):');
  console.log('-'.repeat(80));
  if (deleteList.length > 0) {
    console.log('이름\t\t학교\t\t학년\t상담\t삭제될 ID');
    console.log('-'.repeat(80));
    for (const item of deleteList) {
      console.log(
        `${item.studentName}\t\t${item.school || '-'}\t\t${item.grade || '-'}\t${item.hasConsultations}건\t${item.oldId.substring(0, 20)}...`
      );
    }
  } else {
    console.log('없음');
  }

  console.log('\n' + '='.repeat(80));
  console.log('🔄 이동 대상 (새 ID로 변환):');
  console.log('-'.repeat(80));
  if (moveList.length > 0) {
    console.log('이름\t\t학교\t\t학년\t상담\t기존ID → 새ID');
    console.log('-'.repeat(80));
    for (const item of moveList) {
      console.log(
        `${item.studentName}\t\t${item.school || '-'}\t\t${item.grade || '-'}\t${item.hasConsultations}건\t${item.oldId.substring(0, 10)}... → ${item.newId}`
      );
    }
  } else {
    console.log('없음');
  }

  if (DRY_RUN) {
    console.log('\n' + '='.repeat(60));
    console.log('DRY RUN 완료. 실제 변경을 원하면 DRY_RUN = false로 설정하세요.');
    console.log('='.repeat(60));
    return;
  }

  // 6. 실제 마이그레이션 실행
  console.log('\n마이그레이션 실행 중...');

  let processed = 0;
  const batches = Math.ceil(migrationList.length / BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const batch = writeBatch(db);
    const chunk = migrationList.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

    for (const item of chunk) {
      const oldDocRef = doc(db, 'students', item.oldId);
      const consultationIds = consultationsByStudentId.get(item.oldId) || [];

      if (item.action === 'DELETE') {
        // 중복 문서 삭제
        batch.delete(oldDocRef);

        // 상담 기록의 studentId를 새 ID로 업데이트 (올바른 문서로 연결)
        for (const consultationId of consultationIds) {
          const consultationRef = doc(db, 'student_consultations', consultationId);
          batch.update(consultationRef, {
            studentId: item.newId, // 이미 존재하는 올바른 ID로 변경
            _studentIdMigratedFrom: item.oldId,
          });
        }
      } else {
        // 새 ID로 이동
        const oldDocSnap = studentsSnapshot.docs.find(d => d.id === item.oldId);
        if (!oldDocSnap) continue;

        const studentData = oldDocSnap.data() as UnifiedStudent;

        // 새 문서 생성
        const newDocRef = doc(db, 'students', item.newId);
        batch.set(newDocRef, {
          ...studentData,
          id: item.newId,
          updatedAt: new Date().toISOString(),
          _migratedFrom: item.oldId,
        });

        // 기존 문서 삭제
        batch.delete(oldDocRef);

        // 상담 기록 업데이트
        for (const consultationId of consultationIds) {
          const consultationRef = doc(db, 'student_consultations', consultationId);
          batch.update(consultationRef, {
            studentId: item.newId,
            _studentIdMigratedFrom: item.oldId,
          });
        }
      }

      processed++;
    }

    await batch.commit();
    console.log(`진행률: ${Math.round((processed / migrationList.length) * 100)}% (${processed}/${migrationList.length})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('마이그레이션 완료!');
  console.log(`- 삭제된 중복 문서: ${deleteList.length}명`);
  console.log(`- ID 변환된 문서: ${moveList.length}명`);
  console.log(`- 상담 기록 업데이트: ${migrationList.reduce((sum, i) => sum + i.hasConsultations, 0)}건`);
  console.log('='.repeat(60));
}

/**
 * 브라우저 콘솔에서 실행하기 위한 전역 함수
 */
if (typeof window !== 'undefined') {
  (window as any).normalizeStudentDocIds = normalizeStudentDocIds;
  console.log('normalizeStudentDocIds() 함수가 등록되었습니다. 콘솔에서 실행하세요.');
}

export default normalizeStudentDocIds;
