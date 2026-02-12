import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useGanttDepartments } from '../../hooks/useGanttDepartments';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useGanttDepartments', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('빈 컬렉션이면 기본 부서 반환', async () => {
    vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as any);

    const { result } = renderHook(() => useGanttDepartments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0].id).toBe('math');
  });

  it('데이터가 있으면 매핑하여 반환', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      empty: false,
      docs: [
        { id: 'custom', data: () => ({ label: '커스텀', order: 0, color: '#ff0000' }) },
      ],
    } as any);

    const { result } = renderHook(() => useGanttDepartments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].label).toBe('커스텀');
  });
});
