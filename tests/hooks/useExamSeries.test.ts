import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useExamSeries } from '../../hooks/useExamSeries';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useExamSeries', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('시험 시리즈 목록 조회', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 's1', data: () => ({ name: '1월 모의고사', createdAt: 1000 }) },
        { id: 's2', data: () => ({ name: '2월 모의고사', createdAt: 2000 }) },
      ],
    } as any);

    const { result } = renderHook(() => useExamSeries(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('1월 모의고사');
  });
});
