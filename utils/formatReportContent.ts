/**
 * 상담 녹음 분석 보고서 내용의 줄바꿈을 정규화하는 유틸
 * - 배열 데이터 (구버전 Firestore) → 줄바꿈 문자열로 변환
 * - 이미 줄바꿈이 있는 문자열 (새 녹음) → 그대로 반환
 * - ",- " 패턴으로 이어진 불릿 (기존 데이터) → 줄바꿈으로 분리
 */
export function formatReportContent(text: unknown): string {
  // 배열인 경우 (구버전 Firestore 데이터)
  if (Array.isArray(text)) {
    return text
      .map(item => String(item).trim())
      .filter(Boolean)
      .map(item => item.startsWith('-') ? item : `- ${item}`)
      .join('\n');
  }
  if (typeof text !== 'string') return String(text ?? '');

  // 이미 줄바꿈이 있으면 그대로 반환 (새 녹음)
  if (text.includes('\n')) return text.trim();

  // 기존 데이터: ",- " 패턴으로 이어진 불릿을 줄바꿈으로 분리
  const parts = text.split(/,\s*(?=- )/);
  return parts
    .map(p => p.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}
