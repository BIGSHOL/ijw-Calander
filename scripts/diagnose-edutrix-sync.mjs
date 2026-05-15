/**
 * Edutrix 동기화 실패 원인 진단 (dry-run, 변경 없음)
 *
 * useEdutrixSync.ts 의 매칭 로직을 그대로 재현하여
 * 매칭실패 / 스킵 케이스를 카테고리별 분류 + 샘플 출력.
 *
 * 실행: cd D:\ijw-Calander && node scripts/diagnose-edutrix-sync.mjs [YYYY-MM]
 *       (기본값: 현재 월)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
);

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const getKoreanDayName = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return DAY_NAMES[new Date(y, m - 1, d).getDay()];
};

function getScheduledDays(enrollment) {
    const days = new Set();
    if (Array.isArray(enrollment.schedule)) {
        for (const slot of enrollment.schedule) {
            if (typeof slot === 'string') {
                const day = slot.split(/[\s_]+/)[0];
                if (day) days.add(day);
            } else if (slot && typeof slot === 'object') {
                if (typeof slot.day === 'string' && slot.day) days.add(slot.day);
            }
        }
    }
    if (Array.isArray(enrollment.days)) {
        for (const d of enrollment.days) {
            if (typeof d === 'string' && d) days.add(d);
        }
    }
    return days;
}

async function fetchReportsByMonth(yearMonth) {
    const start = `${yearMonth}-01`;
    const [y, m] = yearMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
    let all = [], from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('reports')
            .select(`id,date,student_id,class_id,writer_id,lateness,students!inner(name),classes(name)`)
            .gte('date', start).lte('date', end)
            .order('date', { ascending: true })
            .range(from, from + 999);
        if (error) throw error;
        const got = data || [];
        all = all.concat(got);
        if (got.length < 1000) break;
        from += 1000;
    }
    return all.map(row => ({
        date: row.date,
        student_name: row.students?.name || null,
        class_name: row.classes?.name || null,
        teacher_name: row.classes?.name ? row.classes.name.split(/[\s_]+/)[0] : null,
    }));
}

async function run() {
    const arg = process.argv[2];
    const yearMonth = arg || (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();

    console.log(`\n========== Edutrix 동기화 진단 (${yearMonth}) ==========\n`);

    // 1) Edutrix 보고서
    console.log('[1/4] Edutrix 보고서 fetch...');
    const reports = await fetchReportsByMonth(yearMonth);
    console.log(`  → ${reports.length}건`);

    if (reports.length === 0) {
        console.log('보고서 0건. 종료.');
        return;
    }

    // 2) IJW 학생 + 정규화 맵
    console.log('[2/4] IJW students/staff/holidays...');
    const studentsSnap = await getDocs(collection(db, 'students'));
    const ijwStudents = studentsSnap.docs.map(d => ({
        id: d.id,
        name: (d.data().name || '').toString(),
        status: d.data().status || 'active',
    }));
    const nameToStudent = new Map();
    for (const s of ijwStudents) {
        nameToStudent.set(s.name.trim().replace(/\s+/g, ''), s);
    }

    // 3) IJW staff (status=active)
    const staffSnap = await getDocs(
        query(collection(db, 'staff'), where('status', '==', 'active'))
    );
    const ijwStaff = staffSnap.docs.map(d => ({
        id: d.id,
        name: (d.data().name || '').toString(),
    }));
    const teacherNameToStaffId = new Map();
    for (const t of ijwStaff) {
        teacherNameToStaffId.set(t.name.trim().replace(/\s+/g, ''), t.id);
    }

    // 4) holidays
    const holidaysSnap = await getDocs(collection(db, 'holidays'));
    const holidaySet = new Set();
    holidaysSnap.docs.forEach(d => {
        const date = d.data().date;
        if (date) holidaySet.add(date);
    });

    console.log(`  → students ${ijwStudents.length} / staff ${ijwStaff.length} / holidays ${holidaySet.size}`);

    // 5) 매칭 로직 재현
    console.log('[3/4] 매칭 시뮬레이션...');
    const enrollmentCache = new Map();
    const fetchEnr = async (sid) => {
        if (enrollmentCache.has(sid)) return enrollmentCache.get(sid);
        const snap = await getDocs(collection(db, 'students', sid, 'enrollments'));
        const enr = snap.docs.map(d => {
            const data = d.data();
            return {
                className: data.className || '',
                staffId: data.staffId || '',
                teacher: data.teacher || '',
                subject: data.subject || '',
                days: data.days || [],
                schedule: data.schedule || [],
            };
        });
        enrollmentCache.set(sid, enr);
        return enr;
    };

    const cats = {
        student_not_found: [],      // 학생 매칭 실패
        holiday: [],                 // 휴일
        teacher_match_failed_subject_missing: [],  // math enrollment 0개 (subject 분포 표시)
        teacher_match_failed_no_teacher: [],       // math enrollment N개, teacher매칭 0개
        teacher_match_failed_other: [],            // 그 외
        day_mismatch: [],            // 요일 불일치
        synced: 0,
    };

    for (const r of reports) {
        const sn = (r.student_name || '').trim().replace(/\s+/g, '');
        const student = nameToStudent.get(sn);
        if (!student) {
            cats.student_not_found.push({
                date: r.date, student: r.student_name, class: r.class_name
            });
            continue;
        }
        const dateKey = r.date;
        const reportDay = getKoreanDayName(dateKey);
        if (holidaySet.has(dateKey)) {
            cats.holiday.push({ date: dateKey, student: r.student_name });
            continue;
        }
        const enrollments = await fetchEnr(student.id);
        const tn = (r.teacher_name || '').trim().replace(/\s+/g, '');
        const matchedStaffId = tn ? teacherNameToStaffId.get(tn) : undefined;
        const mathEnr = enrollments.filter(e => e.subject === 'math');
        const isTeacherMatch = (e) => {
            if (matchedStaffId && e.staffId === matchedStaffId) return true;
            if (tn && e.teacher) {
                const norm = e.teacher.trim().replace(/\s+/g, '');
                if (norm === tn) return true;
                if (matchedStaffId && norm === matchedStaffId) return true;
            }
            return false;
        };
        const teacherMath = mathEnr.filter(isTeacherMatch);
        const matchesDay = (e) => {
            const d = getScheduledDays(e);
            return d.size === 0 || d.has(reportDay);
        };

        let className = '';
        const best = teacherMath.find(matchesDay);
        if (best) className = best.className;
        if (!className && teacherMath.length === 1) className = teacherMath[0].className;

        if (!className) {
            // 분류
            if (mathEnr.length === 0 && enrollments.length > 0) {
                const counts = {};
                for (const e of enrollments) {
                    const k = e.subject || '(없음)';
                    counts[k] = (counts[k] || 0) + 1;
                }
                cats.teacher_match_failed_subject_missing.push({
                    student: r.student_name, edutrixTeacher: r.teacher_name,
                    date: r.date, subjects: counts,
                });
            } else if (mathEnr.length > 0 && teacherMath.length === 0) {
                cats.teacher_match_failed_no_teacher.push({
                    student: r.student_name, edutrixTeacher: r.teacher_name,
                    date: r.date,
                    mathEnrTeachers: mathEnr.map(e => ({
                        cls: e.className, teacher: e.teacher, staffId: e.staffId,
                    })),
                });
            } else {
                cats.teacher_match_failed_other.push({
                    student: r.student_name, edutrixTeacher: r.teacher_name,
                    date: r.date, mathEnr: mathEnr.length, teacherMath: teacherMath.length,
                });
            }
            continue;
        }

        // 요일 검증
        const final = enrollments.find(e => e.className === className);
        if (final) {
            const sched = getScheduledDays(final);
            if (sched.size > 0 && !sched.has(reportDay)) {
                const fallback = teacherMath.find(e => e.className !== className && matchesDay(e));
                if (!fallback) {
                    cats.day_mismatch.push({
                        date: r.date, student: r.student_name,
                        className, reportDay, scheduled: [...sched],
                    });
                    continue;
                }
            }
        }
        cats.synced++;
    }

    // 6) 출력
    console.log('[4/4] 결과 분류\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ✅ 성공 (synced):              ${cats.synced}`);
    console.log(`  ❌ 학생 매칭 실패:              ${cats.student_not_found.length}`);
    console.log(`  ❌ 강사매칭 실패 (subject):    ${cats.teacher_match_failed_subject_missing.length}  ← math enrollment 0개`);
    console.log(`  ❌ 강사매칭 실패 (teacher):    ${cats.teacher_match_failed_no_teacher.length}  ← math 있는데 강사명 안 맞음`);
    console.log(`  ❌ 강사매칭 실패 (기타):       ${cats.teacher_match_failed_other.length}`);
    console.log(`  ⏭️  요일 불일치:                 ${cats.day_mismatch.length}`);
    console.log(`  ⏭️  휴일:                        ${cats.holiday.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const showSamples = (label, arr, n = 5) => {
        if (arr.length === 0) return;
        console.log(`\n── ${label} (총 ${arr.length}, 샘플 ${Math.min(n, arr.length)}건) ──`);
        arr.slice(0, n).forEach((x, i) => {
            console.log(`  ${i + 1}.`, JSON.stringify(x));
        });
    };

    showSamples('학생 매칭 실패', cats.student_not_found);
    showSamples('강사매칭 실패: subject(math) 없음', cats.teacher_match_failed_subject_missing);
    showSamples('강사매칭 실패: 강사명 불일치', cats.teacher_match_failed_no_teacher);
    showSamples('강사매칭 실패: 기타', cats.teacher_match_failed_other);
    showSamples('요일 불일치', cats.day_mismatch);
    showSamples('휴일', cats.holiday, 3);

    console.log('\n========== 진단 완료 ==========');
    process.exit(0);
}

run().catch(err => {
    console.error('\n❌ 진단 실패:', err);
    process.exit(1);
});
