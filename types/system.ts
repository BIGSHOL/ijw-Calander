import { UserRole } from './auth';

// Payment Report Types
export interface TuitionEntry {
  id: string;
  academyName: string; // 사업장(학원명)
  projectedFee: number; // 발생시킬 수강료
  reason: string; // 증감사유
  category: 'increase' | 'decrease' | 'steady'; // For UI coloring logic
}

export interface ReportSummary {
  totalFee: number;
  entryCount: number;
  maxFeeAcademy: string;
}

// ============ SYSTEM TAB PERMISSIONS ============

// Top-level Application Tabs (33개)
export type AppTab =
  // 기존 탭 (20개)
  | 'dashboard' | 'calendar' | 'timetable' | 'payment' | 'gantt'
  | 'consultation' | 'attendance' | 'students' | 'grades' | 'classes'
  | 'classroom' | 'classroom-assignment' | 'student-consultations'
  | 'staff' | 'daily-attendance' | 'billing' | 'role-management'
  | 'resources' | 'withdrawal' | 'help'
  // Phase 1: 소통 강화
  | 'notices' | 'parent-portal'
  // Phase 2: 경영 관리
  | 'analytics' | 'payroll' | 'tuition-calculator'
  // Phase 3: 수업 운영
  | 'homework' | 'exams' | 'sms-notifications' | 'textbooks'
  // Phase 4: 기능 완성
  | 'contracts' | 'reports'
  // Phase 5: 확장
  | 'shuttle' | 'marketing' | 'timetable-distribution'
  // Phase 6: AI 분석
  | 'consultation-recording'
  // 지원
  | 'logs';

// Tab Metadata - 각 탭의 메타정보 (확장 가능)
export interface TabMetadata {
  id: AppTab;
  label: string;
  icon: string;
}

export const TAB_META: Record<AppTab, Omit<TabMetadata, 'id'>> = {
  // 홈
  dashboard: { label: '대시보드', icon: '🏠' },
  notices: { label: '공지사항', icon: '📢' },
  // 일정
  calendar: { label: '연간 일정', icon: '📅' },
  gantt: { label: '간트 차트', icon: '📊' },
  // 수업
  timetable: { label: '시간표', icon: '📋' },
  attendance: { label: '출석부', icon: '📝' },
  'daily-attendance': { label: '출결 관리', icon: '✅' },
  classes: { label: '수업 관리', icon: '📚' },
  classroom: { label: '강의실', icon: '🏫' },
  'classroom-assignment': { label: '강의실 배정', icon: '🏗️' },
  homework: { label: '숙제 관리', icon: '📓' },
  exams: { label: '시험 관리', icon: '📝' },
  textbooks: { label: '교재 관리', icon: '📖' },
  // 학생
  students: { label: '학생 관리', icon: '👥' },
  consultation: { label: '등록 상담', icon: '📞' },
  'student-consultations': { label: '학생 상담', icon: '💬' },
  grades: { label: '성적 관리', icon: '📊' },
  withdrawal: { label: '퇴원 관리', icon: '🚪' },
  contracts: { label: '계약 관리', icon: '📄' },
  reports: { label: '학습 리포트', icon: '📑' },
  // 관리
  payment: { label: '수강료 현황', icon: '💳' },
  staff: { label: '직원 관리', icon: '👔' },
  billing: { label: '수납 관리', icon: '💰' },
  resources: { label: '자료실', icon: '📁' },
  'role-management': { label: '역할 관리', icon: '🔐' },
  payroll: { label: '급여 관리', icon: '💵' },
  analytics: { label: '매출 분석', icon: '📈' },
  'tuition-calculator': { label: '수강료 계산', icon: '🧮' },
  // 소통
  'parent-portal': { label: '학부모 소통', icon: '👨‍👩‍👧' },
  'sms-notifications': { label: '알림 발송', icon: '📲' },
  // 마케팅
  marketing: { label: '마케팅', icon: '📣' },
  shuttle: { label: '셔틀 관리', icon: '🚌' },
  'timetable-distribution': { label: '시간표 배포', icon: '📤' },
  // AI 분석
  'consultation-recording': { label: '상담녹음분석', icon: '🎙️' },
  // 지원
  help: { label: '도움말', icon: '❓' },
  logs: { label: '로그보기', icon: '📋' },
};

// Tab Group 구조 - 무한 확장 가능
export interface TabGroup {
  id: string;
  label: string;
  icon: string;
  tabs: AppTab[];
  order: number; // 표시 순서
}

// Tab Groups 정의 - 추후 Firebase에서 로드 가능하도록 설계
export const TAB_GROUPS: TabGroup[] = [
  {
    id: 'home',
    label: '홈',
    icon: '🏠',
    tabs: ['dashboard', 'notices'],
    order: 0,
  },
  {
    id: 'schedule',
    label: '일정',
    icon: '📅',
    tabs: ['calendar', 'gantt'],
    order: 1,
  },
  {
    id: 'class',
    label: '수업',
    icon: '📚',
    tabs: ['timetable', 'attendance', 'daily-attendance', 'classes', 'classroom', 'classroom-assignment', 'homework', 'exams', 'textbooks'],
    order: 2,
  },
  {
    id: 'student',
    label: '학생',
    icon: '👥',
    tabs: ['students', 'consultation', 'student-consultations', 'consultation-recording', 'grades', 'withdrawal', 'contracts', 'reports'],
    order: 3,
  },
  {
    id: 'admin',
    label: '관리',
    icon: '⚙️',
    tabs: ['tuition-calculator', 'payment', 'staff', 'billing', 'resources', 'role-management', 'payroll', 'analytics'],
    order: 4,
  },
  {
    id: 'comm',
    label: '소통',
    icon: '💬',
    tabs: ['parent-portal', 'sms-notifications'],
    order: 5,
  },
  {
    id: 'marketing',
    label: '마케팅',
    icon: '📣',
    tabs: ['marketing', 'shuttle', 'timetable-distribution'],
    order: 6,
  },
  {
    id: 'support',
    label: '지원',
    icon: '❓',
    tabs: ['help', 'logs'],
    order: 7,
  },
];

// Legacy support - 기존 코드 호환성
export const APP_TABS: { id: AppTab; label: string }[] = Object.entries(TAB_META).map(([id, meta]) => ({
  id: id as AppTab,
  label: meta.label,
}));

// Configuration for Tab Access (Stored in system/config -> tabPermissions)
// Key: UserRole, Value: Array of allowed AppTab IDs
export type TabPermissionConfig = {
  [key in UserRole]?: AppTab[];
};

// Default Tab Permissions (Fallback)
// Note: master always has access to all tabs (handled in code)
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  master: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'daily-attendance', 'payment', 'gantt',
    'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment',
    'student-consultations', 'staff', 'billing', 'role-management', 'resources', 'withdrawal',
    'homework', 'exams', 'textbooks', 'contracts', 'reports', 'payroll', 'analytics',
    'parent-portal', 'sms-notifications', 'marketing', 'shuttle', 'timetable-distribution', 'help', 'logs',
    'tuition-calculator', 'consultation-recording',
  ],
  admin: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'daily-attendance', 'payment', 'gantt',
    'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment',
    'student-consultations', 'staff', 'billing', 'role-management', 'resources', 'withdrawal',
    'homework', 'exams', 'textbooks', 'contracts', 'reports', 'payroll', 'analytics',
    'parent-portal', 'sms-notifications', 'marketing', 'shuttle', 'timetable-distribution', 'help', 'logs',
    'tuition-calculator', 'consultation-recording',
  ],
  manager: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'daily-attendance',
    'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment',
    'student-consultations', 'staff', 'billing', 'resources', 'withdrawal',
    'homework', 'exams', 'textbooks', 'contracts', 'reports', 'analytics',
    'parent-portal', 'sms-notifications', 'shuttle', 'help', 'tuition-calculator', 'consultation-recording',
  ],
  math_lead: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'daily-attendance',
    'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment',
    'student-consultations', 'withdrawal', 'resources',
    'homework', 'exams', 'textbooks', 'reports', 'parent-portal', 'help',
  ],
  english_lead: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'daily-attendance',
    'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment',
    'student-consultations', 'withdrawal', 'resources',
    'homework', 'exams', 'textbooks', 'reports', 'parent-portal', 'help',
  ],
  math_teacher: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'daily-attendance',
    'consultation', 'students', 'grades',
    'homework', 'exams', 'reports', 'parent-portal', 'help',
  ],
  english_teacher: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'daily-attendance',
    'consultation', 'students', 'grades',
    'homework', 'exams', 'reports', 'parent-portal', 'help',
  ],
  user: ['dashboard', 'notices', 'calendar', 'attendance', 'daily-attendance', 'help'],
};

export interface SystemConfig {
  eventLookbackYears?: number;
  categories?: string[];
  tabPermissions?: TabPermissionConfig;
  masterEmails?: string[]; // List of master account emails
}

// ============ DASHBOARD TYPES ============

/**
 * KPI 카드 타입
 */
export type KPITrend = 'up' | 'down' | 'stable';

export interface KPICardData {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: KPITrend;
  trendValue?: string;
  icon?: string;
  color?: string;
}

/**
 * 대시보드 역할 타입
 */
export type DashboardRole = 'master' | 'teacher' | 'staff' | 'manager';
