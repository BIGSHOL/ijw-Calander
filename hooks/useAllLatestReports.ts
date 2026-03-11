import { useQuery } from '@tanstack/react-query';
import { fetchAllLatestReports, EdutrixReport } from '../services/supabaseClient';
import { useEffect } from 'react';

/**
 * 모든 학생의 최근 보고서를 조회하는 hook (학생당 1개씩)
 * 시간표 호버 툴팁에서 사용하기 위해 사전에 로드
 */
export function useAllLatestReports() {
  const result = useQuery<Map<string, EdutrixReport>, Error>({
    queryKey: ['allLatestReports'],
    queryFn: fetchAllLatestReports,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
    refetchInterval: 5 * 60 * 1000, // 5분마다 자동 갱신
  });

  useEffect(() => {
    if (result.data) {
      console.log('[useAllLatestReports] 데이터 로드 완료:', result.data.size, '명');
      // 첫 3명의 데이터 샘플 출력
      const sample = Array.from(result.data.entries()).slice(0, 3);
      console.log('[useAllLatestReports] 샘플 데이터:', sample.map(([name, report]) => ({
        name,
        progress: report.progress,
        date: report.date
      })));
    }
    if (result.error) {
      console.error('[useAllLatestReports] 에러:', result.error);
    }
    if (result.isLoading) {
      console.log('[useAllLatestReports] 로딩 중...');
    }
  }, [result.data, result.error, result.isLoading]);

  return result;
}
