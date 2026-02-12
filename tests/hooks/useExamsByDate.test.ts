import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { useExamsByDateRange } from '../../hooks/useExamsByDate';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useExamsByDate', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('startDate/endDate 없으면 비활성', async () => {
    const { result } = renderHook(
      () => useExamsByDateRange('', ''),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('유효한 날짜 범위면 쿼리 활성화', () => {
    const { result } = renderHook(
      () => useExamsByDateRange('2026-01-01', '2026-01-31'),
      { wrapper: createWrapper() }
    );
    expect(result.current.isLoading).toBe(true);
  });
});
