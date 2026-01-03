/**
 * Gantt Chart Permission Utilities
 * Phase 10: User-Specific Gantt Charts
 * 
 * Provides centralized access control logic for Gantt projects.
 */

import { GanttTemplate, UserProfile, ProjectMemberRole } from '../types';

/**
 * Access check result interface
 */
export interface AccessCheckResult {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canManageMembers: boolean;
    accessReason: string;
}

/**
 * Checks if a user has access to a specific Gantt project
 * 
 * @param project - The Gantt project to check access for
 * @param user - The user profile (null if not authenticated)
 * @param userDepartments - Optional array of department IDs the user belongs to
 * @returns AccessCheckResult with permission flags and reason
 */
export function checkProjectAccess(
    project: GanttTemplate,
    user: UserProfile | null,
    userDepartments?: string[]
): AccessCheckResult {
    // Not authenticated
    if (!user) {
        return {
            canView: false,
            canEdit: false,
            canDelete: false,
            canManageMembers: false,
            accessReason: 'Not authenticated'
        };
    }

    // 1. Master has all permissions
    if (user.role === 'master') {
        return {
            canView: true,
            canEdit: true,
            canDelete: true,
            canManageMembers: true,
            accessReason: 'Master role'
        };
    }

    // 2. Admin can view/edit all, delete own projects only
    if (user.role === 'admin') {
        return {
            canView: true,
            canEdit: true,
            canDelete: project.createdBy === user.uid,
            canManageMembers: true,
            accessReason: 'Admin role'
        };
    }

    // 3. Owner check (ownerId or createdBy)
    const isOwner = project.ownerId === user.uid || project.createdBy === user.uid;
    if (isOwner) {
        return {
            canView: true,
            canEdit: true,
            canDelete: true,
            canManageMembers: true,
            accessReason: 'Project owner'
        };
    }

    // 4. Member role check
    const memberRole = project.members?.find(m => m.userId === user.uid)?.role;
    if (memberRole) {
        return {
            canView: true,
            canEdit: ['admin', 'editor'].includes(memberRole),
            canDelete: false,
            canManageMembers: memberRole === 'admin',
            accessReason: `Member (${memberRole})`
        };
    }

    // 5. Team lead permission (department projects)
    if (['manager', 'math_lead', 'english_lead'].includes(user.role)) {
        const isMyDepartment = project.departmentIds?.some(
            deptId => userDepartments?.includes(deptId)
        );

        if (isMyDepartment && project.visibility === 'department') {
            return {
                canView: true,
                canEdit: false,
                canDelete: false,
                canManageMembers: false,
                accessReason: 'Team lead - department access'
            };
        }
    }

    // 6. Visibility check
    switch (project.visibility) {
        case 'public':
            return {
                canView: user.status === 'approved',
                canEdit: false,
                canDelete: false,
                canManageMembers: false,
                accessReason: 'Public project'
            };

        case 'department':
        case 'department_shared':
            const hasAccess = project.departmentIds?.some(
                deptId => userDepartments?.includes(deptId)
            );
            if (hasAccess) {
                return {
                    canView: true,
                    canEdit: false,
                    canDelete: false,
                    canManageMembers: false,
                    accessReason: 'Department access'
                };
            }
            break;
    }

    // 7. Legacy compatibility - assignees array
    if (project.assignees?.includes(user.uid)) {
        return {
            canView: true,
            canEdit: true,
            canDelete: false,
            canManageMembers: false,
            accessReason: 'Legacy assignee'
        };
    }

    // 8. Legacy compatibility - isShared flag
    if (project.isShared === true) {
        return {
            canView: true,
            canEdit: false,
            canDelete: false,
            canManageMembers: false,
            accessReason: 'Legacy shared'
        };
    }

    // Default: No access
    return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canManageMembers: false,
        accessReason: 'No access'
    };
}

/**
 * Filters an array of projects to only those the user can access
 * 
 * @param projects - Array of Gantt projects
 * @param user - The user profile
 * @param userDepartments - Optional array of department IDs
 * @returns Filtered array of accessible projects
 */
export function filterAccessibleProjects(
    projects: GanttTemplate[],
    user: UserProfile | null,
    userDepartments?: string[]
): GanttTemplate[] {
    if (!user) return [];

    return projects.filter(project => {
        const access = checkProjectAccess(project, user, userDepartments);
        return access.canView;
    });
}

/**
 * Checks if a user can add members to a project
 * 
 * @param project - The project to add members to
 * @param user - The user attempting to add members
 * @returns Boolean indicating if the user can add members
 */
export function canAddMember(
    project: GanttTemplate,
    user: UserProfile | null
): boolean {
    if (!user) return false;
    const access = checkProjectAccess(project, user);
    return access.canManageMembers;
}

/**
 * Gets the display name for a member role
 */
export function getMemberRoleDisplayName(role: ProjectMemberRole): string {
    const roleNames: Record<ProjectMemberRole, string> = {
        owner: '소유자',
        admin: '관리자',
        editor: '편집자',
        viewer: '관찰자'
    };
    return roleNames[role] || role;
}

/**
 * Gets the color class for a member role badge
 */
export function getMemberRoleColor(role: ProjectMemberRole): string {
    const roleColors: Record<ProjectMemberRole, string> = {
        owner: 'bg-yellow-500 text-black',
        admin: 'bg-purple-500 text-white',
        editor: 'bg-blue-500 text-white',
        viewer: 'bg-slate-500 text-white'
    };
    return roleColors[role] || 'bg-slate-500 text-white';
}
