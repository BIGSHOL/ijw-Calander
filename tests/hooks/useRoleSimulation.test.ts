import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  getEffectiveRole,
  getEffectiveUserProfile,
  RoleSimulationProvider,
  useRoleSimulation,
  useEffectiveUserProfile,
} from '../../hooks/useRoleSimulation';
import type { UserRole, UserProfile } from '../../types';

let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  consoleWarnSpy.mockRestore();
});

// Helper function to create a user profile
function createUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'user',
    status: 'approved',
    staffId: 'staff-123',
    departmentPermissions: { math: 'view', english: 'edit' },
    favoriteDepartments: ['math', 'english'],
    ...overrides,
  };
}

describe('useRoleSimulation - Pure Functions', () => {
  describe('getEffectiveRole', () => {
    it('returns simulatedRole when actualRole is master and simulatedRole is set', () => {
      const result = getEffectiveRole('master', 'admin');
      expect(result).toBe('admin');
    });

    it('returns actualRole when not master', () => {
      const result = getEffectiveRole('admin', 'teacher');
      expect(result).toBe('admin');
    });

    it('returns actualRole when simulatedRole is null', () => {
      const result = getEffectiveRole('master', null);
      expect(result).toBe('master');
    });

    it('returns null when actualRole is null', () => {
      const result = getEffectiveRole(null, 'admin');
      expect(result).toBe(null);
    });

    it('returns null when actualRole is undefined', () => {
      const result = getEffectiveRole(undefined, 'admin');
      expect(result).toBe(null);
    });

    it('returns simulatedRole for all non-master roles when master simulates', () => {
      const roles: UserRole[] = ['admin', 'manager', 'math_lead', 'english_lead', 'math_teacher', 'english_teacher', 'user'];

      roles.forEach(role => {
        const result = getEffectiveRole('master', role);
        expect(result).toBe(role);
      });
    });
  });

  describe('getEffectiveUserProfile', () => {
    it('returns actualProfile when not master', () => {
      const profile = createUserProfile({ role: 'admin' });
      const result = getEffectiveUserProfile(profile, 'teacher', null, null);

      expect(result).toBe(profile);
    });

    it('returns null when actualProfile is null', () => {
      const result = getEffectiveUserProfile(null, 'teacher', null, 'role');
      expect(result).toBe(null);
    });

    it('returns simulatedUserProfile when simulationType is user and master', () => {
      const actualProfile = createUserProfile({ role: 'master', uid: 'master-uid' });
      const simulatedProfile = createUserProfile({
        role: 'teacher',
        uid: 'teacher-uid',
        displayName: 'Teacher User',
        departmentPermissions: { science: 'view' },
      });

      const result = getEffectiveUserProfile(actualProfile, 'teacher', simulatedProfile, 'user');

      expect(result).toBe(simulatedProfile);
      expect(result?.uid).toBe('teacher-uid');
      expect(result?.displayName).toBe('Teacher User');
      expect(result?.departmentPermissions).toEqual({ science: 'view' });
    });

    it('returns modified profile with role changed when simulationType is role and master', () => {
      const actualProfile = createUserProfile({
        role: 'master',
        uid: 'master-uid',
        displayName: 'Master User',
        departmentPermissions: { math: 'edit', english: 'edit' },
        favoriteDepartments: ['math', 'english'],
      });

      const result = getEffectiveUserProfile(actualProfile, 'manager', null, 'role');

      expect(result).not.toBe(actualProfile);
      expect(result?.uid).toBe('master-uid');
      expect(result?.displayName).toBe('Master User');
      expect(result?.role).toBe('manager');
      expect(result?.departmentPermissions).toEqual({});
      expect(result?.favoriteDepartments).toEqual([]);
    });

    it('clears departmentPermissions when simulationType is role', () => {
      const actualProfile = createUserProfile({
        role: 'master',
        departmentPermissions: { math: 'edit', english: 'view', science: 'edit' },
      });

      const result = getEffectiveUserProfile(actualProfile, 'admin', null, 'role');

      expect(result?.departmentPermissions).toEqual({});
    });

    it('clears favoriteDepartments when simulationType is role', () => {
      const actualProfile = createUserProfile({
        role: 'master',
        favoriteDepartments: ['math', 'english', 'science'],
      });

      const result = getEffectiveUserProfile(actualProfile, 'admin', null, 'role');

      expect(result?.favoriteDepartments).toEqual([]);
    });

    it('returns actualProfile when no simulation active', () => {
      const actualProfile = createUserProfile({ role: 'master' });

      const result = getEffectiveUserProfile(actualProfile, null, null, null);

      expect(result).toBe(actualProfile);
    });

    it('returns actualProfile when simulationType is null', () => {
      const actualProfile = createUserProfile({ role: 'master' });

      const result = getEffectiveUserProfile(actualProfile, 'admin', null, null);

      expect(result).toBe(actualProfile);
    });

    it('preserves other profile properties during role simulation', () => {
      const actualProfile = createUserProfile({
        role: 'master',
        email: 'master@example.com',
        staffId: 'master-staff-123',
        jobTitle: 'Master Admin',
      });

      const result = getEffectiveUserProfile(actualProfile, 'teacher', null, 'role');

      expect(result?.email).toBe('master@example.com');
      expect(result?.staffId).toBe('master-staff-123');
      expect(result?.jobTitle).toBe('Master Admin');
    });
  });
});

describe('useRoleSimulation - Hook without Provider', () => {
  it('returns default values when used outside provider', () => {
    const { result } = renderHook(() => useRoleSimulation());

    expect(result.current.simulatedRole).toBe(null);
    expect(result.current.simulatedUserProfile).toBe(null);
    expect(result.current.simulationType).toBe(null);
    expect(result.current.isSimulating).toBe(false);
    expect(result.current.availableRoles).toEqual([]);
    expect(result.current.simulatedRoleLabel).toBe(null);
    expect(result.current.simulatedUserInfo).toBe(null);
  });

  it('startRoleSimulation does nothing when used outside provider', () => {
    const { result } = renderHook(() => useRoleSimulation());

    act(() => {
      result.current.startRoleSimulation('admin');
    });

    expect(result.current.simulatedRole).toBe(null);
  });

  it('startUserSimulation does nothing when used outside provider', () => {
    const { result } = renderHook(() => useRoleSimulation());
    const userProfile = createUserProfile({ role: 'teacher' });

    act(() => {
      result.current.startUserSimulation(userProfile);
    });

    expect(result.current.simulatedUserProfile).toBe(null);
  });

  it('stopSimulation does nothing when used outside provider', () => {
    const { result } = renderHook(() => useRoleSimulation());

    act(() => {
      result.current.stopSimulation();
    });

    expect(result.current.isSimulating).toBe(false);
  });
});

describe('useRoleSimulation - Provider with Role Simulation', () => {
  it('startRoleSimulation sets simulatedRole when user is master', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    act(() => {
      result.current.startRoleSimulation('admin');
    });

    expect(result.current.simulatedRole).toBe('admin');
    expect(result.current.simulationType).toBe('role');
    expect(result.current.isSimulating).toBe(true);
  });

  it('cannot simulate as master role', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    act(() => {
      result.current.startRoleSimulation('master');
    });

    expect(result.current.simulatedRole).toBe(null);
    expect(result.current.isSimulating).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith('[RoleSimulation] Cannot simulate master role');
  });

  it('only master can start simulation', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'admin' },
        children
      ),
    });

    act(() => {
      result.current.startRoleSimulation('teacher');
    });

    expect(result.current.simulatedRole).toBe(null);
    expect(result.current.isSimulating).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith('[RoleSimulation] Only master can start simulation');
  });

  it('stopSimulation clears state', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    act(() => {
      result.current.startRoleSimulation('admin');
    });

    expect(result.current.isSimulating).toBe(true);

    act(() => {
      result.current.stopSimulation();
    });

    expect(result.current.simulatedRole).toBe(null);
    expect(result.current.simulationType).toBe(null);
    expect(result.current.isSimulating).toBe(false);
  });

  it('updates simulatedRoleLabel when role changes', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    act(() => {
      result.current.startRoleSimulation('admin');
    });

    expect(result.current.simulatedRoleLabel).toBe('ADMIN');

    act(() => {
      result.current.startRoleSimulation('math_lead');
    });

    expect(result.current.simulatedRoleLabel).toBe('수학팀장');
  });
});

describe('useRoleSimulation - Provider with User Simulation', () => {
  it('startUserSimulation sets both role and profile', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    const userProfile = createUserProfile({
      role: 'teacher',
      uid: 'teacher-123',
      displayName: 'Teacher Name',
    });

    act(() => {
      result.current.startUserSimulation(userProfile);
    });

    expect(result.current.simulatedRole).toBe('teacher');
    expect(result.current.simulatedUserProfile).toBe(userProfile);
    expect(result.current.simulationType).toBe('user');
    expect(result.current.isSimulating).toBe(true);
  });

  it('cannot simulate master user', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    const masterProfile = createUserProfile({ role: 'master' });

    act(() => {
      result.current.startUserSimulation(masterProfile);
    });

    expect(result.current.simulatedUserProfile).toBe(null);
    expect(result.current.isSimulating).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith('[RoleSimulation] Cannot simulate master user');
  });

  it('simulatedUserInfo is populated during user simulation', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    const userProfile = createUserProfile({
      role: 'teacher',
      uid: 'teacher-123',
      displayName: 'John Doe',
      email: 'john@example.com',
      jobTitle: 'Math Teacher',
    });

    act(() => {
      result.current.startUserSimulation(userProfile);
    });

    expect(result.current.simulatedUserInfo).toEqual({
      uid: 'teacher-123',
      displayName: 'John Doe',
      email: 'john@example.com',
      role: 'teacher',
      jobTitle: 'Math Teacher',
    });
  });

  it('simulatedUserInfo is null during role simulation', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    act(() => {
      result.current.startRoleSimulation('admin');
    });

    expect(result.current.simulatedUserInfo).toBe(null);
  });

  it('uses email prefix as displayName when displayName is missing', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    const userProfile = createUserProfile({
      role: 'teacher',
      email: 'janedoe@example.com',
      displayName: '',
    });

    act(() => {
      result.current.startUserSimulation(userProfile);
    });

    expect(result.current.simulatedUserInfo?.displayName).toBe('janedoe');
  });
});

describe('useRoleSimulation - Available Roles', () => {
  it('availableRoles excludes master', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    expect(result.current.availableRoles).not.toContain('master');
    expect(result.current.availableRoles.length).toBeGreaterThan(0);
  });

  it('availableRoles includes all other roles', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    const expectedRoles: UserRole[] = ['admin', 'manager', 'math_lead', 'english_lead', 'math_teacher', 'english_teacher', 'user'];

    expectedRoles.forEach(role => {
      expect(result.current.availableRoles).toContain(role);
    });
  });
});

describe('useRoleSimulation - External State Management', () => {
  it('uses external state when provided', () => {
    const externalState = {
      simulationType: 'role' as const,
      simulatedRole: 'admin' as UserRole,
      simulatedUserProfile: null,
    };

    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master', externalState },
        children
      ),
    });

    expect(result.current.simulatedRole).toBe('admin');
    expect(result.current.simulationType).toBe('role');
    expect(result.current.isSimulating).toBe(true);
  });

  it('calls onStateChange when state changes', () => {
    const onStateChange = vi.fn();

    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master', onStateChange },
        children
      ),
    });

    act(() => {
      result.current.startRoleSimulation('manager');
    });

    expect(onStateChange).toHaveBeenCalledWith({
      simulationType: 'role',
      simulatedRole: 'manager',
      simulatedUserProfile: null,
    });
  });
});

describe('useEffectiveUserProfile - Hook', () => {
  it('returns actual profile when not simulating', () => {
    const actualProfile = createUserProfile({ role: 'admin' });

    const { result } = renderHook(() => useEffectiveUserProfile(actualProfile), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'admin' },
        children
      ),
    });

    expect(result.current.effectiveProfile).toBe(actualProfile);
    expect(result.current.actualProfile).toBe(actualProfile);
    expect(result.current.isSimulating).toBe(false);
    expect(result.current.simulationType).toBe(null);
  });

  it('returns simulated profile during role simulation', () => {
    const actualProfile = createUserProfile({ role: 'master' });

    const { result: hookResult } = renderHook(
      () => ({
        simulation: useRoleSimulation(),
        effective: useEffectiveUserProfile(actualProfile),
      }),
      {
        wrapper: ({ children }) => React.createElement(
          RoleSimulationProvider,
          { actualRole: 'master' },
          children
        ),
      }
    );

    act(() => {
      hookResult.current.simulation.startRoleSimulation('teacher');
    });

    expect(hookResult.current.effective.effectiveProfile?.role).toBe('teacher');
    expect(hookResult.current.effective.actualProfile).toBe(actualProfile);
    expect(hookResult.current.effective.isSimulating).toBe(true);
    expect(hookResult.current.effective.simulationType).toBe('role');
  });

  it('returns simulated user profile during user simulation', () => {
    const actualProfile = createUserProfile({ role: 'master', uid: 'master-uid' });
    const simulatedProfile = createUserProfile({ role: 'teacher', uid: 'teacher-uid' });

    const { result: hookResult } = renderHook(
      () => ({
        simulation: useRoleSimulation(),
        effective: useEffectiveUserProfile(actualProfile),
      }),
      {
        wrapper: ({ children }) => React.createElement(
          RoleSimulationProvider,
          { actualRole: 'master' },
          children
        ),
      }
    );

    act(() => {
      hookResult.current.simulation.startUserSimulation(simulatedProfile);
    });

    expect(hookResult.current.effective.effectiveProfile).toBe(simulatedProfile);
    expect(hookResult.current.effective.actualProfile).toBe(actualProfile);
    expect(hookResult.current.effective.isSimulating).toBe(true);
    expect(hookResult.current.effective.simulationType).toBe('user');
  });
});

describe('useRoleSimulation - Backward Compatibility', () => {
  it('startSimulation is an alias for startRoleSimulation', () => {
    const { result } = renderHook(() => useRoleSimulation(), {
      wrapper: ({ children }) => React.createElement(
        RoleSimulationProvider,
        { actualRole: 'master' },
        children
      ),
    });

    act(() => {
      result.current.startSimulation('manager');
    });

    expect(result.current.simulatedRole).toBe('manager');
    expect(result.current.simulationType).toBe('role');
  });
});
