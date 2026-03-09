/**
 * 시간표 변경 로그 유틸리티
 * Firestore timetable_logs 컬렉션에 변경 이력을 기록
 * fire-and-forget 방식으로 로깅 실패가 mutation에 영향을 주지 않음
 */

import { addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

const COL_TIMETABLE_LOGS = 'timetable_logs';

export type TimetableLogAction =
  | 'class_create'
  | 'class_update'
  | 'class_delete'
  | 'student_enroll'
  | 'student_unenroll'
  | 'student_transfer'
  | 'student_withdraw'
  | 'enrollment_update'
  | 'english_move';

export interface TimetableLogEntry {
  timestamp: string;
  action: TimetableLogAction;
  subject: string;
  className: string;
  studentName?: string;
  studentId?: string;
  changedBy: string;
  details: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
}

export interface LogTimetableChangeParams {
  action: TimetableLogAction;
  subject: string;
  className: string;
  studentName?: string;
  studentId?: string;
  details: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
}

/**
 * 시간표 변경 로그 기록 (fire-and-forget)
 * 로깅 실패 시 콘솔 경고만 출력하고 mutation에 영향 없음
 */
export function logTimetableChange(params: LogTimetableChangeParams): void {
  const entry: TimetableLogEntry = {
    ...params,
    timestamp: new Date().toISOString(),
    changedBy: auth.currentUser?.email || auth.currentUser?.displayName || 'unknown',
  };

  // fire-and-forget: await하지 않음
  addDoc(collection(db, COL_TIMETABLE_LOGS), entry).catch((e) => {
    console.warn('[TimetableLog] 로그 기록 실패:', e);
  });
}