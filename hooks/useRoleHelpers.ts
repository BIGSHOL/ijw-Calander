import { useMemo } from 'react';
import { UserProfile } from '../types';

/**
 * Role helper hook for centralized role checking
 * Reduces code duplication and provides consistent role logic
 */
export function useRoleHelpers(userProfile: UserProfile | null) {
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
      };
    }

    const role = userProfile.role;
    const department = userProfile.department || null;

    return {
      // Individual role checks
      isMaster: role === 'master',
      isAdmin: role === 'admin',
      isManager: role === 'manager',
      isMathLead: role === 'math_lead',
      isEnglishLead: role === 'english_lead',
      isMathTeacher: role === 'math_teacher',
      isEnglishTeacher: role === 'english_teacher',
      isUser: role === 'user',

      // Hierarchical role checks (includes higher roles)
      isLeadOrAbove: ['master', 'admin', 'manager', 'math_lead', 'english_lead'].includes(role),
      isManagerOrAbove: ['master', 'admin', 'manager'].includes(role),
      isAdminOrAbove: ['master', 'admin'].includes(role),

      // Department checks
      hasDepartment: !!department,
      department,
    };
  }, [userProfile]);
}
