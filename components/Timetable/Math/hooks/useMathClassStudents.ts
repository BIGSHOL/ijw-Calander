/**
 * useMathClassStudents - Centralized hook for fetching math class student data
 *
 * PURPOSE: Derive student data from studentMap (which already contains enrollments)
 * instead of making a separate Firestore collectionGroup query.
 *
 * DATA FLOW:
 * 1. studentMap already contains student.enrollments[] from useStudents(true)
 * 2. Filter enrollments by subject='math' and group by className
 * 3. Apply transfer detection, scheduled flags, status filtering
 *
 * OPTIMIZATION (2026-02-04):
 * - useQuery + collectionGroup → useMemo 파생으로 변경
 * - 중복 Firestore 쿼리 완전 제거 (useStudents가 이미 모든 enrollment 포함)
 * - Waterfall 제거: studentMap 변경 시 즉시 파생 (0ms)
 *
 * USAGE:
 * const { classDataMap, isLoading, refetch } = useMathClassStudents(classNames, studentMap);
 * // classDataMap[className] = { studentList: [...], studentIds: [...] }
 */

import { useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TimetableStudent } from '../../../../types';

// Helper to convert Firestore Timestamp to YYYY-MM-DD string (hoisted to module level)
const convertTimestampToDate = (timestamp: any): string | undefined => {
    if (!timestamp) return undefined;
    if (typeof timestamp === 'string') return timestamp;
    if (timestamp?.toDate) {
        const date = timestamp.toDate();
        return date.toISOString().split('T')[0];
    }
    return undefined;
};

export interface ClassStudentData {
    studentList: TimetableStudent[];
    studentIds: string[];
}

export const useMathClassStudents = (
    classNames: string[],
    studentMap: Record<string, any> = {}
) => {
    const queryClient = useQueryClient();

    const classDataMap = useMemo<Record<string, ClassStudentData>>(() => {
        if (classNames.length === 0 || Object.keys(studentMap).length === 0) {
            return {};
        }

        const today = new Date().toISOString().split('T')[0];

        // 반이동 감지: 학생별로 활성/종료 등록 수업 목록 수집 (math only)
        const studentActiveClasses: Record<string, Set<string>> = {};
        const studentEndedClasses: Record<string, Set<string>> = {};

        // 1차: 모든 학생의 math enrollment 순회하여 활성/종료 등록 수집
        Object.entries(studentMap).forEach(([studentId, student]) => {
            if (!student.enrollments) return;

            student.enrollments.forEach((enrollment: any) => {
                if (enrollment.subject !== 'math') return;

                const className = enrollment.className as string;
                if (!className) return;

                const withdrawalDate = convertTimestampToDate(enrollment.withdrawalDate);
                const endDate = convertTimestampToDate(enrollment.endDate);
                const hasEndDate = !!(withdrawalDate || endDate);

                if (!hasEndDate) {
                    if (!studentActiveClasses[studentId]) {
                        studentActiveClasses[studentId] = new Set();
                    }
                    studentActiveClasses[studentId].add(className);
                } else {
                    if (!studentEndedClasses[studentId]) {
                        studentEndedClasses[studentId] = new Set();
                    }
                    studentEndedClasses[studentId].add(className);
                }
            });
        });

        // 2차: 요청된 수업들의 학생 데이터 구축
        const result: Record<string, ClassStudentData> = {};

        // Initialize classStudentMap and enrollmentDataMap for requested classes
        const classStudentMap: Record<string, Set<string>> = {};
        const enrollmentDataMap: Record<string, Record<string, any>> = {};

        classNames.forEach(name => {
            classStudentMap[name] = new Set();
            enrollmentDataMap[name] = {};
        });

        // Iterate all students and collect enrollment data for requested classes
        Object.entries(studentMap).forEach(([studentId, student]) => {
            if (!student.enrollments) return;

            student.enrollments.forEach((enrollment: any) => {
                if (enrollment.subject !== 'math') return;

                const className = enrollment.className as string;
                if (!className || !classNames.includes(className)) return;

                const startDate = convertTimestampToDate(enrollment.enrollmentDate || enrollment.startDate);
                const withdrawalDate = convertTimestampToDate(enrollment.withdrawalDate);
                const endDate = convertTimestampToDate(enrollment.endDate);

                // 미래 시작일 학생도 포함 (대기 섹션에 '배정 예정'으로 표시)
                const isScheduled = startDate && startDate > today;

                // 반이동 여부 체크
                const hasEndDate = !!(withdrawalDate || endDate);
                const activeClasses = studentActiveClasses[studentId] || new Set();
                const endedClasses = studentEndedClasses[studentId] || new Set();

                // isTransferred: 이 수업에서 종료됐지만 다른 수업에 활성 등록이 있음 (퇴원 섹션에서 제외)
                const hasActiveInOtherClass = hasEndDate &&
                    Array.from(activeClasses).some(c => c !== className);

                // isTransferredIn: 이 수업에 활성 등록이 있고, 다른 수업에서 종료된 기록이 있음 (반이동으로 온 학생)
                const hasEndedInOtherClass = !hasEndDate &&
                    Array.from(endedClasses).some(c => c !== className);

                // 모든 학생 포함 (퇴원/휴원도 카드에서 별도 섹션으로 표시)
                classStudentMap[className].add(studentId);

                enrollmentDataMap[className][studentId] = {
                    enrollmentDocId: enrollment.id,  // Firestore 실제 문서 ID
                    enrollmentDate: startDate,
                    withdrawalDate: withdrawalDate || endDate,  // endDate도 퇴원으로 처리
                    onHold: enrollment.onHold,
                    attendanceDays: enrollment.attendanceDays || [],
                    isScheduled,  // 배정 예정 플래그
                    isTransferred: hasActiveInOtherClass,  // 반이동 나감 (퇴원 섹션에서 제외)
                    isTransferredIn: hasEndedInOtherClass,  // 반이동 들어옴 (초록색 배경으로 상단 표시)
                    isSlotTeacher: enrollment.isSlotTeacher || false,  // 부담임 여부
                };
            });
        });

        // Convert to ClassStudentData format
        classNames.forEach(className => {
            const studentIds = Array.from(classStudentMap[className] || []);
            const studentList: TimetableStudent[] = studentIds
                .map(id => {
                    const baseStudent = studentMap[id];
                    const enrollmentData = enrollmentDataMap[className]?.[id] || {};

                    if (!baseStudent) {
                        return null;
                    }

                    // withdrawn/on_hold 상태도 시간표에 포함 (퇴원/대기 섹션 표시)
                    // prospect/prospective 등 예비 학생만 제외
                    if (!['active', 'withdrawn', 'on_hold'].includes(baseStudent.status)) return null;

                    // Priority for enrollment date (학생 관리 수업 탭 기준):
                    // 1. enrollmentData.enrollmentDate (학생 관리 수업 탭의 '시작일' from enrollments subcollection)
                    // 2. baseStudent.startDate (학생 기본정보의 등록일 - fallback)
                    const classEnrollmentDate = enrollmentData.enrollmentDate || baseStudent.startDate;

                    return {
                        id,
                        name: baseStudent.name || '',
                        englishName: baseStudent.englishName || '',
                        school: baseStudent.school || '',
                        grade: baseStudent.grade || '',
                        enrollmentDate: classEnrollmentDate,
                        withdrawalDate: enrollmentData.withdrawalDate,
                        onHold: enrollmentData.onHold,
                        isMoved: false,
                        attendanceDays: enrollmentData.attendanceDays || [],
                        isScheduled: enrollmentData.isScheduled || false,
                        isTransferred: enrollmentData.isTransferred || false,
                        isTransferredIn: enrollmentData.isTransferredIn || false,
                        enrollmentDocId: enrollmentData.enrollmentDocId,
                        isSlotTeacher: enrollmentData.isSlotTeacher || false,
                    } as TimetableStudent;
                })
                .filter(Boolean) as TimetableStudent[];

            // Sort by name
            studentList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

            result[className] = {
                studentList,
                studentIds,
            };
        });

        return result;
    }, [classNames, studentMap]);

    // isLoading: studentMap이 아직 비어있으면 로딩 중
    const isLoading = classNames.length > 0 && Object.keys(studentMap).length === 0;

    // refetch: students 데이터를 다시 가져오면 studentMap 업데이트 → useMemo 재파생
    const refetch = useCallback(async () => {
        await queryClient.refetchQueries({ queryKey: ['students', true] });
    }, [queryClient]);

    return { classDataMap, isLoading, refetch };
};
