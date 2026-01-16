/**
 * 영어 배정으로 잘못 생성된 enrollment 삭제 스크립트
 * source: 'excel_migration'인 enrollment를 모두 삭제합니다.
 * 
 * 사용법:
 *   DRY RUN: node scripts/deleteExcelMigrationEnrollments.cjs
 *   실제 삭제: node scripts/deleteExcelMigrationEnrollments.cjs --delete
 */

const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin 초기화
const serviceAccountPath = path.resolve(__dirname, '../config/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteExcelMigrationEnrollments(dryRun = true) {
    console.log('='.repeat(60));
    console.log(`영어 배정 데이터 삭제 스크립트 (${dryRun ? 'DRY RUN' : '실제 삭제'})`);
    console.log('='.repeat(60));

    const studentsSnapshot = await db.collection('students').get();
    console.log(`\n총 학생 수: ${studentsSnapshot.size}명\n`);

    let totalDeleted = 0;
    const affectedStudents = [];

    for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const enrollmentsRef = db.collection('students').doc(studentDoc.id).collection('enrollments');

        // source: 'excel_migration'인 enrollment 찾기
        const migrationEnrollments = await enrollmentsRef
            .where('source', '==', 'excel_migration')
            .get();

        if (migrationEnrollments.size > 0) {
            const enrollmentNames = migrationEnrollments.docs.map(d => d.data().className);
            affectedStudents.push({
                name: studentData.name,
                enrollments: enrollmentNames
            });

            if (!dryRun) {
                const batch = db.batch();
                migrationEnrollments.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }

            totalDeleted += migrationEnrollments.size;
        }
    }

    console.log('\n--- 삭제 대상 ---');
    affectedStudents.slice(0, 20).forEach(s => {
        console.log(`  ${s.name}: ${s.enrollments.join(', ')}`);
    });
    if (affectedStudents.length > 20) {
        console.log(`  ... 외 ${affectedStudents.length - 20}명`);
    }

    console.log('\n--- 요약 ---');
    console.log(`영향받는 학생: ${affectedStudents.length}명`);
    console.log(`삭제될 enrollment: ${totalDeleted}건`);

    if (dryRun) {
        console.log('\n⚠️  DRY RUN 모드입니다. 실제 삭제하려면 --delete 옵션을 사용하세요.');
        console.log('    node scripts/deleteExcelMigrationEnrollments.cjs --delete');
    } else {
        console.log('\n✅ 삭제 완료!');
    }
}

// 명령줄 인수 확인
const args = process.argv.slice(2);
const shouldDelete = args.includes('--delete');

deleteExcelMigrationEnrollments(!shouldDelete)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('오류:', err);
        process.exit(1);
    });
