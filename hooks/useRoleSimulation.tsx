import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { UserRole, UserProfile, ROLE_HIERARCHY, ROLE_LABELS } from '../types';

/** 시뮬레이션 타입 */
type SimulationType = 'role' | 'user' | null;

/** 시뮬레이션 대상 사용자 정보 (선택 표시용) */
export interface SimulatedUserInfo {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  jobTitle?: string;
}

interface RoleSimulationContextValue {
  /** 현재 시뮬레이션 중인 역할 (null이면 시뮬레이션 비활성화) */
  simulatedRole: UserRole | null;
  /** 현재 시뮬레이션 중인 사용자 프로필 (사용자 시뮬레이션 시) */
  simulatedUserProfile: UserProfile | null;
  /** 시뮬레이션 타입 */
  simulationType: SimulationType;
  /** 시뮬레이션 모드 활성화 여부 */
  isSimulating: boolean;
  /** 역할 시뮬레이션 시작 (마스터만 가능) */
  startRoleSimulation: (role: UserRole) => void;
  /** 사용자 시뮬레이션 시작 (마스터만 가능) */
  startUserSimulation: (userProfile: UserProfile) => void;
  /** 시뮬레이션 종료 */
  stopSimulation: () => void;
  /** 시뮬레이션 가능한 역할 목록 (master 제외) */
  availableRoles: UserRole[];
  /** 현재 시뮬레이션 역할의 한글 라벨 */
  simulatedRoleLabel: string | null;
  /** 현재 시뮬레이션 중인 사용자 정보 (표시용) */
  simulatedUserInfo: SimulatedUserInfo | null;
  /** 구버전 호환용 - startRoleSimulation의 별칭 */
  startSimulation: (role: UserRole) => void;
}

const RoleSimulationContext = createContext<RoleSimulationContextValue | null>(null);

/** 시뮬레이션 상태 (App 레벨에서 관리) */
export interface SimulationState {
  simulationType: SimulationType;
  simulatedRole: UserRole | null;
  simulatedUserProfile: UserProfile | null;
}

interface RoleSimulationProviderProps {
  children: ReactNode;
  /** 실제 사용자 역할 - master만 시뮬레이션 가능 */
  actualRole: UserRole | null;
  /** 외부에서 관리하는 시뮬레이션 상태 (선택적) */
  externalState?: SimulationState;
  /** 외부 상태 변경 함수 (선택적) */
  onStateChange?: (state: SimulationState) => void;
}

/**
 * 역할/사용자 시뮬레이션 Provider
 * 마스터 사용자가 다른 역할 또는 특정 사용자의 권한으로 화면을 테스트할 수 있게 함
 *
 * 두 가지 모드 지원:
 * 1. 내부 상태 관리: externalState 없이 사용 (기본)
 * 2. 외부 상태 관리: externalState + onStateChange로 App 레벨에서 상태 관리
 */
export function RoleSimulationProvider({
  children,
  actualRole,
  externalState,
  onStateChange,
}: RoleSimulationProviderProps) {
  // 내부 상태 (externalState가 없을 때 사용)
  const [internalType, setInternalType] = useState<SimulationType>(null);
  const [internalRole, setInternalRole] = useState<UserRole | null>(null);
  const [internalProfile, setInternalProfile] = useState<UserProfile | null>(null);

  // 실제 사용할 상태 (외부 또는 내부)
  const simulationType = externalState?.simulationType ?? internalType;
  const simulatedRole = externalState?.simulatedRole ?? internalRole;
  const simulatedUserProfile = externalState?.simulatedUserProfile ?? internalProfile;

  // 마스터만 시뮬레이션 가능
  const canSimulate = actualRole === 'master';

  // 시뮬레이션 가능한 역할 목록 (master 제외)
  const availableRoles = useMemo(() => {
    return ROLE_HIERARCHY.filter(role => role !== 'master');
  }, []);

  // 상태 변경 헬퍼
  const updateState = useCallback((newState: SimulationState) => {
    if (onStateChange) {
      onStateChange(newState);
    } else {
      setInternalType(newState.simulationType);
      setInternalRole(newState.simulatedRole);
      setInternalProfile(newState.simulatedUserProfile);
    }
  }, [onStateChange]);

  // 역할 시뮬레이션 시작
  const startRoleSimulation = useCallback((role: UserRole) => {
    if (!canSimulate) {
      console.warn('[RoleSimulation] Only master can start simulation');
      return;
    }
    if (role === 'master') {
      console.warn('[RoleSimulation] Cannot simulate master role');
      return;
    }
    updateState({
      simulationType: 'role',
      simulatedRole: role,
      simulatedUserProfile: null,
    });
  }, [canSimulate, updateState]);

  // 사용자 시뮬레이션 시작
  const startUserSimulation = useCallback((userProfile: UserProfile) => {
    if (!canSimulate) {
      console.warn('[RoleSimulation] Only master can start simulation');
      return;
    }
    if (userProfile.role === 'master') {
      console.warn('[RoleSimulation] Cannot simulate master user');
      return;
    }
    updateState({
      simulationType: 'user',
      simulatedRole: userProfile.role,
      simulatedUserProfile: userProfile,
    });
  }, [canSimulate, updateState]);

  // 시뮬레이션 종료
  const stopSimulation = useCallback(() => {
    updateState({
      simulationType: null,
      simulatedRole: null,
      simulatedUserProfile: null,
    });
  }, [simulationType, simulatedRole, simulatedUserProfile, updateState]);

  // 시뮬레이션 중인 사용자 정보 (표시용)
  const simulatedUserInfo = useMemo<SimulatedUserInfo | null>(() => {
    if (simulationType !== 'user' || !simulatedUserProfile) return null;
    return {
      uid: simulatedUserProfile.uid,
      displayName: simulatedUserProfile.displayName || simulatedUserProfile.email.split('@')[0],
      email: simulatedUserProfile.email,
      role: simulatedUserProfile.role,
      jobTitle: simulatedUserProfile.jobTitle,
    };
  }, [simulationType, simulatedUserProfile]);

  const isSimulating = canSimulate && simulationType !== null;
  const effectiveSimulatedRole = canSimulate ? simulatedRole : null;

  const value = useMemo<RoleSimulationContextValue>(() => ({
    simulatedRole: effectiveSimulatedRole,
    simulatedUserProfile: canSimulate ? simulatedUserProfile : null,
    simulationType: canSimulate ? simulationType : null,
    isSimulating,
    startRoleSimulation,
    startUserSimulation,
    stopSimulation,
    availableRoles,
    simulatedRoleLabel: effectiveSimulatedRole ? ROLE_LABELS[effectiveSimulatedRole] : null,
    simulatedUserInfo,
    // 구버전 호환용
    startSimulation: startRoleSimulation,
  }), [
    canSimulate, effectiveSimulatedRole, simulatedUserProfile, simulationType,
    isSimulating, startRoleSimulation, startUserSimulation, stopSimulation,
    availableRoles, simulatedUserInfo,
  ]);

  return (
    <RoleSimulationContext.Provider value={value}>
      {children}
    </RoleSimulationContext.Provider>
  );
}

/**
 * 역할/사용자 시뮬레이션 훅
 * 컴포넌트에서 시뮬레이션 상태 접근용
 */
export function useRoleSimulation(): RoleSimulationContextValue {
  const context = useContext(RoleSimulationContext);
  if (!context) {
    // Provider 없이 사용 시 기본값 반환 (시뮬레이션 불가)
    return {
      simulatedRole: null,
      simulatedUserProfile: null,
      simulationType: null,
      isSimulating: false,
      startRoleSimulation: () => {},
      startUserSimulation: () => {},
      stopSimulation: () => {},
      availableRoles: [],
      simulatedRoleLabel: null,
      simulatedUserInfo: null,
      startSimulation: () => {},
    };
  }
  return context;
}

/**
 * 실효 역할 계산 헬퍼
 * 시뮬레이션 중이면 시뮬레이션 역할, 아니면 실제 역할 반환
 */
export function getEffectiveRole(
  actualRole: UserRole | null | undefined,
  simulatedRole: UserRole | null
): UserRole | null {
  // 시뮬레이션 중이고 실제 마스터인 경우에만 시뮬레이션 역할 사용
  if (actualRole === 'master' && simulatedRole) {
    return simulatedRole;
  }
  return actualRole || null;
}

/**
 * 실효 사용자 프로필 계산 헬퍼
 * 사용자 시뮬레이션 중이면 시뮬레이션 프로필 반환
 * 역할 시뮬레이션 중이면 역할만 변경된 프로필 반환
 */
export function getEffectiveUserProfile(
  actualProfile: UserProfile | null,
  simulatedRole: UserRole | null,
  simulatedUserProfile: UserProfile | null,
  simulationType: SimulationType
): UserProfile | null {
  if (!actualProfile) return null;

  // 실제 마스터가 아니면 시뮬레이션 불가
  if (actualProfile.role !== 'master') {
    return actualProfile;
  }

  // 사용자 시뮬레이션: 해당 사용자의 전체 프로필 사용
  if (simulationType === 'user' && simulatedUserProfile) {
    return simulatedUserProfile;
  }

  // 역할 시뮬레이션: 역할만 변경
  if (simulationType === 'role' && simulatedRole) {
    return {
      ...actualProfile,
      role: simulatedRole,
      // 역할 시뮬레이션 시 부서 권한은 초기화 (해당 역할의 기본 상태)
      departmentPermissions: {},
      favoriteDepartments: [],
    };
  }

  // 시뮬레이션 없음
  return actualProfile;
}

/**
 * 실효 사용자 프로필 훅
 * App.tsx에서 사용하여 시뮬레이션된 사용자 프로필을 얻음
 * 이 프로필을 UI 렌더링에 사용하면 시뮬레이션이 완전히 적용됨
 */
export function useEffectiveUserProfile(actualProfile: UserProfile | null): {
  /** 실효 사용자 프로필 (시뮬레이션 적용) */
  effectiveProfile: UserProfile | null;
  /** 실제 사용자 프로필 (시뮬레이션 무관) */
  actualProfile: UserProfile | null;
  /** 시뮬레이션 중 여부 */
  isSimulating: boolean;
  /** 시뮬레이션 타입 */
  simulationType: SimulationType;
} {
  const { simulatedRole, simulatedUserProfile, simulationType, isSimulating } = useRoleSimulation();

  const effectiveProfile = getEffectiveUserProfile(
    actualProfile,
    simulatedRole,
    simulatedUserProfile,
    simulationType
  );

  return {
    effectiveProfile,
    actualProfile,
    isSimulating,
    simulationType,
  };
}
