/**
 * 모순 enrollment record 일괄 청소 스크립트
 *
 * 대상: startDate > endDate 인 enrollment (이동일 취소 실패로 만들어진 record)
 *
 * 처리 방식 (Cancel ≠ Delete):
 *   - endDate 제거 (deleteField)
 *   - cancelledAt 추가 = 원래 endDate 값 (= 취소했던 시점 추정)
 *   - cancelledBy = 'system-cleanup'
 *   - cancelReason = '일회성 cleanup: 모순 record 정리'
 *
 *   → 이로써 record 는 보존되고, 새로운 cancel 시스템에 흡수됨.
 *     관리자 모달의 "취소된 예약" 섹션에서 보임 + 필요시 복원 가능.
 *
 * 실행:
 *   1) DRY-RUN (변경 없이 보기): node scripts/cleanup-broken-enrollments.mjs
 *   2) APPLY (실제 적용):       node scripts/cleanup-broken-enrollments.mjs --apply
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, deleteField } from 'firebase/firestore';
import { config } from 'dotenv';

config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'restore20260319');

const APPLY = process.argv.includes('--apply');
const today = new Date().toISOString().split('T')[0];

function fmtDate(v) {
    if (!v) return '-';
    if (typeof v === 'string') return v;
    if (v?.toDate) return v.toDate().toISOString().split('T')[0];
    return String(v);
}

(async () => {
    console.log(`\n=== 모순 enrollment cleanup ${APPLY ? '(APPLY MODE)' : '(DRY-RUN)'} ===`);
    console.log(`오늘=${today}\n`);

    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`총 학생 ${studentsSnap.size}명 스캔...\n`);

    const broken = []; // { studentId, studentName, enrollmentId, start, end, current }

    for (const studentDoc of studentsSnap.docs) {
        const studentId = studentDoc.id;
        const studentName = studentDoc.data().name || '(이름없음)';
        const enrollSnap = await getDocs(collection(db, 'students', studentId, 'enrollments'));

        for (const e of enrollSnap.docs) {
            const data = e.data();
            const start = fmtDate(data.startDate || data.enrollmentDate);
            const end = fmtDate(data.endDate || data.withdrawalDate);
            if (start === '-' || end === '-') continue;
            if (start <= end) continue; // 정상

            // 이미 cancelledAt 있는 경우는 처리됨 — skip
            if (data.cancelledAt) continue;

            broken.push({
                studentId,
                studentName,
                enrollmentId: e.id,
                start,
                end,
                className: data.className,
                subject: data.subject,
                staffId: data.staffId,
            });
        }
    }

    console.log(`발견된 모순 record: ${broken.length}개\n`);
    if (broken.length === 0) {
        console.log('✅ 청소할 record 없음');
        process.exit(0);
    }

    // 학생별 그룹 출력
    const byStudent = new Map();
    for (const b of broken) {
        if (!byStudent.has(b.studentId)) byStudent.set(b.studentId, { name: b.studentName, items: [] });
        byStudent.get(b.studentId).items.push(b);
    }
    for (const [sid, info] of byStudent) {
        console.log(`📌 ${info.name} (${sid}) — ${info.items.length}건`);
        for (const b of info.items) {
            console.log(`   - [${b.enrollmentId.slice(0, 8)}] ${b.subject || '?'}/${b.className || '?'} ${b.start} ~ ${b.end} (강사=${b.staffId || '-'})`);
        }
    }

    if (!APPLY) {
        console.log(`\n[DRY-RUN] 실제 적용 안 함. --apply 로 다시 실행하면 적용.`);
        process.exit(0);
    }

    // 실제 적용 — 학생당 batch 로 처리 (batch 제한 500 doc/batch)
    console.log(`\n적용 시작...`);
    let applied = 0;
    for (const [sid, info] of byStudent) {
        const batch = writeBatch(db);
        for (const b of info.items) {
            const ref = doc(db, 'students', sid, 'enrollments', b.enrollmentId);
            batch.update(ref, {
                cancelledAt: b.end,                            // 원래 endDate 가 취소 시점이었음
                cancelledBy: 'system-cleanup',
                cancelReason: `일회성 cleanup: 모순 record (startDate ${b.start} > endDate ${b.end})`,
                endDate: deleteField(),                        // 종료일 제거 — 취소로 전환
                withdrawalDate: deleteField(),
                updatedAt: new Date().toISOString(),
            });
            applied += 1;
        }
        await batch.commit();
        console.log(`  ✓ ${info.name} ${info.items.length}건 처리`);
    }

    console.log(`\n✅ 총 ${applied}개 record 정리 완료`);
    process.exit(0);
})().catch(err => {
    console.error('오류:', err);
    process.exit(1);
});