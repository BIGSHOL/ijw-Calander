import { UserRole } from './auth';

// ============ STAFF MANAGEMENT TYPES ============

/**
 * 주간 근무 일정
 */
export interface WeeklySchedule {
  mon?: string[]; // ['09:00-12:00', '14:00-18:00']
  tue?: string[];
  wed?: string[];
  thu?: string[];
  fri?: string[];
  sat?: string[];
  sun?: string[];
}

/**
 * 직원 정보
 */
export interface StaffMember {
  id: string;
  uid?: string; // Firebase Auth UID (users 컬렉션 연동)
  name: string;
  englishName?: string;           // 영어 이름
  email?: string;
  phone?: string;
  role: 'teacher' | 'admin' | 'staff' | '강사';
  subjects?: ('math' | 'english')[];
  hireDate: string;
  status: 'active' | 'inactive' | 'resigned';
  workSchedule?: WeeklySchedule;
  profileImage?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;

  // === 시스템 권한 필드 (UserProfile 통합) ===
  systemRole?: UserRole;           // 시스템 권한 역할 (8단계)
  approvalStatus?: 'approved' | 'pending' | 'rejected';  // 승인 상태
  departmentPermissions?: Record<string, 'view'>;  // 부서 가시성 제어 ('view' = 보임, 없음 = 숨김)
  favoriteDepartments?: string[];  // 즐겨찾기 부서
  primaryDepartmentId?: string;    // 주 소속 부서
  jobTitle?: string;               // 호칭

  // === 선생님 전용 필드 (role === 'teacher'일 때만 사용) ===
  // 시간표 표시 설정
  isHiddenInTimetable?: boolean;  // 시간표에서 숨김
  isHiddenInAttendance?: boolean; // 출석부에서 숨김
  isNative?: boolean;             // 원어민 강사 여부

  // 퍼스널 색상 (시간표, 출석부 등에서 사용)
  bgColor?: string;               // 배경색
  textColor?: string;             // 글자색

  // 시간표 관련
  defaultRoom?: string;           // 기본 강의실
  timetableOrder?: number;        // 시간표 정렬 순서
}

/**
 * 휴가 정보
 */
export interface StaffLeave {
  id: string;
  staffId: string;
  staffName: string;
  type: 'annual' | 'sick' | 'personal' | 'other';
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

/**
 * 직원 역할 라벨
 */
export const STAFF_ROLE_LABELS: Record<StaffMember['role'], string> = {
  teacher: '강사',
  admin: '관리자',
  staff: '직원',
  '강사': '강사',
};

/**
 * 휴가 유형 라벨
 */
export const LEAVE_TYPE_LABELS: Record<StaffLeave['type'], string> = {
  annual: '연차',
  sick: '병가',
  personal: '개인사유',
  other: '기타',
};

/**
 * 휴가 상태 라벨
 */
export const LEAVE_STATUS_LABELS: Record<StaffLeave['status'], string> = {
  pending: '대기중',
  approved: '승인',
  rejected: '반려',
};

/**
 * 직원 상태 라벨
 */
export const STAFF_STATUS_LABELS: Record<StaffMember['status'], string> = {
  active: '재직',
  inactive: '휴직',
  resigned: '퇴사',
};
