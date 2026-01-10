/**
 * Permission-related constants and types
 * @module constants/permissions
 */

/**
 * Department permission levels
 * @description
 * Defines the access control levels for department data:
 * - none: No access (blocked)
 * - view: Read-only access
 * - edit: Full read and write access
 */
export const PERMISSION_LEVELS = {
  NONE: 'none',
  VIEW: 'view',
  EDIT: 'edit',
} as const;

export type PermissionLevel = typeof PERMISSION_LEVELS[keyof typeof PERMISSION_LEVELS];

/**
 * Human-readable labels for permission levels (Korean)
 * @example
 * ```ts
 * PERMISSION_LABELS[PERMISSION_LEVELS.VIEW] // "조회"
 * ```
 */
export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  none: '차단',
  view: '조회',
  edit: '수정',
};

/**
 * Tailwind CSS classes for permission level buttons
 * @remarks
 * Used for consistent styling across permission toggles
 */
export const PERMISSION_STYLES: Record<PermissionLevel, string> = {
  none: 'bg-gray-100 text-gray-400 shadow-inner',
  view: 'bg-blue-50 text-blue-600 shadow-sm',
  edit: 'bg-green-50 text-green-600 shadow-sm',
};

/**
 * Icon/emoji representation for permission levels
 * @remarks
 * Used in dropdowns and quick-reference displays
 */
export const PERMISSION_ICONS: Record<PermissionLevel, string> = {
  none: '🚫',
  view: '👁️',
  edit: '✏️',
};

/**
 * User role hierarchy
 * @description
 * Defines the organizational role levels. Higher values have more privileges.
 */
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  MASTER: 'master',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Role hierarchy levels for comparison
 * @example
 * ```ts
 * ROLE_HIERARCHY[USER_ROLES.MASTER] > ROLE_HIERARCHY[USER_ROLES.ADMIN] // true
 * ```
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  master: 3,
};

/**
 * Human-readable labels for user roles (Korean)
 */
export const ROLE_LABELS_KR: Record<UserRole, string> = {
  user: '일반 사용자',
  admin: '관리자',
  master: '최고 관리자',
};

/**
 * Role badge colors (Tailwind classes)
 */
export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  user: {
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    border: 'border-gray-200',
  },
  admin: {
    bg: 'bg-indigo-600',
    text: 'text-white',
    border: 'border-indigo-700',
  },
  master: {
    bg: 'bg-[#fdb813]',
    text: 'text-[#081429]',
    border: 'border-[#fdb813]',
  },
};

/**
 * Default permission for new departments
 */
export const DEFAULT_DEPARTMENT_PERMISSION: PermissionLevel = PERMISSION_LEVELS.VIEW;

/**
 * Default color scheme for new departments
 */
export const DEFAULT_DEPARTMENT_COLORS = {
  color: '#3b82f6', // Blue-500
  defaultColor: '#ffffff', // White background
  defaultTextColor: '#000000', // Black text
  defaultBorderColor: '#fee2e2', // Red-100 border
} as const;

/**
 * Permission matrix: which roles can manage which entities
 * @example
 * ```ts
 * PERMISSION_MATRIX.departments.canManage(currentUser.role) // boolean
 * ```
 */
export const PERMISSION_MATRIX = {
  departments: {
    canView: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.user,
    canCreate: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin,
    canEdit: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin,
    canDelete: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.master,
  },
  users: {
    canView: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin,
    canApprove: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin,
    canChangeRole: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.master,
    canDelete: (role: UserRole, targetRole: UserRole) => {
      if (role === USER_ROLES.MASTER && targetRole !== USER_ROLES.MASTER) return true;
      if (role === USER_ROLES.ADMIN && targetRole !== USER_ROLES.MASTER) return true;
      return false;
    },
  },
  categories: {
    canManage: (role: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.master,
  },
} as const;
