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

export interface CalendarEvent {
  id: string;
  departmentId: string; // Primary department (for backward compatibility)
  departmentIds?: string[]; // Multiple departments (new feature)
  title: string;
  description?: string;
  participants?: string;
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

export const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// 7-tier role system (ordered from highest to lowest)
export type UserRole = 'master' | 'admin' | 'manager' | 'editor' | 'user' | 'viewer' | 'guest';

export const ROLE_HIERARCHY: UserRole[] = ['master', 'admin', 'manager', 'editor', 'user', 'viewer', 'guest'];

export const ROLE_LABELS: Record<UserRole, string> = {
  master: 'MASTER',
  admin: 'ADMIN',
  manager: 'MANAGER',
  editor: 'EDITOR',
  user: 'USER',
  viewer: 'VIEWER',
  guest: 'GUEST'
};

// Permission IDs for granular control
export type PermissionId =
  | 'events.create' | 'events.edit_own' | 'events.edit_others'
  | 'events.delete_own' | 'events.delete_others' | 'events.drag_move'
  | 'events.attendance'
  | 'departments.view_all' | 'departments.create' | 'departments.edit' | 'departments.delete'
  | 'users.view' | 'users.approve' | 'users.change_role' | 'users.change_permissions'
  | 'settings.access' | 'settings.holidays' | 'settings.role_permissions' | 'settings.manage_categories';

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
    'departments.view_all': true, 'departments.create': true, 'departments.edit': true, 'departments.delete': false,
    'users.view': true, 'users.approve': true, 'users.change_role': false, 'users.change_permissions': true,
    'settings.access': true, 'settings.holidays': true, 'settings.role_permissions': false, 'settings.manage_categories': true,
  },
  manager: {
    'events.create': true, 'events.edit_own': true, 'events.edit_others': true,
    'events.delete_own': true, 'events.delete_others': true, 'events.drag_move': true,
    'events.attendance': true,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': true, 'departments.delete': false,
    'users.view': true, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  editor: {
    'events.create': true, 'events.edit_own': true, 'events.edit_others': false,
    'events.delete_own': true, 'events.delete_others': false, 'events.drag_move': true,
    'events.attendance': true,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': false, 'departments.delete': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  user: {
    'events.create': true, 'events.edit_own': true, 'events.edit_others': false,
    'events.delete_own': true, 'events.delete_others': false, 'events.drag_move': true,
    'events.attendance': true,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': false, 'departments.delete': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  viewer: {
    'events.create': false, 'events.edit_own': false, 'events.edit_others': false,
    'events.delete_own': false, 'events.delete_others': false, 'events.drag_move': false,
    'events.attendance': false,
    'departments.view_all': true, 'departments.create': false, 'departments.edit': false, 'departments.delete': false,
    'users.view': false, 'users.approve': false, 'users.change_role': false, 'users.change_permissions': false,
    'settings.access': false, 'settings.holidays': false, 'settings.role_permissions': false,
  },
  guest: {
    'events.create': false, 'events.edit_own': false, 'events.edit_others': false,
    'events.delete_own': false, 'events.delete_others': false, 'events.drag_move': false,
    'events.attendance': false,
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

  /** @deprecated Use role-based permissions (isMaster/isAdmin) */
  canEdit?: boolean;
  /** @deprecated Use 'settings.access' or 'departments.view_all' permission */
  canManageMenus?: boolean;
  /** @deprecated Use 'events.edit_others' permission */
  canManageEventAuthors?: boolean;
  jobTitle?: string;
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
  grade?: string;       // 학년
  school?: string;      // 학교
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