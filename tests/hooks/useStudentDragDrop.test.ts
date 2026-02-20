import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStudentDragDrop, PendingMove, DragZone } from '../../components/Timetable/Math/hooks/useStudentDragDrop';
import { TimetableClass, TimetableStudent } from '../../types';

// Mock Firebase
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockWriteBatch = vi.fn(() => ({
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));
const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: any[]) => ({ __path: args.slice(1).join('/') })),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

// Helper: 테스트용 클래스 생성
const makeClass = (id: string, className: string, students: Partial<TimetableStudent>[] = []): TimetableClass => ({
  id,
  className,
  subject: 'math',
  studentIds: students.map(s => s.id!),
  studentList: students.map(s => ({ id: s.id!, name: s.name || '', ...s } as TimetableStudent)),
  schedule: [],
  days: [],
});

// Helper: DragEvent 모킹
const makeDragEvent = (): React.DragEvent => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  dataTransfer: { effectAllowed: '' },
} as any);

let queryClient: QueryClient;
const createWrapper = () => ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe('useStudentDragDrop', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
  });

  const classA = makeClass('clsA', '수학A', [
    { id: 's1', name: '김학생', enrollmentDocId: 'math_수학A' },
    { id: 's2', name: '이학생', enrollmentDocId: 'math_수학A' },
  ]);
  const classB = makeClass('clsB', '수학B', [
    { id: 's3', name: '박학생' },
  ]);
  const initialClasses = [classA, classB];

  describe('초기 상태', () => {
    it('pendingMoves가 없으면 initialClasses를 반환한다', () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });
      expect(result.current.localClasses).toBe(initialClasses);
      expect(result.current.pendingMoves).toHaveLength(0);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.draggingStudent).toBeNull();
      expect(result.current.dragOverClassId).toBeNull();
    });
  });

  describe('handleDragStart', () => {
    it('드래그 시작 시 draggingStudent를 설정한다', () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });
      const e = makeDragEvent();

      act(() => { result.current.handleDragStart(e, 's1', 'clsA', 'common'); });

      expect(result.current.draggingStudent).toEqual({
        studentId: 's1', fromClassId: 'clsA', fromZone: 'common'
      });
      expect(e.dataTransfer.effectAllowed).toBe('move');
    });

    it('zone 미지정 시 기본값 common', () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });
      const e = makeDragEvent();

      act(() => { result.current.handleDragStart(e, 's1', 'clsA'); });

      expect(result.current.draggingStudent?.fromZone).toBe('common');
    });
  });

  describe('handleDragOver / handleDragLeave', () => {
    it('dragOver 시 dragOverClassId를 설정한다', () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });
      const e = makeDragEvent();

      act(() => { result.current.handleDragOver(e, 'clsB'); });
      expect(result.current.dragOverClassId).toBe('clsB');
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('dragLeave 시 dragOverClassId를 null로 설정한다', () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragOver(makeDragEvent(), 'clsB'); });
      act(() => { result.current.handleDragLeave(); });
      expect(result.current.dragOverClassId).toBeNull();
    });
  });

  describe('handleDrop - 같은 반 같은 zone', () => {
    it('같은 반 + 같은 zone이면 무시한다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsA', 'common'); });

      expect(result.current.pendingMoves).toHaveLength(0);
      expect(result.current.draggingStudent).toBeNull();
    });
  });

  describe('handleDrop - 같은 반 다른 zone', () => {
    it('같은 반 내 zone 이동 시 attendanceDays를 변경한다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsA', '월'); });

      expect(result.current.pendingMoves).toHaveLength(1);
      const move = result.current.pendingMoves[0];
      expect(move.fromClassId).toBe('clsA');
      expect(move.toClassId).toBe('clsA');
      expect(move.fromZone).toBe('common');
      expect(move.toZone).toBe('월');
    });
  });

  describe('handleDrop - 다른 반으로 이동', () => {
    it('다른 반으로 드롭 시 학생이 이동된다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      expect(result.current.pendingMoves).toHaveLength(1);
      expect(result.current.pendingMoves[0].fromClassId).toBe('clsA');
      expect(result.current.pendingMoves[0].toClassId).toBe('clsB');

      // optimistic UI: 학생이 clsA에서 사라지고 clsB에 추가됨
      const localA = result.current.localClasses.find(c => c.id === 'clsA');
      const localB = result.current.localClasses.find(c => c.id === 'clsB');
      expect(localA?.studentIds).not.toContain('s1');
      expect(localB?.studentIds).toContain('s1');
    });

    it('특정 zone으로 드롭 시 attendanceDays가 설정된다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', '목'); });

      const localB = result.current.localClasses.find(c => c.id === 'clsB');
      const movedStudent = localB?.studentList?.find(s => s.id === 's1');
      expect(movedStudent?.attendanceDays).toEqual(['목']);
    });
  });

  describe('updatePendingMoveDate', () => {
    it('특정 학생의 scheduledDate를 업데이트한다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      // 다른 반으로 이동 → pendingMove 생성
      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      expect(result.current.pendingMoves[0].scheduledDate).toBeUndefined();

      // scheduledDate 설정
      act(() => { result.current.updatePendingMoveDate('s1', '2026-03-01'); });
      expect(result.current.pendingMoves[0].scheduledDate).toBe('2026-03-01');
    });

    it('scheduledDate를 undefined로 되돌릴 수 있다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      act(() => { result.current.updatePendingMoveDate('s1', '2026-03-01'); });
      act(() => { result.current.updatePendingMoveDate('s1', undefined); });

      expect(result.current.pendingMoves[0].scheduledDate).toBeUndefined();
    });

    it('다른 학생의 move에는 영향을 주지 않는다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      // 두 학생 이동
      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });
      act(() => { result.current.handleDragStart(makeDragEvent(), 's2', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      act(() => { result.current.updatePendingMoveDate('s1', '2026-03-15'); });

      expect(result.current.pendingMoves.find(m => m.studentId === 's1')?.scheduledDate).toBe('2026-03-15');
      expect(result.current.pendingMoves.find(m => m.studentId === 's2')?.scheduledDate).toBeUndefined();
    });
  });

  describe('handleCancelPendingMoves', () => {
    it('모든 pending moves를 초기화한다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      expect(result.current.pendingMoves).toHaveLength(1);

      act(() => { result.current.handleCancelPendingMoves(); });
      expect(result.current.pendingMoves).toHaveLength(0);
      // 취소 후 initialClasses로 복원
      expect(result.current.localClasses).toBe(initialClasses);
    });
  });

  describe('handleSavePendingMoves', () => {
    it('pendingMoves가 없으면 아무것도 하지 않는다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      await act(async () => { await result.current.handleSavePendingMoves(); });

      expect(mockWriteBatch).not.toHaveBeenCalled();
    });

    it('같은 반 zone 이동을 저장한다 (attendanceDays만 업데이트)', async () => {
      // getDoc은 모든 finalMoves에 대해 호출됨 (zone 이동 포함)
      mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      // zone 이동
      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsA', '월'); });

      await act(async () => { await result.current.handleSavePendingMoves(); });

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ attendanceDays: ['월'] }),
        { merge: true }
      );
      expect(mockBatchCommit).toHaveBeenCalled();
      expect(result.current.pendingMoves).toHaveLength(0);
    });

    it('다른 반 이동 시 scheduledDate가 없으면 오늘 날짜를 사용한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ className: '수학A', subject: 'math', enrollmentDate: '2025-01-01' }),
      });

      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      await act(async () => { await result.current.handleSavePendingMoves(); });

      // endDate, withdrawalDate에 오늘 날짜가 사용되어야 함
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          withdrawalDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      );
      // 새 enrollment 생성 (endDate/withdrawalDate 제외)
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          className: '수학B',
          enrollmentDate: '2025-01-01',
        })
      );
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('다른 반 이동 시 scheduledDate가 있으면 예정일을 사용한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ className: '수학A', subject: 'math', enrollmentDate: '2025-01-01' }),
      });

      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      // 예정일 설정
      act(() => { result.current.updatePendingMoveDate('s1', '2026-04-01'); });

      await act(async () => { await result.current.handleSavePendingMoves(); });

      // effectiveDate = scheduledDate = '2026-04-01'
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          endDate: '2026-04-01',
          withdrawalDate: '2026-04-01',
        })
      );
    });

    it('A→B→A로 되돌아온 경우 이동을 무시한다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      // A → B
      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });
      // B → A (되돌아옴)
      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsB', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsA', 'common'); });

      await act(async () => { await result.current.handleSavePendingMoves(); });

      // 최종 이동이 없으므로 batch.commit 호출되지 않아야 함
      expect(mockBatchCommit).not.toHaveBeenCalled();
      expect(result.current.pendingMoves).toHaveLength(0);
    });

    it('A→B, B→C 체인 이동은 A→C로 압축된다', async () => {
      const classC = makeClass('clsC', '수학C', []);
      const threeClasses = [classA, classB, classC];

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ className: '수학A', subject: 'math', enrollmentDate: '2025-01-01' }),
      });

      const { result } = renderHook(() => useStudentDragDrop(threeClasses), { wrapper: createWrapper() });

      // A → B
      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });
      // B → C
      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsB', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsC', 'common'); });

      await act(async () => { await result.current.handleSavePendingMoves(); });

      // 새 enrollment은 수학C로 생성
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ className: '수학C' })
      );
    });

    it('enrollment 문서가 없는 경우 새 enrollment만 생성한다', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });

      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      await act(async () => { await result.current.handleSavePendingMoves(); });

      // update는 호출되지 않음 (기존 문서 없으므로)
      expect(mockBatchUpdate).not.toHaveBeenCalled();
      // 새 enrollment set 호출됨
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          className: '수학B',
          subject: 'math',
        })
      );
    });

    it('저장 실패 시 alert를 표시하고 isSaving을 false로 설정한다', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ className: '수학A' }) });
      mockBatchCommit.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      await act(async () => { await result.current.handleSavePendingMoves(); });

      expect(window.alert).toHaveBeenCalledWith('저장 실패');
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('effectiveClasses 동기화', () => {
    it('pendingMoves가 있으면 localClasses를 반환한다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });

      // pendingMoves가 있으므로 localClasses (optimistic) 사용
      expect(result.current.localClasses).not.toBe(initialClasses);
      expect(result.current.pendingMoves.length).toBeGreaterThan(0);
    });

    it('cancel 후 initialClasses로 복원된다', async () => {
      const { result } = renderHook(() => useStudentDragDrop(initialClasses), { wrapper: createWrapper() });

      act(() => { result.current.handleDragStart(makeDragEvent(), 's1', 'clsA', 'common'); });
      await act(async () => { await result.current.handleDrop(makeDragEvent(), 'clsB', 'common'); });
      act(() => { result.current.handleCancelPendingMoves(); });

      expect(result.current.localClasses).toBe(initialClasses);
    });
  });
});
