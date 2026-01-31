/**
 * 간트차트 설정 파일
 * P2 개선: 하드코딩된 값들을 중앙 관리
 */

import { parseISO, addDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 태스크 바 색상 팔레트 (Neon Gradient Palette with Glow)
export const GANTT_TASK_COLORS = [
    { bg: 'bg-gradient-to-r from-cyan-500 to-blue-500', shadow: 'shadow-cyan-500/50', glow: 'rgba(6, 182, 212, 0.4)', arrow: '#06b6d4' },
    { bg: 'bg-gradient-to-r from-orange-500 to-amber-500', shadow: 'shadow-orange-500/50', glow: 'rgba(249, 115, 22, 0.4)', arrow: '#f97316' },
    { bg: 'bg-gradient-to-r from-pink-500 to-rose-500', shadow: 'shadow-pink-500/50', glow: 'rgba(236, 72, 153, 0.4)', arrow: '#ec4899' },
    { bg: 'bg-gradient-to-r from-emerald-500 to-green-500', shadow: 'shadow-emerald-500/50', glow: 'rgba(16, 185, 129, 0.4)', arrow: '#10b981' },
    { bg: 'bg-gradient-to-r from-violet-500 to-purple-500', shadow: 'shadow-violet-500/50', glow: 'rgba(139, 92, 246, 0.4)', arrow: '#8b5cf6' },
    { bg: 'bg-gradient-to-r from-blue-600 to-indigo-600', shadow: 'shadow-blue-600/50', glow: 'rgba(59, 130, 246, 0.4)', arrow: '#3b82f6' },
];

// 기본 카테고리 (Firebase 비어있을 때 폴백)
export const DEFAULT_GANTT_CATEGORIES = [
    { id: 'planning', label: '기획', backgroundColor: '#dbeafe', textColor: '#1d4ed8' }, // blue-100, blue-700
    { id: 'development', label: '개발', backgroundColor: '#f3e8ff', textColor: '#7e22ce' }, // purple-100, purple-700
    { id: 'testing', label: '테스트', backgroundColor: '#d1fae5', textColor: '#047857' }, // emerald-100, emerald-700
    { id: 'other', label: '기타', backgroundColor: '#f3f4f6', textColor: '#374151' } // gray-100, gray-700
];

// 의존성 화살표 설정
export const GANTT_DEPENDENCY_CONFIG = {
    LANE_BASE_X: 25,      // 수직 레인 기본 X 위치
    LANE_SPACING: 6,      // 레인 간 간격
    Y_OFFSET_STEP: 4,     // 같은 소스의 화살표 Y 오프셋
};

// 타임라인 설정
export const GANTT_TIMELINE_CONFIG = {
    DEFAULT_DAY_WIDTH: 50,
    MIN_DAY_WIDTH: 30,
    MAX_DAY_WIDTH: 100,
    ROW_HEIGHT: 60,
    HEADER_HEIGHT: 70,
    BAR_HEIGHT: 42,
};

// 날짜 포맷 유틸리티
export const formatTaskDate = (offset: number, startDate: string | undefined): string => {
    if (!startDate) return `Day ${offset}`;
    try {
        const baseDate = parseISO(startDate);
        const taskDate = addDays(baseDate, offset);
        return format(taskDate, 'M월 d일', { locale: ko });
    } catch {
        return `Day ${offset}`;
    }
};
