import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { usePermissions, canAssignRole, getAssignableRoles } from '../../hooks/usePermissions';
import { getDoc } from 'firebase/firestore';
import { UserProfile, DEFAULT_ROLE_PERMISSIONS } from '../../types';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Mock useRoleSimulation
vi.mock('../../hooks/useRoleSimulation', () => ({
  useRoleSimulation: () => ({
    simulatedRole: null,
    simulatedUserProfile: null,
    simulationType: null,
    isSimulating: false,
  }),
  getEffectiveRole: (actual: any, simulated: any) => simulated || actual || null,
  getEffectiveUserProfile: (actual: any) => actual,
}));

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const masterProfile: UserProfile = {
  uid: 'master-uid',
  email: 'master@test.com',
  role: 'master',
  status: 'approved',
};

const adminProfile: UserProfile = {
  uid: 'admin-uid',
  email: 'admin@test.com',
  role: 'admin',
  status: 'approved',
};

const teacherProfile: UserProfile = {
  uid: 'teacher-uid',
  email: 'teacher@test.com',
  role: 'math_teacher',
  status: 'approved',
};

const userProfile: UserProfile = {
  uid: 'user-uid',
  email: 'user@test.com',
  role: 'user',
  status: 'approved',
};

describe('usePermissions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: no custom permissions in Firestore
    (getDoc as any).mockResolvedValue({
      exists: () => false,
      data: () => null,
    });
  });

  describe('Master permissions', () => {
    it('master는 모든 권한을 가져야 함', async () => {
      const { result } = renderHook(() => usePermissions(masterProfile), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPermission('events.create')).toBe(true);
      expect(result.current.hasPermission('settings.role_permissions')).toBe(true);
      expect(result.current.hasPermission('users.change_role')).toBe(true);
      expect(result.current.hasPermission('students.delete')).toBe(true);
    });

    it('effectiveRole이 master여야 함', async () => {
      const { result } = renderHook(() => usePermissions(masterProfile), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.effectiveRole).toBe('master');
    });
  });

  describe('Admin permissions', () => {
    it('admin은 DEFAULT_ROLE_PERMISSIONS에 따른 권한을 가져야 함', async () => {
      const { result } = renderHook(() => usePermissions(adminProfile), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // admin은 events.create 가능
      expect(result.current.hasPermission('events.create')).toBe(true);
      // admin은 settings.role_permissions 불가
      expect(result.current.hasPermission('settings.role_permissions')).toBe(false);
      // admin은 users.change_role 불가
      expect(result.current.hasPermission('users.change_role')).toBe(false);
    });
  });

  describe('Teacher permissions', () => {
    it('math_teacher는 제한된 권한을 가져야 함', async () => {
      const { result } = renderHook(() => usePermissions(teacherProfile), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // math_teacher: 수학 시간표 view 가능, edit 불가
      expect(result.current.hasPermission('timetable.math.view')).toBe(true);
      expect(result.current.hasPermission('timetable.math.edit')).toBe(false);
      // math_teacher: 학생 view 가능, edit 불가
      expect(result.current.hasPermission('students.view')).toBe(true);
      expect(result.current.hasPermission('students.edit')).toBe(false);
      // math_teacher: settings 접근 불가
      expect(result.current.hasPermission('settings.access')).toBe(false);
    });
  });

  describe('User permissions', () => {
    it('user 역할은 최소 권한만 가져야 함', async () => {
      const { result } = renderHook(() => usePermissions(userProfile), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPermission('events.create')).toBe(true);
      expect(result.current.hasPermission('events.manage_others')).toBe(false);
      expect(result.current.hasPermission('students.edit')).toBe(false);
      expect(result.current.hasPermission('attendance.manage_own')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('userProfile이 null이면 모든 권한 false', async () => {
      const { result } = renderHook(() => usePermissions(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPermission('events.create')).toBe(false);
    });

    it('role이 없는 프로필이면 모든 권한 false', async () => {
      const noRoleProfile = { ...adminProfile, role: undefined as any };
      const { result } = renderHook(() => usePermissions(noRoleProfile), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPermission('events.create')).toBe(false);
    });
  });

  describe('Firestore custom permissions', () => {
    it('Firestore에서 커스텀 권한이 있으면 병합하여 사용', async () => {
      (getDoc as any).mockResolvedValue({
        exists: () => true,
        data: () => ({
          admin: {
            'settings.role_permissions': true, // 기본값은 false
          },
        }),
      });

      const { result } = renderHook(() => usePermissions(adminProfile), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 커스텀으로 true로 변경됨
      expect(result.current.hasPermission('settings.role_permissions')).toBe(true);
    });
  });

  describe('rolePermissions default', () => {
    it('기본 rolePermissions를 반환해야 함', async () => {
      const { result } = renderHook(() => usePermissions(adminProfile), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.rolePermissions).toBeDefined();
    });
  });
});

describe('canAssignRole', () => {
  it('master는 모든 역할 할당 가능', () => {
    expect(canAssignRole('master', 'admin')).toBe(true);
    expect(canAssignRole('master', 'manager')).toBe(true);
    expect(canAssignRole('master', 'user')).toBe(true);
  });

  it('admin은 자신보다 낮은 역할만 할당 가능', () => {
    expect(canAssignRole('admin', 'master')).toBe(false);
    expect(canAssignRole('admin', 'manager')).toBe(true);
    expect(canAssignRole('admin', 'user')).toBe(true);
  });

  it('같은 역할은 할당 불가', () => {
    expect(canAssignRole('admin', 'admin')).toBe(false);
    expect(canAssignRole('manager', 'manager')).toBe(false);
  });

  it('user는 아무 역할도 할당 불가', () => {
    expect(canAssignRole('user', 'master')).toBe(false);
    expect(canAssignRole('user', 'admin')).toBe(false);
  });
});

describe('getAssignableRoles', () => {
  it('master는 모든 하위 역할 목록 반환', () => {
    const roles = getAssignableRoles('master');
    expect(roles).toContain('admin');
    expect(roles).toContain('user');
    expect(roles).not.toContain('master');
  });

  it('admin은 manager 이하 역할 반환', () => {
    const roles = getAssignableRoles('admin');
    expect(roles).not.toContain('master');
    expect(roles).not.toContain('admin');
    expect(roles).toContain('manager');
    expect(roles).toContain('user');
  });

  it('user는 빈 배열 반환', () => {
    const roles = getAssignableRoles('user');
    expect(roles).toHaveLength(0);
  });
});
