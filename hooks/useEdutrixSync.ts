import { useState, useCallback } from 'react';
import { doc, setDoc, deleteField, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';
import { fetchReportsByMonth, mapReportToAttendanceValue } from '../services/supabaseClient';

/** 한국어 요일명 (Date.getDay() 인덱스) */
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/** YYYY-MM-DD → 한국어 요일명 */
function getKoreanDayName(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    return DAY_NAMES[new Date(year, month - 1, day).getDay()];
}

/** enrollment에서 수업 요일 추출.
 *  schedule 배열 요소는 레거시 string("월 1교시"), 언더스코어 변형("월_1교시"),
 *  또는 object({day: "월", periodId: "1-1"}) 형태가 공존함. 세 형태 모두 안전하게 처리.
 */
function getScheduledDays(enrollment: { days?: string[]; schedule?: unknown[] }): Set<string> {
    const days = new Set<string>();
    if (enrollment.schedule && Array.isArray(enrollment.schedule)) {
        for (const slot of enrollment.schedule) {
            if (typeof slot === 'string') {
                // 공백 또는 언더스코어 분리 — "월 1교시" / "월_1교시" 모두 대응
                const day = slot.split(/[\s_]+/)[0];
                if (day) days.add(day);
            } else if (slot && typeof slot === 'object') {
                // ScheduleSlot 객체 형식 { day, periodId, ... }
                const day = (slot as { day?: unknown }).day;
                if (typeof day === 'string' && day) days.add(day);
            }
        }
    }
    if (enrollment.days && Array.isArray(enrollment.days)) {
        for (const d of enrollment.days) {
            if (typeof d === 'string' && d) days.add(d);
        }
    }
    return days;
}

/** Firestore Timestamp 또는 string → "YYYY-MM-DD" */
function tsToDateStr(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v.length >= 10 ? v.substring(0, 10) : v;
    if (v?.toDate && typeof v.toDate === 'function') {
        const d: Date = v.toDate();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (v instanceof Date) {
        return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    }
    return null;
}

/** Edutrix 클래스명에서 요일 추출 (예: "김윤하_월_3교시" → "월") */
function extractDayFromEdutrixClassName(className: string | null): string | null {
    if (!className) return null;
    const tokens = className.split(/[\s_]+/);
    // 두 번째 토큰이 요일명이면 반환
    if (tokens.length >= 2) {
        const dayToken = tokens[1];
        if (DAY_NAMES.includes(dayToken)) return dayToken;
    }
    return null;
}

/** 과제 점수 → 제출 여부 (0%만 미제출, 비어있거나 나머지 = 제출) */
function isHomeworkSubmitted(assignmentScore: string | null | undefined): boolean {
    if (assignmentScore === null || assignmentScore === undefined || assignmentScore === '') return true;
    const score = parseInt(assignmentScore, 10);
    if (isNaN(score)) return true;
    return score > 0;
}

/**
 * 시험 점수를 10점 만점으로 환산합니다.
 * "20/25" → Math.round(20/25 * 10) = 8
 */
function parseExamScoreTo10(examInfo: string | null): number | null {
    if (!examInfo || !examInfo.trim()) return null;
    const match = examInfo.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (match) {
        const score = parseFloat(match[1]);
        const maxScore = parseFloat(match[2]);
        if (maxScore > 0) {
            return Math.round((score / maxScore) * 10);
        }
    }
    const num = parseFloat(examInfo.trim());
    if (!isNaN(num)) {
        if (num > 10) return Math.round(num / 10);
        return Math.round(num);
    }
    return null;
}

/** 동기화 결과 */
export interface SyncResult {
    totalReports: number;
    matched: number;
    skipped: number;
    alreadyMarked: number;
    errors: number;
    details: SyncDetail[];
    yearMonth: string;
    dryRun?: boolean;
    /** 영어/타과목 보고서로 분류되어 동기화 대상에서 제외된 건수 */
    otherSubject?: number;
}

export interface SyncDetail {
    studentName: string;
    className: string;
    date: string;
    status: 'synced' | 'skipped_absent' | 'skipped_no_match' | 'skipped_not_scheduled' | 'skipped_other_subject' | 'already_marked' | 'error';
    attendanceValue?: number;
    message?: string;
}

/** 동기화 옵션 */
export interface SyncOptions {
    /** true 면 매칭/스킵 집계만 수행하고 Firestore 쓰기 생략 (출석부 테스트 탭용) */
    dryRun?: boolean;
    /** 동기화 과목 — 출석부 헤더의 selectedSubject 따라 결정. 기본 'math' */
    subject?: 'math' | 'english';
}

/** 수학 동기화 대상으로 인식할 enrollment subject */
const MATH_SUBJECTS = ['math', 'highmath'] as const;
const ENGLISH_SUBJECTS = ['english'] as const;

/** Edutrix 클래스명의 첫 토큰이 실제 강사명이 아닌 카테고리 prefix 인 경우 (수학 보고서) */
const NON_TEACHER_PREFIXES = new Set([
    '중등M', '초등M', '고등M', '중등', '초등', '고등',
    '중등H', '초등H', '고등H',
]);

/**
 * Edutrix 보고서 기반 출석 동기화 훅
 */
export function useEdutrixSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [lastResult, setLastResult] = useState<SyncResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const fetchIjwStudents = useCallback(async () => {
        // 퇴원생 포함 전체 학생 조회 (퇴원생도 과거 출석 동기화 필요)
        const studentsSnap = await getDocs(collection(db, 'students'));
        return studentsSnap.docs.map(d => ({
            id: d.id,
            name: (d.data().name || '') as string,
            status: (d.data().status || 'active') as string,
        }));
    }, []);

    const fetchIjwStaff = useCallback(async () => {
        const staffSnap = await getDocs(
            query(collection(db, 'staff'), where('status', '==', 'active'))
        );
        return staffSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: (data.name || '') as string,
                subjects: (data.subjects || []) as string[],
            };
        });
    }, []);

    const fetchStudentEnrollments = useCallback(async (studentId: string) => {
        const enrollSnap = await getDocs(
            collection(db, 'students', studentId, 'enrollments')
        );
        return enrollSnap.docs.map(d => {
            const data = d.data();
            return {
                className: (data.className || '') as string,
                classId: (data.classId || '') as string,
                staffId: (data.staffId || '') as string,
                teacher: (data.teacher || '') as string,
                subject: (data.subject || '') as string,
                days: (data.days || []) as string[],
                // schedule은 레거시 string / 현행 ScheduleSlot object 혼재 가능 → unknown[]으로 받고
                // getScheduledDays에서 타입별로 안전 파싱
                schedule: (data.schedule || []) as unknown[],
                // 활성 기간 판정용
                startDate: tsToDateStr(data.startDate) || tsToDateStr(data.enrollmentDate),
                endDate: tsToDateStr(data.endDate),
                withdrawalDate: tsToDateStr(data.withdrawalDate),
                onHold: data.onHold === true,
                cancelledAt: tsToDateStr(data.cancelledAt),
            };
        });
    }, []);

    const fetchHolidays = useCallback(async (): Promise<Set<string>> => {
        const snap = await getDocs(collection(db, 'holidays'));
        const set = new Set<string>();
        snap.docs.forEach(d => {
            const date = d.data().date;
            if (date) set.add(date);
        });
        return set;
    }, []);

    const syncFromEdutrix = useCallback(async (
        yearMonth: string,
        staffId?: string,
        options?: SyncOptions,
    ): Promise<SyncResult> => {
        const dryRun = options?.dryRun === true;
        const subject: 'math' | 'english' = options?.subject || 'math';
        const TARGET_SUBJECTS: readonly string[] = subject === 'english' ? ENGLISH_SUBJECTS : MATH_SUBJECTS;
        setIsSyncing(true);
        setError(null);

        const result: SyncResult = {
            totalReports: 0,
            matched: 0,
            skipped: 0,
            alreadyMarked: 0,
            errors: 0,
            details: [],
            yearMonth,
            dryRun,
            otherSubject: 0,
        };

        try {
            console.log(`[EdutrixSync] ===== 동기화 시작: ${yearMonth} =====`);

            const reports = await fetchReportsByMonth(yearMonth);
            result.totalReports = reports.length;
            console.log(`[EdutrixSync] Step 1: Edutrix 보고서 ${reports.length}건 조회됨`);

            // [임시 진단] 5/15 금요일 보고서 raw 데이터 dump — 추적 후 제거 예정
            const DEBUG_DATE = '2026-05-15';
            const debugReports = reports.filter(r => r.date === DEBUG_DATE);
            const debugByTeacher: Record<string, number> = {};
            debugReports.forEach(r => {
                const t = r.teacher_name || '(강사없음)';
                debugByTeacher[t] = (debugByTeacher[t] || 0) + 1;
            });
            // eslint-disable-next-line no-console
            console.log(`[Edutrix${DEBUG_DATE}진단]`, {
                보고서_총건수: debugReports.length,
                강사별_건수: debugByTeacher,
                보고서_샘플_상위20: debugReports.slice(0, 20).map(r => ({
                    학생: r.student_name,
                    반: r.class_name,
                    강사: r.teacher_name,
                    출결: r.lateness,
                    진도: r.progress,
                    과제: r.assignment_score,
                    태도: r.study_attitude,
                })),
                전체_보고서: debugReports,
            });

            if (reports.length === 0) {
                console.warn('[EdutrixSync] 보고서가 0건입니다. 동기화 종료.');
                setLastResult(result);
                setIsSyncing(false);
                return result;
            }

            const [ijwStudents, ijwStaff] = await Promise.all([
                fetchIjwStudents(),
                fetchIjwStaff(),
            ]);
            console.log(`[EdutrixSync] Step 2: IJW 학생 ${ijwStudents.length}명, staff ${ijwStaff.length}명`);

            const nameToStudentMap = new Map<string, typeof ijwStudents[0]>();
            for (const student of ijwStudents) {
                const normalizedName = student.name.trim().replace(/\s+/g, '');
                nameToStudentMap.set(normalizedName, student);
            }

            const teacherNameToStaffId = new Map<string, string>();
            const staffIdToSubjects = new Map<string, string[]>();
            const teacherNameToSubjects = new Map<string, string[]>();
            for (const staff of ijwStaff) {
                const normalizedName = staff.name.trim().replace(/\s+/g, '');
                teacherNameToStaffId.set(normalizedName, staff.id);
                staffIdToSubjects.set(staff.id, staff.subjects);
                teacherNameToSubjects.set(normalizedName, staff.subjects);
            }

            // 강사가 동기화 대상 과목 강사인지 판정 — subjects 배열로 확인
            const isTargetTeacherByName = (teacherName: string): boolean | null => {
                const subjects = teacherNameToSubjects.get(teacherName);
                if (!subjects || subjects.length === 0) return null;
                return subjects.some(s => TARGET_SUBJECTS.includes(s));
            };

            const holidaySet = await fetchHolidays();

            type EnrollmentInfo = {
                className: string; classId: string; staffId: string; teacher: string;
                subject: string; days: string[]; schedule: unknown[];
                startDate: string | null; endDate: string | null;
                withdrawalDate: string | null; onHold: boolean; cancelledAt: string | null;
            };
            const enrollmentCache = new Map<string, EnrollmentInfo[]>();

            const attendanceBatch = new Map<string, {
                studentId: string;
                studentName: string;
                className: string;
                attendance: Record<string, number>;
                homework: Record<string, boolean>;
                examScores: Record<string, number>;
                // Phase 1: 새 필드 (UI 미반영, 데이터만 저장)
                attitude: Record<string, string>;        // study_attitude raw
                classwork: Record<string, string>;       // homework_today raw (수업 과제)
                attendanceNotes: Record<string, string>; // notes raw (특이사항, 호버용)
                examInfoRaw: Record<string, string>;     // exam_info raw (분자/분모 보존)
                assignmentScoreRaw: Record<string, string>; // assignment_score raw (⭕△X 판정용)
                progressRaw: Record<string, string>;     // progress raw (Q2 진도 표시)
            }>();

            for (const report of reports) {
                const studentName = report.student_name?.trim().replace(/\s+/g, '') || '';
                const ijwStudent = nameToStudentMap.get(studentName);
                const dateKey = report.date;

                if (!ijwStudent) {
                    result.skipped++;
                    result.details.push({
                        studentName: report.student_name || '(이름 없음)',
                        className: report.class_name || '',
                        date: dateKey,
                        status: 'skipped_no_match',
                        message: 'IJW에서 매칭되는 학생을 찾을 수 없음',
                    });
                    continue;
                }

                const attendanceValue = mapReportToAttendanceValue(report.lateness);
                const finalValue = attendanceValue ?? 1;

                if (!enrollmentCache.has(ijwStudent.id)) {
                    const enr = await fetchStudentEnrollments(ijwStudent.id);
                    enrollmentCache.set(ijwStudent.id, enr);
                }
                const enrollments = enrollmentCache.get(ijwStudent.id)!;

                const reportDayName = getKoreanDayName(dateKey);
                const isHoliday = holidaySet.has(dateKey);

                // 휴일 체크 (수업 매칭 전에)
                if (isHoliday) {
                    result.skipped++;
                    result.details.push({
                        studentName: report.student_name || '',
                        className: report.class_name || '',
                        date: dateKey,
                        status: 'skipped_not_scheduled',
                        message: `휴일 (${dateKey})`,
                    });
                    continue;
                }

                // ── 보고서 날짜 기준 enrollment 활성 여부 판정 ──
                // 반이동/퇴원/종료된 enrollment 는 매칭 후보에서 제외 — 보고서 날짜에 실제 수강 중이던 반만 매칭.
                // (옛 enrollment 가 강사/요일이 같다는 이유로 잘못 매칭되거나 매칭 실패하는 버그 차단)
                const isEnrollmentActiveOn = (e: typeof enrollments[0]): boolean => {
                    // 미래 시작 — 보고서 날짜 < 시작일 → 비활성
                    if (e.startDate && e.startDate > dateKey) return false;
                    // 종료/퇴원일 이후 보고서 → 비활성
                    if (e.endDate && dateKey > e.endDate) return false;
                    if (e.withdrawalDate && dateKey > e.withdrawalDate) return false;
                    // 취소된 enrollment — 비활성
                    if (e.cancelledAt) return false;
                    return true;
                };

                // ── 학생 수업 요일 사전 필터 (보수적 적용) ──
                // 학생의 활성 target enrollment 가 1개 이상이고, "모든" enrollment 에 schedule 정보가
                // 있을 때만 사전 필터 작동. 일부라도 schedule 비어있는 enrollment 가 있으면
                // 그 enrollment 의 진짜 요일을 알 수 없으므로 사전 필터 적용 안 함 (fallback 으로 진행).
                //
                // 결함이 있던 이전 로직: schedule 있는 enrollment 만 합집합 → 정규반 enrollment 의
                // schedule 비어있고 특강 enrollment 만 schedule 있을 때 정규 요일 보고서가 잘못 스킵됨.
                // 예: 권영준 = 정규반(금, schedule 비어있음) + 토요특강 + 일요특강 → 합집합 [토,일] → 금요일 스킵 (오류)
                {
                    const targetEnrollmentsForDayCheck = enrollments.filter(e =>
                        TARGET_SUBJECTS.includes(e.subject) && isEnrollmentActiveOn(e)
                    );
                    const studentScheduledDays = new Set<string>();
                    let allEnrollmentsHaveSchedule = targetEnrollmentsForDayCheck.length > 0;
                    for (const e of targetEnrollmentsForDayCheck) {
                        const days = getScheduledDays(e);
                        if (days.size === 0) {
                            // schedule 정보 없는 enrollment 있음 → 사전 필터 적용 안 함 (안전 fallback)
                            allEnrollmentsHaveSchedule = false;
                            break;
                        }
                        days.forEach(d => studentScheduledDays.add(d));
                    }
                    if (allEnrollmentsHaveSchedule && !studentScheduledDays.has(reportDayName)) {
                        result.skipped++;
                        result.details.push({
                            studentName: report.student_name || '',
                            className: report.class_name || '',
                            date: dateKey,
                            status: 'skipped_not_scheduled',
                            message: `학생 수업 요일 불일치 (학생 수업요일: [${[...studentScheduledDays].join(',')}], 보고서 요일: ${reportDayName})`,
                        });
                        continue;
                    }
                }

                // ── 수업 매칭: 과목(TARGET_SUBJECTS) + 강사 + 요일 ──
                let className = '';
                const rawTeacherName = report.teacher_name?.trim().replace(/\s+/g, '') || '';
                // 수학 동기화일 때만 "중등M"/"초등M"/"고등M" 등 카테고리 prefix 제외 (영어는 항상 강사명)
                const edutrixTeacherName = (rawTeacherName && (subject === 'english' || !NON_TEACHER_PREFIXES.has(rawTeacherName)))
                    ? rawTeacherName
                    : '';
                const matchedStaffId = edutrixTeacherName
                    ? teacherNameToStaffId.get(edutrixTeacherName)
                    : undefined;

                // 강사 과목 정보로 동기화 대상 보고서 여부 판정
                const teacherIsTarget = edutrixTeacherName ? isTargetTeacherByName(edutrixTeacherName) : null;

                // 대상 enrollment (math/highmath 또는 english) — 보고서 날짜 기준 활성만
                const targetEnrollments = enrollments.filter(e =>
                    TARGET_SUBJECTS.includes(e.subject) && isEnrollmentActiveOn(e)
                );

                // ① 강사가 타과목으로 명확히 판정되면 → 동기화 대상 아님
                if (teacherIsTarget === false) {
                    result.otherSubject = (result.otherSubject || 0) + 1;
                    result.details.push({
                        studentName: report.student_name || '',
                        className: report.class_name || '',
                        date: dateKey,
                        status: 'skipped_other_subject',
                        message: `타과목 보고서 (강사 ${edutrixTeacherName} 과목: ${(teacherNameToSubjects.get(edutrixTeacherName) || []).join(',') || '미설정'})`,
                    });
                    continue;
                }

                // 강사 매칭: staffId 또는 teacher 필드
                const isTeacherMatch = (e: typeof enrollments[0]): boolean => {
                    if (!edutrixTeacherName) return false;
                    if (matchedStaffId && e.staffId === matchedStaffId) return true;
                    if (e.teacher) {
                        const normalized = e.teacher.trim().replace(/\s+/g, '');
                        if (normalized === edutrixTeacherName) return true;
                        if (matchedStaffId && normalized === matchedStaffId) return true;
                    }
                    return false;
                };

                // 요일 매칭 (schedule 비어있으면 모든 요일 OK)
                const enrollmentMatchesDay = (e: typeof enrollments[0]): boolean => {
                    const days = getScheduledDays(e);
                    return days.size === 0 || days.has(reportDayName);
                };

                const teacherTargetEnrollments = targetEnrollments.filter(isTeacherMatch);

                // 1차: 강사+요일 일치
                const bestMatch = teacherTargetEnrollments.find(enrollmentMatchesDay);
                if (bestMatch) className = bestMatch.className;

                // 2차: 강사만 일치 (수업 1개면 요일 무시)
                if (!className && teacherTargetEnrollments.length === 1) {
                    className = teacherTargetEnrollments[0].className;
                }

                // 3차: 강사 매칭 실패 → 같은 과목 enrollment 중 요일 일치 (보강 등)
                if (!className && targetEnrollments.length > 0) {
                    const subjectDayMatch = targetEnrollments.find(enrollmentMatchesDay);
                    if (subjectDayMatch) className = subjectDayMatch.className;
                }

                // 4차: 같은 과목 enrollment 1개면 무조건 매칭
                if (!className && targetEnrollments.length === 1) {
                    className = targetEnrollments[0].className;
                }

                // ② 그래도 못 찾으면 → 매칭 실패 OR 타과목
                if (!className) {
                    // 대상 과목 enrollment 0개 + 다른 과목 1개+ → 타과목으로 분류 (보고서 날짜 기준 활성만)
                    const otherEnrollments = enrollments.filter(e =>
                        e.subject && !TARGET_SUBJECTS.includes(e.subject) && isEnrollmentActiveOn(e)
                    );
                    if (targetEnrollments.length === 0 && otherEnrollments.length > 0) {
                        result.otherSubject = (result.otherSubject || 0) + 1;
                        const otherSubjList = [...new Set(otherEnrollments.map(e => e.subject))].join(',');
                        result.details.push({
                            studentName: report.student_name || '',
                            className: report.class_name || '',
                            date: dateKey,
                            status: 'skipped_other_subject',
                            message: `타과목 보고서 (학생 ${subject} enrollment 0개, ${otherSubjList} 만 있음)`,
                        });
                        continue;
                    }

                    const teacherEnrollSummary = teacherTargetEnrollments
                        .map(e => `${e.className}[${[...getScheduledDays(e)].join('') || '요일미지정'}]`)
                        .join(', ');
                    const otherTargetSummary = targetEnrollments
                        .filter(e => !teacherTargetEnrollments.includes(e))
                        .map(e => `${e.className}[${[...getScheduledDays(e)].join('') || '요일미지정'}/${e.teacher || e.staffId || '담당미상'}]`)
                        .join(', ');
                    let allSubjectsSummary = '';
                    if (targetEnrollments.length === 0 && enrollments.length > 0) {
                        const counts: Record<string, number> = {};
                        for (const e of enrollments) {
                            const key = e.subject || '(subject 없음)';
                            counts[key] = (counts[key] || 0) + 1;
                        }
                        allSubjectsSummary = Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(',');
                    }
                    const parts: string[] = [
                        `edutrix강사: ${rawTeacherName || '없음'}${edutrixTeacherName !== rawTeacherName ? '(prefix-무시)' : ''}`,
                        `요일: ${reportDayName}`,
                        `${TARGET_SUBJECTS.join('/')} enrollment ${targetEnrollments.length}개`,
                        `teacher매칭 ${teacherTargetEnrollments.length}개`,
                    ];
                    if (teacherEnrollSummary) parts.push(`강사매칭: ${teacherEnrollSummary}`);
                    if (otherTargetSummary) parts.push(`다른 ${subject}: ${otherTargetSummary}`);
                    if (allSubjectsSummary) parts.push(`전체 subject: ${allSubjectsSummary}`);
                    result.skipped++;
                    result.details.push({
                        studentName: report.student_name || '',
                        className: report.class_name || '',
                        date: dateKey,
                        status: 'skipped_no_match',
                        message: `매칭 실패 (${parts.join(' | ')})`,
                    });
                    continue;
                }

                // 매칭 성공 — 요일 비매칭(보강)도 허용 (위 3차/4차 fallback 의도)

                const docId = `${ijwStudent.id}_${yearMonth}`;
                const compositeKey = `${className}::${dateKey}`;

                if (!attendanceBatch.has(docId)) {
                    attendanceBatch.set(docId, {
                        studentId: ijwStudent.id,
                        studentName: ijwStudent.name,
                        className,
                        attendance: {},
                        homework: {},
                        examScores: {},
                        attitude: {},
                        classwork: {},
                        attendanceNotes: {},
                        examInfoRaw: {},
                        assignmentScoreRaw: {},
                        progressRaw: {},
                    });
                }
                const batch = attendanceBatch.get(docId)!;
                batch.attendance[compositeKey] = finalValue;

                const homeworkDone = isHomeworkSubmitted(report.assignment_score);
                batch.homework[compositeKey] = homeworkDone;

                const examScore = parseExamScoreTo10(report.exam_info);
                if (examScore !== null) {
                    batch.examScores[compositeKey] = examScore;
                }

                // Phase 1: Edutrix raw 데이터 저장 (UI는 Phase 2에서 처리)
                if (report.study_attitude) batch.attitude[compositeKey] = report.study_attitude;
                if (report.homework_today) batch.classwork[compositeKey] = report.homework_today;
                if (report.notes) batch.attendanceNotes[compositeKey] = report.notes;
                if (report.exam_info) batch.examInfoRaw[compositeKey] = report.exam_info;
                if (report.assignment_score !== null && report.assignment_score !== undefined) {
                    batch.assignmentScoreRaw[compositeKey] = String(report.assignment_score);
                }
                if (report.progress) batch.progressRaw[compositeKey] = String(report.progress);

                result.matched++;
                const statusParts: string[] = [finalValue === 1 ? '출석' : finalValue === 2 ? '지각' : '결석'];
                statusParts.push(homeworkDone ? '과제O' : '과제X');
                if (examScore !== null) statusParts.push(`시험${examScore}`);
                result.details.push({
                    studentName: report.student_name || '',
                    className,
                    date: dateKey,
                    status: 'synced',
                    attendanceValue: finalValue,
                    message: statusParts.join(', '),
                });
            }

            if (dryRun) {
                console.log(`[EdutrixSync/${subject}] Step 6: DRY-RUN — Firestore 쓰기 생략 (${attendanceBatch.size}건 매칭됨)`);
                console.log(`[EdutrixSync/${subject}] ===== DRY-RUN 완료: 총 ${result.totalReports} | 매칭 ${result.matched} | 스킵 ${result.skipped} | 타과목 ${result.otherSubject} | 오류 ${result.errors} =====`);
                setLastResult(result);
                return result;
            }

            console.log(`[EdutrixSync] Step 6: 배치 저장 (${attendanceBatch.size}건)`);
            const savePromises = Array.from(attendanceBatch.entries()).map(
                async ([docId, data]) => {
                    try {
                        const docRef = doc(db, 'attendance_records', docId);
                        const payload: Record<string, any> = {
                            attendance: data.attendance,
                            studentId: data.studentId,
                            studentName: data.studentName,
                            className: data.className,
                            yearMonth,
                            updatedAt: new Date().toISOString(),
                            ...(staffId ? { staffId } : {}),
                        };
                        if (Object.keys(data.homework).length > 0) {
                            payload.homework = data.homework;
                        }
                        if (Object.keys(data.examScores).length > 0) {
                            payload.examScores = data.examScores;
                        }
                        // Phase 1: 새 필드 (값 있는 것만 저장)
                        if (Object.keys(data.attitude).length > 0) {
                            payload.attitude = data.attitude;
                        }
                        if (Object.keys(data.classwork).length > 0) {
                            payload.classwork = data.classwork;
                        }
                        if (Object.keys(data.attendanceNotes).length > 0) {
                            payload.attendanceNotes = data.attendanceNotes;
                        }
                        if (Object.keys(data.examInfoRaw).length > 0) {
                            payload.examInfoRaw = data.examInfoRaw;
                        }
                        if (Object.keys(data.assignmentScoreRaw).length > 0) {
                            payload.assignmentScoreRaw = data.assignmentScoreRaw;
                        }
                        if (Object.keys(data.progressRaw).length > 0) {
                            payload.progressRaw = data.progressRaw;
                        }
                        await setDoc(docRef, payload, { merge: true });
                    } catch (err) {
                        result.errors++;
                        console.error(`[EdutrixSync] ❌ ${data.studentName} 저장 실패:`, err);
                    }
                }
            );
            await Promise.all(savePromises);

            await queryClient.invalidateQueries({ queryKey: ['attendanceRecords'] });
            await queryClient.invalidateQueries({ queryKey: ['attendanceStudents'] });

            console.log(`[EdutrixSync] ===== 동기화 완료: 총 ${result.totalReports} | 매칭 ${result.matched} | 스킵 ${result.skipped} | 오류 ${result.errors} =====`);

            // [임시 진단] 5/15 보고서 처리 결과 추적 — 사용자 점검 후 제거 예정
            const DEBUG_DATE_OUT = '2026-05-15';
            const debugDetails = result.details.filter(d => d.date === DEBUG_DATE_OUT);
            const statusCounts: Record<string, number> = {};
            debugDetails.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1; });
            // eslint-disable-next-line no-console
            console.log(`[Edutrix${DEBUG_DATE_OUT}처리결과]`, {
                전체_처리수: debugDetails.length,
                상태별_카운트: statusCounts,
                상세_전체: debugDetails,
            });

            setLastResult(result);
            return result;
        } catch (err: any) {
            const errorMessage = err?.message || '알 수 없는 오류';
            console.error(`[EdutrixSync] ❌ 치명적 오류:`, err);
            setError(errorMessage);
            throw err;
        } finally {
            setIsSyncing(false);
        }
    }, [fetchIjwStudents, fetchIjwStaff, fetchStudentEnrollments, fetchHolidays, queryClient]);

    const resetSync = useCallback(async (yearMonth: string): Promise<number> => {
        setIsResetting(true);
        let resetCount = 0;

        try {
            console.log(`[EdutrixSync] ===== 월 전체 초기화 시작: ${yearMonth} (메모 보존) =====`);

            const recordsSnap = await getDocs(
                query(collection(db, 'attendance_records'), where('yearMonth', '==', yearMonth))
            );

            if (recordsSnap.size === 0) {
                setIsResetting(false);
                return 0;
            }

            const resetPromises = recordsSnap.docs.map(async (docSnap) => {
                try {
                    const data = docSnap.data();
                    const attendanceKeys = data.attendance ? Object.keys(data.attendance).length : 0;
                    await setDoc(docSnap.ref, {
                        attendance: deleteField(),
                        homework: deleteField(),
                        examScores: deleteField(),
                    }, { merge: true });
                    resetCount += attendanceKeys || 1;
                } catch (err) {
                    console.error(`[EdutrixSync] ❌ 초기화 실패: ${docSnap.id}`, err);
                }
            });
            await Promise.all(resetPromises);

            await queryClient.invalidateQueries({ queryKey: ['attendanceRecords'] });
            await queryClient.invalidateQueries({ queryKey: ['attendanceStudents'] });

            setLastResult(null);
            return resetCount;
        } catch (err: any) {
            console.error('[EdutrixSync] 초기화 오류:', err);
            throw err;
        } finally {
            setIsResetting(false);
        }
    }, [queryClient]);

    return {
        syncFromEdutrix,
        resetSync,
        isSyncing,
        isResetting,
        lastResult,
        error,
    };
}
