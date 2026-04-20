/**
 * 학생 상태 판정 통일 유틸
 *
 * 기존 문제: StudentList는 `student.withdrawalDate` 기준, StudentDetail은 `student.status === 'withdrawn'` 기준으로
 *           상태를 판정해서 같은 학생이 화면마다 다르게 보이는 버그가 발생했다.
 * 이 유틸은 단일 진실 소스(single source of truth)를 제공한다.
 */

import { UnifiedStudent } from '../types';
import { formatDateKey } from './dateUtils';

/**
 * 화면 표시용 학생 상태
 * - active: 재원 중
 * - on_hold: 휴원/대기
 * - withdrawing: 이번 주 내 퇴원 예정 (withdrawalDate 있지만 아직 status=withdrawn 아님)
 * - withdrawn: 퇴원 완료
 * - prospect: 예비
 */
export type DisplayStudentStatus =
  | 'active'
  | 'on_hold'
  | 'withdrawing'
  | 'withdrawn'
  | 'prospect';

export interface DisplayStatusOptions {
  today?: string;    // YYYY-MM-DD (생략 시 오늘)
  weekEnd?: string;  // YYYY-MM-DD (생략 시 이번 주 일요일)
}

function computeWeekEnd(): string {
  const now = new Date();
  const currentDay = now.getDay(); // 0(일) ~ 6(토)
  const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  return formatDateKey(sunday);
}

/**
 * 학생 하나의 화면 표시용 상태를 계산한다.
 * withdrawalDate와 status를 모두 반영하는 단일 판정 함수.
 */
export function getDisplayStudentStatus(
  student: Pick<UnifiedStudent, 'status' | 'withdrawalDate' | 'enrollments'>,
  options: DisplayStatusOptions = {}
): DisplayStudentStatus {
  const today = options.today ?? formatDateKey(new Date());
  const weekEnd = options.weekEnd ?? computeWeekEnd();

  // 1. status=withdrawn 이면 무조건 퇴원 (withdrawalDate 유무 무관)
  if (student.status === 'withdrawn') {
    return 'withdrawn';
  }

  // 2. 예비
  if (student.status === 'prospect' || student.status === 'prospective') {
    return 'prospect';
  }

  // 3. withdrawalDate가 있지만 status는 아직 퇴원이 아닌 경우
  //    - 오늘 이후 이번 주 안이면 "퇴원 예정"
  //    - 그 외(과거 또는 이번 주 이후)는 데이터 부정합이나 일단 재원 취급
  if (student.withdrawalDate) {
    if (student.withdrawalDate >= today && student.withdrawalDate <= weekEnd) {
      return 'withdrawing';
    }
  }

  // 4. on_hold: status 또는 모든 활성 enrollment가 onHold
  if (student.status === 'on_hold') {
    return 'on_hold';
  }

  const activeEnrollments = (student.enrollments || []).filter((e) => {
    const hasEnded = !!e.endDate;
    const isFuture = !!(e.startDate && e.startDate > today);
    return !hasEnded && !isFuture;
  });

  if (activeEnrollments.length > 0 && activeEnrollments.every((e) => e.onHold === true)) {
    return 'on_hold';
  }

  return 'active';
}

/**
 * 학생이 퇴원 상태인가? (status=withdrawn 만 검사 — enrollment 레벨은 별개)
 * StudentDetail 등 "퇴원 처리/재원 복구" 버튼 분기에 사용.
 */
export function isStudentWithdrawn(
  student: Pick<UnifiedStudent, 'status'>
): boolean {
  return student.status === 'withdrawn';
}

/**
 * 퇴원 예정(withdrawing) 또는 퇴원 완료(withdrawn)를 모두 잡는 헬퍼.
 * 리포트/집계에서 "퇴원 관련"으로 묶을 때 사용.
 */
export function isWithdrawnOrWithdrawing(
  student: Pick<UnifiedStudent, 'status' | 'withdrawalDate' | 'enrollments'>,
  options?: DisplayStatusOptions
): boolean {
  const s = getDisplayStudentStatus(student, options);
  return s === 'withdrawn' || s === 'withdrawing';
}
