// English Timetable Utilities
// 영어 시간표 상수 및 유틸리티

export const EN_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export const EN_PERIODS = [
    { id: '1', label: '1교시', time: '14:20~15:00' },
    { id: '2', label: '2교시', time: '15:00~15:40' },
    { id: '3', label: '3교시', time: '15:40~16:20' },
    { id: '4', label: '4교시', time: '16:20~17:00' },
    { id: '5', label: '5교시', time: '17:00~17:40' },
    { id: '6', label: '6교시', time: '17:40~18:20' },
    { id: '7', label: '7교시', time: '18:20~19:10' },
    { id: '8', label: '8교시', time: '19:10~20:00' },
    { id: '9', label: '9교시', time: '20:00~20:50' },
    { id: '10', label: '10교시', time: '20:50~21:40' },
] as const;

export const EN_COLLECTION = 'english_schedules';

export type EnglishPeriod = typeof EN_PERIODS[number];
export type EnglishWeekday = typeof EN_WEEKDAYS[number];

// 셀 키 생성 (강사-교시-요일)
export const getCellKey = (teacher: string, periodId: string, day: string): string => {
    return `${teacher}-${periodId}-${day}`;
};

// 셀 키 파싱
export const parseCellKey = (key: string): { teacher: string; periodId: string; day: string } | null => {
    const parts = key.split('-');
    if (parts.length !== 3) return null;
    return { teacher: parts[0], periodId: parts[1], day: parts[2] };
};

// 강사 색상 (기본값)
export const DEFAULT_TEACHER_COLORS: Record<string, { bg: string; text: string }> = {
    'Teacher1': { bg: '#3B82F6', text: '#ffffff' },
    'Teacher2': { bg: '#10B981', text: '#ffffff' },
    'Teacher3': { bg: '#F59E0B', text: '#ffffff' },
    'Teacher4': { bg: '#EF4444', text: '#ffffff' },
    'Teacher5': { bg: '#8B5CF6', text: '#ffffff' },
};

export const getTeacherColor = (
    teacherName: string,
    teachersData?: { name: string; bgColor?: string; textColor?: string }[]
): { bg: string; text: string } => {
    const teacher = teachersData?.find(t => t.name === teacherName);
    if (teacher?.bgColor) {
        return { bg: teacher.bgColor, text: teacher.textColor || '#ffffff' };
    }
    return DEFAULT_TEACHER_COLORS[teacherName] || { bg: '#6B7280', text: '#ffffff' };
};
