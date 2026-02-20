import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useContracts } from '../../hooks/useContracts';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useContracts', () => {
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

    const { result } = renderHook(() => useContracts(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('contracts');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('createContract');
    expect(result.current).toHaveProperty('updateContract');
  });

  it('should default contracts to empty array', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useContracts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.contracts).toEqual([]);
  });

  it('should fetch contracts list', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'c1', data: () => ({ studentName: '김철수', status: 'active', type: 'enrollment' }) },
        { id: 'c2', data: () => ({ studentName: '이영희', status: 'draft', type: 'renewal' }) },
      ],
    } as any);

    const { result } = renderHook(() => useContracts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.contracts).toHaveLength(2);
    expect(result.current.contracts[0].id).toBe('c1');
  });

  it('should have mutation functions', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useContracts(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.createContract.mutateAsync).toBe('function');
    expect(typeof result.current.updateContract.mutateAsync).toBe('function');
  });
});
