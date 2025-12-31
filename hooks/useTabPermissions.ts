import { useMemo } from 'react';
import { UserProfile, AppTab, DEFAULT_TAB_PERMISSIONS, TabPermissionConfig } from '../types';
import { useSystemConfig } from './useFirebaseQueries';

/**
 * Hook to check if a user can access specific Top-Level Tabs
 */
export const useTabPermissions = (userProfile: UserProfile | null) => {
    const { data: systemConfig, isLoading } = useSystemConfig();

    return useMemo(() => {
        const canAccessTab = (tab: AppTab): boolean => {
            if (!userProfile) return false;

            // Master always has access to everything
            if (userProfile.role === 'master') return true;

            // Get permissions from config, or fallback to default
            const permissions: TabPermissionConfig = systemConfig?.tabPermissions || DEFAULT_TAB_PERMISSIONS;

            // Get allowed tabs for this user's role
            const allowedTabs = permissions[userProfile.role];

            // If no specific config for this role, block by default (safe) or use default?
            // Using DEFAULT_TAB_PERMISSIONS logic above handles the fallback to defaults if config is missing.
            // But if config exists but MISSING this role key?
            // E.g. Config = { admin: [...] }. Manager is missing.
            // We should fallback to DEFAULT for that role? Or strict block?
            // Let's use strict logic: IF config exists, use it. IF config is totally missing, use default.

            let effectiveTabs: AppTab[] = [];

            if (systemConfig?.tabPermissions) {
                // Config exists. If role is missing in config, they get NOTHING (or maybe default?).
                // Let's assume clear configuration is better. If key missing, empty array.
                effectiveTabs = systemConfig.tabPermissions[userProfile.role] || [];
            } else {
                // No config in DB yet -> use code defaults
                effectiveTabs = DEFAULT_TAB_PERMISSIONS[userProfile.role] || [];
            }

            return effectiveTabs.includes(tab);
        };

        // Pre-calculate accessible tabs for easy mapping
        const accessibleTabs: AppTab[] = ['calendar', 'timetable', 'payment', 'system'].filter((t) =>
            canAccessTab(t as AppTab)
        ) as AppTab[];

        return {
            canAccessTab,
            accessibleTabs,
            isLoading,
        };
    }, [userProfile, systemConfig, isLoading]);
};
