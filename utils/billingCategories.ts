/**
 * 수납(billing) 도메인 공통 유틸
 *  - 수납명 카테고리 분류 (4가지)
 *  - 학년 정렬 키 (초1 < 초2 < ... < 중1 < ... < 고3 < 기타)
 */

export type BillingCategory = 'textbook' | 'gangaSystem' | 'shuttle' | 'other';

export const BILLING_CATEGORIES: BillingCategory[] = ['textbook', 'gangaSystem', 'shuttle', 'other'];

export const BILLING_CATEGORY_LABELS: Record<BillingCategory, string> = {
  textbook: '교재 (시스템 사용료 제외)',
  gangaSystem: '교재 강아 시스템 사용료',
  shuttle: '스쿨버스비',
  other: '나머지',
};

/**
 * 수납명을 4가지 카테고리로 분류.
 * 1) "교재 강아 시스템 사용료" 정확히 매칭 (가장 구체적)
 * 2) 스쿨버스/셔틀/통학버스
 * 3) "교재" 포함 & "시스템 사용료" 미포함
 * 4) 그 외 = 나머지
 */
export function classifyBillingCategory(billingName: string): BillingCategory {
  const name = billingName || '';
  if (/교재\s*강아\s*시스템\s*사용료/.test(name)) return 'gangaSystem';
  if (/스쿨버스|셔틀|통학버스/.test(name)) return 'shuttle';
  if (/교재/.test(name) && !/시스템\s*사용료/.test(name)) return 'textbook';
  return 'other';
}

/**
 * 학년 문자열의 정렬 순서 키.
 * 초1~초6 < 중1~중3 < 고1~고3 < 기타
 */
export function gradeSortKey(grade: string): number {
  const g = grade || '';
  const m = g.match(/^(초|중|고)([0-9]+)$/);
  if (!m) return 9999;
  const base = m[1] === '초' ? 0 : m[1] === '중' ? 100 : 200;
  return base + Number(m[2]);
}

/** 학년 배열 정렬 (초→중→고 순) */
export function sortGrades(grades: string[]): string[] {
  return [...grades].sort(
    (a, b) => gradeSortKey(a) - gradeSortKey(b) || a.localeCompare(b, 'ko'),
  );
}