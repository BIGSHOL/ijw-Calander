/**
 * useSubjectClassStudents - 과목별 수업 학생 데이터 통합 훅
 *
 * PURPOSE: 수학/영어/범용 시간표에서 동일한 로직으로 학생 데이터를 처리.
 * 기존에 useMathClassStudents, useClassStudents(English), useClassStudents(Generic)
 * 3개 훅에 분산되어 있던 코드를 단일 소스로 통합.
 *
 * DATA FLOW:
 * 1. studentMap에서 해당 과목 enrollment 필터링
 * 2. className별 학생 그룹화
 * 3. 반이동 감지 (활성/종료 수업 비교)
 * 4. 상태 필터링 (active/withdrawn/on_hold 포함, prospect 제외)
 *
 * USAGE:
 * const { classDataMap, isLoading } = useSubjectClassStudents({
 *   subject: 'math',
 *   classNames,
 *   studentMap,
 * });
 */

import { useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TimetableStudent } from '../types';
import { formatDateKey } from '../utils/dateUtils';
import { convertTimestampToDate } from '../utils/firestoreConverters';

export interface ClassStudentData {
    studentList: TimetableStudent[];
    studentIds: string[];
}

export interface SubjectClassStudentOptions {
    /** 과목 키 (Firestore enrollment.subject 값) */
    subject: string;
    /** 조회할 수업 이름 목록 */
    classNames: string[];
    /** 전역 학생 데이터 맵 (useStudents(true)에서 제공) */
    studentMap: Record<string, any>;
    /** 주차 기준일 (YYYY-MM-DD), 없으면 오늘 */
    referenceDate?: string;
}

/**
 * 과목별 수업 학생 데이터를 studentMap에서 파생하는 통합 훅.
 * Firestore 쿼리 없이 useMemo로 즉시 파생됩니다.
 */
export function useSubjectClassStudents(options: SubjectClassStudentOptions) {
    const { subject, classNames, studentMap, referenceDate } = options;
    const queryClient = useQueryClient();

    const classDataMap = useMemo<Record<string, ClassStudentData>>(() => {
        if (classNames.length === 0 || Object.keys(studentMap).length === 0) {
            return {};
        }

        const today = referenceDate || formatDateKey(new Date());

        // 1단계: 반이동 감지용 활성/종료 등록 수업 수집
        const studentActiveClasses: Record<string, Set<string>> = {};
        const studentEndedClasses: Record<string, Set<string>> = {};

        Object.entries(studentMap).forEach(([studentId, student]) => {
            if (!student.enrollments) return;

            student.enrollments.forEach((enrollment: any) => {
                if (enrollment.subject !== subject) return;

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

        // 2단계: 요청된 수업들의 학생 데이터 구축
        const classStudentMap: Record<string, Set<string>> = {};
        const enrollmentDataMap: Record<string, Record<string, any>> = {};

        // 정규화된 className 맵 (trim된 이름 → 원본 이름)
        const normalizedClassNames = new Map<string, string>();
        classNames.forEach(name => {
            classStudentMap[name] = new Set();
            enrollmentDataMap[name] = {};
            normalizedClassNames.set(name.trim(), name);
        });

        Object.entries(studentMap).forEach(([studentId, student]) => {
            if (!student.enrollments) return;

            student.enrollments.forEach((enrollment: any) => {
                if (enrollment.subject !== subject) return;

                const rawClassName = enrollment.className as string;
                if (!rawClassName) return;

                // 정확한 매칭 또는 trim된 이름으로 매칭
                let className = rawClassName;
                if (!classNames.includes(rawClassName)) {
                    const trimmedMatch = normalizedClassNames.get(rawClassName.trim());
                    if (trimmedMatch) {
                        className = trimmedMatch;
                    } else {
                        return;
                    }
                }

                const startDate = convertTimestampToDate(enrollment.enrollmentDate || enrollment.startDate);
                const withdrawalDate = convertTimestampToDate(enrollment.withdrawalDate);
                const endDate = convertTimestampToDate(enrollment.endDate);

                const isScheduled = startDate && startDate > today;

                const hasEndDate = !!(withdrawalDate || endDate);
                const activeClasses = studentActiveClasses[studentId] || new Set();
                const endedClasses = studentEndedClasses[studentId] || new Set();

                // isTransferred: 이 수업에서 종료됐지만 다른 수업에 활성 등록이 있음
                const hasActiveInOtherClass = hasEndDate &&
                    Array.from(activeClasses).some(c => c !== className);

                // isTransferredIn: 이 수업에 활성 등록이 있고, 다른 수업에서 종료된 기록이 있음
                const hasEndedInOtherClass = !hasEndDate &&
                    Array.from(endedClasses).some(c => c !== className);

                classStudentMap[className].add(studentId);

                enrollmentDataMap[className][studentId] = {
                    enrollmentDocId: enrollment.id,
                    underline: enrollment.underline,
                    enrollmentDate: startDate,
                    withdrawalDate: withdrawalDate || endDate,
                    onHold: isScheduled || enrollment.onHold,
                    attendanceDays: enrollment.attendanceDays || [],
                    isScheduled,
                    isTransferred: hasActiveInOtherClass,
                    isTransferredIn: hasEndedInOtherClass,
                    isSlotTeacher: enrollment.isSlotTeacher || false,
                };
            });
        });

        // 3단계: TimetableStudent 목록으로 변환
        const result: Record<string, ClassStudentData> = {};

        classNames.forEach(className => {
            const studentIds = Array.from(classStudentMap[className] || []);
            const studentList: TimetableStudent[] = studentIds
                .map(id => {
                    const baseStudent = studentMap[id];
                    const enrollmentData = enrollmentDataMap[className]?.[id] || {};

                    if (!baseStudent) return null;

                    // withdrawn/on_hold 상태도 시간표에 포함 (퇴원/대기 섹션 표시)
                    // prospect/prospective 등 예비 학생만 제외
                    if (!['active', 'withdrawn', 'on_hold'].includes(baseStudent.status)) return null;

                    const classEnrollmentDate = enrollmentData.enrollmentDate || baseStudent.startDate;

                    return {
                        id,
                        name: baseStudent.name || '',
                        englishName: baseStudent.englishName || '',
                        school: baseStudent.school || '',
                        grade: baseStudent.grade || '',
                        underline: enrollmentData.underline ?? baseStudent.underline ?? false,
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

            studentList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

            result[className] = { studentList, studentIds };
        });

        return result;
    }, [subject, classNames, studentMap, referenceDate]);

    const isLoading = classNames.length > 0 && Object.keys(studentMap).length === 0;

    const refetch = useCallback(async () => {
        await queryClient.refetchQueries({ queryKey: ['students', true] });
    }, [queryClient]);

    return { classDataMap, isLoading, refetch };
}
