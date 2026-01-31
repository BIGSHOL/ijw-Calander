import {
  generateAttendanceNumber,
  generateBulkAttendanceNumbers,
  findStudentByAttendanceNumber,
} from '../../utils/attendanceNumberGenerator';

describe('attendanceNumberGenerator', () => {
  describe('generateAttendanceNumber', () => {
    it('should use last 4 digits of phone number', () => {
      const result = generateAttendanceNumber('010-1234-5678', new Set());
      expect(result).toBe('5678');
    });

    it('should handle phone without dashes', () => {
      const result = generateAttendanceNumber('01012345678', new Set());
      expect(result).toBe('5678');
    });

    it('should handle collision with suffix', () => {
      const existing = new Set(['5678']);
      const result = generateAttendanceNumber('01012345678', existing);
      expect(result).toBe('56781');
    });

    it('should handle multiple collisions', () => {
      const existing = new Set(['5678', '56781', '56782']);
      const result = generateAttendanceNumber('01012345678', existing);
      expect(result).toBe('56783');
    });

    it('should generate random number when no phone', () => {
      const result = generateAttendanceNumber(undefined, new Set());
      expect(result).toMatch(/^\d{4}$/);
      expect(Number(result)).toBeGreaterThanOrEqual(1000);
      expect(Number(result)).toBeLessThan(10000);
    });

    it('should generate random number for short phone', () => {
      const result = generateAttendanceNumber('12', new Set());
      expect(result).toMatch(/^\d{4}$/);
    });

    it('should handle phone with non-digit characters', () => {
      const result = generateAttendanceNumber('010-9876-5432', new Set());
      expect(result).toBe('5432');
    });
  });

  describe('generateBulkAttendanceNumbers', () => {
    it('should preserve existing attendance numbers', () => {
      const students = [
        { id: 's1', parentPhone: '01011112222', attendanceNumber: '9999' },
        { id: 's2', parentPhone: '01033334444' },
      ];

      const result = generateBulkAttendanceNumbers(students);
      expect(result.get('s1')).toBe('9999');
      expect(result.get('s2')).toBe('4444');
    });

    it('should avoid collisions with existing numbers', () => {
      const students = [
        { id: 's1', attendanceNumber: '5678' },
        { id: 's2', parentPhone: '01012345678' },
      ];

      const result = generateBulkAttendanceNumbers(students);
      expect(result.get('s1')).toBe('5678');
      expect(result.get('s2')).toBe('56781'); // collision → suffix
    });

    it('should generate for all students without numbers', () => {
      const students = [
        { id: 's1', parentPhone: '01011111111' },
        { id: 's2', parentPhone: '01022222222' },
        { id: 's3', parentPhone: '01033333333' },
      ];

      const result = generateBulkAttendanceNumbers(students);
      expect(result.size).toBe(3);
      expect(result.get('s1')).toBe('1111');
      expect(result.get('s2')).toBe('2222');
      expect(result.get('s3')).toBe('3333');
    });
  });

  describe('findStudentByAttendanceNumber', () => {
    const students = [
      { id: 's1', attendanceNumber: '1234' },
      { id: 's2', attendanceNumber: '5678' },
      { id: 's3' },
    ];

    it('should find student by attendance number', () => {
      expect(findStudentByAttendanceNumber('1234', students)).toBe('s1');
      expect(findStudentByAttendanceNumber('5678', students)).toBe('s2');
    });

    it('should return null for non-existent number', () => {
      expect(findStudentByAttendanceNumber('9999', students)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(findStudentByAttendanceNumber('', students)).toBeNull();
    });
  });
});
