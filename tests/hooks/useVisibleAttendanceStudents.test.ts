/**
 * Tests for useVisibleAttendanceStudents hook
 *
 * This hook filters and expands students for attendance display:
 * 1. Date filtering: Active students during current month
 * 2. Class expansion: One student → multiple rows if multiple classes
 * 3. Attendance filtering: Class-specific data (className::dateKey)
 * 4. Enrollment processing: Extract schedule days and dates
 * 5. Sorting: By group order, then alphabetically, then by name
 */

import { renderHook } from '@testing-library/react';
import { useVisibleAttendanceStudents } from '../../hooks/useVisibleAttendanceStudents';
import { Student } from '../../components/Attendance/types';

// Mock student factory
function createMockStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-1',
    name: '김학생',
    status: 'active',
    startDate: '2025-01-01',
    endDate: undefined,
    mainClasses: [],
    slotClasses: [],
    enrollments: [],
    attendance: {},
    memos: {},
    homework: {},
    cellColors: {},
    staffIds: [],
    subjects: ['math'],
    ...overrides,
  } as Student;
}

describe('useVisibleAttendanceStudents', () => {
  const currentDate = new Date('2025-02-15'); // Mid-February 2025
  const groupOrder: string[] = ['수학A', '수학B', '영어A'];

  describe('Basic Filtering', () => {
    it('returns empty array when no students provided', () => {
      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([], currentDate, groupOrder)
      );

      expect(result.current).toEqual([]);
    });

    it('includes active student within date range', () => {
      const student = createMockStudent({
        id: 'student-1',
        name: '김학생',
        startDate: '2025-02-01',
        endDate: undefined,
        status: 'active',
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김학생');
    });

    it('includes student with no classes as single row', () => {
      const student = createMockStudent({
        id: 'student-1',
        name: '김학생',
        mainClasses: [],
        slotClasses: [],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe('student-1');
    });
  });

  describe('Date Filtering - Withdrawn Students', () => {
    it('excludes withdrawn student with endDate before current month', () => {
      const student = createMockStudent({
        status: 'withdrawn',
        startDate: '2025-01-01',
        endDate: '2025-01-15', // Clearly before February in any timezone
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      // FIX: Student with endDate before month should be excluded
      expect(result.current).toHaveLength(0);
    });

    it('includes withdrawn student with endDate within current month', () => {
      const student = createMockStudent({
        name: '퇴원생',
        status: 'withdrawn',
        startDate: '2025-01-01',
        endDate: '2025-02-20', // Within February
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('퇴원생');
    });

    it('includes withdrawn student with endDate after current month', () => {
      const student = createMockStudent({
        status: 'withdrawn',
        startDate: '2025-01-01',
        endDate: '2025-03-31', // After February
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(1);
    });

    it('excludes withdrawn student with no endDate', () => {
      const student = createMockStudent({
        status: 'withdrawn',
        startDate: '2024-12-01',
        endDate: undefined,
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      // Hook logic: withdrawn + no endDate → excluded
      expect(result.current).toHaveLength(0);
    });
  });

  describe('Date Filtering - Start/End Dates', () => {
    it('excludes student with future startDate after month end', () => {
      const student = createMockStudent({
        startDate: '2025-03-01', // March (after February)
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(0);
    });

    it('includes student with startDate within current month', () => {
      const student = createMockStudent({
        startDate: '2025-02-15',
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(1);
    });

    it('excludes student with endDate before month start', () => {
      const student = createMockStudent({
        startDate: '2024-12-01',
        endDate: '2025-01-15', // Clearly before February in any timezone
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(0);
    });

    it('includes student with endDate on first day of month', () => {
      const student = createMockStudent({
        startDate: '2025-01-01',
        endDate: '2025-02-01',
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(1);
    });
  });

  describe('Class Expansion', () => {
    it('expands student with 2 mainClasses into 2 rows', () => {
      const student = createMockStudent({
        id: 'student-1',
        name: '김학생',
        mainClasses: ['수학A', '수학B'],
        slotClasses: [],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[0].group).toBe('수학A');
      expect(result.current[1].group).toBe('수학B');
    });

    it('expands student with mainClasses and slotClasses', () => {
      const student = createMockStudent({
        id: 'student-1',
        name: '김학생',
        mainClasses: ['수학A'],
        slotClasses: ['영어A'],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[0].group).toBe('수학A');
      expect(result.current[0].mainClasses).toEqual(['수학A']);
      expect(result.current[0].slotClasses).toEqual([]);

      expect(result.current[1].group).toBe('영어A');
      expect(result.current[1].mainClasses).toEqual([]);
      expect(result.current[1].slotClasses).toEqual(['영어A']);
    });

    it('expands student with 3 classes into 3 rows', () => {
      const student = createMockStudent({
        mainClasses: ['수학A', '수학B'],
        slotClasses: ['영어A'],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(3);
    });

    it('preserves student ID across expanded rows', () => {
      const student = createMockStudent({
        id: 'student-123',
        mainClasses: ['수학A', '수학B'],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current[0].id).toBe('student-123');
      expect(result.current[1].id).toBe('student-123');
    });
  });

  describe('Attendance Data Filtering', () => {
    it('filters class-specific attendance data by className prefix', () => {
      const student = createMockStudent({
        mainClasses: ['수학A', '수학B'],
        attendance: {
          '수학A::2025-02-15': 1,
          '수학A::2025-02-16': 2,
          '수학B::2025-02-15': 1,
          '수학B::2025-02-17': 3,
        },
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      const classA = result.current.find(s => s.group === '수학A');
      const classB = result.current.find(s => s.group === '수학B');

      expect(classA?.attendance).toEqual({
        '2025-02-15': 1,
        '2025-02-16': 2,
      });

      expect(classB?.attendance).toEqual({
        '2025-02-15': 1,
        '2025-02-17': 3,
      });
    });

    it('filters class-specific memos data', () => {
      const student = createMockStudent({
        mainClasses: ['수학A', '수학B'],
        memos: {
          '수학A::2025-02-15': '잘함',
          '수학B::2025-02-15': '보통',
        },
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      const classA = result.current.find(s => s.group === '수학A');
      const classB = result.current.find(s => s.group === '수학B');

      expect(classA?.memos).toEqual({ '2025-02-15': '잘함' });
      expect(classB?.memos).toEqual({ '2025-02-15': '보통' });
    });

    it('filters class-specific homework data', () => {
      const student = createMockStudent({
        mainClasses: ['수학A', '수학B'],
        homework: {
          '수학A::2025-02-15': true,
          '수학B::2025-02-15': false,
        },
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      const classA = result.current.find(s => s.group === '수학A');
      const classB = result.current.find(s => s.group === '수학B');

      expect(classA?.homework).toEqual({ '2025-02-15': true });
      expect(classB?.homework).toEqual({ '2025-02-15': false });
    });

    it('filters class-specific cellColors data', () => {
      const student = createMockStudent({
        mainClasses: ['수학A', '수학B'],
        cellColors: {
          '수학A::2025-02-15': '#FF0000',
          '수학B::2025-02-15': '#00FF00',
        },
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      const classA = result.current.find(s => s.group === '수학A');
      const classB = result.current.find(s => s.group === '수학B');

      expect(classA?.cellColors).toEqual({ '2025-02-15': '#FF0000' });
      expect(classB?.cellColors).toEqual({ '2025-02-15': '#00FF00' });
    });

    it('excludes non-class-specific keys', () => {
      const student = createMockStudent({
        mainClasses: ['수학A'],
        attendance: {
          '수학A::2025-02-15': 1,
          '2025-02-16': 2, // Legacy format without "::"
        },
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      const classA = result.current.find(s => s.group === '수학A');

      // Only class-specific keys should be included
      expect(classA?.attendance).toEqual({ '2025-02-15': 1 });
      expect(classA?.attendance['2025-02-16']).toBeUndefined();
    });
  });

  describe('Enrollment Processing', () => {
    it('extracts schedule days from enrollment.schedule', () => {
      const student = createMockStudent({
        mainClasses: ['수학A'],
        enrollments: [
          {
            className: '수학A',
            schedule: ['월 1', '수 1', '금 1'],
          },
        ],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current[0].days).toEqual(['월', '수', '금']);
    });

    it('extracts days from enrollment.days field', () => {
      const student = createMockStudent({
        mainClasses: ['수학A'],
        enrollments: [
          {
            className: '수학A',
            days: ['화', '목'],
          },
        ],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current[0].days).toEqual(['화', '목']);
    });

    it('combines schedule and days fields without duplicates', () => {
      const student = createMockStudent({
        mainClasses: ['수학A'],
        enrollments: [
          {
            className: '수학A',
            schedule: ['월 1', '수 1'],
            days: ['수', '금'],
          },
        ],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current[0].days).toEqual(['월', '수', '금']);
    });

    it('extracts class-specific start date from enrollment', () => {
      const student = createMockStudent({
        startDate: '2025-01-01',
        mainClasses: ['수학A'],
        enrollments: [
          {
            className: '수학A',
            startDate: '2025-02-01',
          },
        ],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current[0].startDate).toBe('2025-02-01');
    });

    it('extracts class-specific end date from enrollment', () => {
      const student = createMockStudent({
        endDate: undefined,
        mainClasses: ['수학A'],
        enrollments: [
          {
            className: '수학A',
            endDate: '2025-02-28',
          },
        ],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current[0].endDate).toBe('2025-02-28');
    });

    it('excludes enrollment with endDate before month start', () => {
      const student = createMockStudent({
        mainClasses: ['수학A'],
        enrollments: [
          {
            className: '수학A',
            endDate: '2025-01-15', // Clearly before February in any timezone
            schedule: ['월 1'],
          },
        ],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      // FIX: Enrollment excluded, so no days extracted
      expect(result.current[0].days).toBeUndefined();
    });

    it('processes only matching className enrollments', () => {
      const student = createMockStudent({
        mainClasses: ['수학A', '수학B'],
        enrollments: [
          {
            className: '수학A',
            schedule: ['월 1'],
          },
          {
            className: '수학B',
            schedule: ['화 1'],
          },
        ],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      const classA = result.current.find(s => s.group === '수학A');
      const classB = result.current.find(s => s.group === '수학B');

      expect(classA?.days).toEqual(['월']);
      expect(classB?.days).toEqual(['화']);
    });
  });

  describe('Sorting - Group Order', () => {
    it('sorts by groupOrder index', () => {
      const students = [
        createMockStudent({
          id: 's1',
          name: '김학생',
          mainClasses: ['영어A'],
        }),
        createMockStudent({
          id: 's2',
          name: '이학생',
          mainClasses: ['수학A'],
        }),
        createMockStudent({
          id: 's3',
          name: '박학생',
          mainClasses: ['수학B'],
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      // Order: 수학A (index 0), 수학B (index 1), 영어A (index 2)
      expect(result.current[0].group).toBe('수학A');
      expect(result.current[1].group).toBe('수학B');
      expect(result.current[2].group).toBe('영어A');
    });

    it('groups not in groupOrder sorted alphabetically', () => {
      const students = [
        createMockStudent({
          name: '김학생',
          mainClasses: ['중등'],
        }),
        createMockStudent({
          name: '이학생',
          mainClasses: ['고등'],
        }),
        createMockStudent({
          name: '박학생',
          mainClasses: ['수학A'],
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      // Order: 수학A (in groupOrder), then 고등, 중등 (alphabetical)
      expect(result.current[0].group).toBe('수학A');
      expect(result.current[1].group).toBe('고등');
      expect(result.current[2].group).toBe('중등');
    });

    it('students in groupOrder come before those not in order', () => {
      const students = [
        createMockStudent({
          name: 'A학생',
          mainClasses: ['고등A'],
        }),
        createMockStudent({
          name: 'B학생',
          mainClasses: ['수학B'],
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      // 수학B (in groupOrder) comes first
      expect(result.current[0].group).toBe('수학B');
      expect(result.current[1].group).toBe('고등A');
    });

    it('students without group go last', () => {
      const students = [
        createMockStudent({
          name: '무그룹',
          mainClasses: [],
          slotClasses: [],
        }),
        createMockStudent({
          name: '수학생',
          mainClasses: ['수학A'],
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      // With group comes first
      expect(result.current[0].name).toBe('수학생');
      expect(result.current[1].name).toBe('무그룹');
    });
  });

  describe('Sorting - Within Same Group', () => {
    it('sorts by Korean name within same group', () => {
      const students = [
        createMockStudent({
          name: '최학생',
          mainClasses: ['수학A'],
        }),
        createMockStudent({
          name: '김학생',
          mainClasses: ['수학A'],
        }),
        createMockStudent({
          name: '박학생',
          mainClasses: ['수학A'],
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      expect(result.current[0].name).toBe('김학생');
      expect(result.current[1].name).toBe('박학생');
      expect(result.current[2].name).toBe('최학생');
    });

    it('maintains stable sort for same name', () => {
      const students = [
        createMockStudent({
          id: 's1',
          name: '김학생',
          mainClasses: ['수학A'],
        }),
        createMockStudent({
          id: 's2',
          name: '김학생',
          mainClasses: ['수학A'],
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      // Both have same name and group, order should be stable
      expect(result.current).toHaveLength(2);
      expect(result.current[0].name).toBe('김학생');
      expect(result.current[1].name).toBe('김학생');
    });
  });

  describe('Complex Scenarios', () => {
    it('handles multiple students with multiple classes', () => {
      const students = [
        createMockStudent({
          id: 's1',
          name: '김학생',
          mainClasses: ['수학A', '영어A'],
        }),
        createMockStudent({
          id: 's2',
          name: '이학생',
          mainClasses: ['수학B'],
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(3);
      // Order: 수학A, 수학B, 영어A (by groupOrder)
      expect(result.current[0].group).toBe('수학A');
      expect(result.current[0].name).toBe('김학생');
      expect(result.current[1].group).toBe('수학B');
      expect(result.current[1].name).toBe('이학생');
      expect(result.current[2].group).toBe('영어A');
      expect(result.current[2].name).toBe('김학생');
    });

    it('combines all features: filtering, expansion, and sorting', () => {
      const students = [
        createMockStudent({
          id: 's1',
          name: '퇴원생',
          status: 'withdrawn',
          endDate: '2025-01-15', // Before February
          mainClasses: ['수학A'],
        }),
        createMockStudent({
          id: 's2',
          name: '정상학생',
          mainClasses: ['영어A', '수학A'],
          attendance: {
            '영어A::2025-02-15': 1,
            '수학A::2025-02-16': 2,
          },
        }),
        createMockStudent({
          id: 's3',
          name: '미래학생',
          startDate: '2025-03-01', // After February
          mainClasses: ['수학B'],
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      // Only '정상학생' should be included (2 rows)
      expect(result.current).toHaveLength(2);

      // Sorted by groupOrder: 수학A, 영어A
      expect(result.current[0].group).toBe('수학A');
      expect(result.current[0].name).toBe('정상학생');
      expect(result.current[0].attendance).toEqual({ '2025-02-16': 2 });

      expect(result.current[1].group).toBe('영어A');
      expect(result.current[1].name).toBe('정상학생');
      expect(result.current[1].attendance).toEqual({ '2025-02-15': 1 });
    });

    it('handles empty groupOrder array', () => {
      const students = [
        createMockStudent({
          name: '중등학생',
          mainClasses: ['중등'],
        }),
        createMockStudent({
          name: '고등학생',
          mainClasses: ['고등'],
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, [])
      );

      // Sorted alphabetically since no groupOrder
      expect(result.current[0].group).toBe('고등');
      expect(result.current[1].group).toBe('중등');
    });
  });

  describe('Edge Cases', () => {
    it('handles student with undefined attendance fields', () => {
      const student = createMockStudent({
        mainClasses: ['수학A'],
        attendance: undefined as any,
        memos: undefined as any,
        homework: undefined as any,
        cellColors: undefined as any,
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].attendance).toEqual({});
      expect(result.current[0].memos).toEqual({});
      expect(result.current[0].homework).toEqual({});
      expect(result.current[0].cellColors).toEqual({});
    });

    it('handles student with empty enrollments array', () => {
      const student = createMockStudent({
        mainClasses: ['수학A'],
        enrollments: [],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].days).toBeUndefined();
    });

    it('handles enrollment with missing schedule and days', () => {
      const student = createMockStudent({
        mainClasses: ['수학A'],
        enrollments: [
          {
            className: '수학A',
            // No schedule or days
          },
        ],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current[0].days).toBeUndefined();
    });

    it('handles malformed schedule strings', () => {
      const student = createMockStudent({
        mainClasses: ['수학A'],
        enrollments: [
          {
            className: '수학A',
            schedule: ['월', 'invalid', '수 1 extra'],
          },
        ],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      // Should extract first part only
      expect(result.current[0].days).toEqual(['월', 'invalid', '수']);
    });

    it('handles student with very long name', () => {
      const student = createMockStudent({
        name: '김' + '가'.repeat(50),
        mainClasses: ['수학A'],
      });

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents([student], currentDate, groupOrder)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김' + '가'.repeat(50));
    });

    it('handles month boundary dates correctly', () => {
      const students = [
        createMockStudent({
          name: '1월말',
          startDate: '2025-01-10',
          endDate: '2025-02-15',
        }),
        createMockStudent({
          name: '2월초',
          startDate: '2025-02-10',
          endDate: '2025-02-20',
        }),
        createMockStudent({
          name: '2월중',
          startDate: '2025-02-15',
          endDate: '2025-03-15',
        }),
      ];

      const { result } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      // All 3 students overlap with Feb 2025
      expect(result.current).toHaveLength(3);
    });
  });

  describe('Memoization', () => {
    it('returns same reference when dependencies unchanged', () => {
      const students = [createMockStudent({ mainClasses: ['수학A'] })];

      const { result, rerender } = renderHook(() =>
        useVisibleAttendanceStudents(students, currentDate, groupOrder)
      );

      const firstResult = result.current;

      rerender();

      // Same reference due to useMemo
      expect(result.current).toBe(firstResult);
    });

    it('recalculates when students change', () => {
      const students1 = [createMockStudent({ name: '학생1' })];
      const students2 = [createMockStudent({ name: '학생2' })];

      const { result, rerender } = renderHook(
        ({ students }) => useVisibleAttendanceStudents(students, currentDate, groupOrder),
        { initialProps: { students: students1 } }
      );

      const firstResult = result.current;

      rerender({ students: students2 });

      // Different reference after change
      expect(result.current).not.toBe(firstResult);
      expect(result.current[0].name).toBe('학생2');
    });

    it('recalculates when currentDate changes', () => {
      const students = [createMockStudent()];
      const date1 = new Date('2025-02-15');
      const date2 = new Date('2025-03-15');

      const { result, rerender } = renderHook(
        ({ date }) => useVisibleAttendanceStudents(students, date, groupOrder),
        { initialProps: { date: date1 } }
      );

      const firstResult = result.current;

      rerender({ date: date2 });

      // Different reference after date change
      expect(result.current).not.toBe(firstResult);
    });

    it('recalculates when groupOrder changes', () => {
      const students = [createMockStudent({ mainClasses: ['수학A'] })];
      const order1 = ['수학A', '수학B'];
      const order2 = ['수학B', '수학A'];

      const { result, rerender } = renderHook(
        ({ order }) => useVisibleAttendanceStudents(students, currentDate, order),
        { initialProps: { order: order1 } }
      );

      const firstResult = result.current;

      rerender({ order: order2 });

      // Different reference after order change
      expect(result.current).not.toBe(firstResult);
    });
  });
});
