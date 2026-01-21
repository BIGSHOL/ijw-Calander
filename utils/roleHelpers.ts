/**
 * 역할 관련 유틸리티 함수
 *
 * StaffMember의 이중 역할 구조(role + systemRole)를 처리하는 헬퍼 함수들
 */

import { StaffMember, UserRole } from '../types';

/**
 * 강사 역할인지 확인 (systemRole 기반)
 */
export const isTeacherRole = (systemRole?: UserRole): boolean => {
  if (!systemRole) return false;
  return ['math_teacher', 'english_teacher', 'math_lead', 'english_lead'].includes(systemRole);
};

/**
 * 수학 강사인지 확인 (systemRole 또는 subjects 기반)
 */
export const isMathTeacher = (member: StaffMember): boolean => {
  // systemRole이 math_teacher 또는 math_lead
  if (member.systemRole === 'math_teacher' || member.systemRole === 'math_lead') {
    return true;
  }

  // 또는 role='teacher'이고 subjects에 'math' 포함
  if (member.role === 'teacher' && member.subjects?.includes('math')) {
    return true;
  }

  return false;
};

/**
 * 영어 강사인지 확인 (systemRole 또는 subjects 기반)
 */
export const isEnglishTeacher = (member: StaffMember): boolean => {
  // systemRole이 english_teacher 또는 english_lead
  if (member.systemRole === 'english_teacher' || member.systemRole === 'english_lead') {
    return true;
  }

  // 또는 role='teacher'이고 subjects에 'english' 포함
  if (member.role === 'teacher' && member.subjects?.includes('english')) {
    return true;
  }

  return false;
};

/**
 * 특정 과목의 강사인지 확인
 */
export const isSubjectTeacher = (member: StaffMember, subject: 'math' | 'english'): boolean => {
  if (subject === 'math') {
    return isMathTeacher(member);
  } else {
    return isEnglishTeacher(member);
  }
};

/**
 * 어떤 과목이든 강사인지 확인
 */
export const isAnyTeacher = (member: StaffMember): boolean => {
  // systemRole이 강사 관련 역할
  if (isTeacherRole(member.systemRole)) {
    return true;
  }

  // 또는 role='teacher'
  if (member.role === 'teacher') {
    return true;
  }

  return false;
};

/**
 * 강사 목록 필터링 (특정 과목)
 */
export const filterTeachersBySubject = (
  staff: StaffMember[],
  subject: 'math' | 'english'
): StaffMember[] => {
  return staff.filter(member => isSubjectTeacher(member, subject));
};

/**
 * 강사 목록 필터링 (모든 강사)
 */
export const filterAllTeachers = (staff: StaffMember[]): StaffMember[] => {
  return staff.filter(member => isAnyTeacher(member));
};

/**
 * 역할 표시 이름 가져오기
 * systemRole을 우선 사용하고, 없으면 role 사용
 */
export const getRoleDisplayName = (member: StaffMember): string => {
  if (member.systemRole) {
    const roleMap: Record<UserRole, string> = {
      master: '마스터',
      admin: '관리자',
      manager: '매니저',
      math_lead: '수학팀장',
      english_lead: '영어팀장',
      math_teacher: '수학선생님',
      english_teacher: '영어선생님',
      user: '일반사용자',
    };
    return roleMap[member.systemRole] || member.systemRole;
  }

  if (member.role === 'teacher') return '선생님';
  if (member.role === 'admin') return '관리자';
  return '직원';
};
