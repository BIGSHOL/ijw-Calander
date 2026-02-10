// 8-tier role system (ordered from highest to lowest)
// Simplified from 11-tier: removed editor, viewer, guest (rarely used)
export type UserRole = 'master' | 'admin' | 'manager' | 'math_lead' | 'english_lead' | 'math_teacher' | 'english_teacher' | 'user'
  | 'teacher' | 'staff' | 'editor' | 'senior_staff' | 'viewer';  // 레거시 호환

export const ROLE_HIERARCHY: UserRole[] = ['master', 'admin', 'manager', 'math_lead', 'english_lead', 'math_teacher', 'english_teacher', 'user'];

export const ROLE_LABELS: Record<UserRole, string> = {
  master: 'MASTER',
  admin: 'ADMIN',
  manager: 'MANAGER',
  math_lead: '수학팀장',
  english_lead: '영어팀장',
  math_teacher: '수학선생님',
  english_teacher: '영어선생님',
  user: 'USER',
  teacher: '강사',
  staff: '직원',
  editor: 'EDITOR',
  senior_staff: '시니어직원',
  viewer: '뷰어',
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
  | 'timetable.math.simulation'
  | 'timetable.english.backup.view' | 'timetable.english.backup.restore'
  | 'timetable.science.view' | 'timetable.science.edit'
  | 'timetable.korean.view' | 'timetable.korean.edit'
  | 'timetable.integrated.view'
  // Gantt
  | 'gantt.view' | 'gantt.create' | 'gantt.edit' | 'gantt.delete'
  // Attendance
  | 'attendance.manage_own' | 'attendance.edit_all'
  | 'attendance.manage_math' | 'attendance.manage_english'
  | 'attendance.manage_science' | 'attendance.manage_korean'  // Reserved: 과학/국어 출석부 기능 추가 시 사용
  | 'attendance.edit_student_info'
  | 'attendance.manage_sessions'  // 세션 기간 설정 (관리자 전용)
  // Students (NEW) - students.edit 권한으로 수강배정 포함 모든 수정 가능
  | 'students.view' | 'students.edit' | 'students.delete' | 'students.manage_class_history' | 'students.edit_enrollment_dates'
  // Classes Management (NEW)
  | 'classes.view' | 'classes.create' | 'classes.edit' | 'classes.delete'
  // Consultation (NEW)
  | 'consultation.view' | 'consultation.create' | 'consultation.edit' | 'consultation.convert' | 'consultation.manage'  // manage: 모든 상담 조회/수정 가능
  // Grades (NEW)
  | 'grades.view' | 'grades.edit' | 'grades.manage_exams'
  // Billing (NEW)
  | 'billing.view' | 'billing.edit'
  // Withdrawal (퇴원 관리)
  | 'withdrawal.view' | 'withdrawal.edit' | 'withdrawal.reactivate'
  // Resources (리소스 관리)
  | 'resources.edit'
  // Role Management (역할 관리)
  | 'roles.view' | 'roles.manage';

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
    'attendance.manage_sessions': true,  // 세션 설정 권한 (관리자)
    // Students
    'students.view': true, 'students.edit': true, 'students.delete': true, 'students.manage_class_history': true, 'students.edit_enrollment_dates': true,
        // Classes
    'classes.view': true, 'classes.create': true, 'classes.edit': true, 'classes.delete': true,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': true, 'consultation.manage': true,
    // Grades
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': true,
    // Billing
    'billing.view': true, 'billing.edit': true,
    // Withdrawal
    'withdrawal.view': true, 'withdrawal.edit': true, 'withdrawal.reactivate': true,
    // Resources
    'resources.edit': true,
    // Role Management
    'roles.view': true, 'roles.manage': false,
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
    'students.view': true, 'students.edit': true, 'students.delete': false, 'students.manage_class_history': true, 'students.edit_enrollment_dates': true,
        // Classes
    'classes.view': true, 'classes.create': true, 'classes.edit': true, 'classes.delete': false,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': true, 'consultation.manage': true,
    // Grades
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': true,
    // Billing
    'billing.view': true, 'billing.edit': true,
    // Withdrawal
    'withdrawal.view': true, 'withdrawal.edit': true, 'withdrawal.reactivate': true,
    // Resources
    'resources.edit': true,
    // Role Management
    'roles.view': false, 'roles.manage': false,
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
    'students.view': true, 'students.edit': true, 'students.delete': false, 'students.manage_class_history': true, 'students.edit_enrollment_dates': true,
        // Classes
    'classes.view': true, 'classes.create': true, 'classes.edit': true, 'classes.delete': false,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': true, 'consultation.manage': true,
    // Grades
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': true,
    // Billing
    'billing.view': true, 'billing.edit': false,
    // Withdrawal
    'withdrawal.view': true, 'withdrawal.edit': true, 'withdrawal.reactivate': false,
    // Role Management
    'roles.view': false, 'roles.manage': false,
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
    'students.view': true, 'students.edit': true, 'students.delete': false, 'students.manage_class_history': true, 'students.edit_enrollment_dates': true,
        // Classes
    'classes.view': true, 'classes.create': true, 'classes.edit': true, 'classes.delete': false,
    // Consultation
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': true, 'consultation.manage': true,
    // Grades
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': true,
    // Billing
    'billing.view': true, 'billing.edit': false,
    // Withdrawal
    'withdrawal.view': true, 'withdrawal.edit': true, 'withdrawal.reactivate': false,
    // Role Management
    'roles.view': false, 'roles.manage': false,
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
    'students.view': true, 'students.edit': false, 'students.delete': false, 'students.manage_class_history': false, 'students.edit_enrollment_dates': false,
        // Classes (view only)
    'classes.view': true, 'classes.create': false, 'classes.edit': false, 'classes.delete': false,
    // Consultation (본인 상담만 수정 가능)
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': false, 'consultation.manage': false,
    // Grades (view & edit own)
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': false,
    // Billing
    'billing.view': false, 'billing.edit': false,
    // Withdrawal
    'withdrawal.view': true, 'withdrawal.edit': false, 'withdrawal.reactivate': false,
    // Role Management
    'roles.view': false, 'roles.manage': false,
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
    'students.view': true, 'students.edit': false, 'students.delete': false, 'students.manage_class_history': false, 'students.edit_enrollment_dates': false,
        // Classes (view only)
    'classes.view': true, 'classes.create': false, 'classes.edit': false, 'classes.delete': false,
    // Consultation (본인 상담만 수정 가능)
    'consultation.view': true, 'consultation.create': true, 'consultation.edit': true, 'consultation.convert': false, 'consultation.manage': false,
    // Grades (view & edit own)
    'grades.view': true, 'grades.edit': true, 'grades.manage_exams': false,
    // Billing
    'billing.view': false, 'billing.edit': false,
    // Withdrawal
    'withdrawal.view': true, 'withdrawal.edit': false, 'withdrawal.reactivate': false,
    // Role Management
    'roles.view': false, 'roles.manage': false,
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
    'students.view': true, 'students.edit': false, 'students.delete': false, 'students.manage_class_history': false, 'students.edit_enrollment_dates': false,
    // Consultation (view only)
    'consultation.view': true, 'consultation.create': false, 'consultation.edit': false, 'consultation.convert': false, 'consultation.manage': false,
    // Grades (view only)
    'grades.view': true, 'grades.edit': false, 'grades.manage_exams': false,
    // Withdrawal
    'withdrawal.view': false, 'withdrawal.edit': false, 'withdrawal.reactivate': false,
    // Role Management
    'roles.view': false, 'roles.manage': false,
  },
};

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  status: 'approved' | 'pending' | 'rejected';
  /** @deprecated Use granular permissions instead (kept for migration) */
  allowedDepartments?: string[];
  // Department visibility control: 'view' = visible, 'edit' = editable, undefined/missing = hidden
  // Note: Edit permissions are controlled by role permissions, not department permissions
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
  name?: string;        // 이름 (displayName 별칭)
  koreanName?: string;  // 한국어 이름
  department?: string;  // 소속 부서 (departmentId 별칭)
  jobTitle?: string; // 호칭

  // Attendance: Link to Staff Profile (for view_own filtering)
  staffId?: string; // ID from staff collection (allows any role to be linked to a staff member)
  /** @deprecated Use staffId instead */
  teacherId?: string; // Legacy field, use staffId
}
