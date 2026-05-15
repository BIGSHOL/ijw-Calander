/**
 * Edutrix 동기화 실패 원인 진단 (브라우저 콘솔용)
 *
 * 사용법:
 *  1. https://ijw-calander.web.app 에 master/admin 계정으로 로그인
 *  2. 출석부(또는 출석부 테스트) 탭 진입
 *  3. F12 → Console 탭
 *  4. 아래 코드 전체 복사 → 콘솔에 붙여넣고 Enter
 *  5. 잠시 기다리면 결과 출력
 *
 * 변경 없음 (read-only). useEdutrixSync.ts 의 매칭 로직을 그대로 재현.
 */
(async () => {
    const TARGET_YEAR_MONTH = '2026-05';  // 진단할 월

    console.log(`%c========== Edutrix 동기화 진단 (${TARGET_YEAR_MONTH}) ==========`, 'background:#4f46e5;color:#fff;padding:4px 8px;font-weight:bold;');

    // Firestore + Supabase 인스턴스를 window에서 찾거나 import
    const { collection, getDocs, query, where, doc, getDoc } = await import('firebase/firestore');
    const db = (await import('/firebaseConfig.ts')).db || (await import('../firebaseConfig')).db;
    if (!db) { console.error('Firestore db 인스턴스를 찾을 수 없습니다.'); return; }
    const { supabase, fetchReportsByMonth } = await import('/services/supabaseClient.ts')
        .catch(() => import('../services/supabaseClient'));
    if (!supabase) { console.error('Supabase 클라이언트를 찾을 수 없습니다.'); return; }

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
                } else if (slot && typeof slot === 'object' && typeof slot.day === 'string') {
                    days.add(slot.day);
                }
            }
        }
        if (Array.isArray(enrollment.days)) {
            for (const d of enrollment.days) if (typeof d === 'string') days.add(d);
        }
        return days;
    }

    console.log('[1/4] Edutrix 보고서 fetch...');
    const reports = await fetchReportsByMonth(TARGET_YEAR_MONTH);
    console.log(`  → ${reports.length}건`);
    if (reports.length === 0) return;

    console.log('[2/4] IJW students/staff/holidays...');
    const studentsSnap = await getDocs(collection(db, 'students'));
    const ijwStudents = studentsSnap.docs.map(d => ({
        id: d.id, name: (d.data().name || '').toString(),
    }));
    const nameToStudent = new Map();
    for (const s of ijwStudents) nameToStudent.set(s.name.trim().replace(/\s+/g, ''), s);

    const staffSnap = await getDocs(query(collection(db, 'staff'), where('status', '==', 'active')));
    const ijwStaff = staffSnap.docs.map(d => ({ id: d.id, name: (d.data().name || '').toString() }));
    const teacherNameToStaffId = new Map();
    for (const t of ijwStaff) teacherNameToStaffId.set(t.name.trim().replace(/\s+/g, ''), t.id);

    const holidaysSnap = await getDocs(collection(db, 'holidays'));
    const holidaySet = new Set();
    holidaysSnap.docs.forEach(d => { const date = d.data().date; if (date) holidaySet.add(date); });
    console.log(`  → students ${ijwStudents.length} / staff ${ijwStaff.length} / holidays ${holidaySet.size}`);

    console.log('[3/4] 매칭 시뮬레이션...');
    const enrollmentCache = new Map();
    const fetchEnr = async (sid) => {
        if (enrollmentCache.has(sid)) return enrollmentCache.get(sid);
        const snap = await getDocs(collection(db, 'students', sid, 'enrollments'));
        const enr = snap.docs.map(d => {
            const data = d.data();
            return {
                className: data.className || '', staffId: data.staffId || '',
                teacher: data.teacher || '', subject: data.subject || '',
                days: data.days || [], schedule: data.schedule || [],
            };
        });
        enrollmentCache.set(sid, enr);
        return enr;
    };

    const cats = {
        student_not_found: [],
        holiday: [],
        teacher_match_failed_subject_missing: [],
        teacher_match_failed_no_teacher: [],
        teacher_match_failed_other: [],
        day_mismatch: [],
        synced: 0,
    };

    let progress = 0;
    for (const r of reports) {
        progress++;
        if (progress % 100 === 0) console.log(`  ... ${progress}/${reports.length}`);

        const sn = (r.student_name || '').trim().replace(/\s+/g, '');
        const student = nameToStudent.get(sn);
        if (!student) {
            cats.student_not_found.push({ date: r.date, student: r.student_name, class: r.class_name });
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
            if (mathEnr.length === 0 && enrollments.length > 0) {
                const counts = {};
                for (const e of enrollments) { const k = e.subject || '(없음)'; counts[k] = (counts[k] || 0) + 1; }
                cats.teacher_match_failed_subject_missing.push({
                    student: r.student_name, edutrixTeacher: r.teacher_name, date: r.date, subjects: counts,
                });
            } else if (mathEnr.length > 0 && teacherMath.length === 0) {
                cats.teacher_match_failed_no_teacher.push({
                    student: r.student_name, edutrixTeacher: r.teacher_name, date: r.date,
                    mathEnrTeachers: mathEnr.map(e => ({ cls: e.className, teacher: e.teacher, staffId: e.staffId })),
                });
            } else {
                cats.teacher_match_failed_other.push({
                    student: r.student_name, edutrixTeacher: r.teacher_name, date: r.date,
                    mathEnr: mathEnr.length, teacherMath: teacherMath.length,
                });
            }
            continue;
        }
        const final = enrollments.find(e => e.className === className);
        if (final) {
            const sched = getScheduledDays(final);
            if (sched.size > 0 && !sched.has(reportDay)) {
                const fallback = teacherMath.find(e => e.className !== className && matchesDay(e));
                if (!fallback) {
                    cats.day_mismatch.push({ date: r.date, student: r.student_name, className, reportDay, scheduled: [...sched] });
                    continue;
                }
            }
        }
        cats.synced++;
    }

    console.log('[4/4] 결과 분류');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.table({
        '✅ 성공': cats.synced,
        '❌ 학생 매칭 실패': cats.student_not_found.length,
        '❌ 강사매칭: subject 없음': cats.teacher_match_failed_subject_missing.length,
        '❌ 강사매칭: 강사명 불일치': cats.teacher_match_failed_no_teacher.length,
        '❌ 강사매칭: 기타': cats.teacher_match_failed_other.length,
        '⏭️ 요일 불일치': cats.day_mismatch.length,
        '⏭️ 휴일': cats.holiday.length,
    });

    const showSamples = (label, arr, n = 5) => {
        if (arr.length === 0) return;
        console.log(`%c── ${label} (총 ${arr.length}, 샘플 ${Math.min(n, arr.length)}건) ──`, 'color:#dc2626;font-weight:bold;');
        console.table(arr.slice(0, n));
    };
    showSamples('학생 매칭 실패', cats.student_not_found);
    showSamples('강사매칭 실패: subject(math) 없음', cats.teacher_match_failed_subject_missing);
    showSamples('강사매칭 실패: 강사명 불일치', cats.teacher_match_failed_no_teacher);
    showSamples('강사매칭 실패: 기타', cats.teacher_match_failed_other);
    showSamples('요일 불일치', cats.day_mismatch);
    showSamples('휴일', cats.holiday, 3);

    // 전역에 결과 저장 — 콘솔에서 추가 분석 가능
    window.__edutrixDiagnosis = cats;
    console.log('%c결과가 window.__edutrixDiagnosis 에 저장됨. 콘솔에서 추가 분석 가능.', 'color:#059669;');
})();