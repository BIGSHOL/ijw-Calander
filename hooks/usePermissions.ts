import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
    UserProfile,
    UserRole,
    PermissionId,
    RolePermissions,
    DEFAULT_ROLE_PERMISSIONS
} from '../types';

interface UsePermissionsReturn {
    hasPermission: (permission: PermissionId) => boolean;
    rolePermissions: RolePermissions;
    updateRolePermissions: (newPermissions: RolePermissions) => Promise<void>;
    isLoading: boolean;
}

/**
 * Hook for managing and checking role-based permissions
 * MASTER always has all permissions, other roles are configurable
 */
export function usePermissions(userProfile: UserProfile | null): UsePermissionsReturn {
    const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
    const [isLoading, setIsLoading] = useState(true);

    // Subscribe to role permissions from Firestore
    useEffect(() => {
        const unsubscribe = onSnapshot(
            doc(db, 'settings', 'rolePermissions'),
            (snapshot) => {
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
                    setRolePermissions(merged);
                } else {
                    // Use defaults if no document exists
                    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
                }
                setIsLoading(false);
            },
            (error) => {
                console.error('Error loading role permissions:', error);
                setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

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

        await setDoc(doc(db, 'settings', 'rolePermissions'), newPermissions);
    }, [userProfile]);

    return {
        hasPermission,
        rolePermissions,
        updateRolePermissions,
        isLoading
    };
}

// Helper to check if a role can be assigned by another role
export function canAssignRole(assignerRole: UserRole, targetRole: UserRole): boolean {
    const hierarchy: UserRole[] = ['master', 'admin', 'manager', 'editor', 'user', 'viewer', 'guest'];
    const assignerIndex = hierarchy.indexOf(assignerRole);
    const targetIndex = hierarchy.indexOf(targetRole);

    // Can only assign roles lower than own role
    // MASTER can assign all, ADMIN can assign manager and below, etc.
    return assignerIndex < targetIndex;
}

// Get assignable roles for a user
export function getAssignableRoles(assignerRole: UserRole): UserRole[] {
    const hierarchy: UserRole[] = ['master', 'admin', 'manager', 'editor', 'user', 'viewer', 'guest'];
    const assignerIndex = hierarchy.indexOf(assignerRole);

    return hierarchy.filter((_, index) => index > assignerIndex);
}
