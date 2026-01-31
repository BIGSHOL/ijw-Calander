import {
  isTeacherRole,
  isMathTeacher,
  isEnglishTeacher,
  isSubjectTeacher,
  isAnyTeacher,
  filterTeachersBySubject,
  filterAllTeachers,
  getRoleDisplayName,
} from '../../utils/roleHelpers';
import { StaffMember } from '../../types';

const createStaff = (overrides: Partial<StaffMember>): StaffMember => ({
  id: 'staff1',
  name: '테스트',
  role: 'staff',
  hireDate: '2025-01-01',
  status: 'active',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  ...overrides,
});

describe('roleHelpers', () => {
  describe('isTeacherRole', () => {
    it('should return true for teacher systemRoles', () => {
      expect(isTeacherRole('math_teacher')).toBe(true);
      expect(isTeacherRole('english_teacher')).toBe(true);
      expect(isTeacherRole('math_lead')).toBe(true);
      expect(isTeacherRole('english_lead')).toBe(true);
    });

    it('should return false for non-teacher systemRoles', () => {
      expect(isTeacherRole('master')).toBe(false);
      expect(isTeacherRole('admin')).toBe(false);
      expect(isTeacherRole('user')).toBe(false);
      expect(isTeacherRole('manager')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isTeacherRole(undefined)).toBe(false);
    });
  });

  describe('isMathTeacher', () => {
    it('should return true for math systemRoles', () => {
      expect(isMathTeacher(createStaff({ systemRole: 'math_teacher' }))).toBe(true);
      expect(isMathTeacher(createStaff({ systemRole: 'math_lead' }))).toBe(true);
    });

    it('should return true for teacher role with math subject', () => {
      expect(isMathTeacher(createStaff({ role: 'teacher', subjects: ['math'] }))).toBe(true);
      expect(isMathTeacher(createStaff({ role: 'teacher', subjects: ['math', 'english'] }))).toBe(true);
    });

    it('should return false for english teachers', () => {
      expect(isMathTeacher(createStaff({ systemRole: 'english_teacher' }))).toBe(false);
      expect(isMathTeacher(createStaff({ role: 'teacher', subjects: ['english'] }))).toBe(false);
    });

    it('should return false for non-teachers', () => {
      expect(isMathTeacher(createStaff({ systemRole: 'admin' }))).toBe(false);
      expect(isMathTeacher(createStaff({ role: 'admin' }))).toBe(false);
    });
  });

  describe('isEnglishTeacher', () => {
    it('should return true for english systemRoles', () => {
      expect(isEnglishTeacher(createStaff({ systemRole: 'english_teacher' }))).toBe(true);
      expect(isEnglishTeacher(createStaff({ systemRole: 'english_lead' }))).toBe(true);
    });

    it('should return true for teacher role with english subject', () => {
      expect(isEnglishTeacher(createStaff({ role: 'teacher', subjects: ['english'] }))).toBe(true);
    });

    it('should return false for math teachers', () => {
      expect(isEnglishTeacher(createStaff({ systemRole: 'math_teacher' }))).toBe(false);
    });
  });

  describe('isSubjectTeacher', () => {
    it('should delegate to isMathTeacher for math', () => {
      const mathTeacher = createStaff({ systemRole: 'math_teacher' });
      expect(isSubjectTeacher(mathTeacher, 'math')).toBe(true);
      expect(isSubjectTeacher(mathTeacher, 'english')).toBe(false);
    });

    it('should delegate to isEnglishTeacher for english', () => {
      const englishTeacher = createStaff({ systemRole: 'english_teacher' });
      expect(isSubjectTeacher(englishTeacher, 'english')).toBe(true);
      expect(isSubjectTeacher(englishTeacher, 'math')).toBe(false);
    });
  });

  describe('isAnyTeacher', () => {
    it('should return true for any teacher systemRole', () => {
      expect(isAnyTeacher(createStaff({ systemRole: 'math_teacher' }))).toBe(true);
      expect(isAnyTeacher(createStaff({ systemRole: 'english_lead' }))).toBe(true);
    });

    it('should return true for teacher role', () => {
      expect(isAnyTeacher(createStaff({ role: 'teacher' }))).toBe(true);
    });

    it('should return false for non-teachers', () => {
      expect(isAnyTeacher(createStaff({ role: 'admin', systemRole: 'admin' }))).toBe(false);
      expect(isAnyTeacher(createStaff({ role: 'staff', systemRole: 'user' }))).toBe(false);
    });
  });

  describe('filterTeachersBySubject', () => {
    const staff = [
      createStaff({ id: '1', systemRole: 'math_teacher' }),
      createStaff({ id: '2', systemRole: 'english_teacher' }),
      createStaff({ id: '3', systemRole: 'admin' }),
      createStaff({ id: '4', role: 'teacher', subjects: ['math'] }),
    ];

    it('should filter math teachers', () => {
      const result = filterTeachersBySubject(staff, 'math');
      expect(result.length).toBe(2);
      expect(result.map(s => s.id)).toEqual(['1', '4']);
    });

    it('should filter english teachers', () => {
      const result = filterTeachersBySubject(staff, 'english');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    it('should return empty for no matches', () => {
      const result = filterTeachersBySubject([createStaff({ systemRole: 'admin' })], 'math');
      expect(result).toEqual([]);
    });
  });

  describe('filterAllTeachers', () => {
    it('should return only teachers', () => {
      const staff = [
        createStaff({ id: '1', systemRole: 'math_teacher' }),
        createStaff({ id: '2', systemRole: 'admin' }),
        createStaff({ id: '3', role: 'teacher' }),
      ];
      const result = filterAllTeachers(staff);
      expect(result.length).toBe(2);
      expect(result.map(s => s.id)).toEqual(['1', '3']);
    });
  });

  describe('getRoleDisplayName', () => {
    it('should return mapped systemRole names', () => {
      expect(getRoleDisplayName(createStaff({ systemRole: 'master' }))).toBe('마스터');
      expect(getRoleDisplayName(createStaff({ systemRole: 'admin' }))).toBe('관리자');
      expect(getRoleDisplayName(createStaff({ systemRole: 'math_teacher' }))).toBe('수학선생님');
      expect(getRoleDisplayName(createStaff({ systemRole: 'english_lead' }))).toBe('영어팀장');
      expect(getRoleDisplayName(createStaff({ systemRole: 'user' }))).toBe('일반사용자');
    });

    it('should fallback to role-based names when no systemRole', () => {
      expect(getRoleDisplayName(createStaff({ role: 'teacher' }))).toBe('선생님');
      expect(getRoleDisplayName(createStaff({ role: 'admin' }))).toBe('관리자');
      expect(getRoleDisplayName(createStaff({ role: 'staff' }))).toBe('직원');
    });
  });
});
