/**
 * 김지호 학생 enrollment 진단 (dry-run, 변경 없음)
 *
 * 목적: 이동일 삭제 후 발생한 모순 enrollment record 식별
 *  - startDate > endDate (논리 모순)
 *  - 미래 startDate + endDate set (이동일 취소 실패)
 *
 * 실행: cd D:\ijw-Calander && node scripts/check-kimjiho.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
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

const TARGET_NAME = '김지호';
const today = new Date().toISOString().split('T')[0];

function fmtDate(v) {
    if (!v) return '-';
    if (typeof v === 'string') return v;
    if (v?.toDate) return v.toDate().toISOString().split('T')[0];
    return String(v);
}

(async () => {
    console.log(`\n=== ${TARGET_NAME} 진단 (오늘=${today}) ===\n`);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const matches = [];
    studentsSnap.forEach(d => {
        const data = d.data();
        if (data.name === TARGET_NAME) matches.push({ id: d.id, ...data });
    });

    if (matches.length === 0) {
        console.log(`❌ "${TARGET_NAME}" 학생 없음`);
        process.exit(1);
    }

    for (const s of matches) {
        console.log(`학생: ${s.name} (id=${s.id}, status=${s.status})`);
        const enrollSnap = await getDocs(collection(db, 'students', s.id, 'enrollments'));
        console.log(`enrollment 총 ${enrollSnap.size}개:\n`);

        const broken = [];
        enrollSnap.forEach(e => {
            const data = e.data();
            const start = fmtDate(data.startDate || data.enrollmentDate);
            const end = fmtDate(data.endDate || data.withdrawalDate);
            const subject = data.subject || '?';
            const className = data.className || '?';
            const staffId = data.staffId || '-';
            const ad = (data.attendanceDays || []).join(',') || '-';
            const onHold = data.onHold === true;

            // 모순 판정
            let issue = null;
            const hasStart = start !== '-';
            const hasEnd = end !== '-';
            if (hasStart && hasEnd) {
                if (start > end) issue = `🚨 startDate > endDate (${start} > ${end})`;
                else if (start > today && end <= today) issue = `🚨 미래 시작 + 과거/오늘 종료 (${start} 시작, ${end} 종료) — 이동일 취소 실패 record`;
            }

            const tag = issue ? '❌' : '  ';
            console.log(`${tag} [${e.id.slice(0, 8)}...] ${subject} | ${className} | ${start} ~ ${end} | onHold=${onHold} | days=${ad} | staffId=${staffId}`);
            if (issue) {
                console.log(`     ${issue}`);
                broken.push({ id: e.id, subject, className, start, end, data });
            }
        });

        console.log(`\n=== 요약 ===`);
        console.log(`전체 enrollment: ${enrollSnap.size}개`);
        console.log(`모순 record: ${broken.length}개`);
        if (broken.length > 0) {
            console.log(`\n삭제 대상 (확인 후 cleanup 스크립트로 일괄 삭제):`);
            broken.forEach(b => console.log(`  - ${b.id} (${b.subject}/${b.className} ${b.start}~${b.end})`));
        }
    }

    process.exit(0);
})().catch(err => {
    console.error('오류:', err);
    process.exit(1);
});