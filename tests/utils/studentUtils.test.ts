import {
  getGradeNumber,
  getGradeLevel,
  formatSchoolGrade,
  formatStudentSchoolGrade,
} from '../../utils/studentUtils';

describe('studentUtils', () => {
  describe('getGradeNumber', () => {
    it('should extract number from grade with prefix', () => {
      expect(getGradeNumber('초3')).toBe('3');
      expect(getGradeNumber('중1')).toBe('1');
      expect(getGradeNumber('고2')).toBe('2');
    });

    it('should return number as-is', () => {
      expect(getGradeNumber('3')).toBe('3');
      expect(getGradeNumber('12')).toBe('12');
    });

    it('should return empty string for null/undefined', () => {
      expect(getGradeNumber(null)).toBe('');
      expect(getGradeNumber(undefined)).toBe('');
    });

    it('should return original if no number found', () => {
      expect(getGradeNumber('abc')).toBe('abc');
    });
  });

  describe('getGradeLevel', () => {
    it('should detect elementary (초)', () => {
      expect(getGradeLevel('초3')).toBe('초');
      expect(getGradeLevel('초등3')).toBe('초');
    });

    it('should detect middle school (중)', () => {
      expect(getGradeLevel('중1')).toBe('중');
      expect(getGradeLevel('중학2')).toBe('중');
    });

    it('should detect high school (고)', () => {
      expect(getGradeLevel('고2')).toBe('고');
      expect(getGradeLevel('고등1')).toBe('고');
    });

    it('should return empty for no level', () => {
      expect(getGradeLevel('3')).toBe('');
      expect(getGradeLevel(null)).toBe('');
      expect(getGradeLevel(undefined)).toBe('');
    });
  });

  describe('formatSchoolGrade', () => {
    it('should handle school ending with level + grade with level', () => {
      expect(formatSchoolGrade('대명초', '초3')).toBe('대명초3');
      expect(formatSchoolGrade('경북중', '중2')).toBe('경북중2');
      expect(formatSchoolGrade('대구고', '고1')).toBe('대구고1');
    });

    it('should handle school ending with level + bare number', () => {
      expect(formatSchoolGrade('대명초', '3')).toBe('대명초3');
    });

    it('should add space when school does not end with level', () => {
      expect(formatSchoolGrade('대명', '초3')).toBe('대명 초3');
    });

    it('should handle school without level + bare number', () => {
      expect(formatSchoolGrade('대명초등학교', '3')).toBe('대명초등학교 3');
    });

    it('should handle no school', () => {
      expect(formatSchoolGrade('', '초3')).toBe('초3');
      expect(formatSchoolGrade(null, '초3')).toBe('초3');
    });

    it('should handle no grade', () => {
      expect(formatSchoolGrade('대명초', '')).toBe('대명초');
      expect(formatSchoolGrade('대명초', null)).toBe('대명초');
    });

    it('should return dash for both empty', () => {
      expect(formatSchoolGrade('', '')).toBe('-');
      expect(formatSchoolGrade(null, null)).toBe('-');
    });
  });

  describe('formatStudentSchoolGrade', () => {
    it('should format from student object', () => {
      expect(formatStudentSchoolGrade({ school: '대명초', grade: '초3' })).toBe('대명초3');
    });

    it('should handle missing fields', () => {
      expect(formatStudentSchoolGrade({})).toBe('-');
      expect(formatStudentSchoolGrade({ school: null, grade: null })).toBe('-');
    });
  });
});
