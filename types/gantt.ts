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
