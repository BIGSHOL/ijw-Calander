import { useEffect } from 'react';
import { useAllLatestReports } from '../hooks/useAllLatestReports';

/**
 * Edutrix 보고서 데이터를 전역적으로 사전 로드하는 컴포넌트
 * 앱 최상위에서 한 번만 호출하여 모든 학생의 최근 보고서를 미리 불러옴
 */
export function EdutrixReportsProvider() {
  const { data, isLoading, error } = useAllLatestReports();

  useEffect(() => {
    console.log('[EdutrixReportsProvider] 마운트됨');
  }, []);

  useEffect(() => {
    if (isLoading) {
      console.log('[EdutrixReportsProvider] 로딩 중...');
    }
  }, [isLoading]);

  useEffect(() => {
    if (error) {
      console.error('[EdutrixReportsProvider] 에러 발생:', error);
    }
  }, [error]);

  useEffect(() => {
    if (data) {
      console.log('[EdutrixReportsProvider] 데이터 로드 완료:', data.size, '명');
      // 첫 5명 샘플 출력
      const sample = Array.from(data.entries()).slice(0, 5);
      console.table(sample.map(([name, report]) => ({
        이름: name,
        날짜: report.date,
        진도: report.progress || '(없음)',
        시험: report.exam_info || '(없음)',
        숙제: report.assignment_score || '(없음)'
      })));
    }
  }, [data]);

  // UI를 렌더링하지 않음 (데이터만 로드)
  return null;
}
