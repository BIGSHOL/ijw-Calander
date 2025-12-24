export interface Department {
  id: string;
  name: string;
  description?: string; // For the subtitle like "Vision: ..."
  color?: string;
  order: number;
  defaultColor?: string;
  defaultTextColor?: string;
  defaultBorderColor?: string;
}

export interface CalendarEvent {
  id: string;
  departmentId: string;
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
}

export interface DragSelection {
  departmentId: string;
  date: string;
}

export const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export interface UserProfile {
  uid: string;
  email: string;
  role: 'master' | 'admin' | 'user'; // Added 'admin'
  status: 'approved' | 'pending' | 'rejected';
  // allowedDepartments is DEPRECATED but kept for migration:
  allowedDepartments?: string[];
  // NEW: Granular permissions per department
  departmentPermissions?: Record<string, 'view' | 'edit'>;

  canEdit?: boolean; // Global edit flag (Deprecate or use as 'super edit'?)
  canManageMenus?: boolean;
  canManageEventAuthors?: boolean;
  jobTitle?: string;
}

export interface Holiday {
  id: string;      // Usually 'YYYY-MM-DD'
  date: string;    // 'YYYY-MM-DD'
  name: string;
  type: 'public' | 'custom';
}