// Gantt Chart 공통 테마 및 레이아웃 상수
// Suggestion #8: 중복 색상 상수 제거 - GanttChart.tsx와 GanttBuilder.tsx에서 공유

/**
 * 네온 그라데이션 팔레트 (화살표 색상 포함)
 * GanttChart 및 GanttBuilder에서 작업 바 스타일링에 사용
 */
export const COLORS = [
    { bg: 'bg-gradient-to-r from-cyan-500 to-blue-500', shadow: 'shadow-cyan-500/50', glow: 'rgba(6, 182, 212, 0.4)', arrow: '#06b6d4' },
    { bg: 'bg-gradient-to-r from-orange-500 to-amber-500', shadow: 'shadow-orange-500/50', glow: 'rgba(249, 115, 22, 0.4)', arrow: '#f97316' },
    { bg: 'bg-gradient-to-r from-pink-500 to-rose-500', shadow: 'shadow-pink-500/50', glow: 'rgba(236, 72, 153, 0.4)', arrow: '#ec4899' },
    { bg: 'bg-gradient-to-r from-emerald-500 to-green-500', shadow: 'shadow-emerald-500/50', glow: 'rgba(16, 185, 129, 0.4)', arrow: '#10b981' },
    { bg: 'bg-gradient-to-r from-violet-500 to-purple-500', shadow: 'shadow-violet-500/50', glow: 'rgba(139, 92, 246, 0.4)', arrow: '#8b5cf6' },
    { bg: 'bg-gradient-to-r from-blue-600 to-indigo-600', shadow: 'shadow-blue-600/50', glow: 'rgba(59, 130, 246, 0.4)', arrow: '#3b82f6' },
] as const;

/**
 * GanttBuilder 태스크 리스트 색상 (간소화된 버전)
 */
export const BUILDER_TASK_COLORS = ['bg-cyan-500', 'bg-orange-500', 'bg-pink-500', 'bg-emerald-500', 'bg-purple-500'] as const;

/**
 * Critical Issue #1: 레이아웃 상수화 (매직 넘버 제거)
 * GanttChart.tsx Line 86-116의 하드코딩된 값들을 상수로 정의
 */
export const LAYOUT_CONSTANTS = {
    /** 타임라인 헤더 높이: pt-4(16px) + height(50px) + pb-2(8px) = 74px */
    TIMELINE_HEADER_HEIGHT: 74,

    /** 차트 컨테이너 왼쪽 패딩 (taskPositions 계산에 사용) */
    PADDING_LEFT: 40,

    /** 그룹 간 상단 여백 (mt-8 = 32px) */
    GROUP_TOP_MARGIN: 32,

    /** 그룹 헤더 높이: flex items-center gap-2 mb-4 (~24px height + 16px margin-bottom) */
    GROUP_HEADER_HEIGHT: 40,

    /** 작업 행 높이 */
    ROW_HEIGHT: 60,

    /** 작업 바 높이 */
    BAR_HEIGHT: 38,

    /** 타임라인 전체 헤더 높이 (타이틀 포함) */
    HEADER_HEIGHT: 70,
} as const;

/**
 * 의존성 화살표 레이아웃 상수
 * GanttChart.tsx Line 120-122
 */
export const ARROW_LAYOUT = {
    /** 왼쪽 수직 레인의 기본 X 좌표 */
    LANE_BASE_X: 25,

    /** 여러 레인 간 간격 */
    LANE_SPACING: 6,

    /** 동일 소스에서 나가는 화살표의 Y 오프셋 단계 */
    Y_OFFSET_STEP: 4,
} as const;

/**
 * 카테고리 설정 (GanttChart 및 GanttBuilder 공통)
 */
export const CATEGORY_CONFIG = {
    planning: { title: '기획', color: 'text-blue-400', bgColor: 'bg-blue-600', inactiveBgColor: 'bg-blue-900/40' },
    development: { title: '개발', color: 'text-purple-400', bgColor: 'bg-purple-600', inactiveBgColor: 'bg-purple-900/40' },
    testing: { title: '테스트', color: 'text-green-400', bgColor: 'bg-green-600', inactiveBgColor: 'bg-green-900/40' },
    other: { title: '기타', color: 'text-slate-400', bgColor: 'bg-slate-600', inactiveBgColor: 'bg-slate-700/60' }
} as const;

/**
 * 부서 설정 (GanttBuilder)
 */
export const DEPARTMENTS = [
    { id: 'math', label: '수학부', color: 'bg-cyan-500' },
    { id: 'english', label: '영어부', color: 'bg-orange-500' },
    { id: 'admin', label: '행정팀', color: 'bg-pink-500' },
    { id: 'facilities', label: '시설관리', color: 'bg-emerald-500' }
] as const;
