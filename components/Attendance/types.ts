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

  // Legacy/Optional Compatibility
  isHomeroom?: boolean;

  // Effective Period (Unified has these)
  startDate: string;
  endDate?: string;  // Unified uses optional string
  status?: 'active' | 'withdrawn';  // Student status for filtering

  // Teacher Integration
  teacherIds: string[];
  subjects: AttendanceSubject[];  // Array support
  ownerId?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface AppState {
  currentDate: Date;
  students: Student[];
  salaryConfig: SalaryConfig;
}