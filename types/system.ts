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

// Top-level Application Tabs
export type AppTab = 'dashboard' | 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students' | 'grades' | 'classes' | 'classroom' | 'classroom-assignment' | 'student-consultations' | 'staff' | 'daily-attendance' | 'billing' | 'role-management' | 'resources' | 'withdrawal';

// Tab Metadata - 각 탭의 메타정보 (확장 가능)
export interface TabMetadata {
  id: AppTab;
  label: string;
  icon: string;
}

export const TAB_META: Record<AppTab, Omit<TabMetadata, 'id'>> = {
  dashboard: { label: '대시보드', icon: '🏠' },
  calendar: { label: '연간 일정', icon: '📅' },
  timetable: { label: '시간표', icon: '📋' },
  attendance: { label: '출석부', icon: '📝' },
  'daily-attendance': { label: '출결 관리', icon: '✅' },
  payment: { label: '전자 결재', icon: '💳' },
  gantt: { label: '간트 차트', icon: '📊' },
  consultation: { label: '등록 상담', icon: '📞' },
  students: { label: '학생 관리', icon: '👥' },
  grades: { label: '성적 관리', icon: '📊' },
  classes: { label: '수업 관리', icon: '📚' },
  classroom: { label: '강의실', icon: '🏫' },
  'classroom-assignment': { label: '강의실 배정', icon: '🏗️' },
  'student-consultations': { label: '학생 상담', icon: '💬' },
  staff: { label: '직원 관리', icon: '👔' },
  billing: { label: '수납 관리', icon: '💰' },
  'role-management': { label: '역할 관리', icon: '🔐' },
  resources: { label: '자료실', icon: '📁' },
  withdrawal: { label: '퇴원 관리', icon: '🚪' },
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
    tabs: ['dashboard'],
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
    tabs: ['timetable', 'attendance', 'daily-attendance', 'classes', 'classroom', 'classroom-assignment'],
    order: 2,
  },
  {
    id: 'student',
    label: '학생',
    icon: '👥',
    tabs: ['students', 'consultation', 'student-consultations', 'grades', 'withdrawal'],
    order: 3,
  },
  {
    id: 'admin',
    label: '관리',
    icon: '⚙️',
    tabs: ['payment', 'staff', 'billing', 'resources'],
    order: 4,
  },
  {
    id: 'system',
    label: '시스템',
    icon: '🔧',
    tabs: ['role-management'],
    order: 5,
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
  master: ['dashboard', 'calendar', 'timetable', 'attendance', 'daily-attendance', 'payment', 'gantt', 'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment', 'student-consultations', 'staff', 'billing', 'role-management', 'resources', 'withdrawal'],
  admin: ['dashboard', 'calendar', 'timetable', 'attendance', 'daily-attendance', 'payment', 'gantt', 'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment', 'student-consultations', 'staff', 'billing', 'role-management', 'resources', 'withdrawal'],
  manager: ['dashboard', 'calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment', 'student-consultations', 'staff', 'billing', 'resources', 'withdrawal'],
  math_lead: ['dashboard', 'calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment', 'student-consultations', 'withdrawal'],
  english_lead: ['dashboard', 'calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment', 'student-consultations', 'withdrawal'],
  math_teacher: ['dashboard', 'calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades'],
  english_teacher: ['dashboard', 'calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades'],
  user: ['dashboard', 'calendar', 'attendance', 'daily-attendance'],
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
