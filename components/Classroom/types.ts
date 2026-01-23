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
  conflictIndex: number;  // 충돌 그룹 내 순번 (0-based)
  conflictTotal: number;  // 충돌 그룹의 총 블록 수
}

export interface TimeConfig {
  start: number;
  end: number;
  range: number;
}

export const WEEKDAY_CONFIG: TimeConfig = { start: 860, end: 1320, range: 460 }; // 14:20~22:00
export const WEEKEND_CONFIG: TimeConfig = { start: 540, end: 1020, range: 480 }; // 09:00~17:00

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
