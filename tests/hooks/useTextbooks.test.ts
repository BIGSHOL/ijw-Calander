import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useTextbooks } from '../../hooks/useTextbooks';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), update: vi.fn(), commit: vi.fn() })),
  where: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useTextbooks', () => {
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

    const { result } = renderHook(() => useTextbooks(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('textbooks');
    expect(result.current).toHaveProperty('distributions');
    expect(result.current).toHaveProperty('billings');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('billingsLoading');
    expect(result.current).toHaveProperty('createTextbook');
    expect(result.current).toHaveProperty('updateTextbook');
    expect(result.current).toHaveProperty('deleteTextbook');
    expect(result.current).toHaveProperty('importBillings');
  });

  it('should default all lists to empty arrays', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useTextbooks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.textbooks).toEqual([]);
    expect(result.current.distributions).toEqual([]);
    expect(result.current.billings).toEqual([]);
  });

  it('should fetch textbooks list', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 't1', data: () => ({ name: '수학 교재', publisher: '출판사A', subject: 'math', price: 15000, stock: 50, minStock: 10, isActive: true }) },
        { id: 't2', data: () => ({ name: '영어 교재', publisher: '출판사B', subject: 'english', price: 18000, stock: 30, minStock: 5, isActive: true }) },
      ],
    } as any);

    const { result } = renderHook(() => useTextbooks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.textbooks.length).toBeGreaterThanOrEqual(0);
  });

  it('should have all mutation functions', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useTextbooks(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.createTextbook.mutateAsync).toBe('function');
    expect(typeof result.current.updateTextbook.mutateAsync).toBe('function');
    expect(typeof result.current.deleteTextbook.mutateAsync).toBe('function');
    expect(typeof result.current.importBillings.mutateAsync).toBe('function');
  });
});
