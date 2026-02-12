import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useResources } from '../../hooks/useResources';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useResources', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('리소스 목록 조회 및 정렬', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'r1', data: () => ({ title: '자료1', isPinned: false, order: 2, createdAt: '2026-01-01' }) },
        { id: 'r2', data: () => ({ title: '자료2', isPinned: true, order: 1, createdAt: '2026-01-02' }) },
        { id: 'r3', data: () => ({ title: '자료3', isPinned: false, order: 1, createdAt: '2026-01-03' }) },
      ],
    } as any);

    const { result } = renderHook(() => useResources(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // 고정된 항목이 먼저
    expect(result.current.data![0].id).toBe('r2');
  });
});
