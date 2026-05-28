/**
 * useMathClassStudents - 수학 시간표 학생 데이터 훅
 *
 * 통합 훅 useSubjectClassStudents의 수학 과목 래퍼.
 * 시뮬레이션 모드 지원: MathSimulationProvider 안에 있으면
 * 시뮬레이션 모드 진입 시 자동으로 scenarioEnrollments 기반 데이터로 전환.
 */

import { useMemo } from 'react';
import { useMathSimulationOptional } from '../context/SimulationContext';
import { useSubjectClassStudents } from '../../../../hooks/useSubjectClassStudents';

export type { ClassStudentData } from '../../../../hooks/useSubjectClassStudents';

export const useMathClassStudents = (
    classNames: string[],
    studentMap: Record<string, any> = {},
    referenceDate?: string,
    subject: string | string[] = 'math'
) => {
    // SimulationContext - optional (provider 밖이면 null)
    const simulation = useMathSimulationOptional();
    const isSimulationMode = !!simulation?.isScenarioMode;

    // 시나리오 모드: Context의 scenarioEnrollments 기반 학생 데이터 파생
    const simulationData = useMemo(() => {
        if (!isSimulationMode || !simulation) return null;
        return simulation.getClassStudents(classNames, studentMap, referenceDate);
    }, [isSimulationMode, simulation, simulation?.scenarioEnrollments, classNames, studentMap, referenceDate]);

    // 실 데이터 — 시뮬레이션 모드에서는 빈 classNames로 호출하여 라이브 조회 비활성화
    const real = useSubjectClassStudents({
        subject,
        classNames: isSimulationMode ? [] : classNames,
        studentMap,
        referenceDate,
    });

    if (isSimulationMode && simulationData) {
        return {
            classDataMap: simulationData,
            isLoading: false,
            refetch: async () => {
                await simulation?.loadFromLive();
            },
        };
    }

    return real;
};