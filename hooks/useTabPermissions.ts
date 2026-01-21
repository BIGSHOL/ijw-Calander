import { useMemo } from 'react';
import { UserProfile, AppTab, DEFAULT_TAB_PERMISSIONS, TabPermissionConfig, TAB_META } from '../types';
import { useSystemConfig } from './useFirebaseQueries';

// Extract to module level to avoid recreating on every render (rendering-hoist-jsx)
const ALL_TABS = Object.keys(TAB_META) as AppTab[];

/**
 * Hook to check if a user can access specific Top-Level Tabs
 */
export const useTabPermissions = (userProfile: UserProfile | null) => {
    const { data: systemConfig, isLoading } = useSystemConfig();

    return useMemo(() => {
        const canAccessTab = (tab: AppTab): boolean => {
            // Edge case: No user profile
            if (!userProfile) return false;

            // Property access caching (js-cache-property-access)
            const userRole = userProfile.role;
            const userStatus = userProfile.status;
            const userEmail = userProfile.email;

            // Edge case: User not approved - block all access
            if (userStatus !== 'approved') {
                // Conditional logging for production bundle size (bundle-conditional)
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[Tab Access Denied] User not approved:', userEmail);
                }
                return false;
            }

            // Edge case: Missing or invalid role
            if (!userRole) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[useTabPermissions] User profile has no role');
                }
                return false;
            }

            // Master always has access to everything
            if (userRole === 'master') return true;

            // Property access caching for systemConfig
            const tabPermissions = systemConfig?.tabPermissions;

            // Get permissions from config, or fallback to default
            const permissions: TabPermissionConfig = tabPermissions || DEFAULT_TAB_PERMISSIONS;

            // Get allowed tabs for this user's role
            const allowedTabs = permissions[userRole];

            // If no specific config for this role, block by default (safe) or use default?
            // Using DEFAULT_TAB_PERMISSIONS logic above handles the fallback to defaults if config is missing.
            // But if config exists but MISSING this role key?
            // E.g. Config = { admin: [...] }. Manager is missing.
            // We should fallback to DEFAULT for that role? Or strict block?
            // Let's use strict logic: IF config exists, use it. IF config is totally missing, use default.

            let effectiveTabs: AppTab[] = [];

            if (tabPermissions) {
                // Config exists in Firestore
                const configTabs = tabPermissions[userRole];

                if (configTabs && configTabs.length > 0) {
                    // Role has explicit config
                    effectiveTabs = configTabs;
                } else {
                    // Role missing in config - fallback to DEFAULT
                    const defaultTabs = DEFAULT_TAB_PERMISSIONS[userRole];
                    if (defaultTabs) {
                        if (process.env.NODE_ENV !== 'production') {
                            console.warn('[Tab Permissions] Role missing in Firestore config, using DEFAULT:', userRole);
                        }
                        effectiveTabs = defaultTabs;
                    } else {
                        if (process.env.NODE_ENV !== 'production') {
                            console.error('[Tab Permissions] Role has no config and no default:', userRole);
                        }
                        effectiveTabs = [];
                    }
                }
            } else {
                // No config in DB yet -> use code defaults
                const defaultTabs = DEFAULT_TAB_PERMISSIONS[userRole];
                if (defaultTabs) {
                    effectiveTabs = defaultTabs;
                } else {
                    if (process.env.NODE_ENV !== 'production') {
                        console.error('[Tab Permissions] No default permissions for role:', userRole);
                    }
                    effectiveTabs = [];
                }
            }

            return effectiveTabs.includes(tab);
        };

        // Pre-calculate accessible tabs for easy mapping
        // Master gets ALL tabs automatically
        const accessibleTabs: AppTab[] = userProfile?.role === 'master'
            ? ALL_TABS  // Master gets everything
            : ALL_TABS.filter((t) => canAccessTab(t));

        return {
            canAccessTab,
            accessibleTabs,
            isLoading,
        };
    }, [userProfile, systemConfig]); // Removed isLoading from dependencies (rerender-dependencies)
};
