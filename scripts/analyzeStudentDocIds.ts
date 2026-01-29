/**
 * 학생 문서 ID 분석 스크립트
 *
 * 목적:
 * - students 컬렉션의 문서 ID 패턴 분석
 * - ID와 name 필드 불일치 감지
 * - 중복 병합 전 데이터 정리 지원
 *
 * 분석 항목:
 * 1. ID 유형 분류 (시맨틱 / 숫자 / 자동생성)
 * 2. ID와 name 필드 불일치 감지
 * 3. 같은 name을 가진 다른 ID 문서들 (실제 중복)
 *
 * 실행 방법:
 * 브라우저 콘솔에서: analyzeStudentDocIds()
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

// ID 유형
type IdType = 'SEMANTIC' | 'NUMERIC' | 'AUTO_GENERATED' | 'MIXED';

interface StudentAnalysis {
  id: string;
  name: string;
  school: string;
  grade: string;
  idType: IdType;
  idMatchesName: boolean;  // ID의 이름 부분이 name 필드와 일치하는지
  expectedId: string;      // 예상되는 올바른 ID
  enrollmentCount: number;
  status: string;
}

interface AnalysisResult {
  total: number;
  byType: Record<IdType, StudentAnalysis[]>;
  mismatches: StudentAnalysis[];  // ID와 name 불일치
  duplicateNames: Map<string, StudentAnalysis[]>;  // 같은 이름_학교_학년
}

/**
 * 문서 ID 유형 판별
 */
function getIdType(docId: string): IdType {
  // 시맨틱 ID: 한글이름_학교_학년
  if (/^[가-힣]+[A-Za-z]*_/.test(docId)) {
    return 'SEMANTIC';
  }
  // 숫자 ID: 출석번호 (4-6자리 숫자)
  if (/^\d{4,6}$/.test(docId)) {
    return 'NUMERIC';
  }
  // 자동생성 ID: Firebase 랜덤 (20자 이상 영숫자)
  if (/^[A-Za-z0-9]{15,}$/.test(docId)) {
    return 'AUTO_GENERATED';
  }
  // 기타 (혼합)
  return 'MIXED';
}

/**
 * 예상 ID 생성
 */
function generateExpectedId(student: UnifiedStudent): string {
  const name = (student.name || '미상').trim();
  const school = (student.school || '').trim();
  const grade = (student.grade || '').trim();
  return `${name}_${school}_${grade}`;
}

/**
 * ID에서 이름 부분 추출
 */
function extractNameFromId(docId: string): string | null {
  // 시맨틱 ID에서 이름 추출 (첫 번째 _ 앞부분)
  const match = docId.match(/^([가-힣]+[A-Za-z]*)/);
  return match ? match[1].replace(/[A-Za-z]+$/, '') : null;  // 영문 접미사 제거
}

/**
 * 메인 분석 함수
 */
export async function analyzeStudentDocIds(): Promise<AnalysisResult> {
  console.log('='.repeat(60));
  console.log('📊 학생 문서 ID 분석');
  console.log('='.repeat(60));

  const studentsRef = collection(db, 'students');
  const snapshot = await getDocs(studentsRef);

  const result: AnalysisResult = {
    total: snapshot.size,
    byType: {
      SEMANTIC: [],
      NUMERIC: [],
      AUTO_GENERATED: [],
      MIXED: []
    },
    mismatches: [],
    duplicateNames: new Map()
  };

  console.log(`\n총 학생 수: ${snapshot.size}명`);

  // 1. 모든 학생 분석
  const analyses: StudentAnalysis[] = [];

  for (const docSnap of snapshot.docs) {
    const student = docSnap.data() as UnifiedStudent;
    const docId = docSnap.id;

    const idType = getIdType(docId);
    const expectedId = generateExpectedId(student);
    const nameFromId = extractNameFromId(docId);

    // ID에서 추출한 이름과 name 필드 비교
    const idMatchesName = nameFromId === null || nameFromId === student.name?.trim();

    const analysis: StudentAnalysis = {
      id: docId,
      name: student.name || '',
      school: student.school || '',
      grade: student.grade || '',
      idType,
      idMatchesName,
      expectedId,
      enrollmentCount: student.enrollments?.length || 0,
      status: student.status || 'active'
    };

    analyses.push(analysis);

    // 유형별 분류
    result.byType[idType].push(analysis);

    // 불일치 감지
    if (!idMatchesName) {
      result.mismatches.push(analysis);
    }

    // 중복 이름 수집 (이름_학교_학년 기준)
    const nameKey = expectedId;
    if (!result.duplicateNames.has(nameKey)) {
      result.duplicateNames.set(nameKey, []);
    }
    result.duplicateNames.get(nameKey)!.push(analysis);
  }

  // 2명 이상인 경우만 중복으로 간주
  for (const [key, students] of result.duplicateNames.entries()) {
    if (students.length < 2) {
      result.duplicateNames.delete(key);
    }
  }

  // 2. 결과 출력
  console.log('\n' + '='.repeat(60));
  console.log('📋 ID 유형별 분포');
  console.log('-'.repeat(60));
  console.log(`  시맨틱 (이름_학교_학년): ${result.byType.SEMANTIC.length}명`);
  console.log(`  숫자 (출석번호): ${result.byType.NUMERIC.length}명`);
  console.log(`  자동생성 (Firebase): ${result.byType.AUTO_GENERATED.length}명`);
  console.log(`  기타: ${result.byType.MIXED.length}명`);

  console.log('\n' + '='.repeat(60));
  console.log('⚠️ ID-이름 불일치 목록');
  console.log('-'.repeat(60));
  if (result.mismatches.length === 0) {
    console.log('  없음 ✅');
  } else {
    console.log(`  총 ${result.mismatches.length}건 발견`);
    console.log('-'.repeat(60));
    console.table(result.mismatches.slice(0, 30).map(m => ({
      문서ID: m.id.substring(0, 25) + (m.id.length > 25 ? '...' : ''),
      실제이름: m.name,
      학교: m.school,
      학년: m.grade,
      수강수: m.enrollmentCount
    })));
    if (result.mismatches.length > 30) {
      console.log(`  ... 외 ${result.mismatches.length - 30}건`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🔄 실제 중복 (같은 이름_학교_학년)');
  console.log('-'.repeat(60));
  console.log(`  ${result.duplicateNames.size}개 그룹 발견`);

  if (result.duplicateNames.size > 0) {
    let shown = 0;
    for (const [key, students] of result.duplicateNames.entries()) {
      if (shown >= 10) {
        console.log(`  ... 외 ${result.duplicateNames.size - 10}개 그룹`);
        break;
      }
      console.log(`\n  📌 ${key} (${students.length}명):`);
      students.forEach(s => {
        console.log(`     - ${s.id} [${s.idType}] ${s.status} (수강: ${s.enrollmentCount})`);
      });
      shown++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 권장 조치');
  console.log('-'.repeat(60));

  if (result.mismatches.length > 0) {
    console.log(`  1. ID-이름 불일치 ${result.mismatches.length}건 수정 필요`);
    console.log('     → fixMismatchedIds() 실행');
  }

  if (result.byType.NUMERIC.length > 0 || result.byType.AUTO_GENERATED.length > 0) {
    const nonSemanticCount = result.byType.NUMERIC.length + result.byType.AUTO_GENERATED.length;
    console.log(`  2. 비시맨틱 ID ${nonSemanticCount}건을 시맨틱 ID로 변환 권장`);
    console.log('     → normalizeStudentDocIds() 실행');
  }

  if (result.duplicateNames.size > 0) {
    console.log(`  3. 중복 학생 ${result.duplicateNames.size}개 그룹 병합 필요`);
    console.log('     → 학생관리 > 병합 버튼 사용');
  }

  console.log('='.repeat(60));

  return result;
}

/**
 * ID-이름 불일치 문서 수정
 * 문서 ID의 이름 부분을 실제 name 필드와 일치하도록 변경
 */
export async function fixMismatchedIds(dryRun: boolean = true): Promise<void> {
  console.log('='.repeat(60));
  console.log('🔧 ID-이름 불일치 수정');
  console.log(`모드: ${dryRun ? 'DRY RUN (테스트)' : '실제 실행'}`);
  console.log('='.repeat(60));

  const analysis = await analyzeStudentDocIds();

  if (analysis.mismatches.length === 0) {
    console.log('\n수정할 불일치가 없습니다.');
    return;
  }

  console.log(`\n수정 대상: ${analysis.mismatches.length}건`);

  // 기존 ID들 수집 (중복 방지)
  const studentsRef = collection(db, 'students');
  const snapshot = await getDocs(studentsRef);
  const existingIds = new Set(snapshot.docs.map(d => d.id));

  const changes: Array<{
    oldId: string;
    newId: string;
    student: StudentAnalysis;
    action: 'MOVE' | 'DELETE';
  }> = [];

  for (const mismatch of analysis.mismatches) {
    let newId = mismatch.expectedId;
    let counter = 1;

    // 새 ID가 이미 존재하면 접미사 추가
    while (existingIds.has(newId) && newId !== mismatch.id) {
      counter++;
      newId = `${mismatch.expectedId}_${counter}`;
    }

    if (newId === mismatch.id) {
      // 동일한 ID면 스킵
      continue;
    }

    existingIds.add(newId);

    changes.push({
      oldId: mismatch.id,
      newId,
      student: mismatch,
      action: 'MOVE'
    });
  }

  console.log('\n변경 목록:');
  console.table(changes.slice(0, 20).map(c => ({
    기존ID: c.oldId.substring(0, 20) + '...',
    새ID: c.newId,
    이름: c.student.name,
    수강: c.student.enrollmentCount
  })));

  if (changes.length > 20) {
    console.log(`... 외 ${changes.length - 20}건`);
  }

  if (dryRun) {
    console.log('\nDRY RUN 완료. 실제 실행: fixMismatchedIds(false)');
    return;
  }

  // 실제 실행
  console.log('\n실행 중...');

  let processed = 0;
  for (const change of changes) {
    try {
      const oldDocSnap = snapshot.docs.find(d => d.id === change.oldId);
      if (!oldDocSnap) continue;

      const studentData = oldDocSnap.data();

      // 배치 사용
      const batch = writeBatch(db);

      // 새 문서 생성
      const newDocRef = doc(db, 'students', change.newId);
      batch.set(newDocRef, {
        ...studentData,
        id: change.newId,
        updatedAt: new Date().toISOString(),
        _migratedFrom: change.oldId,
      });

      // 기존 문서 삭제
      batch.delete(doc(db, 'students', change.oldId));

      // enrollments 서브컬렉션 이동
      const oldEnrollmentsSnap = await getDocs(
        collection(db, 'students', change.oldId, 'enrollments')
      );

      for (const enrollDoc of oldEnrollmentsSnap.docs) {
        const newEnrollRef = doc(db, 'students', change.newId, 'enrollments', enrollDoc.id);
        batch.set(newEnrollRef, enrollDoc.data());
        batch.delete(enrollDoc.ref);
      }

      await batch.commit();
      processed++;

      if (processed % 10 === 0) {
        console.log(`진행: ${processed}/${changes.length}`);
      }
    } catch (error) {
      console.error(`오류 (${change.oldId}):`, error);
    }
  }

  console.log(`\n✅ 완료: ${processed}건 수정됨`);
}

/**
 * 숫자 ID 학생들의 상세 정보 출력
 */
export async function showNumericIdStudents(): Promise<void> {
  const analysis = await analyzeStudentDocIds();
  const numericStudents = analysis.byType.NUMERIC;

  console.log('\n' + '='.repeat(60));
  console.log(`📋 숫자 ID 학생 상세 (${numericStudents.length}명)`);
  console.log('='.repeat(60));

  if (numericStudents.length === 0) {
    console.log('없음');
    return;
  }

  console.table(numericStudents.map(s => ({
    ID: s.id,
    이름: s.name,
    학교: s.school,
    학년: s.grade,
    상태: s.status,
    수강: s.enrollmentCount,
    예상ID: s.expectedId
  })));
}

// 브라우저 전역 등록
if (typeof window !== 'undefined') {
  (window as any).analyzeStudentDocIds = analyzeStudentDocIds;
  (window as any).fixMismatchedIds = fixMismatchedIds;
  (window as any).showNumericIdStudents = showNumericIdStudents;
  console.log('📊 학생 ID 분석 함수 등록됨:');
  console.log('  - analyzeStudentDocIds(): 전체 분석');
  console.log('  - fixMismatchedIds(dryRun): ID-이름 불일치 수정');
  console.log('  - showNumericIdStudents(): 숫자 ID 학생 목록');
}

export default analyzeStudentDocIds;
