/**
 * 특정 학생이 시간표에 나타나지 않는 이유를 진단하는 스크립트
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Firebase 설정
const firebaseConfig = JSON.parse(readFileSync('./firebaseConfig.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'restore260202'); // 복원 DB 사용

async function checkStudent() {
  try {
    console.log('=== 학생 "김도은" 진단 시작 ===\n');

    // 1. students 컬렉션에서 김도로 시작하는 이름 검색
    const studentsSnap = await getDocs(collection(db, 'students'));
    const matchingStudents = [];

    studentsSnap.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('김도')) {
        matchingStudents.push({
          id: doc.id,
          name: data.name,
          status: data.status,
          school: data.school,
          grade: data.grade
        });
      }
    });

    console.log(`"김도" 포함 학생 (${matchingStudents.length}명):`);
    matchingStudents.forEach(s => {
      console.log(`  - ID: ${s.id}`);
      console.log(`    이름: ${s.name}`);
      console.log(`    상태: ${s.status}`);
      console.log(`    학교: ${s.school} ${s.grade}`);
      console.log('');
    });

    if (matchingStudents.length === 0) {
      console.log('❌ "김도"로 시작하는 학생을 찾을 수 없습니다!\n');
      return;
    }

    // 2. 각 학생의 enrollments 확인
    for (const student of matchingStudents) {
      console.log(`\n=== ${student.name} (${student.id}) 의 Enrollments ===`);

      const enrollmentsSnap = await getDocs(
        collection(db, 'students', student.id, 'enrollments')
      );

      if (enrollmentsSnap.empty) {
        console.log('  ❌ Enrollment 없음');
        continue;
      }

      console.log(`  총 ${enrollmentsSnap.size}개 enrollment:`);
      enrollmentsSnap.forEach(enrollDoc => {
        const data = enrollDoc.data();
        console.log(`\n    [${enrollDoc.id}]`);
        console.log(`    - className: ${data.className}`);
        console.log(`    - subject: ${data.subject}`);
        console.log(`    - enrollmentDate: ${data.enrollmentDate?.toDate?.() || data.enrollmentDate}`);
        console.log(`    - withdrawalDate: ${data.withdrawalDate?.toDate?.() || data.withdrawalDate || 'N/A'}`);
        console.log(`    - endDate: ${data.endDate?.toDate?.() || data.endDate || 'N/A'}`);
        console.log(`    - attendanceDays: ${JSON.stringify(data.attendanceDays || [])}`);
      });
    }

    // 3. "초등M_초6 정규 A" 클래스 확인
    console.log('\n\n=== "초등M_초6 정규 A" 클래스 확인 ===');
    const classesSnap = await getDocs(
      query(
        collection(db, 'classes'),
        where('className', '==', '초등M_초6 정규 A')
      )
    );

    if (classesSnap.empty) {
      console.log('❌ 해당 클래스를 classes 컬렉션에서 찾을 수 없습니다!');
    } else {
      classesSnap.forEach(classDoc => {
        const data = classDoc.data();
        console.log(`클래스 ID: ${classDoc.id}`);
        console.log(`Subject: ${data.subject}`);
        console.log(`Teacher: ${data.teacher}`);
        console.log(`StudentCount: ${data.studentCount}`);
      });
    }

    // 4. useStudents(true) 시뮬레이션 - status 필터 확인
    console.log('\n\n=== useStudents(true) 필터링 시뮬레이션 ===');
    const allStudents = [];
    studentsSnap.forEach(doc => {
      allStudents.push({ id: doc.id, ...doc.data() });
    });

    console.log(`전체 students 컬렉션: ${allStudents.length}명`);

    const matchingInAll = allStudents.filter(s => s.name && s.name.includes('김도'));
    console.log(`"김도" 포함 학생: ${matchingInAll.length}명`);

    matchingInAll.forEach(s => {
      console.log(`  - ${s.name} (${s.id}): status=${s.status}`);
    });

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    process.exit(0);
  }
}

checkStudent();
