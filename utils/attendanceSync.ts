/**
 * 출석부 ↔ 출결 관리 양방향 동기화 유틸리티
 *
 * PURPOSE:
 * - 출석부(AttendanceManager)와 출결 관리(DailyAttendanceManager)의 데이터 동기화
 * - 두 시스템이 독립적으로 작동하면서도 데이터 일관성 유지
 *
 * DATA MAPPING:
 * - attendance_records (출석부) ↔ daily_attendance (출결 관리)
 * - 숫자 출석 상태 ↔ 문자열 출석 상태
 */

import { AttendanceStatus } from '../types';

/**
 * 출석부 숫자 값을 출결 관리 문자열 상태로 변환
 *
 * @param value - 출석부의 숫자 값 (1=출석, 0=결석, 2=지각, 3=조퇴, 4=사유결석)
 * @returns 출결 관리의 AttendanceStatus
 */
export function mapAttendanceValueToStatus(value: number | null): AttendanceStatus {
  if (value === null) return 'absent';

  switch (value) {
    case 1: return 'present';      // 출석
    case 0: return 'absent';        // 결석
    case 2: return 'late';          // 지각
    case 3: return 'early_leave';   // 조퇴
    case 4: return 'excused';       // 사유결석
    default: return 'absent';
  }
}

/**
 * 출결 관리 문자열 상태를 출석부 숫자 값으로 변환
 *
 * @param status - 출결 관리의 AttendanceStatus
 * @returns 출석부의 숫자 값
 */
export function mapAttendanceStatusToValue(status: AttendanceStatus): number {
  switch (status) {
    case 'present': return 1;       // 출석
    case 'absent': return 0;        // 결석
    case 'late': return 2;          // 지각
    case 'early_leave': return 3;   // 조퇴
    case 'excused': return 4;       // 사유결석
    default: return 0;
  }
}

/**
 * 출석 상태 한글 표시 (UI용)
 */
export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'present': return '출석';
    case 'absent': return '결석';
    case 'late': return '지각';
    case 'early_leave': return '조퇴';
    case 'excused': return '사유결석';
    default: return '-';
  }
}

/**
 * 출석 상태 색상 (UI용)
 */
export function getAttendanceStatusColor(status: AttendanceStatus): string {
  switch (status) {
    case 'present': return 'emerald';
    case 'absent': return 'red';
    case 'late': return 'amber';
    case 'early_leave': return 'orange';
    case 'excused': return 'blue';
    default: return 'gray';
  }
}
