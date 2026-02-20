import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useHomework } from '../../hooks/useHomework';

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

describe('useHomework', () => {
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

    const { result } = renderHook(() => useHomework(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('homeworkList');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('createHomework');
    expect(result.current).toHaveProperty('updateHomework');
    expect(result.current).toHaveProperty('deleteHomework');
  });

  it('should default homeworkList to empty array', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useHomework(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.homeworkList).toEqual([]);
  });

  it('should fetch homework list', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'h1', data: () => ({ title: '수학 숙제', classId: 'c1', className: '수학A', subject: 'math', status: 'active' }) },
        { id: 'h2', data: () => ({ title: '영어 숙제', classId: 'c2', className: '영어B', subject: 'english', status: 'closed' }) },
      ],
    } as any);

    const { result } = renderHook(() => useHomework(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.homeworkList).toHaveLength(2);
    expect(result.current.homeworkList[0].id).toBe('h1');
  });

  it('should have mutation functions', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useHomework(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.createHomework.mutateAsync).toBe('function');
    expect(typeof result.current.updateHomework.mutateAsync).toBe('function');
    expect(typeof result.current.deleteHomework.mutateAsync).toBe('function');
  });
});
