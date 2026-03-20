/**
 * 특정 수업의 상세 데이터 일관성 확인 스크립트
 * 사용법: npx tsx scripts/checkClassDetail.ts "중등M 중1 BS3C" "math"
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'restore20260319');

const targetClassName = process.argv[2] || '중등M 중1 BS3C';
const targetSubject = process.argv[3] || 'math';

async function checkClass() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`🔍 "${targetClassName}" (${targetSubject}) 상세 조회\n`);
  console.log(`📅 기준일: ${today}\n`);

  // 1. Classes 컬렉션에서 해당 수업 조회
  console.log('=' .repeat(60));
  console.log('1. Classes 컬렉션 데이터');
  console.log('=' .repeat(60));

  const classesSnap = await getDocs(
    query(collection(db, 'classes'), where('className', '==', targetClassName))
  );

  if (classesSnap.empty) {
    console.log(`❌ "${targetClassName}" 수업을 찾을 수 없습니다!`);
    process.exit(1);
  }

  let classData: any = null;
  let classId = '';
  classesSnap.forEach(doc => {
    const data = doc.data();
    if (data.subject === targetSubject || !targetSubject) {
      classData = data;
      classId = doc.id;
    }
  });

  if (!classData) {
    console.log(`❌ "${targetClassName}" (${targetSubject}) 수업을 찾을 수 없습니다!`);
    process.exit(1);
  }

  console.log(`  Class ID: ${classId}`);
  console.log(`  className: ${classData.className}`);
  console.log(`  subject: ${classData.subject}`);
  console.log(`  teacher: ${classData.teacher}`);
  console.log(`  schedule: ${JSON.stringify(classData.schedule)}`);
  console.log(`  isActive: ${classData.isActive}`);
  console.log(`  studentIds: ${JSON.stringify(classData.studentIds || [])}`);
  console.log(`  slotTeachers: ${JSON.stringify(classData.slotTeachers || {})}`);
  console.log(`  slotRooms: ${JSON.stringify(classData.slotRooms || {})}`);
  console.log(`  room: ${classData.room || 'N/A'}`);
  console.log(`  memo: ${classData.memo || 'N/A'}`);

  // 2. Classes > students 서브컬렉션 확인
  console.log('\n' + '=' .repeat(60));
  console.log('2. Classes > students 서브컬렉션 (레거시)');
  console.log('=' .repeat(60));

  try {
    const classStudentsSnap = await getDocs(collection(db, 'classes', classId, 'students'));
    if (classStudentsSnap.empty) {
      console.log('  (비어있음)');
    } else {
      console.log(`  ${classStudentsSnap.size}명:`);
      classStudentsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}: ${JSON.stringify(data)}`);
      });
    }
  } catch {
    console.log('  (권한 없음 - 건너뜀)');
  }

  // 3. Enrollment 기반 학생 조회 (실제 앱에서 사용하는 방식)
  console.log('\n' + '=' .repeat(60));
  console.log('3. Enrollments 기반 학생 목록 (실제 앱 사용 방식)');
  console.log('=' .repeat(60));

  // 모든 학생 로드
  const studentsSnap = await getDocs(collection(db, 'students'));
  const studentsMap = new Map<string, any>();
  studentsSnap.forEach(doc => {
    studentsMap.set(doc.id, { id: doc.id, ...doc.data() });
  });

  // 각 학생의 enrollment에서 해당 수업 찾기
  const enrollmentsByStudent: {
    studentId: string;
    studentName: string;
    studentStatus: string;
    enrollmentId: string;
    enrollmentData: any;
    category: string; // 활성/배정예정/종료
  }[] = [];

  for (const [studentId, student] of studentsMap) {
    const enrollSnap = await getDocs(collection(db, 'students', studentId, 'enrollments'));
    enrollSnap.forEach(doc => {
      const data = doc.data();
      if (data.className === targetClassName && data.subject === targetSubject) {
        // 카테고리 분류
        const hasEnd = data.endDate || data.withdrawalDate;
        const start = data.startDate || data.enrollmentDate || '';
        let category = '활성';
        if (hasEnd) category = '종료';
        else if (start > today) category = '배정예정';

        enrollmentsByStudent.push({
          studentId,
          studentName: student.name || '(이름없음)',
          studentStatus: student.status || 'unknown',
          enrollmentId: doc.id,
          enrollmentData: data,
          category
        });
      }
    });
  }

  // 카테고리별 분류
  const active = enrollmentsByStudent.filter(e => e.category === '활성');
  const scheduled = enrollmentsByStudent.filter(e => e.category === '배정예정');
  const ended = enrollmentsByStudent.filter(e => e.category === '종료');

  console.log(`\n  📊 총 enrollment: ${enrollmentsByStudent.length}개`);
  console.log(`     활성: ${active.length}명 | 배정예정: ${scheduled.length}명 | 종료: ${ended.length}명\n`);

  if (active.length > 0) {
    console.log('  ✅ 활성 학생:');
    active.forEach(e => {
      const d = e.enrollmentData;
      console.log(`     ${e.studentName} (${e.studentId}) [학생상태: ${e.studentStatus}]`);
      console.log(`       teacher: ${d.teacher || 'N/A'} | staffId: ${d.staffId || 'N/A'}`);
      console.log(`       days: ${JSON.stringify(d.days || [])} | attendanceDays: ${JSON.stringify(d.attendanceDays || [])}`);
      console.log(`       schedule: ${JSON.stringify(d.schedule || [])}`);
      console.log(`       startDate: ${d.startDate || d.enrollmentDate || 'N/A'}`);
      console.log(`       onHold: ${d.onHold || false} | isScheduled: ${d.isScheduled || false}`);
      console.log(`       classId: ${d.classId || 'N/A'}`);
      console.log('');
    });
  }

  if (scheduled.length > 0) {
    console.log('  ⏳ 배정예정 학생:');
    scheduled.forEach(e => {
      const d = e.enrollmentData;
      console.log(`     ${e.studentName} (${e.studentId}) - startDate: ${d.startDate || d.enrollmentDate}`);
    });
    console.log('');
  }

  if (ended.length > 0) {
    console.log('  ❌ 종료 학생:');
    ended.forEach(e => {
      const d = e.enrollmentData;
      console.log(`     ${e.studentName} (${e.studentId}) - endDate: ${d.endDate || 'N/A'} withdrawalDate: ${d.withdrawalDate || 'N/A'}`);
    });
    console.log('');
  }

  // 4. 불일치 분석
  console.log('=' .repeat(60));
  console.log('4. 불일치 분석');
  console.log('=' .repeat(60));

  // 4-1: enrollment teacher vs class teacher
  const teacherMismatches = active.filter(e =>
    e.enrollmentData.teacher && classData.teacher && e.enrollmentData.teacher !== classData.teacher
  );
  if (teacherMismatches.length > 0) {
    console.log(`\n  ⚠️ 강사 불일치 (class teacher: "${classData.teacher}"):`);
    teacherMismatches.forEach(e => {
      console.log(`     ${e.studentName}: enrollment teacher = "${e.enrollmentData.teacher}"`);
    });
  } else {
    console.log('\n  ✅ 강사 정보 일치');
  }

  // 4-2: enrollment days vs class schedule
  const classDays = classData.schedule?.map((s: any) => {
    if (typeof s === 'string') return s.split(' ')[0];
    return s.day;
  }).filter(Boolean) || [];

  console.log(`\n  수업 요일 (class schedule): ${JSON.stringify(classDays)}`);

  // 4-3: 활성 enrollment인데 학생이 withdrawn
  const zombies = active.filter(e => e.studentStatus === 'withdrawn');
  if (zombies.length > 0) {
    console.log(`\n  ❌ 좀비 enrollment (퇴원생인데 활성):`);
    zombies.forEach(e => console.log(`     ${e.studentName} (${e.studentId})`));
  } else {
    console.log('  ✅ 좀비 enrollment 없음');
  }

  // 4-4: classId 일치 여부
  const classIdMismatches = active.filter(e =>
    e.enrollmentData.classId && e.enrollmentData.classId !== classId
  );
  if (classIdMismatches.length > 0) {
    console.log(`\n  ⚠️ classId 불일치 (실제 class ID: "${classId}"):`);
    classIdMismatches.forEach(e => {
      console.log(`     ${e.studentName}: enrollment classId = "${e.enrollmentData.classId}"`);
    });
  } else {
    console.log('  ✅ classId 일치');
  }

  process.exit(0);
}

checkClass().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
