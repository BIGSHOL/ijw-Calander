import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useNotices } from '../../hooks/useNotices';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  increment: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useNotices', () => {
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

    const { result } = renderHook(() => useNotices(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('notices');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('createNotice');
    expect(result.current).toHaveProperty('updateNotice');
    expect(result.current).toHaveProperty('deleteNotice');
    expect(result.current).toHaveProperty('togglePin');
    expect(result.current).toHaveProperty('togglePublish');
    expect(result.current).toHaveProperty('incrementViewCount');
  });

  it('should default notices to empty array', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useNotices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.notices).toEqual([]);
  });

  it('should fetch notices list', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'n1', data: () => ({ title: '공지1', category: 'general', priority: 'normal', isPinned: false, isPublished: true, viewCount: 5 }) },
        { id: 'n2', data: () => ({ title: '공지2', category: 'urgent', priority: 'urgent', isPinned: true, isPublished: true, viewCount: 20 }) },
      ],
    } as any);

    const { result } = renderHook(() => useNotices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.notices).toHaveLength(2);
    expect(result.current.notices[0].id).toBe('n1');
  });

  it('should have all mutation functions', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useNotices(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.createNotice.mutateAsync).toBe('function');
    expect(typeof result.current.updateNotice.mutateAsync).toBe('function');
    expect(typeof result.current.deleteNotice.mutateAsync).toBe('function');
    expect(typeof result.current.togglePin.mutateAsync).toBe('function');
    expect(typeof result.current.togglePublish.mutateAsync).toBe('function');
    expect(typeof result.current.incrementViewCount.mutateAsync).toBe('function');
  });
});
