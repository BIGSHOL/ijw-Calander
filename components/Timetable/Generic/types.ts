// Generic Timetable Types
import type { PermissionId } from '../../../types';

export type SubjectKey = 'math' | 'english' | 'science' | 'korean';

export interface PeriodInfo {
  id: string;
  label: string;
  time: string;
  startTime: string;
  endTime: string;
}

/**
 * Subject Configuration Interface
 * Defines all subject-specific metadata for Generic Timetable components
 */
export interface SubjectConfiguration {
  // Basic Info
  subject: SubjectKey;
  displayName: string;

  // Period System
  periodInfo: Record<string, PeriodInfo>;
  periodIds: string[];
  unifiedPeriodsCount: number;

  // Grouping (optional - for Math/Science/Korean)
  periodGroups?: Record<string, { group: number; position: 'first' | 'second' }>;
  groupTimes?: Record<number, string>;
  hasGrouping: boolean;

  // Formatting
  formatPeriodsToLabel: (periods: string[]) => string;

  // Firebase
  firebaseSubjectKey: SubjectKey;
  configDocPath: string;

  // Permissions
  viewPermission: PermissionId;
  editPermission: PermissionId;

  // Colors
  colors: {
    bg: string;
    text: string;
    border: string;
    light: string;
    badge: string;
    badgeAlt: string;
  };
}

export interface TimetableClass {
  id: string;
  className: string;
  subject: SubjectKey;
  teacher: string;
  assistants?: string[];
  room?: string;
  schedule?: string[];
  color?: string;
  isActive: boolean;
  studentCount?: number;
  slotTeachers?: Record<string, string>;
  slotRooms?: Record<string, string>;
  memo?: string;
}

export interface TimetableStudent {
  id: string;
  name: string;
  status?: 'active' | 'withdrawn' | 'hold';
  enrollmentDate?: string;
  withdrawalDate?: string;
  onHold?: boolean;
  attendanceDays?: string[];
  school?: string;
  grade?: string;
}
