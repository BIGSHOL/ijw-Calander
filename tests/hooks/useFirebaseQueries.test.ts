import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs, getDoc } from 'firebase/firestore';
import {
  useDepartments,
  useTeachers,
  useHolidays,
  useClassKeywords,
  useStaffWithAccounts,
  useAllStaff,
  useSystemConfig,
} from '../../hooks/useFirebaseQueries';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useFirebaseQueries', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  describe('useDepartments', () => {
    it('부서 목록 order 정렬', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { id: 'd1', data: () => ({ name: '수학부', order: 2, color: '#ff0000' }) },
          { id: 'd2', data: () => ({ name: '영어부', order: 1, color: '#00ff00' }) },
        ],
      } as any);

      const { result } = renderHook(() => useDepartments(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data![0].name).toBe('영어부');
      expect(result.current.data![1].name).toBe('수학부');
    });

    it('한글 필드 fallback', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { id: 'd1', data: () => ({ 부서명: '국어부', 순서: 1, 색상: '#0000ff' }) },
        ],
      } as any);

      const { result } = renderHook(() => useDepartments(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data![0].name).toBe('국어부');
      expect(result.current.data![0].order).toBe(1);
    });

    it('enabled=false이면 비활성화', () => {
      const { result } = renderHook(() => useDepartments(false), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useTeachers', () => {
    it('강사 목록 조회 및 정렬', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          {
            id: 't1',
            data: () => ({
              name: '김선생',
              subjects: ['수학'],
              timetableOrder: 2,
              isHiddenInTimetable: false,
              isNative: false,
            }),
          },
          {
            id: 't2',
            data: () => ({
              name: '이선생',
              subjects: ['영어'],
              timetableOrder: 1,
              isHiddenInTimetable: false,
              isNative: true,
            }),
          },
        ],
      } as any);

      const { result } = renderHook(() => useTeachers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data![0].name).toBe('이선생');
      expect(result.current.data![1].name).toBe('김선생');
    });
  });

  describe('useHolidays', () => {
    it('휴일 목록 조회', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { id: 'h1', data: () => ({ date: '2026-01-01', name: '신정' }) },
        ],
      } as any);

      const { result } = renderHook(() => useHolidays(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe('useClassKeywords', () => {
    it('키워드 order 정렬', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { id: 'k1', data: () => ({ keyword: '초등', order: 2 }) },
          { id: 'k2', data: () => ({ keyword: '중등', order: 1 }) },
        ],
      } as any);

      const { result } = renderHook(() => useClassKeywords(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data![0].keyword).toBe('중등');
    });
  });

  describe('useSystemConfig', () => {
    it('설정 존재 시 반환', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          eventLookbackYears: 3,
          categories: ['수학', '영어'],
        }),
      } as any);

      const { result } = renderHook(() => useSystemConfig(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.eventLookbackYears).toBe(3);
      expect(result.current.data!.categories).toEqual(['수학', '영어']);
    });

    it('설정 없으면 기본값', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
        data: () => null,
      } as any);

      const { result } = renderHook(() => useSystemConfig(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.eventLookbackYears).toBe(2);
      expect(result.current.data!.categories).toEqual([]);
    });
  });
});
