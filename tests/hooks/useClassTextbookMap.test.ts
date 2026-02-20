import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useClassTextbookMap } from '../../hooks/useClassTextbookMap';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useClassTextbookMap', () => {
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

    const { result } = renderHook(() => useClassTextbookMap(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('byClassId');
    expect(result.current).toHaveProperty('byClassName');
    expect(result.current).toHaveProperty('byStudentName');
  });

  it('should return empty maps when no data', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useClassTextbookMap(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.byClassId).toBeDefined();
    });

    expect(result.current.byClassId.size).toBe(0);
    expect(result.current.byClassName.size).toBe(0);
    expect(result.current.byStudentName.size).toBe(0);
  });

  it('should build maps from distribution data', async () => {
    vi.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [
          { id: 'd1', data: () => ({ classId: 'c1', className: '수학A반', textbookName: '수학교재1', distributedAt: '2026-01-10', studentId: 's1', studentName: '김철수', quantity: 1 }) },
          { id: 'd2', data: () => ({ classId: 'c2', className: '영어B반', textbookName: '영어교재1', distributedAt: '2026-01-15', studentId: 's2', studentName: '이영희', quantity: 1 }) },
        ],
      } as any)
      .mockResolvedValueOnce({
        docs: [
          { id: 'b1', data: () => ({ studentName: '김철수', textbookName: '수학교재1', month: '2026-01', amount: 15000, importedAt: '2026-01-10' }) },
        ],
      } as any);

    const { result } = renderHook(() => useClassTextbookMap(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.byClassId.size).toBeGreaterThan(0);
    });

    expect(result.current.byClassId.get('c1')?.textbookName).toBe('수학교재1');
    expect(result.current.byClassName.get('수학A반')?.textbookName).toBe('수학교재1');
    expect(result.current.byStudentName.get('김철수')?.textbookName).toBe('수학교재1');
  });
});
