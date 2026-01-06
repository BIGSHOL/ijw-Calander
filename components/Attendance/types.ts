export type SalaryType = 'fixed' | 'percentage';

export interface SalarySettingItem {
  id: string;
  name: string; // e.g., "초등", "중등 심화", "고등 B반"
  color: string; // e.g., "blue", "green", "purple", "orange", "pink"
  type: SalaryType;
  fixedRate: number;      // Used when type is 'fixed'
  baseTuition: number;    // Used when type is 'percentage'
  ratio: number;          // Used when type is 'percentage'
}

export interface IncentiveConfig {
  blogAmount: number;
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
}

export type AttendanceSubject = 'math' | 'english';

export interface Student {
  id: string;
  name: string;
  school: string;
  grade: string;
  group: string; // New: Class Group Name (e.g., "Piano A", "Math B")
  salarySettingId: string; // Links to SalarySettingItem.id
  days: string[];
  attendance: Record<string, number>;
  memos?: Record<string, string>; // New: DateKey -> Note text (e.g., "Sick leave", "Late")
  isHomeroom?: boolean; // New: Indicates if the student is managed by a homeroom teacher

  // Effective Period
  startDate: string; // "YYYY-MM-DD" format. Mandatory.
  endDate: string | null; // "YYYY-MM-DD" format. If null, active indefinitely.

  // Teacher Integration (NEW)
  teacherIds: string[];        // 담당 강사 ID 배열 (다대다 관계, 부담임 지원)
  subject: AttendanceSubject;  // 과목 구분 (수학/영어)
  ownerId?: string;            // Firebase 문서 소유자 (작성자 UID)
}

export interface AppState {
  currentDate: Date;
  students: Student[];
  salaryConfig: SalaryConfig;
}