import { useQuery } from '@tanstack/react-query';
import { fetchAllLatestReports, EdutrixReport } from '../services/supabaseClient';

/**
 * 모든 학생의 최근 보고서를 조회하는 hook (학생당 1개씩)
 * 시간표 호버 툴팁에서 사용하기 위해 사전에 로드
 */
export function useAllLatestReports() {
  return useQuery<Map<string, EdutrixReport>, Error>({
    queryKey: ['allLatestReports'],
    queryFn: fetchAllLatestReports,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
    refetchInterval: 5 * 60 * 1000, // 5분마다 자동 갱신
  });
}
