/**
 * useEnglishStats - Student statistics for English timetable
 *
 * PURPOSE: 수학 탭과 동일한 데이터 소스(useSubjectClassStudents의 studentList)를
 * 이터레이트하여 통계 계산. 아래 테이블에 표시되는 학생과 헤더 카운트가
 * 정확히 일치하도록 보장.
 *
 * 기존에는 studentMap.enrollments를 직접 필터링하는 방식이었으나,
 * 이는 아래 테이블 렌더링에 쓰이는 studentList 데이터와 불일치할 수 있어
 * 재원/신입/예정/퇴원 카운트가 어긋나는 버그가 있었음.
 */

import { useMemo } from 'react';
import { formatDateKey } from '../../../../utils/dateUtils';
import { useSubjectClassStudents } from '../../../../hooks/useSubjectClassStudents';

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
    activeStudents: StudentInfo[];
    newStudents: StudentInfo[];
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
    // scheduleData에서 수업명 목록 추출
    const classNames = useMemo(() => {
        const names = new Set<string>();
        Object.values(scheduleData).forEach(cell => {
            if (cell.className) names.add(cell.className);
            if (cell.merged) {
                cell.merged.forEach(m => { if (m.className) names.add(m.className); });
            }
        });
        return Array.from(names);
    }, [scheduleData]);

    // 아래 테이블과 동일한 데이터 소스 사용 (React Query 캐시 공유)
    const { classDataMap } = useSubjectClassStudents({
        subject: 'english',
        classNames: isSimulationMode ? [] : classNames,
        studentMap,
        referenceDate,
    });

    const studentStats = useMemo<StudentStats>(() => {
        const today = referenceDate || formatDateKey(new Date());
        const refDate = new Date(today);

        const activeStudentIds = new Set<string>();
        const new1StudentIds = new Set<string>();
        const new2StudentIds = new Set<string>();
        const waitingStudentIds = new Set<string>();
        const processedStudents = new Map<string, any>();

        // studentList 데이터 기반 — 수학 탭과 동일 로직
        // 1차 패스: 학생별로 모든 수업의 enrollment 데이터를 수집하고 "활성 enrollment 우선" 원칙으로 dedup
        const studentBestData = new Map<string, any>();
        Object.values(classDataMap || {}).forEach((classData: any) => {
            classData.studentList?.forEach((student: any) => {
                const existing = studentBestData.get(student.id);
                if (!existing) {
                    studentBestData.set(student.id, student);
                    return;
                }
                // 활성(withdrawalDate 없고 onHold 아님) 우선
                const isActive = (s: any) => !s.withdrawalDate && !s.onHold;
                if (isActive(student) && !isActive(existing)) {
                    studentBestData.set(student.id, student);
                }
            });
        });

        studentBestData.forEach((student, studentId) => {
            processedStudents.set(studentId, student);

            // 전역 상태가 active가 아닌 학생은 재원에서 제외 (orphaned enrollment 방지)
            const baseStudent = studentMap[studentId];
            const baseStatus = baseStudent?.status;

            // 실제 퇴원 (반이동 제외)
            if (student.withdrawalDate && !student.isTransferred) return;
            // 반이동 학생 - 퇴원이 아님, 스킵 (다른 반에서 재원생으로 카운트)
            if (student.withdrawalDate && student.isTransferred) return;

            // 대기/예정 (onHold) - 전역 상태 무관하게 대기로 카운트
            if (student.onHold) {
                const enrollDate = student.enrollmentDate || student.startDate;
                if (enrollDate) {
                    const daysUntil = Math.floor((new Date(enrollDate).getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysUntil <= 30) waitingStudentIds.add(studentId);
                } else {
                    waitingStudentIds.add(studentId);
                }
                return;
            }

            // 재원생 — 전역 상태가 'active'인 학생만 카운트
            if (baseStatus !== 'active') return;
            activeStudentIds.add(studentId);

            // 신입 (반이동 제외)
            // 기준 = 같은 과목 전체 첫 입학일 (firstSubjectEnrollmentDate).
            //  - 같은 과목에서 새 반 재등록한 기존 학생이 신입으로 잘못 집계되던 버그 방지
            if (!student.isTransferredIn) {
                const enrollDate = student.firstSubjectEnrollmentDate || student.enrollmentDate || student.startDate;
                if (enrollDate) {
                    const daysSince = Math.floor((refDate.getTime() - new Date(enrollDate).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSince >= 0 && daysSince <= 30) new1StudentIds.add(studentId);
                    else if (daysSince > 30 && daysSince <= 60) new2StudentIds.add(studentId);
                }
            }
        });

        // 퇴원 / 퇴원예정 목록
        const withdrawnStudents: StudentInfo[] = [];
        const withdrawnFutureStudents: StudentInfo[] = [];

        processedStudents.forEach((student, studentId) => {
            if (!student.withdrawalDate || student.isTransferred) return;
            const base = studentMap[studentId] || student;
            const info: StudentInfo = {
                id: studentId,
                name: base.name || student.name,
                school: base.school || '',
                grade: base.grade || '',
                withdrawalDate: student.withdrawalDate,
            };

            if (student.withdrawalDate > today) {
                withdrawnFutureStudents.push(info);
            } else {
                const daysSince = Math.floor((refDate.getTime() - new Date(student.withdrawalDate).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSince <= 30) withdrawnStudents.push(info);
            }
        });

        // 대기 학생 목록
        const waitingStudents: StudentInfo[] = [];
        waitingStudentIds.forEach(studentId => {
            const base = studentMap[studentId];
            const student = processedStudents.get(studentId);
            if (base || student) {
                waitingStudents.push({
                    id: studentId,
                    name: base?.name || student?.name || '',
                    school: base?.school || '',
                    grade: base?.grade || '',
                    enrollmentDate: student?.enrollmentDate,
                });
            }
        });

        // 재원 / 신입 학생 상세 목록 (툴팁용) — 같은 과목 첫 입학일 기준
        const buildInfo = (studentId: string): StudentInfo | null => {
            const base = studentMap[studentId];
            const student = processedStudents.get(studentId);
            if (!base && !student) return null;
            return {
                id: studentId,
                name: base?.name || student?.name || '',
                school: base?.school || '',
                grade: base?.grade || '',
                enrollmentDate: student?.firstSubjectEnrollmentDate || student?.enrollmentDate,
            };
        };
        const activeStudents: StudentInfo[] = [];
        activeStudentIds.forEach(id => {
            const info = buildInfo(id);
            if (info) activeStudents.push(info);
        });
        activeStudents.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        const newStudents: StudentInfo[] = [];
        new1StudentIds.forEach(id => {
            const info = buildInfo(id);
            if (info) newStudents.push(info);
        });
        newStudents.sort((a, b) => (b.enrollmentDate || '').localeCompare(a.enrollmentDate || ''));

        return {
            active: activeStudentIds.size,
            new1: new1StudentIds.size,
            new2: new2StudentIds.size,
            withdrawn: withdrawnStudents.length,
            withdrawnFuture: withdrawnFutureStudents.length,
            waiting: waitingStudentIds.size,
            activeStudents,
            newStudents,
            waitingStudents,
            withdrawnStudents,
            withdrawnFutureStudents,
        };
    }, [classDataMap, studentMap, referenceDate]);

    return studentStats;
};
