import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubjectClassStudents } from '../../hooks/useSubjectClassStudents';

// QueryClient wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createMockStudentMap(students: Record<string, any> = {}) {
  return students;
}

function createMockEnrollment(overrides: any = {}) {
  return {
    id: 'enr-1',
    subject: 'math',
    className: '수학A',
    enrollmentDate: '2025-01-01',
    attendanceDays: ['mon', 'wed'],
    ...overrides,
  };
}

describe('useSubjectClassStudents', () => {
  describe('empty inputs', () => {
    it('returns empty map when classNames is empty', () => {
      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: [],
          studentMap: { s1: { name: '학생', status: 'active', enrollments: [] } },
        }),
        { wrapper: createWrapper() }
      );
      expect(result.current.classDataMap).toEqual({});
      expect(result.current.isLoading).toBe(false);
    });

    it('returns empty map when studentMap is empty', () => {
      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: ['수학A'],
          studentMap: {},
        }),
        { wrapper: createWrapper() }
      );
      expect(result.current.classDataMap).toEqual({});
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('subject filtering', () => {
    it('only includes students enrolled in the specified subject', () => {
      const studentMap = createMockStudentMap({
        s1: {
          name: '수학학생', status: 'active',
          enrollments: [createMockEnrollment({ subject: 'math', className: '수학A' })],
        },
        s2: {
          name: '영어학생', status: 'active',
          enrollments: [createMockEnrollment({ subject: 'english', className: '수학A' })],
        },
      });

      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: ['수학A'],
          studentMap,
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.classDataMap['수학A'].studentList).toHaveLength(1);
      expect(result.current.classDataMap['수학A'].studentList[0].name).toBe('수학학생');
    });
  });

  describe('status filtering', () => {
    it('includes active, withdrawn, and on_hold students', () => {
      const makeStudent = (id: string, name: string, status: string) => ({
        name, status,
        enrollments: [createMockEnrollment({ id: `e-${id}`, subject: 'math', className: '수학A' })],
      });

      const studentMap = createMockStudentMap({
        s1: makeStudent('s1', '활성', 'active'),
        s2: makeStudent('s2', '퇴원', 'withdrawn'),
        s3: makeStudent('s3', '보류', 'on_hold'),
      });

      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: ['수학A'],
          studentMap,
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.classDataMap['수학A'].studentList).toHaveLength(3);
    });

    it('excludes prospect students', () => {
      const studentMap = createMockStudentMap({
        s1: {
          name: '예비학생', status: 'prospect',
          enrollments: [createMockEnrollment({ subject: 'math', className: '수학A' })],
        },
      });

      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: ['수학A'],
          studentMap,
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.classDataMap['수학A'].studentList).toHaveLength(0);
    });
  });

  describe('class name matching', () => {
    it('matches trimmed class names', () => {
      const studentMap = createMockStudentMap({
        s1: {
          name: '학생', status: 'active',
          enrollments: [createMockEnrollment({ subject: 'math', className: '수학A ' })], // trailing space
        },
      });

      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: ['수학A'],
          studentMap,
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.classDataMap['수학A'].studentList).toHaveLength(1);
    });
  });

  describe('transfer detection', () => {
    it('detects transferred student (ended in this class, active in another)', () => {
      const studentMap = createMockStudentMap({
        s1: {
          name: '반이동학생', status: 'active',
          enrollments: [
            createMockEnrollment({ id: 'e1', subject: 'math', className: '수학A', withdrawalDate: '2026-01-15' }),
            createMockEnrollment({ id: 'e2', subject: 'math', className: '수학B' }),
          ],
        },
      });

      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: ['수학A', '수학B'],
          studentMap,
        }),
        { wrapper: createWrapper() }
      );

      const inA = result.current.classDataMap['수학A'].studentList[0];
      expect(inA.isTransferred).toBe(true);

      const inB = result.current.classDataMap['수학B'].studentList[0];
      expect(inB.isTransferredIn).toBe(true);
    });
  });

  describe('sorting', () => {
    it('sorts students alphabetically by name (Korean)', () => {
      const studentMap = createMockStudentMap({
        s1: {
          name: '이학생', status: 'active',
          enrollments: [createMockEnrollment({ id: 'e1', subject: 'math', className: '수학A' })],
        },
        s2: {
          name: '가학생', status: 'active',
          enrollments: [createMockEnrollment({ id: 'e2', subject: 'math', className: '수학A' })],
        },
      });

      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: ['수학A'],
          studentMap,
        }),
        { wrapper: createWrapper() }
      );

      const names = result.current.classDataMap['수학A'].studentList.map(s => s.name);
      expect(names).toEqual(['가학생', '이학생']);
    });
  });
});
