/**
 * 영어 수업 subject 수정 스크립트
 *
 * 문제: 모든 enrollments의 subject가 'math'로 되어 있음
 * 해결: 수업목록 컬렉션의 subject 정보를 기반으로 enrollments의 subject 수정
 *
 * 실행 방법:
 * npx tsx scripts/fixEnglishSubjects.ts
 */

import { db, auth } from '../firebaseConfig.js';
import {
  collection,
  getDocs,
  collectionGroup,
  doc,
  updateDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

interface Stats {
  totalEnrollments: number;
  mathEnrollments: number;
  englishEnrollments: number;
  updatedToEnglish: number;
  errors: string[];
}

const stats: Stats = {
  totalEnrollments: 0,
  mathEnrollments: 0,
  englishEnrollments: 0,
  updatedToEnglish: 0,
  errors: []
};

/**
 * 과목 추론 (수업 이름 패턴 기반)
 */
function inferSubjectFromClassName(className: string): 'math' | 'english' {
  const englishPatterns = [
    /^DP/, /^PL/, /^LE/, /^RTT/, /^RW/, /^GR/, /^VT/,  // 영어 레벨 약어
    /^E_/,  // E_로 시작
    /phonics/i, /grammar/i, /reading/i, /writing/i,
    /초등\s*브릿지/,  // 초등 브릿지
    /중등E/,  // 중등E
  ];

  for (const pattern of englishPatterns) {
    if (pattern.test(className)) {
      return 'english';
    }
  }

  return 'math';
}

/**
 * 모든 enrollments 조회 및 subject 수정
 */
async function fixEnrollmentSubjects() {
  console.log('\n📋 모든 enrollments 조회 중...');

  try {
    // collectionGroup으로 모든 enrollments 조회
    const enrollmentsSnapshot = await getDocs(collectionGroup(db, 'enrollments'));
    stats.totalEnrollments = enrollmentsSnapshot.docs.length;

    console.log(`   발견된 enrollments: ${stats.totalEnrollments}개\n`);

    for (const enrollmentDoc of enrollmentsSnapshot.docs) {
      const data = enrollmentDoc.data();
      const currentSubject = data.subject || 'math';
      const className = data.className || '';
      const studentId = enrollmentDoc.ref.parent.parent?.id || 'unknown';

      // 추론된 과목
      const inferredSubject = inferSubjectFromClassName(className);

      // 통계
      if (currentSubject === 'math') {
        stats.mathEnrollments++;
      } else {
        stats.englishEnrollments++;
      }

      // 수정 필요 여부 확인
      if (currentSubject !== inferredSubject) {
        try {
          console.log(`   🔄 수정: ${className} (${studentId})`);
          console.log(`      현재: ${currentSubject} → 변경: ${inferredSubject}`);

          await updateDoc(enrollmentDoc.ref, {
            subject: inferredSubject,
            updatedAt: Timestamp.now(),
            subjectFixedAt: Timestamp.now()
          });

          stats.updatedToEnglish++;
        } catch (error: any) {
          const errorMsg = `${className} (${studentId}): ${error.message}`;
          console.error(`   ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
    }

    console.log('\n✅ subject 수정 완료!');

  } catch (error: any) {
    console.error(`❌ enrollments 조회 실패:`, error);
    stats.errors.push(`전체 실패: ${error.message}`);
  }
}

/**
 * 결과 출력
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 수정 결과 요약');
  console.log('='.repeat(60));
  console.log(`총 enrollments: ${stats.totalEnrollments}개`);
  console.log(`수학 (math): ${stats.mathEnrollments}개`);
  console.log(`영어 (english): ${stats.englishEnrollments}개`);
  console.log(`영어로 수정됨: ${stats.updatedToEnglish}개`);
  console.log(`에러: ${stats.errors.length}개`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️ 발생한 에러:');
    stats.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }

  console.log('='.repeat(60));
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 영어 수업 subject 수정 시작');
  console.log('⚠️  enrollment의 subject 필드를 className 패턴 기반으로 수정합니다.\n');

  const startTime = Date.now();

  try {
    // 인증
    console.log('🔑 인증 시도 중...');
    await signInAnonymously(auth);
    console.log('✅ 익명 로그인 성공\n');

    // 수정 실행
    await fixEnrollmentSubjects();

    // 결과 출력
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  총 소요 시간: ${duration}초`);

    printSummary();

    console.log('\n✅ 완료!');
    console.log('💡 다음 단계: 브라우저를 새로고침하고 수업 배정 모달에서 확인하세요.');

  } catch (error: any) {
    console.error('\n❌ 치명적 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main().then(() => {
  console.log('\n프로그램 종료');
  process.exit(0);
}).catch((error) => {
  console.error('예상치 못한 오류:', error);
  process.exit(1);
});
