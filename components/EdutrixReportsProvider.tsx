import { useAllLatestReports } from '../hooks/useAllLatestReports';

/**
 * Edutrix 보고서 데이터를 전역적으로 사전 로드하는 컴포넌트
 * 앱 최상위에서 한 번만 호출하여 모든 학생의 최근 보고서를 미리 불러옴
 */
export function EdutrixReportsProvider() {
  // 데이터를 캐시에 로드만 함 (UI 렌더링 없음)
  useAllLatestReports();
  return null;
}
