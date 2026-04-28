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
import { formatScheduleCompact } from '../components/Timetable/constants';

export interface ClassStudentData {
    studentList: TimetableStudent[];
    studentIds: string[];
}

export interface SubjectClassStudentOptions {
    /** 과목 키 (Firestore enrollment.subject 값). 배열이면 OR 매칭 */
    subject: string | string[];
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
    const subjectKey = Array.isArray(subject) ? subject.join(',') : subject;

    const classDataMap = useMemo<Record<string, ClassStudentData>>(() => {
        const subjects = subjectKey.split(',');
        if (classNames.length === 0 || Object.keys(studentMap).length === 0) {
            return {};
        }

        const today = referenceDate || formatDateKey(new Date());

        // 1단계: 반이동 감지용 활성/종료 등록 수업 수집
        const studentActiveClasses: Record<string, Set<string>> = {};
        const studentEndedClasses: Record<string, Set<string>> = {};
        // 활성 수업의 스케줄/강사 정보 (반이동예정 툴팁용)
        const studentActiveClassSchedule: Record<string, Record<string, string[]>> = {};
        const studentActiveClassTeacher: Record<string, Record<string, string>> = {};
        /**
         * 학생별 "이 과목 전체 enrollment 중 가장 이른 시작일" 캐시.
         * 신입 빨간/핑크 판정 기준 — 같은 과목에서 과거 수강 이력이 있으면 새 반에서 다시 시작해도 신입 아님.
         * 예: 김지호 = 2020-11-09 (수학 김민주반 첫 시작) — 오늘 김은정반 새 등록 시 enrollmentDate=오늘 이지만
         *      firstSubjectEnrollmentDate=2020-11-09 → 신입 표시 안 됨.
         */
        const studentFirstSubjectStartDate: Record<string, string> = {};

        Object.entries(studentMap).forEach(([studentId, student]) => {
            if (!student.enrollments) return;

            student.enrollments.forEach((enrollment: any) => {
                if (!subjects.includes(enrollment.subject)) return;
                // 취소된 예약은 활성/종료 어디에도 카운트 안 함 (반이동 감지 정확성을 위해)
                if (enrollment.cancelledAt) return;
                // 시간표에서 숨김 처리된 퇴원 record 도 제외
                if (enrollment.hiddenAt) return;
                // 모순 record 가드 — startDate > endDate 인 깨진 record 는 무시
                {
                    const _s = convertTimestampToDate(enrollment.enrollmentDate || enrollment.startDate);
                    const _e = convertTimestampToDate(enrollment.withdrawalDate || enrollment.endDate);
                    if (_s && _e && _s > _e) return;
                }

                const className = enrollment.className as string;
                if (!className) return;

                const startDateForFirst = convertTimestampToDate(enrollment.enrollmentDate || enrollment.startDate);
                if (startDateForFirst) {
                    const cur = studentFirstSubjectStartDate[studentId];
                    if (!cur || startDateForFirst < cur) {
                        studentFirstSubjectStartDate[studentId] = startDateForFirst;
                    }
                }

                const withdrawalDate = convertTimestampToDate(enrollment.withdrawalDate);
                const endDate = convertTimestampToDate(enrollment.endDate);
                // 기준일(referenceDate) 대비 종료 여부 판단
                const effectiveEndDate = withdrawalDate || endDate;
                const hasEndDate = effectiveEndDate ? effectiveEndDate <= today : false;

                if (!hasEndDate) {
                    if (!studentActiveClasses[studentId]) {
                        studentActiveClasses[studentId] = new Set();
                    }
                    studentActiveClasses[studentId].add(className);
                    // 스케줄/강사 저장
                    if (enrollment.schedule) {
                        if (!studentActiveClassSchedule[studentId]) studentActiveClassSchedule[studentId] = {};
                        studentActiveClassSchedule[studentId][className] = enrollment.schedule;
                    }
                    if (enrollment.teacher || enrollment.staffId) {
                        if (!studentActiveClassTeacher[studentId]) studentActiveClassTeacher[studentId] = {};
                        studentActiveClassTeacher[studentId][className] = enrollment.teacher || enrollment.staffId;
                    }
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
                if (!subjects.includes(enrollment.subject)) return;
                // 취소된 예약은 시간표에 표시하지 않음 (학생 카드/대기 모두)
                if (enrollment.cancelledAt) return;
                // 시간표에서 숨김 처리된 퇴원 record (Delete 키로 숨김 처리됨) 도 제외
                if (enrollment.hiddenAt) return;
                // 모순 record 가드 — startDate > endDate 인 깨진 record 는 시간표에 표시 안 함
                {
                    const _s = convertTimestampToDate(enrollment.enrollmentDate || enrollment.startDate);
                    const _e = convertTimestampToDate(enrollment.withdrawalDate || enrollment.endDate);
                    if (_s && _e && _s > _e) return;
                }

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

                // 기준일 대비 종료 여부 (endDate가 기준일과 같거나 이전이면 종료)
                const effectiveEndDate2 = withdrawalDate || endDate;
                const hasEndDate = effectiveEndDate2 ? effectiveEndDate2 <= today : false;
                const activeClasses = studentActiveClasses[studentId] || new Set();
                const endedClasses = studentEndedClasses[studentId] || new Set();

                // isTransferred: 이 수업에서 종료됐지만 다른 수업에 활성 등록이 있음
                const hasActiveInOtherClass = hasEndDate &&
                    Array.from(activeClasses).some(c => c !== className);
                // transferTo: 반이동 대상 반 정보 (담당/반이름/스케줄)
                let transferToClass: string | undefined;
                if (hasActiveInOtherClass) {
                    const targetClass = Array.from(activeClasses).find(c => c !== className);
                    if (targetClass) {
                        const teacher = studentActiveClassTeacher[studentId]?.[targetClass];
                        const targetSchedule = studentActiveClassSchedule[studentId]?.[targetClass];
                        const scheduleStr = targetSchedule?.length ? formatScheduleCompact(targetSchedule, subject as any) : '';
                        const parts: string[] = [];
                        if (teacher) parts.push(`담당: ${teacher}`);
                        parts.push(scheduleStr ? `${targetClass} (${scheduleStr})` : targetClass);
                        transferToClass = parts.join('\n');
                    }
                }

                // isTransferredIn: 이 수업에 활성 등록이 있고, 다른 수업에서 종료된 기록이 있음
                const hasEndedInOtherClass = !hasEndDate &&
                    Array.from(endedClasses).some(c => c !== className);

                classStudentMap[className].add(studentId);

                // 동일 학생이 같은 반에 여러 수강기록(종료+재등록)이 있을 경우
                // 활성 수강기록(endDate 없음)을 우선하고, 같은 상태면 최신 등록일 우선
                const existingData = enrollmentDataMap[className]?.[studentId];
                if (existingData) {
                    const existingHasEnd = !!existingData.withdrawalDate;
                    const existingIsScheduled = existingData.isScheduled;
                    if (!existingHasEnd && hasEndDate) {
                        // 기존이 활성, 현재가 종료 → 기존 유지 (활성 우선)
                        return;
                    }
                    if (existingHasEnd === hasEndDate) {
                        // 같은 상태(둘 다 활성 또는 둘 다 종료)
                        // 활성 중에서: 현재 수강 중 > 미래 예정(isScheduled) 우선
                        if (!existingIsScheduled && isScheduled) {
                            // 기존이 현재 활성, 현재가 미래 예정 → 기존 유지
                            return;
                        }
                        if (existingIsScheduled && !isScheduled) {
                            // 기존이 미래 예정, 현재가 현재 활성 → 덮어쓰기
                            // fall through
                        } else {
                            // 같은 scheduled 상태 → 최신 등록일 우선
                            if (existingData.enrollmentDate && startDate && existingData.enrollmentDate >= startDate) {
                                return;
                            }
                        }
                    }
                    // existingHasEnd && !hasEndDate → 기존이 종료, 현재가 활성 → 덮어쓰기 (활성 우선)
                }

                enrollmentDataMap[className][studentId] = {
                    enrollmentDocId: enrollment.id,
                    underline: enrollment.underline,
                    enrollmentDate: startDate,
                    // 학생의 같은 과목 전체 중 가장 이른 startDate — 신입 판정/입학일 툴팁 기준
                    // (재등록/반이동 후에도 진짜 첫 수학 입학일을 유지)
                    firstSubjectEnrollmentDate: studentFirstSubjectStartDate[studentId],
                    // 기준일 기준으로 종료된 경우만 withdrawalDate 표시
                    withdrawalDate: hasEndDate ? (withdrawalDate || endDate) : undefined,
                    // 대기 분류는 다음 모두 만족할 때만:
                    //  - isScheduled (startDate 미래)
                    //  - !hasEndDate (종료 안 됨)
                    //  - !cancelledAt (예약 취소 안 됨; cancel ≠ delete 정책으로 데이터는 보존되지만 시간표/배정예정에서는 빠짐)
                    onHold: (isScheduled && !hasEndDate && !enrollment.cancelledAt) || enrollment.onHold,
                    attendanceDays: enrollment.attendanceDays || [],
                    isScheduled,
                    isTransferred: hasActiveInOtherClass,
                    isTransferredIn: hasEndedInOtherClass,
                    isSlotTeacher: enrollment.isSlotTeacher || false,
                    transferTo: transferToClass,
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
                        // 학생의 같은 과목 전체 첫 입학일 — 신입 판정 기준 (ClassCard / TimetableHeader / IntegrationCard 가 사용)
                        firstSubjectEnrollmentDate: enrollmentData.firstSubjectEnrollmentDate,
                        withdrawalDate: enrollmentData.withdrawalDate,
                        onHold: enrollmentData.onHold,
                        isMoved: false,
                        attendanceDays: enrollmentData.attendanceDays || [],
                        isScheduled: enrollmentData.isScheduled || false,
                        isTransferred: enrollmentData.isTransferred || false,
                        isTransferredIn: enrollmentData.isTransferredIn || false,
                        transferTo: enrollmentData.transferTo,
                        enrollmentDocId: enrollmentData.enrollmentDocId,
                        isSlotTeacher: enrollmentData.isSlotTeacher || false,
                        // 등하원 정보 (학생 프로필에서 복사)
                        arrivalTime: baseStudent.arrivalTime,
                        departureTime: baseStudent.departureTime,
                        transportTags: baseStudent.transportTags,
                    } as TimetableStudent;
                })
                .filter(Boolean) as TimetableStudent[];

            studentList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

            result[className] = { studentList, studentIds };
        });

        return result;
    }, [subjectKey, classNames, studentMap, referenceDate]);

    const isLoading = classNames.length > 0 && Object.keys(studentMap).length === 0;

    const refetch = useCallback(async () => {
        await queryClient.refetchQueries({ queryKey: ['students', true] });
    }, [queryClient]);

    return { classDataMap, isLoading, refetch };
}
