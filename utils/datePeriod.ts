/**
 * 주간/월간 페이지 기간 계산 헬퍼
 * 대시보드 KPI 모달들에서 공통으로 사용
 */
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

/** 시간표 기준 주차 (월요일~일요일). offset: 0=이번 주, -1=지난 주 ... */
export function getWeekRange(offset: number): PeriodRange {
  const now = new Date();
  const day = now.getDay(); // 0=일, 1=월, ...
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayDelta + offset * 7);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday,
    end: sunday,
    label: `${format(monday, 'M/d')} ~ ${format(sunday, 'M/d')}`,
  };
}

/** 월 단위 기간 (offset: 0=이번 달, -1=지난 달 ...) */
export function getMonthRange(offset: number): PeriodRange {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return {
    start: startOfMonth(base),
    end: endOfMonth(base),
    label: format(base, 'yyyy년 M월'),
  };
}

/** yyyy-MM 문자열 (BillingRecord.month 매칭용) */
export function getMonthYM(offset: number): string {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return format(base, 'yyyy-MM');
}