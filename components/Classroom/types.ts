import { SubjectType } from '../../types';

export interface ClassroomBlock {
  id: string;
  classId: string;
  className: string;
  teacher: string;
  subject: SubjectType;
  room: string;
  periodId: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  hasConflict: boolean;
  isMerged: boolean;      // 합반 여부
  conflictIndex: number;  // 충돌/합반 그룹 내 순번 (0-based)
  conflictTotal: number;  // 충돌/합반 그룹의 총 블록 수
}

export interface TimeConfig {
  start: number;
  end: number;
  range: number;
  totalHeight: number; // 전체 높이 (픽셀)
}

// 시간당 픽셀 높이 (1시간 = 120px)
export const PIXELS_PER_HOUR = 120;

export const WEEKDAY_CONFIG: TimeConfig = { start: 540, end: 1320, range: 780, totalHeight: 780 / 60 * PIXELS_PER_HOUR }; // 09:00~22:00
export const WEEKEND_CONFIG: TimeConfig = { start: 540, end: 1320, range: 780, totalHeight: 780 / 60 * PIXELS_PER_HOUR }; // 09:00~22:00

export function makeTimeConfig(startHour: number, endHour: number): TimeConfig {
  const start = startHour * 60;
  const end = endHour * 60;
  const range = end - start;
  const totalHeight = (range / 60) * PIXELS_PER_HOUR;
  return { start, end, range, totalHeight };
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function getBlockPosition(startTime: string, endTime: string, isWeekend: boolean) {
  const config = isWeekend ? WEEKEND_CONFIG : WEEKDAY_CONFIG;
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  return {
    top: ((startMin - config.start) / config.range) * 100,
    height: ((endMin - startMin) / config.range) * 100,
  };
}
