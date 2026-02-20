/**
 * Cleanup Script: Remove teacherId & teacherId_deprecated from Firestore
 *
 * Purpose:
 * - Migration from teacherId → staffId is complete
 * - Remove leftover teacherId and teacherId_deprecated fields from enrollment documents
 * - These fields exist in: students/{studentId}/enrollments/{enrollmentId}
 *
 * Usage:
 *   1. Preview mode (dry run): npx tsx scripts/cleanupTeacherIdFields.ts
 *   2. Execute mode:           npx tsx scripts/cleanupTeacherIdFields.ts --execute
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(require('../serviceAccountKey.json')),
});

const DATABASE_ID = 'restore260202';
const db = getFirestore(app, DATABASE_ID);

interface CleanupResult {
  studentId: string;
  studentName: string;
  enrollmentId: string;
  hadTeacherId: boolean;
  hadTeacherIdDeprecated: boolean;
  teacherIdValue?: string;
  teacherIdDeprecatedValue?: string;
}

async function cleanupTeacherIdFields(execute: boolean): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  teacherId Field Cleanup Script`);
  console.log(`  Mode: ${execute ? '🔴 EXECUTE (실제 삭제)' : '🟢 PREVIEW (미리보기)'}`);
  console.log(`  Database: ${DATABASE_ID}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Get all students
  const studentsSnap = await db.collection('students').get();
  console.log(`📊 총 학생 수: ${studentsSnap.size}`);

  const results: CleanupResult[] = [];
  let processedStudents = 0;

  // 2. Check each student's enrollments
  for (const studentDoc of studentsSnap.docs) {
    const studentData = studentDoc.data();
    const studentName = studentData.name || '(이름없음)';

    const enrollmentsSnap = await db
      .collection('students')
      .doc(studentDoc.id)
      .collection('enrollments')
      .get();

    for (const enrollDoc of enrollmentsSnap.docs) {
      const data = enrollDoc.data();
      const hasTeacherId = 'teacherId' in data;
      const hasTeacherIdDeprecated = 'teacherId_deprecated' in data;

      if (hasTeacherId || hasTeacherIdDeprecated) {
        results.push({
          studentId: studentDoc.id,
          studentName,
          enrollmentId: enrollDoc.id,
          hadTeacherId: hasTeacherId,
          hadTeacherIdDeprecated: hasTeacherIdDeprecated,
          teacherIdValue: data.teacherId,
          teacherIdDeprecatedValue: data.teacherId_deprecated,
        });
      }
    }

    processedStudents++;
    if (processedStudents % 50 === 0) {
      console.log(`  ... ${processedStudents}/${studentsSnap.size} 학생 처리 중`);
    }
  }

  // 3. Report
  console.log(`\n📋 결과 요약:`);
  console.log(`  - teacherId 필드가 있는 enrollment: ${results.filter(r => r.hadTeacherId).length}개`);
  console.log(`  - teacherId_deprecated 필드가 있는 enrollment: ${results.filter(r => r.hadTeacherIdDeprecated).length}개`);
  console.log(`  - 총 정리 대상: ${results.length}개 enrollment 문서\n`);

  if (results.length === 0) {
    console.log('✅ 정리할 teacherId 필드가 없습니다. 이미 깨끗합니다!');
    return;
  }

  // Show sample
  console.log('📌 샘플 (최대 10개):');
  results.slice(0, 10).forEach(r => {
    console.log(`  ${r.studentName} > ${r.enrollmentId}: teacherId=${r.teacherIdValue || '없음'}, deprecated=${r.teacherIdDeprecatedValue || '없음'}`);
  });

  if (!execute) {
    console.log(`\n⚠️  미리보기 모드입니다. 실제 삭제하려면:`);
    console.log(`    npx tsx scripts/cleanupTeacherIdFields.ts --execute\n`);
    return;
  }

  // 4. Execute deletion in batches
  console.log(`\n🔴 실제 삭제를 시작합니다...`);
  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = results.slice(i, i + BATCH_SIZE);

    for (const result of chunk) {
      const ref = db
        .collection('students')
        .doc(result.studentId)
        .collection('enrollments')
        .doc(result.enrollmentId);

      const updateData: Record<string, any> = {};
      if (result.hadTeacherId) updateData.teacherId = FieldValue.delete();
      if (result.hadTeacherIdDeprecated) updateData.teacherId_deprecated = FieldValue.delete();

      batch.update(ref, updateData);
    }

    await batch.commit();
    deleted += chunk.length;
    console.log(`  ✅ ${deleted}/${results.length} 문서 처리 완료`);
  }

  console.log(`\n🎉 완료! ${deleted}개 enrollment 문서에서 teacherId 필드를 삭제했습니다.`);
}

// Main
const execute = process.argv.includes('--execute');
cleanupTeacherIdFields(execute)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
