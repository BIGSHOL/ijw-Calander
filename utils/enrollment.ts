/**
 * Enrollment 관련 공유 유틸리티
 *
 * 과목별 수강종료 판정 등 enrollment 데이터 처리를 위한 단일 진실 소스.
 */

import { UnifiedStudent, Enrollment } from '../types';

/**
 * 과목별 수강종료 여부 판정:
 * - 해당 과목의 모든 enrollment에 종료일(withdrawalDate/endDate)이 있고
 * - 현재 활성(종료일 없는) enrollment가 없으면 → 수강종료
 */
export function getEndedSubjects(student: UnifiedStudent): { subjects: string[]; enrollments: Enrollment[] } {
    const bySubject = new Map<string, Enrollment[]>();
    for (const e of student.enrollments || []) {
        const list = bySubject.get(e.subject) || [];
        list.push(e);
        bySubject.set(e.subject, list);
    }

    const endedSubjects: string[] = [];
    const endedEnrollments: Enrollment[] = [];

    for (const [subject, enrollments] of bySubject) {
        const hasActive = enrollments.some(e => !e.withdrawalDate && !e.endDate);
        if (!hasActive && enrollments.length > 0) {
            endedSubjects.push(subject);
            endedEnrollments.push(...enrollments);
        }
    }

    return { subjects: endedSubjects, enrollments: endedEnrollments };
}
