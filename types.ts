export interface Department {
  id: string;
  name: string;
  category?: string; // New: Grouping category (e.g., "Math", "Language")
  description?: string; // For the subtitle like "Vision: ..."
  color?: string;
  order: number;
  defaultColor?: string;
  defaultTextColor?: string;
  defaultBorderColor?: string;
}

// Phase 6: Gantt Departments
export interface GanttDepartment {
  id: string;
  label: string;
  color: string;
  order: number;
  createdAt?: number;
}

export interface CalendarEvent {
  id: string;
  departmentId: string; // Primary department (for backward compatibility)
  departmentIds?: string[]; // Multiple departments (new feature)
  title: string;
  description?: string;
  participants?: string;
  referenceUrl?: string; // External link (e.g., Notion, Sheets)
  startDate: string; // ISO Date YYYY-MM-DD
  endDate: string;   // ISO Date YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  isAllDay?: boolean;
  color: string;     // Hex or Tailwind class
  textColor?: string;
  borderColor?: string;
  authorId?: string; // UID of the creator
  authorName?: string; // Display name of the creator (snapshot)
  createdAt?: string; // ISO Date string
  updatedAt?: string; // ISO Date string
  version?: number; // Version number for optimistic concurrency control
  attendance?: Record<string, 'pending' | 'joined' | 'declined'>; // Key: UID, Value: Status
  // Recurrence fields
  recurrenceGroupId?: string;  // ID of the first event in recurrence group
  recurrenceIndex?: number;    // 1-based index in the recurrence group
  recurrenceType?: 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly';
  relatedGroupId?: string;     // Group ID for multi-department linked events
}

export interface DragSelection {
  departmentId: string;
  date: string;
}

// Monthly Bucket List - Unscheduled events for a target month
export interface BucketItem {
  id: string;
  title: string;
  targetMonth: string; // 'YYYY-MM' format
  departmentId?: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string; // ISO Date string
  authorId?: string; // UID of the creator
  authorName?: string; // Display name of the creator
}

// Task Memo - One-way notification/request between users
export interface TaskMemo {
  id: string;
  from: string;         // sender uid
  fromName: string;     // sender display name
  to: string;           // receiver uid
  toName: string;       // receiver display name
  message: string;
  createdAt: string;    // ISO Date string
  isRead: boolean;
  isDeleted?: boolean;
}

// ============ GANTT CHART TYPES ============

export interface GanttSubTask {
  id: string;
  title: string;
  description: string;
  startOffset: number;  // Relative start day from 0
  duration: number;     // Duration in days
  completed: boolean;
  // Phase 7: Academy Specifics
  assigneeId?: string;       // UID
  assigneeName?: string;     // Display Name
  assigneeEmail?: string;    // Email for identification
  departmentIds?: string[];  // Department IDs
  // Phase 9: Category & Dependencies (Phase 11: Dynamic categories from Firestore)
  category?: string;  // References gantt_categories.id (동적 카테고리 지원)
  dependsOn?: string[];  // IDs of tasks this task depends on
}

// ============================================
// Phase 10: User-Specific Gantt Charts Types
// ============================================

/**
 * 프로젝트 공개 범위
 */
export type ProjectVisibility =
  | 'private'           // 생성자 + 지정 멤버만
  | 'department'        // 특정 부서 전체
  | 'department_shared' // 여러 부서 협업
  | 'public';           // 전체 공개

/**
 * 프로젝트 멤버 역할
 */
export type ProjectMemberRole =
  | 'owner'    // 소유자 (모든 권한)
  | 'admin'    // 관리자 (편집 + 멤버 관리)
  | 'editor'   // 편집자 (편집만)
  | 'viewer';  // 관찰자 (읽기만)

/**
 * 프로젝트 멤버 정보
 */
export interface ProjectMember {
  userId: string;
  userName: string;
  userEmail: string;
  role: ProjectMemberRole;
  addedAt: number;
  addedBy: string;
}

export interface GanttTemplate {
  id: string;
  title: string;
  description: string;
  tasks: GanttSubTask[];
  createdAt: number;
  startDate?: string;         // Project start date (YYYY-MM-DD format)
  createdBy?: string;         // Author UID
  createdByEmail?: string;    // Author email

  // Phase 10: Access Control
  ownerId?: string;                    // Current owner (transferable)
  visibility?: ProjectVisibility;      // Access scope
  members?: ProjectMember[];           // Role-based members
  memberIds?: string[];                // Query optimization: List of user IDs from members

  // Phase 10: Department integration
  primaryDepartmentId?: string;        // Primary department
  departmentIds?: string[];            // Related departments

  // Phase 10: Metadata
  isArchived?: boolean;                // Archived flag
  archivedAt?: number;
  lastModifiedBy?: string;
  lastModifiedAt?: number;

  // Legacy compatibility (deprecated but maintained)
  isShared?: boolean;                  // @deprecated - use visibility: 'public'
  isTemplate?: boolean;                // Reusable template flag
  assignees?: string[];                // @deprecated - use members
}

export interface GanttProject {
  id: string;
  templateId: string;
  title: string;
  tasks: GanttSubTask[];
  progress: number;         // 0-100
  startedAt: number;
  lastUpdated: number;
  ownerId: string;
}

export const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// 9-tier role system (ordered from highest to lowest)
export type UserRole = 'master' | 'admin' | 'manager' | 'editor' | 'math_lead' | 'english_lead' | 'user' | 'viewer' | 'guest';

export const ROLE_HIERARCHY: UserRole[] = ['master', 'admin', 'manager', 'editor', 'math_lead', 'english_lead', 'user', 'viewer', 'guest'];

export const ROLE_LABELS: Record<UserRole, string> = {
  master: 'MASTER',
  admin: 'ADMIN',
  manager: 'MANAGER',
  editor: 'EDITOR',
  math_lead: '수학팀장',
  english_lead: '영어팀장',
  user: 'USER',
  viewer: 'VIEWER',
  guest: 'GUEST'
};

// Permission IDs for granular control
export type PermissionId =
  | 'events.create' | 'events.edit_own' | 'events.edit_others'
  | 'events.delete_own' | 'events.delete_others' | 'events.drag_move'
  | 'events.attendance'
  | 'buckets.edit_lower_roles' | 'buckets.delete_lower_roles'
  | 'departments.view_all' | 'departments.create' | 'departments.edit' | 'departments.delete'
  | 'users.view' | 'users.approve' | 'users.change_role' | 'users.change_permissions'
  | 'settings.access' | 'settings.holidays' | 'settings.role_permissions' | 'settings.manage_categories'
  | 'system.teachers.view' | 'system.teachers.edit'
  | 'system.classes.view' | 'system.classes.edit'
  | 'timetable.math.view' | 'timetable.math.edit'
  | 'timetable.english.view' | 'timetable.english.edit'
  | 'timetable.english.simulation'
  | 'timetable.english.backup.view' | 'timetable.english.backup.restore'
  | 'timetable.integrated.view'
  | 'gantt.view' | 'gantt.create' | 'gantt.edit' | 'gantt.delete';

// Role-based permission configuration (stored in Firestore)
export type RolePermissions = {
  [role in Exclude<UserRole, 'master'>]?: Partial<Record<PermissionId, boolean>>;
};

// Default permissions for each role (MASTER has all, these are for others)
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: {
    'events.create': true, 'events.edit_own': true, 'events.edit_others': true,
    'events.delete_own': true, 'events.delete_others': true, 'events.drag_move': true,
    'events.attendance': true,
    'buckets.edit_lower_roles': true, 'buckets.delete_lower_roles': true,
    'departments.view_all': true, 'departments.create': true, 'departments.edit': true, 'departments.delete': false,
    'users.view': true, 'users.approve': true, 'users.change_role': false, 'users.change_permissions': true,
    'settings.access': true, 'settings.holidays': true, 'settings.role_permissions': false, 'settings.manage_categories': true,
    'system.teachers.view': true, 'system.teachers.edit': true,
    'system.classes.view': true, 'system.classes.edit': true,
    'timetable.math.view': true, 'timetable.math.edit': true,
    'timetable.english.view': true, 'timetable.english.edit': true,
    'timetable.english.simulation': true,
    'timetable.english.backup.view': true, 'timetable.english.backup.restore': true,
    'timetable.integrated.view': true,
    'gantt.view': true, 'gantt.create': true, 'gantt.edit': true, 'gantt.delete': true,
  },
  manager: {
    'events.create': true, 'events.edit_own': true, 'events.edit_others': true,
    'events.delete_own': true, 'events.delete_others': true, 'events.drag_move': true,
    'events.attendance': true,
    'buckets.edit_lower_roles': true, 'buckets.delete_lower_roles': true,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': true, 'departments.delete': false,
    'users.view': true, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    'timetable.english.simulation': true,
    'timetable.english.backup.view': true, 'timetable.english.backup.restore': false,
    'gantt.view': true, 'gantt.create': true, 'gantt.edit': true, 'gantt.delete': false,
  },
  editor: {
    'events.create': true, 'events.edit_own': true, 'events.edit_others': false,
    'events.delete_own': true, 'events.delete_others': false, 'events.drag_move': true,
    'events.attendance': true,
    'buckets.edit_lower_roles': false, 'buckets.delete_lower_roles': false,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': false, 'departments.delete': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  math_lead: {
    'events.create': true, 'events.edit_own': true, 'events.edit_others': false,
    'events.delete_own': true, 'events.delete_others': false, 'events.drag_move': true,
    'events.attendance': true,
    'buckets.edit_lower_roles': false, 'buckets.delete_lower_roles': false,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': false, 'departments.delete': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    'timetable.math.view': true, 'timetable.math.edit': true,
    'timetable.english.view': true, 'timetable.english.edit': false,
    'system.classes.view': true, 'system.classes.edit': true,
  },
  english_lead: {
    'events.create': true, 'events.edit_own': true, 'events.edit_others': false,
    'events.delete_own': true, 'events.delete_others': false, 'events.drag_move': true,
    'events.attendance': true,
    'buckets.edit_lower_roles': false, 'buckets.delete_lower_roles': false,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': false, 'departments.delete': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    'timetable.math.view': true, 'timetable.math.edit': false,
    'timetable.english.view': true, 'timetable.english.edit': true,
    'system.classes.view': true, 'system.classes.edit': true,
  },
  user: {
    'events.create': true, 'events.edit_own': true, 'events.edit_others': false,
    'events.delete_own': true, 'events.delete_others': false, 'events.drag_move': true,
    'events.attendance': true,
    'buckets.edit_lower_roles': false, 'buckets.delete_lower_roles': false,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': false, 'departments.delete': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  viewer: {
    'events.create': false, 'events.edit_own': false, 'events.edit_others': false,
    'events.delete_own': false, 'events.delete_others': false, 'events.drag_move': false,
    'events.attendance': false,
    'buckets.edit_lower_roles': false, 'buckets.delete_lower_roles': false,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': false, 'departments.delete': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  guest: {
    'events.create': false, 'events.edit_own': false, 'events.edit_others': false,
    'events.delete_own': false, 'events.delete_others': false, 'events.drag_move': false,
    'events.attendance': false,
    'buckets.edit_lower_roles': false, 'buckets.delete_lower_roles': false,
    'departments.view_all': false, 'departments.create': false, 'departments.edit': false, 'departments.delete': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
};

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  status: 'approved' | 'pending' | 'rejected';
  /** @deprecated Use granular permissions instead (kept for migration) */
  allowedDepartments?: string[];
  // Granular permissions per department (maintained)
  departmentPermissions?: Record<string, 'view' | 'edit'>;
  // Favorite departments (user-specific bookmarks)
  favoriteDepartments?: string[];

  // Phase 6: User's own department for Gantt visibility='department' feature
  departmentId?: string;  // User's primary department (e.g., 'math', 'english')

  /** @deprecated Use role-based permissions (isMaster/isAdmin) */
  canEdit?: boolean;
  /** @deprecated Use 'settings.access' or 'departments.view_all' permission */
  canManageMenus?: boolean;
  /** @deprecated Use 'events.edit_others' permission */
  canManageEventAuthors?: boolean;
  displayName?: string; // 이름 (표시명)
  jobTitle?: string; // 호칭
}

export interface Holiday {
  id: string;      // Usually 'YYYY-MM-DD'
  date: string;    // 'YYYY-MM-DD'
  name: string;
  type: 'public' | 'custom';
}

// ============ TIMETABLE TYPES ============

export interface TimetableStudent {
  id: string;
  name: string;
  englishName?: string; // 영어 이름
  grade?: string;       // 학년
  school?: string;      // 학교
  underline?: boolean;  // 밑줄 표시 여부
  enrollmentDate?: string; // 신입생 등록일 (YYYY-MM-DD)
  withdrawalDate?: string; // 퇴원일 (YYYY-MM-DD)
  onHold?: boolean; // 대기생 여부
  personalSchedule?: { day: string; period: string }[];
}

export interface TimetableClass {
  id: string;
  className: string;    // 수업명
  teacher: string;      // 담당 강사
  room?: string;        // 교실
  subject: string;      // 과목 (수학/영어/기타)
  schedule: string[];   // ["월 1교시", "수 3교시"]
  studentList: TimetableStudent[];
  color?: string;
  order?: number;
}

export interface Teacher {
  id: string;
  name: string;
  subjects?: string[];  // 담당 과목
  isHidden?: boolean;   // 시간표 표시 여부
  isNative?: boolean;   // 원어민 강사 여부
  color?: string;
  bgColor?: string;     // 퍼스널 배경색
  textColor?: string;   // 퍼스널 글자색
  order?: number;
  defaultRoom?: string; // 기본 강의실 (자동 입력용)
}

// 수업 키워드 색상 설정
export interface ClassKeywordColor {
  id: string;
  keyword: string;      // 키워드 (예: 'Phonics', 'Grammar')
  bgColor: string;      // 배경색
  textColor: string;    // 글자색
  order?: number;
}

// English Level System
export interface EnglishLevel {
  id: string;          // e.g., "dp", "pl"
  abbreviation: string;// e.g., "DP"
  fullName: string;    // e.g., "Dr. Phonics"
  order: number;       // Sort order index
  color?: string;      // Optional color
}

export interface LevelSettings {
  levels: EnglishLevel[];
}

// Parsed Class Name for Level Up
export interface ParsedClassName {
  levelAbbr: string;  // "DP", "RTT", "LE"
  number: number;     // 3, 6, 5
  suffix: string;     // "", "a", "b"
}

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
export type AppTab = 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'system';

export const APP_TABS: { id: AppTab; label: string }[] = [
  { id: 'calendar', label: '연간 일정' },
  { id: 'timetable', label: '시간표' },
  { id: 'payment', label: '전자 결제' },
  { id: 'gantt', label: '간트 차트' },
  { id: 'consultation', label: '상담 관리' },
  { id: 'system', label: '시스템 설정' },
];

// Configuration for Tab Access (Stored in system/config -> tabPermissions)
// Key: UserRole, Value: Array of allowed AppTab IDs
export type TabPermissionConfig = {
  [key in UserRole]?: AppTab[];
};

// Default Tab Permissions (Fallback)
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  master: ['calendar', 'timetable', 'payment', 'gantt', 'consultation', 'system'],
  admin: ['calendar', 'timetable'], // consultation removed - testing phase
  manager: ['calendar'],
  editor: ['calendar'],
  math_lead: ['timetable'],
  english_lead: ['timetable'],
  user: ['calendar'],
  viewer: ['calendar'],
  guest: ['calendar'],
};

export interface SystemConfig {
  eventLookbackYears?: number;
  categories?: string[];
  tabPermissions?: TabPermissionConfig;
  masterEmails?: string[]; // List of master account emails
}

// ============ CONSULTATION TYPES (Phase 13: EduCRM Integration) ============

export enum ConsultationStatus {
  EngMathRegistered = '영수등록',
  MathRegistered = '수학등록',
  EngRegistered = '영어등록',
  PendingThisMonth = '이번달 등록예정',
  PendingFuture = '추후 등록예정',
  NotRegistered = '미등록',
}

export enum ConsultationSubject {
  English = '영어',
  EiE = 'EiE',
  Math = '수학',
  Korean = '국어',
  Other = '기타',
}

export enum SchoolGrade {
  ElementaryLow = '초등 저학년',
  ElementaryHigh = '초등 고학년',
  Middle1 = '중1',
  Middle2 = '중2',
  Middle3 = '중3',
  High1 = '고1',
  High2 = '고2',
  High3 = '고3',
  Other = '기타',
}

export interface ConsultationRecord {
  id: string;
  studentName: string;
  parentPhone: string;
  schoolName: string;
  grade: SchoolGrade;
  consultationDate: string; // ISO Date string (YYYY-MM-DD)

  subject: ConsultationSubject;
  status: ConsultationStatus;

  counselor: string;
  registrar: string;

  paymentAmount: string;
  paymentDate: string;

  notes: string;
  nonRegistrationReason: string;

  followUpDate: string;
  followUpContent: string;

  consultationPath: string;

  createdAt: string;
  updatedAt?: string;
  authorId?: string;
}

export interface ConsultationStats {
  totalConsultations: number;
  registeredCount: number;
  conversionRate: number;
  pendingCount: number;
}

// Consultation Status Colors for UI
export const CONSULTATION_STATUS_COLORS: Record<ConsultationStatus, string> = {
  [ConsultationStatus.EngMathRegistered]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [ConsultationStatus.MathRegistered]: 'bg-teal-100 text-teal-800 border-teal-200',
  [ConsultationStatus.EngRegistered]: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  [ConsultationStatus.PendingThisMonth]: 'bg-amber-100 text-amber-800 border-amber-200',
  [ConsultationStatus.PendingFuture]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [ConsultationStatus.NotRegistered]: 'bg-slate-100 text-slate-800 border-slate-200',
};

export const CONSULTATION_CHART_COLORS = ['#059669', '#0d9488', '#0891b2', '#f59e0b', '#fbbf24', '#94a3b8'];

