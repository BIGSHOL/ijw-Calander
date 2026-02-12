import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useStudentBilling } from '../../hooks/useStudentBilling';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useStudentBilling', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('enabled=false이면 쿼리 비활성화', () => {
    const { result } = renderHook(
      () => useStudentBilling({ studentName: '홍길동', enabled: false }),
      { wrapper: createWrapper() }
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.records).toEqual([]);
  });

  it('studentName 빈 문자열이면 쿼리 비활성화', () => {
    const { result } = renderHook(
      () => useStudentBilling({ studentName: '' }),
      { wrapper: createWrapper() }
    );
    expect(result.current.records).toEqual([]);
  });

  it('수납 기록 조회 및 통계 계산', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: 'b1',
          data: () => ({
            studentName: '홍길동',
            month: '2026-01',
            billedAmount: 300000,
            discountAmount: 50000,
            paidAmount: 250000,
            unpaidAmount: 0,
            status: 'paid',
          }),
        },
        {
          id: 'b2',
          data: () => ({
            studentName: '홍길동',
            month: '2026-02',
            billedAmount: 300000,
            discountAmount: 0,
            paidAmount: 0,
            unpaidAmount: 300000,
            status: 'pending',
          }),
        },
      ],
    } as any);

    const { result } = renderHook(
      () => useStudentBilling({ studentName: '홍길동' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.records).toHaveLength(2);

    // 통계 검증
    expect(result.current.stats.totalBilled).toBe(600000);
    expect(result.current.stats.totalDiscount).toBe(50000);
    expect(result.current.stats.totalPaid).toBe(250000);
    expect(result.current.stats.totalUnpaid).toBe(300000);
    expect(result.current.stats.pendingCount).toBe(1);
    expect(result.current.stats.paidCount).toBe(1);
  });

  it('month 역순 정렬 확인', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'b1', data: () => ({ month: '2026-01', billedAmount: 0, discountAmount: 0, paidAmount: 0, unpaidAmount: 0, status: 'paid' }) },
        { id: 'b2', data: () => ({ month: '2026-03', billedAmount: 0, discountAmount: 0, paidAmount: 0, unpaidAmount: 0, status: 'paid' }) },
        { id: 'b3', data: () => ({ month: '2026-02', billedAmount: 0, discountAmount: 0, paidAmount: 0, unpaidAmount: 0, status: 'paid' }) },
      ],
    } as any);

    const { result } = renderHook(
      () => useStudentBilling({ studentName: '홍길동' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.records).toHaveLength(3));
    expect(result.current.records[0].month).toBe('2026-03');
    expect(result.current.records[1].month).toBe('2026-02');
    expect(result.current.records[2].month).toBe('2026-01');
  });
});
