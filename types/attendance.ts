// ============ DAILY ATTENDANCE TYPES (Phase: Daily Check-In) ============

/**
 * 일별 출결 기록
 * Firestore: daily_attendance/{date}/records/{recordId}
 */
export interface DailyAttendanceRecord {
  id: string;
  date: string; // 'YYYY-MM-DD' 형식
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  status: AttendanceStatus;
  checkInTime?: string;  // HH:mm 형식
  checkOutTime?: string; // HH:mm 형식
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 출결 상태 타입
 */
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'early_leave' | 'excused';

/**
 * 출결 상태 라벨
 */
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  early_leave: '조퇴',
  excused: '사유결석',
};

/**
 * 출결 상태별 색상 설정
 */
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, { bg: string; text: string; border: string }> = {
  present: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  late: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  absent: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  early_leave: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  excused: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
};

/**
 * 일별 출결 통계
 */
export interface DailyAttendanceStats {
  date: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  earlyLeave: number;
  excused: number;
  attendanceRate: number; // 출석률 (%)
}

/**
 * 출결 변경 이력
 * Firestore: attendance_history/{historyId}
 */
export interface AttendanceHistory {
  id: string;
  date: string; // 'YYYY-MM-DD' 형식
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  previousStatus: AttendanceStatus | null; // null = 신규 생성
  newStatus: AttendanceStatus;
  changedBy: string; // 변경한 사용자 UID
  changedByName?: string; // 변경한 사용자 이름 (캐시)
  reason?: string; // 변경 사유
  timestamp: string; // ISO 8601 timestamp
}
