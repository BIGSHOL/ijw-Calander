import { SubjectType } from '../../types';

// 강의실 탭 전용 과목 색상 (수학=파랑, 영어=빨강, 과학=초록, 국어=보라)
export const CLASSROOM_COLORS: Record<SubjectType, {
  bg: string;
  border: string;
  light: string;
}> = {
  math: {
    bg: '#2563eb',       // blue-600
    border: '#93c5fd',   // blue-300
    light: '#eff6ff',    // blue-50
  },
  english: {
    bg: '#dc2626',       // red-600
    border: '#fca5a5',   // red-300
    light: '#fef2f2',    // red-50
  },
  science: {
    bg: '#059669',       // emerald-600
    border: '#6ee7b7',   // emerald-300
    light: '#ecfdf5',    // emerald-50
  },
  korean: {
    bg: '#7c3aed',       // violet-600
    border: '#c4b5fd',   // violet-300
    light: '#f5f3ff',    // violet-50
  },
  other: {
    bg: '#4b5563',       // gray-600
    border: '#d1d5db',   // gray-300
    light: '#f9fafb',    // gray-50
  },
};
