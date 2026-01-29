// Scenario Management Utilities
// 시나리오 관리 유틸리티 함수

import { ScenarioEntry } from '../../../types';

/**
 * 시나리오 데이터 검증
 * - version 1 (레거시): data, studentData 필드 사용
 * - version 2 (새 구조): classes, enrollments 필드 사용
 */
export const validateScenarioData = (scenario: any): { isValid: boolean; error?: string } => {
    if (!scenario) {
        return { isValid: false, error: '시나리오 데이터가 없습니다.' };
    }

    if (!scenario.id) {
        return { isValid: false, error: '시나리오 ID가 없습니다.' };
    }

    if (!scenario.createdAt) {
        return { isValid: false, error: '생성 날짜 정보가 없습니다.' };
    }

    // Version 2+ (새 구조): classes, enrollments 필드 검증
    // - version 2: 기본 새 구조
    // - version 3: 뷰 설정(viewSettings) 포함
    if (scenario.version >= 2) {
        if (!scenario.classes || typeof scenario.classes !== 'object') {
            return { isValid: false, error: '수업 데이터(classes)가 손상되었습니다.' };
        }
        // enrollments는 빈 객체일 수 있음
        if (scenario.enrollments && typeof scenario.enrollments !== 'object') {
            return { isValid: false, error: '수강 데이터(enrollments)가 손상되었습니다.' };
        }
        return { isValid: true };
    }

    // Version 1 (레거시): data, studentData 필드 검증
    if (!scenario.data || typeof scenario.data !== 'object') {
        return { isValid: false, error: '시간표 데이터가 손상되었습니다.' };
    }

    // studentData는 선택적 (구 버전 호환)
    if (scenario.studentData && typeof scenario.studentData !== 'object') {
        return { isValid: false, error: '학생 데이터가 손상되었습니다.' };
    }

    return { isValid: true };
};

/**
 * 시나리오 통계 계산
 */
export const calculateScenarioStats = (
    data: Record<string, any>,
    studentData: Record<string, any>
): { timetableDocCount: number; classCount: number; studentCount: number } => {
    // 시간표 문서 수 (고유 강사 문서 수)
    const timetableDocCount = Object.keys(data).length;

    // 수업 수 (studentData의 문서 수)
    const classCount = Object.keys(studentData || {}).length;

    // 활성 학생 수 카운트
    let studentCount = 0;
    Object.values(studentData || {}).forEach((classData: any) => {
        if (classData?.students && Array.isArray(classData.students)) {
            // onHold, withdrawn 제외
            studentCount += classData.students.filter(
                (s: any) => s && !s.onHold && !s.withdrawn
            ).length;
        }
    });

    return { timetableDocCount, classCount, studentCount };
};

/**
 * 고유 시나리오 ID 생성
 */
export const generateScenarioId = (): string => {
    return `scenario_${Date.now()}`;
};

/**
 * 시나리오로부터 데이터 문서 수 확인 (Batch 제한 체크용)
 */
export const countScenarioDocuments = (scenario: ScenarioEntry): number => {
    const dataCount = Object.keys(scenario.data || {}).length;
    const studentDataCount = Object.keys(scenario.studentData || {}).length;
    return dataCount + studentDataCount;
};
