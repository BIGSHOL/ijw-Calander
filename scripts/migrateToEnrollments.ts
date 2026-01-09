/**
 * 데이터 마이그레이션 스크립트
 *
 * 기존 구조:
 * - 수업목록/{classId} → students: ["학생1", "학생2"]
 * - english_schedules/{teacher} → merged: [{ students: [...] }]
 *
 * 새 구조:
 * - students/{studentId}/enrollments/{enrollmentId}
 *
 * 실행 방법:
 * npx tsx scripts/migrateToEnrollments.ts
 */

// Environment variables are loaded via tsx --env-file flag
import { db, auth } from '../firebaseConfig.js';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  writeBatch,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

interface MigrationStats {
  mathEnrollments: number;
  englishEnrollments: number;
  studentsProcessed: Set<string>;
  errors: string[];
}

const stats: MigrationStats = {
  mathEnrollments: 0,
  englishEnrollments: 0,
  studentsProcessed: new Set(),
  errors: []
};

/**
 * 수학 시간표 마이그레이션
 * 수업목록 컬렉션의 students 배열 → students/{name}/enrollments
 */
async function migrateMathTimetable() {
  console.log('\n📘 수학 시간표 마이그레이션 시작...');

  try {
    const mathClassesSnapshot = await getDocs(collection(db, '수업목록'));
    console.log(`   발견된 수학 수업: ${mathClassesSnapshot.docs.length}개`);

    for (const classDoc of mathClassesSnapshot.docs) {
      const classData = classDoc.data();
      const students = classData.students || [];

      console.log(`   처리 중: ${classData.name} (학생 ${students.length}명)`);

      for (const studentName of students) {
        try {
          // students 컬렉션에 학생 문서가 없으면 생성
          const studentDocRef = doc(db, 'students', studentName);
          const studentDoc = await getDoc(studentDocRef);

          if (!studentDoc.exists()) {
            await setDoc(studentDocRef, {
              name: studentName,
              createdAt: Timestamp.now()
            });
            console.log(`   ✨ 학생 문서 생성: ${studentName}`);
          }

          // enrollment 생성
          const enrollmentRef = doc(
            collection(db, `students/${studentName}/enrollments`)
          );

          // [DEBUG] 데이터 구조 확인 로직 추가
          if (stats.mathEnrollments < 5) {
            console.log(`\n🔍 [DEBUG] Processing Class: ${classData.name || classData.className} (ID: ${classDoc.id})`);
            console.log(`   All Keys: ${Object.keys(classData).join(', ')}`);
            console.log(`   Raw Schedule:`, JSON.stringify(classData.schedule));

            if (!classData.schedule || classData.schedule.length === 0) {
              console.log(`   ⚠️ Schedule is empty! Checking other fields...`);
              const candidates = ['time', 'times', 'slots', 'timeSlots', 'mathSchedule', 'periods', 'dayTime'];
              candidates.forEach(key => {
                if (classData[key]) console.log(`      Found '${key}':`, JSON.stringify(classData[key]));
              });
            }
          }

          await setDoc(enrollmentRef, {
            subject: 'math',
            className: classData.className || classData.name || classDoc.id,
            teacherId: classData.teacher || '',
            schedule: classData.schedule || [],  // CRITICAL: 시간표 표시에 필요
            days: classData.days || [],
            period: classData.period || null,
            room: classData.room || null,
            startDate: classData.startDate || null,
            endDate: classData.endDate || null,
            color: classData.color || null,
            // 마이그레이션 메타데이터
            migratedAt: Timestamp.now(),
            migratedFrom: 'math_timetable',
            originalClassId: classDoc.id
          });

          stats.mathEnrollments++;
          stats.studentsProcessed.add(studentName);

        } catch (error: any) {
          const errorMsg = `수학 - ${classData.name} - ${studentName}: ${error.message}`;
          console.error(`   ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
    }

    console.log(`✅ 수학 마이그레이션 완료: ${stats.mathEnrollments}개 enrollment 생성`);
  } catch (error: any) {
    console.error(`❌ 수학 마이그레이션 실패:`, error);
    stats.errors.push(`수학 전체 실패: ${error.message}`);
  }
}

/**
 * 영어 시간표 마이그레이션
 * english_schedules/{teacher}/merged → students/{name}/enrollments
 */
async function migrateEnglishTimetable() {
  console.log('\n📗 영어 시간표 마이그레이션 시작...');

  try {
    const englishSchedulesSnapshot = await getDocs(collection(db, 'english_schedules'));
    console.log(`   발견된 영어 스케줄: ${englishSchedulesSnapshot.docs.length}개`);

    for (const scheduleDoc of englishSchedulesSnapshot.docs) {
      const scheduleData = scheduleDoc.data();
      const teacherName = scheduleDoc.id;
      const merged = scheduleData.merged || [];

      console.log(`   처리 중: ${teacherName} 강사 (${merged.length}개 수업)`);

      for (const classItem of merged) {
        const students = classItem.students || [];
        const className = classItem.className || classItem.class || '이름없음';

        for (const studentName of students) {
          try {
            // students 컬렉션에 학생 문서가 없으면 생성
            const studentDocRef = doc(db, 'students', studentName);
            const studentDoc = await getDoc(studentDocRef);

            if (!studentDoc.exists()) {
              await setDoc(studentDocRef, {
                name: studentName,
                createdAt: Timestamp.now()
              });
              console.log(`   ✨ 학생 문서 생성: ${studentName}`);
            }

            // enrollment 생성
            const enrollmentRef = doc(
              collection(db, `students/${studentName}/enrollments`)
            );

            await setDoc(enrollmentRef, {
              subject: 'english',
              className: className,
              teacherId: teacherName,
              days: classItem.days || [],
              period: classItem.period || null,
              room: classItem.room || null,
              startDate: classItem.startDate || null,
              endDate: classItem.endDate || null,
              color: classItem.color || null,
              // 마이그레이션 메타데이터
              migratedAt: Timestamp.now(),
              migratedFrom: 'english_schedule',
              originalTeacherId: teacherName
            });

            stats.englishEnrollments++;
            stats.studentsProcessed.add(studentName);

          } catch (error: any) {
            const errorMsg = `영어 - ${className} - ${studentName}: ${error.message}`;
            console.error(`   ❌ ${errorMsg}`);
            stats.errors.push(errorMsg);
          }
        }
      }
    }

    console.log(`✅ 영어 마이그레이션 완료: ${stats.englishEnrollments}개 enrollment 생성`);
  } catch (error: any) {
    console.error(`❌ 영어 마이그레이션 실패:`, error);
    stats.errors.push(`영어 전체 실패: ${error.message}`);
  }
}

/**
 * 마이그레이션 결과 출력
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 마이그레이션 결과 요약');
  console.log('='.repeat(60));
  console.log(`수학 enrollments 생성: ${stats.mathEnrollments}개`);
  console.log(`영어 enrollments 생성: ${stats.englishEnrollments}개`);
  console.log(`총 enrollments: ${stats.mathEnrollments + stats.englishEnrollments}개`);
  console.log(`처리된 학생: ${stats.studentsProcessed.size}명`);
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
  console.log('🚀 데이터 마이그레이션 시작');
  console.log('⚠️  기존 데이터는 보존됩니다. 새로운 enrollments 컬렉션이 생성됩니다.\n');

  const startTime = Date.now();

  try {
    // 0. 인증 (권한 문제 해결)
    console.log('🔑 인증 시도 중...');
    await signInAnonymously(auth);
    console.log('✅ 익명 로그인 성공');

    // 1. 수학 시간표 마이그레이션
    await migrateMathTimetable();

    // 2. 영어 시간표 마이그레이션
    await migrateEnglishTimetable();

    // 3. 결과 출력
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  총 소요 시간: ${duration}초`);

    printSummary();

    console.log('\n✅ 마이그레이션 완료!');
    console.log('💡 다음 단계: 설정 탭에서 "데이터 전환" 토글로 새 데이터를 테스트하세요.');

  } catch (error: any) {
    console.error('\n❌ 마이그레이션 중 치명적 오류 발생:', error);
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
