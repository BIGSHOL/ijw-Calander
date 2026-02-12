import { groupExamsByType, groupExamsByMonth } from '../../hooks/useExams';
import { Exam, ExamType } from '../../types';

const createExam = (overrides: Partial<Exam> = {}): Exam => ({
  id: 'exam1',
  name: '테스트 시험',
  date: '2026-01-15',
  subject: 'math',
  type: 'monthly' as ExamType,
  createdAt: Date.now(),
  createdBy: 'user1',
  ...overrides,
} as Exam);

describe('useExams 헬퍼', () => {
  describe('groupExamsByType', () => {
    it('시험을 유형별로 그룹화', () => {
      const exams = [
        createExam({ id: 'e1', type: 'daily' }),
        createExam({ id: 'e2', type: 'monthly' }),
        createExam({ id: 'e3', type: 'daily' }),
        createExam({ id: 'e4', type: 'mock' }),
      ];

      const grouped = groupExamsByType(exams);
      expect(grouped.daily).toHaveLength(2);
      expect(grouped.monthly).toHaveLength(1);
      expect(grouped.mock).toHaveLength(1);
      expect(grouped.weekly).toHaveLength(0);
    });

    it('빈 배열은 빈 그룹 반환', () => {
      const grouped = groupExamsByType([]);
      expect(grouped.daily).toHaveLength(0);
      expect(grouped.monthly).toHaveLength(0);
    });
  });

  describe('groupExamsByMonth', () => {
    it('시험을 월별로 그룹화', () => {
      const exams = [
        createExam({ id: 'e1', date: '2026-01-15' }),
        createExam({ id: 'e2', date: '2026-01-20' }),
        createExam({ id: 'e3', date: '2026-02-10' }),
      ];

      const grouped = groupExamsByMonth(exams);
      expect(grouped['2026-01']).toHaveLength(2);
      expect(grouped['2026-02']).toHaveLength(1);
    });

    it('빈 배열은 빈 객체 반환', () => {
      expect(groupExamsByMonth([])).toEqual({});
    });
  });
});
