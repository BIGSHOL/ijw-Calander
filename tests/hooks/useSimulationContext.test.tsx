import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  MathSimulationProvider,
  useMathSimulation,
  useMathSimulationOptional,
} from '../../components/Timetable/Math/context/SimulationContext';

// ============ Firebase Mocks ============

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: any, name: string) => ({ __type: 'collection', __name: name })),
  collectionGroup: vi.fn((_db: any, name: string) => ({ __type: 'collectionGroup', __name: name })),
  query: vi.fn((...args: any[]) => ({ __type: 'query', __source: args[0], __constraints: args.slice(1) })),
  where: vi.fn((field: string, op: string, value: any) => ({ __type: 'where', field, op, value })),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn((_db: any, ...pathSegments: string[]) => ({
    __type: 'docRef',
    __path: pathSegments.join('/'),
    id: pathSegments[pathSegments.length - 1],
    parent: { parent: pathSegments.length >= 3 ? { id: pathSegments[pathSegments.length - 3] } : null },
  })),
  setDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../../firebaseConfig', () => ({ db: {} }));
// Also mock the relative path used by SimulationContext
vi.mock('../../firebaseConfig', () => ({ db: {} }));

import {
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

// ============ Helpers ============

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(MathSimulationProvider, null, children);
};

const createMockDocSnap = (id: string, data: any, parentStudentId?: string) => ({
  id,
  data: () => data,
  exists: () => true,
  ref: {
    id,
    path: `mock/${id}`,
    parent: {
      parent: parentStudentId ? { id: parentStudentId } : null,
    },
  },
});

const createMockQuerySnapshot = (docs: any[]) => ({
  docs,
  empty: docs.length === 0,
  size: docs.length,
});

// Sample data
const sampleClasses = [
  createMockDocSnap('class1', {
    className: '수1A',
    subject: 'math',
    teacher: '김선생',
    room: '101',
    schedule: [{ day: '월', periodId: '5' }],
    slotTeachers: { '월-5': '김선생' },
    slotRooms: { '월-5': '101' },
    underline: false,
    mainTeacher: '김선생',
  }),
  createMockDocSnap('class2', {
    className: '수2B',
    subject: 'math',
    teacher: '이선생',
    room: '202',
    schedule: [{ day: '화', periodId: '3' }],
    slotTeachers: {},
    slotRooms: {},
  }),
];

const sampleEnrollments = [
  createMockDocSnap('math_수1A', {
    className: '수1A',
    subject: 'math',
    underline: false,
    enrollmentDate: '2025-03-01',
    onHold: false,
    attendanceDays: ['월', '수'],
  }, 'student1'),
  createMockDocSnap('math_수1A', {
    className: '수1A',
    subject: 'math',
    underline: true,
    enrollmentDate: '2025-04-15',
    onHold: false,
    attendanceDays: ['월'],
  }, 'student2'),
  createMockDocSnap('math_수2B', {
    className: '수2B',
    subject: 'math',
    enrollmentDate: '2025-01-10',
    onHold: true,
    attendanceDays: ['화', '목'],
  }, 'student3'),
];

// Withdrawn enrollment (should be skipped)
const withdrawnEnrollment = createMockDocSnap('math_수1A', {
  className: '수1A',
  subject: 'math',
  enrollmentDate: '2024-06-01',
  withdrawalDate: '2025-01-01',
}, 'student_withdrawn');

const studentMap: Record<string, any> = {
  student1: { name: '홍길동', englishName: 'Hong', school: '중학교', grade: '2', status: 'active', startDate: '2025-03-01' },
  student2: { name: '김영희', englishName: 'Kim', school: '고등학교', grade: '1', status: 'active', startDate: '2025-04-15' },
  student3: { name: '박철수', englishName: 'Park', school: '중학교', grade: '3', status: 'active', startDate: '2025-01-10' },
  student_inactive: { name: '이비활성', status: 'inactive' },
};

/**
 * Helper: set up getDocs mock for enterScenarioMode
 * Returns classes and enrollments in order
 */
const setupGetDocsMockForEnter = (
  classes = sampleClasses,
  enrollments = [...sampleEnrollments, withdrawnEnrollment]
) => {
  let callCount = 0;
  vi.mocked(getDocs).mockImplementation(async () => {
    callCount++;
    if (callCount === 1) return createMockQuerySnapshot(classes) as any;
    return createMockQuerySnapshot(enrollments) as any;
  });
};

// ============ TESTS ============

describe('SimulationContext - MathSimulationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());
  });

  // ==============================
  // 1. Context Hook Access
  // ==============================

  describe('Context Hook Access', () => {
    it('useMathSimulation throws outside provider', () => {
      // Suppress console.error for expected error
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        renderHook(() => useMathSimulation());
      }).toThrow('useMathSimulation must be used within MathSimulationProvider');
      spy.mockRestore();
    });

    it('useMathSimulationOptional returns null outside provider', () => {
      const { result } = renderHook(() => useMathSimulationOptional());
      expect(result.current).toBeNull();
    });

    it('useMathSimulation returns context inside provider', () => {
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });
      expect(result.current).toBeDefined();
      expect(result.current.isScenarioMode).toBe(false);
    });
  });

  // ==============================
  // 2. Initial State
  // ==============================

  describe('Initial State', () => {
    it('has correct default state values', () => {
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });
      expect(result.current.isScenarioMode).toBe(false);
      expect(result.current.scenarioClasses).toEqual({});
      expect(result.current.scenarioEnrollments).toEqual({});
      expect(result.current.isDirty).toBe(false);
      expect(result.current.currentScenarioName).toBeNull();
    });

    it('exposes all required functions', () => {
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      // Mode control
      expect(typeof result.current.enterScenarioMode).toBe('function');
      expect(typeof result.current.exitScenarioMode).toBe('function');

      // Data access
      expect(typeof result.current.getClassStudents).toBe('function');
      expect(typeof result.current.getScenarioClass).toBe('function');
      expect(typeof result.current.getScenarioClassByName).toBe('function');

      // Edit operations
      expect(typeof result.current.updateScenarioClass).toBe('function');
      expect(typeof result.current.addStudentToClass).toBe('function');
      expect(typeof result.current.removeStudentFromClass).toBe('function');
      expect(typeof result.current.moveStudent).toBe('function');

      // Scenario operations
      expect(typeof result.current.loadFromLive).toBe('function');
      expect(typeof result.current.saveToScenario).toBe('function');
      expect(typeof result.current.updateScenario).toBe('function');
      expect(typeof result.current.loadFromScenario).toBe('function');
      expect(typeof result.current.publishToLive).toBe('function');

      // State
      expect(typeof result.current.setCurrentScenarioName).toBe('function');
    });
  });

  // ==============================
  // 3. Mode Control
  // ==============================

  describe('enterScenarioMode', () => {
    it('loads live data and enters scenario mode', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      expect(result.current.isScenarioMode).toBe(true);
      expect(result.current.isDirty).toBe(false);
      expect(result.current.currentScenarioName).toBeNull();
    });

    it('loads classes correctly from Firestore', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const classes = result.current.scenarioClasses;
      expect(Object.keys(classes)).toHaveLength(2);
      expect(classes['class1'].className).toBe('수1A');
      expect(classes['class1'].teacher).toBe('김선생');
      expect(classes['class1'].room).toBe('101');
      expect(classes['class1'].schedule).toEqual([{ day: '월', periodId: '5' }]);
      expect(classes['class1'].slotTeachers).toEqual({ '월-5': '김선생' });
      expect(classes['class1'].mainTeacher).toBe('김선생');
      expect(classes['class2'].className).toBe('수2B');
    });

    it('loads enrollments correctly and skips withdrawn students', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const enrollments = result.current.scenarioEnrollments;
      // 수1A: student1 + student2 (withdrawn student should be skipped)
      expect(Object.keys(enrollments['수1A'])).toHaveLength(2);
      expect(enrollments['수1A']['student1']).toBeDefined();
      expect(enrollments['수1A']['student2']).toBeDefined();
      expect(enrollments['수1A']['student_withdrawn']).toBeUndefined();

      // 수2B: student3
      expect(Object.keys(enrollments['수2B'])).toHaveLength(1);
      expect(enrollments['수2B']['student3'].onHold).toBe(true);
    });

    it('converts Firestore Timestamp to date string', async () => {
      const mockDate = new Date('2025-06-15T00:00:00.000Z');
      const enrollmentWithTimestamp = createMockDocSnap('math_수1A', {
        className: '수1A',
        subject: 'math',
        enrollmentDate: { toDate: () => mockDate },
        attendanceDays: [],
      }, 'student_ts');

      setupGetDocsMockForEnter(sampleClasses, [enrollmentWithTimestamp]);
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      expect(result.current.scenarioEnrollments['수1A']['student_ts'].enrollmentDate).toBe('2025-06-15');
    });

    it('handles string dates as-is', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      expect(result.current.scenarioEnrollments['수1A']['student1'].enrollmentDate).toBe('2025-03-01');
    });

    it('skips enrollments without studentId', async () => {
      const noParentEnrollment = {
        id: 'orphan',
        data: () => ({ className: '수1A', subject: 'math', attendanceDays: [] }),
        exists: () => true,
        ref: { id: 'orphan', path: 'orphan', parent: { parent: null } },
      };

      setupGetDocsMockForEnter(sampleClasses, [noParentEnrollment]);
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      // No enrollments should be loaded
      expect(Object.keys(result.current.scenarioEnrollments)).toHaveLength(0);
    });

    it('fetches classes and enrollments in parallel', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      // getDocs called exactly twice (classes + enrollments)
      expect(getDocs).toHaveBeenCalledTimes(2);
    });
  });

  describe('exitScenarioMode', () => {
    it('exits scenario mode and clears state', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });
      expect(result.current.isScenarioMode).toBe(true);

      act(() => {
        result.current.exitScenarioMode();
      });

      expect(result.current.isScenarioMode).toBe(false);
      expect(result.current.scenarioClasses).toEqual({});
      expect(result.current.scenarioEnrollments).toEqual({});
      expect(result.current.isDirty).toBe(false);
      expect(result.current.currentScenarioName).toBeNull();
    });

    it('shows confirm dialog when dirty', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      // Make dirty
      act(() => {
        result.current.updateScenarioClass('class1', { room: '999' });
      });
      expect(result.current.isDirty).toBe(true);

      // Exit - confirm returns true
      vi.mocked(confirm).mockReturnValue(true);
      act(() => {
        result.current.exitScenarioMode();
      });

      expect(confirm).toHaveBeenCalledWith('저장하지 않은 변경 사항이 있습니다. 정말 나가시겠습니까?');
      expect(result.current.isScenarioMode).toBe(false);
    });

    it('cancels exit when confirm is declined', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', { room: '999' });
      });

      vi.mocked(confirm).mockReturnValue(false);
      act(() => {
        result.current.exitScenarioMode();
      });

      // Should NOT exit
      expect(result.current.isScenarioMode).toBe(true);
      expect(result.current.isDirty).toBe(true);
    });

    it('does not show confirm when not dirty', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.exitScenarioMode();
      });

      expect(confirm).not.toHaveBeenCalled();
      expect(result.current.isScenarioMode).toBe(false);
    });
  });

  // ==============================
  // 4. Data Access
  // ==============================

  describe('getClassStudents', () => {
    it('returns empty lists when not in scenario mode', () => {
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      const students = result.current.getClassStudents(['수1A'], studentMap);
      expect(students['수1A'].studentList).toEqual([]);
      expect(students['수1A'].studentIds).toEqual([]);
    });

    it('returns scenario students for given classes', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const students = result.current.getClassStudents(['수1A'], studentMap);
      expect(students['수1A'].studentList).toHaveLength(2);
      expect(students['수1A'].studentIds).toHaveLength(2);
    });

    it('maps student data correctly from studentMap', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const students = result.current.getClassStudents(['수1A'], studentMap);
      const hong = students['수1A'].studentList.find((s: any) => s.name === '홍길동');
      expect(hong).toBeDefined();
      expect(hong!.englishName).toBe('Hong');
      expect(hong!.school).toBe('중학교');
      expect(hong!.grade).toBe('2');
      expect(hong!.enrollmentDate).toBe('2025-03-01');
    });

    it('uses enrollment underline over student base data', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const students = result.current.getClassStudents(['수1A'], studentMap);
      const kim = students['수1A'].studentList.find((s: any) => s.name === '김영희');
      expect(kim!.underline).toBe(true); // enrollment.underline is true
    });

    it('filters out inactive students', async () => {
      // Add enrollment for inactive student
      const inactiveEnrollment = createMockDocSnap('math_수1A', {
        className: '수1A',
        subject: 'math',
        attendanceDays: [],
      }, 'student_inactive');

      setupGetDocsMockForEnter(sampleClasses, [...sampleEnrollments, inactiveEnrollment]);
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const mapWithInactive = {
        ...studentMap,
        student_inactive: { name: '이비활성', status: 'inactive' },
      };
      const students = result.current.getClassStudents(['수1A'], mapWithInactive);
      // Should only have 2 active students, not the inactive one
      expect(students['수1A'].studentList).toHaveLength(2);
    });

    it('sorts students by Korean locale', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const students = result.current.getClassStudents(['수1A'], studentMap);
      const names = students['수1A'].studentList.map((s: any) => s.name);
      // Korean locale sort: 김영희 < 홍길동
      expect(names[0]).toBe('김영희');
      expect(names[1]).toBe('홍길동');
    });

    it('returns data for multiple classes', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const students = result.current.getClassStudents(['수1A', '수2B'], studentMap);
      expect(students['수1A'].studentList).toHaveLength(2);
      expect(students['수2B'].studentList).toHaveLength(1);
    });

    it('returns empty for unknown class', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const students = result.current.getClassStudents(['없는반'], studentMap);
      expect(students['없는반'].studentList).toEqual([]);
      expect(students['없는반'].studentIds).toEqual([]);
    });

    it('handles onHold enrollment data', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const students = result.current.getClassStudents(['수2B'], studentMap);
      const park = students['수2B'].studentList.find((s: any) => s.name === '박철수');
      expect(park!.onHold).toBe(true);
      expect(park!.attendanceDays).toEqual(['화', '목']);
    });
  });

  describe('getScenarioClass', () => {
    it('returns class by ID', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const cls = result.current.getScenarioClass('class1');
      expect(cls).toBeDefined();
      expect(cls!.className).toBe('수1A');
      expect(cls!.teacher).toBe('김선생');
    });

    it('returns undefined for unknown ID', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      expect(result.current.getScenarioClass('nonexistent')).toBeUndefined();
    });
  });

  describe('getScenarioClassByName', () => {
    it('returns class by name', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const cls = result.current.getScenarioClassByName('수2B');
      expect(cls).toBeDefined();
      expect(cls!.id).toBe('class2');
      expect(cls!.teacher).toBe('이선생');
    });

    it('returns undefined for unknown name', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      expect(result.current.getScenarioClassByName('없는반')).toBeUndefined();
    });
  });

  // ==============================
  // 5. Edit Operations
  // ==============================

  describe('updateScenarioClass', () => {
    it('updates class properties', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', { room: '303', teacher: '박선생' });
      });

      expect(result.current.scenarioClasses['class1'].room).toBe('303');
      expect(result.current.scenarioClasses['class1'].teacher).toBe('박선생');
      // Unchanged fields remain
      expect(result.current.scenarioClasses['class1'].className).toBe('수1A');
    });

    it('sets isDirty to true', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });
      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.updateScenarioClass('class1', { room: '999' });
      });
      expect(result.current.isDirty).toBe(true);
    });

    it('does not affect other classes', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', { room: '303' });
      });

      expect(result.current.scenarioClasses['class2'].room).toBe('202');
    });

    it('updates schedule array', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const newSchedule = [{ day: '월', periodId: '5' }, { day: '수', periodId: '3' }];
      act(() => {
        result.current.updateScenarioClass('class1', { schedule: newSchedule });
      });

      expect(result.current.scenarioClasses['class1'].schedule).toEqual(newSchedule);
    });

    it('updates slotTeachers and slotRooms', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', {
          slotTeachers: { '월-5': '박선생', '수-3': '최선생' },
          slotRooms: { '월-5': '303', '수-3': '404' },
        });
      });

      expect(result.current.scenarioClasses['class1'].slotTeachers).toEqual({ '월-5': '박선생', '수-3': '최선생' });
      expect(result.current.scenarioClasses['class1'].slotRooms).toEqual({ '월-5': '303', '수-3': '404' });
    });
  });

  describe('addStudentToClass', () => {
    it('adds a student to a class', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.addStudentToClass('수2B', 'student_new', {
          enrollmentDate: '2025-09-01',
          attendanceDays: ['화'],
        });
      });

      const enrollments = result.current.scenarioEnrollments['수2B'];
      expect(enrollments['student_new']).toBeDefined();
      expect(enrollments['student_new'].studentId).toBe('student_new');
      expect(enrollments['student_new'].className).toBe('수2B');
      expect(enrollments['student_new'].subject).toBe('math');
      expect(enrollments['student_new'].enrollmentDate).toBe('2025-09-01');
    });

    it('sets isDirty to true', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.addStudentToClass('수1A', 'student_new');
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('adds to existing class without affecting other students', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const beforeCount = Object.keys(result.current.scenarioEnrollments['수1A']).length;

      act(() => {
        result.current.addStudentToClass('수1A', 'student_new');
      });

      expect(Object.keys(result.current.scenarioEnrollments['수1A'])).toHaveLength(beforeCount + 1);
      expect(result.current.scenarioEnrollments['수1A']['student1']).toBeDefined();
      expect(result.current.scenarioEnrollments['수1A']['student2']).toBeDefined();
    });

    it('creates new class enrollment group if class has no enrollments', async () => {
      setupGetDocsMockForEnter(sampleClasses, []);
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.addStudentToClass('새반', 'student1');
      });

      expect(result.current.scenarioEnrollments['새반']).toBeDefined();
      expect(result.current.scenarioEnrollments['새반']['student1']).toBeDefined();
    });

    it('adds with default subject math', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.addStudentToClass('수1A', 'student_x');
      });

      expect(result.current.scenarioEnrollments['수1A']['student_x'].subject).toBe('math');
    });
  });

  describe('removeStudentFromClass', () => {
    it('removes a student from a class', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      expect(result.current.scenarioEnrollments['수1A']['student1']).toBeDefined();

      act(() => {
        result.current.removeStudentFromClass('수1A', 'student1');
      });

      expect(result.current.scenarioEnrollments['수1A']['student1']).toBeUndefined();
    });

    it('sets isDirty to true', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.removeStudentFromClass('수1A', 'student1');
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('does not affect other students in same class', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.removeStudentFromClass('수1A', 'student1');
      });

      expect(result.current.scenarioEnrollments['수1A']['student2']).toBeDefined();
    });

    it('does not affect other classes', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.removeStudentFromClass('수1A', 'student1');
      });

      expect(result.current.scenarioEnrollments['수2B']['student3']).toBeDefined();
    });
  });

  describe('moveStudent', () => {
    it('moves student from one class to another', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.moveStudent('수1A', '수2B', 'student1');
      });

      // Removed from source
      expect(result.current.scenarioEnrollments['수1A']['student1']).toBeUndefined();
      // Added to target
      expect(result.current.scenarioEnrollments['수2B']['student1']).toBeDefined();
      expect(result.current.scenarioEnrollments['수2B']['student1'].className).toBe('수2B');
    });

    it('preserves enrollment data during move', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const originalEnrollment = result.current.scenarioEnrollments['수1A']['student1'];

      act(() => {
        result.current.moveStudent('수1A', '수2B', 'student1');
      });

      const movedEnrollment = result.current.scenarioEnrollments['수2B']['student1'];
      expect(movedEnrollment.studentId).toBe(originalEnrollment.studentId);
      expect(movedEnrollment.subject).toBe(originalEnrollment.subject);
      expect(movedEnrollment.enrollmentDate).toBe(originalEnrollment.enrollmentDate);
      // className updated to target class
      expect(movedEnrollment.className).toBe('수2B');
    });

    it('sets isDirty to true', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.moveStudent('수1A', '수2B', 'student1');
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('does nothing if student not found in source class', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const before = { ...result.current.scenarioEnrollments };

      act(() => {
        result.current.moveStudent('수1A', '수2B', 'nonexistent_student');
      });

      // State should remain unchanged (no crash)
      expect(result.current.scenarioEnrollments['수1A']['student1']).toBeDefined();
      expect(result.current.scenarioEnrollments['수1A']['student2']).toBeDefined();
    });

    it('handles move to a class with no existing enrollments', async () => {
      setupGetDocsMockForEnter(sampleClasses, [
        sampleEnrollments[0], // student1 in 수1A
      ]);
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.moveStudent('수1A', '새반', 'student1');
      });

      expect(result.current.scenarioEnrollments['수1A']['student1']).toBeUndefined();
      expect(result.current.scenarioEnrollments['새반']['student1']).toBeDefined();
    });

    it('does not affect other students during move', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.moveStudent('수1A', '수2B', 'student1');
      });

      // student2 still in 수1A
      expect(result.current.scenarioEnrollments['수1A']['student2']).toBeDefined();
      // student3 still in 수2B
      expect(result.current.scenarioEnrollments['수2B']['student3']).toBeDefined();
    });
  });

  // ==============================
  // 6. Scenario Operations
  // ==============================

  describe('loadFromLive', () => {
    it('reloads live data and clears dirty/scenario name', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      // Make changes
      act(() => {
        result.current.updateScenarioClass('class1', { room: '999' });
        result.current.setCurrentScenarioName('테스트 시나리오');
      });
      expect(result.current.isDirty).toBe(true);

      // Re-setup mock for second load
      setupGetDocsMockForEnter();

      await act(async () => {
        await result.current.loadFromLive();
      });

      expect(result.current.isDirty).toBe(false);
      expect(result.current.currentScenarioName).toBeNull();
      // Data should be reloaded (room back to original)
      expect(result.current.scenarioClasses['class1'].room).toBe('101');
    });

    it('shows confirm when dirty', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', { room: '999' });
      });

      setupGetDocsMockForEnter();

      await act(async () => {
        await result.current.loadFromLive();
      });

      expect(confirm).toHaveBeenCalledWith('현재 변경 사항이 사라집니다. 계속하시겠습니까?');
    });

    it('cancels reload when confirm is declined', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', { room: '999' });
      });

      vi.mocked(confirm).mockReturnValue(false);

      await act(async () => {
        await result.current.loadFromLive();
      });

      // Changes should remain
      expect(result.current.scenarioClasses['class1'].room).toBe('999');
      expect(result.current.isDirty).toBe(true);
    });

    it('does not confirm when not dirty', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      setupGetDocsMockForEnter();

      await act(async () => {
        await result.current.loadFromLive();
      });

      expect(confirm).not.toHaveBeenCalled();
    });
  });

  describe('saveToScenario', () => {
    it('saves scenario to Firestore', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      let scenarioId = '';
      await act(async () => {
        scenarioId = await result.current.saveToScenario('테스트 시나리오', '테스트 설명', 'user1', '관리자');
      });

      expect(scenarioId).toMatch(/^scenario_\d+$/);
      expect(setDoc).toHaveBeenCalledTimes(1);

      const savedData = vi.mocked(setDoc).mock.calls[0][1] as any;
      expect(savedData.name).toBe('테스트 시나리오');
      expect(savedData.description).toBe('테스트 설명');
      expect(savedData.createdBy).toBe('관리자');
      expect(savedData.createdByUid).toBe('user1');
      expect(savedData.version).toBe(2);
    });

    it('calculates correct stats', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      await act(async () => {
        await result.current.saveToScenario('테스트', '', 'user1', '관리자');
      });

      const savedData = vi.mocked(setDoc).mock.calls[0][1] as any;
      expect(savedData.stats.classCount).toBe(2); // 2 classes
      expect(savedData.stats.studentCount).toBe(3); // 3 enrolled students
    });

    it('clears isDirty and sets currentScenarioName', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', { room: '999' });
      });
      expect(result.current.isDirty).toBe(true);

      await act(async () => {
        await result.current.saveToScenario('내 시나리오', '', 'user1', '관리자');
      });

      expect(result.current.isDirty).toBe(false);
      expect(result.current.currentScenarioName).toBe('내 시나리오');
    });

    it('includes createdAt timestamp', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      await act(async () => {
        await result.current.saveToScenario('테스트', '', 'user1', '관리자');
      });

      const savedData = vi.mocked(setDoc).mock.calls[0][1] as any;
      expect(savedData.createdAt).toBeDefined();
      expect(typeof savedData.createdAt).toBe('string');
    });

    it('sanitizes undefined values before saving', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      // Class2 has no mainTeacher (undefined)
      await act(async () => {
        await result.current.saveToScenario('테스트', '', 'user1', '관리자');
      });

      const savedData = vi.mocked(setDoc).mock.calls[0][1] as any;
      const class2Data = savedData.classes['class2'];
      // undefined fields should not exist (sanitized)
      expect('mainTeacher' in class2Data).toBe(false);
    });
  });

  describe('updateScenario', () => {
    it('updates existing scenario in Firestore', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ name: '기존 시나리오', description: '기존 설명', version: 2 }),
      } as any);

      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      await act(async () => {
        await result.current.updateScenario('scenario_123', 'user1', '관리자');
      });

      expect(setDoc).toHaveBeenCalledTimes(1);
      const savedData = vi.mocked(setDoc).mock.calls[0][1] as any;
      expect(savedData.updatedBy).toBe('관리자');
      expect(savedData.updatedByUid).toBe('user1');
      expect(savedData.version).toBe(2);
    });

    it('preserves original scenario metadata', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: '기존 시나리오',
          description: '기존 설명',
          createdBy: '원래작성자',
          createdAt: '2025-01-01T00:00:00.000Z',
          version: 2,
        }),
      } as any);

      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      await act(async () => {
        await result.current.updateScenario('scenario_123', 'user2', '수정자');
      });

      const savedData = vi.mocked(setDoc).mock.calls[0][1] as any;
      expect(savedData.createdBy).toBe('원래작성자');
      expect(savedData.name).toBe('기존 시나리오');
    });

    it('throws error if scenario not found', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
        data: () => null,
      } as any);

      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      await expect(act(async () => {
        await result.current.updateScenario('nonexistent', 'user1', '관리자');
      })).rejects.toThrow('시나리오를 찾을 수 없습니다.');
    });

    it('clears isDirty and sets scenario name', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ name: '시나리오A', version: 2 }),
      } as any);

      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', { room: '999' });
      });

      await act(async () => {
        await result.current.updateScenario('scenario_123', 'user1', '관리자');
      });

      expect(result.current.isDirty).toBe(false);
      expect(result.current.currentScenarioName).toBe('시나리오A');
    });
  });

  describe('loadFromScenario', () => {
    it('loads scenario from Firestore (version 2)', async () => {
      const savedClasses = {
        class1: { id: 'class1', className: '수1A', subject: 'math', teacher: '김선생', schedule: [] },
      };
      const savedEnrollments = {
        '수1A': { student1: { studentId: 'student1', className: '수1A', subject: 'math' } },
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: '저장된 시나리오',
          classes: savedClasses,
          enrollments: savedEnrollments,
          version: 2,
        }),
      } as any);

      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      await act(async () => {
        await result.current.loadFromScenario('scenario_abc');
      });

      expect(result.current.scenarioClasses).toEqual(savedClasses);
      expect(result.current.scenarioEnrollments).toEqual(savedEnrollments);
      expect(result.current.isDirty).toBe(false);
      expect(result.current.currentScenarioName).toBe('저장된 시나리오');
    });

    it('throws error for legacy version scenarios', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ name: '레거시', version: 1 }),
      } as any);

      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      await expect(act(async () => {
        await result.current.loadFromScenario('legacy_scenario');
      })).rejects.toThrow('레거시 시나리오는 아직 지원되지 않습니다');
    });

    it('throws error if scenario not found', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
        data: () => null,
      } as any);

      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      await expect(act(async () => {
        await result.current.loadFromScenario('nonexistent');
      })).rejects.toThrow('시나리오를 찾을 수 없습니다.');
    });

    it('handles empty classes/enrollments gracefully', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ name: '빈 시나리오', version: 2 }),
      } as any);

      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      await act(async () => {
        await result.current.loadFromScenario('empty_scenario');
      });

      expect(result.current.scenarioClasses).toEqual({});
      expect(result.current.scenarioEnrollments).toEqual({});
    });
  });

  describe('publishToLive', () => {
    it('creates backup before publishing', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      // Setup mocks for publish flow
      // getDocs calls: 1) backup load classes, 2) backup load enrollments, 3) existing enrollments for delete
      let getDocsCallCount = 0;
      vi.mocked(getDocs).mockImplementation(async () => {
        getDocsCallCount++;
        if (getDocsCallCount <= 2) {
          // Backup load (same as enter)
          return getDocsCallCount === 1
            ? createMockQuerySnapshot(sampleClasses) as any
            : createMockQuerySnapshot(sampleEnrollments) as any;
        }
        // Existing enrollments query for delete
        return createMockQuerySnapshot([]) as any;
      });

      await act(async () => {
        await result.current.publishToLive('user1', '관리자');
      });

      // confirm was called for publish
      expect(confirm).toHaveBeenCalled();

      // setDoc called for backup
      expect(setDoc).toHaveBeenCalled();
      const backupCall = vi.mocked(setDoc).mock.calls[0];
      const backupData = backupCall[1] as any;
      expect(backupData.name).toMatch(/^백업_/);
      expect(backupData.description).toContain('자동백업');
      expect(backupData.version).toBe(2);
    });

    it('cancels publish when confirm is declined', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      vi.mocked(confirm).mockReturnValue(false);

      await act(async () => {
        await result.current.publishToLive('user1', '관리자');
      });

      // No Firestore writes should happen
      expect(setDoc).not.toHaveBeenCalled();
      expect(writeBatch).not.toHaveBeenCalled();
    });

    it('uses writeBatch for class updates', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      let getDocsCallCount = 0;
      vi.mocked(getDocs).mockImplementation(async () => {
        getDocsCallCount++;
        if (getDocsCallCount === 1) return createMockQuerySnapshot(sampleClasses) as any;
        if (getDocsCallCount === 2) return createMockQuerySnapshot(sampleEnrollments) as any;
        return createMockQuerySnapshot([]) as any;
      });

      const mockBatch = { set: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await act(async () => {
        await result.current.publishToLive('user1', '관리자');
      });

      // writeBatch should have been called for class updates and enrollment operations
      expect(writeBatch).toHaveBeenCalled();
    });

    it('clears isDirty on success', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', { room: '999' });
      });
      expect(result.current.isDirty).toBe(true);

      let getDocsCallCount = 0;
      vi.mocked(getDocs).mockImplementation(async () => {
        getDocsCallCount++;
        if (getDocsCallCount === 1) return createMockQuerySnapshot(sampleClasses) as any;
        if (getDocsCallCount === 2) return createMockQuerySnapshot(sampleEnrollments) as any;
        return createMockQuerySnapshot([]) as any;
      });
      const mockBatch = { set: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await act(async () => {
        await result.current.publishToLive('user1', '관리자');
      });

      expect(result.current.isDirty).toBe(false);
    });

    it('shows success alert with backup ID', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      let getDocsCallCount = 0;
      vi.mocked(getDocs).mockImplementation(async () => {
        getDocsCallCount++;
        if (getDocsCallCount === 1) return createMockQuerySnapshot(sampleClasses) as any;
        if (getDocsCallCount === 2) return createMockQuerySnapshot(sampleEnrollments) as any;
        return createMockQuerySnapshot([]) as any;
      });
      const mockBatch = { set: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await act(async () => {
        await result.current.publishToLive('user1', '관리자');
      });

      expect(alert).toHaveBeenCalledWith(expect.stringContaining('성공적으로 반영되었습니다'));
      expect(alert).toHaveBeenCalledWith(expect.stringContaining('backup_'));
    });

    it('shows error alert on failure', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      // First getDocs for backup load classes succeeds, then fail
      let getDocsCallCount = 0;
      vi.mocked(getDocs).mockImplementation(async () => {
        getDocsCallCount++;
        if (getDocsCallCount === 1) return createMockQuerySnapshot(sampleClasses) as any;
        if (getDocsCallCount === 2) return createMockQuerySnapshot(sampleEnrollments) as any;
        throw new Error('Firestore write failed');
      });
      const mockBatch = { set: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      try {
        await act(async () => {
          await result.current.publishToLive('user1', '관리자');
        });
      } catch {
        // Expected to throw
      }

      expect(alert).toHaveBeenCalledWith(expect.stringContaining('오류가 발생했습니다'));
    });

    it('deletes existing math enrollments before creating new ones', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      const existingEnrollments = [
        { ref: { id: 'e1' } },
        { ref: { id: 'e2' } },
      ];

      let getDocsCallCount = 0;
      vi.mocked(getDocs).mockImplementation(async () => {
        getDocsCallCount++;
        if (getDocsCallCount === 1) return createMockQuerySnapshot(sampleClasses) as any;
        if (getDocsCallCount === 2) return createMockQuerySnapshot(sampleEnrollments) as any;
        // Existing enrollments to delete
        return createMockQuerySnapshot(existingEnrollments) as any;
      });

      const mockBatch = { set: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await act(async () => {
        await result.current.publishToLive('user1', '관리자');
      });

      // Should have called delete for existing enrollments
      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
    });

    it('creates new enrollments from scenario data', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      let getDocsCallCount = 0;
      vi.mocked(getDocs).mockImplementation(async () => {
        getDocsCallCount++;
        if (getDocsCallCount === 1) return createMockQuerySnapshot(sampleClasses) as any;
        if (getDocsCallCount === 2) return createMockQuerySnapshot(sampleEnrollments) as any;
        return createMockQuerySnapshot([]) as any;
      });

      const mockBatch = { set: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await act(async () => {
        await result.current.publishToLive('user1', '관리자');
      });

      // Should create enrollments: 2 (class1) + 1 (batch set for classes) + enrollments
      // The batch.set calls include class updates + enrollment creates
      expect(mockBatch.set).toHaveBeenCalled();
    });
  });

  // ==============================
  // 7. setCurrentScenarioName
  // ==============================

  describe('setCurrentScenarioName', () => {
    it('updates scenario name', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.setCurrentScenarioName('새 시나리오 이름');
      });

      expect(result.current.currentScenarioName).toBe('새 시나리오 이름');
    });

    it('can set to null', () => {
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      act(() => {
        result.current.setCurrentScenarioName(null);
      });

      expect(result.current.currentScenarioName).toBeNull();
    });
  });

  // ==============================
  // 8. Complex Scenarios
  // ==============================

  describe('Complex Workflows', () => {
    it('enter → edit → save → load → publish workflow', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      // 1. Enter scenario mode
      await act(async () => {
        await result.current.enterScenarioMode();
      });
      expect(result.current.isScenarioMode).toBe(true);

      // 2. Make edits
      act(() => {
        result.current.moveStudent('수1A', '수2B', 'student1');
        result.current.updateScenarioClass('class1', { room: '555' });
      });
      expect(result.current.isDirty).toBe(true);
      expect(result.current.scenarioEnrollments['수1A']['student1']).toBeUndefined();
      expect(result.current.scenarioEnrollments['수2B']['student1']).toBeDefined();
      expect(result.current.scenarioClasses['class1'].room).toBe('555');

      // 3. Save as scenario
      await act(async () => {
        await result.current.saveToScenario('통합 시나리오', '워크플로우 테스트', 'user1', '관리자');
      });
      expect(result.current.isDirty).toBe(false);
      expect(result.current.currentScenarioName).toBe('통합 시나리오');

      // 4. Load different scenario
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: '다른 시나리오',
          classes: { class1: { id: 'class1', className: '수1A', subject: 'math', teacher: '최선생', schedule: [] } },
          enrollments: {},
          version: 2,
        }),
      } as any);

      await act(async () => {
        await result.current.loadFromScenario('other_scenario');
      });
      expect(result.current.currentScenarioName).toBe('다른 시나리오');
      expect(result.current.scenarioClasses['class1'].teacher).toBe('최선생');
    });

    it('multiple edits accumulate isDirty correctly', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });
      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.addStudentToClass('수1A', 'new_student1');
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.removeStudentFromClass('수1A', 'new_student1');
      });
      // Still dirty (isDirty doesn't track reverse operations)
      expect(result.current.isDirty).toBe(true);
    });

    it('move student then add back to original class', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      // Move student1 from 수1A to 수2B
      act(() => {
        result.current.moveStudent('수1A', '수2B', 'student1');
      });
      expect(result.current.scenarioEnrollments['수1A']['student1']).toBeUndefined();

      // Add student1 back to 수1A
      act(() => {
        result.current.addStudentToClass('수1A', 'student1', {
          enrollmentDate: '2025-09-01',
        });
      });

      expect(result.current.scenarioEnrollments['수1A']['student1']).toBeDefined();
      expect(result.current.scenarioEnrollments['수2B']['student1']).toBeDefined();
    });

    it('enter → edit → exit (cancel) → edit again', async () => {
      setupGetDocsMockForEnter();
      const { result } = renderHook(() => useMathSimulation(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.enterScenarioMode();
      });

      act(() => {
        result.current.updateScenarioClass('class1', { room: '777' });
      });

      // Try to exit but cancel
      vi.mocked(confirm).mockReturnValue(false);
      act(() => {
        result.current.exitScenarioMode();
      });
      expect(result.current.isScenarioMode).toBe(true);

      // Continue editing
      act(() => {
        result.current.updateScenarioClass('class1', { room: '888' });
      });
      expect(result.current.scenarioClasses['class1'].room).toBe('888');
    });
  });
});
