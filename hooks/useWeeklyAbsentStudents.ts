import { useQuery } from '@tanstack/react-query';
import { fetchWeeklyAbsentStudents } from '../services/supabaseClient';
import { formatDateKey } from '../utils/dateUtils';

/**
 * 특정 주차의 지각/결석 학생 이름 Set 반환
 */
export function useWeeklyAbsentStudents(weekStart?: Date) {
    const startStr = weekStart ? formatDateKey(weekStart) : '';
    const endDate = weekStart ? new Date(weekStart) : new Date();
    if (weekStart) endDate.setDate(endDate.getDate() + 6);
    const endStr = weekStart ? formatDateKey(endDate) : '';

    return useQuery({
        queryKey: ['weeklyAbsent', startStr],
        enabled: !!startStr,
        queryFn: () => fetchWeeklyAbsentStudents(startStr, endStr),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
    });
}
