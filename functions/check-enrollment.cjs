const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ijw-calander' });
const db = admin.firestore();

async function check() {
  const snap = await db.collection('students').get();
  let studentDoc = null;
  for (const doc of snap.docs) {
    if (doc.id.includes('박소윤B')) { studentDoc = doc; break; }
  }
  if (studentDoc === null) { console.log('Not found'); return; }

  console.log('=== 학생 문서 ID:', studentDoc.id);
  const data = studentDoc.data();

  if (data.enrollments && data.enrollments.length > 0) {
    console.log('\n[배열필드] enrollments (' + data.enrollments.length + '개)');
    data.enrollments.forEach((e, i) => {
      console.log(i + ':', JSON.stringify({ className: e.className, subject: e.subject, startDate: e.startDate, endDate: e.endDate, staffId: e.staffId, days: e.days }));
    });
  } else {
    console.log('\n[배열필드] enrollments: 없음');
  }

  const subSnap = await studentDoc.ref.collection('enrollments').get();
  console.log('\n[서브컬렉션] enrollments (' + subSnap.size + '개)');
  subSnap.docs.forEach(doc => {
    const d = doc.data();
    const ca = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : d.createdAt;
    const ua = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt;
    console.log('\n  docId:', doc.id);
    console.log('    className:', d.className, '| subject:', d.subject);
    console.log('    classId:', d.classId);
    console.log('    staffId:', d.staffId);
    console.log('    startDate:', d.startDate, '| enrollmentDate:', d.enrollmentDate);
    console.log('    endDate:', d.endDate);
    console.log('    days:', JSON.stringify(d.days));
    console.log('    attendanceDays:', JSON.stringify(d.attendanceDays));
    console.log('    schedule:', JSON.stringify(d.schedule));
    console.log('    createdAt:', ca, '| updatedAt:', ua);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
