import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs, addDoc } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-term-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

import {
  useMonthlyEnrollmentTerms,
  useStudentEnrollmentTerms,
  useCreateEnrollmentTerm,
  useUpdateEnrollmentTerm,
  useCancelEnrollmentTerm,
} from '../../hooks/useEnrollmentTerms';

describe('useEnrollmentTerms', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  describe('useMonthlyEnrollmentTerms', () => {
    it('month 없으면 비활성화', () => {
      const { result } = renderHook(() => useMonthlyEnrollmentTerms(undefined), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('월별 등록차수 조회 및 학생별 그룹화', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          {
            id: 't1',
            data: () => ({
              studentId: 's1',
              studentName: '홍길동',
              month: '2026-01',
              termNumber: 1,
              billedAmount: 300000,
              unitPrice: 300000,
              source: 'manual',
              status: 'active',
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            }),
          },
          {
            id: 't2',
            data: () => ({
              studentId: 's1',
              studentName: '홍길동',
              month: '2026-01',
              termNumber: 2,
              billedAmount: 200000,
              unitPrice: 200000,
              source: 'auto',
              status: 'active',
              createdAt: '2026-01-15',
              updatedAt: '2026-01-15',
            }),
          },
          {
            id: 't3',
            data: () => ({
              studentId: 's2',
              studentName: '김영희',
              month: '2026-01',
              termNumber: 1,
              billedAmount: 250000,
              unitPrice: 250000,
              source: 'manual',
              status: 'active',
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            }),
          },
        ],
      } as any);

      const { result } = renderHook(() => useMonthlyEnrollmentTerms('2026-01'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const map = result.current.data!;
      expect(map.size).toBe(2);

      // 학생1: 2개 차수
      const s1 = map.get('s1')!;
      expect(s1.totalTerms).toBe(2);
      expect(s1.currentTermNumber).toBe(2);
      expect(s1.terms).toHaveLength(2);

      // 학생2: 1개 차수
      const s2 = map.get('s2')!;
      expect(s2.totalTerms).toBe(1);
      expect(s2.currentTermNumber).toBe(1);
    });
  });

  describe('useStudentEnrollmentTerms', () => {
    it('studentId 없으면 비활성화', () => {
      const { result } = renderHook(() => useStudentEnrollmentTerms(undefined), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('학생 차수 이력 month DESC 정렬', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { id: 't1', data: () => ({ studentId: 's1', month: '2026-01', termNumber: 1, status: 'active', source: 'manual', createdAt: '', updatedAt: '' }) },
          { id: 't2', data: () => ({ studentId: 's1', month: '2026-03', termNumber: 1, status: 'active', source: 'manual', createdAt: '', updatedAt: '' }) },
          { id: 't3', data: () => ({ studentId: 's1', month: '2026-02', termNumber: 1, status: 'active', source: 'manual', createdAt: '', updatedAt: '' }) },
        ],
      } as any);

      const { result } = renderHook(() => useStudentEnrollmentTerms('s1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data![0].month).toBe('2026-03');
      expect(result.current.data![1].month).toBe('2026-02');
      expect(result.current.data![2].month).toBe('2026-01');
    });
  });

  describe('mutation hooks', () => {
    it('useCreateEnrollmentTerm 초기화', () => {
      const { result } = renderHook(() => useCreateEnrollmentTerm(), {
        wrapper: createWrapper(),
      });
      expect(result.current.mutateAsync).toBeDefined();
    });

    it('useUpdateEnrollmentTerm 초기화', () => {
      const { result } = renderHook(() => useUpdateEnrollmentTerm(), {
        wrapper: createWrapper(),
      });
      expect(result.current.mutateAsync).toBeDefined();
    });

    it('useCancelEnrollmentTerm 초기화', () => {
      const { result } = renderHook(() => useCancelEnrollmentTerm(), {
        wrapper: createWrapper(),
      });
      expect(result.current.mutateAsync).toBeDefined();
    });
  });
});
