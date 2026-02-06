import { renderHook } from '@testing-library/react';
import { useTabPermissions } from '../../hooks/useTabPermissions';
import { UserProfile, AppTab, DEFAULT_TAB_PERMISSIONS } from '../../types';

// Mock useFirebaseQueries
vi.mock('../../hooks/useFirebaseQueries', () => ({
  useSystemConfig: vi.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
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

const userRoleProfile: UserProfile = {
  uid: 'user-uid',
  email: 'user@test.com',
  role: 'user',
  status: 'approved',
};

const pendingProfile: UserProfile = {
  uid: 'pending-uid',
  email: 'pending@test.com',
  role: 'admin',
  status: 'pending',
};

describe('useTabPermissions', () => {
  describe('Master access', () => {
    it('master는 모든 탭에 접근 가능', () => {
      const { result } = renderHook(() => useTabPermissions(masterProfile));

      expect(result.current.canAccessTab('dashboard')).toBe(true);
      expect(result.current.canAccessTab('calendar')).toBe(true);
      expect(result.current.canAccessTab('timetable')).toBe(true);
      expect(result.current.canAccessTab('students')).toBe(true);
      expect(result.current.canAccessTab('role-management')).toBe(true);
      expect(result.current.canAccessTab('help')).toBe(true);
    });

    it('master의 accessibleTabs에 모든 탭이 포함', () => {
      const { result } = renderHook(() => useTabPermissions(masterProfile));

      expect(result.current.accessibleTabs).toContain('dashboard');
      expect(result.current.accessibleTabs).toContain('role-management');
      expect(result.current.accessibleTabs.length).toBeGreaterThan(10);
    });
  });

  describe('Admin access', () => {
    it('admin은 DEFAULT_TAB_PERMISSIONS에 따른 탭 접근', () => {
      const { result } = renderHook(() => useTabPermissions(adminProfile));

      expect(result.current.canAccessTab('dashboard')).toBe(true);
      expect(result.current.canAccessTab('students')).toBe(true);
      expect(result.current.canAccessTab('role-management')).toBe(true);
    });
  });

  describe('Teacher access', () => {
    it('math_teacher는 제한된 탭에만 접근 가능', () => {
      const { result } = renderHook(() => useTabPermissions(teacherProfile));

      expect(result.current.canAccessTab('dashboard')).toBe(true);
      expect(result.current.canAccessTab('students')).toBe(true);
      expect(result.current.canAccessTab('grades')).toBe(true);
      // math_teacher는 billing, staff 접근 불가
      expect(result.current.canAccessTab('billing')).toBe(false);
      expect(result.current.canAccessTab('staff')).toBe(false);
      expect(result.current.canAccessTab('role-management')).toBe(false);
    });
  });

  describe('User access', () => {
    it('user는 기본 탭만 접근 가능', () => {
      const { result } = renderHook(() => useTabPermissions(userRoleProfile));

      expect(result.current.canAccessTab('dashboard')).toBe(true);
      expect(result.current.canAccessTab('calendar')).toBe(true);
      // user는 students, timetable 접근 불가
      expect(result.current.canAccessTab('students')).toBe(false);
      expect(result.current.canAccessTab('timetable')).toBe(false);
    });
  });

  describe('Help tab', () => {
    it('모든 역할이 help 탭에 접근 가능', () => {
      const { result: masterResult } = renderHook(() => useTabPermissions(masterProfile));
      const { result: userResult } = renderHook(() => useTabPermissions(userRoleProfile));
      const { result: teacherResult } = renderHook(() => useTabPermissions(teacherProfile));

      expect(masterResult.current.canAccessTab('help')).toBe(true);
      expect(userResult.current.canAccessTab('help')).toBe(true);
      expect(teacherResult.current.canAccessTab('help')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('userProfile이 null이면 모든 탭 접근 불가', () => {
      const { result } = renderHook(() => useTabPermissions(null));

      expect(result.current.canAccessTab('dashboard')).toBe(false);
      expect(result.current.accessibleTabs).toHaveLength(0);
    });

    it('승인되지 않은 사용자는 모든 탭 접근 불가', () => {
      const { result } = renderHook(() => useTabPermissions(pendingProfile));

      expect(result.current.canAccessTab('dashboard')).toBe(false);
      expect(result.current.canAccessTab('calendar')).toBe(false);
    });

    it('role이 없는 프로필이면 접근 불가', () => {
      const noRoleProfile = { ...adminProfile, role: undefined as any };
      const { result } = renderHook(() => useTabPermissions(noRoleProfile));

      // null/undefined role -> false (help 제외)
      expect(result.current.canAccessTab('dashboard')).toBe(false);
    });
  });

  describe('accessibleTabs filtering', () => {
    it('math_teacher의 accessibleTabs에는 허용된 탭만 포함', () => {
      const { result } = renderHook(() => useTabPermissions(teacherProfile));

      const expectedTabs = DEFAULT_TAB_PERMISSIONS.math_teacher || [];
      // help 탭은 항상 포함
      for (const tab of expectedTabs) {
        expect(result.current.accessibleTabs).toContain(tab);
      }
      // billing은 미포함
      expect(result.current.accessibleTabs).not.toContain('billing');
    });
  });
});
