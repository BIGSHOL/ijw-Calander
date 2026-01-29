import { useMemo } from 'react';
import { UserProfile } from '../types';
import { useRoleSimulation, getEffectiveRole } from './useRoleSimulation';

/**
 * Role helper hook for centralized role checking
 * Reduces code duplication and provides consistent role logic
 *
 * Supports Role Simulation: Returns role checks based on simulated role when active
 */
export function useRoleHelpers(userProfile: UserProfile | null) {
  const { simulatedRole, isSimulating } = useRoleSimulation();

  return useMemo(() => {
    if (!userProfile) {
      return {
        isMaster: false,
        isAdmin: false,
        isManager: false,
        isMathLead: false,
        isEnglishLead: false,
        isMathTeacher: false,
        isEnglishTeacher: false,
        isUser: false,
        isLeadOrAbove: false,
        isManagerOrAbove: false,
        isAdminOrAbove: false,
        hasDepartment: false,
        department: null,
        // 시뮬레이션 관련
        actualRole: null,
        isSimulating: false,
      };
    }

    // 실효 역할 (시뮬레이션 중이면 시뮬레이션 역할)
    const effectiveRole = getEffectiveRole(userProfile.role, simulatedRole);
    const role = effectiveRole || userProfile.role;
    const department = userProfile.department || null;

    return {
      // Individual role checks (시뮬레이션 역할 기준)
      isMaster: role === 'master',
      isAdmin: role === 'admin',
      isManager: role === 'manager',
      isMathLead: role === 'math_lead',
      isEnglishLead: role === 'english_lead',
      isMathTeacher: role === 'math_teacher',
      isEnglishTeacher: role === 'english_teacher',
      isUser: role === 'user',

      // Hierarchical role checks (includes higher roles) - 시뮬레이션 역할 기준
      isLeadOrAbove: ['master', 'admin', 'manager', 'math_lead', 'english_lead'].includes(role),
      isManagerOrAbove: ['master', 'admin', 'manager'].includes(role),
      isAdminOrAbove: ['master', 'admin'].includes(role),

      // Department checks
      hasDepartment: !!department,
      department,

      // 시뮬레이션 관련 (실제 역할 확인용)
      actualRole: userProfile.role,
      isSimulating,
      /** 실제 마스터인지 (시뮬레이션 여부와 관계없이) */
      isActualMaster: userProfile.role === 'master',
    };
  }, [userProfile, simulatedRole, isSimulating]);
}
