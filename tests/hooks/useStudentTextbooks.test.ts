import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useStudentTextbooks } from '../../hooks/useStudentTextbooks';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useStudentTextbooks', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return expected properties', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(
      () => useStudentTextbooks({ studentId: 'student1' }),
      { wrapper: createWrapper() },
    );

    expect(result.current).toHaveProperty('distributions');
    expect(result.current).toHaveProperty('billings');
    expect(result.current).toHaveProperty('stats');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });

  it('should default distributions and billings to empty arrays', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(
      () => useStudentTextbooks({ studentId: 'student1' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.distributions).toEqual([]);
    expect(result.current.billings).toEqual([]);
  });

  it('should compute stats from data', async () => {
    vi.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [
          { id: 'd1', data: () => ({ textbookName: '수학1', studentId: 'student1', quantity: 2, distributedAt: '2026-01-10' }) },
          { id: 'd2', data: () => ({ textbookName: '수학2', studentId: 'student1', quantity: 1, distributedAt: '2026-01-15' }) },
        ],
      } as any)
      .mockResolvedValueOnce({
        docs: [
          { id: 'b1', data: () => ({ studentId: 'student1', textbookName: '수학1', amount: 15000, importedAt: '2026-01-10' }) },
        ],
      } as any);

    const { result } = renderHook(
      () => useStudentTextbooks({ studentId: 'student1' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.totalDistributed).toBe(3);
    expect(result.current.stats.totalBillingAmount).toBe(15000);
    expect(result.current.stats.billingCount).toBe(1);
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(
      () => useStudentTextbooks({ studentId: 'student1', enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.distributions).toEqual([]);
    expect(result.current.billings).toEqual([]);
  });

  it('should not fetch when studentId is empty', () => {
    const { result } = renderHook(
      () => useStudentTextbooks({ studentId: '' }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(false);
  });
});
