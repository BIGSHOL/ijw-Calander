import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { usePayroll } from '../../hooks/usePayroll';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('usePayroll', () => {
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

    const { result } = renderHook(() => usePayroll('2026-01'), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('records');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('createRecord');
    expect(result.current).toHaveProperty('updateRecord');
  });

  it('should default records to empty array', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => usePayroll('2026-01'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.records).toEqual([]);
  });

  it('should not fetch when month is empty', () => {
    const { result } = renderHook(() => usePayroll(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.records).toEqual([]);
  });

  it('should fetch payroll records', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'p1', data: () => ({ staffName: '김선생', month: '2026-01', baseSalary: 3000000, netPay: 2500000, status: 'confirmed' }) },
        { id: 'p2', data: () => ({ staffName: '이선생', month: '2026-01', baseSalary: 2800000, netPay: 2300000, status: 'draft' }) },
      ],
    } as any);

    const { result } = renderHook(() => usePayroll('2026-01'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.records).toHaveLength(2);
  });

  it('should have mutation functions', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => usePayroll('2026-01'), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.createRecord.mutateAsync).toBe('function');
    expect(typeof result.current.updateRecord.mutateAsync).toBe('function');
  });
});
