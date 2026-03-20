/**
 * 한글 doc ID enrollment + 스케줄 불일치 + studentIds 불일치 상세 진단
 *
 * 검사 항목:
 * 1. 한글 doc ID enrollment (레거시 형식)
 * 2. 스케줄 불일치 (enrollment schedule ≠ class schedule)
 * 3. enrollment 있지만 class.studentIds에 없는 학생
 * 4. class.studentIds에 있지만 enrollment 없는 학생
 *
 * 사용법: npx tsx scripts/diagnoseEnrollmentDetails.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

// Firestore auto-ID는 20자 영숫자
function isFirestoreAutoId(id: string): boolean {
  return /^[A-Za-z0-9]{20}$/.test(id);
}

// 한글/특수문자 포함 여부
function hasKorean(id: string): boolean {
  return /[가-힣]/.test(id);
}

// schedule을 비교 가능한 정규화 문자열로 변환
function normalizeSchedule(schedule: any[]): string[] {
  if (!schedule) return [];
  return schedule.map((s: any) => {
    if (typeof s === 'string') return s;
    if (s.day && s.periodId) return `${s.day} ${s.periodId}`;
    return JSON.stringify(s);
  }).sort();
}

async function diagnose() {
  console.log('🔍 한글 doc ID + 스케줄 불일치 상세 진단');
  console.log('='.repeat(60));

  // 1. 모든 classes 로드
  console.log('\n📦 데이터 로딩...');
  const classesSnap = await getDocs(collection(db, 'classes'));
  const classByNameSubject = new Map<string, any>();
  const classById = new Map<string, any>();

  classesSnap.forEach(doc => {
    const data = doc.data();
    const cls = {
      id: doc.id,
      className: data.className || '',
      subject: data.subject || '',
      teacher: data.teacher || '',
      schedule: data.schedule || [],
      isActive: data.isActive !== false,
      studentIds: data.studentIds || []
    };
    classByNameSubject.set(`${cls.className}__${cls.subject}`, cls);
    classById.set(doc.id, cls);
  });
  console.log(`  Classes: ${classByNameSubject.size}개`);

  // 2. 모든 students + enrollments 로드
  const studentsSnap = await getDocs(collection(db, 'students'));

  interface EnrollmentDetail {
    docId: string;
    studentId: string;
    studentName: string;
    studentStatus: string;
    className: string;
    classId: string;
    subject: string;
    teacher: string;
    schedule: any[];
    attendanceDays: string[];
    endDate: string;
    withdrawalDate: string;
    createdAt: string;
    startDate: string;
  }

  const allEnrollments: EnrollmentDetail[] = [];
  let loadCount = 0;

  for (const studentDoc of studentsSnap.docs) {
    const student = studentDoc.data();
    const enrollSnap = await getDocs(collection(db, 'students', studentDoc.id, 'enrollments'));

    enrollSnap.forEach(eDoc => {
      const data = eDoc.data();
      allEnrollments.push({
        docId: eDoc.id,
        studentId: studentDoc.id,
        studentName: student.name || '(이름없음)',
        studentStatus: student.status || 'unknown',
        className: data.className || '',
        classId: data.classId || '',
        subject: data.subject || '',
        teacher: data.teacher || '',
        schedule: data.schedule || [],
        attendanceDays: data.attendanceDays || [],
        endDate: data.endDate || '',
        withdrawalDate: data.withdrawalDate || '',
        createdAt: data.createdAt || '',
        startDate: data.startDate || data.enrollmentDate || '',
      });
    });

    loadCount++;
    if (loadCount % 100 === 0) process.stdout.write(`\r  Students: ${loadCount}/${studentsSnap.size}...`);
  }

  const activeEnrollments = allEnrollments.filter(e => !e.endDate && !e.withdrawalDate);
  console.log(`\r  Students: ${studentsSnap.size}명, 전체 Enrollments: ${allEnrollments.length}개, 활성: ${activeEnrollments.length}개`);

  // ========= 검사 1: 한글 doc ID enrollment =========
  console.log('\n' + '='.repeat(60));
  console.log('검사 1: 한글 doc ID enrollment (레거시 형식)');
  console.log('='.repeat(60));

  const koreanDocIds = activeEnrollments.filter(e => hasKorean(e.docId));
  const nonAutoIds = activeEnrollments.filter(e => !isFirestoreAutoId(e.docId) && !hasKorean(e.docId));

  console.log(`\n  한글 doc ID: ${koreanDocIds.length}건`);
  if (koreanDocIds.length > 0) {
    // className별로 그룹화
    const grouped = new Map<string, EnrollmentDetail[]>();
    for (const e of koreanDocIds) {
      const key = `${e.className} (${e.subject})`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }
    for (const [key, items] of grouped) {
      console.log(`\n  📌 ${key}`);
      items.forEach(e => {
        const cls = classByNameSubject.get(`${e.className}__${e.subject}`);
        console.log(`     학생: ${e.studentName} (${e.studentId})`);
        console.log(`     doc ID: "${e.docId}"`);
        console.log(`     enrollment schedule: ${JSON.stringify(e.schedule)}`);
        console.log(`     enrollment attendanceDays: ${JSON.stringify(e.attendanceDays)}`);
        if (cls) {
          const classSchedule = normalizeSchedule(cls.schedule);
          console.log(`     class schedule: ${JSON.stringify(classSchedule)}`);
          console.log(`     class에 학생 포함: ${cls.studentIds.includes(e.studentId) ? '✅' : '❌ 없음'}`);
        } else {
          console.log(`     ⚠️ 매칭 class 없음 (고아)`);
        }
      });
    }
  }

  console.log(`\n  비-자동생성 doc ID (한글 제외): ${nonAutoIds.length}건`);

  // ========= 검사 2: 스케줄 불일치 =========
  console.log('\n' + '='.repeat(60));
  console.log('검사 2: 스케줄 불일치 (enrollment schedule ≠ class schedule)');
  console.log('='.repeat(60));

  const scheduleMismatches: { e: EnrollmentDetail; classSchedule: string[] }[] = [];

  for (const e of activeEnrollments) {
    const cls = classByNameSubject.get(`${e.className}__${e.subject}`);
    if (!cls) continue;
    if (!e.schedule || e.schedule.length === 0) continue;

    const enrollSchedule = normalizeSchedule(e.schedule);
    const classSchedule = normalizeSchedule(cls.schedule);

    // attendanceDays가 있으면 개별 스케줄이므로 불일치가 정상
    if (e.attendanceDays && e.attendanceDays.length > 0) continue;

    if (JSON.stringify(enrollSchedule) !== JSON.stringify(classSchedule)) {
      scheduleMismatches.push({ e, classSchedule });
    }
  }

  console.log(`\n${scheduleMismatches.length > 0 ? '⚠️' : '✅'} ${scheduleMismatches.length}건`);
  if (scheduleMismatches.length > 0) {
    const grouped = new Map<string, typeof scheduleMismatches>();
    for (const m of scheduleMismatches) {
      const key = `${m.e.className} (${m.e.subject})`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }
    for (const [key, items] of grouped) {
      console.log(`\n  📌 ${key}`);
      console.log(`     class schedule: ${JSON.stringify(items[0].classSchedule)}`);
      items.forEach(m => {
        const enrollSchedule = normalizeSchedule(m.e.schedule);
        console.log(`     ${m.e.studentName}: enrollment schedule=${JSON.stringify(enrollSchedule)} ${hasKorean(m.e.docId) ? '(한글docID)' : ''}`);
      });
    }
  }

  // ========= 검사 3: enrollment ↔ studentIds 불일치 상세 =========
  console.log('\n' + '='.repeat(60));
  console.log('검사 3: enrollment ↔ class.studentIds 불일치 상세');
  console.log('='.repeat(60));

  // enrollment 있지만 studentIds에 없는
  const inEnrollmentNotInClass: { e: EnrollmentDetail; cls: any }[] = [];
  // studentIds에 있지만 enrollment 없는
  const inClassNotInEnrollment: { studentId: string; cls: any }[] = [];

  const enrollStudentsByClass = new Map<string, Set<string>>();
  for (const e of activeEnrollments) {
    const key = `${e.className}__${e.subject}`;
    if (!enrollStudentsByClass.has(key)) enrollStudentsByClass.set(key, new Set());
    enrollStudentsByClass.get(key)!.add(e.studentId);
  }

  // enrollment이 있는 학생이 class.studentIds에 없는 경우
  for (const e of activeEnrollments) {
    const cls = classByNameSubject.get(`${e.className}__${e.subject}`);
    if (!cls) continue;
    if (!cls.studentIds.includes(e.studentId)) {
      inEnrollmentNotInClass.push({ e, cls });
    }
  }

  // class.studentIds에 있는 학생이 enrollment이 없는 경우
  for (const [key, cls] of classByNameSubject) {
    const enrolledStudents = enrollStudentsByClass.get(key) || new Set();
    for (const studentId of (cls.studentIds || [])) {
      if (!enrolledStudents.has(studentId)) {
        inClassNotInEnrollment.push({ studentId, cls });
      }
    }
  }

  console.log(`\n  enrollment O / studentIds X: ${inEnrollmentNotInClass.length}건`);
  if (inEnrollmentNotInClass.length > 0) {
    const grouped = new Map<string, typeof inEnrollmentNotInClass>();
    for (const item of inEnrollmentNotInClass) {
      const key = `${item.cls.className} (${item.cls.subject})`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
    for (const [key, items] of grouped) {
      console.log(`\n  📌 ${key} (class studentIds: ${items[0].cls.studentIds.length}명)`);
      items.forEach(item => {
        console.log(`     ${item.e.studentName} - docId: "${item.e.docId}" ${hasKorean(item.e.docId) ? '(한글)' : ''}`);
      });
    }
  }

  console.log(`\n  studentIds O / enrollment X: ${inClassNotInEnrollment.length}건`);
  if (inClassNotInEnrollment.length > 0 && inClassNotInEnrollment.length <= 50) {
    const grouped = new Map<string, typeof inClassNotInEnrollment>();
    for (const item of inClassNotInEnrollment) {
      const key = `${item.cls.className} (${item.cls.subject})`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
    for (const [key, items] of grouped) {
      console.log(`\n  📌 ${key}`);
      items.forEach(item => console.log(`     ${item.studentId}`));
    }
  }

  // ========= 종합 =========
  console.log('\n' + '='.repeat(60));
  console.log('📊 종합 요약');
  console.log('='.repeat(60));
  console.log(`  한글 doc ID enrollment (활성): ${koreanDocIds.length}건`);
  console.log(`  스케줄 불일치:                 ${scheduleMismatches.length}건`);
  console.log(`  enrollment O / studentIds X:   ${inEnrollmentNotInClass.length}건`);
  console.log(`  studentIds O / enrollment X:   ${inClassNotInEnrollment.length}건`);

  process.exit(0);
}

diagnose().catch(err => {
  console.error('❌ 진단 실패:', err);
  process.exit(1);
});
