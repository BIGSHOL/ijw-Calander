import { useQuery } from '@tanstack/react-query';
import { fetchStudentReports, EdutrixReport } from '../services/supabaseClient';

/**
 * 학생의 최근 보고서를 조회하는 hook
 * @param studentName - 학생 이름
 * @param limit - 조회할 보고서 개수 (기본값: 10)
 * @param enabled - 쿼리 활성화 여부 (기본값: true)
 */
export function useStudentReports(
  studentName: string | null | undefined,
  limit: number = 10,
  enabled: boolean = true
) {
  return useQuery<EdutrixReport[], Error>({
    queryKey: ['studentReports', studentName, limit],
    queryFn: () => {
      if (!studentName) {
        return Promise.resolve([]);
      }
      return fetchStudentReports(studentName, limit);
    },
    enabled: enabled && !!studentName,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
}
