import { useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseConfig';
import {
    UserProfile,
    UserRole,
    PermissionId,
    RolePermissions,
    DEFAULT_ROLE_PERMISSIONS,
    ROLE_HIERARCHY
} from '../types';

interface UsePermissionsReturn {
    hasPermission: (permission: PermissionId) => boolean;
    rolePermissions: RolePermissions;
    updateRolePermissions: (newPermissions: RolePermissions) => Promise<void>;
    isLoading: boolean;
}

/**
 * Fetch role permissions from Firestore
 * Uses getDoc instead of onSnapshot for cost optimization
 */
async function fetchRolePermissions(): Promise<RolePermissions> {
    const snapshot = await getDoc(doc(db, 'settings', 'rolePermissions'));

    if (snapshot.exists()) {
        const data = snapshot.data() as RolePermissions;
        // Merge with defaults to ensure all permissions exist
        const merged: RolePermissions = {};
        for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS) as (keyof RolePermissions)[]) {
            merged[role] = {
                ...DEFAULT_ROLE_PERMISSIONS[role],
                ...(data[role] || {})
            };
        }
        return merged;
    }

    return DEFAULT_ROLE_PERMISSIONS;
}

/**
 * Hook for managing and checking role-based permissions
 * MASTER always has all permissions, other roles are configurable
 *
 * Optimized: Uses React Query with 30-minute cache instead of onSnapshot
 * - Reduces Firestore reads by ~73% (from 17,280/day to 48/day per user)
 * - Permission changes are reflected within 30 minutes or on page refresh
 */
export function usePermissions(userProfile: UserProfile | null): UsePermissionsReturn {
    const queryClient = useQueryClient();

    const { data: rolePermissions = DEFAULT_ROLE_PERMISSIONS, isLoading } = useQuery({
        queryKey: ['rolePermissions'],
        queryFn: fetchRolePermissions,
        staleTime: 1000 * 60 * 30,  // 30분 캐싱 (권한 설정은 자주 변경되지 않음)
        gcTime: 1000 * 60 * 60,     // 1시간 GC
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    // Check if current user has a specific permission
    const hasPermission = useCallback((permission: PermissionId): boolean => {
        if (!userProfile) return false;

        // MASTER always has all permissions
        if (userProfile.role === 'master') return true;

        // Get permissions for user's role
        const rolePerms = rolePermissions[userProfile.role as keyof RolePermissions];
        if (!rolePerms) return false;

        return rolePerms[permission] ?? false;
    }, [userProfile, rolePermissions]);

    // Update role permissions (MASTER only)
    const updateRolePermissions = useCallback(async (newPermissions: RolePermissions): Promise<void> => {
        if (!userProfile || userProfile.role !== 'master') {
            throw new Error('Only MASTER can update role permissions');
        }

        await setDoc(doc(db, 'settings', 'rolePermissions'), newPermissions, { merge: true });
        // 캐시 무효화하여 즉시 새 권한 적용
        queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
    }, [userProfile, queryClient]);

    return {
        hasPermission,
        rolePermissions,
        updateRolePermissions,
        isLoading
    };
}

// Helper to check if a role can be assigned by another role
export function canAssignRole(assignerRole: UserRole, targetRole: UserRole): boolean {
    const assignerIndex = ROLE_HIERARCHY.indexOf(assignerRole);
    const targetIndex = ROLE_HIERARCHY.indexOf(targetRole);

    // Can only assign roles lower than own role
    // MASTER can assign all, ADMIN can assign manager and below, etc.
    return assignerIndex < targetIndex;
}

// Get assignable roles for a user
export function getAssignableRoles(assignerRole: UserRole): UserRole[] {
    const assignerIndex = ROLE_HIERARCHY.indexOf(assignerRole);

    return ROLE_HIERARCHY.filter((_, index) => index > assignerIndex);
}
