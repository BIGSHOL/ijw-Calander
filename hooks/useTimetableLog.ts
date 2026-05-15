/**
 * 시간표 변경 로그 유틸리티
 * Firestore timetable_logs 컬렉션에 변경 이력을 기록
 * fire-and-forget 방식으로 로깅 실패가 mutation에 영향을 주지 않음
 */

import { addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { getCurrentActor } from '../utils/getCurrentActor';

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
  | 'student_move'
  | 'room_create'
  | 'room_update'
  | 'room_delete'
  | 'room_category_create'
  | 'room_category_update'
  | 'room_category_delete'
  | 'staff_create'
  | 'staff_update'
  | 'staff_delete';

/** 로그 대상 도메인 — 필터/그룹화용 */
export type TimetableLogTargetType = 'class' | 'room' | 'staff';

export interface TimetableLogEntry {
  timestamp: string;
  action: TimetableLogAction;
  subject: string;
  className: string;
  targetType?: TimetableLogTargetType;
  /** 대상 식별자 — class: className, room: room name, staff: staff name */
  targetName?: string;
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
  targetType?: TimetableLogTargetType;
  targetName?: string;
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
 *
 * changedBy 는 staff name (이성우, 이재성 등) 으로 저장 — 다른 audit 필드와 동일한 표기.
 * actor 조회는 staffIndex/staff 컬렉션을 거치므로 비동기지만, getCurrentActor() 내부에
 * 세션 캐시가 있어 동일 사용자 재호출 시 즉시 반환됨.
 */
export function logTimetableChange(params: LogTimetableChangeParams): void {
  // fire-and-forget: actor 조회 + 로그 기록을 한 번에 async IIFE 로 처리
  (async () => {
    const actor = await getCurrentActor();
    const entry: any = {
      action: params.action,
      subject: params.subject,
      className: params.className,
      details: params.details,
      timestamp: new Date().toISOString(),
      changedBy: actor?.name || auth.currentUser?.displayName || auth.currentUser?.email || 'unknown',
      changedByUid: actor?.uid || auth.currentUser?.uid || null,
      changedByRole: actor?.role || null,
    };

    // Optional 필드는 값이 있을 때만 추가
    if (params.studentName) entry.studentName = params.studentName;
    if (params.studentId) entry.studentId = params.studentId;
    if (params.targetType) entry.targetType = params.targetType;
    if (params.targetName) entry.targetName = params.targetName;

    const cleanedBefore = removeUndefined(params.before);
    const cleanedAfter = removeUndefined(params.after);

    if (cleanedBefore) entry.before = cleanedBefore;
    if (cleanedAfter) entry.after = cleanedAfter;

    try {
      await addDoc(collection(db, COL_TIMETABLE_LOGS), entry);
    } catch (e) {
      console.warn('[TimetableLog] 로그 기록 실패:', e);
    }
  })();
}