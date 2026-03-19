/**
 * Enrollment 데이터 일관성 수정 스크립트 (Firebase Admin SDK)
 *
 * 수정 항목:
 * 1. 불완전 enrollment 보완 (teacher/staffId/schedule/classId 누락 시 class 정보로 채움)
 * 2. 강사 불일치 수정 (enrollment teacher ≠ class teacher)
 *
 * 사용법: npx tsx scripts/fixEnrollmentData.ts
 * 드라이런: npx tsx scripts/fixEnrollmentData.ts --dry
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: 'ijw-calander',
  credential: applicationDefault()
});

const db = getFirestore(app, 'restore20260319');
const isDryRun = process.argv.includes('--dry');

interface FixAction {
  studentId: string;
  studentName: string;
  enrollmentId: string;
  className: string;
  subject: string;
  field: string;
  before: any;
  after: any;
}

async function fix() {
  console.log(`🔧 Enrollment 데이터 수정 (Admin SDK) ${isDryRun ? '(DRY RUN)' : ''}\n`);
  const today = new Date().toISOString().split('T')[0];

  // 1. Classes 로드
  console.log('📚 Classes 로드...');
  const classesSnap = await db.collection('classes').get();
  const classNameToClass = new Map<string, any>();

  classesSnap.forEach(d => {
    const data = d.data();
    const key = `${data.className}__${data.subject}`;
    classNameToClass.set(key, { id: d.id, ...data });
  });
  console.log(`  → ${classesSnap.size}개 수업\n`);

  // 2. Students 로드
  console.log('👨‍🎓 Students 로드...');
  const studentsSnap = await db.collection('students').get();
  const studentsMap = new Map<string, string>();
  studentsSnap.forEach(d => {
    studentsMap.set(d.id, d.data().name || '(이름없음)');
  });
  console.log(`  → ${studentsMap.size}명\n`);

  // 3. 모든 enrollment 순회하며 문제 찾기
  console.log('📋 Enrollments 검사...');
  const fixes: FixAction[] = [];
  let totalEnrollments = 0;
  let processed = 0;
  let updateCount = 0;

  for (const [studentId, studentName] of studentsMap) {
    const enrollSnap = await db.collection('students').doc(studentId).collection('enrollments').get();

    for (const enrollDoc of enrollSnap.docs) {
      const data = enrollDoc.data();
      totalEnrollments++;

      // 활성 enrollment만 대상
      const hasEnd = data.endDate || data.withdrawalDate;
      if (hasEnd) continue;
      const start = data.startDate || data.enrollmentDate || '';
      if (start > today) continue;

      const className = data.className || '';
      const subject = data.subject || '';
      const key = `${className}__${subject}`;
      const cls = classNameToClass.get(key);

      if (!cls) continue;

      const updates: Record<string, any> = {};

      // 수정 1: teacher 누락
      if (!data.teacher && cls.teacher) {
        fixes.push({
          studentId, studentName, enrollmentId: enrollDoc.id,
          className, subject, field: 'teacher',
          before: data.teacher || 'N/A', after: cls.teacher
        });
        updates.teacher = cls.teacher;
      }

      // 수정 2: staffId 누락
      if (!data.staffId && cls.teacher) {
        fixes.push({
          studentId, studentName, enrollmentId: enrollDoc.id,
          className, subject, field: 'staffId',
          before: data.staffId || 'N/A', after: cls.teacher
        });
        updates.staffId = cls.teacher;
      }

      // 수정 3: schedule 누락
      const enrollSchedule = data.schedule || [];
      if (enrollSchedule.length === 0 && cls.schedule && cls.schedule.length > 0) {
        const formattedSchedule = cls.schedule.map((s: any) => {
          if (typeof s === 'string') return s;
          return `${s.day} ${s.periodId}`;
        });
        fixes.push({
          studentId, studentName, enrollmentId: enrollDoc.id,
          className, subject, field: 'schedule',
          before: '[]', after: JSON.stringify(formattedSchedule)
        });
        updates.schedule = formattedSchedule;
      }

      // 수정 4: classId 누락
      if (!data.classId && cls.id) {
        fixes.push({
          studentId, studentName, enrollmentId: enrollDoc.id,
          className, subject, field: 'classId',
          before: 'N/A', after: cls.id
        });
        updates.classId = cls.id;
      }

      // 수정 5: teacher 불일치 (부담임 제외)
      if (data.teacher && cls.teacher && data.teacher !== cls.teacher && !data.isSlotTeacher) {
        fixes.push({
          studentId, studentName, enrollmentId: enrollDoc.id,
          className, subject, field: 'teacher (불일치)',
          before: data.teacher, after: cls.teacher
        });
        updates.teacher = cls.teacher;
        updates.staffId = cls.teacher;
      }

      // 실제 업데이트
      if (Object.keys(updates).length > 0 && !isDryRun) {
        await db.collection('students').doc(studentId)
          .collection('enrollments').doc(enrollDoc.id)
          .update(updates);
        updateCount++;
      }
    }

    processed++;
    if (processed % 100 === 0) {
      console.log(`  ... ${processed}/${studentsMap.size} 학생 처리`);
    }
  }

  console.log(`  → ${totalEnrollments}개 enrollment 검사 완료\n`);

  // 결과 출력
  if (fixes.length === 0) {
    console.log('✅ 수정할 항목이 없습니다!');
  } else {
    console.log('='.repeat(60));
    console.log(`📊 수정 내역: ${fixes.length}건 ${isDryRun ? '(DRY RUN)' : `(${updateCount}개 문서 업데이트 완료)`}`);
    console.log('='.repeat(60));

    const byField = new Map<string, FixAction[]>();
    for (const f of fixes) {
      if (!byField.has(f.field)) byField.set(f.field, []);
      byField.get(f.field)!.push(f);
    }

    for (const [field, items] of byField) {
      console.log(`\n  📌 ${field}: ${items.length}건`);
      items.forEach(f => {
        console.log(`     ${f.studentName} (${f.className}): "${f.before}" → "${f.after}"`);
      });
    }
  }

  console.log('\n' + (isDryRun ? '💡 실제 수정: npx tsx scripts/fixEnrollmentData.ts' : '✅ 완료!'));
  process.exit(0);
}

fix().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
