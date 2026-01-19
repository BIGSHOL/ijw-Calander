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
  defaultPermission?: 'view' | 'edit' | 'none'; // 신규 부서 생성 시 기본 권한
}

// Subject Type for unified structure
export type SubjectType = 'math' | 'english' | 'science' | 'korean' | 'other';

// Detailed Enrollment Information
export interface Enrollment {
  subject: 'math' | 'english' | 'science' | 'korean' | 'other';
  classId: string;    // Document ID of the class
  className: string;  // Name of the class
  teacherId: string;  // Teacher Name/ID
  days: string[];     // Class schedule days (e.g., ['월', '수'])
  attendanceDays?: string[];  // 실제 등원 요일 (비어있거나 없으면 모든 수업 요일에 등원)
}

// Phase 1: Unified Schedule Slot
export interface ScheduleSlot {
  day: string;           // 요일 (월, 화, 수, 목, 금, 토, 일)
  periodId: string;      // 교시 ID (e.g., "1-1", "5")
  startTime?: string;    // 시작 시간 (HH:mm)
  endTime?: string;      // 종료 시간 (HH:mm)
  room?: string;         // 강의실 (슬롯별로 다를 수 있음)
  teacher?: string;      // 담당 강사 (영어는 요일별로 다를 수 있음)
}

// Phase 1: Unified Class Structure
export interface UnifiedClass {
  id: string;
  className: string;
  subject: SubjectType;
  teacher: string;              // 주 담당 강사
  assistants?: string[];        // 보조 강사 (영어 원어민 등)
  room?: string;                // 기본 강의실
  schedule: ScheduleSlot[];     // 통일된 스케줄
  color?: string;
  isActive: boolean;

  // 레거시 호환
  legacySchedule?: string[];    // 기존 "월 1교시" 형식

  // 마이그레이션 메타데이터
  migratedFrom?: 'math' | 'english';
  originalDocId?: string;
  createdAt: string;
  updatedAt: string;
}

// Phase 1: Unified Student DB
export interface UnifiedStudent {
  // 기본 정보
  id: string;                    // UUID
  name: string;                  // 이름
  englishName?: string | null;   // 영어 이름
  school?: string;               // 학교
  grade?: string;                // 학년
  gender?: 'male' | 'female';    // 성별

  // 연락처 정보
  studentPhone?: string;         // 학생 휴대폰
  parentPhone?: string;          // 보호자 휴대폰 (SMS)
  parentName?: string;           // 보호자명
  parentRelation?: string;       // 보호자 관계 (모, 부, 기타)
  otherPhone?: string;           // 기타 알림 번호
  otherPhoneRelation?: string;   // 기타 알림 관계
  homePhone?: string;            // 원생 집전화

  // 주소 정보
  zipCode?: string;              // 우편번호
  address?: string;              // 주소
  addressDetail?: string;        // 상세주소

  // 추가 정보
  birthDate?: string;            // 생년월일 (YYYY-MM-DD)
  nickname?: string;             // 닉네임
  studentEmail?: string;         // 원생 이메일
  emailDomain?: string;          // 이메일 도메인
  enrollmentReason?: string;     // 입학동기

  // 형제 정보
  siblings?: string[];           // 형제 학생 ID 배열

  // 수납 정보
  cashReceiptNumber?: string;           // 현금영수증 발급용 번호
  cashReceiptType?: 'income' | 'expense'; // 소득공제용/지출증빙용
  billingDay?: number;                  // 수납 청구일 (매월)
  billingDiscount?: number;             // 수납 기본할인 (원)

  // 알림 설정
  smsNotification?: boolean;            // 등하원알림 (SMS)
  pushNotification?: boolean;           // 등하원알림 (푸시)
  kakaoNotification?: boolean;          // 등하원알림 (알림톡)
  otherSmsNotification?: boolean;       // 기타번호 등하원알림 (SMS)
  otherKakaoNotification?: boolean;     // 기타번호 등하원알림 (알림톡)
  billingSmsPrimary?: boolean;          // 수납문자발송 - 보호자
  billingSmsOther?: boolean;            // 수납문자발송 - 기타보호자
  overdueSmsPrimary?: boolean;          // 미납문자발송 - 보호자
  overdueSmsOther?: boolean;            // 미납문자발송 - 기타보호자

  // 기타 정보
  graduationYear?: string;              // 졸업연도
  customField1?: string;                // 기타항목1
  customField2?: string;                // 기타항목2
  memo?: string;                        // 메모

  // 수강 정보 (v5: 계층형 구조)
  enrollments: Enrollment[];     // 상세 수강 정보 (Subject -> Class -> Teacher mapping)



  // 상태 관리
  // prospect = prospective (예비), waitlisted = waiting (대기) - 두 표기 모두 지원
  status: 'active' | 'on_hold' | 'withdrawn' | 'prospect' | 'prospective' | 'waitlisted' | 'waiting';
  startDate: string;             // 등록일 (YYYY-MM-DD)
  endDate?: string;              // 퇴원일
  withdrawalDate?: string;       // 퇴원일 (YYYY-MM-DD) - 영어 시간표와 호환
  withdrawalReason?: string;     // 퇴원 사유
  withdrawalMemo?: string;       // 퇴원 관련 메모
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
  seminarData?: SeminarEventData;    // 세미나 전용 데이터 (eventType === 'seminar'일 때)
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

// 8-tier role system (ordered from highest to lowest)
// Simplified from 11-tier: removed editor, viewer, guest (rarely used)
export type UserRole = 'master' | 'admin' | 'manager' | 'math_lead' | 'english_lead' | 'math_teacher' | 'english_teacher' | 'user';

export const ROLE_HIERARCHY: UserRole[] = ['master', 'admin', 'manager', 'math_lead', 'english_lead', 'math_teacher', 'english_teacher', 'user'];

export const ROLE_LABELS: Record<UserRole, string> = {
  master: 'MASTER',
  admin: 'ADMIN',
  manager: 'MANAGER',
  math_lead: '수학팀장',
  english_lead: '영어팀장',
  math_teacher: '수학선생님',
  english_teacher: '영어선생님',
  user: 'USER'
};

// Permission IDs for granular control
export type PermissionId =
  // Calendar Events
  | 'events.create' | 'events.manage_own' | 'events.manage_others'
  | 'events.drag_move' | 'events.attendance'
  | 'events.bucket'  // Bucket list management
  // Departments
  | 'departments.view_all' | 'departments.manage'
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
  | 'timetable.science.view' | 'timetable.science.edit'
  | 'timetable.korean.view' | 'timetable.korean.edit'
  | 'timetable.integrated.view'
  // Gantt
  | 'gantt.view' | 'gantt.create' | 'gantt.edit' | 'gantt.delete'
  // Attendance
  | 'attendance.manage_own' | 'attendance.edit_all'
  | 'attendance.manage_math' | 'attendance.manage_english'
  | 'attendance.manage_science' | 'attendance.manage_korean'
  | 'attendance.edit_student_info'
  // Students (NEW)
  | 'students.view' | 'students.edit' | 'students.delete'
  | 'students.enrollment.manage'  // 수강 배정 관리
  // Classes Management (NEW)
  | 'classes.view' | 'classes.create' | 'classes.edit' | 'classes.delete'
  // Consultation (NEW)
  | 'consultation.view' | 'consultation.create' | 'consultation.edit' | 'consultation.convert'  // convert: 예비원생→재원생
  // Grades (NEW)
  | 'grades.view' | 'grades.edit' | 'grades.manage_exams'
  // Billing (NEW)
  | 'billing.view' | 'billing.edit';

// Role-based permission configuration (stored in Firestore)
export type RolePermissions = {
  [role in Exclude<UserRole, 'master'>]?: Partial<Record<PermissionId, boolean>>;
};

// Default permissions for each role (MASTER has all, these are for others)
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: {
    // Events
    'events.create': true, 'events.manage_own': true, 'events.manage_others': true,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': true,
    // Departments & Users
    'departments.view_all': true, 'departments.manage': true,
    'users.view': true, 'users.approve': true, 'users.change_role': false, 'users.change_permissions': true,
    // Settings
    'settings.access': true, 'settings.holidays': true, 'settings.role_permissions': false, 'settings.manage_categories': true,
    // System
    'system.teachers.view': true, 'system.teachers.edit': true,
    'system.classes.view': true, 'system.classes.edit': true,
    // Timetable
    'timetable.math.view': true, 'timetable.math.edit': true,
    'timetable.english.view': true, 'timetable.english.edit': true,
    'timetable.english.simulation': true,
    'timetable.english.backup.view': true, 'timetable.english.backup.restore': true,
    'timetable.science.view': true, 'timetable.science.edit': true,
    'timetable.korean.view': true, 'timetable.korean.edit': true,
    'timetable.integrated.view': true,
    // Gantt
    'gantt.view': true, 'gantt.create': true, 'gantt.edit': true, 'gantt.delete': true,
    // Attendance
    'attendance.manage_own': true, 'attendance.edit_all': true,
    'attendance.manage_math': true, 'attendance.manage_english': true,
    'attendance.manage_science': true, 'attendance.manage_korean': true,
    'attendance.edit_student_info': true,
    // Students
    'students.view': true, 'students.edit': true, 'students.delete': true,
    'students.enrollment.manage': true,
    // Classes
    'classes.view': true, 'classes.create': true, 'classes.edit': true, 'classes.delete': true,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': true,
    // Grades
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': true,
    // Billing
    'billing.view': true, 'billing.edit': true,
  },
  manager: {
    // Events
    'events.create': true, 'events.manage_own': true, 'events.manage_others': true,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': true,
    // Departments & Users
    'departments.view_all': true, 'departments.manage': false,
    'users.view': true, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    // Settings
    'settings.access': true, 'settings.holidays': false, 'settings.role_permissions': false,
    // Timetable
    'timetable.math.view': true, 'timetable.math.edit': true,
    'timetable.english.view': true, 'timetable.english.edit': true,
    'timetable.english.simulation': true,
    'timetable.english.backup.view': true, 'timetable.english.backup.restore': false,
    'timetable.science.view': true, 'timetable.science.edit': true,
    'timetable.korean.view': true, 'timetable.korean.edit': true,
    'timetable.integrated.view': true,
    // Gantt
    'gantt.view': true, 'gantt.create': true, 'gantt.edit': true, 'gantt.delete': false,
    // Attendance
    'attendance.manage_own': true, 'attendance.edit_all': true,
    'attendance.manage_math': true, 'attendance.manage_english': true,
    'attendance.manage_science': true, 'attendance.manage_korean': true,
    'attendance.edit_student_info': true,
    // Students
    'students.view': true, 'students.edit': true, 'students.delete': false,
    'students.enrollment.manage': true,
    // Classes
    'classes.view': true, 'classes.create': true, 'classes.edit': true, 'classes.delete': false,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': true,
    // Grades
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': true,
    // Billing
    'billing.view': true, 'billing.edit': true,
  },
  math_lead: {
    // Events
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    // Departments & Users
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    // Settings
    'settings.access': true, 'settings.holidays': false, 'settings.role_permissions': false,
    // System
    'system.teachers.view': true, 'system.teachers.edit': false,
    'system.classes.view': true, 'system.classes.edit': true,
    // Timetable
    'timetable.math.view': true, 'timetable.math.edit': true,
    'timetable.english.view': true, 'timetable.english.edit': false,
    'timetable.science.view': true, 'timetable.science.edit': false,
    'timetable.korean.view': true, 'timetable.korean.edit': false,
    'timetable.integrated.view': true,
    // Attendance (manage math only)
    'attendance.manage_own': true, 'attendance.edit_all': true,
    'attendance.manage_math': true, 'attendance.manage_english': false,
    'attendance.manage_science': false, 'attendance.manage_korean': false,
    'attendance.edit_student_info': true,
    // Students
    'students.view': true, 'students.edit': true, 'students.delete': false,
    'students.enrollment.manage': true,
    // Classes
    'classes.view': true, 'classes.create': true, 'classes.edit': true, 'classes.delete': false,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': true,
    // Grades
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': true,
    // Billing
    'billing.view': true, 'billing.edit': false,
  },
  english_lead: {
    // Events
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    // Departments & Users
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    // Settings
    'settings.access': true, 'settings.holidays': false, 'settings.role_permissions': false,
    // System
    'system.teachers.view': true, 'system.teachers.edit': false,
    'system.classes.view': true, 'system.classes.edit': true,
    // Timetable
    'timetable.math.view': true, 'timetable.math.edit': false,
    'timetable.english.view': true, 'timetable.english.edit': true,
    'timetable.english.simulation': true,
    'timetable.english.backup.view': true, 'timetable.english.backup.restore': false,
    'timetable.science.view': true, 'timetable.science.edit': false,
    'timetable.korean.view': true, 'timetable.korean.edit': false,
    'timetable.integrated.view': true,
    // Attendance (manage english only)
    'attendance.manage_own': true, 'attendance.edit_all': true,
    'attendance.manage_math': false, 'attendance.manage_english': true,
    'attendance.manage_science': false, 'attendance.manage_korean': false,
    'attendance.edit_student_info': true,
    // Students
    'students.view': true, 'students.edit': true, 'students.delete': false,
    'students.enrollment.manage': true,
    // Classes
    'classes.view': true, 'classes.create': true, 'classes.edit': true, 'classes.delete': false,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': true,
    // Grades
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': true,
    // Billing
    'billing.view': true, 'billing.edit': false,
  },
  math_teacher: {
    // Events
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    // Departments & Users
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    // Settings
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    // System
    'system.teachers.view': true, 'system.teachers.edit': false,
    'system.classes.view': true, 'system.classes.edit': false,
    // Timetable (view only)
    'timetable.math.view': true, 'timetable.math.edit': false,
    'timetable.english.view': false, 'timetable.english.edit': false,
    'timetable.science.view': false, 'timetable.science.edit': false,
    'timetable.korean.view': false, 'timetable.korean.edit': false,
    // Attendance (own students only)
    'attendance.manage_own': true, 'attendance.edit_all': false,
    'attendance.manage_math': false, 'attendance.manage_english': false,
    'attendance.manage_science': false, 'attendance.manage_korean': false,
    'attendance.edit_student_info': false,
    // Students (view only)
    'students.view': true, 'students.edit': false, 'students.delete': false,
    'students.enrollment.manage': false,
    // Classes (view only)
    'classes.view': true, 'classes.create': false, 'classes.edit': false, 'classes.delete': false,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': false, 'consultation.convert': false,
    // Grades (view & edit own)
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': false,
    // Billing
    'billing.view': false, 'billing.edit': false,
  },
  english_teacher: {
    // Events
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    // Departments & Users
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    // Settings
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    // System
    'system.teachers.view': true, 'system.teachers.edit': false,
    'system.classes.view': true, 'system.classes.edit': false,
    // Timetable (view only)
    'timetable.math.view': false, 'timetable.math.edit': false,
    'timetable.english.view': true, 'timetable.english.edit': false,
    'timetable.science.view': false, 'timetable.science.edit': false,
    'timetable.korean.view': false, 'timetable.korean.edit': false,
    // Attendance (own students only)
    'attendance.manage_own': true, 'attendance.edit_all': false,
    'attendance.manage_math': false, 'attendance.manage_english': false,
    'attendance.manage_science': false, 'attendance.manage_korean': false,
    'attendance.edit_student_info': false,
    // Students (view only)
    'students.view': true, 'students.edit': false, 'students.delete': false,
    'students.enrollment.manage': false,
    // Classes (view only)
    'classes.view': true, 'classes.create': false, 'classes.edit': false, 'classes.delete': false,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': false, 'consultation.convert': false,
    // Grades (view & edit own)
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': false,
    // Billing
    'billing.view': false, 'billing.edit': false,
  },
  user: {
    // Events (basic)
    'events.create': true, 'events.manage_own': true, 'events.manage_others': false,
    'events.drag_move': true, 'events.attendance': true, 'events.bucket': false,
    // Departments & Users
    'departments.view_all': true, 'departments.manage': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    // Settings
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
    // Attendance (view only)
    'attendance.manage_own': false, 'attendance.edit_all': false,
    // Students (view only)
    'students.view': true, 'students.edit': false, 'students.delete': false,
    // Consultation (view only)
    'consultation.view': true, 'consultation.create': false, 'consultation.edit': false, 'consultation.convert': false,
    // Grades (view only)
    'grades.view': true, 'grades.edit': false, 'grades.manage_exams': false,
  },
};

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  status: 'approved' | 'pending' | 'rejected';
  /** @deprecated Use granular permissions instead (kept for migration) */
  allowedDepartments?: string[];
  // Department visibility control: 'view' = visible, undefined/missing = hidden
  // Note: Edit permissions are controlled by role permissions, not department permissions
  departmentPermissions?: Record<string, 'view'>;
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
  teacherId?: string; // ID from staff collection where role='teacher' (allows any role to be linked to a teacher)
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
  attendanceDays?: string[]; // 등원 요일 (비어있으면 모든 수업 요일에 등원)
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
  slotTeachers?: Record<string, string>;  // 교시별 담당강사 (key: "월-1-1", value: 강사명)
  slotRooms?: Record<string, string>;     // 교시별 강의실 (key: "월-1-1", value: 강의실)
}

export interface Teacher {
  id: string;
  name: string;
  englishName?: string; // 영어 이름
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
  isEiE?: boolean;     // EiE(English in English) 전용 레벨 여부
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
export type AppTab = 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students' | 'grades' | 'classes' | 'student-consultations' | 'staff' | 'daily-attendance' | 'billing' | 'role-management';

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
  'daily-attendance': { label: '출결 관리', icon: '✅' },
  payment: { label: '전자 결재', icon: '💳' },
  gantt: { label: '간트 차트', icon: '📊' },
  consultation: { label: '등록 상담', icon: '📞' },
  students: { label: '학생 관리', icon: '👥' },
  grades: { label: '성적 관리', icon: '📊' },
  classes: { label: '수업 관리', icon: '📚' },
  'student-consultations': { label: '학생 상담', icon: '💬' },
  staff: { label: '직원 관리', icon: '👔' },
  billing: { label: '수납 관리', icon: '💰' },
  'role-management': { label: '역할 관리', icon: '🔐' },
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
    tabs: ['timetable', 'attendance', 'daily-attendance', 'classes'],
    order: 2,
  },
  {
    id: 'student',
    label: '학생',
    icon: '👥',
    tabs: ['students', 'consultation', 'student-consultations', 'grades'],
    order: 3,
  },
  {
    id: 'admin',
    label: '관리',
    icon: '⚙️',
    tabs: ['payment', 'staff', 'billing'],
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
  master: ['calendar', 'timetable', 'attendance', 'daily-attendance', 'payment', 'gantt', 'consultation', 'students', 'grades', 'classes', 'student-consultations', 'staff', 'billing', 'role-management'],
  admin: ['calendar', 'timetable', 'attendance', 'daily-attendance', 'payment', 'gantt', 'consultation', 'students', 'grades', 'classes', 'student-consultations', 'staff', 'billing', 'role-management'],
  manager: ['calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades', 'classes', 'student-consultations', 'staff', 'billing'],
  math_lead: ['calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades', 'classes', 'student-consultations'],
  english_lead: ['calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades', 'classes', 'student-consultations'],
  math_teacher: ['calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades'],
  english_teacher: ['calendar', 'timetable', 'attendance', 'daily-attendance', 'consultation', 'students', 'grades'],
  user: ['calendar', 'attendance', 'daily-attendance'],
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

  // 예비원생/재원생 연동
  registeredStudentId?: string;  // 전환된 학생 ID (students 컬렉션)
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
  gradeLevel?: string;                   // 학년 필터링용 (단일 학년, 레거시 호환)

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

// ============ CONSULTATION MANAGEMENT TYPES (Phase 1) ============

/**
 * 상담 카테고리
 */
export type ConsultationCategory =
  | 'academic'        // 학업 성취도
  | 'behavior'        // 행동/태도
  | 'attendance'      // 출석 관련
  | 'progress'        // 학습 진도
  | 'concern'         // 고민 상담
  | 'compliment'      // 칭찬/격려
  | 'complaint'       // 불만/개선 요청
  | 'general'         // 일반 상담
  | 'other';          // 기타

/**
 * 상담 기록 (재원생 대상 학부모/학생 상담)
 */
export interface Consultation {
  // 기본 정보
  id: string;
  studentId: string;
  studentName: string;

  // 상담 정보
  type: 'parent' | 'student';
  consultantId: string;
  consultantName: string;
  date: string;                        // YYYY-MM-DD
  time?: string;                       // HH:mm
  duration?: number;                   // 분

  // 상담 내용
  category: ConsultationCategory;
  subject?: 'math' | 'english' | 'all';
  title: string;
  content: string;

  // 학부모 상담 전용
  parentName?: string;
  parentRelation?: string;
  parentContact?: string;

  // 학생 상담 전용
  studentMood?: 'positive' | 'neutral' | 'negative';

  // 후속 조치
  followUpNeeded: boolean;
  followUpDate?: string;
  followUpDone: boolean;
  followUpNotes?: string;

  // 메타데이터
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

/**
 * 카테고리 설정 (UI 표시용)
 */
export interface ConsultationCategoryConfig {
  icon: string;
  label: string;
  color: string;
}

export const CATEGORY_CONFIG: Record<ConsultationCategory, ConsultationCategoryConfig> = {
  academic: { icon: '📚', label: '학업 성취도', color: '#081429' },
  behavior: { icon: '⚠️', label: '행동/태도', color: '#f59e0b' },
  attendance: { icon: '📅', label: '출석 관련', color: '#3b82f6' },
  progress: { icon: '📈', label: '학습 진도', color: '#10b981' },
  concern: { icon: '💭', label: '고민 상담', color: '#8b5cf6' },
  compliment: { icon: '⭐', label: '칭찬/격려', color: '#fdb813' },
  complaint: { icon: '📢', label: '불만/개선', color: '#ef4444' },
  general: { icon: '💬', label: '일반 상담', color: '#373d41' },
  other: { icon: '📝', label: '기타', color: '#6b7280' },
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
  organization?: string;      // 소속 기관/학교 (비재원생용)

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
  role: 'teacher' | 'admin' | 'staff';
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
  teacherId?: string;              // 강사 프로필 연동 ID

  // === 선생님 전용 필드 (role === 'teacher'일 때만 사용) ===
  // 시간표 표시 설정
  isHiddenInTimetable?: boolean;  // 시간표에서 숨김
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

// ============ BILLING MANAGEMENT TYPES ============

/**
 * 수납 항목 (청구 내역)
 */
export interface BillingItem {
  name: string; // '수학', '영어' 등
  amount: number;
}

/**
 * 수납 상태
 */
export type BillingStatus = 'pending' | 'partial' | 'paid' | 'overdue';

/**
 * 결제 수단
 */
export type PaymentMethod = 'card' | 'cash' | 'transfer';

/**
 * 수납 기록
 */
export interface BillingRecord {
  id: string;
  studentId: string;
  studentName: string;
  month: string; // '2026-01' 형식
  amount: number; // 청구 금액
  paidAmount: number; // 납부 금액
  status: BillingStatus;
  paymentMethod?: PaymentMethod;
  dueDate: string; // YYYY-MM-DD
  paidDate?: string; // YYYY-MM-DD
  items: BillingItem[];
  memo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 수납 통계
 */
export interface BillingSummaryStats {
  totalBilled: number; // 총 청구 금액
  totalPaid: number; // 총 납부 금액
  pendingCount: number; // 미납 건수
  paidCount: number; // 완납 건수
  overdueCount: number; // 연체 건수
  collectionRate: number; // 수납률 (%)
}

/**
 * 수납 상태 색상
 */
export const BILLING_STATUS_COLORS: Record<BillingStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  partial: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  paid: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  overdue: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
};

/**
 * 수납 상태 라벨
 */
export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  pending: '미납',
  partial: '부분납부',
  paid: '완납',
  overdue: '연체',
};

/**
 * 결제 수단 라벨
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: '카드',
  cash: '현금',
  transfer: '계좌이체',
};
