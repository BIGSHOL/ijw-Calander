// Style Utility Functions

// Embedded Injaewon Logo Path
export const INJAEWON_LOGO = "/logo.png";

/**
 * 과목별 색상 시스템 (앱 전체 통일)
 * - 수학: 골드/노란색 계열 (브랜드 강조색)
 * - 영어: 네이비/파란색 계열 (브랜드 기본색)
 * - 과학: 그린 계열 (추후 확장)
 * - 국어: 레드/핑크 계열 (추후 확장)
 */
export type SubjectType = 'math' | 'english' | 'science' | 'korean' | 'other';

export const SUBJECT_COLORS: Record<SubjectType, {
  bg: string;           // 배경색
  text: string;         // 텍스트색
  border: string;       // 테두리색
  light: string;        // 연한 배경 (카드용)
  badge: string;        // 배지 스타일 (Tailwind classes)
  badgeAlt: string;     // 대체 배지 스타일 (반전)
}> = {
  math: {
    bg: '#fdb813',
    text: '#081429',
    border: '#e5a60f',
    light: '#fef9e7',
    badge: 'bg-[#fdb813] text-[#081429]',
    badgeAlt: 'bg-[#081429] text-[#fdb813]',
  },
  english: {
    bg: '#081429',
    text: '#ffffff',
    border: '#1a2845',
    light: '#f0f4f8',
    badge: 'bg-[#081429] text-white',
    badgeAlt: 'bg-white text-[#081429] border border-[#081429]',
  },
  science: {
    bg: '#10b981',
    text: '#ffffff',
    border: '#059669',
    light: '#ecfdf5',
    badge: 'bg-emerald-500 text-white',
    badgeAlt: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  korean: {
    bg: '#ef4444',
    text: '#ffffff',
    border: '#dc2626',
    light: '#fef2f2',
    badge: 'bg-red-500 text-white',
    badgeAlt: 'bg-red-50 text-red-700 border border-red-200',
  },
  other: {
    bg: '#6b7280',
    text: '#ffffff',
    border: '#4b5563',
    light: '#f9fafb',
    badge: 'bg-gray-500 text-white',
    badgeAlt: 'bg-gray-50 text-gray-700 border border-gray-200',
  },
};

// 과목 라벨
export const SUBJECT_LABELS: Record<SubjectType, string> = {
  math: '수학',
  english: '영어',
  science: '과학',
  korean: '국어',
  other: '기타',
};

// 과목 배지 컴포넌트용 헬퍼 함수
export const getSubjectBadgeClass = (subject: SubjectType, variant: 'default' | 'alt' = 'default'): string => {
  const colors = SUBJECT_COLORS[subject] || SUBJECT_COLORS.math;
  return variant === 'default' ? colors.badge : colors.badgeAlt;
};

// 과목 배경색 헬퍼 (카드용)
export const getSubjectLightBg = (subject: SubjectType): string => {
  return SUBJECT_COLORS[subject]?.light || SUBJECT_COLORS.math.light;
};

// Job Title Style Mapping
export const getJobTitleStyle = (title: string = '') => {
    if (title.includes('원장') || title.includes('대표')) return 'bg-amber-100 text-amber-700 border border-amber-200';
    if (title.includes('이사')) return 'bg-purple-100 text-purple-700 border border-purple-200';
    if (title.includes('부장')) return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
    if (title.includes('실장') || title.includes('팀장')) return 'bg-blue-100 text-blue-700 border border-blue-200';
    if (title.includes('대리')) return 'bg-green-100 text-green-700 border border-green-200';
    if (title.includes('강사')) return 'bg-pink-100 text-pink-700 border border-pink-200';
    return 'bg-gray-100 text-gray-600 border border-gray-200';
};
