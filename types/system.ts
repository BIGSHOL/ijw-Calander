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
  | 'consultation' | 'attendance' | 'attendance-test' | 'students' | 'grades' | 'classes'
  | 'classroom' | 'classroom-assignment' | 'student-consultations' | 'consultation-list-test'
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
  | 'meeting-minutes'
  // Phase 7: 경비 관리
  | 'expenses'
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
  'attendance-test': { label: '출석부 테스트', icon: '🧪' },
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
  'consultation-list-test': { label: '상담목록 테스트', icon: '🧪' },
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
  'meeting-minutes': { label: '회의록', icon: '📝' },
  // 경비
  expenses: { label: '지출 관리', icon: '💰' },
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
    tabs: ['timetable', 'attendance', 'attendance-test', 'daily-attendance', 'classes', 'classroom', 'classroom-assignment', 'homework', 'exams', 'textbooks'],
    order: 2,
  },
  {
    id: 'student',
    label: '학생',
    icon: '👥',
    tabs: ['students', 'consultation', 'student-consultations', 'consultation-list-test', 'grades', 'withdrawal', 'contracts', 'reports'],
    order: 3,
  },
  {
    id: 'admin',
    label: '관리',
    icon: '⚙️',
    tabs: ['tuition-calculator', 'payment', 'staff', 'billing', 'resources', 'role-management', 'payroll', 'analytics', 'expenses', 'meeting-minutes'],
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

/**
 * 탭 접근 권한 = "대표 view permission" 기반
 *
 * 역할 관리 UI 에서 체크하는 세부 permission 을 탭 접근 가드로 직접 사용.
 * - 매핑이 있는 탭: OR 조건. 매핑된 permission 중 하나라도 true 면 접근 허용.
 *                   전부 false 면 접근 차단 (DEFAULT_TAB_PERMISSIONS 폴백 사용 X)
 * - 매핑이 없는 탭: 기존 DEFAULT_TAB_PERMISSIONS / Firestore tabPermissions 로 폴백
 *
 * 별도 처리되는 특수 탭:
 * - help: 모든 사용자 항상 허용
 * - attendance-test: master/admin 만 허용 (코드 레벨 강제)
 * - logs: master 전용 (DEFAULT_TAB_PERMISSIONS 로 처리)
 * - dashboard, calendar: 별도 permission 없이 DEFAULT 로 처리
 */
export const TAB_PRIMARY_PERMISSIONS: Partial<Record<AppTab, string[]>> = {
  // 일정 그룹
  'gantt': ['gantt.view'],
  // 수업 그룹
  'timetable': [
    'timetable.math.view',
    'timetable.english.view',
    'timetable.science.view',
    'timetable.korean.view',
    'timetable.integrated.view',
  ],
  'attendance': ['attendance.manage_own', 'attendance.edit_all'],
  'daily-attendance': ['daily_attendance.view', 'daily_attendance.edit'],
  'classes': ['classes.view'],
  'classroom': ['classroom.view'],
  'classroom-assignment': ['classroom.edit', 'classes.edit'],
  'homework': ['homework.view'],
  'exams': ['exams.view'],
  'textbooks': ['textbooks.view'],
  // 학생 그룹
  'students': ['students.view'],
  'consultation': ['consultation.view'],
  'student-consultations': [
    'student_consultations.view',
    'student_consultations.create',
    'student_consultations.edit',
  ],
  'grades': ['grades.view'],
  'withdrawal': ['withdrawal.view'],
  'contracts': ['contracts.view'],
  'reports': ['reports.view'],
  // 관리 그룹
  'payment': ['payment.view'],
  'tuition-calculator': ['tuition.view'],
  'staff': ['staff.view'],
  'billing': ['billing.view'],
  'resources': ['resources.view'],
  'role-management': ['roles.view'],
  'analytics': ['analytics.view'],
  'payroll': ['payroll.view'],
  'expenses': ['expenses.view'],
  'meeting-minutes': ['meeting.view', 'meeting.edit'],
  // 소통 그룹
  'notices': ['notices.view'],
  'parent-portal': ['parent_portal.view'],
  'sms-notifications': ['notifications.view'],
  // 마케팅 그룹
  'marketing': ['marketing.view'],
  'shuttle': ['shuttle.view'],
  'timetable-distribution': ['timetable_distribution.view'],
};

// Default Tab Permissions (Fallback)
// Note: master always has access to all tabs (handled in code)
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  master: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'attendance-test', 'daily-attendance', 'payment', 'gantt',
    'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment',
    'student-consultations', 'staff', 'billing', 'role-management', 'resources', 'withdrawal',
    'homework', 'exams', 'textbooks', 'contracts', 'reports', 'payroll', 'analytics',
    'parent-portal', 'sms-notifications', 'marketing', 'shuttle', 'timetable-distribution', 'help', 'logs',
    'tuition-calculator', 'meeting-minutes', 'expenses',
  ],
  admin: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'attendance-test', 'daily-attendance', 'payment', 'gantt',
    'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment',
    'student-consultations', 'staff', 'billing', 'role-management', 'resources', 'withdrawal',
    'homework', 'exams', 'textbooks', 'contracts', 'reports', 'payroll', 'analytics',
    'parent-portal', 'sms-notifications', 'marketing', 'shuttle', 'timetable-distribution', 'help', 'logs',
    'tuition-calculator', 'meeting-minutes', 'expenses',
  ],
  manager: [
    'dashboard', 'notices', 'calendar', 'timetable', 'attendance', 'daily-attendance',
    'consultation', 'students', 'grades', 'classes', 'classroom', 'classroom-assignment',
    'student-consultations', 'staff', 'billing', 'resources', 'withdrawal',
    'homework', 'exams', 'textbooks', 'contracts', 'reports', 'analytics',
    'parent-portal', 'sms-notifications', 'shuttle', 'help', 'tuition-calculator', 'meeting-minutes',
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

// Google Calendar 동기화 설정

/** 캘린더 ↔ 부서 매핑 (다중 지원) */
export interface GCalSyncMapping {
  calendarId: string;      // Google Calendar ID
  departmentId: string;    // 매핑할 부서 ID
  label?: string;          // 표시용 라벨 (예: "수학부 캘린더")
}

export interface GCalSyncSettings {
  enabled: boolean;            // 동기화 활성화 여부
  mappings: GCalSyncMapping[]; // 캘린더 ↔ 부서 매핑 목록
  lastSyncAt?: string;         // 마지막 동기화 타임스탬프
  lastSyncStatus?: 'success' | 'error' | 'running';
  lastSyncError?: string;
  serviceAccountEmail?: string; // 서비스 계정 이메일 (표시용)
  // 하위 호환 (레거시)
  calendarId?: string;
  syncDepartmentId?: string;
}

export interface SystemConfig {
  eventLookbackYears?: number;
  categories?: string[];
  tabPermissions?: TabPermissionConfig;
  masterEmails?: string[]; // List of master account emails
  gcalSync?: GCalSyncSettings; // Google Calendar 동기화 설정
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
