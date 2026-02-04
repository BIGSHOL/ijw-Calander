/**
 * useClassStudents - Centralized hook for fetching class student data
 *
 * PURPOSE: Derive student data from studentMap (which already contains enrollments)
 * instead of making a separate Firestore collectionGroup query.
 *
 * DATA FLOW:
 * 1. studentMap already contains student.enrollments[] from useStudents(true)
 * 2. Filter enrollments by subject='english' and group by className
 * 3. Apply transfer detection, scheduled flags, status filtering
 *
 * SIMULATION MODE (2026-01-17):
 * - isSimulationMode=true일 때 SimulationContext의 draft 데이터 사용
 * - 메모리 기반 상태로 Firebase 조회 없이 즉시 반환
 *
 * OPTIMIZATION (2026-02-04):
 * - useQuery + collectionGroup → useMemo 파생으로 변경
 * - 중복 Firestore 쿼리 완전 제거 (useStudents가 이미 모든 enrollment 포함)
 * - Waterfall 제거: studentMap 변경 시 즉시 파생 (0ms)
 *
 * USAGE:
 * const { classDataMap, isLoading, refetch } = useClassStudents(classNames, isSimulationMode, studentMap);
 * // classDataMap[className] = { studentList: [...], studentIds: [...] }
 */

import { useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TimetableStudent } from '../../../../types';
import { useSimulationOptional } from '../context/SimulationContext';

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

export const useClassStudents = (
    classNames: string[],
    isSimulationMode: boolean = false,
    studentMap: Record<string, any> = {}
) => {
    const queryClient = useQueryClient();

    // SimulationContext - optional (may not be wrapped in provider)
    const simulation = useSimulationOptional();

    // 시나리오 모드: Context에서 시나리오 데이터 사용
    const simulationData = useMemo(() => {
        if (!isSimulationMode || !simulation?.isScenarioMode) {
            return null;
        }
        return simulation.getClassStudents(classNames, studentMap);
    }, [isSimulationMode, simulation?.isScenarioMode, simulation?.scenarioEnrollments, classNames, studentMap]);

    // 비시뮬레이션 모드: studentMap에서 useMemo로 파생
    const classDataMap = useMemo<Record<string, ClassStudentData>>(() => {
        // 시뮬레이션 모드에서는 빈 객체 반환 (simulationData 사용)
        if (isSimulationMode) return {};

        if (classNames.length === 0 || Object.keys(studentMap).length === 0) {
            return {};
        }

        const today = new Date().toISOString().split('T')[0];

        // 반이동 감지: 학생별로 활성/종료 등록 수업 목록 수집 (english only)
        const studentActiveClasses: Record<string, Set<string>> = {};
        const studentEndedClasses: Record<string, Set<string>> = {};

        // 1차: 모든 학생의 english enrollment 순회하여 활성/종료 등록 수집
        Object.entries(studentMap).forEach(([studentId, student]) => {
            if (!student.enrollments) return;

            student.enrollments.forEach((enrollment: any) => {
                if (enrollment.subject !== 'english') return;

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
                if (enrollment.subject !== 'english') return;

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
                    underline: enrollment.underline,
                    enrollmentDate: startDate,
                    withdrawalDate: withdrawalDate || endDate,  // endDate도 퇴원으로 처리
                    onHold: enrollment.onHold,
                    attendanceDays: enrollment.attendanceDays || [],
                    isScheduled,  // 배정 예정 플래그
                    isTransferred: hasActiveInOtherClass,  // 반이동 나감 (퇴원 섹션에서 제외)
                    isTransferredIn: hasEndedInOtherClass,  // 반이동 들어옴 (초록색 배경으로 상단 표시)
                };
            });
        });

        // Convert to ClassStudentData format
        const result: Record<string, ClassStudentData> = {};

        classNames.forEach(className => {
            const studentIds = Array.from(classStudentMap[className] || []);
            const studentList: TimetableStudent[] = studentIds
                .map(id => {
                    const baseStudent = studentMap[id];
                    const enrollmentData = enrollmentDataMap[className]?.[id] || {};

                    if (!baseStudent) {
                        return null;
                    }

                    // Skip if student is not active
                    if (baseStudent.status !== 'active') return null;

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
                        // Merge enrollment-specific data
                        underline: enrollmentData.underline ?? baseStudent.underline ?? false,
                        enrollmentDate: classEnrollmentDate,
                        withdrawalDate: enrollmentData.withdrawalDate,
                        onHold: enrollmentData.onHold,
                        isMoved: false,
                        attendanceDays: enrollmentData.attendanceDays || [],
                        isScheduled: enrollmentData.isScheduled || false,
                        isTransferred: enrollmentData.isTransferred || false,
                        isTransferredIn: enrollmentData.isTransferredIn || false,
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
    }, [classNames, studentMap, isSimulationMode]);

    // isLoading: studentMap이 아직 비어있으면 로딩 중
    const isLoading = !isSimulationMode && classNames.length > 0 && Object.keys(studentMap).length === 0;

    // refetch: students 데이터를 다시 가져오면 studentMap 업데이트 → useMemo 재파생
    const refetch = useCallback(async () => {
        await queryClient.refetchQueries({ queryKey: ['students', true] });
    }, [queryClient]);

    // 시뮬레이션 모드면 simulationData 반환, 아니면 useMemo 결과 반환
    if (isSimulationMode && simulationData) {
        return {
            classDataMap: simulationData,
            isLoading: false,
            refetch: async () => {
                // 시뮬레이션 모드에서는 loadFromLive로 새로고침
                await simulation?.loadFromLive();
            },
        };
    }

    return { classDataMap, isLoading, refetch };
};
