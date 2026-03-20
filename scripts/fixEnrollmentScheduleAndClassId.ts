/**
 * 스케줄 불일치 + classId 불일치 수정 스크립트 (Firebase Admin SDK)
 *
 * 수정 항목:
 * 1. 스케줄 불일치: enrollment schedule을 class schedule로 동기화
 * 2. classId 누락/불일치: enrollment classId를 올바른 class ID로 수정
 *
 * 사용법:
 *   npx tsx scripts/fixEnrollmentScheduleAndClassId.ts --dry   (드라이런)
 *   npx tsx scripts/fixEnrollmentScheduleAndClassId.ts          (실제 적용)
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: 'ijw-calander',
  credential: applicationDefault()
});

const db = getFirestore(app, 'restore20260319');
const isDryRun = process.argv.includes('--dry');

function normalizeSchedule(schedule: any[]): string[] {
  if (!schedule) return [];
  return schedule.map((s: any) => {
    if (typeof s === 'string') return s;
    if (s.day && s.periodId) return `${s.day} ${s.periodId}`;
    return JSON.stringify(s);
  }).sort();
}

function hasKorean(id: string): boolean {
  return /[가-힣]/.test(id);
}

async function fix() {
  console.log(`🔧 스케줄/classId 수정 (${isDryRun ? '🔍 DRY-RUN' : '⚡ 적용'} 모드)`);
  console.log('='.repeat(60));

  // 1. 모든 classes 로드
  console.log('\n📦 데이터 로딩...');
  const classesSnap = await db.collection('classes').get();
  const classByNameSubject = new Map<string, any>();

  classesSnap.forEach(docSnap => {
    const data = docSnap.data();
    const key = `${data.className || ''}__${data.subject || ''}`;
    classByNameSubject.set(key, {
      id: docSnap.id,
      className: data.className || '',
      subject: data.subject || '',
      teacher: data.teacher || '',
      schedule: data.schedule || [],
    });
  });
  console.log(`  Classes: ${classByNameSubject.size}개`);

  // 2. 모든 학생의 enrollments 로드
  const studentsSnap = await db.collection('students').get();
  let fixCount = 0;
  let totalEnrollments = 0;
  let loadCount = 0;

  for (const studentDoc of studentsSnap.docs) {
    const student = studentDoc.data();
    const enrollSnap = await db.collection('students').doc(studentDoc.id).collection('enrollments').get();

    for (const eDoc of enrollSnap.docs) {
      totalEnrollments++;
      const data = eDoc.data();

      // 종료된 enrollment은 건너뛰기
      if (data.endDate || data.withdrawalDate) continue;

      const className = data.className || '';
      const subject = data.subject || '';
      const key = `${className}__${subject}`;
      const cls = classByNameSubject.get(key);

      if (!cls) continue;

      const updates: Record<string, any> = {};
      const issues: string[] = [];

      // === 스케줄 불일치 수정 ===
      if (data.schedule && data.schedule.length > 0) {
        if (!data.attendanceDays || data.attendanceDays.length === 0) {
          const enrollSchedule = normalizeSchedule(data.schedule);
          const classSchedule = normalizeSchedule(cls.schedule);

          if (JSON.stringify(enrollSchedule) !== JSON.stringify(classSchedule)) {
            const classScheduleStrings = cls.schedule.map((s: any) => {
              if (typeof s === 'string') return s;
              return `${s.day} ${s.periodId}`;
            });
            updates.schedule = classScheduleStrings;
            issues.push(`스케줄: [${enrollSchedule.join(',')}] → [${classScheduleStrings.join(',')}]`);
          }
        }
      }

      // === classId 수정 ===
      if (!data.classId) {
        updates.classId = cls.id;
        issues.push(`classId 추가: ${cls.id}`);
      } else if (data.classId !== cls.id) {
        updates.classId = cls.id;
        issues.push(`classId: ${data.classId} → ${cls.id}`);
      }

      // === 수정 적용 ===
      if (Object.keys(updates).length > 0) {
        fixCount++;
        const studentName = student.name || studentDoc.id;
        console.log(`\n  [${fixCount}] ${studentName} → ${className} (${subject})`);
        console.log(`      doc ID: "${eDoc.id}" ${hasKorean(eDoc.id) ? '(한글)' : ''}`);
        issues.forEach(i => console.log(`      수정: ${i}`));

        if (!isDryRun) {
          updates.updatedAt = new Date().toISOString();
          await eDoc.ref.update(updates);
          console.log(`      ✅ 적용 완료`);
        } else {
          console.log(`      ⏸️ DRY-RUN`);
        }
      }
    }

    loadCount++;
    if (loadCount % 100 === 0) process.stdout.write(`\r  진행: ${loadCount}/${studentsSnap.size}...`);
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`📊 결과: ${totalEnrollments}개 enrollment 중 ${fixCount}건 수정${isDryRun ? ' 필요' : ' 완료'}`);

  if (isDryRun && fixCount > 0) {
    console.log('\n💡 실제 적용: npx tsx scripts/fixEnrollmentScheduleAndClassId.ts');
  }

  process.exit(0);
}

fix().catch(err => {
  console.error('❌ 실패:', err);
  process.exit(1);
});
