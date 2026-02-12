export type SalaryType = 'fixed' | 'percentage';

export interface SalarySettingItem {
  id: string;
  name: string; // e.g., "초등", "중등 심화", "고등 B반"
  color: string; // e.g., "blue", "green", "purple", "orange", "pink"
  type: SalaryType;
  fixedRate: number;      // Used when type is 'fixed'
  baseTuition: number;    // Used when type is 'percentage'
  ratio: number;          // Used when type is 'percentage'
  unitPrice?: number;     // 등록차수 계산용 1회 단가 (고정급: 별도 입력, 비율제: baseTuition fallback)
}

export type IncentiveType = 'fixed' | 'percentage';

export interface IncentiveConfig {
  blogType: IncentiveType;     // 'fixed' = 고정금, 'percentage' = 비율 가산
  blogAmount: number;          // 고정금일 때 금액 (e.g., 50000)
  blogRate: number;            // 비율일 때 % (e.g., 2 for 2%)
  retentionAmount: number;
  retentionTargetRate: number; // Percentage (e.g. 0 for 0% drop-out)
}

export interface SalaryConfig {
  academyFee: number; // Global fee percentage
  items: SalarySettingItem[];
  incentives: IncentiveConfig; // New: Incentive settings
}

export interface MonthlySettlement {
  hasBlog: boolean;
  hasRetention: boolean;
  otherAmount: number;
  note: string;
  // 정산 확정 관련 필드
  isFinalized?: boolean;           // 확정 여부
  finalizedAt?: string;            // 확정 일시 (ISO string)
  salaryConfig?: SalaryConfig;     // 확정 시점의 급여 설정 스냅샷
}

export type AttendanceSubject = 'math' | 'english';

export interface Student {
  // UnifiedStudent fields
  id: string;
  name: string;
  englishName?: string;
  school?: string; // Unified: string | undefined
  grade?: string;  // Unified: string | undefined
  group?: string;  // Unified: string | undefined

  // Custom for Attendance (merged locally)
  salarySettingId?: string; // Unified: string | undefined
  days?: string[];          // Unified: string[] | undefined

  attendance: Record<string, number>;
  memos?: Record<string, string>;
  homework?: Record<string, boolean>;  // 과제 완료 여부 (날짜별)
  cellColors?: Record<string, string>;  // 셀 배경색 (날짜별, 미리 정의된 색상 키 또는 hex)
  salarySettingOverrides?: Record<string, string>;  // 수업별 급여 설정 override (className -> salarySettingId)

  // Legacy/Optional Compatibility
  isHomeroom?: boolean;

  // Effective Period (Unified has these)
  startDate: string;
  endDate?: string;  // Unified uses optional string
  status?: 'active' | 'withdrawn';  // Student status for filtering

  // Teacher Integration (staffIds references staff collection)
  staffIds: string[];
  subjects: AttendanceSubject[];  // Array support
  ownerId?: string;
  enrollments?: any[]; // For embedded enrollment data (Performance Optimization)

  // Metadata
  createdAt?: string;
  updatedAt?: string;

  // 담임/부담임 여부 (출석부에서 [담임]/[부담임] 표시용)
  isSlotTeacher?: boolean;  // true면 부담임(slotTeacher) 수업의 학생
  mainClasses?: string[];   // 담임 수업 목록
  slotClasses?: string[];   // 부담임 수업 목록
}

export interface AppState {
  currentDate: Date;
  students: Student[];
  salaryConfig: SalaryConfig;
}

// ========================================
// 세션 기반 출석부 타입 (Session-based Attendance)
// ========================================

// 날짜 범위
export interface DateRange {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
}

// 세션 기간 (월별 세션 설정)
export interface SessionPeriod {
  id: string;           // "2026-math-1" (year-category-month)
  year: number;
  category: 'math' | 'english' | 'eie';
  month: number;        // 1-12
  ranges: DateRange[];  // 여러 날짜 범위 지원
  sessions: number;     // 기본 12회
  createdAt?: string;
  updatedAt?: string;
}

// 출석부 보기 모드
export type AttendanceViewMode = 'monthly' | 'session';