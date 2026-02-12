import { matchBillingToStudent, batchMatchBillingToStudents } from '../../utils/studentMatching';
import { BillingRecord } from '../../types/billing';
import { UnifiedStudent } from '../../types';

const createStudent = (overrides: Partial<UnifiedStudent> = {}): UnifiedStudent => ({
  id: 'st1',
  name: '김철수',
  status: 'active',
  ...overrides,
} as UnifiedStudent);

const createBillingRecord = (overrides: Partial<BillingRecord> = {}): BillingRecord => ({
  id: 'br1',
  studentName: '김철수',
  amount: 100000,
  ...overrides,
} as BillingRecord);

describe('studentMatching', () => {
  describe('matchBillingToStudent', () => {
    it('externalStudentId로 매칭 (우선순위 1)', () => {
      const students = [createStudent({ id: 'st1', attendanceNumber: '1234' })];
      const record = createBillingRecord({ externalStudentId: '1234' });

      const result = matchBillingToStudent(record, students);
      expect(result).not.toBeNull();
      expect(result!.matchType).toBe('externalId');
      expect(result!.studentId).toBe('st1');
    });

    it('이름 + 학교로 매칭 (우선순위 2)', () => {
      const students = [
        createStudent({ id: 'st1', name: '김철수', school: '서울초등학교' }),
      ];
      const record = createBillingRecord({ studentName: '김철수', school: '서울초' });

      const result = matchBillingToStudent(record, students);
      expect(result).not.toBeNull();
      expect(result!.matchType).toBe('nameAndSchool');
    });

    it('이름만으로 매칭 (우선순위 3, 동명이인 없을 때)', () => {
      const students = [createStudent({ id: 'st1', name: '박영희' })];
      const record = createBillingRecord({ studentName: '박영희' });

      const result = matchBillingToStudent(record, students);
      expect(result).not.toBeNull();
      expect(result!.matchType).toBe('nameOnly');
    });

    it('동명이인이 있으면 이름만으로 매칭 안됨', () => {
      const students = [
        createStudent({ id: 'st1', name: '김철수' }),
        createStudent({ id: 'st2', name: '김철수' }),
      ];
      const record = createBillingRecord({ studentName: '김철수' });

      const result = matchBillingToStudent(record, students);
      expect(result).toBeNull();
    });

    it('매칭 학생 없으면 null 반환', () => {
      const students = [createStudent({ name: '이영희' })];
      const record = createBillingRecord({ studentName: '박지민' });

      const result = matchBillingToStudent(record, students);
      expect(result).toBeNull();
    });

    it('externalStudentId가 우선순위로 매칭', () => {
      const students = [
        createStudent({ id: 'st1', name: '김철수', attendanceNumber: '9999' }),
        createStudent({ id: 'st2', name: '김철수' }),
      ];
      const record = createBillingRecord({
        studentName: '김철수',
        externalStudentId: '9999',
      });

      const result = matchBillingToStudent(record, students);
      expect(result!.matchType).toBe('externalId');
      expect(result!.studentId).toBe('st1');
    });

    it('이름+학교 매칭에서 동명이인 있으면 null', () => {
      const students = [
        createStudent({ id: 'st1', name: '김철수', school: '서울초등학교' }),
        createStudent({ id: 'st2', name: '김철수', school: '서울초등학교' }),
      ];
      const record = createBillingRecord({ studentName: '김철수', school: '서울초' });

      const result = matchBillingToStudent(record, students);
      expect(result).toBeNull();
    });
  });

  describe('batchMatchBillingToStudents', () => {
    it('여러 레코드를 한번에 매칭', () => {
      const students = [
        createStudent({ id: 'st1', name: '김철수' }),
        createStudent({ id: 'st2', name: '이영희' }),
      ];
      const records = [
        createBillingRecord({ id: 'br1', studentName: '김철수' }),
        createBillingRecord({ id: 'br2', studentName: '이영희' }),
        createBillingRecord({ id: 'br3', studentName: '없는학생' }),
      ];

      const results = batchMatchBillingToStudents(records, students);
      expect(results.size).toBe(2);
      expect(results.get('br1')!.studentId).toBe('st1');
      expect(results.get('br2')!.studentId).toBe('st2');
      expect(results.has('br3')).toBe(false);
    });

    it('빈 레코드 배열은 빈 Map 반환', () => {
      const results = batchMatchBillingToStudents([], [createStudent()]);
      expect(results.size).toBe(0);
    });
  });
});
