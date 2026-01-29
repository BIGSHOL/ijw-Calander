/**
 * 숫자 ID 중복 학생 삭제 스크립트
 *
 * 로직:
 * 1. 숫자 ID (4-6자리) 학생들 찾기
 * 2. 해당 학생의 이름_학교_학년으로 시맨틱 ID 학생이 존재하는지 확인
 * 3. 이미 존재하면 → 숫자 ID 학생은 중복이므로 삭제
 *
 * 주의:
 * - enrollments 서브컬렉션도 함께 삭제됨
 * - DRY_RUN=true로 먼저 확인 필수
 */

import {
  collection,
  getDocs,
  doc,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent } from '../types';

interface DuplicateInfo {
  numericId: string;
  semanticId: string;
  name: string;
  school: string;
  grade: string;
  status: string;
  enrollmentCount: number;
}

/**
 * 숫자 ID인지 확인 (4-6자리 숫자)
 */
function isNumericId(id: string): boolean {
  return /^\d{4,6}$/.test(id);
}

/**
 * 시맨틱 ID 생성
 */
function toSemanticId(student: UnifiedStudent): string {
  const name = (student.name || '').trim();
  const school = (student.school || '').trim();
  const grade = (student.grade || '').trim();
  return `${name}_${school}_${grade}`;
}

/**
 * 숫자 ID 중복 학생 분석
 */
export async function analyzeNumericDuplicates(): Promise<DuplicateInfo[]> {
  console.log('='.repeat(60));
  console.log('🔍 숫자 ID 중복 학생 분석');
  console.log('='.repeat(60));

  const studentsRef = collection(db, 'students');
  const snapshot = await getDocs(studentsRef);

  // 시맨틱 ID 학생들 먼저 수집
  const semanticIds = new Set<string>();
  const numericStudents: Array<{ id: string; data: UnifiedStudent }> = [];

  for (const docSnap of snapshot.docs) {
    const id = docSnap.id;
    const data = docSnap.data() as UnifiedStudent;

    if (isNumericId(id)) {
      numericStudents.push({ id, data });
    } else {
      // 시맨틱 ID로 저장 (정확한 ID 저장)
      semanticIds.add(id);
      // 이름_학교_학년 조합도 저장 (변형된 형태 체크용)
      const semanticKey = toSemanticId(data);
      semanticIds.add(semanticKey);
    }
  }

  console.log(`\n총 학생: ${snapshot.size}명`);
  console.log(`숫자 ID: ${numericStudents.length}명`);
  console.log(`시맨틱 ID: ${snapshot.size - numericStudents.length}명`);

  // 중복 찾기
  const duplicates: DuplicateInfo[] = [];

  for (const { id, data } of numericStudents) {
    const semanticKey = toSemanticId(data);

    // 시맨틱 ID나 이름_학교_학년 조합이 이미 존재하면 중복
    if (semanticIds.has(semanticKey)) {
      duplicates.push({
        numericId: id,
        semanticId: semanticKey,
        name: data.name || '',
        school: data.school || '',
        grade: data.grade || '',
        status: data.status || 'active',
        enrollmentCount: data.enrollments?.length || 0
      });
    }
  }

  console.log(`\n⚠️ 삭제 대상 (중복): ${duplicates.length}명`);

  if (duplicates.length > 0) {
    console.log('\n삭제 대상 목록:');
    console.table(duplicates.map(d => ({
      숫자ID: d.numericId,
      이름: d.name,
      학교: d.school,
      학년: d.grade,
      상태: d.status,
      수강: d.enrollmentCount,
      원본ID: d.semanticId.substring(0, 25)
    })));
  }

  // 삭제 안 되는 숫자 ID (시맨틱 ID가 없는 경우)
  const nonDuplicateNumeric = numericStudents.filter(
    ns => !duplicates.find(d => d.numericId === ns.id)
  );

  if (nonDuplicateNumeric.length > 0) {
    console.log(`\n✅ 유지될 숫자 ID (원본 없음): ${nonDuplicateNumeric.length}명`);
    console.table(nonDuplicateNumeric.slice(0, 20).map(ns => ({
      숫자ID: ns.id,
      이름: ns.data.name,
      학교: ns.data.school,
      학년: ns.data.grade,
      상태: ns.data.status
    })));
    if (nonDuplicateNumeric.length > 20) {
      console.log(`... 외 ${nonDuplicateNumeric.length - 20}명`);
    }
  }

  return duplicates;
}

/**
 * 숫자 ID 중복 학생 삭제 실행
 */
export async function deleteNumericDuplicates(dryRun: boolean = true): Promise<void> {
  console.log('='.repeat(60));
  console.log('🗑️ 숫자 ID 중복 학생 삭제');
  console.log(`모드: ${dryRun ? 'DRY RUN (테스트)' : '⚠️ 실제 삭제'}`);
  console.log('='.repeat(60));

  const duplicates = await analyzeNumericDuplicates();

  if (duplicates.length === 0) {
    console.log('\n삭제할 중복 학생이 없습니다.');
    return;
  }

  console.log(`\n삭제 대상: ${duplicates.length}명`);

  if (dryRun) {
    console.log('\n' + '='.repeat(60));
    console.log('DRY RUN 완료.');
    console.log('실제 삭제: deleteNumericDuplicates(false)');
    console.log('='.repeat(60));
    return;
  }

  // 최종 확인
  const confirmed = confirm(`정말로 ${duplicates.length}명의 중복 학생을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
  if (!confirmed) {
    console.log('취소됨');
    return;
  }

  console.log('\n삭제 진행 중...');

  let deleted = 0;
  let errors = 0;

  for (const dup of duplicates) {
    try {
      // 1. enrollments 서브컬렉션 삭제
      const enrollmentsRef = collection(db, 'students', dup.numericId, 'enrollments');
      const enrollmentsSnap = await getDocs(enrollmentsRef);

      if (enrollmentsSnap.size > 0) {
        const batch = writeBatch(db);
        enrollmentsSnap.docs.forEach(enrollDoc => {
          batch.delete(enrollDoc.ref);
        });
        await batch.commit();
      }

      // 2. 학생 문서 삭제
      await deleteDoc(doc(db, 'students', dup.numericId));

      deleted++;

      if (deleted % 10 === 0) {
        console.log(`진행: ${deleted}/${duplicates.length}`);
      }
    } catch (error) {
      console.error(`오류 (${dup.numericId}):`, error);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 삭제 완료!');
  console.log(`  - 삭제됨: ${deleted}명`);
  console.log(`  - 오류: ${errors}건`);
  console.log('='.repeat(60));
}

/**
 * 모든 숫자 ID 학생 삭제 (시맨틱 ID 존재 여부 무관)
 * 주의: 시맨틱 ID가 없는 숫자 ID 학생도 삭제됨!
 */
export async function deleteAllNumericIds(dryRun: boolean = true): Promise<void> {
  console.log('='.repeat(60));
  console.log('🗑️ 모든 숫자 ID 학생 삭제');
  console.log(`모드: ${dryRun ? 'DRY RUN (테스트)' : '⚠️ 실제 삭제'}`);
  console.log('='.repeat(60));

  const studentsRef = collection(db, 'students');
  const snapshot = await getDocs(studentsRef);

  const numericStudents = snapshot.docs.filter(d => isNumericId(d.id));

  console.log(`\n총 학생: ${snapshot.size}명`);
  console.log(`삭제 대상 (숫자 ID): ${numericStudents.length}명`);

  if (numericStudents.length === 0) {
    console.log('\n삭제할 숫자 ID 학생이 없습니다.');
    return;
  }

  console.log('\n삭제 대상:');
  console.table(numericStudents.slice(0, 30).map(d => {
    const data = d.data() as UnifiedStudent;
    return {
      ID: d.id,
      이름: data.name,
      학교: data.school,
      학년: data.grade,
      상태: data.status,
      수강: data.enrollments?.length || 0
    };
  }));

  if (numericStudents.length > 30) {
    console.log(`... 외 ${numericStudents.length - 30}명`);
  }

  if (dryRun) {
    console.log('\n' + '='.repeat(60));
    console.log('DRY RUN 완료.');
    console.log('실제 삭제: deleteAllNumericIds(false)');
    console.log('='.repeat(60));
    return;
  }

  const confirmed = confirm(`⚠️ 경고: 숫자 ID 학생 ${numericStudents.length}명 전체를 삭제합니다.\n시맨틱 ID가 없는 학생도 삭제됩니다!\n\n정말로 진행하시겠습니까?`);
  if (!confirmed) {
    console.log('취소됨');
    return;
  }

  console.log('\n삭제 진행 중...');

  let deleted = 0;
  let errors = 0;

  for (const docSnap of numericStudents) {
    try {
      const enrollmentsRef = collection(db, 'students', docSnap.id, 'enrollments');
      const enrollmentsSnap = await getDocs(enrollmentsRef);

      if (enrollmentsSnap.size > 0) {
        const batch = writeBatch(db);
        enrollmentsSnap.docs.forEach(enrollDoc => {
          batch.delete(enrollDoc.ref);
        });
        await batch.commit();
      }

      await deleteDoc(doc(db, 'students', docSnap.id));
      deleted++;

      if (deleted % 10 === 0) {
        console.log(`진행: ${deleted}/${numericStudents.length}`);
      }
    } catch (error) {
      console.error(`오류 (${docSnap.id}):`, error);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 삭제 완료!');
  console.log(`  - 삭제됨: ${deleted}명`);
  console.log(`  - 오류: ${errors}건`);
  console.log('='.repeat(60));
}

// 브라우저 전역 등록
if (typeof window !== 'undefined') {
  (window as any).analyzeNumericDuplicates = analyzeNumericDuplicates;
  (window as any).deleteNumericDuplicates = deleteNumericDuplicates;
  (window as any).deleteAllNumericIds = deleteAllNumericIds;
  console.log('🗑️ 숫자 ID 중복 삭제 함수 등록됨:');
  console.log('  - analyzeNumericDuplicates(): 분석만');
  console.log('  - deleteNumericDuplicates(dryRun): 중복만 삭제');
  console.log('  - deleteAllNumericIds(dryRun): 숫자ID 전체 삭제');
}

export default deleteNumericDuplicates;
