/**
 * 전체 DB 데이터 일관성 진단 스크립트 v2
 *
 * 검사 항목:
 * 1. 고아 enrollment (매칭 class 없음)
 * 2. 학생 수 불일치 (enrollment vs studentIds)
 * 3. 강사 불일치 (enrollment teacher ≠ class teacher)
 * 4. 좀비 enrollment (퇴원생인데 활성)
 * 5. 수업 미배정 재원생
 * 6. teacher/staffId 누락
 * 7. schedule 누락
 * 8. classId 누락/불일치
 * 9. startDate 누락
 *
 * 사용법: npx tsx scripts/diagnoseDataConsistency.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = {
  apiKey: "***REMOVED_API_KEY_1***",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: "231563652148",
  appId: "1:231563652148:web:4a217812ef96fa3aae2e61"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'restore20260319');

interface ClassData {
  id: string;
  className: string;
  subject: string;
  teacher: string;
  schedule: any[];
  isActive: boolean;
  studentIds?: string[];
}

interface EnrollmentData {
  id: string;
  studentId: string;
  studentName: string;
  studentStatus: string;
  className: string;
  classId?: string;
  subject: string;
  teacher?: string;
  staffId?: string;
  days?: string[];
  schedule?: string[];
  startDate?: string;
  enrollmentDate?: string;
  endDate?: string;
  withdrawalDate?: string;
  onHold?: boolean;
}

interface FixItem {
  studentId: string;
  studentName: string;
  enrollmentId: string;
  className: string;
  subject: string;
  fixes: Record<string, any>;
  issues: string[];
}

async function diagnose() {
  console.log('🏥 전체 DB 데이터 일관성 진단 v2');
  const today = new Date().toISOString().split('T')[0];
  console.log(`📅 기준일: ${today}\n`);

  // 1. 모든 classes 로드
  console.log('📦 데이터 로딩...');
  const classesSnap = await getDocs(collection(db, 'classes'));
  const classesMap = new Map<string, ClassData>();
  const classByNameSubject = new Map<string, ClassData>();

  classesSnap.forEach(doc => {
    const data = doc.data();
    const cls: ClassData = {
      id: doc.id,
      className: data.className || '',
      subject: data.subject || '',
      teacher: data.teacher || '',
      schedule: data.schedule || [],
      isActive: data.isActive !== false,
      studentIds: data.studentIds || []
    };
    classesMap.set(doc.id, cls);
    classByNameSubject.set(`${cls.className}__${cls.subject}`, cls);
  });
  console.log(`  Classes: ${classesMap.size}개`);

  // 2. 모든 students + enrollments 로드
  const studentsSnap = await getDocs(collection(db, 'students'));
  const studentsMap = new Map<string, { name: string; status: string }>();
  const enrollments: EnrollmentData[] = [];
  let loadedCount = 0;

  for (const studentDoc of studentsSnap.docs) {
    const student = studentDoc.data();
    studentsMap.set(studentDoc.id, {
      name: student.name || '(이름없음)',
      status: student.status || 'unknown'
    });

    const enrollSnap = await getDocs(collection(db, 'students', studentDoc.id, 'enrollments'));
    enrollSnap.forEach(eDoc => {
      const data = eDoc.data();
      enrollments.push({
        id: eDoc.id,
        studentId: studentDoc.id,
        studentName: student.name || '(이름없음)',
        studentStatus: student.status || 'unknown',
        className: data.className || '',
        classId: data.classId || '',
        subject: data.subject || '',
        teacher: data.teacher || '',
        staffId: data.staffId || '',
        days: data.days || [],
        schedule: data.schedule || [],
        startDate: data.startDate || data.enrollmentDate || '',
        enrollmentDate: data.enrollmentDate || '',
        endDate: data.endDate || '',
        withdrawalDate: data.withdrawalDate || '',
        onHold: data.onHold || false
      });
    });

    loadedCount++;
    if (loadedCount % 100 === 0) {
      process.stdout.write(`\r  Students: ${loadedCount}/${studentsSnap.size}...`);
    }
  }
  console.log(`\r  Students: ${studentsMap.size}명, Enrollments: ${enrollments.length}개`);

  // 활성 enrollment 필터
  const activeEnrollments = enrollments.filter(e => {
    if (e.endDate || e.withdrawalDate) return false;
    return true;
  });
  console.log(`  활성 enrollment: ${activeEnrollments.length}개\n`);

  // ============ 검사 실행 ============
  const fixPlan: FixItem[] = [];

  // --- 검사 1: 고아 enrollment ---
  console.log('='.repeat(60));
  console.log('검사 1: 고아 enrollment (매칭 class 없음)');
  console.log('='.repeat(60));

  const orphaned = activeEnrollments.filter(e => {
    const key = `${e.className}__${e.subject}`;
    return !classByNameSubject.has(key);
  });

  if (orphaned.length > 0) {
    console.log(`\n❌ ${orphaned.length}건`);
    const grouped = new Map<string, EnrollmentData[]>();
    for (const e of orphaned) {
      const key = `${e.className} (${e.subject})`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }
    for (const [key, items] of grouped) {
      console.log(`  📌 ${key} - ${items.length}명:`);
      items.forEach(e => console.log(`     ${e.studentName} (${e.studentId})`));
    }
  } else {
    console.log('\n✅ 0건');
  }

  // --- 검사 2: 학생 수 불일치 ---
  console.log('\n' + '='.repeat(60));
  console.log('검사 2: 학생 수 불일치 (enrollment vs studentIds)');
  console.log('='.repeat(60));

  const enrollStudentsByClass = new Map<string, Set<string>>();
  for (const e of activeEnrollments) {
    const key = `${e.className}__${e.subject}`;
    if (!enrollStudentsByClass.has(key)) enrollStudentsByClass.set(key, new Set());
    enrollStudentsByClass.get(key)!.add(e.studentId);
  }

  let mismatchCount = 0;
  for (const [key, cls] of classByNameSubject) {
    const enrollCount = enrollStudentsByClass.get(key)?.size || 0;
    const idsCount = cls.studentIds?.length || 0;
    if (enrollCount !== idsCount && (enrollCount > 0 || idsCount > 0)) mismatchCount++;
  }
  console.log(`\n${mismatchCount > 0 ? '⚠️' : '✅'} ${mismatchCount}건`);

  // --- 검사 3: 강사 불일치 ---
  console.log('\n' + '='.repeat(60));
  console.log('검사 3: 강사 불일치 (enrollment teacher ≠ class teacher)');
  console.log('='.repeat(60));

  const teacherMismatches: { e: EnrollmentData; classTeacher: string }[] = [];
  for (const e of activeEnrollments) {
    const cls = classByNameSubject.get(`${e.className}__${e.subject}`);
    if (!cls) continue;
    if (e.teacher && cls.teacher && e.teacher !== cls.teacher) {
      teacherMismatches.push({ e, classTeacher: cls.teacher });
    }
  }

  if (teacherMismatches.length > 0) {
    console.log(`\n⚠️ ${teacherMismatches.length}건`);
    const grouped = new Map<string, typeof teacherMismatches>();
    for (const m of teacherMismatches) {
      const key = `${m.e.className} (${m.e.subject})`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }
    for (const [key, items] of grouped) {
      console.log(`  📌 ${key} - class teacher: "${items[0].classTeacher}"`);
      items.forEach(m => console.log(`     ${m.e.studentName}: enrollment teacher="${m.e.teacher}"`));
    }

    // 수정 계획 추가
    for (const m of teacherMismatches) {
      addToFixPlan(fixPlan, m.e, {
        teacher: m.classTeacher,
        staffId: m.classTeacher
      }, 'teacher_mismatch');
    }
  } else {
    console.log('\n✅ 0건');
  }

  // --- 검사 4: 좀비 enrollment ---
  console.log('\n' + '='.repeat(60));
  console.log('검사 4: 좀비 enrollment (퇴원생인데 활성)');
  console.log('='.repeat(60));

  const zombies = activeEnrollments.filter(e => e.studentStatus === 'withdrawn');
  console.log(`\n${zombies.length > 0 ? '❌' : '✅'} ${zombies.length}건`);
  zombies.forEach(z => console.log(`  ${z.studentName} (${z.studentId}): ${z.className}`));

  // --- 검사 5: 수업 미배정 재원생 ---
  console.log('\n' + '='.repeat(60));
  console.log('검사 5: 수업 미배정 재원생');
  console.log('='.repeat(60));

  const activeStudentIds = new Set<string>();
  studentsMap.forEach((s, id) => { if (s.status === 'active') activeStudentIds.add(id); });
  const enrolledIds = new Set(activeEnrollments.map(e => e.studentId));
  const noEnrollment = [...activeStudentIds].filter(id => !enrolledIds.has(id));
  console.log(`\n${noEnrollment.length > 0 ? '⚠️' : '✅'} ${noEnrollment.length}명`);
  noEnrollment.forEach(id => console.log(`  ${studentsMap.get(id)!.name} (${id})`));

  // --- 검사 6: teacher/staffId 누락 ---
  console.log('\n' + '='.repeat(60));
  console.log('검사 6: teacher/staffId 누락 (활성 enrollment)');
  console.log('='.repeat(60));

  const missingTeacher: { e: EnrollmentData; classTeacher: string }[] = [];
  for (const e of activeEnrollments) {
    if (e.teacher || e.staffId) continue;  // 둘 다 비어있는 경우만
    const cls = classByNameSubject.get(`${e.className}__${e.subject}`);
    if (!cls) continue;
    missingTeacher.push({ e, classTeacher: cls.teacher });
  }

  if (missingTeacher.length > 0) {
    console.log(`\n🔴 ${missingTeacher.length}건`);
    const grouped = new Map<string, typeof missingTeacher>();
    for (const m of missingTeacher) {
      const key = `${m.e.className} (${m.e.subject})`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }
    for (const [key, items] of grouped) {
      console.log(`  📌 ${key} - class teacher: "${items[0].classTeacher}"`);
      items.forEach(m => console.log(`     ${m.e.studentName} (${m.e.studentId})`));
    }

    for (const m of missingTeacher) {
      if (m.classTeacher) {
        addToFixPlan(fixPlan, m.e, {
          teacher: m.classTeacher,
          staffId: m.classTeacher
        }, 'missing_teacher');
      }
    }
  } else {
    console.log('\n✅ 0건');
  }

  // --- 검사 7: schedule 누락 ---
  console.log('\n' + '='.repeat(60));
  console.log('검사 7: schedule 누락 (활성 enrollment)');
  console.log('='.repeat(60));

  const missingSchedule: { e: EnrollmentData; classSchedule: string[] }[] = [];
  for (const e of activeEnrollments) {
    if (e.schedule && e.schedule.length > 0) continue;
    const cls = classByNameSubject.get(`${e.className}__${e.subject}`);
    if (!cls) continue;
    const classSchedule = cls.schedule.map((s: any) => {
      if (typeof s === 'string') return s;
      return `${s.day} ${s.periodId}`;
    });
    missingSchedule.push({ e, classSchedule });
  }

  if (missingSchedule.length > 0) {
    console.log(`\n🔴 ${missingSchedule.length}건`);
    const grouped = new Map<string, typeof missingSchedule>();
    for (const m of missingSchedule) {
      const key = `${m.e.className} (${m.e.subject})`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }
    for (const [key, items] of grouped) {
      console.log(`  📌 ${key} - class schedule: ${JSON.stringify(items[0].classSchedule)}`);
      items.forEach(m => console.log(`     ${m.e.studentName} (${m.e.studentId})`));
    }

    for (const m of missingSchedule) {
      if (m.classSchedule.length > 0) {
        addToFixPlan(fixPlan, m.e, { schedule: m.classSchedule }, 'missing_schedule');
      }
    }
  } else {
    console.log('\n✅ 0건');
  }

  // --- 검사 8: classId 누락/불일치 ---
  console.log('\n' + '='.repeat(60));
  console.log('검사 8: classId 누락 또는 불일치');
  console.log('='.repeat(60));

  let missingClassId = 0;
  let wrongClassId = 0;

  for (const e of activeEnrollments) {
    const cls = classByNameSubject.get(`${e.className}__${e.subject}`);
    if (!cls) continue;

    if (!e.classId) {
      missingClassId++;
      addToFixPlan(fixPlan, e, { classId: cls.id }, 'missing_classId');
    } else if (e.classId !== cls.id) {
      wrongClassId++;
      addToFixPlan(fixPlan, e, { classId: cls.id }, 'wrong_classId');
    }
  }

  console.log(`\n  classId 누락: ${missingClassId > 0 ? '🔴' : '✅'} ${missingClassId}건`);
  console.log(`  classId 불일치: ${wrongClassId > 0 ? '⚠️' : '✅'} ${wrongClassId}건`);

  // --- 검사 9: startDate 누락 ---
  console.log('\n' + '='.repeat(60));
  console.log('검사 9: startDate 누락');
  console.log('='.repeat(60));

  const missingStart = activeEnrollments.filter(e => !e.startDate && !e.enrollmentDate);
  console.log(`\n${missingStart.length > 0 ? '🔵' : '✅'} ${missingStart.length}건`);
  if (missingStart.length > 0) {
    missingStart.forEach(e => console.log(`  ${e.studentName}: ${e.className} (${e.subject})`));
  }

  // ============ 종합 요약 ============
  console.log('\n' + '='.repeat(60));
  console.log('📊 종합 요약');
  console.log('='.repeat(60));
  console.log(`  1. 고아 enrollment:      ${orphaned.length}건 ${orphaned.length > 0 ? '❌' : '✅'}`);
  console.log(`  2. 학생수 불일치:        ${mismatchCount}건 ${mismatchCount > 0 ? '⚠️' : '✅'}`);
  console.log(`  3. 강사 불일치:          ${teacherMismatches.length}건 ${teacherMismatches.length > 0 ? '⚠️' : '✅'}`);
  console.log(`  4. 좀비 enrollment:      ${zombies.length}건 ${zombies.length > 0 ? '❌' : '✅'}`);
  console.log(`  5. 미배정 재원생:        ${noEnrollment.length}명 ${noEnrollment.length > 0 ? '⚠️' : '✅'}`);
  console.log(`  6. teacher 누락:         ${missingTeacher.length}건 ${missingTeacher.length > 0 ? '🔴' : '✅'}`);
  console.log(`  7. schedule 누락:        ${missingSchedule.length}건 ${missingSchedule.length > 0 ? '🔴' : '✅'}`);
  console.log(`  8. classId 누락/불일치:  ${missingClassId + wrongClassId}건 ${(missingClassId + wrongClassId) > 0 ? '🔴' : '✅'}`);
  console.log(`  9. startDate 누락:       ${missingStart.length}건 ${missingStart.length > 0 ? '🔵' : '✅'}`);

  // ============ 수정 계획 저장 ============
  if (fixPlan.length > 0) {
    // 중복 제거 및 merge
    const merged = mergeFixPlan(fixPlan);
    console.log(`\n🔧 자동 수정 가능: ${merged.length}건 (enrollment 단위)`);

    const fixPlanPath = 'scripts/fixPlan.json';
    fs.writeFileSync(fixPlanPath, JSON.stringify(merged, null, 2), 'utf-8');
    console.log(`📝 수정 계획 저장: ${fixPlanPath}`);
    console.log('   확인 후 npx tsx scripts/applyFixes.ts 로 적용하세요.');
  } else {
    console.log('\n✅ 수정 필요 없음!');
  }

  process.exit(0);
}

function addToFixPlan(plan: FixItem[], e: EnrollmentData, fixes: Record<string, any>, issue: string) {
  const existing = plan.find(p =>
    p.studentId === e.studentId && p.enrollmentId === e.id
  );
  if (existing) {
    Object.assign(existing.fixes, fixes);
    existing.issues.push(issue);
  } else {
    plan.push({
      studentId: e.studentId,
      studentName: e.studentName,
      enrollmentId: e.id,
      className: e.className,
      subject: e.subject,
      fixes,
      issues: [issue]
    });
  }
}

function mergeFixPlan(plan: FixItem[]): FixItem[] {
  const map = new Map<string, FixItem>();
  for (const item of plan) {
    const key = `${item.studentId}|${item.enrollmentId}`;
    if (map.has(key)) {
      const existing = map.get(key)!;
      Object.assign(existing.fixes, item.fixes);
      existing.issues.push(...item.issues);
    } else {
      map.set(key, { ...item });
    }
  }
  return [...map.values()];
}

diagnose().catch(err => {
  console.error('❌ 진단 실패:', err);
  process.exit(1);
});
