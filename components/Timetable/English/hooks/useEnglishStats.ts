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

// Helper to convert Firestore Timestamp to YYYY-MM-DD string
const convertTimestampToDate = (timestamp: any): string | undefined => {
    if (!timestamp) return undefined;
    if (typeof timestamp === 'string') return timestamp;
    if (timestamp?.toDate) {
        const date = timestamp.toDate();
        return date.toISOString().split('T')[0];
    }
    return undefined;
};

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
    studentMap: Record<string, any> = {}
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

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        let active = 0, new1 = 0, new2 = 0, withdrawn = 0, withdrawnFuture = 0, waiting = 0;
        const waitingStudents: StudentInfo[] = [];
        const withdrawnStudents: StudentInfo[] = [];
        const withdrawnFutureStudents: StudentInfo[] = [];

        // Track unique students to avoid double-counting (a student can have multiple enrollments)
        const countedStudents = new Set<string>();

        Object.entries(studentMap).forEach(([studentId, student]) => {
            if (!student.enrollments) return;

            student.enrollments.forEach((enrollment: any) => {
                if (enrollment.subject !== 'english') return;

                const className = enrollment.className as string;

                // Only process if this class is in our scheduleData
                if (!className || !classNames.has(className)) return;

                // Skip if already counted this student
                if (countedStudents.has(studentId)) return;

                // Get student base info
                const baseStudent = studentMap[studentId];

                // If student not in studentMap, skip
                if (!baseStudent) return;

                // Skip if already counted this student (moved after baseStudent check)
                countedStudents.add(studentId);

                // Withdrawn check (from enrollment data)
                const enrollmentWithdrawalDate = convertTimestampToDate(enrollment.withdrawalDate);
                if (enrollmentWithdrawalDate) {
                    const studentInfo: StudentInfo = {
                        id: studentId,
                        name: baseStudent.name,
                        school: baseStudent.school,
                        grade: baseStudent.grade,
                        withdrawalDate: enrollmentWithdrawalDate
                    };

                    if (enrollmentWithdrawalDate > today) {
                        // 퇴원 예정 (미래)
                        withdrawnFuture++;
                        withdrawnFutureStudents.push(studentInfo);
                    } else {
                        // 이미 퇴원 (과거/오늘)
                        const withdrawnDate = new Date(enrollmentWithdrawalDate);
                        const daysSinceWithdrawal = Math.floor((now.getTime() - withdrawnDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysSinceWithdrawal <= 30) {
                            withdrawn++;
                            withdrawnStudents.push(studentInfo);
                        }
                    }
                    return;
                }

                // On hold check (대기생)
                if (enrollment.onHold) {
                    waiting++;
                    waitingStudents.push({
                        id: studentId,
                        name: baseStudent.name,
                        school: baseStudent.school,
                        grade: baseStudent.grade,
                        enrollmentDate: convertTimestampToDate(enrollment.enrollmentDate) || baseStudent.startDate
                    });
                    return;
                }

                // Check student status from studentMap (must be 'active')
                if (baseStudent.status !== 'active') return;

                active++;

                // New student check - 우선순위: 영어 과목 수강 시작일 > 학생 전체 등록일
                // (학생이 등록 후 나중에 영어 과목을 추가할 수 있으므로 영어 과목 기준)
                const enrollmentDate = convertTimestampToDate(enrollment.enrollmentDate) ||
                    baseStudent.startDate ||
                    convertTimestampToDate(enrollment.startDate);
                if (enrollmentDate) {
                    const enrollDate = new Date(enrollmentDate);
                    const daysSinceEnroll = Math.floor((now.getTime() - enrollDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSinceEnroll <= 30) {
                        new1++;
                    } else if (daysSinceEnroll <= 60) {
                        new2++;
                    }
                }
            });
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
    }, [scheduleData, studentMap]);

    return studentStats;
};
