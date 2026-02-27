import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEdutrixSync } from '../../hooks/useEdutrixSync';
import { createTestQueryClient } from '../utils/testHelpers';

// Firebase Firestore 모킹
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'mock-doc-ref' })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteField: vi.fn(() => 'DELETE_FIELD_SENTINEL'),
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(),
  query: vi.fn((ref) => ref),
  where: vi.fn(),
}));

// Firebase 설정 모킹
vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Supabase 클라이언트 모킹
vi.mock('../../services/supabaseClient', () => ({
  fetchReportsByMonth: vi.fn(),
  mapReportToAttendanceValue: vi.fn(),
}));

import {
  getDocs,
  setDoc,
} from 'firebase/firestore';
import {
  fetchReportsByMonth,
  mapReportToAttendanceValue,
} from '../../services/supabaseClient';

const mockedGetDocs = vi.mocked(getDocs);
const mockedSetDoc = vi.mocked(setDoc);
const mockedFetchReportsByMonth = vi.mocked(fetchReportsByMonth);
const mockedMapReportToAttendanceValue = vi.mocked(mapReportToAttendanceValue);

// React Query wrapper 생성
const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

// 공통 mock 문서 생성 헬퍼
const makeMockDoc = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
  ref: { id },
});

// 빈 스냅샷 헬퍼
const emptySnap = () => ({ docs: [], size: 0 } as any);

describe('useEdutrixSync Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedSetDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('기본 초기화', () => {
    it('초기 상태가 올바르게 설정된다', () => {
      // Given: useEdutrixSync 훅이 호출되면
      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // Then: 모든 초기값이 올바르다
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.isResetting).toBe(false);
      expect(result.current.lastResult).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('필수 반환값(syncFromEdutrix, resetSync, isSyncing, isResetting, lastResult, error)을 모두 반환한다', () => {
      // Given: useEdutrixSync 훅이 호출되면
      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // Then: 모든 반환값이 존재한다
      expect(result.current.syncFromEdutrix).toBeInstanceOf(Function);
      expect(result.current.resetSync).toBeInstanceOf(Function);
      expect(result.current.isSyncing).toBeDefined();
      expect(result.current.isResetting).toBeDefined();
      expect(result.current.lastResult).toBeDefined();
      expect(result.current.error).toBeDefined();
    });
  });

  describe('syncFromEdutrix', () => {
    it('보고서가 0건인 경우 매칭 없이 종료된다', async () => {
      // Given: Edutrix 보고서가 없는 상태이고
      mockedFetchReportsByMonth.mockResolvedValue([]);

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 동기화를 실행하면
      let syncResult: Awaited<ReturnType<typeof result.current.syncFromEdutrix>>;
      await act(async () => {
        syncResult = await result.current.syncFromEdutrix('2026-02');
      });

      // Then: 결과가 0건이고 상태가 원래대로 돌아온다
      expect(syncResult!.totalReports).toBe(0);
      expect(syncResult!.matched).toBe(0);
      expect(syncResult!.skipped).toBe(0);
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.lastResult).toBeDefined();
      expect(result.current.lastResult!.yearMonth).toBe('2026-02');
    });

    it('동기화 실행 중 isSyncing이 true가 된다', async () => {
      // Given: 응답이 지연되는 상황이고
      let resolveFetch: (value: unknown[]) => void;
      mockedFetchReportsByMonth.mockReturnValue(
        new Promise<unknown[]>((resolve) => { resolveFetch = resolve; }) as any
      );

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 동기화를 시작하면
      act(() => {
        result.current.syncFromEdutrix('2026-02');
      });

      // Then: isSyncing이 true가 된다
      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true);
      });

      // Cleanup
      await act(async () => {
        resolveFetch!([]);
      });
    });

    it('동기화 완료 후 isSyncing이 false가 된다', async () => {
      // Given: 보고서가 없는 상태로 설정하고
      mockedFetchReportsByMonth.mockResolvedValue([]);

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 동기화를 실행하고 완료되면
      await act(async () => {
        await result.current.syncFromEdutrix('2026-02');
      });

      // Then: isSyncing이 false가 된다
      expect(result.current.isSyncing).toBe(false);
    });

    it('IJW 학생과 보고서 학생명이 매칭되지 않으면 skipped로 기록된다', async () => {
      // Given: 보고서에는 학생이 있지만 IJW DB에는 없는 경우
      mockedFetchReportsByMonth.mockResolvedValue([
        {
          student_name: '존재하지않는학생',
          class_name: '수학반',
          date: '2026-02-03',
          lateness: null,
          teacher_name: '김선생',
          assignment_score: null,
          exam_info: null,
        },
      ] as any[]);

      // Promise.all([fetchIjwStudents, fetchIjwStaff]) 병렬 실행 후 fetchHolidays 순서로 호출됨
      // mockResolvedValue로 모든 호출에 동일한 응답(빈 목록)을 반환
      mockedGetDocs.mockResolvedValue(emptySnap());

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 동기화를 실행하면
      let syncResult: Awaited<ReturnType<typeof result.current.syncFromEdutrix>>;
      await act(async () => {
        syncResult = await result.current.syncFromEdutrix('2026-02');
      });

      // Then: skipped_no_match 상태로 기록된다
      expect(syncResult!.skipped).toBe(1);
      expect(syncResult!.matched).toBe(0);
      expect(syncResult!.details[0].status).toBe('skipped_no_match');
    });

    it('학생명 매칭 성공 시 출석 데이터가 Firestore에 저장된다', async () => {
      // Given: 보고서에 학생이 있고 IJW DB에도 동일한 학생이 있는 경우
      mockedFetchReportsByMonth.mockResolvedValue([
        {
          student_name: '김철수',
          class_name: '수학반',
          date: '2026-02-02', // 월요일
          lateness: null,
          teacher_name: null,
          assignment_score: '100',
          exam_info: null,
        },
      ] as any[]);

      mockedMapReportToAttendanceValue.mockReturnValue(1);

      // getDocs 호출마다 다른 값을 반환
      // 순서: fetchIjwStudents(1) → fetchIjwStaff(2) [Promise.all 병렬] → fetchHolidays(3) → fetchStudentEnrollments(4)
      // Promise.all은 순서를 보장하지 않지만 vi.fn()은 호출된 순서대로 값을 반환하므로
      // 단순화를 위해 fn 구현으로 컬렉션 이름에 따라 분기 처리
      mockedGetDocs.mockImplementation((queryRef: any) => {
        // collection 모킹 시 모든 ref가 동일 객체({})이므로 호출 횟수로 분기
        const callCount = mockedGetDocs.mock.calls.length;
        if (callCount <= 2) {
          // 1번째: students, 2번째: staff (Promise.all 내부)
          if (callCount === 1) {
            return Promise.resolve({
              docs: [makeMockDoc('student-001', { name: '김철수', status: 'active' })],
            }) as any;
          }
          return Promise.resolve(emptySnap()); // staff
        }
        if (callCount === 3) {
          return Promise.resolve(emptySnap()); // holidays
        }
        // enrollments
        return Promise.resolve({
          docs: [
            makeMockDoc('enroll-001', {
              className: '수학반',
              classId: 'class-001',
              staffId: 'staff-001',
              teacher: '김선생',
              days: ['월', '수'],
              schedule: [],
            }),
          ],
        }) as any;
      });

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 동기화를 실행하면
      let syncResult: Awaited<ReturnType<typeof result.current.syncFromEdutrix>>;
      await act(async () => {
        syncResult = await result.current.syncFromEdutrix('2026-02');
      });

      // Then: 매칭이 성공하고 Firestore에 setDoc이 호출된다
      expect(syncResult!.matched).toBeGreaterThan(0);
      expect(mockedSetDoc).toHaveBeenCalled();
    });

    it('동기화 오류 발생 시 error 상태가 설정되고 예외가 던져진다', async () => {
      // Given: fetchReportsByMonth가 오류를 던지도록 설정하고
      mockedFetchReportsByMonth.mockRejectedValue(new Error('네트워크 오류'));

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 동기화를 실행하면
      await act(async () => {
        await expect(result.current.syncFromEdutrix('2026-02')).rejects.toThrow('네트워크 오류');
      });

      // Then: error 상태가 설정되고 isSyncing이 false가 된다
      expect(result.current.error).toBe('네트워크 오류');
      expect(result.current.isSyncing).toBe(false);
    });

    it('동기화 결과에 yearMonth가 포함된다', async () => {
      // Given: 보고서가 없는 상태이고
      mockedFetchReportsByMonth.mockResolvedValue([]);

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 특정 월로 동기화를 실행하면
      let syncResult: Awaited<ReturnType<typeof result.current.syncFromEdutrix>>;
      await act(async () => {
        syncResult = await result.current.syncFromEdutrix('2026-01');
      });

      // Then: 결과에 해당 yearMonth가 포함된다
      expect(syncResult!.yearMonth).toBe('2026-01');
    });
  });

  describe('resetSync', () => {
    it('초기화할 레코드가 없으면 0을 반환한다', async () => {
      // Given: 해당 월의 레코드가 없는 경우
      mockedGetDocs.mockResolvedValueOnce(emptySnap());

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 초기화를 실행하면
      let resetCount: number;
      await act(async () => {
        resetCount = await result.current.resetSync('2026-02');
      });

      // Then: 0이 반환된다
      expect(resetCount!).toBe(0);
      expect(result.current.isResetting).toBe(false);
    });

    it('초기화 실행 중 isResetting이 true가 된다', async () => {
      // Given: 응답이 지연되는 상황이고
      let resolveGetDocs: (value: unknown) => void;
      mockedGetDocs.mockReturnValueOnce(
        new Promise((resolve) => { resolveGetDocs = resolve; }) as any
      );

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 초기화를 시작하면
      act(() => {
        result.current.resetSync('2026-02');
      });

      // Then: isResetting이 true가 된다
      await waitFor(() => {
        expect(result.current.isResetting).toBe(true);
      });

      // Cleanup
      await act(async () => {
        resolveGetDocs!({ docs: [], size: 0 });
      });
    });

    it('초기화 완료 후 isResetting이 false가 된다', async () => {
      // Given: 레코드가 없는 상태이고
      mockedGetDocs.mockResolvedValueOnce(emptySnap());

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 초기화를 실행하고 완료되면
      await act(async () => {
        await result.current.resetSync('2026-02');
      });

      // Then: isResetting이 false가 된다
      expect(result.current.isResetting).toBe(false);
    });

    it('레코드가 있을 때 setDoc으로 attendance/homework/examScores 필드를 삭제한다', async () => {
      // Given: 해당 월의 레코드가 1건 있는 경우
      const mockDocSnap = {
        id: 'student-001_2026-02',
        ref: { id: 'student-001_2026-02' },
        data: () => ({
          attendance: { '수학반::2026-02-03': 1 },
          yearMonth: '2026-02',
        }),
      };
      mockedGetDocs.mockResolvedValueOnce({
        docs: [mockDocSnap],
        size: 1,
      } as any);

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 초기화를 실행하면
      await act(async () => {
        await result.current.resetSync('2026-02');
      });

      // Then: setDoc이 호출된다 (attendance/homework/examScores 삭제)
      expect(mockedSetDoc).toHaveBeenCalled();
    });

    it('초기화 완료 후 lastResult가 null로 초기화된다', async () => {
      // Given: lastResult가 설정된 상태를 시뮬레이션하기 위해 레코드 있는 초기화를 실행
      // resetSync 내부에서 recordsSnap.size > 0일 때만 setLastResult(null)이 호출됨
      const mockDocSnap = {
        id: 'student-001_2026-02',
        ref: { id: 'student-001_2026-02' },
        data: () => ({
          attendance: { '수학반::2026-02-03': 1 },
          yearMonth: '2026-02',
        }),
      };

      // 먼저 동기화로 lastResult 설정
      mockedFetchReportsByMonth.mockResolvedValue([]);

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.syncFromEdutrix('2026-02');
      });
      expect(result.current.lastResult).not.toBeNull();

      // 레코드가 있는 초기화를 실행해야 setLastResult(null)이 호출됨
      mockedGetDocs.mockResolvedValueOnce({
        docs: [mockDocSnap],
        size: 1,
      } as any);

      // When: resetSync를 실행하면 (레코드 있음)
      await act(async () => {
        await result.current.resetSync('2026-02');
      });

      // Then: lastResult가 null이 된다
      expect(result.current.lastResult).toBeNull();
    });

    it('초기화 오류 발생 시 예외가 던져진다', async () => {
      // Given: getDocs가 오류를 던지도록 설정하고
      mockedGetDocs.mockRejectedValueOnce(new Error('Firestore 오류'));

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 초기화를 실행하면
      await act(async () => {
        await expect(result.current.resetSync('2026-02')).rejects.toThrow('Firestore 오류');
      });

      // Then: isResetting이 false가 된다
      expect(result.current.isResetting).toBe(false);
    });
  });

  describe('SyncResult 구조', () => {
    it('syncFromEdutrix가 올바른 SyncResult 구조를 반환한다', async () => {
      // Given: 보고서가 없는 상태이고
      mockedFetchReportsByMonth.mockResolvedValue([]);

      const { result } = renderHook(() => useEdutrixSync(), {
        wrapper: createWrapper(),
      });

      // When: 동기화를 실행하면
      let syncResult: Awaited<ReturnType<typeof result.current.syncFromEdutrix>>;
      await act(async () => {
        syncResult = await result.current.syncFromEdutrix('2026-02');
      });

      // Then: SyncResult의 모든 필드가 존재한다
      expect(syncResult!).toMatchObject({
        totalReports: expect.any(Number),
        matched: expect.any(Number),
        skipped: expect.any(Number),
        alreadyMarked: expect.any(Number),
        errors: expect.any(Number),
        details: expect.any(Array),
        yearMonth: expect.any(String),
      });
    });
  });
});
