import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useTabPermissions } from '../../hooks/useTabPermissions';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import type { UserProfile, UserRole, AppTab, TabPermissionConfig, SystemConfig } from '../../types';

// Mock useSystemConfig hook
vi.mock('../../hooks/useFirebaseQueries', () => ({
  useSystemConfig: vi.fn(),
}));

import { useSystemConfig } from '../../hooks/useFirebaseQueries';

describe('useTabPermissions Hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  // All available tabs
  const allTabs: AppTab[] = [
    'calendar',
    'timetable',
    'attendance',
    'payment',
    'gantt',
    'consultation',
    'students',
    'grades',
    'classes',
    'student-consultations',
  ];

  // Mock user profiles for all 11 roles
  const mockUsers: Record<UserRole, UserProfile> = {
    master: {
      uid: 'user-master',
      email: 'master@test.com',
      role: 'master',
      status: 'approved',
      displayName: 'Master User',
    },
    admin: {
      uid: 'user-admin',
      email: 'admin@test.com',
      role: 'admin',
      status: 'approved',
      displayName: 'Admin User',
    },
    manager: {
      uid: 'user-manager',
      email: 'manager@test.com',
      role: 'manager',
      status: 'approved',
      displayName: 'Manager User',
    },
    editor: {
      uid: 'user-editor',
      email: 'editor@test.com',
      role: 'editor',
      status: 'approved',
      displayName: 'Editor User',
    },
    math_lead: {
      uid: 'user-math-lead',
      email: 'math_lead@test.com',
      role: 'math_lead',
      status: 'approved',
      displayName: 'Math Lead User',
      departmentId: 'math',
    },
    english_lead: {
      uid: 'user-english-lead',
      email: 'english_lead@test.com',
      role: 'english_lead',
      status: 'approved',
      displayName: 'English Lead User',
      departmentId: 'english',
    },
    math_teacher: {
      uid: 'user-math-teacher',
      email: 'math_teacher@test.com',
      role: 'math_teacher',
      status: 'approved',
      displayName: 'Math Teacher User',
      departmentId: 'math',
    },
    english_teacher: {
      uid: 'user-english-teacher',
      email: 'english_teacher@test.com',
      role: 'english_teacher',
      status: 'approved',
      displayName: 'English Teacher User',
      departmentId: 'english',
    },
    user: {
      uid: 'user-user',
      email: 'user@test.com',
      role: 'user',
      status: 'approved',
      displayName: 'Normal User',
    },
    viewer: {
      uid: 'user-viewer',
      email: 'viewer@test.com',
      role: 'viewer',
      status: 'approved',
      displayName: 'Viewer User',
    },
    guest: {
      uid: 'user-guest',
      email: 'guest@test.com',
      role: 'guest',
      status: 'approved',
      displayName: 'Guest User',
    },
  };

  // Default system config (no custom tab permissions)
  const defaultSystemConfig: SystemConfig = {
    eventLookbackYears: 2,
    categories: ['학원 행사', '수학팀', '영어팀'],
  };

  // Custom tab permissions for testing
  const customTabPermissions: TabPermissionConfig = {
    admin: ['calendar', 'timetable', 'attendance', 'students'],
    manager: ['calendar', 'attendance', 'students'],
    user: ['calendar'],
    viewer: ['calendar'],
    guest: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: no custom tab permissions (uses DEFAULT_TAB_PERMISSIONS)
    (useSystemConfig as any).mockReturnValue({
      data: defaultSystemConfig,
      isLoading: false,
    });
  });

  describe('Master Role - All Tabs Access', () => {
    it('should grant master access to all tabs', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.master), {
        wrapper: createWrapper(),
      });

      // Master should have access to ALL tabs
      allTabs.forEach((tab) => {
        expect(result.current.canAccessTab(tab)).toBe(true);
      });

      // Accessible tabs should include all tabs
      expect(result.current.accessibleTabs).toEqual(allTabs);
    });

    it('should grant master all tabs even with custom config', () => {
      (useSystemConfig as any).mockReturnValue({
        data: { ...defaultSystemConfig, tabPermissions: customTabPermissions },
        isLoading: false,
      });

      const { result } = renderHook(() => useTabPermissions(mockUsers.master), {
        wrapper: createWrapper(),
      });

      // Master still has all tabs regardless of custom config
      allTabs.forEach((tab) => {
        expect(result.current.canAccessTab(tab)).toBe(true);
      });

      expect(result.current.accessibleTabs.length).toBe(allTabs.length);
    });
  });

  describe('Default Tab Permissions (No Firestore Config)', () => {
    it('should grant admin default tabs', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      // Admin default tabs (from DEFAULT_TAB_PERMISSIONS)
      expect(result.current.canAccessTab('calendar')).toBe(true);
      expect(result.current.canAccessTab('timetable')).toBe(true);
      expect(result.current.canAccessTab('attendance')).toBe(true);
      expect(result.current.canAccessTab('payment')).toBe(true);
      expect(result.current.canAccessTab('students')).toBe(true);
      expect(result.current.canAccessTab('grades')).toBe(true);
      expect(result.current.canAccessTab('classes')).toBe(true);
      expect(result.current.canAccessTab('student-consultations')).toBe(true);

      // Admin should NOT have these by default
      expect(result.current.canAccessTab('gantt')).toBe(false);
      expect(result.current.canAccessTab('consultation')).toBe(false);
    });

    it('should grant manager default tabs', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.manager), {
        wrapper: createWrapper(),
      });

      // Manager default tabs
      expect(result.current.canAccessTab('calendar')).toBe(true);
      expect(result.current.canAccessTab('attendance')).toBe(true);
      expect(result.current.canAccessTab('students')).toBe(true);
      expect(result.current.canAccessTab('grades')).toBe(true);
      expect(result.current.canAccessTab('classes')).toBe(true);
      expect(result.current.canAccessTab('student-consultations')).toBe(true);

      // Manager should NOT have these
      expect(result.current.canAccessTab('timetable')).toBe(false);
      expect(result.current.canAccessTab('payment')).toBe(false);
      expect(result.current.canAccessTab('gantt')).toBe(false);
    });

    it('should grant editor minimal default tabs', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.editor), {
        wrapper: createWrapper(),
      });

      // Editor only has calendar by default
      expect(result.current.canAccessTab('calendar')).toBe(true);

      // All other tabs denied
      expect(result.current.canAccessTab('timetable')).toBe(false);
      expect(result.current.canAccessTab('attendance')).toBe(false);
      expect(result.current.canAccessTab('students')).toBe(false);
      expect(result.current.canAccessTab('payment')).toBe(false);

      expect(result.current.accessibleTabs).toEqual(['calendar']);
    });
  });

  describe('Department-Specific Role Tab Access', () => {
    it('should grant math_lead department-specific tabs', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.math_lead), {
        wrapper: createWrapper(),
      });

      // Math Lead default tabs
      expect(result.current.canAccessTab('timetable')).toBe(true);
      expect(result.current.canAccessTab('attendance')).toBe(true);
      expect(result.current.canAccessTab('students')).toBe(true);
      expect(result.current.canAccessTab('grades')).toBe(true);
      expect(result.current.canAccessTab('classes')).toBe(true);
      expect(result.current.canAccessTab('student-consultations')).toBe(true);

      // Should NOT have calendar or payment
      expect(result.current.canAccessTab('calendar')).toBe(false);
      expect(result.current.canAccessTab('payment')).toBe(false);
    });

    it('should grant english_lead department-specific tabs', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.english_lead), {
        wrapper: createWrapper(),
      });

      // English Lead default tabs (same as math_lead)
      expect(result.current.canAccessTab('timetable')).toBe(true);
      expect(result.current.canAccessTab('attendance')).toBe(true);
      expect(result.current.canAccessTab('students')).toBe(true);
      expect(result.current.canAccessTab('grades')).toBe(true);
      expect(result.current.canAccessTab('classes')).toBe(true);
      expect(result.current.canAccessTab('student-consultations')).toBe(true);

      // Should NOT have calendar or payment
      expect(result.current.canAccessTab('calendar')).toBe(false);
      expect(result.current.canAccessTab('payment')).toBe(false);
    });

    it('should grant math_teacher and english_teacher no default tabs', () => {
      // Teachers not in DEFAULT_TAB_PERMISSIONS, should have empty access
      const { result: mathResult } = renderHook(
        () => useTabPermissions(mockUsers.math_teacher),
        { wrapper: createWrapper() }
      );

      const { result: englishResult } = renderHook(
        () => useTabPermissions(mockUsers.english_teacher),
        { wrapper: createWrapper() }
      );

      // Teachers have no default tab access
      allTabs.forEach((tab) => {
        expect(mathResult.current.canAccessTab(tab)).toBe(false);
        expect(englishResult.current.canAccessTab(tab)).toBe(false);
      });

      expect(mathResult.current.accessibleTabs).toEqual([]);
      expect(englishResult.current.accessibleTabs).toEqual([]);
    });
  });

  describe('Lower Privilege Roles', () => {
    it('should grant user basic tabs', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.user), {
        wrapper: createWrapper(),
      });

      // User default tabs
      expect(result.current.canAccessTab('calendar')).toBe(true);
      expect(result.current.canAccessTab('attendance')).toBe(true);

      // Should NOT have advanced tabs
      expect(result.current.canAccessTab('timetable')).toBe(false);
      expect(result.current.canAccessTab('students')).toBe(false);
      expect(result.current.canAccessTab('payment')).toBe(false);
    });

    it('should grant viewer minimal tabs', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.viewer), {
        wrapper: createWrapper(),
      });

      // Viewer only calendar
      expect(result.current.canAccessTab('calendar')).toBe(true);

      // All others denied
      allTabs.filter((t) => t !== 'calendar').forEach((tab) => {
        expect(result.current.canAccessTab(tab)).toBe(false);
      });

      expect(result.current.accessibleTabs).toEqual(['calendar']);
    });

    it('should grant guest minimal tabs', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.guest), {
        wrapper: createWrapper(),
      });

      // Guest only calendar
      expect(result.current.canAccessTab('calendar')).toBe(true);

      // All others denied
      allTabs.filter((t) => t !== 'calendar').forEach((tab) => {
        expect(result.current.canAccessTab(tab)).toBe(false);
      });
    });
  });

  describe('Custom Tab Permissions from Firestore', () => {
    beforeEach(() => {
      // Mock custom tab permissions from Firestore
      (useSystemConfig as any).mockReturnValue({
        data: {
          ...defaultSystemConfig,
          tabPermissions: customTabPermissions,
        },
        isLoading: false,
      });
    });

    it('should use custom tab permissions for admin', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      // Custom config: admin has only these tabs
      expect(result.current.canAccessTab('calendar')).toBe(true);
      expect(result.current.canAccessTab('timetable')).toBe(true);
      expect(result.current.canAccessTab('attendance')).toBe(true);
      expect(result.current.canAccessTab('students')).toBe(true);

      // Custom config removes these from admin
      expect(result.current.canAccessTab('payment')).toBe(false);
      expect(result.current.canAccessTab('grades')).toBe(false);
      expect(result.current.canAccessTab('gantt')).toBe(false);
    });

    it('should use custom tab permissions for manager', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.manager), {
        wrapper: createWrapper(),
      });

      // Custom config for manager
      expect(result.current.canAccessTab('calendar')).toBe(true);
      expect(result.current.canAccessTab('attendance')).toBe(true);
      expect(result.current.canAccessTab('students')).toBe(true);

      // Not in custom config
      expect(result.current.canAccessTab('timetable')).toBe(false);
      expect(result.current.canAccessTab('grades')).toBe(false);
    });

    it('should deny all tabs for roles missing in custom config', () => {
      // Math Lead not in customTabPermissions, should get empty array
      const { result } = renderHook(() => useTabPermissions(mockUsers.math_lead), {
        wrapper: createWrapper(),
      });

      // No custom config for math_lead -> empty access
      allTabs.forEach((tab) => {
        expect(result.current.canAccessTab(tab)).toBe(false);
      });

      expect(result.current.accessibleTabs).toEqual([]);
    });
  });

  describe('Null User Handling', () => {
    it('should deny all tabs when user is null', () => {
      const { result } = renderHook(() => useTabPermissions(null), {
        wrapper: createWrapper(),
      });

      // All tabs denied for null user
      allTabs.forEach((tab) => {
        expect(result.current.canAccessTab(tab)).toBe(false);
      });

      expect(result.current.accessibleTabs).toEqual([]);
    });
  });

  describe('Loading State', () => {
    it('should expose loading state from useSystemConfig', () => {
      (useSystemConfig as any).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const { result } = renderHook(() => useTabPermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should not be loading when config is loaded', () => {
      (useSystemConfig as any).mockReturnValue({
        data: defaultSystemConfig,
        isLoading: false,
      });

      const { result } = renderHook(() => useTabPermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('AccessibleTabs Array', () => {
    it('should return correct accessible tabs for admin', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      const expectedTabs: AppTab[] = [
        'calendar',
        'timetable',
        'attendance',
        'payment',
        'students',
        'grades',
        'classes',
        'student-consultations',
      ];

      expect(result.current.accessibleTabs.sort()).toEqual(expectedTabs.sort());
    });

    it('should return only calendar for editor', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.editor), {
        wrapper: createWrapper(),
      });

      expect(result.current.accessibleTabs).toEqual(['calendar']);
    });

    it('should return all tabs for master', () => {
      const { result } = renderHook(() => useTabPermissions(mockUsers.master), {
        wrapper: createWrapper(),
      });

      expect(result.current.accessibleTabs.length).toBe(allTabs.length);
      expect(result.current.accessibleTabs.sort()).toEqual(allTabs.sort());
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty custom tab permissions', () => {
      (useSystemConfig as any).mockReturnValue({
        data: {
          ...defaultSystemConfig,
          tabPermissions: {},
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useTabPermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      // With empty custom config, all roles get empty access (except master)
      allTabs.forEach((tab) => {
        expect(result.current.canAccessTab(tab)).toBe(false);
      });
    });

    it('should handle undefined systemConfig gracefully', () => {
      (useSystemConfig as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => useTabPermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      // Should fallback to DEFAULT_TAB_PERMISSIONS
      expect(result.current.canAccessTab('calendar')).toBe(true);
      expect(result.current.canAccessTab('timetable')).toBe(true);
      expect(result.current.canAccessTab('attendance')).toBe(true);
    });
  });

  describe('useMemo Optimization', () => {
    it('should not recalculate when user and config unchanged', () => {
      (useSystemConfig as any).mockReturnValue({
        data: defaultSystemConfig,
        isLoading: false,
      });

      const { result, rerender } = renderHook(
        () => useTabPermissions(mockUsers.admin),
        { wrapper: createWrapper() }
      );

      const firstResult = result.current;

      // Rerender with same props
      rerender();

      // Should return same reference (memoized)
      expect(result.current).toBe(firstResult);
    });

    it('should recalculate when user changes', () => {
      (useSystemConfig as any).mockReturnValue({
        data: defaultSystemConfig,
        isLoading: false,
      });

      const { result, rerender } = renderHook(
        ({ user }) => useTabPermissions(user),
        {
          wrapper: createWrapper(),
          initialProps: { user: mockUsers.admin },
        }
      );

      const adminResult = result.current.canAccessTab('payment');
      expect(adminResult).toBe(true); // Admin has payment

      // Change user to manager
      rerender({ user: mockUsers.manager });

      const managerResult = result.current.canAccessTab('payment');
      expect(managerResult).toBe(false); // Manager doesn't have payment
    });
  });
});
