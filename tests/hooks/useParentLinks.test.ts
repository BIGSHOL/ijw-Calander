import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useParentLinks } from '../../hooks/useParentLinks';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useParentLinks', () => {
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

    const { result } = renderHook(() => useParentLinks(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('parentLinks');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('createLink');
    expect(result.current).toHaveProperty('updateLink');
  });

  it('should default parentLinks to empty array', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useParentLinks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.parentLinks).toEqual([]);
  });

  it('should fetch parent links list', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'p1', data: () => ({ parentName: '김부모', parentPhone: '010-1234-5678', relationship: 'mother', studentIds: ['s1'], isActive: true }) },
        { id: 'p2', data: () => ({ parentName: '이부모', parentPhone: '010-9876-5432', relationship: 'father', studentIds: ['s2'], isActive: true }) },
      ],
    } as any);

    const { result } = renderHook(() => useParentLinks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.parentLinks).toHaveLength(2);
    expect(result.current.parentLinks[0].id).toBe('p1');
  });

  it('should have mutation functions', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useParentLinks(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.createLink.mutateAsync).toBe('function');
    expect(typeof result.current.updateLink.mutateAsync).toBe('function');
  });
});
