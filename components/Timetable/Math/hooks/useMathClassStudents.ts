/**
 * useMathClassStudents - 수학 시간표 학생 데이터 훅
 *
 * 통합 훅 useSubjectClassStudents의 수학 과목 래퍼.
 * 기존 API를 유지하면서 내부적으로 통합 훅을 사용합니다.
 */

import { useSubjectClassStudents } from '../../../../hooks/useSubjectClassStudents';

export type { ClassStudentData } from '../../../../hooks/useSubjectClassStudents';

export const useMathClassStudents = (
    classNames: string[],
    studentMap: Record<string, any> = {}
) => {
    return useSubjectClassStudents({
        subject: 'math',
        classNames,
        studentMap,
    });
};
