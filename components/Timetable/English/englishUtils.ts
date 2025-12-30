// English Timetable Utilities
// 영어 시간표 상수 및 유틸리티

import { EnglishLevel, ParsedClassName } from '../../../types';

export const EN_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export const EN_PERIODS = [
    { id: '1', label: '1교시', time: '14:20~15:00' },
    { id: '2', label: '2교시', time: '15:00~15:40' },
    { id: '3', label: '3교시', time: '15:40~16:20' },
    { id: '4', label: '4교시', time: '16:20~17:00' },
    { id: '5', label: '5교시', time: '17:00~17:40' },
    { id: '6', label: '6교시', time: '17:40~18:20' },
    { id: '7', label: '7교시', time: '18:20~19:15' },
    { id: '8', label: '8교시', time: '19:15~20:10' },
    { id: '9', label: '9교시', time: '20:10~21:05' },
    { id: '10', label: '10교시', time: '21:05~22:00' },
] as const;

// 인재원 수업용 시간대 (50분 단위, 쉬는시간 포함)
export const INJAE_PERIODS = [
    { id: '1', label: '1교시', time: '14:20~15:00' },
    { id: '2', label: '2교시', time: '15:00~15:40' },
    { id: '3', label: '3교시', time: '15:40~16:20' },
    { id: '4', label: '4교시', time: '16:20~17:15' },  // 인재원: 55분
    { id: '5', label: '5교시', time: '17:15~18:10' },  // 인재원: 55분
    // 6교시 제거 (18:10~18:20 쉬는시간)
    { id: '7', label: '7교시', time: '18:20~19:15' },
    { id: '8', label: '8교시', time: '19:15~20:10' },
    { id: '9', label: '9교시', time: '20:10~21:05' },
    { id: '10', label: '10교시', time: '21:05~22:00' },
] as const;

// 인재원 수업 판별 (수업명에 'E_' 포함)
export const isInjaeClass = (className: string): boolean => {
    return className?.includes('E_') || false;
};

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

// 기본 영어 레벨 데이터
export const DEFAULT_ENGLISH_LEVELS = [
    { id: 'dp', abbreviation: 'DP', fullName: 'Dr. Phonics', order: 0 },
    { id: 'pl', abbreviation: 'PL', fullName: "Pre Let's", order: 1 },
    { id: 'rtt', abbreviation: 'RTT', fullName: 'Ready To Talk', order: 2 },
    { id: 'lt', abbreviation: 'LT', fullName: "Let's Talk", order: 3 },
    { id: 'rts', abbreviation: 'RTS', fullName: 'Ready To Speak', order: 4 },
    { id: 'ls', abbreviation: 'LS', fullName: "Let's Speak", order: 5 },
    { id: 'le', abbreviation: 'LE', fullName: "Let's Express", order: 6 },
    { id: 'kw', abbreviation: 'KW', fullName: 'Kopi Wang', order: 7 },
    { id: 'pj', abbreviation: 'PJ', fullName: 'Pre Junior', order: 8 },
    { id: 'jp', abbreviation: 'JP', fullName: 'Junior Plus', order: 9 },
    { id: 'sp', abbreviation: 'SP', fullName: 'Senior Plus', order: 10 },
    { id: 'mec', abbreviation: 'MEC', fullName: 'Middle School English Course', order: 11 }
];

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

// 배경색 밝기에 따른 대비 색상 계산
export const getContrastColor = (hexColor: string | undefined): string => {
    if (!hexColor || !hexColor.startsWith('#')) return '#374151'; // 기본: 어두운 회색

    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // 밝기 계산 (ITU-R BT.709)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // 밝으면 어두운 글씨, 어두우면 밝은 글씨
    return luminance > 0.55 ? '#374151' : '#ffffff';
};

// ============ LEVEL UP UTILITIES ============

/**
 * Parse class name into components
 * @example parseClassName("DP3") → { levelAbbr: "DP", number: 3, suffix: "" }
 * @example parseClassName("RTT6a") → { levelAbbr: "RTT", number: 6, suffix: "a" }
 */
export const parseClassName = (name: string): ParsedClassName | null => {
    if (!name) return null;

    // Match: 1+ uppercase letters, 1+ digits, optional single lowercase letter
    const regex = /^([A-Z]+)(\d+)([a-z]?)$/;
    const match = name.match(regex);

    if (!match) return null;

    return {
        levelAbbr: match[1],
        number: parseInt(match[2], 10),
        suffix: match[3] || ''
    };
};

/**
 * Build class name from parsed components
 * @example buildClassName({ levelAbbr: "DP", number: 4, suffix: "" }) → "DP4"
 */
export const buildClassName = (parsed: ParsedClassName): string => {
    return `${parsed.levelAbbr}${parsed.number}${parsed.suffix}`;
};

/**
 * Number Level Up: DP3 → DP4 (increment number, preserve suffix)
 */
export const numberLevelUp = (className: string): string | null => {
    const parsed = parseClassName(className);
    if (!parsed) return null;

    return buildClassName({
        ...parsed,
        number: parsed.number + 1
    });
};

/**
 * Class Level Up: DP3 → PL1 (move to next level, reset number to 1, preserve suffix)
 * @returns null if already at max level (MEC) or invalid class
 */
export const classLevelUp = (className: string, levelOrder: EnglishLevel[]): string | null => {
    const parsed = parseClassName(className);
    if (!parsed) return null;

    // Find current level index
    const currentIndex = levelOrder.findIndex(
        lvl => lvl.abbreviation.toUpperCase() === parsed.levelAbbr.toUpperCase()
    );

    // If not found or last level, return null
    if (currentIndex === -1 || currentIndex >= levelOrder.length - 1) {
        return null;
    }

    const nextLevel = levelOrder[currentIndex + 1];

    return buildClassName({
        levelAbbr: nextLevel.abbreviation,
        number: 1,
        suffix: parsed.suffix
    });
};

/**
 * Check if class is at maximum level (MEC by default)
 */
export const isMaxLevel = (className: string, levelOrder: EnglishLevel[]): boolean => {
    const parsed = parseClassName(className);
    if (!parsed) return false;

    const currentIndex = levelOrder.findIndex(
        lvl => lvl.abbreviation.toUpperCase() === parsed.levelAbbr.toUpperCase()
    );

    return currentIndex === levelOrder.length - 1;
};

/**
 * Check if class name is in the level settings
 * Returns true if the class level abbreviation is found in the level order
 */
export const isValidLevel = (className: string, levelOrder: EnglishLevel[]): boolean => {
    const parsed = parseClassName(className);
    if (!parsed) return false;

    const levelExists = levelOrder.some(
        lvl => lvl.abbreviation.toUpperCase() === parsed.levelAbbr.toUpperCase()
    );

    return levelExists;
};
