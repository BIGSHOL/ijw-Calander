/**
 * Tests for useEnglishClassUpdater hook
 *
 * This hook manages English class schedule updates with:
 * - Dual mode: Scenario mode (in-memory) and Realtime mode (Firestore)
 * - Cell-based schedule management
 * - Merged classes (합반) support
 * - Batch updates
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEnglishClassUpdater } from '../../hooks/useEnglishClassUpdater';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Mock SimulationContext
const mockScenario = {
  isScenarioMode: false,
  scenarioClasses: {} as Record<string, any>,
  updateScenarioClass: vi.fn(),
};

vi.mock('../../components/Timetable/English/context/SimulationContext', () => ({
  useScenarioOptional: () => mockScenario,
}));

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';

describe('useEnglishClassUpdater', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  const createMockDocSnap = (id: string, data: any) => ({
    id,
    data: () => data,
    exists: () => true,
    ref: { id },
  });

  const createMockQuerySnapshot = (docs: any[]) => ({
    docs,
    empty: docs.length === 0,
    size: docs.length,
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset mocks
    vi.clearAllMocks();

    // Reset scenario mock
    mockScenario.isScenarioMode = false;
    mockScenario.scenarioClasses = {};
    mockScenario.updateScenarioClass = vi.fn();

    // Default mock implementations
    vi.mocked(collection).mockReturnValue({} as any);
    vi.mocked(doc).mockReturnValue({} as any);
    vi.mocked(query).mockReturnValue({} as any);
    vi.mocked(where).mockReturnValue({} as any);
    vi.mocked(updateDoc).mockResolvedValue();
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-id' } as any);
    vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));
  });

  describe('parseCellKey', () => {
    it('유효한 키를 올바르게 파싱한다', () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      const parsed = result.current.parseCellKey('teacher1-period1-mon');

      expect(parsed).toEqual({
        teacher: 'teacher1',
        periodId: 'period1',
        day: 'mon',
      });
    });

    it('하이픈이 3개 미만인 경우 null을 반환한다', () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      const parsed = result.current.parseCellKey('teacher1-period1');

      expect(parsed).toBeNull();
    });

    it('하이픈이 3개를 초과하는 경우 null을 반환한다', () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      const parsed = result.current.parseCellKey('teacher1-period1-mon-extra');

      expect(parsed).toBeNull();
    });

    it('빈 문자열인 경우 null을 반환한다', () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      const parsed = result.current.parseCellKey('');

      expect(parsed).toBeNull();
    });
  });

  describe('assignCellToClass - Realtime Mode', () => {
    it('새 수업을 생성한다 (기존 수업이 없는 경우)', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          className: 'Class-A',
          teacher: 'teacher1',
          subject: 'english',
          room: 'Room-101',
          isActive: true,
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-101' },
          slotTeachers: { 'mon-period1': 'teacher1' },
          studentIds: [],
        })
      );
    });

    it('기존 수업의 스케줄에 새 슬롯을 추가한다', async () => {
      const existingClass = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        subject: 'english',
        schedule: [{ day: 'tue', periodId: 'period2' }],
        slotRooms: { 'tue-period2': 'Room-102' },
        slotTeachers: { 'tue-period2': 'teacher1' },
      });

      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([existingClass])
      );

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          schedule: [
            { day: 'tue', periodId: 'period2' },
            { day: 'mon', periodId: 'period1' },
          ],
          slotRooms: {
            'tue-period2': 'Room-102',
            'mon-period1': 'Room-101',
          },
          slotTeachers: {
            'tue-period2': 'teacher1',
            'mon-period1': 'teacher1',
          },
        })
      );
    });

    it('이미 존재하는 슬롯은 중복 추가하지 않는다', async () => {
      const existingClass = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        subject: 'english',
        schedule: [{ day: 'mon', periodId: 'period1' }],
        slotRooms: { 'mon-period1': 'Room-101' },
        slotTeachers: { 'mon-period1': 'teacher1' },
      });

      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([existingClass])
      );

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      // schedule 필드가 업데이트 객체에 포함되지 않아야 함
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      const updateData = updateCall[1] as any;
      expect(updateData.schedule).toBeUndefined();
    });

    it('합반 수업을 처리한다', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([])) // findClassesAtSlot
        .mockResolvedValueOnce(createMockQuerySnapshot([])) // findClassByNameAndTeacher for main
        .mockResolvedValueOnce(createMockQuerySnapshot([])) // findClassByNameAndTeacher for merged1
        .mockResolvedValueOnce(createMockQuerySnapshot([])); // findClassByNameAndTeacher for merged2

      vi.mocked(addDoc)
        .mockResolvedValueOnce({ id: 'main-class-id' } as any)
        .mockResolvedValueOnce({ id: 'merged-class-id-1' } as any)
        .mockResolvedValueOnce({ id: 'merged-class-id-2' } as any);

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
          merged: [
            { className: 'Class-B', room: 'Room-102' },
            { className: 'Class-C', room: 'Room-103' },
          ],
        });
      });

      // Main class created with group leader
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          className: 'Class-A',
          classGroupId: 'group_teacher1-period1-mon',
          isGroupLeader: true,
        })
      );

      // Merged classes created with group member
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          className: 'Class-B',
          classGroupId: 'group_teacher1-period1-mon',
          isGroupLeader: false,
        })
      );

      // Group members updated on main class
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          groupMembers: ['merged-class-id-1', 'merged-class-id-2'],
        })
      );
    });

    it('underline 속성을 슬롯별로 저장한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
          underline: true,
        });
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slotUnderlines: { 'mon-period1': true },
        })
      );
    });

    it('잘못된 cellKey에 대해 early return 한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('invalid-key', {
          className: 'Class-A',
          room: 'Room-101',
        });
      });

      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('className이 없으면 early return 한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          room: 'Room-101',
        });
      });

      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('queryClient.invalidateQueries를 호출한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classes'] });
    });

    it('기존 슬롯의 수업 중 새 목록에 없는 수업을 제거한다', async () => {
      const existingClass = createMockDocSnap('old-class-id', {
        className: 'Old-Class',
        teacher: 'teacher1',
        subject: 'english',
        schedule: [{ day: 'mon', periodId: 'period1' }],
        slotRooms: { 'mon-period1': 'Room-100' },
        slotTeachers: { 'mon-period1': 'teacher1' },
      });

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([existingClass])) // findClassesAtSlot
        .mockResolvedValueOnce(createMockQuerySnapshot([])); // findClassByNameAndTeacher for new class

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'New-Class',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      // Old class should be deactivated (schedule becomes empty)
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          schedule: [],
        })
      );
    });
  });

  describe('removeCellFromClass - Realtime Mode', () => {
    it('수업의 스케줄에서 슬롯을 제거한다', async () => {
      const existingClass = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        subject: 'english',
        schedule: [
          { day: 'mon', periodId: 'period1' },
          { day: 'tue', periodId: 'period2' },
        ],
        slotRooms: { 'mon-period1': 'Room-101', 'tue-period2': 'Room-102' },
        slotTeachers: { 'mon-period1': 'teacher1', 'tue-period2': 'teacher1' },
      });

      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([existingClass])
      );

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeCellFromClass('teacher1-period1-mon', 'Class-A');
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          schedule: [{ day: 'tue', periodId: 'period2' }],
          slotRooms: { 'tue-period2': 'Room-102' },
          slotTeachers: { 'tue-period2': 'teacher1' },
        })
      );
    });

    it('마지막 슬롯 제거 시 수업을 비활성화한다', async () => {
      const existingClass = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        subject: 'english',
        schedule: [{ day: 'mon', periodId: 'period1' }],
        slotRooms: { 'mon-period1': 'Room-101' },
        slotTeachers: { 'mon-period1': 'teacher1' },
      });

      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([existingClass])
      );

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeCellFromClass('teacher1-period1-mon', 'Class-A');
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          schedule: [],
          slotRooms: {},
          slotTeachers: {},
          slotUnderlines: {},
          classGroupId: null,
          isGroupLeader: null,
          groupMembers: null,
        })
      );
    });

    it('그룹 리더 제거 시 그룹 멤버들도 제거한다', async () => {
      const leaderClass = createMockDocSnap('leader-id', {
        className: 'Class-A',
        teacher: 'teacher1',
        subject: 'english',
        schedule: [{ day: 'mon', periodId: 'period1' }],
        slotRooms: { 'mon-period1': 'Room-101' },
        slotTeachers: { 'mon-period1': 'teacher1' },
        classGroupId: 'group-123',
        isGroupLeader: true,
      });

      const memberClass1 = createMockDocSnap('member-id-1', {
        className: 'Class-B',
        teacher: 'teacher1',
        subject: 'english',
        schedule: [{ day: 'mon', periodId: 'period1' }],
        slotRooms: { 'mon-period1': 'Room-102' },
        slotTeachers: { 'mon-period1': 'teacher1' },
        classGroupId: 'group-123',
        isGroupLeader: false,
      });

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([leaderClass])) // findClassByNameAndTeacher
        .mockResolvedValueOnce(createMockQuerySnapshot([leaderClass, memberClass1])); // findClassesByGroupId

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeCellFromClass('teacher1-period1-mon', 'Class-A');
      });

      // Both leader and member should be updated
      expect(updateDoc).toHaveBeenCalledTimes(2);
    });

    it('잘못된 cellKey에 대해 early return 한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeCellFromClass('invalid-key', 'Class-A');
      });

      expect(getDocs).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('수업이 존재하지 않으면 early return 한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeCellFromClass('teacher1-period1-mon', 'Class-A');
      });

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('queryClient.invalidateQueries를 호출한다', async () => {
      const existingClass = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([existingClass])
      );

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeCellFromClass('teacher1-period1-mon', 'Class-A');
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classes'] });
    });
  });

  describe('removeAllClassesFromCell - Realtime Mode', () => {
    it('슬롯의 모든 수업을 제거한다', async () => {
      const class1 = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
        slotRooms: { 'mon-period1': 'Room-101' },
        slotTeachers: { 'mon-period1': 'teacher1' },
      });

      const class2 = createMockDocSnap('class-id-2', {
        className: 'Class-B',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
        slotRooms: { 'mon-period1': 'Room-102' },
        slotTeachers: { 'mon-period1': 'teacher1' },
      });

      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([class1, class2])
      );

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeAllClassesFromCell('teacher1-period1-mon');
      });

      // Both classes should be deactivated
      expect(updateDoc).toHaveBeenCalledTimes(2);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          schedule: [],
        })
      );
    });

    it('잘못된 cellKey에 대해 early return 한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeAllClassesFromCell('invalid-key');
      });

      expect(getDocs).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('슬롯에 수업이 없으면 아무 작업도 하지 않는다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeAllClassesFromCell('teacher1-period1-mon');
      });

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('queryClient.invalidateQueries를 호출한다', async () => {
      const existingClass = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([existingClass])
      );

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeAllClassesFromCell('teacher1-period1-mon');
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classes'] });
    });
  });

  describe('batchUpdateCells', () => {
    it('여러 셀을 일괄 업데이트한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.batchUpdateCells([
          {
            key: 'teacher1-period1-mon',
            data: { className: 'Class-A', room: 'Room-101' },
          },
          {
            key: 'teacher1-period2-tue',
            data: { className: 'Class-B', room: 'Room-102' },
          },
        ]);
      });

      expect(addDoc).toHaveBeenCalledTimes(2);
    });

    it('null data인 경우 currentScheduleData를 사용하여 삭제한다', async () => {
      const existingClass = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([existingClass])
      );

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      const currentScheduleData = {
        'teacher1-period1-mon': { className: 'Class-A', room: 'Room-101' },
      };

      await act(async () => {
        await result.current.batchUpdateCells(
          [{ key: 'teacher1-period1-mon', data: null }],
          currentScheduleData
        );
      });

      expect(updateDoc).toHaveBeenCalled();
    });

    it('null data이지만 currentScheduleData가 없으면 스킵한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.batchUpdateCells([
          { key: 'teacher1-period1-mon', data: null },
        ]);
      });

      expect(getDocs).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('className이 없는 data는 스킵한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.batchUpdateCells([
          { key: 'teacher1-period1-mon', data: { room: 'Room-101' } },
        ]);
      });

      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('moveClass', () => {
    it('수업을 소스에서 타겟으로 이동한다', async () => {
      const sourceClass = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
        slotRooms: { 'mon-period1': 'Room-101' },
        slotTeachers: { 'mon-period1': 'teacher1' },
      });

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([sourceClass])) // removeCellFromClass
        .mockResolvedValueOnce(createMockQuerySnapshot([])) // assignCellToClass - findClassesAtSlot
        .mockResolvedValueOnce(createMockQuerySnapshot([sourceClass])); // assignCellToClass - findClassByNameAndTeacher

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveClass(
          'teacher1-period1-mon',
          'teacher2-period2-tue',
          'Class-A',
          'Room-102'
        );
      });

      // Should remove from source
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          schedule: [],
        })
      );

      // Should add to target
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          schedule: [
            { day: 'mon', periodId: 'period1' },
            { day: 'tue', periodId: 'period2' },
          ],
        })
      );
    });

    it('합반 수업과 함께 이동한다', async () => {
      const sourceClass = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([sourceClass])) // removeCellFromClass
        .mockResolvedValueOnce(createMockQuerySnapshot([])) // assignCellToClass
        .mockResolvedValueOnce(createMockQuerySnapshot([sourceClass]))
        .mockResolvedValueOnce(createMockQuerySnapshot([]))
        .mockResolvedValueOnce(createMockQuerySnapshot([]));

      vi.mocked(addDoc)
        .mockResolvedValueOnce({ id: 'main-id' } as any)
        .mockResolvedValueOnce({ id: 'merged-id' } as any);

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveClass(
          'teacher1-period1-mon',
          'teacher2-period2-tue',
          'Class-A',
          'Room-102',
          [{ className: 'Class-B', room: 'Room-103' }]
        );
      });

      // Should create merged classes at target
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          className: 'Class-B',
          classGroupId: 'group_teacher2-period2-tue',
          isGroupLeader: false,
        })
      );
    });

    it('잘못된 소스 키에 대해 early return 한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveClass(
          'invalid-key',
          'teacher2-period2-tue',
          'Class-A'
        );
      });

      expect(getDocs).not.toHaveBeenCalled();
    });

    it('잘못된 타겟 키에 대해 early return 한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveClass(
          'teacher1-period1-mon',
          'invalid-key',
          'Class-A'
        );
      });

      expect(getDocs).not.toHaveBeenCalled();
    });
  });

  describe('moveSelectedClasses - Realtime Mode', () => {
    it('선택된 수업들을 타겟으로 이동한다', async () => {
      const class1 = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      const class2 = createMockDocSnap('class-id-2', {
        className: 'Class-B',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([class1])) // findClassByNameAndTeacher for Class-A
        .mockResolvedValueOnce(createMockQuerySnapshot([class2])) // findClassByNameAndTeacher for Class-B
        .mockResolvedValueOnce(createMockQuerySnapshot([])) // assignCellToClass - findClassesAtSlot
        .mockResolvedValueOnce(createMockQuerySnapshot([class1]))
        .mockResolvedValueOnce(createMockQuerySnapshot([class2]));

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveSelectedClasses(
          'teacher1-period1-mon',
          'teacher2-period2-tue',
          [
            { className: 'Class-A', room: 'Room-101' },
            { className: 'Class-B', room: 'Room-102' },
          ],
          []
        );
      });

      // Should remove from source
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          schedule: [],
        })
      );
    });

    it('소스에 남은 수업들의 그룹 관계를 재구성한다 (복수)', async () => {
      const class1 = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      const class2 = createMockDocSnap('class-id-2', {
        className: 'Class-B',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      const class3 = createMockDocSnap('class-id-3', {
        className: 'Class-C',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([class1])) // findClassByNameAndTeacher for moving Class-A
        .mockResolvedValueOnce(createMockQuerySnapshot([])) // assignCellToClass
        .mockResolvedValueOnce(createMockQuerySnapshot([class1]))
        .mockResolvedValueOnce(createMockQuerySnapshot([class2])) // findClassByNameAndTeacher for keeping Class-B
        .mockResolvedValueOnce(createMockQuerySnapshot([class3])); // findClassByNameAndTeacher for keeping Class-C

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveSelectedClasses(
          'teacher1-period1-mon',
          'teacher2-period2-tue',
          [{ className: 'Class-A', room: 'Room-101' }],
          [
            { className: 'Class-B', room: 'Room-102' },
            { className: 'Class-C', room: 'Room-103' },
          ]
        );
      });

      // Should update Class-B as group leader
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          classGroupId: 'group_teacher1-period1-mon',
          isGroupLeader: true,
          groupMembers: ['Class-C'],
        })
      );

      // Should update Class-C as group member
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          classGroupId: 'group_teacher1-period1-mon',
          isGroupLeader: false,
        })
      );
    });

    it('소스에 남은 수업이 1개면 그룹 정보를 제거한다', async () => {
      const class1 = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      const class2 = createMockDocSnap('class-id-2', {
        className: 'Class-B',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([class1])) // moving Class-A
        .mockResolvedValueOnce(createMockQuerySnapshot([]))
        .mockResolvedValueOnce(createMockQuerySnapshot([class1]))
        .mockResolvedValueOnce(createMockQuerySnapshot([class2])); // keeping Class-B

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveSelectedClasses(
          'teacher1-period1-mon',
          'teacher2-period2-tue',
          [{ className: 'Class-A', room: 'Room-101' }],
          [{ className: 'Class-B', room: 'Room-102' }]
        );
      });

      // Should remove group info from Class-B
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          classGroupId: null,
          isGroupLeader: null,
          groupMembers: null,
        })
      );
    });

    it('잘못된 소스 키에 대해 early return 한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveSelectedClasses(
          'invalid-key',
          'teacher2-period2-tue',
          [{ className: 'Class-A', room: 'Room-101' }],
          []
        );
      });

      expect(getDocs).not.toHaveBeenCalled();
    });

    it('queryClient.invalidateQueries를 호출한다', async () => {
      const class1 = createMockDocSnap('class-id-1', {
        className: 'Class-A',
        teacher: 'teacher1',
        schedule: [{ day: 'mon', periodId: 'period1' }],
      });

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([class1]))
        .mockResolvedValueOnce(createMockQuerySnapshot([]))
        .mockResolvedValueOnce(createMockQuerySnapshot([class1]));

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveSelectedClasses(
          'teacher1-period1-mon',
          'teacher2-period2-tue',
          [{ className: 'Class-A', room: 'Room-101' }],
          []
        );
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classes'] });
    });
  });

  describe('Scenario Mode - assignCellToClass', () => {
    beforeEach(() => {
      mockScenario.isScenarioMode = true;
      mockScenario.scenarioClasses = {};
    });

    it('시나리오 모드에서 새 수업을 생성한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        expect.stringContaining('draft_'),
        expect.objectContaining({
          className: 'Class-A',
          teacher: 'teacher1',
          subject: 'english',
          room: 'Room-101',
          isActive: true,
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-101' },
          slotTeachers: { 'mon-period1': 'teacher1' },
        })
      );
    });

    it('시나리오 모드에서 기존 수업을 업데이트한다', async () => {
      mockScenario.scenarioClasses = {
        'existing-id': {
          className: 'Class-A',
          teacher: 'teacher1',
          subject: 'english',
          schedule: [{ day: 'tue', periodId: 'period2' }],
          slotRooms: { 'tue-period2': 'Room-102' },
          slotTeachers: { 'tue-period2': 'teacher1' },
          isActive: true,
        },
      };

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'existing-id',
        expect.objectContaining({
          schedule: [
            { day: 'tue', periodId: 'period2' },
            { day: 'mon', periodId: 'period1' },
          ],
        })
      );
    });

    it('시나리오 모드에서 합반 수업을 처리한다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
          merged: [{ className: 'Class-B', room: 'Room-102' }],
        });
      });

      // Main class
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          className: 'Class-A',
          classGroupId: 'group_teacher1-period1-mon',
          isGroupLeader: true,
        })
      );

      // Merged class
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          className: 'Class-B',
          classGroupId: 'group_teacher1-period1-mon',
          isGroupLeader: false,
        })
      );
    });

    it('시나리오 모드에서 기존 슬롯의 다른 수업을 제거한다', async () => {
      mockScenario.scenarioClasses = {
        'old-class-id': {
          className: 'Old-Class',
          teacher: 'teacher1',
          subject: 'english',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-100' },
          slotTeachers: { 'mon-period1': 'teacher1' },
          isActive: true,
        },
      };

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'New-Class',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      // Old class should be deactivated
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'old-class-id',
        expect.objectContaining({
          isActive: false,
          schedule: [],
        })
      );
    });

    it('시나리오 모드에서는 Firestore를 호출하지 않는다', async () => {
      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      expect(getDocs).not.toHaveBeenCalled();
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('Scenario Mode - removeCellFromClass', () => {
    beforeEach(() => {
      mockScenario.isScenarioMode = true;
    });

    it('시나리오 모드에서 슬롯을 제거한다', async () => {
      mockScenario.scenarioClasses = {
        'class-id-1': {
          className: 'Class-A',
          teacher: 'teacher1',
          schedule: [
            { day: 'mon', periodId: 'period1' },
            { day: 'tue', periodId: 'period2' },
          ],
          slotRooms: { 'mon-period1': 'Room-101', 'tue-period2': 'Room-102' },
          slotTeachers: { 'mon-period1': 'teacher1', 'tue-period2': 'teacher1' },
          isActive: true,
        },
      };

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeCellFromClass('teacher1-period1-mon', 'Class-A');
      });

      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'class-id-1',
        expect.objectContaining({
          schedule: [{ day: 'tue', periodId: 'period2' }],
          slotRooms: { 'tue-period2': 'Room-102' },
        })
      );
    });

    it('시나리오 모드에서 마지막 슬롯 제거 시 수업을 비활성화한다', async () => {
      mockScenario.scenarioClasses = {
        'class-id-1': {
          className: 'Class-A',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-101' },
          slotTeachers: { 'mon-period1': 'teacher1' },
          isActive: true,
        },
      };

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeCellFromClass('teacher1-period1-mon', 'Class-A');
      });

      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'class-id-1',
        expect.objectContaining({
          isActive: false,
          schedule: [],
          classGroupId: null,
          isGroupLeader: null,
          groupMembers: null,
        })
      );
    });

    it('시나리오 모드에서 그룹 멤버들도 함께 제거한다', async () => {
      mockScenario.scenarioClasses = {
        'leader-id': {
          className: 'Class-A',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-101' },
          slotTeachers: { 'mon-period1': 'teacher1' },
          classGroupId: 'group-123',
          isGroupLeader: true,
          isActive: true,
        },
        'member-id': {
          className: 'Class-B',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-102' },
          slotTeachers: { 'mon-period1': 'teacher1' },
          classGroupId: 'group-123',
          isGroupLeader: false,
          isActive: true,
        },
      };

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeCellFromClass('teacher1-period1-mon', 'Class-A');
      });

      // Both should be updated
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scenario Mode - removeAllClassesFromCell', () => {
    beforeEach(() => {
      mockScenario.isScenarioMode = true;
    });

    it('시나리오 모드에서 슬롯의 모든 수업을 제거한다', async () => {
      mockScenario.scenarioClasses = {
        'class-id-1': {
          className: 'Class-A',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-101' },
          slotTeachers: { 'mon-period1': 'teacher1' },
          isActive: true,
        },
        'class-id-2': {
          className: 'Class-B',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-102' },
          slotTeachers: { 'mon-period1': 'teacher1' },
          isActive: true,
        },
      };

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.removeAllClassesFromCell('teacher1-period1-mon');
      });

      expect(mockScenario.updateScenarioClass).toHaveBeenCalledTimes(2);
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'class-id-1',
        expect.objectContaining({
          isActive: false,
          schedule: [],
        })
      );
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'class-id-2',
        expect.objectContaining({
          isActive: false,
          schedule: [],
        })
      );
    });
  });

  describe('Scenario Mode - moveSelectedClasses', () => {
    beforeEach(() => {
      mockScenario.isScenarioMode = true;
    });

    it('시나리오 모드에서 선택된 수업들을 이동한다', async () => {
      mockScenario.scenarioClasses = {
        'class-id-1': {
          className: 'Class-A',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-101' },
          slotTeachers: { 'mon-period1': 'teacher1' },
          isActive: true,
        },
        'class-id-2': {
          className: 'Class-B',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          slotRooms: { 'mon-period1': 'Room-102' },
          slotTeachers: { 'mon-period1': 'teacher1' },
          isActive: true,
        },
      };

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveSelectedClasses(
          'teacher1-period1-mon',
          'teacher2-period2-tue',
          [{ className: 'Class-A', room: 'Room-101' }],
          [{ className: 'Class-B', room: 'Room-102' }]
        );
      });

      // Class-A should be removed from source
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'class-id-1',
        expect.objectContaining({
          isActive: false,
          schedule: [],
        })
      );

      // Class-B should have group info removed (single class remaining)
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'class-id-2',
        expect.objectContaining({
          classGroupId: null,
          isGroupLeader: null,
          groupMembers: null,
        })
      );
    });

    it('시나리오 모드에서 남은 수업이 복수면 그룹을 재구성한다', async () => {
      mockScenario.scenarioClasses = {
        'class-id-1': {
          className: 'Class-A',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          isActive: true,
        },
        'class-id-2': {
          className: 'Class-B',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          isActive: true,
        },
        'class-id-3': {
          className: 'Class-C',
          teacher: 'teacher1',
          schedule: [{ day: 'mon', periodId: 'period1' }],
          isActive: true,
        },
      };

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveSelectedClasses(
          'teacher1-period1-mon',
          'teacher2-period2-tue',
          [{ className: 'Class-A', room: 'Room-101' }],
          [
            { className: 'Class-B', room: 'Room-102' },
            { className: 'Class-C', room: 'Room-103' },
          ]
        );
      });

      // Class-B should be group leader
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'class-id-2',
        expect.objectContaining({
          classGroupId: 'group_teacher1-period1-mon',
          isGroupLeader: true,
          groupMembers: ['Class-C'],
        })
      );

      // Class-C should be group member
      expect(mockScenario.updateScenarioClass).toHaveBeenCalledWith(
        'class-id-3',
        expect.objectContaining({
          classGroupId: 'group_teacher1-period1-mon',
          isGroupLeader: false,
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('슬롯에 대한 slotTeachers 매핑을 올바르게 처리한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slotTeachers: { 'mon-period1': 'teacher1' },
        })
      );
    });

    it('underline 속성을 합반 수업에도 적용한다', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]))
        .mockResolvedValueOnce(createMockQuerySnapshot([]))
        .mockResolvedValueOnce(createMockQuerySnapshot([]));

      vi.mocked(addDoc)
        .mockResolvedValueOnce({ id: 'main-id' } as any)
        .mockResolvedValueOnce({ id: 'merged-id' } as any);

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
          underline: true,
          merged: [
            { className: 'Class-B', room: 'Room-102', underline: false },
          ],
        });
      });

      // Main class
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slotUnderlines: { 'mon-period1': true },
        })
      );

      // Merged class
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slotUnderlines: { 'mon-period1': false },
        })
      );
    });

    it('시나리오가 없으면 실시간 모드로 동작한다', async () => {
      // Default mockScenario has isScenarioMode: false, simulating non-scenario mode
      // This verifies Firestore calls happen instead of scenario updates
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
        });
      });

      expect(addDoc).toHaveBeenCalled();
      expect(mockScenario.updateScenarioClass).not.toHaveBeenCalled();
    });

    it('빈 merged 배열은 합반으로 처리하지 않는다', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]))
        .mockResolvedValueOnce(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useEnglishClassUpdater(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.assignCellToClass('teacher1-period1-mon', {
          className: 'Class-A',
          room: 'Room-101',
          teacher: 'teacher1',
          merged: [],
        });
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({
          classGroupId: expect.anything(),
        })
      );
    });
  });
});
