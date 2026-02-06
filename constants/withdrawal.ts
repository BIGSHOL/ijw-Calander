// 퇴원 사유 옵션 (공유 상수)
export const WITHDRAWAL_REASONS = [
  { value: '', label: '전체' },
  { value: 'graduation', label: '졸업' },
  { value: 'relocation', label: '이사' },
  { value: 'competitor', label: '경쟁 학원 이동' },
  { value: 'financial', label: '경제적 사유' },
  { value: 'schedule', label: '시간 조절 어려움' },
  { value: 'dissatisfied', label: '불만족' },
  { value: 'other', label: '기타' },
] as const;

export type WithdrawalReasonValue = typeof WITHDRAWAL_REASONS[number]['value'];

// 퇴원 사유 라벨 맵 (빠른 룩업용)
export const WITHDRAWAL_REASON_LABEL: Record<string, string> = Object.fromEntries(
  WITHDRAWAL_REASONS.filter(r => r.value !== '').map(r => [r.value, r.label])
);

// 과목 필터 옵션
export const SUBJECT_OPTIONS = [
  { value: '', label: '전체 과목' },
  { value: 'math', label: '수학' },
  { value: 'english', label: '영어' },
  { value: 'korean', label: '국어' },
  { value: 'science', label: '과학' },
  { value: 'other', label: '기타' },
] as const;

// 정렬 옵션
export const SORT_OPTIONS = [
  { value: 'withdrawalDate', label: '종료일순' },
  { value: 'name', label: '이름순' },
] as const;

export type WithdrawalSortBy = typeof SORT_OPTIONS[number]['value'];

// 항목 유형 (퇴원 vs 수강종료)
export type WithdrawalEntryType = 'withdrawn' | 'subject-ended';

export const ENTRY_TYPE_OPTIONS = [
  { value: '', label: '전체 유형' },
  { value: 'withdrawn', label: '퇴원' },
  { value: 'subject-ended', label: '수강종료' },
] as const;

export const ENTRY_TYPE_LABEL: Record<WithdrawalEntryType, string> = {
  withdrawn: '퇴원',
  'subject-ended': '수강종료',
};

// 과목 라벨 맵 (공유)
export const SUBJECT_LABEL: Record<string, string> = {
  math: '수학',
  english: '영어',
  korean: '국어',
  science: '과학',
  other: '기타',
};

// 과목 뱃지 컬러 (공유)
export const SUBJECT_COLOR: Record<string, string> = {
  math: 'bg-blue-100 text-blue-700',
  english: 'bg-green-100 text-green-700',
  korean: 'bg-purple-100 text-purple-700',
  science: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
};

// 퇴원 사유별 뱃지 컬러
export const WITHDRAWAL_REASON_COLOR: Record<string, string> = {
  graduation: 'bg-teal-100 text-teal-700 border border-teal-200',      // 졸업 - 긍정적
  relocation: 'bg-violet-100 text-violet-700 border border-violet-200', // 이사 - 중립
  competitor: 'bg-rose-100 text-rose-700 border border-rose-200',       // 경쟁 학원 - 주의
  financial: 'bg-slate-100 text-slate-600 border border-slate-200',     // 경제적 - 중립
  schedule: 'bg-amber-100 text-amber-700 border border-amber-200',      // 시간 조절 - 중립
  dissatisfied: 'bg-red-100 text-red-700 border border-red-200',        // 불만족 - 경고
  other: 'bg-gray-100 text-gray-600 border border-gray-200',            // 기타 - 중립
};
