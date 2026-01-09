/**
 * 마이그레이션 검증 스크립트
 *
 * 기존 데이터와 새 enrollments 데이터를 비교하여
 * 마이그레이션이 올바르게 수행되었는지 검증합니다.
 *
 * 실행 방법:
 * npx tsx scripts/validateMigration.ts
 */

// Environment variables are loaded via tsx --env-file flag
import { db } from '../firebaseConfig.js';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface ValidationResult {
  studentName: string;
  legacy: {
    math: string[];
    english: string[];
  };
  migrated: {
    math: string[];
    english: string[];
  };
  match: boolean;
  issues: string[];
}

/**
 * 기존 방식으로 학생의 수업 목록 조회
 */
async function getLegacyEnrollments(studentName: string) {
  const mathClasses: string[] = [];
  const englishClasses: string[] = [];

  // 수학 시간표에서 조회
  const mathSnapshot = await getDocs(collection(db, '수업목록'));
  for (const doc of mathSnapshot.docs) {
    const data = doc.data();
    if (data.students?.includes(studentName)) {
      mathClasses.push(data.name || doc.id);
    }
  }

  // 영어 시간표에서 조회
  const englishSnapshot = await getDocs(collection(db, 'english_schedules'));
  for (const doc of englishSnapshot.docs) {
    const merged = doc.data().merged || [];
    for (const classItem of merged) {
      if (classItem.students?.includes(studentName)) {
        englishClasses.push(classItem.className || classItem.class || '이름없음');
      }
    }
  }

  return { math: mathClasses, english: englishClasses };
}

/**
 * 새 방식으로 학생의 수업 목록 조회
 */
async function getMigratedEnrollments(studentName: string) {
  const mathClasses: string[] = [];
  const englishClasses: string[] = [];

  try {
    const enrollmentsSnapshot = await getDocs(
      collection(db, `students/${studentName}/enrollments`)
    );

    for (const doc of enrollmentsSnapshot.docs) {
      const data = doc.data();
      if (data.subject === 'math') {
        mathClasses.push(data.className);
      } else if (data.subject === 'english') {
        englishClasses.push(data.className);
      }
    }
  } catch (error) {
    // 학생 문서가 없을 수 있음
    console.warn(`   ⚠️  ${studentName}: enrollments 없음`);
  }

  return { math: mathClasses, english: englishClasses };
}

/**
 * 두 배열이 동일한지 비교 (순서 무관)
 */
function arraysEqual(arr1: string[], arr2: string[]): boolean {
  if (arr1.length !== arr2.length) return false;
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  return sorted1.every((val, idx) => val === sorted2[idx]);
}

/**
 * 학생 한 명의 데이터 검증
 */
async function validateStudent(studentName: string): Promise<ValidationResult> {
  console.log(`   검증 중: ${studentName}`);

  const legacy = await getLegacyEnrollments(studentName);
  const migrated = await getMigratedEnrollments(studentName);

  const issues: string[] = [];
  let match = true;

  // 수학 비교
  if (!arraysEqual(legacy.math, migrated.math)) {
    match = false;
    issues.push(
      `수학 불일치 - 기존: [${legacy.math.join(', ')}] / 마이그: [${migrated.math.join(', ')}]`
    );
  }

  // 영어 비교
  if (!arraysEqual(legacy.english, migrated.english)) {
    match = false;
    issues.push(
      `영어 불일치 - 기존: [${legacy.english.join(', ')}] / 마이그: [${migrated.english.join(', ')}]`
    );
  }

  return {
    studentName,
    legacy,
    migrated,
    match,
    issues
  };
}

/**
 * 모든 학생 목록 수집
 */
async function getAllStudentNames(): Promise<Set<string>> {
  const studentNames = new Set<string>();

  // 수학 시간표에서 수집
  const mathSnapshot = await getDocs(collection(db, '수업목록'));
  for (const doc of mathSnapshot.docs) {
    const students = doc.data().students || [];
    students.forEach((name: string) => studentNames.add(name));
  }

  // 영어 시간표에서 수집
  const englishSnapshot = await getDocs(collection(db, 'english_schedules'));
  for (const doc of englishSnapshot.docs) {
    const merged = doc.data().merged || [];
    for (const classItem of merged) {
      const students = classItem.students || [];
      students.forEach((name: string) => studentNames.add(name));
    }
  }

  // students 컬렉션에서도 수집 (마이그레이션 후)
  const studentsSnapshot = await getDocs(collection(db, 'students'));
  for (const doc of studentsSnapshot.docs) {
    studentNames.add(doc.id);
  }

  return studentNames;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🔍 마이그레이션 검증 시작\n');

  const startTime = Date.now();

  // 모든 학생 수집
  console.log('📋 학생 목록 수집 중...');
  const studentNames = await getAllStudentNames();
  console.log(`   총 ${studentNames.size}명 발견\n`);

  // 각 학생별 검증
  const results: ValidationResult[] = [];
  for (const studentName of studentNames) {
    const result = await validateStudent(studentName);
    results.push(result);
  }

  // 결과 출력
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n⏱️  검증 소요 시간: ${duration}초\n`);

  console.log('='.repeat(60));
  console.log('📊 검증 결과 요약');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.match).length;
  const failed = results.filter(r => !r.match).length;

  console.log(`✅ 일치: ${passed}명`);
  console.log(`❌ 불일치: ${failed}명`);
  console.log(`총 검증: ${results.length}명`);

  if (failed > 0) {
    console.log('\n⚠️  불일치 상세:');
    results
      .filter(r => !r.match)
      .forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.studentName}`);
        result.issues.forEach(issue => {
          console.log(`   - ${issue}`);
        });
      });
  }

  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 모든 데이터가 정확히 마이그레이션되었습니다!');
    console.log('💡 설정 탭에서 "데이터 전환" 토글을 활성화해도 안전합니다.');
  } else {
    console.log('\n⚠️  일부 데이터에 문제가 있습니다. 위의 불일치 내역을 확인하세요.');
  }

  console.log('');
}

// 스크립트 실행
main().then(() => {
  console.log('프로그램 종료');
  process.exit(0);
}).catch((error) => {
  console.error('예상치 못한 오류:', error);
  process.exit(1);
});
