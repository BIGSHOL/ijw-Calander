import { useMemo } from 'react';
import { TimetableClass, Teacher } from '../../../../types';
import { MathIntegrationSettings } from './useMathSettings';
import { MATH_PERIOD_INFO, WEEKEND_PERIOD_INFO } from '../../constants';

// 수학 통합뷰용 교시 정보
export interface MathPeriodInfo {
    id: string;
    label: string;
    time: string;
}

// 수학 통합뷰용 스케줄 셀
export interface MathScheduleCell {
    className?: string;
    classId?: string;
    room?: string;
    teacher?: string;
}

// 수학 통합뷰용 클래스 정보
export interface MathClassInfo {
    name: string;
    classId: string;
    mainTeacher: string;
    mainRoom: string;
    startPeriod: number;  // 시작 교시 (1~8)
    scheduleMap: Record<string, Record<string, MathScheduleCell>>;  // periodId -> day -> cell
    visiblePeriods: MathPeriodInfo[];  // 표시할 교시 목록
    finalDays: string[];  // 수업이 있는 요일 목록
    roomByDay: Record<string, string>;  // 요일별 강의실
    roomBySlot: Record<string, string>;  // 교시-요일별 강의실 (key: "periodId-day")
    teacherCounts: Record<string, number>;  // 강사별 수업 횟수
    schedule: string[];  // 원본 스케줄 배열
    isWeekendOnly: boolean;  // 주말 전용 수업 여부
}

const DAYS_ORDER = ['월', '화', '수', '목', '금', '토', '일'];
const MATH_PERIODS_UNIFIED = ['1', '2', '3', '4', '5', '6', '7', '8'];

/**
 * useMathIntegrationClasses - 수학 수업 목록을 통합뷰용 형태로 변환
 *
 * @param classes - useTimetableClasses에서 가져온 수학 수업 목록
 * @param settings - 수학 통합뷰 설정
 * @param teachersData - 강사 데이터 (색상 등)
 */
export const useMathIntegrationClasses = (
    classes: TimetableClass[],
    settings: MathIntegrationSettings,
    teachersData: Teacher[] = []
): MathClassInfo[] => {
    return useMemo(() => {
        // 수학 수업만 필터링 (subject가 'math' 또는 '수학')
        const mathClasses = classes.filter(c => c.subject === 'math' || c.subject === '수학');

        return mathClasses.map(cls => {
            const scheduleMap: Record<string, Record<string, MathScheduleCell>> = {};
            const roomByDay: Record<string, string> = {};
            const roomBySlot: Record<string, string> = {};
            const teacherCounts: Record<string, number> = {};
            const daysWithClass = new Set<string>();
            let minPeriod = 99;
            let hasWeekday = false;
            let hasWeekend = false;

            // 스케줄 파싱 (형식: "월 1-1" 또는 "월 1" 또는 { day: "월", periodId: "1-1" })
            // legacySchedule이 있으면 먼저 사용 (문자열 배열)
            const scheduleArray = (cls as any).legacySchedule || cls.schedule || [];
            scheduleArray.forEach((slot: any) => {
                let day: string;
                let periodPart: string;

                // 객체 형식 처리: { day: "월", periodId: "1-1" }
                if (typeof slot === 'object' && slot !== null) {
                    day = slot.day;
                    periodPart = slot.periodId || slot.period || '';
                } else if (typeof slot === 'string') {
                    // 문자열 형식 처리: "월 1-1"
                    const parts = slot.trim().split(/\s+/);
                    if (parts.length < 2) return;
                    day = parts[0];
                    periodPart = parts[1];
                } else {
                    return; // 알 수 없는 형식 스킵
                }

                if (!day || !periodPart) return;

                // 주말/평일 감지
                if (day === '토' || day === '일') {
                    hasWeekend = true;
                } else {
                    hasWeekday = true;
                }

                // 레거시 형식 (1-1) -> 통일 형식 (1) 변환
                let periodId = periodPart;
                if (periodPart.includes('-')) {
                    // 레거시 형식: "1-1" -> "1", "1-2" -> "2"
                    const legacyMap: Record<string, string> = {
                        '1-1': '1', '1-2': '2',
                        '2-1': '3', '2-2': '4',
                        '3-1': '5', '3-2': '6',
                        '4-1': '7', '4-2': '8',
                    };
                    periodId = legacyMap[periodPart] || periodPart;
                }

                const periodNum = parseInt(periodId);
                if (isNaN(periodNum)) return;

                daysWithClass.add(day);
                if (periodNum < minPeriod) minPeriod = periodNum;

                // scheduleMap 구성
                if (!scheduleMap[periodId]) scheduleMap[periodId] = {};

                // slotTeachers, slotRooms에서 해당 슬롯의 정보 가져오기
                const slotKey = `${day}-${periodId}`;
                const slotTeacher = cls.slotTeachers?.[slotKey] || cls.teacher;
                const slotRoom = cls.slotRooms?.[slotKey] || cls.room;

                scheduleMap[periodId][day] = {
                    className: cls.className,
                    classId: cls.id,
                    teacher: slotTeacher,
                    room: slotRoom,
                };

                // 강사별 수업 횟수 카운트
                if (slotTeacher) {
                    teacherCounts[slotTeacher] = (teacherCounts[slotTeacher] || 0) + 1;
                }

                // 요일별 강의실 추적
                if (slotRoom && !roomByDay[day]) {
                    roomByDay[day] = slotRoom;
                }

                // 교시-요일별 강의실 추적
                roomBySlot[`${periodId}-${day}`] = slotRoom || '';
            });

            // 주말 전용 수업 여부 판단
            const isWeekendOnly = hasWeekend && !hasWeekday;

            // 표시할 요일 정렬
            const finalDays = Array.from(daysWithClass).sort(
                (a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b)
            );

            // 표시할 교시 범위 결정 (최소 4교시 윈도우)
            const startPeriod = minPeriod === 99 ? 1 : minPeriod;
            const maxPeriod = Math.max(
                ...Object.keys(scheduleMap).map(p => parseInt(p)).filter(n => !isNaN(n)),
                startPeriod + 3  // 최소 4교시
            );

            // 주말 전용 수업은 WEEKEND_PERIOD_INFO 사용
            const periodInfoSource = isWeekendOnly ? WEEKEND_PERIOD_INFO : MATH_PERIOD_INFO;

            const visiblePeriods: MathPeriodInfo[] = [];
            for (let i = startPeriod; i <= Math.min(maxPeriod, 8); i++) {
                const periodInfo = periodInfoSource[String(i)];
                if (periodInfo) {
                    visiblePeriods.push({
                        id: String(i),
                        label: periodInfo.label,
                        time: periodInfo.time,
                    });
                }
            }

            return {
                name: cls.className,
                classId: cls.id,
                mainTeacher: cls.teacher || '',
                mainRoom: cls.room || '',
                startPeriod,
                scheduleMap,
                visiblePeriods,
                finalDays,
                roomByDay,
                roomBySlot,
                teacherCounts,
                schedule: cls.schedule || [],
                isWeekendOnly,
            };
        }).sort((a, b) => {
            // 주말 전용 수업은 뒤로
            if (a.isWeekendOnly !== b.isWeekendOnly) {
                return a.isWeekendOnly ? 1 : -1;
            }
            // 시작 교시 순으로 정렬, 같으면 이름순
            if (a.startPeriod !== b.startPeriod) {
                return a.startPeriod - b.startPeriod;
            }
            return (a.name || '').localeCompare(b.name || '', 'ko');
        });
    }, [classes, settings, teachersData]);
};

/**
 * 강의실 포맷팅 유틸리티
 * roomBySlot: { "1-월": "301", "2-월": "301", "2-목": "202" }
 * => "월 301 / 목 202"
 */
export const formatMathRoomBySlot = (roomBySlot: Record<string, string>): string => {
    if (!roomBySlot || Object.keys(roomBySlot).length === 0) return '';

    // 요일별로 강의실 목록 수집
    const roomsByDay: Record<string, string[]> = {};
    Object.entries(roomBySlot).forEach(([slotKey, room]) => {
        if (!room) return;
        const [periodId, day] = slotKey.split('-');
        if (!roomsByDay[day]) roomsByDay[day] = [];
        if (!roomsByDay[day].includes(room)) {
            roomsByDay[day].push(room);
        }
    });

    // 강의실 패턴별로 요일 그룹화
    const patternToDays: Record<string, string[]> = {};
    Object.entries(roomsByDay).forEach(([day, rooms]) => {
        const pattern = rooms.join('-');
        if (!patternToDays[pattern]) patternToDays[pattern] = [];
        patternToDays[pattern].push(day);
    });

    // 정렬 및 포맷팅
    const parts = Object.entries(patternToDays)
        .map(([pattern, days]) => {
            const sortedDays = days.sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));
            return `${sortedDays.join('')} ${pattern}`;
        })
        .sort((a, b) => {
            const aFirstDay = a.split(' ')[0][0];
            const bFirstDay = b.split(' ')[0][0];
            return DAYS_ORDER.indexOf(aFirstDay) - DAYS_ORDER.indexOf(bFirstDay);
        });

    return parts.join(' / ');
};
