/**
 * 학원 브랜드 컬러 시스템
 *
 * 곤색, 노란색, 회색을 기반으로 한 일관된 디자인 시스템
 */
export const BRAND_COLORS = {
  // 메인 브랜드 컬러
  primary: '#081429',      // 곤색 - 헤더, 주요 버튼, 강조 요소
  accent: '#fdb813',       // 노란색 - 액션 버튼, 강조 포인트, 호버 효과
  secondary: '#373d41',    // 회색 - 텍스트, 보조 UI 요소

  // 파생 색상
  primaryLight: '#1a2845',     // 연한 곤색 - 배경
  primaryDark: '#050d1a',      // 진한 곤색
  accentDark: '#e5a60f',       // 진한 노란색 - 호버
  accentLight: 'rgba(253, 184, 19, 0.1)',  // 반투명 노란색 - 배경

  // 상태 색상
  success: '#10b981',      // 초록색
  error: '#ef4444',        // 빨간색
  warning: '#f59e0b',      // 주황색
  info: '#3b82f6',         // 파란색

  // 중립 색상
  white: '#ffffff',
  black: '#000000',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
} as const;

/**
 * 과목별 색상 테마
 */
export const SUBJECT_COLORS = {
  math: {
    primary: BRAND_COLORS.primary,      // 곤색
    accent: BRAND_COLORS.accent,        // 노란색
    light: BRAND_COLORS.primaryLight,   // 연한 곤색 배경
  },
  english: {
    primary: BRAND_COLORS.primary,      // 곤색
    accent: BRAND_COLORS.accent,        // 노란색
    light: '#2a3f5f',                   // 파란빛 곤색 배경
  }
} as const;

/**
 * 컴포넌트별 스타일 상수
 */
export const COMPONENT_STYLES = {
  // 버튼
  button: {
    primary: `bg-[${BRAND_COLORS.primary}] hover:bg-[${BRAND_COLORS.accent}] text-white transition-colors`,
    secondary: `bg-transparent border border-[${BRAND_COLORS.primary}] text-[${BRAND_COLORS.primary}] hover:bg-[${BRAND_COLORS.primary}] hover:text-white transition-colors`,
    accent: `bg-[${BRAND_COLORS.accent}] hover:bg-[${BRAND_COLORS.accentDark}] text-[${BRAND_COLORS.primary}] transition-colors`,
  },
  // 카드
  card: {
    base: `bg-white border border-[${BRAND_COLORS.primary}] rounded-lg transition-all shadow-sm`,
    hover: `hover:border-[${BRAND_COLORS.accent}] hover:border-2 hover:shadow-md`,
  },
  // 텍스트
  text: {
    title: `text-[${BRAND_COLORS.primary}] font-bold`,
    subtitle: `text-[${BRAND_COLORS.secondary}]`,
    accent: `text-[${BRAND_COLORS.accent}] font-semibold`,
  }
} as const;
