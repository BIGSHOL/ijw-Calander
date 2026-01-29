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
import { useRoleSimulation, getEffectiveRole, getEffectiveUserProfile } from './useRoleSimulation';

interface UsePermissionsReturn {
    hasPermission: (permission: PermissionId) => boolean;
    rolePermissions: RolePermissions;
    updateRolePermissions: (newPermissions: RolePermissions) => Promise<void>;
    isLoading: boolean;
    /** 현재 적용 중인 역할 (시뮬레이션 모드면 시뮬레이션 역할) */
    effectiveRole: UserRole | null;
    /** 시뮬레이션 모드 여부 */
    isSimulating: boolean;
    /** 시뮬레이션 타입 ('role' | 'user' | null) */
    simulationType: 'role' | 'user' | null;
    /** 실효 사용자 프로필 (시뮬레이션 시 해당 프로필) */
    effectiveUserProfile: UserProfile | null;
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
 *
 * Supports Role Simulation: Master can test with other roles' permissions
 */
export function usePermissions(userProfile: UserProfile | null): UsePermissionsReturn {
    const queryClient = useQueryClient();
    const { simulatedRole, simulatedUserProfile, simulationType, isSimulating } = useRoleSimulation();

    const { data: rolePermissions = DEFAULT_ROLE_PERMISSIONS, isLoading } = useQuery({
        queryKey: ['rolePermissions'],
        queryFn: fetchRolePermissions,
        staleTime: 1000 * 60 * 30,  // 30분 캐싱 (권한 설정은 자주 변경되지 않음)
        gcTime: 1000 * 60 * 60,     // 1시간 GC
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    // 실효 역할 계산 (시뮬레이션 모드면 시뮬레이션 역할)
    const effectiveRole = getEffectiveRole(userProfile?.role, simulatedRole);

    // 실효 사용자 프로필 계산 (사용자 시뮬레이션 시 해당 프로필)
    const effectiveUserProfile = getEffectiveUserProfile(
        userProfile, simulatedRole, simulatedUserProfile, simulationType
    );

    // Check if current user has a specific permission
    const hasPermission = useCallback((permission: PermissionId): boolean => {
        // Edge case: No user profile
        if (!userProfile) return false;

        // Edge case: Missing or invalid role
        if (!userProfile.role) return false;

        // 시뮬레이션 모드가 아닌 경우: MASTER는 항상 모든 권한 보유
        // 시뮬레이션 모드인 경우: 시뮬레이션 역할의 권한 사용
        const roleToCheck = getEffectiveRole(userProfile.role, simulatedRole);

        if (!roleToCheck) return false;

        // 시뮬레이션 중이 아니고 마스터인 경우 모든 권한 부여
        if (userProfile.role === 'master' && !simulatedRole) return true;

        // Get permissions for the effective role
        const rolePerms = rolePermissions[roleToCheck as keyof RolePermissions];

        // Edge case: Role not found in permissions config
        if (!rolePerms) {
            console.warn(`[usePermissions] No permissions found for role: ${roleToCheck}`);
            return false;
        }

        return rolePerms[permission] ?? false;
    }, [userProfile, rolePermissions, simulatedRole]);

    // Update role permissions (MASTER only - 실제 역할 기준)
    const updateRolePermissions = useCallback(async (newPermissions: RolePermissions): Promise<void> => {
        // 시뮬레이션 모드와 관계없이 실제 마스터만 가능
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
        isLoading,
        effectiveRole,
        isSimulating,
        simulationType,
        effectiveUserProfile,
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
