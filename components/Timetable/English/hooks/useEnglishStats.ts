/**
 * useEnglishStats - Student statistics for English timetable
 *
 * PURPOSE: Derive student statistics from studentMap (which already contains enrollments)
 * instead of making a separate Firestore collectionGroup query.
 *
 * DATA FLOW:
 * 1. studentMap already contains student.enrollments[] from useStudents(true)
 * 2. Filter enrollments by subject='english' and calculate stats
 *
 * OPTIMIZATION (2026-02-04):
 * - useQuery + collectionGroup → useMemo 파생으로 변경
 * - 중복 Firestore 쿼리 완전 제거 (useStudents가 이미 모든 enrollment 포함)
 */

import { useMemo } from 'react';
import { convertTimestampToDate } from '../../../../utils/firestoreConverters';
import { formatDateKey } from '../../../../utils/dateUtils';

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: { className: string; room?: string, teacher?: string, underline?: boolean }[];
    underline?: boolean;
}

type ScheduleData = Record<string, ScheduleCell>;

interface StudentInfo {
    id: string;
    name: string;
    school?: string;
    grade?: string;
    enrollmentDate?: string;
    withdrawalDate?: string;
}

interface StudentStats {
    active: number;
    new1: number;
    new2: number;
    withdrawn: number;
    withdrawnFuture: number;  // 퇴원 예정
    waiting: number;  // 대기생 (onHold)
    // 툴팁용 상세 정보
    waitingStudents: StudentInfo[];
    withdrawnStudents: StudentInfo[];
    withdrawnFutureStudents: StudentInfo[];
}

export const useEnglishStats = (
    scheduleData: ScheduleData,
    isSimulationMode: boolean,
    studentMap: Record<string, any> = {},
    referenceDate?: string  // 주차 기준일 (YYYY-MM-DD), 없으면 오늘
) => {
    const studentStats = useMemo<StudentStats>(() => {
        // Get unique class names from scheduleData
        const classNames = new Set<string>();
        Object.values(scheduleData).forEach(cell => {
            if (cell.className) classNames.add(cell.className);
            if (cell.merged) {
                cell.merged.forEach(m => {
                    if (m.className) classNames.add(m.className);
                });
            }
        });

        if (classNames.size === 0 || Object.keys(studentMap).length === 0) {
            return { active: 0, new1: 0, new2: 0, withdrawn: 0, withdrawnFuture: 0, waiting: 0, waitingStudents: [], withdrawnStudents: [], withdrawnFutureStudents: [] };
        }

        const refDate = referenceDate || formatDateKey(new Date());
        const now = new Date(refDate);
        const today = refDate;
        let active = 0, new1 = 0, new2 = 0, withdrawn = 0, withdrawnFuture = 0, waiting = 0;
        const waitingStudents: StudentInfo[] = [];
        const withdrawnStudents: StudentInfo[] = [];
        const withdrawnFutureStudents: StudentInfo[] = [];

        // Track unique students to avoid double-counting (a student can have multiple enrollments)
        const countedStudents = new Set<string>();

        // 학생별로 영어 enrollment 중 가장 우선되는 상태를 결정
        Object.entries(studentMap).forEach(([studentId, student]) => {
            if (!student.enrollments) return;
            const baseStudent = studentMap[studentId];
            if (!baseStudent) return;

            // 이 학생의 영어 enrollment 중 활성인 것이 있는지 먼저 확인
            const englishEnrollments = (student.enrollments as any[]).filter((e: any) =>
                e.subject === 'english' && e.className && classNames.has(e.className)
            );
            if (englishEnrollments.length === 0) return;
            if (countedStudents.has(studentId)) return;
            countedStudents.add(studentId);

            // 활성 enrollment 찾기 (endDate/withdrawalDate 없고, 미래 시작이 아닌 것)
            const activeEnrollment = englishEnrollments.find((e: any) => {
                const wd = convertTimestampToDate(e.withdrawalDate);
                const ed = convertTimestampToDate(e.endDate);
                if (wd || ed) return false;
                const start = convertTimestampToDate(e.enrollmentDate) || convertTimestampToDate(e.startDate);
                if (start && start > today) return false;
                if (e.onHold) return false;
                return true;
            });

            if (activeEnrollment) {
                if (baseStudent.status !== 'active') return;
                active++;
                const enrollStartDate = convertTimestampToDate(activeEnrollment.enrollmentDate) ||
                    convertTimestampToDate(activeEnrollment.startDate);
                if (enrollStartDate) {
                    const daysSinceEnroll = Math.floor((now.getTime() - new Date(enrollStartDate).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSinceEnroll >= 0 && daysSinceEnroll <= 30) new1++;
                    else if (daysSinceEnroll > 30 && daysSinceEnroll <= 60) new2++;
                }
                return;
            }

            // 대기(onHold) enrollment
            const holdEnrollment = englishEnrollments.find((e: any) => {
                const wd = convertTimestampToDate(e.withdrawalDate);
                const ed = convertTimestampToDate(e.endDate);
                return !wd && !ed && e.onHold;
            });
            if (holdEnrollment) {
                waiting++;
                waitingStudents.push({
                    id: studentId, name: baseStudent.name, school: baseStudent.school, grade: baseStudent.grade,
                    enrollmentDate: convertTimestampToDate(holdEnrollment.enrollmentDate) || baseStudent.startDate
                });
                return;
            }

            // 배정 예정 (미래 시작일, 30일 이내)
            const scheduledEnrollment = englishEnrollments.find((e: any) => {
                const wd = convertTimestampToDate(e.withdrawalDate);
                const ed = convertTimestampToDate(e.endDate);
                if (wd || ed) return false;
                const start = convertTimestampToDate(e.enrollmentDate) || convertTimestampToDate(e.startDate);
                return start && start > today;
            });
            if (scheduledEnrollment) {
                const start = convertTimestampToDate(scheduledEnrollment.enrollmentDate) || convertTimestampToDate(scheduledEnrollment.startDate);
                const daysUntil = Math.floor((new Date(start!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntil <= 30) {
                    waiting++;
                    waitingStudents.push({
                        id: studentId, name: baseStudent.name, school: baseStudent.school, grade: baseStudent.grade,
                        enrollmentDate: start
                    });
                }
                return;
            }

            // 퇴원 — 가장 최근 종료된 enrollment 기준
            const endedEnrollments = englishEnrollments
                .map((e: any) => convertTimestampToDate(e.withdrawalDate) || convertTimestampToDate(e.endDate))
                .filter(Boolean) as string[];
            if (endedEnrollments.length > 0) {
                const latestEnd = endedEnrollments.sort().reverse()[0];
                const studentInfo: StudentInfo = {
                    id: studentId, name: baseStudent.name, school: baseStudent.school, grade: baseStudent.grade,
                    withdrawalDate: latestEnd
                };
                if (latestEnd > today) {
                    withdrawnFuture++;
                    withdrawnFutureStudents.push(studentInfo);
                } else {
                    const daysSince = Math.floor((now.getTime() - new Date(latestEnd).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSince <= 30) {
                        withdrawn++;
                        withdrawnStudents.push(studentInfo);
                    }
                }
            }
        });

        return {
            active,
            new1,
            new2,
            withdrawn,
            withdrawnFuture,
            waiting,
            waitingStudents,
            withdrawnStudents,
            withdrawnFutureStudents
        };
    }, [scheduleData, studentMap, referenceDate]);

    return studentStats;
};
