export interface Department {
  id: string;
  name: string;
  description?: string; // For the subtitle like "Vision: ..."
  color?: string;
  order: number;
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
}

export interface DragSelection {
  departmentId: string;
  date: string;
}

export const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export interface UserProfile {
  uid: string;
  email: string;
  role: 'master' | 'user';
  status: 'approved' | 'pending' | 'rejected'; // Access Control Status
  allowedDepartments: string[]; // List of department IDs
  canEdit?: boolean;
}