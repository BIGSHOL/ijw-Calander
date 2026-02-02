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

// Phase 6: Gantt Departments
export interface GanttDepartment {
  id: string;
  label: string;
  color: string;
  order: number;
  createdAt?: number;
}

export interface Holiday {
  id: string;      // Usually 'YYYY-MM-DD'
  date: string;    // 'YYYY-MM-DD'
  name: string;
  type: 'public' | 'custom';
}

export const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];
