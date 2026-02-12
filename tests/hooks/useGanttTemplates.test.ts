import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { useGanttTemplates } from '../../hooks/useGanttTemplates';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  Timestamp: { now: () => ({ toMillis: () => Date.now() }) },
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useGanttTemplates', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('userId 없으면 비활성', async () => {
    const { result } = renderHook(
      () => useGanttTemplates({ userId: undefined }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('string 형태의 userId도 지원 (하위 호환)', () => {
    const { result } = renderHook(
      () => useGanttTemplates('user1'),
      { wrapper: createWrapper() }
    );
    expect(result.current.isLoading).toBe(true);
  });
});
