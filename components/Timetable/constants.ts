export const ALL_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

// ============================================
// 통일된 PERIODS (수학 8교시, 영어 10교시)
// periodId: "1" ~ "10"
// ============================================
export const UNIFIED_PERIODS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
export const MATH_UNIFIED_PERIODS = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const ENGLISH_UNIFIED_PERIODS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export interface PeriodInfo {
    id: string;
    label: string;
    time: string;
    startTime: string;
    endTime: string;
}

// 수학 교시 정보 (8교시, 55분 단위)
export const MATH_PERIOD_INFO: Record<string, PeriodInfo> = {
    '1': { id: '1', label: '1교시', time: '14:30~15:25', startTime: '14:30', endTime: '15:25' },
    '2': { id: '2', label: '2교시', time: '15:25~16:20', startTime: '15:25', endTime: '16:20' },
    '3': { id: '3', label: '3교시', time: '16:20~17:15', startTime: '16:20', endTime: '17:15' },
    '4': { id: '4', label: '4교시', time: '17:15~18:10', startTime: '17:15', endTime: '18:10' },
    '5': { id: '5', label: '5교시', time: '18:20~19:15', startTime: '18:20', endTime: '19:15' },
    '6': { id: '6', label: '6교시', time: '19:15~20:10', startTime: '19:15', endTime: '20:10' },
    '7': { id: '7', label: '7교시', time: '20:10~21:05', startTime: '20:10', endTime: '21:05' },
    '8': { id: '8', label: '8교시', time: '21:05~22:00', startTime: '21:05', endTime: '22:00' },
};

// 영어 교시 정보 (10교시, 40분 단위)
export const ENGLISH_PERIOD_INFO: Record<string, PeriodInfo> = {
    '1': { id: '1', label: '1교시', time: '14:20~15:00', startTime: '14:20', endTime: '15:00' },
    '2': { id: '2', label: '2교시', time: '15:00~15:40', startTime: '15:00', endTime: '15:40' },
    '3': { id: '3', label: '3교시', time: '15:40~16:20', startTime: '15:40', endTime: '16:20' },
    '4': { id: '4', label: '4교시', time: '16:20~17:00', startTime: '16:20', endTime: '17:00' },
    '5': { id: '5', label: '5교시', time: '17:00~17:40', startTime: '17:00', endTime: '17:40' },
    '6': { id: '6', label: '6교시', time: '17:40~18:20', startTime: '17:40', endTime: '18:20' },
    '7': { id: '7', label: '7교시', time: '18:20~19:15', startTime: '18:20', endTime: '19:15' },
    '8': { id: '8', label: '8교시', time: '19:15~20:10', startTime: '19:15', endTime: '20:10' },
    '9': { id: '9', label: '9교시', time: '20:10~21:05', startTime: '20:10', endTime: '21:05' },
    '10': { id: '10', label: '10교시', time: '21:05~22:00', startTime: '21:05', endTime: '22:00' },
};

// 기본 교시 정보 (수학 기준, 하위 호환용)
export const PERIOD_INFO: Record<string, PeriodInfo> = MATH_PERIOD_INFO;

// 주말 교시 정보 (9시부터 1시간 단위, 8교시)
// 레거시 키('1-1', '1-2' 등)도 호환성을 위해 포함
export const WEEKEND_PERIOD_INFO: Record<string, PeriodInfo> = {
    // 통일된 교시 ID
    '1': { id: '1', label: '1교시', time: '09:00~10:00', startTime: '09:00', endTime: '10:00' },
    '2': { id: '2', label: '2교시', time: '10:00~11:00', startTime: '10:00', endTime: '11:00' },
    '3': { id: '3', label: '3교시', time: '11:00~12:00', startTime: '11:00', endTime: '12:00' },
    '4': { id: '4', label: '4교시', time: '12:00~13:00', startTime: '12:00', endTime: '13:00' },
    '5': { id: '5', label: '5교시', time: '13:00~14:00', startTime: '13:00', endTime: '14:00' },
    '6': { id: '6', label: '6교시', time: '14:00~15:00', startTime: '14:00', endTime: '15:00' },
    '7': { id: '7', label: '7교시', time: '15:00~16:00', startTime: '15:00', endTime: '16:00' },
    '8': { id: '8', label: '8교시', time: '16:00~17:00', startTime: '16:00', endTime: '17:00' },
    // 레거시 교시 ID (수학 시간표 호환용)
    '1-1': { id: '1-1', label: '1교시', time: '09:00~10:00', startTime: '09:00', endTime: '10:00' },
    '1-2': { id: '1-2', label: '2교시', time: '10:00~11:00', startTime: '10:00', endTime: '11:00' },
    '2-1': { id: '2-1', label: '3교시', time: '11:00~12:00', startTime: '11:00', endTime: '12:00' },
    '2-2': { id: '2-2', label: '4교시', time: '12:00~13:00', startTime: '12:00', endTime: '13:00' },
    '3-1': { id: '3-1', label: '5교시', time: '13:00~14:00', startTime: '13:00', endTime: '14:00' },
    '3-2': { id: '3-2', label: '6교시', time: '14:00~15:00', startTime: '14:00', endTime: '15:00' },
    '4-1': { id: '4-1', label: '7교시', time: '15:00~16:00', startTime: '15:00', endTime: '16:00' },
    '4-2': { id: '4-2', label: '8교시', time: '16:00~17:00', startTime: '16:00', endTime: '17:00' },
};

// 주말용 교시 목록 (수학/영어 공용)
export const WEEKEND_UNIFIED_PERIODS = ['1', '2', '3', '4', '5', '6', '7', '8'];

// 주말용 레거시 교시 시간 (수학 시간표 호환용)
export const WEEKEND_PERIOD_TIMES: Record<string, string> = {
    '1-1': '09:00~10:00',
    '1-2': '10:00~11:00',
    '2-1': '11:00~12:00',
    '2-2': '12:00~13:00',
    '3-1': '13:00~14:00',
    '3-2': '14:00~15:00',
    '4-1': '15:00~16:00',
    '4-2': '16:00~17:00',
};

// periodId로 시간 정보 가져오기
export const getPeriodTime = (periodId: string, subject?: 'math' | 'english'): string => {
    const info = subject === 'english' ? ENGLISH_PERIOD_INFO : MATH_PERIOD_INFO;
    return info[periodId]?.time || '';
};

// periodId로 라벨 가져오기
export const getPeriodLabel = (periodId: string): string => {
    return PERIOD_INFO[periodId]?.label || `${periodId}교시`;
};

// 과목별 PeriodInfo 가져오기
export const getPeriodInfo = (periodId: string, subject?: 'math' | 'english'): PeriodInfo | undefined => {
    const info = subject === 'english' ? ENGLISH_PERIOD_INFO : MATH_PERIOD_INFO;
    return info[periodId];
};

// ============================================
// 레거시 상수 (기존 코드 호환용)
// ============================================
export const MATH_PERIODS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];

export const MATH_PERIOD_TIMES: Record<string, string> = {
    '1-1': '14:30~15:25',
    '1-2': '15:25~16:20',
    '2-1': '16:20~17:15',
    '2-2': '17:15~18:10',
    '3-1': '18:20~19:15',
    '3-2': '19:15~20:10',
    '4-1': '20:10~21:05',
    '4-2': '21:05~22:00',
};

// 레거시 periodId → 통일된 periodId 매핑 (모듈 레벨 상수로 한 번만 생성)
export const LEGACY_TO_UNIFIED_PERIOD_MAP: Record<string, string> = {
    '1-1': '1', '1-2': '2',
    '2-1': '3', '2-2': '4',
    '3-1': '5', '3-2': '6',
    '4-1': '7', '4-2': '8',
    // 이미 통일된 ID도 지원
    '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8',
};

// 레거시 periodId를 통일된 periodId로 변환
export const convertLegacyPeriodId = (legacyId: string): string => {
    return LEGACY_TO_UNIFIED_PERIOD_MAP[legacyId] || legacyId;
};

// 통일된 periodId를 레거시 periodId로 변환 (필요시)
export const convertToLegacyPeriodId = (unifiedId: string): string => {
    const mapping: Record<string, string> = {
        '1': '1-1', '2': '1-2',
        '3': '2-1', '4': '2-2',
        '5': '3-1', '6': '3-2',
        '7': '4-1', '8': '4-2',
    };
    return mapping[unifiedId] || unifiedId;
};

export const ENGLISH_PERIODS = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시', '8교시', '9교시', '10교시'];

// ============================================
// 스마트 스케줄 포맷팅
// 수학: "월 7, 월 8, 목 7, 목 8" → "월목 4교시" (2타임 = 1교시)
// 영어: "월 1, 월 2, 목 1, 목 2" → "월목 1~2교시" (개별 교시)
// ============================================

// 수학 교시 그룹 정의 (1+2=1교시, 3+4=2교시, 5+6=3교시, 7+8=4교시)
export const MATH_PERIOD_GROUPS: Record<string, { group: number; position: 'first' | 'second' }> = {
    '1': { group: 1, position: 'first' },
    '2': { group: 1, position: 'second' },
    '3': { group: 2, position: 'first' },
    '4': { group: 2, position: 'second' },
    '5': { group: 3, position: 'first' },
    '6': { group: 3, position: 'second' },
    '7': { group: 4, position: 'first' },
    '8': { group: 4, position: 'second' },
};

// 하위 호환용
export const PERIOD_GROUPS = MATH_PERIOD_GROUPS;

// 수학 교시 그룹별 시간대
export const MATH_GROUP_TIMES: Record<number, string> = {
    1: '14:30~16:20',
    2: '16:20~18:10',
    3: '18:20~20:10',
    4: '20:10~22:00',
};

// 하위 호환용
export const GROUP_TIMES = MATH_GROUP_TIMES;

interface ScheduleSlotParsed {
    day: string;
    periodId: string;
    group: number;
    position: 'first' | 'second';
}

export type SubjectForSchedule = 'math' | 'english';

/**
 * 스케줄 배열을 스마트하게 포맷팅
 *
 * 수학 규칙:
 * 1. 요일별로 periodId가 완전한 교시 단위(1+2, 3+4, 5+6, 7+8)로만 구성되면 "교시"로 표시
 * 2. 그렇지 않으면 시간대로 표시
 * 3. 같은 패턴의 요일끼리 합침 (월, 목 → 월목)
 *
 * 영어 규칙:
 * 1. 연속된 교시는 범위로 표시 (1, 2, 3 → 1~3교시)
 * 2. 같은 패턴의 요일끼리 합침
 *
 * @param schedule - ["월 7", "월 8", "목 7", "목 8"] 형태의 배열
 * @param subject - 'math' | 'english' (기본값: 'math')
 * @returns "월목 4교시" 또는 "월목 20:10~22:00" 형태의 문자열
 */
export const formatScheduleCompact = (
    schedule: string[],
    subject: SubjectForSchedule = 'math',
    showTime: boolean = false
): string => {
    if (!schedule || schedule.length === 0) return '시간 미정';

    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
    const weekdayPeriodInfo = subject === 'english' ? ENGLISH_PERIOD_INFO : MATH_PERIOD_INFO;

    // 요일에 따라 적절한 period info 선택
    const getPeriodInfoForDay = (day: string) => {
        if (day === '토' || day === '일') {
            return WEEKEND_PERIOD_INFO;
        }
        return weekdayPeriodInfo;
    };

    // 요일별로 periodId 수집
    const dayPeriods: Map<string, string[]> = new Map();

    for (const item of schedule) {
        const parts = item.split(' ');
        const day = parts[0];
        const periodId = parts[1] || '';
        const periodInfo = getPeriodInfoForDay(day);
        if (!periodId || !periodInfo[periodId]) continue;

        if (!dayPeriods.has(day)) {
            dayPeriods.set(day, []);
        }
        dayPeriods.get(day)!.push(periodId);
    }

    if (dayPeriods.size === 0) return '시간 미정';

    // 요일별로 라벨 생성
    const dayLabels: Map<string, string> = new Map();

    for (const [day, periods] of dayPeriods) {
        const sortedPeriods = periods.sort((a, b) => Number(a) - Number(b));
        const isWeekend = day === '토' || day === '일';

        // 주말은 시간 표시, 평일은 기존 로직
        let label: string;
        if (isWeekend) {
            label = formatWeekendPeriodsToLabel(sortedPeriods, showTime);
        } else if (subject === 'english') {
            label = formatEnglishPeriodsToLabel(sortedPeriods, showTime);
        } else {
            label = formatMathPeriodsToLabel(sortedPeriods, showTime);
        }
        dayLabels.set(day, label);
    }

    // 같은 라벨을 가진 요일끼리 그룹화
    const labelToDays: Map<string, string[]> = new Map();

    for (const [day, label] of dayLabels) {
        if (!labelToDays.has(label)) {
            labelToDays.set(label, []);
        }
        labelToDays.get(label)!.push(day);
    }

    // 결과 생성
    const results: string[] = [];

    for (const [label, days] of labelToDays) {
        days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
        const daysStr = days.join('');
        results.push(`${daysStr} ${label}`);
    }

    // 요일 순서대로 정렬
    results.sort((a, b) => {
        const dayA = a[0];
        const dayB = b[0];
        return dayOrder.indexOf(dayA) - dayOrder.indexOf(dayB);
    });

    return results.length > 0 ? results.join(' / ') : '시간 미정';
};

/**
 * 수학 periodId 배열을 라벨로 변환
 * - 완전한 교시 단위(1+2, 3+4, 5+6, 7+8)면 "4교시" 형태
 * - 아니면 시간대 범위로 표시
 */
function formatMathPeriodsToLabel(periods: string[], showTime: boolean): string {
    const completeGroups: number[] = [];
    const usedPeriods = new Set<string>();

    for (let group = 1; group <= 4; group++) {
        const first = String(group * 2 - 1);
        const second = String(group * 2);

        if (periods.includes(first) && periods.includes(second)) {
            completeGroups.push(group);
            usedPeriods.add(first);
            usedPeriods.add(second);
        }
    }

    const allPeriodsUsed = periods.every(p => usedPeriods.has(p));

    if (allPeriodsUsed && completeGroups.length > 0) {
        if (showTime) {
            return completeGroups.map(g => MATH_GROUP_TIMES[g]).join(', ');
        } else {
            return completeGroups.map(g => `${g}교시`).join(', ');
        }
    } else {
        const times = periods.map(p => MATH_PERIOD_INFO[p]).filter(Boolean);
        if (times.length === 0) return '시간 미정';

        const startTime = times[0].startTime;
        const endTime = times[times.length - 1].endTime;
        return `${startTime}~${endTime}`;
    }
}

/**
 * 주말 periodId 배열을 라벨로 변환
 * - 9:00부터 1시간 단위 (1=09:00~10:00, 2=10:00~11:00, ...)
 * - 주말은 시간 범위로 표시 (09:00~12:00)
 */
function formatWeekendPeriodsToLabel(periods: string[], showTime: boolean): string {
    if (periods.length === 0) return '시간 미정';

    // 시간순으로 정렬하기 위해 PeriodInfo 기준으로 정렬
    const times = periods
        .map(p => WEEKEND_PERIOD_INFO[p])
        .filter(Boolean)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (times.length === 0) return '시간 미정';

    const startTime = times[0].startTime;
    const endTime = times[times.length - 1].endTime;

    // 주말은 항상 시간 형식으로만 표시 (09:00~12:00)
    return `${startTime}~${endTime}`;
}

/**
 * 영어 periodId 배열을 라벨로 변환
 * - 연속된 교시는 범위로 표시 (1, 2, 3 → 1~3교시)
 * - 단일 교시면 그냥 "5교시"
 */
function formatEnglishPeriodsToLabel(periods: string[], showTime: boolean): string {
    if (periods.length === 0) return '시간 미정';

    const times = periods.map(p => ENGLISH_PERIOD_INFO[p]).filter(Boolean);
    if (times.length === 0) return '시간 미정';

    if (showTime) {
        const startTime = times[0].startTime;
        const endTime = times[times.length - 1].endTime;
        return `${startTime}~${endTime}`;
    }

    // 연속된 교시 범위로 표시
    const nums = periods.map(Number).sort((a, b) => a - b);

    if (nums.length === 1) {
        return `${nums[0]}교시`;
    }

    // 연속 여부 확인
    const isConsecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);

    if (isConsecutive) {
        return `${nums[0]}~${nums[nums.length - 1]}교시`;
    } else {
        // 비연속이면 쉼표로 나열
        return nums.map(n => `${n}교시`).join(', ');
    }
}

/**
 * 스케줄을 상세 시간으로 포맷팅 (기존 방식)
 * @param schedule - ["월 7", "월 8"] 형태의 배열
 * @param subject - 'math' | 'english' (기본값: 'math')
 * @returns "월 20:10~21:05, 월 21:05~22:00" 형태의 문자열
 */
export const formatScheduleDetailed = (
    schedule: string[],
    subject: SubjectForSchedule = 'math'
): string => {
    if (!schedule || schedule.length === 0) return '시간 미정';

    return schedule.map(item => {
        const parts = item.split(' ');
        if (parts.length >= 2) {
            const day = parts[0];
            const periodId = parts[1];
            const time = getPeriodTime(periodId, subject);
            return time ? `${day} ${time}` : item;
        }
        return item;
    }).join(', ');
};
