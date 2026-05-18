/**
 * 대시보드 KPI 0% 진단 — 데이터 부재 vs 매칭 오류 구분
 *
 * 점검 항목:
 *  1) daily_attendance/{today}/records — 오늘 출결 데이터
 *  2) attendance_records — 같은 날짜에 출석부 데이터 (참고)
 *  3) studentConsultations / studentConsultations 하위 — 이번 달 상담 기록
 *
 * 실행: node scripts/diagnose-dashboard-kpi.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, collectionGroup, getDocs, query, where } from 'firebase/firestore';
import { config } from 'dotenv';
config({ path: '.env.local' });

const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app, 'restore20260319');

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
const monthEnd = (() => {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
})();

console.log('========== 대시보드 KPI 진단 ==========');
console.log(`오늘: ${today}`);
console.log(`이번 달: ${monthStart} ~ ${monthEnd}\n`);

// 1) 오늘 daily_attendance
try {
    const snap = await getDocs(collection(db, 'daily_attendance', today, 'records'));
    console.log(`[오늘 출석률 데이터]`);
    console.log(`  daily_attendance/${today}/records: ${snap.size}건`);
    if (snap.size > 0) {
        const sample = snap.docs[0].data();
        console.log(`  샘플: ${sample.studentName} / ${sample.className} / status=${sample.status}`);
    } else {
        console.log(`  → 0건이므로 KPI 0% (정상 동작, 데이터 부재)`);
    }
} catch (e) {
    console.error(`  daily_attendance 조회 실패:`, e.message);
}

// 2) 오늘 attendance_records (참고)
try {
    const arSnap = await getDocs(collection(db, 'attendance_records'));
    let todayCellCount = 0;
    arSnap.docs.forEach(d => {
        const data = d.data();
        const att = data.attendance || {};
        Object.keys(att).forEach(k => {
            if (k.includes(today)) todayCellCount++;
        });
    });
    console.log(`\n[참고: 출석부(attendance_records)]`);
    console.log(`  전체 학생 문서: ${arSnap.size}건`);
    console.log(`  오늘(${today}) 셀이 있는 attendance 키 개수: ${todayCellCount}`);
} catch (e) {
    console.error(`  attendance_records 조회 실패:`, e.message);
}

// 3) 이번 달 상담 기록 — collectionGroup
try {
    const studentConsSnap = await getDocs(collectionGroup(db, 'studentConsultations'));
    console.log(`\n[상담 완료율 데이터]`);
    console.log(`  studentConsultations 전체 (collectionGroup): ${studentConsSnap.size}건`);

    const thisMonth = studentConsSnap.docs.filter(d => {
        const data = d.data();
        const dateField = data.consultationDate || data.date || data.createdAt;
        if (!dateField) return false;
        const s = typeof dateField === 'string' ? dateField : (dateField.toDate?.()?.toISOString().slice(0, 10) ?? '');
        return s >= monthStart && s <= monthEnd;
    });
    console.log(`  이번 달(${monthStart}~${monthEnd}) 상담 기록: ${thisMonth.length}건`);

    if (thisMonth.length > 0) {
        console.log(`\n  샘플 (앞 3건):`);
        thisMonth.slice(0, 3).forEach((d, i) => {
            const data = d.data();
            console.log(`    ${i + 1}. ${data.studentName ?? '(이름없음)'} / ${data.consultationDate ?? data.date ?? '?'} / subject=${data.subject ?? '?'} / consultantName=${data.consultantName ?? '?'}`);
        });
    } else {
        console.log(`  → 이번 달 상담 기록이 정말 0건이므로 KPI 0% (정상)`);
    }

    // 재원생 수 확인
    const activeStudentsSnap = await getDocs(
        query(collection(db, 'students'), where('status', '==', 'active'))
    );
    console.log(`\n  재원생(status=active): ${activeStudentsSnap.size}명`);
} catch (e) {
    console.error(`  상담 조회 실패:`, e.message);
}

console.log('\n========== 완료 ==========');
process.exit(0);