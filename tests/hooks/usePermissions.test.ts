import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { usePermissions, canAssignRole } from '../../hooks/usePermissions';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import { doc, onSnapshot } from 'firebase/firestore';
import type { UserProfile, UserRole, RolePermissions } from '../../types';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
}));

// Mock Firebase app
vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

describe('usePermissions Hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

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
      teacherId: 'teacher-math-1',
      departmentId: 'math',
    },
    english_teacher: {
      uid: 'user-english-teacher',
      email: 'english_teacher@test.com',
      role: 'english_teacher',
      status: 'approved',
      displayName: 'English Teacher User',
      teacherId: 'teacher-english-1',
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

  // Mock role permissions from Firestore
  const mockRolePermissions: RolePermissions = {
    admin: {
      'events.create': true,
      'events.manage_own': true,
      'events.manage_others': true,
      'users.view': true,
      'users.approve': true,
      'settings.access': true,
    },
    manager: {
      'events.create': true,
      'events.manage_own': true,
      'events.manage_others': true,
      'users.view': true,
      'users.approve': false,
      'settings.access': false,
    },
    math_lead: {
      'events.create': true,
      'events.manage_own': true,
      'timetable.math.view': true,
      'timetable.math.edit': true,
      'attendance.manage_math': true,
    },
    english_lead: {
      'events.create': true,
      'events.manage_own': true,
      'timetable.english.view': true,
      'timetable.english.edit': true,
      'attendance.manage_english': true,
    },
    math_teacher: {
      'events.create': true,
      'events.manage_own': true,
      'timetable.math.view': true,
      'attendance.manage_own': true,
    },
    english_teacher: {
      'events.create': true,
      'events.manage_own': true,
      'timetable.english.view': true,
      'attendance.manage_own': true,
    },
    user: {
      'events.create': true,
      'events.manage_own': true,
    },
    viewer: {
      'events.create': false,
      'events.manage_own': false,
      'departments.view_all': true,
    },
    guest: {
      'events.create': false,
      'events.manage_own': false,
      'departments.view_all': false,
    },
  };

  let unsubscribeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribeMock = vi.fn();

    // Setup Firestore mocks
    (doc as any).mockReturnValue({});
    (onSnapshot as any).mockImplementation((docRef, callback) => {
      // Immediately call the callback with mock data
      callback({
        exists: () => true,
        data: () => mockRolePermissions,
      });
      return unsubscribeMock;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Master Role - All Permissions', () => {
    it('should grant MASTER all permissions without checking Firestore', async () => {
      const { result } = renderHook(() => usePermissions(mockUsers.master), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // MASTER should have all permissions
      expect(result.current.hasPermission('events.create')).toBe(true);
      expect(result.current.hasPermission('users.view')).toBe(true);
      expect(result.current.hasPermission('users.approve')).toBe(true);
      expect(result.current.hasPermission('users.change_role')).toBe(true);
      expect(result.current.hasPermission('settings.role_permissions')).toBe(true);
      expect(result.current.hasPermission('departments.manage')).toBe(true);
      expect(result.current.hasPermission('attendance.edit_all')).toBe(true);
    });

    it('should return true for any arbitrary permission for MASTER', async () => {
      const { result } = renderHook(() => usePermissions(mockUsers.master), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Even permissions not defined should return true for MASTER
      expect(result.current.hasPermission('gantt.create')).toBe(true);
      expect(result.current.hasPermission('gantt.delete')).toBe(true);
      expect(result.current.hasPermission('timetable.integrated.view')).toBe(true);
    });
  });

  describe('Admin Role Permissions', () => {
    it('should grant admin permissions based on Firestore configuration', async () => {
      const { result } = renderHook(() => usePermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Permissions that admin has
      expect(result.current.hasPermission('events.create')).toBe(true);
      expect(result.current.hasPermission('events.manage_own')).toBe(true);
      expect(result.current.hasPermission('events.manage_others')).toBe(true);
      expect(result.current.hasPermission('users.view')).toBe(true);
      expect(result.current.hasPermission('users.approve')).toBe(true);
      expect(result.current.hasPermission('settings.access')).toBe(true);
    });

    it('should use default permissions when permission not in mock', async () => {
      const { result } = renderHook(() => usePermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // These permissions exist in mockRolePermissions
      expect(result.current.hasPermission('events.create')).toBe(true);
      expect(result.current.hasPermission('users.view')).toBe(true);

      // Permissions not in our simple mock use default (should exist)
      expect(result.current.rolePermissions.admin).toBeDefined();
    });
  });

  describe('Manager Role Permissions', () => {
    it('should grant manager limited permissions compared to admin', async () => {
      const { result } = renderHook(() => usePermissions(mockUsers.manager), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Manager has these permissions
      expect(result.current.hasPermission('events.create')).toBe(true);
      expect(result.current.hasPermission('events.manage_own')).toBe(true);
      expect(result.current.hasPermission('events.manage_others')).toBe(true);
      expect(result.current.hasPermission('users.view')).toBe(true);

      // Manager does NOT have these admin permissions
      expect(result.current.hasPermission('users.approve')).toBe(false);
      expect(result.current.hasPermission('settings.access')).toBe(false);
    });
  });

  describe('Department-Specific Roles', () => {
    describe('Math Lead', () => {
      it('should grant math lead math-specific permissions', async () => {
        const { result } = renderHook(() => usePermissions(mockUsers.math_lead), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // Math Lead permissions
        expect(result.current.hasPermission('timetable.math.view')).toBe(true);
        expect(result.current.hasPermission('timetable.math.edit')).toBe(true);
        expect(result.current.hasPermission('attendance.manage_math')).toBe(true);

        // Should NOT have english permissions
        expect(result.current.hasPermission('timetable.english.edit')).toBe(false);
        expect(result.current.hasPermission('attendance.manage_english')).toBe(false);
      });
    });

    describe('English Lead', () => {
      it('should grant english lead english-specific permissions', async () => {
        const { result } = renderHook(() => usePermissions(mockUsers.english_lead), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // English Lead permissions
        expect(result.current.hasPermission('timetable.english.view')).toBe(true);
        expect(result.current.hasPermission('timetable.english.edit')).toBe(true);
        expect(result.current.hasPermission('attendance.manage_english')).toBe(true);

        // Should NOT have math permissions
        expect(result.current.hasPermission('timetable.math.edit')).toBe(false);
        expect(result.current.hasPermission('attendance.manage_math')).toBe(false);
      });
    });

    describe('Math Teacher', () => {
      it('should grant math teacher limited math permissions', async () => {
        const { result } = renderHook(() => usePermissions(mockUsers.math_teacher), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // Math Teacher can view but not edit
        expect(result.current.hasPermission('timetable.math.view')).toBe(true);
        expect(result.current.hasPermission('attendance.manage_own')).toBe(true);

        // Cannot manage all math students
        expect(result.current.hasPermission('timetable.math.edit')).toBe(false);
        expect(result.current.hasPermission('attendance.manage_math')).toBe(false);
      });
    });

    describe('English Teacher', () => {
      it('should grant english teacher limited english permissions', async () => {
        const { result } = renderHook(() => usePermissions(mockUsers.english_teacher), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // English Teacher can view but not edit
        expect(result.current.hasPermission('timetable.english.view')).toBe(true);
        expect(result.current.hasPermission('attendance.manage_own')).toBe(true);

        // Cannot manage all english students
        expect(result.current.hasPermission('timetable.english.edit')).toBe(false);
        expect(result.current.hasPermission('attendance.manage_english')).toBe(false);
      });
    });
  });

  describe('Lower Privilege Roles', () => {
    describe('User Role', () => {
      it('should grant basic permissions to user role', async () => {
        const { result } = renderHook(() => usePermissions(mockUsers.user), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // User has basic event permissions
        expect(result.current.hasPermission('events.create')).toBe(true);
        expect(result.current.hasPermission('events.manage_own')).toBe(true);

        // User does NOT have advanced permissions
        expect(result.current.hasPermission('events.manage_others')).toBe(false);
        expect(result.current.hasPermission('users.view')).toBe(false);
        expect(result.current.hasPermission('settings.access')).toBe(false);
      });
    });

    describe('Viewer Role', () => {
      it('should grant read-only permissions to viewer role', async () => {
        const { result } = renderHook(() => usePermissions(mockUsers.viewer), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // Viewer can only view departments
        expect(result.current.hasPermission('departments.view_all')).toBe(true);

        // Viewer CANNOT create or edit
        expect(result.current.hasPermission('events.create')).toBe(false);
        expect(result.current.hasPermission('events.manage_own')).toBe(false);
        expect(result.current.hasPermission('users.view')).toBe(false);
      });
    });

    describe('Guest Role', () => {
      it('should grant minimal permissions to guest role', async () => {
        const { result } = renderHook(() => usePermissions(mockUsers.guest), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // Guest has almost no permissions
        expect(result.current.hasPermission('events.create')).toBe(false);
        expect(result.current.hasPermission('events.manage_own')).toBe(false);
        expect(result.current.hasPermission('departments.view_all')).toBe(false);
        expect(result.current.hasPermission('users.view')).toBe(false);
      });
    });
  });

  describe('Null User Handling', () => {
    it('should deny all permissions when user is null', async () => {
      const { result } = renderHook(() => usePermissions(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // All permissions should be denied for null user
      expect(result.current.hasPermission('events.create')).toBe(false);
      expect(result.current.hasPermission('users.view')).toBe(false);
      expect(result.current.hasPermission('settings.access')).toBe(false);
    });
  });

  describe('Firestore Real-time Updates', () => {
    it('should subscribe to Firestore role permissions on mount', () => {
      renderHook(() => usePermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      // Should have called onSnapshot with docRef, callback, and error handler
      expect(onSnapshot).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should unsubscribe from Firestore on unmount', () => {
      const { unmount } = renderHook(() => usePermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      unmount();

      // Should have called unsubscribe function
      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should update permissions when Firestore data changes', async () => {
      let snapshotCallback: any;
      (onSnapshot as any).mockImplementation((docRef, callback) => {
        snapshotCallback = callback;
        // Initial data
        callback({
          exists: () => true,
          data: () => ({
            admin: { 'events.create': false }, // Initially deny
          }),
        });
        return unsubscribeMock;
      });

      const { result } = renderHook(() => usePermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initially denied
      expect(result.current.hasPermission('events.create')).toBe(false);

      // Simulate Firestore update
      snapshotCallback({
        exists: () => true,
        data: () => ({
          admin: { 'events.create': true }, // Now allow
        }),
      });

      await waitFor(() => {
        expect(result.current.hasPermission('events.create')).toBe(true);
      });
    });
  });

  describe('canAssignRole Helper Function', () => {
    it('should allow higher roles to assign lower roles', () => {
      // Master can assign all roles
      expect(canAssignRole('master', 'admin')).toBe(true);
      expect(canAssignRole('master', 'guest')).toBe(true);

      // Admin can assign manager and below
      expect(canAssignRole('admin', 'manager')).toBe(true);
      expect(canAssignRole('admin', 'user')).toBe(true);
      expect(canAssignRole('admin', 'guest')).toBe(true);

      // Manager can assign editor and below
      expect(canAssignRole('manager', 'editor')).toBe(true);
      expect(canAssignRole('manager', 'user')).toBe(true);
    });

    it('should NOT allow roles to assign equal or higher roles', () => {
      // Admin CANNOT assign master or admin
      expect(canAssignRole('admin', 'master')).toBe(false);
      expect(canAssignRole('admin', 'admin')).toBe(false);

      // Manager CANNOT assign admin or manager
      expect(canAssignRole('manager', 'admin')).toBe(false);
      expect(canAssignRole('manager', 'manager')).toBe(false);

      // User CAN assign lower roles (viewer, guest) but not higher
      expect(canAssignRole('user', 'manager')).toBe(false);
      expect(canAssignRole('user', 'user')).toBe(false); // Cannot assign same level
    });

    it('should handle department-specific role assignments correctly', () => {
      // Math Lead (index 4) can assign math_teacher (index 6) and below
      expect(canAssignRole('math_lead', 'math_teacher')).toBe(true);
      expect(canAssignRole('math_lead', 'user')).toBe(true);

      // English Lead (index 5) can assign english_teacher (index 7) and below
      expect(canAssignRole('english_lead', 'english_teacher')).toBe(true);
      expect(canAssignRole('english_lead', 'user')).toBe(true);

      // Teachers (index 6, 7) can assign user (index 8) and below
      expect(canAssignRole('math_teacher', 'user')).toBe(true);
      expect(canAssignRole('english_teacher', 'user')).toBe(true);
      expect(canAssignRole('math_teacher', 'viewer')).toBe(true);
      expect(canAssignRole('english_teacher', 'guest')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore errors gracefully', async () => {
      (onSnapshot as any).mockImplementation((docRef, callback, errorCallback) => {
        // Simulate Firestore error
        errorCallback(new Error('Firestore connection failed'));
        return unsubscribeMock;
      });

      const { result } = renderHook(() => usePermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still function with default permissions
      expect(result.current.rolePermissions).toBeDefined();
    });

    it('should handle missing Firestore document', async () => {
      (onSnapshot as any).mockImplementation((docRef, callback) => {
        // Document doesn't exist
        callback({
          exists: () => false,
          data: () => undefined,
        });
        return unsubscribeMock;
      });

      const { result } = renderHook(() => usePermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should use default permissions
      expect(result.current.rolePermissions).toBeDefined();
    });
  });

  describe('Loading State', () => {
    it('should start with loading true before Firestore response', async () => {
      let callbackFn: any;
      (onSnapshot as any).mockImplementation((docRef, callback, errorCallback) => {
        // Store callback but don't call it immediately
        callbackFn = callback;
        return unsubscribeMock;
      });

      const { result } = renderHook(() => usePermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Trigger the callback
      callbackFn({
        exists: () => true,
        data: () => mockRolePermissions,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set loading false after Firestore response', async () => {
      const { result } = renderHook(() => usePermissions(mockUsers.admin), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
