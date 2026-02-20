import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useAnalytics } from '../../hooks/useAnalytics';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useAnalytics', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return expected properties', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [],
    } as any);

    const { result } = renderHook(() => useAnalytics('2026-01'), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('kpis');
    expect(result.current).toHaveProperty('revenueData');
    expect(result.current).toHaveProperty('studentTrend');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });

  it('should have correct default values before data loads', () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useAnalytics('2026-01'), {
      wrapper: createWrapper(),
    });

    expect(result.current.revenueData).toEqual([]);
    expect(result.current.studentTrend).toEqual([]);
  });

  it('should not fetch when month is empty', () => {
    const { result } = renderHook(() => useAnalytics(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.kpis).toBeNull();
  });

  it('should compute KPIs from billing and student data', async () => {
    vi.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ billedAmount: 1000, paidAmount: 800 }) },
          { data: () => ({ billedAmount: 2000, paidAmount: 2000 }) },
        ],
      } as any)
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ status: 'active' }) },
          { data: () => ({ status: 'active' }) },
          { data: () => ({ status: 'withdrawn' }) },
        ],
      } as any);

    const { result } = renderHook(() => useAnalytics('2026-01'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.kpis).not.toBeNull();
    expect(result.current.kpis!.monthlyRevenue).toBe(2800);
    expect(result.current.kpis!.activeStudents).toBe(2);
  });
});
