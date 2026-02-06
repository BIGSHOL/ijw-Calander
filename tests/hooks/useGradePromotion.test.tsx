import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGradePromotion } from '../../hooks/useGradePromotion';
import type { QuerySnapshot, DocumentSnapshot, WriteBatch } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Import mocked functions
import { collection, getDocs, writeBatch, doc, query, where } from 'firebase/firestore';

describe('useGradePromotion Hook', () => {
  let queryClient: QueryClient;
  let mockBatch: WriteBatch;
  let alertSpy: ReturnType<typeof vi.fn>;
  let confirmSpy: ReturnType<typeof vi.fn>;

  // Helper to create wrapper with QueryClientProvider
  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };

  // Helper to create mock DocumentSnapshot
  const createMockDocSnap = (id: string, data: any): Partial<DocumentSnapshot> => ({
    id,
    data: () => data,
    exists: () => true,
  });

  // Helper to create mock QuerySnapshot
  const createMockQuerySnapshot = (docs: Partial<DocumentSnapshot>[]): Partial<QuerySnapshot> => ({
    docs: docs as DocumentSnapshot[],
    empty: docs.length === 0,
    size: docs.length,
  });

  beforeEach(() => {
    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup mock batch
    mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
      set: vi.fn(),
      delete: vi.fn(),
    } as any;

    // Mock Firebase functions
    vi.mocked(collection).mockReturnValue({} as any);
    vi.mocked(query).mockReturnValue({} as any);
    vi.mocked(where).mockReturnValue({} as any);
    vi.mocked(doc).mockReturnValue({} as any);
    vi.mocked(writeBatch).mockReturnValue(mockBatch);

    // Mock window methods (happy-dom doesn't define alert/confirm)
    alertSpy = vi.fn();
    confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('alert', alertSpy);
    vi.stubGlobal('confirm', confirmSpy);
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('Basic Hook Behavior', () => {
    it('훅이 promoteGrades 함수와 isPromoting 상태를 반환한다', () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      expect(result.current.promoteGrades).toBeTypeOf('function');
      expect(result.current.isPromoting).toBe(false);
    });

    it('진급 대상 학생이 없을 때 alert를 표시한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      expect(alertSpy).toHaveBeenCalledWith('진급 대상 학생이 없습니다.');
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('사용자가 confirm 다이얼로그를 취소하면 진급을 진행하지 않는다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '초1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);
      confirmSpy.mockReturnValue(false);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockBatch.update).not.toHaveBeenCalled();
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });
  });

  describe('Grade Promotion Logic', () => {
    it('초1 학생을 초2로 진급시킨다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '초1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ grade: '초2' })
        );
      });

      expect(mockBatch.commit).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('1명 학년 진급 완료!');
    });

    it('초6 학생을 중1로 자동 전환한다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '초6', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ grade: '중1' })
        );
      });

      expect(alertSpy).toHaveBeenCalledWith(
        '1명 학년 진급 완료!\n(초6→중1: 1명)'
      );
    });

    it('중3 학생을 고1로 자동 전환한다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '중3', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ grade: '고1' })
        );
      });

      expect(alertSpy).toHaveBeenCalledWith(
        '1명 학년 진급 완료!\n(중3→고1: 1명)'
      );
    });

    it('고2 학생을 고3으로 진급시킨다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '고2', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ grade: '고3' })
        );
      });

      expect(alertSpy).toHaveBeenCalledWith('1명 학년 진급 완료!');
    });

    it('여러 학년의 학생들을 동시에 진급시킨다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '초1', status: 'active' }),
        createMockDocSnap('student2', { grade: '초6', status: 'active' }),
        createMockDocSnap('student3', { grade: '중1', status: 'active' }),
        createMockDocSnap('student4', { grade: '중3', status: 'active' }),
        createMockDocSnap('student5', { grade: '고1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledTimes(5);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        '5명 학년 진급 완료!\n(초6→중1: 1명, 중3→고1: 1명)'
      );
    });
  });

  describe('Edge Cases', () => {
    it('grade 필드가 없는 학생은 건너뛴다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { status: 'active' }), // no grade
        createMockDocSnap('student2', { grade: '초1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledTimes(1);
      });

      expect(alertSpy).toHaveBeenCalledWith('1명 학년 진급 완료!');
    });

    it('고3 학생은 진급 대상에서 제외된다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '고3', status: 'active' }),
        createMockDocSnap('student2', { grade: '초1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledTimes(1);
      });

      // Only 초1 student should be promoted
      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ grade: '초2' })
      );
    });

    it('진급 불가능한 학년(예: 미등록)은 건너뛴다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '미등록', status: 'active' }),
        createMockDocSnap('student2', { grade: '초1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledTimes(1);
      });
    });

    it('grade가 undefined인 학생은 건너뛴다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: undefined, status: 'active' }),
        createMockDocSnap('student2', { grade: '중2', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledTimes(1);
      });

      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ grade: '중3' })
      );
    });
  });

  describe('Batch Operations', () => {
    it('대량의 학생 진급 시 배치를 여러 번 커밋한다', async () => {
      // Create 900 students (should trigger 2 batches with batchSize=450)
      const mockDocs = Array.from({ length: 900 }, (_, i) =>
        createMockDocSnap(`student${i}`, { grade: '초1', status: 'active' })
      );
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        // First batch: 450 students, Second batch: 450 students
        expect(mockBatch.commit).toHaveBeenCalledTimes(2);
      });

      expect(mockBatch.update).toHaveBeenCalledTimes(900);
    });

    it('배치 크기 미만의 학생도 커밋된다', async () => {
      const mockDocs = Array.from({ length: 10 }, (_, i) =>
        createMockDocSnap(`student${i}`, { grade: '초1', status: 'active' })
      );
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.commit).toHaveBeenCalledTimes(1);
      });

      expect(mockBatch.update).toHaveBeenCalledTimes(10);
    });
  });

  describe('Error Handling', () => {
    it('진급 중 오류 발생 시 에러 alert를 표시한다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '초1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);
      mockBatch.commit.mockRejectedValueOnce(new Error('Firestore error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('학년 진급 중 오류가 발생했습니다.');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '학년 진급 실패:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('getDocs 실패 시 에러가 전파된다', async () => {
      vi.mocked(getDocs).mockRejectedValueOnce(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      // getDocs 에러는 promoteGrades의 try/catch 바깥에서 발생하므로 전파됨
      await act(async () => {
        await expect(result.current.promoteGrades()).rejects.toThrow('Network error');
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Loading State', () => {
    it('진급 중에는 isPromoting이 true가 된다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '초1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      let isPending = false;
      mockBatch.commit.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            isPending = false;
            resolve(undefined);
          }, 100);
        });
      });

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPromoting).toBe(false);

      act(() => {
        result.current.promoteGrades();
        isPending = true;
      });

      await waitFor(() => {
        if (isPending) {
          expect(result.current.isPromoting).toBe(true);
        }
      });

      await waitFor(() => {
        expect(result.current.isPromoting).toBe(false);
      }, { timeout: 3000 });
    });
  });

  describe('Confirm Dialog', () => {
    it('confirm 다이얼로그에 진급 대상 학생 수를 표시한다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '초1', status: 'active' }),
        createMockDocSnap('student2', { grade: '초2', status: 'active' }),
        createMockDocSnap('student3', { grade: '중1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('진급 대상: 3명')
      );
    });
  });

  describe('Query Invalidation', () => {
    it('진급 성공 후 students 쿼리를 무효화한다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '초1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['students'],
        });
      });
    });
  });

  describe('UpdatedAt Timestamp', () => {
    it('진급 시 updatedAt 필드를 업데이트한다', async () => {
      const mockDocs = [
        createMockDocSnap('student1', { grade: '초1', status: 'active' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useGradePromotion(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.promoteGrades();
      });

      await waitFor(() => {
        expect(mockBatch.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            grade: '초2',
            updatedAt: expect.any(String),
          })
        );
      });

      // Verify updatedAt is a valid ISO string
      const updateCall = vi.mocked(mockBatch.update).mock.calls[0];
      const updatedData = updateCall[1] as any;
      expect(new Date(updatedData.updatedAt).toISOString()).toBe(updatedData.updatedAt);
    });
  });
});
