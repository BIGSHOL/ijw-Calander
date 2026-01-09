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

// Detailed Enrollment Information
export interface Enrollment {
  subject: 'math' | 'english';
  classId: string;    // Document ID of the class
  className: string;  // Name of the class
  teacherId: string;  // Teacher Name/ID
  days: string[];     // Class schedule days (e.g., ['월', '수'])
}

// Phase 1: Unified Student DB
export interface UnifiedStudent {
  // 기본 정보
  id: string;                    // UUID
  name: string;                  // 이름
  englishName?: string | null;   // 영어 이름
  school?: string;               // 학교
  grade?: string;                // 학년

  // 수강 정보 (v5: 계층형 구조)
  enrollments: Enrollment[];     // 상세 수강 정보 (Subject -> Class -> Teacher mapping)



  // 상태 관리
  status: 'active' | 'on_hold' | 'withdrawn';
  startDate: string;             // 등록일 (YYYY-MM-DD)
  endDate?: string;              // 퇴원일
  withdrawalDate?: string;       // 퇴원일 (YYYY-MM-DD) - 영어 시간표와 호환
  isOldWithdrawn?: boolean;      // 90일 이상 경과한 퇴원생 표시 (검색용)

  // 출석부 연동
  salarySettingId?: string;      // 급여 설정
  group?: string;                // 반 이름 (UI 표시용, 동적으로 계산됨)

  // 메타데이터
  createdAt: string;
  updatedAt: string;
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
  isArchived?: boolean;        // True if event is from archived_events collection
  // Phase 14: Hashtag & Event Type Support
  tags?: string[];             // 해시태그 ID 배열 (예: ['meeting', 'deadline'])
  eventType?: 'general' | 'seminar'; // 이벤트 유형
  seminarData?: {              // 세미나 전용 데이터 (eventType === 'seminar'일 때)
    speaker?: string;
    speakerBio?: string;
    manager?: string;
    managerContact?: string;
    maxAttendees?: number;
    venue?: string;
    materials?: string[];
    registrationDeadline?: string;
    isPublic?: boolean;
  };
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

// ============ ENGLISH TIMETABLE SCENARIO ============

export interface ScenarioEntry {
  id: string;                        // 문서 ID
  name: string;                      // 시나리오 이름
  description: string;               // 상세 설명

  // 스냅샷 데이터
  data: Record<string, any>;         // english_schedules_draft
  studentData: Record<string, any>;  // 수업목록_draft

  // 메타데이터
  createdAt: string;
  createdBy: string;
  createdByUid: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByUid?: string;

  // 통계 (UI 표시용)
  stats?: {
    timetableDocCount: number;
    classCount: number;
    studentCount: number;
  };
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

// 11-tier role system (ordered from highest to lowest)
export type UserRole = 'master' | 'admin' | 'manager' | 'editor' | 'math_lead' | 'english_lead' | 'math_teacher' | 'english_teacher' | 'user' | 'viewer' | 'guest';

export const ROLE_HIERARCHY: UserRole[] = ['master', 'admin', 'manager', 'editor', 'math_lead', 'english_lead', 'math_teacher', 'english_teacher', 'user', 'viewer', 'guest'];

export const ROLE_LABELS: Record<UserRole, string> = {
  master: 'MASTER',
  admin: 'ADMIN',
  manager: 'MANAGER',
  editor: 'EDITOR',
  math_lead: '수학팀장',
  english_lead: '영어팀장',
  math_teacher: '수학선생님',
  english_teacher: '영어선생님',
  user: 'USER',
  viewer: 'VIEWER',
  guest: 'GUEST'
};

// Permission IDs for granular control
export type PermissionId =
  // Calendar Events (consolidated)
  | 'events.create' | 'events.manage_own' | 'events.manage_others'
  | 'events.drag_move' | 'events.attendance'
  | 'events.bucket'  // Bucket list management (was buckets.edit/delete_lower_roles)
  // Departments (consolidated)
  | 'departments.view_all' | 'departments.manage'  // Was create/edit/delete
  // Users
  | 'users.view' | 'users.approve' | 'users.change_role' | 'users.change_permissions'
  // Settings
  | 'settings.access' | 'settings.holidays' | 'settings.role_permissions' | 'settings.manage_categories'
  // System - Teachers & Classes
  | 'system.teachers.view' | 'system.teachers.edit'
  | 'system.classes.view' | 'system.classes.edit'
  // Timetable
  | 'timetable.math.view' | 'timetable.math.edit'
  | 'timetable.english.view' | 'timetable.english.edit'
  | 'timetable.english.simulation'
  | 'timetable.english.backup.view' | 'timetable.english.backup.restore'
  | 'timetable.integrated.view'
  // Gantt
  | 'gantt.view' | 'gantt.create' | 'gantt.edit' | 'gantt.delete'
  // Attendance (consolidated)
  | 'attendance.manage_own'  // Was view_own + edit_own
  | 'attendance.edit_all'
  | 'attendance.manage_math' | 'attendance.manage_english'
  | 'attendance.edit_student_info';

// Role-based permission configuration (stored in Firestore)
export type RolePermissions = {
  [role in Exclude<UserRole, 'master'>]?: Partial<Record<PermissionId, boolean>>;
};

// Default permissions for each role (MASTER has all, these are for others)
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: {
    'events.create': true, 'events.manage_own': true, 'events.manage_others': true,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': true,
    'departments.view_all': true, 'departments.manage': true,
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
    // Attendance (Admin: full access)
    'attendance.manage_own': true, 'attendance.edit_all': true,
    'attendance.manage_math': true, 'attendance.manage_english': true,
    'attendance.edit_student_info': true,
  },
  manager: {
    'events.create': true, 'events.manage_own': true, 'events.manage_others': true,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': true,
    'departments.view_all': true, 'departments.manage': false,
    'users.view': true, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    'timetable.english.simulation': true,
    'timetable.english.backup.view': true, 'timetable.english.backup.restore': false,
    'gantt.view': true, 'gantt.create': true, 'gantt.edit': true, 'gantt.delete': false,
    // Attendance (Manager: full access)
    'attendance.manage_own': true, 'attendance.edit_all': true,
    'attendance.manage_math': true, 'attendance.manage_english': true,
    'attendance.edit_student_info': true,
  },
  editor: {
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  math_lead: {
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    'timetable.math.view': true, 'timetable.math.edit': true,
    'timetable.english.view': true, 'timetable.english.edit': false,
    'system.classes.view': true, 'system.classes.edit': true,
    // Attendance (Math Lead: manage math, view/edit all math students)
    'attendance.manage_own': true, 'attendance.edit_all': true,
    'attendance.manage_math': true, 'attendance.manage_english': false,
    'attendance.edit_student_info': true,
  },
  english_lead: {
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    'timetable.math.view': true, 'timetable.math.edit': false,
    'timetable.english.view': true, 'timetable.english.edit': true,
    'system.classes.view': true, 'system.classes.edit': true,
    // Attendance (English Lead: manage english, view/edit all english students)
    'attendance.manage_own': true, 'attendance.edit_all': true,
    'attendance.manage_math': false, 'attendance.manage_english': true,
    'attendance.edit_student_info': true,
  },
  math_teacher: {
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    'timetable.math.view': true, 'timetable.math.edit': false,
    'timetable.english.view': false, 'timetable.english.edit': false,
    // Attendance (Math Teacher: view/edit own students only)
    'attendance.manage_own': true, 'attendance.edit_all': false,
    'attendance.manage_math': false, 'attendance.manage_english': false,
    'attendance.edit_student_info': false,
  },
  english_teacher: {
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    'timetable.math.view': false, 'timetable.math.edit': false,
    'timetable.english.view': true, 'timetable.english.edit': false,
    // Attendance (English Teacher: view/edit own students only)
    'attendance.manage_own': true, 'attendance.edit_all': false,
    'attendance.manage_math': false, 'attendance.manage_english': false,
  },
  user: {
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  viewer: {
    'events.create': false, 'events.manage_own': false, 'events.manage_others': false,
    'events.drag_move': false, 'events.attendance': false, 'events.bucket': false,
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  guest: {
    'events.create': false, 'events.manage_own': false, 'events.manage_others': false,
    'events.drag_move': false, 'events.attendance': false, 'events.bucket': false,
    'departments.view_all': false, 'departments.manage': false,
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

  // Attendance: Link to Teacher Profile (for view_own filtering)
  teacherId?: string; // ID from 강사목록 collection (allows any role to be linked to a teacher)
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
  isMoved?: boolean; // 반이동 학생 여부
  personalSchedule?: { day: string; period: string }[];
}

export interface TimetableClass {
  id: string;
  className: string;    // 수업명
  teacher: string;      // 담당 강사
  room?: string;        // 교실
  subject: string;      // 과목 (수학/영어/기타)
  schedule: string[];   // ["월 1교시", "수 3교시"]
  studentList?: TimetableStudent[]; // @deprecated Use studentIds with UnifiedStudent
  studentIds?: string[];            // Link to students collection
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
export type AppTab = 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students' | 'grades';

// Tab Metadata - 각 탭의 메타정보 (확장 가능)
export interface TabMetadata {
  id: AppTab;
  label: string;
  icon: string;
}

export const TAB_META: Record<AppTab, Omit<TabMetadata, 'id'>> = {
  calendar: { label: '연간 일정', icon: '📅' },
  timetable: { label: '시간표', icon: '📋' },
  attendance: { label: '출석부', icon: '📝' },
  payment: { label: '전자 결제', icon: '💳' },
  gantt: { label: '간트 차트', icon: '📊' },
  consultation: { label: '콜앤상담', icon: '📞' },
  students: { label: '학생 관리', icon: '👥' },
  grades: { label: '성적 관리', icon: '📊' },
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
    tabs: ['timetable', 'attendance'],
    order: 2,
  },
  {
    id: 'student',
    label: '학생',
    icon: '👥',
    tabs: ['students', 'consultation', 'grades'],
    order: 3,
  },
  {
    id: 'admin',
    label: '관리',
    icon: '⚙️',
    tabs: ['payment'],
    order: 4,
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
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  master: ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation', 'students', 'grades'],
  admin: ['calendar', 'timetable', 'attendance', 'payment', 'students', 'grades'],
  manager: ['calendar', 'attendance', 'students', 'grades'],
  editor: ['calendar'],
  math_lead: ['timetable', 'attendance', 'students', 'grades'],
  english_lead: ['timetable', 'attendance', 'students', 'grades'],
  user: ['calendar', 'attendance'],
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
  Elementary1 = '초1',
  Elementary2 = '초2',
  Elementary3 = '초3',
  Elementary4 = '초4',
  Elementary5 = '초5',
  Elementary6 = '초6',
  ElementaryLow = '초등 저학년', // Legacy support
  ElementaryHigh = '초등 고학년', // Legacy support
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
  address?: string; // 주소 추가
  consultationDate: string; // ISO Date string (YYYY-MM-DD)

  subject: ConsultationSubject;
  status: ConsultationStatus;

  counselor: string;
  receiver: string; // 수신자 (전화받고 입력한 사람)
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

// ============ GRADE MANAGEMENT TYPES (GradeGuard Integration) ============

/**
 * 시험 범위 (누가 치는 시험인가?)
 */
export type ExamScope = 'class' | 'grade' | 'subject' | 'school' | 'academy';

/**
 * 시험 범위 라벨
 */
export const EXAM_SCOPE_LABELS: Record<ExamScope, string> = {
  class: '반별',
  grade: '학년별',
  subject: '과목별',
  school: '학교별',
  academy: '학원 전체',
};

/**
 * 시험 유형
 */
export type ExamType =
  | 'daily'        // 일일 테스트
  | 'weekly'       // 주간 테스트
  | 'monthly'      // 월말평가
  | 'midterm'      // 중간고사
  | 'final'        // 기말고사
  | 'mock'         // 모의고사
  | 'school'       // 학교 내신
  | 'competition'  // 경시대회
  | 'diagnostic'   // 진단 평가
  | 'other';       // 기타

/**
 * 시험 정보
 */
export interface Exam {
  id: string;
  title: string;             // "1월 모의고사", "중간고사"
  date: string;              // YYYY-MM-DD
  type: ExamType;
  subject: 'math' | 'english' | 'both';  // 수학/영어/통합
  maxScore: number;          // 만점 (기본 100)
  description?: string;      // 시험 설명

  // 시험 범위 관련
  scope: ExamScope;                      // 시험 범위
  targetClassIds?: string[];             // scope='class'일 때 대상 반 IDs
  targetGrades?: string[];               // scope='grade'일 때 대상 학년들 ['중1', '중2']
  targetSchools?: string[];              // scope='school'일 때 대상 학교들

  // 태그 및 시리즈
  tags?: string[];                       // 태그 배열 ['#내신대비', '#재시험']
  seriesId?: string;                     // 시험 시리즈 ID
  seriesName?: string;                   // 시리즈 이름 (조회 편의)

  // 메타데이터
  createdBy: string;         // UID
  createdByName?: string;    // 생성자 이름
  createdAt: number;
  updatedAt?: number;

  // 통계 (비정규화 - 읽기 비용 최적화)
  stats?: ExamStats;
}

/**
 * 시험 성적 통계 (Exam 문서에 비정규화되어 저장됨)
 */
export interface ExamStats {
  count: number;     // 응시자 수
  avg: number;       // 전체 평균
  max: number;       // 최고점
  min: number;       // 최저점
}

/**
 * 학생별 성적
 */
export interface StudentScore {
  id: string;
  studentId: string;         // UnifiedStudent.id와 연결
  studentName?: string;      // 스냅샷 (조회 편의)
  examId: string;            // Exam.id와 연결
  examTitle?: string;        // 스냅샷 (조회 편의)
  subject: 'math' | 'english';
  score: number;             // 점수
  maxScore: number;          // 만점 (Exam에서 복사)
  percentage?: number;       // 백분율 (score/maxScore * 100)

  // 선택적 통계
  average?: number;          // 반/학원 평균
  rank?: number;             // 석차
  totalStudents?: number;    // 전체 학생수
  grade?: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'F';

  // 메모
  memo?: string;

  // 메타데이터
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  createdByName?: string;
}

/**
 * 학생 성적 요약 (조회용)
 */
export interface StudentGradeSummary {
  studentId: string;
  studentName: string;
  recentScores: StudentScore[];    // 최근 5개 성적
  averageScore: number;            // 평균 점수
  totalExams: number;              // 총 시험 수
  trend: 'up' | 'down' | 'stable'; // 성적 추이
}

/**
 * 성적 등급 계산 헬퍼
 */
export const calculateGrade = (percentage: number): StudentScore['grade'] => {
  if (percentage >= 97) return 'A+';
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 60) return 'D';
  return 'F';
};

/**
 * 성적 등급별 색상
 */
export const GRADE_COLORS: Record<NonNullable<StudentScore['grade']>, { bg: string; text: string; border: string }> = {
  'A+': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  'A': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'A-': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'B+': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'B': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'B-': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  'C+': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  'C': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'C-': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'D+': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  'D': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'F': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
};

/**
 * 시험 유형 라벨
 */
export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  daily: '일일 테스트',
  weekly: '주간 테스트',
  monthly: '월말평가',
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
  school: '학교 내신',
  competition: '경시대회',
  diagnostic: '진단 평가',
  other: '기타',
};

// ============ CALENDAR HASHTAG & SEMINAR TYPES ============

/**
 * 이벤트 해시태그 (검색 및 분류용)
 */
export interface EventTag {
  id: string;           // 고유 ID (자동 생성 또는 태그명 기반)
  name: string;         // 태그명 (예: "회의", "세미나", "시험")
  color?: string;       // 태그 색상 (선택)
  usageCount?: number;  // 사용 횟수 (추천용)
}

/**
 * 이벤트 유형
 */
export type CalendarEventType = 'general' | 'seminar';

/**
 * 세미나 참석자 정보 (확장)
 */
export interface SeminarAttendee {
  id: string;

  // 기본 정보
  name: string;
  phone: string;              // 전화번호 (필수)
  isCurrentStudent: boolean;  // 재원생 여부
  studentId?: string;         // 재원생인 경우 학생 ID (기존 학생 데이터 연동)

  // 비재원생 정보
  gender?: 'male' | 'female';
  ageGroup?: 'elementary' | 'middle' | 'high' | 'adult';  // 연령대
  grade?: string;             // 학년 (초1, 중2, 고3 등)
  address?: string;           // 주소 (간단히)

  // 신청 정보
  registrationSource?: string; // 신청경로 (지인소개, 온라인, 전단지 등)
  parentAttending?: boolean;   // 부모 참석 여부
  companions?: string[];       // 동석자 이름 목록

  // 담당 및 상태
  assignedTeacherId?: string;  // 담당 선생님 ID
  assignedTeacherName?: string; // 담당 선생님 이름
  status: 'registered' | 'confirmed' | 'attended' | 'cancelled' | 'no-show';

  // 메타 정보
  registeredAt: string;       // ISO Date string
  memo?: string;              // 메모
  createdBy?: string;         // 등록자 ID
  updatedAt?: string;         // 수정일
}

/**
 * 세미나 이벤트 확장 필드
 */
export interface SeminarEventData {
  // 연사 정보
  speaker?: string;           // 발표자/강연자 이름
  speakerBio?: string;        // 발표자 소개
  speakerContact?: string;    // 연사 연락처

  // 관리 정보
  manager?: string;           // 담당자
  managerContact?: string;    // 담당자 연락처
  maxAttendees?: number;      // 최대 참석 인원

  // 참석자 목록
  attendees?: SeminarAttendee[]; // 참석자 목록

  // 장소 및 자료
  venue?: string;             // 장소 상세
  materials?: string[];       // 자료 링크들

  // 기타
  registrationDeadline?: string; // 등록 마감일
  isPublic?: boolean;         // 외부 공개 여부
}

/**
 * 기본 해시태그 목록 (초기 제안용)
 */
export const DEFAULT_EVENT_TAGS: EventTag[] = [
  { id: 'meeting', name: '회의', color: '#3B82F6' },
  { id: 'seminar', name: '세미나', color: '#8B5CF6' },
  { id: 'exam', name: '시험', color: '#EF4444' },
  { id: 'holiday', name: '휴일', color: '#10B981' },
  { id: 'deadline', name: '마감', color: '#F59E0B' },
  { id: 'event', name: '행사', color: '#EC4899' },
  { id: 'training', name: '연수', color: '#06B6D4' },
  { id: 'parent-meeting', name: '학부모상담', color: '#84CC16' },
];
