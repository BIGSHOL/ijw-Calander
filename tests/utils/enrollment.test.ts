import { getEndedSubjects } from '../../utils/enrollment';
import { UnifiedStudent, Enrollment } from '../../types';

function createEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 'enr-1',
    subject: 'math',
    className: '수학A',
    enrollmentDate: '2025-01-01',
    ...overrides,
  } as Enrollment;
}

function createStudent(enrollments: Enrollment[] = []): UnifiedStudent {
  return {
    id: 'student-1',
    name: '김학생',
    status: 'active',
    enrollments,
  } as UnifiedStudent;
}

describe('enrollment', () => {
  describe('getEndedSubjects', () => {
    it('returns empty when student has no enrollments', () => {
      const student = createStudent([]);
      const result = getEndedSubjects(student);
      expect(result.subjects).toEqual([]);
      expect(result.enrollments).toEqual([]);
    });

    it('returns empty when student has active enrollment', () => {
      const student = createStudent([
        createEnrollment({ subject: 'math', withdrawalDate: undefined, endDate: undefined }),
      ]);
      const result = getEndedSubjects(student);
      expect(result.subjects).toEqual([]);
    });

    it('detects ended subject when all enrollments have withdrawalDate', () => {
      const student = createStudent([
        createEnrollment({ subject: 'math', withdrawalDate: '2026-01-15' }),
      ]);
      const result = getEndedSubjects(student);
      expect(result.subjects).toEqual(['math']);
      expect(result.enrollments).toHaveLength(1);
    });

    it('detects ended subject when all enrollments have endDate', () => {
      const student = createStudent([
        createEnrollment({ subject: 'english', endDate: '2026-02-01' }),
      ]);
      const result = getEndedSubjects(student);
      expect(result.subjects).toEqual(['english']);
    });

    it('does not mark subject as ended if any enrollment is active', () => {
      const student = createStudent([
        createEnrollment({ id: 'e1', subject: 'math', withdrawalDate: '2026-01-15' }),
        createEnrollment({ id: 'e2', subject: 'math', withdrawalDate: undefined }),
      ]);
      const result = getEndedSubjects(student);
      expect(result.subjects).toEqual([]);
    });

    it('handles multiple subjects independently', () => {
      const student = createStudent([
        createEnrollment({ subject: 'math', withdrawalDate: '2026-01-15' }),
        createEnrollment({ subject: 'english', withdrawalDate: undefined }),
      ]);
      const result = getEndedSubjects(student);
      expect(result.subjects).toEqual(['math']);
      expect(result.subjects).not.toContain('english');
    });

    it('returns all ended enrollments', () => {
      const student = createStudent([
        createEnrollment({ id: 'e1', subject: 'math', className: '수학A', withdrawalDate: '2026-01-10' }),
        createEnrollment({ id: 'e2', subject: 'math', className: '수학B', endDate: '2026-01-20' }),
      ]);
      const result = getEndedSubjects(student);
      expect(result.subjects).toEqual(['math']);
      expect(result.enrollments).toHaveLength(2);
    });

    it('handles undefined enrollments array', () => {
      const student = { id: 's1', name: '학생' } as UnifiedStudent;
      const result = getEndedSubjects(student);
      expect(result.subjects).toEqual([]);
      expect(result.enrollments).toEqual([]);
    });
  });
});
