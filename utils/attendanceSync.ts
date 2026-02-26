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
 * 출석부는 시간 단위(0.5=1시간, 1=2시간, 1.5=3시간, 2.0=4시간, 2.5=5시간, 3.0=6시간)를 사용.
 * 시간 기반 시스템에서는 지각/조퇴 등 세부 상태 구분이 불가하므로,
 * 양수 값은 모두 'present', 0은 'absent'로 매핑.
 *
 * @param value - 출석부의 숫자 값 (양수=출석, 0=결석)
 * @returns 출결 관리의 AttendanceStatus
 */
export function mapAttendanceValueToStatus(value: number | null): AttendanceStatus {
  if (value === null) return 'absent';
  if (value > 0) return 'present';
  return 'absent';
}

/**
 * 출결 관리 문자열 상태를 출석부 숫자 값으로 변환
 *
 * 출석부는 시간 단위를 사용하므로, 상세 상태는 이진값(출석/결석)으로 변환.
 * - present/late/early_leave → 1 (출석 처리: 등원함)
 * - absent/excused → 0 (결석 처리: 미등원)
 * 세부 상태(지각/조퇴/사유결석)는 DailyAttendance에서 관리.
 *
 * @param status - 출결 관리의 AttendanceStatus
 * @returns 출석부의 숫자 값
 */
export function mapAttendanceStatusToValue(status: AttendanceStatus): number {
  switch (status) {
    case 'present': return 1;       // 출석
    case 'late': return 1;          // 지각 → 출석 (등원함)
    case 'early_leave': return 1;   // 조퇴 → 출석 (등원함)
    case 'absent': return 0;        // 결석
    case 'excused': return 0;       // 사유결석 → 결석 (미등원)
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
