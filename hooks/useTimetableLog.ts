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
  | 'english_move'
  | 'student_move';

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
 * undefined 필드를 제거하는 헬퍼 함수 (Firestore는 undefined 불가)
 */
function removeUndefined(obj: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!obj) return undefined;
  const cleaned: Record<string, any> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * 시간표 변경 로그 기록 (fire-and-forget)
 * 로깅 실패 시 콘솔 경고만 출력하고 mutation에 영향 없음
 */
export function logTimetableChange(params: LogTimetableChangeParams): void {
  const entry: any = {
    action: params.action,
    subject: params.subject,
    className: params.className,
    details: params.details,
    timestamp: new Date().toISOString(),
    changedBy: auth.currentUser?.email || auth.currentUser?.displayName || 'unknown',
  };

  // Optional 필드는 값이 있을 때만 추가
  if (params.studentName) entry.studentName = params.studentName;
  if (params.studentId) entry.studentId = params.studentId;

  const cleanedBefore = removeUndefined(params.before);
  const cleanedAfter = removeUndefined(params.after);

  if (cleanedBefore) entry.before = cleanedBefore;
  if (cleanedAfter) entry.after = cleanedAfter;

  // fire-and-forget: await하지 않음
  addDoc(collection(db, COL_TIMETABLE_LOGS), entry).catch((e) => {
    console.warn('[TimetableLog] 로그 기록 실패:', e);
  });
}