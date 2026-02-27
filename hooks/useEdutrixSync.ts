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

/** enrollment에서 수업 요일 추출 */
function getScheduledDays(enrollment: { days?: string[]; schedule?: string[] }): Set<string> {
    const days = new Set<string>();
    if (enrollment.schedule && Array.isArray(enrollment.schedule)) {
        for (const slot of enrollment.schedule) {
            const day = slot.split(' ')[0];
            if (day) days.add(day);
        }
    }
    if (enrollment.days && Array.isArray(enrollment.days)) {
        for (const d of enrollment.days) days.add(d);
    }
    return days;
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
}

export interface SyncDetail {
    studentName: string;
    className: string;
    date: string;
    status: 'synced' | 'skipped_absent' | 'skipped_no_match' | 'skipped_not_scheduled' | 'already_marked' | 'error';
    attendanceValue?: number;
    message?: string;
}

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
        const studentsSnap = await getDocs(
            query(collection(db, 'students'), where('status', '==', 'active'))
        );
        return studentsSnap.docs.map(d => ({
            id: d.id,
            name: (d.data().name || '') as string,
        }));
    }, []);

    const fetchIjwStaff = useCallback(async () => {
        const staffSnap = await getDocs(
            query(collection(db, 'staff'), where('status', '==', 'active'))
        );
        return staffSnap.docs.map(d => ({
            id: d.id,
            name: (d.data().name || '') as string,
        }));
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
                days: (data.days || []) as string[],
                schedule: (data.schedule || []) as string[],
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
    ): Promise<SyncResult> => {
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
        };

        try {
            console.log(`[EdutrixSync] ===== 동기화 시작: ${yearMonth} =====`);

            const reports = await fetchReportsByMonth(yearMonth);
            result.totalReports = reports.length;
            console.log(`[EdutrixSync] Step 1: Edutrix 보고서 ${reports.length}건 조회됨`);

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
            for (const staff of ijwStaff) {
                const normalizedName = staff.name.trim().replace(/\s+/g, '');
                teacherNameToStaffId.set(normalizedName, staff.id);
            }

            const holidaySet = await fetchHolidays();

            const enrollmentCache = new Map<string, { className: string; classId: string; staffId: string; teacher: string; days: string[]; schedule: string[] }[]>();

            const attendanceBatch = new Map<string, {
                studentId: string;
                studentName: string;
                className: string;
                attendance: Record<string, number>;
                homework: Record<string, boolean>;
                examScores: Record<string, number>;
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

                let className = '';
                const edutrixTeacherName = report.teacher_name;
                const matchedStaffId = edutrixTeacherName
                    ? teacherNameToStaffId.get(edutrixTeacherName)
                    : undefined;

                if (matchedStaffId) {
                    const teacherEnrollment = enrollments.find(e => e.staffId === matchedStaffId);
                    if (teacherEnrollment) {
                        className = teacherEnrollment.className;
                    }
                }

                if (!className && report.class_name) {
                    const matchedEnrollment = enrollments.find(e =>
                        e.className === report.class_name ||
                        e.className.includes(report.class_name!) ||
                        report.class_name!.includes(e.className)
                    );
                    className = matchedEnrollment?.className || enrollments[0]?.className || report.class_name;
                }

                if (!className) {
                    className = enrollments[0]?.className || '';
                }

                if (!className) {
                    result.skipped++;
                    result.details.push({
                        studentName: report.student_name || '',
                        className: report.class_name || '',
                        date: dateKey,
                        status: 'skipped_no_match',
                        message: 'IJW에서 수업을 찾을 수 없음',
                    });
                    continue;
                }

                const dayFilterEnrollment = enrollments.find(e => e.className === className);
                if (dayFilterEnrollment) {
                    const scheduledDays = getScheduledDays(dayFilterEnrollment);
                    if (scheduledDays.size > 0) {
                        const reportDayName = getKoreanDayName(dateKey);
                        const isHoliday = holidaySet.has(dateKey);

                        if (isHoliday) {
                            result.skipped++;
                            result.details.push({
                                studentName: report.student_name || '',
                                className,
                                date: dateKey,
                                status: 'skipped_not_scheduled',
                                message: `휴일 (${dateKey})`,
                            });
                            continue;
                        }

                        if (!scheduledDays.has(reportDayName)) {
                            result.skipped++;
                            result.details.push({
                                studentName: report.student_name || '',
                                className,
                                date: dateKey,
                                status: 'skipped_not_scheduled',
                                message: `수업 요일 아님 (${reportDayName}요일, 수업: ${[...scheduledDays].join(',')})`,
                            });
                            continue;
                        }
                    }
                }

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
