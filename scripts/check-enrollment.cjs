// Firebase Admin SDK를 Application Default Credentials로 초기화
const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'ijw-calander'
});
const db = admin.firestore();

async function check() {
  const studentsRef = db.collection('students');
  const snap = await studentsRef.get();
  let studentDoc = null;

  for (const doc of snap.docs) {
    if (doc.id.includes('박소윤B')) {
      studentDoc = doc;
      break;
    }
  }

  if (!studentDoc) {
    console.log('학생을 찾을 수 없습니다');
    return;
  }

  console.log('=== 학생 문서 ID:', studentDoc.id);
  const data = studentDoc.data();

  // 문서 내 enrollments 배열 필드
  if (data.enrollments && data.enrollments.length > 0) {
    console.log('\n=== 문서 내 enrollments 배열 필드 (' + data.enrollments.length + '개) ===');
    data.enrollments.forEach((e, i) => {
      console.log(i + ':', JSON.stringify({
        className: e.className, subject: e.subject, classId: e.classId,
        startDate: e.startDate, endDate: e.endDate, staffId: e.staffId, days: e.days
      }));
    });
  } else {
    console.log('\n=== 문서 내 enrollments 배열: 없음 ===');
  }

  // 서브컬렉션 enrollments
  const subSnap = await studentDoc.ref.collection('enrollments').get();
  console.log('\n=== 서브컬렉션 enrollments (' + subSnap.size + '개) ===');
  subSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log('\ndocId:', doc.id);
    console.log('  className:', d.className);
    console.log('  subject:', d.subject);
    console.log('  classId:', d.classId);
    console.log('  staffId:', d.staffId);
    console.log('  startDate:', d.startDate);
    console.log('  enrollmentDate:', d.enrollmentDate);
    console.log('  endDate:', d.endDate);
    console.log('  days:', JSON.stringify(d.days));
    console.log('  attendanceDays:', JSON.stringify(d.attendanceDays));
    console.log('  schedule:', JSON.stringify(d.schedule));
    const ca = d.createdAt;
    console.log('  createdAt:', ca && ca.toDate ? ca.toDate().toISOString() : ca);
    const ua = d.updatedAt;
    console.log('  updatedAt:', ua && ua.toDate ? ua.toDate().toISOString() : ua);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
