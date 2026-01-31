import {
  isTeacherMatch,
  isTeacherMatchWithStaffId,
  isTeacherInSlotTeachers,
  isSlotTeacherMatch,
  isMathAssistantTeacher,
  isEnglishAssistantTeacher,
  isAssistantTeacher,
} from '../../utils/teacherUtils';
import type { StaffMember } from '../../utils/teacherUtils';

const mockStaff: StaffMember[] = [
  { id: 's1', name: '김선생', englishName: 'Kim' },
  { id: 's2', name: '이선생', englishName: 'Lee' },
  { id: 's3', name: '박선생' },
];

describe('teacherUtils', () => {
  describe('isTeacherMatch', () => {
    it('should match by direct name', () => {
      expect(isTeacherMatch('Kim', 'Kim')).toBe(true);
    });

    it('should match by Korean name', () => {
      expect(isTeacherMatch('김선생', 'Kim', '김선생')).toBe(true);
    });

    it('should return false for no match without staff', () => {
      expect(isTeacherMatch('박선생', 'Kim', '김선생')).toBe(false);
    });

    it('should return false for empty teacher name', () => {
      expect(isTeacherMatch('', 'Kim')).toBe(false);
    });

    it('should match via staff cross-reference', () => {
      // teacherNameInClass='김선생' found in staff → staff.englishName='Kim' matches myName='Kim'
      expect(isTeacherMatch('김선생', 'Kim', undefined, mockStaff)).toBe(true);
    });

    it('should return false when staff lookup finds no match', () => {
      expect(isTeacherMatch('Unknown', 'Kim', undefined, mockStaff)).toBe(false);
    });

    it('should match via staff englishName → myKoreanName', () => {
      // teacherNameInClass='Kim' found in staff → staff.name='김선생' matches myKoreanName='김선생'
      expect(isTeacherMatch('Kim', 'SomeOther', '김선생', mockStaff)).toBe(true);
    });
  });

  describe('isTeacherMatchWithStaffId', () => {
    it('should match by staffId', () => {
      expect(isTeacherMatchWithStaffId({ staffId: 's1' }, 's1')).toBe(true);
    });

    it('should not match different staffIds', () => {
      expect(isTeacherMatchWithStaffId({ staffId: 's1' }, 's2')).toBe(false);
    });

    it('should return false for missing staffId', () => {
      expect(isTeacherMatchWithStaffId({}, 's1')).toBe(false);
      expect(isTeacherMatchWithStaffId({ staffId: 's1' }, undefined)).toBe(false);
    });
  });

  describe('isTeacherInSlotTeachers', () => {
    const slotTeachers = { '월-1': 'Kim', '화-1': '이선생' };

    it('should find teacher in slot teachers', () => {
      expect(isTeacherInSlotTeachers(slotTeachers, 'Kim')).toBe(true);
    });

    it('should find teacher by Korean name', () => {
      expect(isTeacherInSlotTeachers(slotTeachers, 'Lee', '이선생')).toBe(true);
    });

    it('should return false when not in slot teachers', () => {
      expect(isTeacherInSlotTeachers(slotTeachers, 'Park')).toBe(false);
    });

    it('should return false for undefined slot teachers', () => {
      expect(isTeacherInSlotTeachers(undefined, 'Kim')).toBe(false);
    });
  });

  describe('isSlotTeacherMatch', () => {
    const slotTeachers = { '월-1': 'Kim', '화-1': '이선생' };

    it('should match specific slot', () => {
      expect(isSlotTeacherMatch(slotTeachers, '월-1', 'Kim')).toBe(true);
    });

    it('should not match wrong slot', () => {
      expect(isSlotTeacherMatch(slotTeachers, '수-1', 'Kim')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isSlotTeacherMatch(undefined, '월-1', 'Kim')).toBe(false);
    });
  });

  describe('isMathAssistantTeacher', () => {
    it('should return true when isSlotTeacher is true', () => {
      expect(isMathAssistantTeacher({ isSlotTeacher: true })).toBe(true);
    });

    it('should return false when isSlotTeacher is false', () => {
      expect(isMathAssistantTeacher({ isSlotTeacher: false })).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isMathAssistantTeacher(undefined)).toBe(false);
      expect(isMathAssistantTeacher({})).toBe(false);
    });
  });

  describe('isEnglishAssistantTeacher', () => {
    it('should return false when no slotTeachers (is main teacher)', () => {
      expect(isEnglishAssistantTeacher({ teacher: 'Kim' }, 'Kim')).toBe(false);
    });

    it('should return false when teacher matches (is main teacher)', () => {
      const classData = { teacher: 'Kim', slotTeachers: { '월-1': '이선생' } };
      expect(isEnglishAssistantTeacher(classData, 'Kim')).toBe(false);
    });

    it('should return true when teacher does not match (is assistant)', () => {
      const classData = { teacher: 'Kim', slotTeachers: { '월-1': '이선생' } };
      expect(isEnglishAssistantTeacher(classData, '이선생', '이선생')).toBe(true);
    });

    it('should return false for empty slotTeachers', () => {
      expect(isEnglishAssistantTeacher({ teacher: 'Kim', slotTeachers: {} }, 'Kim')).toBe(false);
    });
  });

  describe('isAssistantTeacher', () => {
    it('should use enrollment isSlotTeacher when available (math)', () => {
      const classData = { teacher: 'Kim' };
      expect(isAssistantTeacher(classData, { isSlotTeacher: true }, 'Kim')).toBe(true);
      expect(isAssistantTeacher(classData, { isSlotTeacher: false }, 'Kim')).toBe(false);
    });

    it('should fall back to English assistant logic when no enrollment data', () => {
      const classData = { teacher: 'Kim', slotTeachers: { '월-1': '이선생' } };
      expect(isAssistantTeacher(classData, undefined, 'Kim')).toBe(false); // main teacher
      expect(isAssistantTeacher(classData, undefined, '이선생', '이선생')).toBe(true); // assistant
    });

    it('should fall back to English logic when enrollment has no isSlotTeacher', () => {
      const classData = { teacher: 'Kim', slotTeachers: { '월-1': '이선생' } };
      expect(isAssistantTeacher(classData, {}, 'Kim')).toBe(false);
    });
  });
});
