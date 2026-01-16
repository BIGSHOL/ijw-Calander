/**
 * 잘못 생성된 학생 문서 삭제 스크립트
 * - 랜덤 ID (wdLX7F... 형식)
 * - 숫자 ID (13803 형식)
 * 정상 ID는 "이름_학교_학년" 형식 (예: 강민승_달성초_3)
 * 
 * 사용법:
 *   DRY RUN: node scripts/deleteInvalidStudents.cjs
 *   실제 삭제: node scripts/deleteInvalidStudents.cjs --delete
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

// 정상 ID 패턴: 한글이름_학교_학년 (예: 강민승_달성초_3)
function isValidStudentId(id) {
    // 한글로 시작하고 _ 구분자가 있는 패턴
    const validPattern = /^[가-힣]+_[가-힣]+_\d+$/;
    return validPattern.test(id);
}

async function deleteInvalidStudents(dryRun = true) {
    console.log('='.repeat(60));
    console.log(`잘못 생성된 학생 문서 삭제 스크립트 (${dryRun ? 'DRY RUN' : '실제 삭제'})`);
    console.log('='.repeat(60));

    const studentsSnapshot = await db.collection('students').get();
    console.log(`\n총 학생 문서 수: ${studentsSnapshot.size}개\n`);

    const validDocs = [];
    const invalidDocs = [];
    const randomIdDocs = [];
    const numericIdDocs = [];

    for (const doc of studentsSnapshot.docs) {
        const id = doc.id;
        const data = doc.data();

        if (isValidStudentId(id)) {
            validDocs.push({ id, name: data.name });
        } else {
            invalidDocs.push({ id, name: data.name || '(이름없음)' });

            // 분류
            if (/^\d+$/.test(id)) {
                numericIdDocs.push({ id, name: data.name });
            } else {
                randomIdDocs.push({ id, name: data.name });
            }
        }
    }

    console.log('\n--- 정상 문서 ---');
    console.log(`정상 형식 (이름_학교_학년): ${validDocs.length}개`);

    console.log('\n--- 삭제 대상 ---');
    console.log(`랜덤 ID 문서: ${randomIdDocs.length}개`);
    randomIdDocs.slice(0, 5).forEach(d => console.log(`  ${d.id}: ${d.name}`));
    if (randomIdDocs.length > 5) console.log(`  ... 외 ${randomIdDocs.length - 5}개`);

    console.log(`\n숫자 ID 문서: ${numericIdDocs.length}개`);
    numericIdDocs.slice(0, 5).forEach(d => console.log(`  ${d.id}: ${d.name}`));
    if (numericIdDocs.length > 5) console.log(`  ... 외 ${numericIdDocs.length - 5}개`);

    console.log('\n--- 요약 ---');
    console.log(`보존: ${validDocs.length}개`);
    console.log(`삭제 대상: ${invalidDocs.length}개`);

    if (!dryRun && invalidDocs.length > 0) {
        console.log('\n삭제 진행 중...');

        // 배치 삭제 (최대 500개씩)
        const batchSize = 400;
        for (let i = 0; i < invalidDocs.length; i += batchSize) {
            const batch = db.batch();
            const batchDocs = invalidDocs.slice(i, i + batchSize);

            for (const doc of batchDocs) {
                // 서브컬렉션 (enrollments) 먼저 삭제
                const enrollmentsRef = db.collection('students').doc(doc.id).collection('enrollments');
                const enrollments = await enrollmentsRef.get();
                enrollments.docs.forEach(e => batch.delete(e.ref));

                // 학생 문서 삭제
                batch.delete(db.collection('students').doc(doc.id));
            }

            await batch.commit();
            console.log(`  ${Math.min(i + batchSize, invalidDocs.length)}/${invalidDocs.length} 삭제 완료`);
        }

        console.log('\n✅ 삭제 완료!');
    } else if (dryRun) {
        console.log('\n⚠️  DRY RUN 모드입니다. 실제 삭제하려면 --delete 옵션을 사용하세요.');
        console.log('    node scripts/deleteInvalidStudents.cjs --delete');
    }
}

// 명령줄 인수 확인
const args = process.argv.slice(2);
const shouldDelete = args.includes('--delete');

deleteInvalidStudents(!shouldDelete)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('오류:', err);
        process.exit(1);
    });
