import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  addDays,
  parseISO,
  isWithinInterval,
  getWeeksInMonth
} from 'date-fns';

/**
 * 한국 시간(KST, UTC+9) 기준 유틸리티 함수들
 * - new Date().toISOString()은 UTC 기준이므로 한국 시간과 최대 9시간 차이 발생
 * - 오전 9시 이전에 날짜를 생성하면 전날로 표시되는 문제 해결
 */

/**
 * 한국 시간 기준 오늘 날짜를 'YYYY-MM-DD' 형식으로 반환
 */
export const getTodayKST = (): string => {
  const now = new Date();
  // 한국 시간대로 변환 (UTC+9)
  const kstOffset = 9 * 60; // 분 단위
  const utcOffset = now.getTimezoneOffset(); // 현지 시간대의 UTC 오프셋 (분)
  const kstTime = new Date(now.getTime() + (utcOffset + kstOffset) * 60 * 1000);

  return format(kstTime, 'yyyy-MM-dd');
};

/**
 * 한국 시간 기준 현재 Date 객체 반환
 */
export const getNowKST = (): Date => {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (utcOffset + kstOffset) * 60 * 1000);
};

/**
 * Date 객체를 한국 시간 기준 'YYYY-MM-DD' 형식으로 변환
 */
export const formatDateKST = (date: Date): string => {
  const kstOffset = 9 * 60;
  const utcOffset = date.getTimezoneOffset();
  const kstTime = new Date(date.getTime() + (utcOffset + kstOffset) * 60 * 1000);

  return format(kstTime, 'yyyy-MM-dd');
};

/**
 * 한국 시간 기준 이번 달의 시작일과 종료일 반환
 */
export const getMonthRangeKST = (date?: Date): { start: string; end: string } => {
  const target = date ? new Date(date) : getNowKST();
  const start = new Date(target.getFullYear(), target.getMonth(), 1);
  const end = new Date(target.getFullYear(), target.getMonth() + 1, 0);

  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
};

/**
 * 한국 시간 기준 이번 주의 시작일과 종료일 반환 (일요일 시작)
 */
export const getWeekRangeKST = (date?: Date): { start: string; end: string } => {
  const target = date ? new Date(date) : getNowKST();
  const dayOfWeek = target.getDay();

  const start = new Date(target);
  start.setDate(target.getDate() - dayOfWeek);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
};

export const getMonthWeeks = (currentDate: Date) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  
  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }
  return weeks;
};

export const formatDateKey = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const getEventsForCell = (
  events: any[],
  date: Date,
  deptId: string
) => {
  return events.filter(e => {
    if (e.departmentId !== deptId) return false;

    // Null/undefined 체크
    if (!e.startDate || !e.endDate) return false;

    try {
      const start = parseISO(e.startDate);
      const end = parseISO(e.endDate);

      // Invalid Date 체크
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn('Invalid date format in event:', e);
        return false;
      }

      return isWithinInterval(date, { start, end });
    } catch (error) {
      console.warn('Error parsing event dates:', e, error);
      return false;
    }
  });
};

export const getEventPositionInWeek = (
  event: any,
  weekStart: Date,
  weekEnd: Date
) => {
  // Null/undefined 체크
  if (!event.startDate || !event.endDate) {
    console.warn('Event missing date fields:', event);
    return {
      colStart: 2,
      colSpan: 1,
      isStart: false,
      isEnd: false
    };
  }

  try {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);

    // Invalid Date 체크
    if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
      console.warn('Invalid date format in event:', event);
      return {
        colStart: 2,
        colSpan: 1,
        isStart: false,
        isEnd: false
      };
    }

    // Clamp the event visual start/end to the current week
    const visualStart = eventStart < weekStart ? weekStart : eventStart;
    const visualEnd = eventEnd > weekEnd ? weekEnd : eventEnd;

    const startDayIndex = visualStart.getDay(); // 0 (Sun) - 6 (Sat)
    const durationDays = Math.ceil((visualEnd.getTime() - visualStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      colStart: startDayIndex + 2, // +2 because col 1 is sidebar
      colSpan: durationDays,
      isStart: isSameDay(visualStart, eventStart),
      isEnd: isSameDay(visualEnd, eventEnd)
    };
  } catch (error) {
    console.warn('Error calculating event position:', event, error);
    return {
      colStart: 2,
      colSpan: 1,
      isStart: false,
      isEnd: false
    };
  }
};