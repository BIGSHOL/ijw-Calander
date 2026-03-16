import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useShuttleStudents, TIME_SLOTS, WEEKDAYS } from '../../hooks/useShuttleStudents';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import { collection, collectionGroup, query, where, getDocs } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
  limit: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

describe('useShuttleStudents Hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (collection as any).mockReturnValue({});
    (collectionGroup as any).mockReturnValue({});
    (query as any).mockImplementation((...args: any[]) => args[0]);
    (where as any).mockReturnValue({});
  });

  describe('초기 상태 (enabled=false)', () => {
    it('enabled가 false이면 쿼리가 실행되지 않는다', () => {
      // When: enabled=false로 훅이 렌더링되면
      const { result } = renderHook(() => useShuttleStudents(false), {
        wrapper: createWrapper(),
      });

      // Then: 데이터 조회가 실행되지 않는다
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(getDocs as any).not.toHaveBeenCalled();
    });

    it('기본값으로 enabled=false이다', () => {
      // When: enabled를 지정하지 않으면
      const { result } = renderHook(() => useShuttleStudents(), {
        wrapper: createWrapper(),
      });

      // Then: 쿼리가 비활성화된다
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('셔틀 학생이 없는 경우', () => {
    it('셔틀 등록 학생이 없으면 빈 scheduleMap을 반환한다', async () => {
      // Given: shuttle_students 컬렉션이 비어 있을 때
      (getDocs as any).mockResolvedValue({ docs: [] });

      // When: 훅이 enabled=true로 실행되면
      const { result } = renderHook(() => useShuttleStudents(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Then: 모든 요일/시간대가 빈 배열인 scheduleMap이 반환된다
      const data = result.current.data!;
      expect(data).toBeDefined();
      expect(data.shuttleNames).toHaveLength(0);
      WEEKDAYS.forEach(day => {
        TIME_SLOTS.forEach(slot => {
          expect(data.scheduleMap[day][slot]).toEqual([]);
        });
      });
    });

    it('syncedAt이 null을 반환한다', async () => {
      // Given: 동기화 데이터가 없을 때
      (getDocs as any).mockResolvedValue({ docs: [] });

      // When: 훅이 실행되면
      const { result } = renderHook(() => useShuttleStudents(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Then: syncedAt이 null이다
      expect(result.current.data!.syncedAt).toBeNull();
    });
  });

  describe('반환값 구조', () => {
    it('data에 scheduleMap, shuttleNames, syncedAt이 포함된다', async () => {
      // Given: 빈 컬렉션으로 설정하면
      (getDocs as any).mockResolvedValue({ docs: [] });

      // When: 훅이 실행되면
      const { result } = renderHook(() => useShuttleStudents(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Then: 반환값 구조가 올바르다
      expect(result.current.data).toHaveProperty('scheduleMap');
      expect(result.current.data).toHaveProperty('shuttleNames');
      expect(result.current.data).toHaveProperty('syncedAt');
    });
  });

  describe('상수 내보내기', () => {
    it('TIME_SLOTS는 [14, 16, 18, 20, 22]이다', () => {
      expect(TIME_SLOTS).toEqual([14, 16, 18, 20, 22]);
    });

    it('WEEKDAYS는 평일 5일을 포함한다', () => {
      expect(WEEKDAYS).toEqual(['월', '화', '수', '목', '금']);
    });
  });

  describe('에러 처리', () => {
    it('Firestore 조회 실패 시 isError가 true가 된다', async () => {
      // Given: getDocs가 실패하도록 설정하면
      (getDocs as any).mockRejectedValue(new Error('Firestore 오류'));

      // When: 훅이 실행되면
      const { result } = renderHook(() => useShuttleStudents(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Then: 에러 상태가 된다
      expect(result.current.isError).toBe(true);
    });
  });
});
