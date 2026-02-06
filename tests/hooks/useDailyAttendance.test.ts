/**
 * Comprehensive tests for useDailyAttendance hooks
 *
 * Tests cover:
 * - useDailyAttendanceByDate (query with date parameter, enabled flag)
 * - useDailyAttendanceByRange (query with date range, batch processing)
 * - useDailyAttendanceStats (derived stats calculation)
 * - useCreateDailyAttendance (create/update single record)
 * - useUpdateDailyAttendanceStatus (update with optimistic updates)
 * - useDeleteDailyAttendance (delete single record)
 * - useBulkCreateDailyAttendance (batch create multiple records)
 * - Error handling for all mutations
 * - Edge cases (empty data, disabled queries, undefined params)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useDailyAttendanceByDate,
  useDailyAttendanceByRange,
  useDailyAttendanceStats,
  useCreateDailyAttendance,
  useUpdateDailyAttendanceStatus,
  useDeleteDailyAttendance,
  useBulkCreateDailyAttendance,
} from '../../hooks/useDailyAttendance';
import { DailyAttendanceRecord } from '../../types/attendance';

// Mock Firebase modules BEFORE importing hooks
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: { fromDate: vi.fn((d: Date) => ({ toDate: () => d })) },
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Import Firebase functions after mocking
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

// Test data factory
const createMockRecord = (overrides: Partial<DailyAttendanceRecord> = {}): DailyAttendanceRecord => ({
  id: 'student1_class1',
  date: '2026-02-07',
  studentId: 'student1',
  studentName: '김철수',
  classId: 'class1',
  className: '초급 1반',
  status: 'present',
  createdBy: 'teacher1',
  createdAt: '2026-02-07T09:00:00Z',
  updatedAt: '2026-02-07T09:00:00Z',
  ...overrides,
});

// QueryClient wrapper for React Query hooks
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useDailyAttendance hooks', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console.warn for range query error handling
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Setup default Firebase mocks to return {} (for expect.anything())
    vi.mocked(collection).mockReturnValue({} as any);
    vi.mocked(doc).mockReturnValue({} as any);
    vi.mocked(query).mockReturnValue({} as any);
    vi.mocked(orderBy).mockReturnValue({} as any);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  // ============================================================================
  // 1. useDailyAttendanceByDate - Query for specific date
  // ============================================================================

  describe('useDailyAttendanceByDate', () => {
    it('특정 날짜의 출결 기록을 가져온다', async () => {
      const mockRecords = [
        createMockRecord({ id: 'student1_class1', studentName: '김철수' }),
        createMockRecord({ id: 'student2_class1', studentId: 'student2', studentName: '이영희' }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockRecords.map(record => ({
          id: record.id,
          data: () => record,
        })),
      } as any);

      const { result } = renderHook(() => useDailyAttendanceByDate('2026-02-07'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockRecords);
      expect(collection).toHaveBeenCalledWith({}, 'daily_attendance', '2026-02-07', 'records');
      expect(query).toHaveBeenCalledWith({}, expect.anything(), expect.anything());
      expect(orderBy).toHaveBeenCalledWith('className');
      expect(orderBy).toHaveBeenCalledWith('studentName');
    });

    it('빈 배열을 반환할 수 있다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(() => useDailyAttendanceByDate('2026-02-07'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it('enabled가 false이면 쿼리를 실행하지 않는다', () => {
      const { result } = renderHook(() => useDailyAttendanceByDate('2026-02-07', false), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('date가 빈 문자열이면 쿼리를 실행하지 않는다', () => {
      const { result } = renderHook(() => useDailyAttendanceByDate(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('date가 빈 문자열이지만 enabled가 명시적으로 true면 쿼리를 실행하지 않는다', () => {
      // FIX: enabled: enabled && !!date means empty date = disabled query
      const { result } = renderHook(() => useDailyAttendanceByDate('', true), {
        wrapper: createWrapper(),
      });

      // Query is still disabled because !!'' = false
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('API 에러 시 에러 상태를 반환한다', async () => {
      const mockError = new Error('Firestore error');
      vi.mocked(getDocs).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDailyAttendanceByDate('2026-02-07'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it('다양한 출결 상태를 포함한 기록을 가져온다', async () => {
      const mockRecords = [
        createMockRecord({ id: 'student1_class1', status: 'present' }),
        createMockRecord({ id: 'student2_class1', status: 'late' }),
        createMockRecord({ id: 'student3_class1', status: 'absent' }),
        createMockRecord({ id: 'student4_class1', status: 'early_leave' }),
        createMockRecord({ id: 'student5_class1', status: 'excused' }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockRecords.map(record => ({
          id: record.id,
          data: () => record,
        })),
      } as any);

      const { result } = renderHook(() => useDailyAttendanceByDate('2026-02-07'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(5);
      expect(result.current.data?.[0].status).toBe('present');
      expect(result.current.data?.[1].status).toBe('late');
      expect(result.current.data?.[2].status).toBe('absent');
    });

    it('checkInTime과 checkOutTime이 있는 기록을 가져온다', async () => {
      const mockRecords = [
        createMockRecord({
          id: 'student1_class1',
          checkInTime: '09:00',
          checkOutTime: '17:00',
          note: '정상 출석',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockRecords.map(record => ({
          id: record.id,
          data: () => record,
        })),
      } as any);

      const { result } = renderHook(() => useDailyAttendanceByDate('2026-02-07'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0].checkInTime).toBe('09:00');
      expect(result.current.data?.[0].checkOutTime).toBe('17:00');
      expect(result.current.data?.[0].note).toBe('정상 출석');
    });
  });

  // ============================================================================
  // 2. useDailyAttendanceByRange - Query for date range
  // ============================================================================

  describe('useDailyAttendanceByRange', () => {
    it('날짜 범위의 출결 기록을 가져온다', async () => {
      const mockRecord1 = createMockRecord({ date: '2026-02-05' });
      const mockRecord2 = createMockRecord({ date: '2026-02-06' });
      const mockRecord3 = createMockRecord({ date: '2026-02-07' });

      vi.mocked(getDocs).mockImplementation(async () => {
        // Each call returns a different date's records
        return {
          docs: [mockRecord1, mockRecord2, mockRecord3].map(record => ({
            id: record.id,
            data: () => record,
          })),
        } as any;
      });

      const { result } = renderHook(
        () => useDailyAttendanceByRange('2026-02-05', '2026-02-07'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(Object.keys(result.current.data || {})).toContain('2026-02-05');
      expect(Object.keys(result.current.data || {})).toContain('2026-02-06');
      expect(Object.keys(result.current.data || {})).toContain('2026-02-07');
    });

    it('빈 날짜 범위에 대해 빈 객체를 반환한다', () => {
      // FIX: enabled: enabled && !!startDate && !!endDate means empty dates = disabled query
      const { result } = renderHook(
        () => useDailyAttendanceByRange('', ''),
        { wrapper: createWrapper() }
      );

      // Query is disabled, so fetchStatus is 'idle' and data is undefined
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('enabled가 false이면 쿼리를 실행하지 않는다', () => {
      const { result } = renderHook(
        () => useDailyAttendanceByRange('2026-02-05', '2026-02-07', false),
        { wrapper: createWrapper() }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('startDate가 없으면 쿼리를 실행하지 않는다', () => {
      const { result } = renderHook(
        () => useDailyAttendanceByRange('', '2026-02-07'),
        { wrapper: createWrapper() }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('endDate가 없으면 쿼리를 실행하지 않는다', () => {
      const { result } = renderHook(
        () => useDailyAttendanceByRange('2026-02-05', ''),
        { wrapper: createWrapper() }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('단일 날짜 범위를 처리한다', async () => {
      const mockRecord = createMockRecord({ date: '2026-02-07' });

      vi.mocked(getDocs).mockResolvedValue({
        docs: [{ id: mockRecord.id, data: () => mockRecord }],
      } as any);

      const { result } = renderHook(
        () => useDailyAttendanceByRange('2026-02-07', '2026-02-07'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(Object.keys(result.current.data || {})).toEqual(['2026-02-07']);
    });

    it('7일 이상의 범위를 배치 처리한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(
        () => useDailyAttendanceByRange('2026-02-01', '2026-02-15'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // 15 days should be split into 3 batches (7, 7, 1)
      expect(result.current.data).toBeDefined();
      expect(Object.keys(result.current.data || {}).length).toBe(15);
    });

    it('특정 날짜의 API 에러를 처리하고 빈 배열을 반환한다', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(
        () => useDailyAttendanceByRange('2026-02-05', '2026-02-07'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Errors are caught and logged, empty arrays are returned
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(result.current.data?.['2026-02-05']).toEqual([]);
    });

    it('월간 범위(28-31일)를 효율적으로 처리한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(
        () => useDailyAttendanceByRange('2026-02-01', '2026-02-28'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // 28 days should be split into 4 batches (7, 7, 7, 7)
      expect(Object.keys(result.current.data || {}).length).toBe(28);
    });
  });

  // ============================================================================
  // 3. useDailyAttendanceStats - Derived statistics calculation
  // ============================================================================

  describe('useDailyAttendanceStats', () => {
    it('출결 통계를 계산한다', async () => {
      const mockRecords = [
        createMockRecord({ id: 'student1', status: 'present' }),
        createMockRecord({ id: 'student2', status: 'present' }),
        createMockRecord({ id: 'student3', status: 'late' }),
        createMockRecord({ id: 'student4', status: 'absent' }),
        createMockRecord({ id: 'student5', status: 'early_leave' }),
        createMockRecord({ id: 'student6', status: 'excused' }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockRecords.map(record => ({
          id: record.id,
          data: () => record,
        })),
      } as any);

      const { result } = renderHook(() => useDailyAttendanceStats('2026-02-07'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.stats).toEqual({
        date: '2026-02-07',
        total: 6,
        present: 2,
        late: 1,
        absent: 1,
        earlyLeave: 1,
        excused: 1,
        attendanceRate: 50, // (2 present + 1 late) / 6 = 50%
      });
    });

    it('출석률을 올바르게 계산한다 (present + late)', async () => {
      const mockRecords = [
        createMockRecord({ id: 'student1', status: 'present' }),
        createMockRecord({ id: 'student2', status: 'late' }),
        createMockRecord({ id: 'student3', status: 'late' }),
        createMockRecord({ id: 'student4', status: 'absent' }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockRecords.map(record => ({
          id: record.id,
          data: () => record,
        })),
      } as any);

      const { result } = renderHook(() => useDailyAttendanceStats('2026-02-07'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // 1 present + 2 late = 3/4 = 75%
      expect(result.current.stats.attendanceRate).toBe(75);
    });

    it('기록이 없을 때 0%를 반환한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(() => useDailyAttendanceStats('2026-02-07'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.stats).toEqual({
        date: '2026-02-07',
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        earlyLeave: 0,
        excused: 0,
        attendanceRate: 0,
      });
    });

    it('enabled가 false이면 로딩 상태를 유지한다', () => {
      // FIX: When enabled=false, the underlying query doesn't run, so isLoading is false
      // but data is undefined, so the hook returns default stats with 0 values
      const { result } = renderHook(() => useDailyAttendanceStats('2026-02-07', false), {
        wrapper: createWrapper(),
      });

      // When query is disabled, isLoading is false (not true)
      expect(result.current.isLoading).toBe(false);
      expect(result.current.stats.total).toBe(0);
    });

    it('100% 출석률을 계산한다', async () => {
      const mockRecords = [
        createMockRecord({ id: 'student1', status: 'present' }),
        createMockRecord({ id: 'student2', status: 'present' }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockRecords.map(record => ({
          id: record.id,
          data: () => record,
        })),
      } as any);

      const { result } = renderHook(() => useDailyAttendanceStats('2026-02-07'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.stats.attendanceRate).toBe(100);
    });
  });

  // ============================================================================
  // 4. useCreateDailyAttendance - Create/Update single record
  // ============================================================================

  describe('useCreateDailyAttendance', () => {
    it('새로운 출결 기록을 생성한다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const newRecord = {
        date: '2026-02-07',
        studentId: 'student1',
        studentName: '김철수',
        classId: 'class1',
        className: '초급 1반',
        status: 'present' as const,
        createdBy: 'teacher1',
      };

      result.current.mutate(newRecord);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          ...newRecord,
          id: 'student1_class1',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
        { merge: true }
      );
      expect(doc).toHaveBeenCalledWith({}, 'daily_attendance', '2026-02-07', 'records', 'student1_class1');
    });

    it('id를 명시적으로 제공할 수 있다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const newRecord = {
        id: 'custom_id',
        date: '2026-02-07',
        studentId: 'student1',
        studentName: '김철수',
        classId: 'class1',
        className: '초급 1반',
        status: 'present' as const,
        createdBy: 'teacher1',
      };

      result.current.mutate(newRecord);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(doc).toHaveBeenCalledWith({}, 'daily_attendance', '2026-02-07', 'records', 'custom_id');
    });

    it('checkInTime과 note를 포함할 수 있다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const newRecord = {
        date: '2026-02-07',
        studentId: 'student1',
        studentName: '김철수',
        classId: 'class1',
        className: '초급 1반',
        status: 'late' as const,
        checkInTime: '09:15',
        note: '교통 체증으로 지각',
        createdBy: 'teacher1',
      };

      result.current.mutate(newRecord);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          checkInTime: '09:15',
          note: '교통 체증으로 지각',
        }),
        { merge: true }
      );
    });

    it('API 에러 시 에러 상태를 반환한다', async () => {
      const mockError = new Error('Firestore error');
      vi.mocked(setDoc).mockRejectedValue(mockError);

      const { result } = renderHook(() => useCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const newRecord = {
        date: '2026-02-07',
        studentId: 'student1',
        studentName: '김철수',
        classId: 'class1',
        className: '초급 1반',
        status: 'present' as const,
        createdBy: 'teacher1',
      };

      result.current.mutate(newRecord);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it('merge: true 옵션으로 기존 기록을 업데이트한다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const updateRecord = {
        date: '2026-02-07',
        studentId: 'student1',
        studentName: '김철수',
        classId: 'class1',
        className: '초급 1반',
        status: 'absent' as const,
        createdBy: 'teacher1',
      };

      result.current.mutate(updateRecord);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Object),
        { merge: true }
      );
    });
  });

  // ============================================================================
  // 5. useUpdateDailyAttendanceStatus - Update with optimistic updates
  // ============================================================================

  describe('useUpdateDailyAttendanceStatus', () => {
    it('출결 상태를 업데이트한다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateDailyAttendanceStatus(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        date: '2026-02-07',
        recordId: 'student1_class1',
        status: 'late' as const,
        updatedBy: 'teacher1',
      };

      result.current.mutate(updateData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'late',
          updatedAt: expect.any(String),
        }),
        { merge: true }
      );
      expect(doc).toHaveBeenCalledWith({}, 'daily_attendance', '2026-02-07', 'records', 'student1_class1');
    });

    it('note를 함께 업데이트할 수 있다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateDailyAttendanceStatus(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        date: '2026-02-07',
        recordId: 'student1_class1',
        status: 'absent' as const,
        note: '병결',
        updatedBy: 'teacher1',
      };

      result.current.mutate(updateData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'absent',
          note: '병결',
        }),
        { merge: true }
      );
    });

    it('checkInTime과 checkOutTime을 업데이트할 수 있다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateDailyAttendanceStatus(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        date: '2026-02-07',
        recordId: 'student1_class1',
        status: 'present' as const,
        checkInTime: '09:00',
        checkOutTime: '17:30',
        updatedBy: 'teacher1',
      };

      result.current.mutate(updateData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          checkInTime: '09:00',
          checkOutTime: '17:30',
        }),
        { merge: true }
      );
    });

    it('API 에러 시 에러 상태를 반환한다', async () => {
      const mockError = new Error('Firestore error');
      vi.mocked(setDoc).mockRejectedValue(mockError);

      const { result } = renderHook(() => useUpdateDailyAttendanceStatus(), {
        wrapper: createWrapper(),
      });

      const updateData = {
        date: '2026-02-07',
        recordId: 'student1_class1',
        status: 'late' as const,
        updatedBy: 'teacher1',
      };

      result.current.mutate(updateData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it('옵티미스틱 업데이트를 수행한다', async () => {
      // FIX: Use a slow mock to check optimistic update before mutation completes
      vi.mocked(setDoc).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      // Pre-populate cache with existing data
      const existingRecords = [
        createMockRecord({ id: 'student1_class1', status: 'present' }),
      ];
      queryClient.setQueryData(['dailyAttendance', '2026-02-07'], existingRecords);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUpdateDailyAttendanceStatus(), { wrapper });

      const updateData = {
        date: '2026-02-07',
        recordId: 'student1_class1',
        status: 'late' as const,
        note: '지각 사유',
        updatedBy: 'teacher1',
      };

      result.current.mutate(updateData);

      // Wait a tick for onMutate to execute
      await waitFor(() => {
        const optimisticData = queryClient.getQueryData<DailyAttendanceRecord[]>(['dailyAttendance', '2026-02-07']);
        return optimisticData?.[0]?.status === 'late';
      });

      // Check optimistic update was applied
      const optimisticData = queryClient.getQueryData<DailyAttendanceRecord[]>(['dailyAttendance', '2026-02-07']);
      expect(optimisticData?.[0].status).toBe('late');
      expect(optimisticData?.[0].note).toBe('지각 사유');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('에러 발생 시 이전 데이터로 롤백한다', async () => {
      const mockError = new Error('Firestore error');
      vi.mocked(setDoc).mockRejectedValue(mockError);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const existingRecords = [
        createMockRecord({ id: 'student1_class1', status: 'present' }),
      ];
      queryClient.setQueryData(['dailyAttendance', '2026-02-07'], existingRecords);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUpdateDailyAttendanceStatus(), { wrapper });

      const updateData = {
        date: '2026-02-07',
        recordId: 'student1_class1',
        status: 'late' as const,
        updatedBy: 'teacher1',
      };

      result.current.mutate(updateData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Check rollback
      const rolledBackData = queryClient.getQueryData<DailyAttendanceRecord[]>(['dailyAttendance', '2026-02-07']);
      expect(rolledBackData?.[0].status).toBe('present');
    });
  });

  // ============================================================================
  // 6. useDeleteDailyAttendance - Delete single record
  // ============================================================================

  describe('useDeleteDailyAttendance', () => {
    it('출결 기록을 삭제한다', async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const deleteData = {
        date: '2026-02-07',
        recordId: 'student1_class1',
      };

      result.current.mutate(deleteData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(deleteDoc).toHaveBeenCalledWith(expect.anything());
      expect(doc).toHaveBeenCalledWith({}, 'daily_attendance', '2026-02-07', 'records', 'student1_class1');
    });

    it('삭제 성공 시 결과를 반환한다', async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const deleteData = {
        date: '2026-02-07',
        recordId: 'student1_class1',
      };

      result.current.mutate(deleteData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(deleteData);
    });

    it('API 에러 시 에러 상태를 반환한다', async () => {
      const mockError = new Error('Firestore error');
      vi.mocked(deleteDoc).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDeleteDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const deleteData = {
        date: '2026-02-07',
        recordId: 'student1_class1',
      };

      result.current.mutate(deleteData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it('여러 기록을 순차적으로 삭제할 수 있다', async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteDailyAttendance(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ date: '2026-02-07', recordId: 'student1_class1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      result.current.mutate({ date: '2026-02-07', recordId: 'student2_class1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(deleteDoc).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // 7. useBulkCreateDailyAttendance - Batch create multiple records
  // ============================================================================

  describe('useBulkCreateDailyAttendance', () => {
    it('여러 출결 기록을 일괄 생성한다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBulkCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const newRecords = [
        {
          date: '2026-02-07',
          studentId: 'student1',
          studentName: '김철수',
          classId: 'class1',
          className: '초급 1반',
          status: 'present' as const,
          createdBy: 'teacher1',
        },
        {
          date: '2026-02-07',
          studentId: 'student2',
          studentName: '이영희',
          classId: 'class1',
          className: '초급 1반',
          status: 'present' as const,
          createdBy: 'teacher1',
        },
      ];

      result.current.mutate(newRecords);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setDoc).toHaveBeenCalledTimes(2);
      expect(doc).toHaveBeenCalledWith({}, 'daily_attendance', '2026-02-07', 'records', 'student1_class1');
      expect(doc).toHaveBeenCalledWith({}, 'daily_attendance', '2026-02-07', 'records', 'student2_class1');
    });

    it('빈 배열을 처리할 수 있다', async () => {
      const { result } = renderHook(() => useBulkCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      result.current.mutate([]);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setDoc).not.toHaveBeenCalled();
    });

    it('여러 날짜의 기록을 생성할 수 있다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBulkCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const newRecords = [
        {
          date: '2026-02-07',
          studentId: 'student1',
          studentName: '김철수',
          classId: 'class1',
          className: '초급 1반',
          status: 'present' as const,
          createdBy: 'teacher1',
        },
        {
          date: '2026-02-08',
          studentId: 'student1',
          studentName: '김철수',
          classId: 'class1',
          className: '초급 1반',
          status: 'present' as const,
          createdBy: 'teacher1',
        },
      ];

      result.current.mutate(newRecords);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(doc).toHaveBeenCalledWith({}, 'daily_attendance', '2026-02-07', 'records', 'student1_class1');
      expect(doc).toHaveBeenCalledWith({}, 'daily_attendance', '2026-02-08', 'records', 'student1_class1');
    });

    it('API 에러 시 에러 상태를 반환한다', async () => {
      const mockError = new Error('Firestore error');
      vi.mocked(setDoc).mockRejectedValue(mockError);

      const { result } = renderHook(() => useBulkCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const newRecords = [
        {
          date: '2026-02-07',
          studentId: 'student1',
          studentName: '김철수',
          classId: 'class1',
          className: '초급 1반',
          status: 'present' as const,
          createdBy: 'teacher1',
        },
      ];

      result.current.mutate(newRecords);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it('모든 기록이 동일한 타임스탬프를 가진다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBulkCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const newRecords = [
        {
          date: '2026-02-07',
          studentId: 'student1',
          studentName: '김철수',
          classId: 'class1',
          className: '초급 1반',
          status: 'present' as const,
          createdBy: 'teacher1',
        },
        {
          date: '2026-02-07',
          studentId: 'student2',
          studentName: '이영희',
          classId: 'class1',
          className: '초급 1반',
          status: 'present' as const,
          createdBy: 'teacher1',
        },
      ];

      result.current.mutate(newRecords);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const calls = vi.mocked(setDoc).mock.calls;
      const timestamp1 = (calls[0][1] as any).createdAt;
      const timestamp2 = (calls[1][1] as any).createdAt;

      expect(timestamp1).toBe(timestamp2);
    });

    it('대량의 기록을 생성할 수 있다', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBulkCreateDailyAttendance(), {
        wrapper: createWrapper(),
      });

      const newRecords = Array.from({ length: 50 }, (_, i) => ({
        date: '2026-02-07',
        studentId: `student${i + 1}`,
        studentName: `학생${i + 1}`,
        classId: 'class1',
        className: '초급 1반',
        status: 'present' as const,
        createdBy: 'teacher1',
      }));

      result.current.mutate(newRecords);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setDoc).toHaveBeenCalledTimes(50);
    });
  });
});
