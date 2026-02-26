/**
 * useClassStudents - 영어 시간표 학생 데이터 훅
 *
 * 통합 훅 useSubjectClassStudents의 영어 과목 래퍼.
 * 시뮬레이션 모드 지원은 이 래퍼에서 처리합니다.
 */

import { useMemo } from 'react';
import { useSimulationOptional } from '../context/SimulationContext';
import { useSubjectClassStudents } from '../../../../hooks/useSubjectClassStudents';

export type { ClassStudentData } from '../../../../hooks/useSubjectClassStudents';

export const useClassStudents = (
    classNames: string[],
    isSimulationMode: boolean = false,
    studentMap: Record<string, any> = {},
    referenceDate?: string
) => {
    // SimulationContext - optional (may not be wrapped in provider)
    const simulation = useSimulationOptional();

    // 시나리오 모드: Context에서 시나리오 데이터 사용
    const simulationData = useMemo(() => {
        if (!isSimulationMode || !simulation?.isScenarioMode) {
            return null;
        }
        return simulation.getClassStudents(classNames, studentMap);
    }, [isSimulationMode, simulation?.isScenarioMode, simulation?.scenarioEnrollments, classNames, studentMap]);

    // 통합 훅으로 실제 데이터 파생 (시뮬레이션 모드에서는 빈 배열로 비활성화)
    const { classDataMap: realDataMap, isLoading: realIsLoading, refetch: realRefetch } = useSubjectClassStudents({
        subject: 'english',
        classNames: isSimulationMode ? [] : classNames,
        studentMap,
        referenceDate,
    });

    // 시뮬레이션 모드면 simulationData 반환
    if (isSimulationMode && simulationData) {
        return {
            classDataMap: simulationData,
            isLoading: false,
            refetch: async () => {
                await simulation?.loadFromLive();
            },
        };
    }

    return {
        classDataMap: realDataMap,
        isLoading: !isSimulationMode && realIsLoading,
        refetch: realRefetch,
    };
};
