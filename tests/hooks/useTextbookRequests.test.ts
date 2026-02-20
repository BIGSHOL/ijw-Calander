import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs, getDoc } from 'firebase/firestore';
import { useTextbookRequests } from '../../hooks/useTextbookRequests';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn() })),
  where: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

vi.mock('../../data/textbookCatalog', () => ({
  TEXTBOOK_CATALOG: [
    { name: '수학교재', price: 15000 },
  ],
}));

describe('useTextbookRequests', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => null } as any);
  });

  it('should return expected properties', async () => {
    const { result } = renderHook(() => useTextbookRequests(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('requests');
    expect(result.current).toHaveProperty('requestsLoading');
    expect(result.current).toHaveProperty('accountSettings');
    expect(result.current).toHaveProperty('settingsLoading');
    expect(result.current).toHaveProperty('catalog');
    expect(result.current).toHaveProperty('stats');
    expect(result.current).toHaveProperty('createRequest');
    expect(result.current).toHaveProperty('updateRequest');
    expect(result.current).toHaveProperty('deleteRequest');
    expect(result.current).toHaveProperty('saveAccountSettings');
    expect(result.current).toHaveProperty('saveCatalog');
    expect(result.current).toHaveProperty('autoMatchBillings');
  });

  it('should default requests to empty array', async () => {
    const { result } = renderHook(() => useTextbookRequests(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.requestsLoading).toBe(false));

    expect(result.current.requests).toEqual([]);
  });

  it('should compute stats from requests', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'r1', data: () => ({ studentName: '김철수', bookName: '수학1', isCompleted: true, isPaid: true, isOrdered: true }) },
        { id: 'r2', data: () => ({ studentName: '이영희', bookName: '수학2', isCompleted: false, isPaid: false, isOrdered: false }) },
        { id: 'r3', data: () => ({ studentName: '박민수', bookName: '수학3', isCompleted: true, isPaid: false, isOrdered: true }) },
      ],
    } as any);

    const { result } = renderHook(() => useTextbookRequests(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.requestsLoading).toBe(false));

    expect(result.current.stats.total).toBe(3);
    expect(result.current.stats.fullyDone).toBe(1);
    expect(result.current.stats.notCompleted).toBe(1);
    expect(result.current.stats.notPaid).toBe(2);
    expect(result.current.stats.notOrdered).toBe(1);
  });

  it('should have default account settings when none exist', async () => {
    const { result } = renderHook(() => useTextbookRequests(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.settingsLoading).toBe(false));

    expect(result.current.accountSettings.bankName).toBe('');
    expect(result.current.accountSettings.accountNumber).toBe('');
    expect(result.current.accountSettings.accountHolder).toBe('');
  });

  it('should have all mutation functions', async () => {
    const { result } = renderHook(() => useTextbookRequests(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.createRequest.mutateAsync).toBe('function');
    expect(typeof result.current.updateRequest.mutateAsync).toBe('function');
    expect(typeof result.current.deleteRequest.mutateAsync).toBe('function');
    expect(typeof result.current.saveAccountSettings.mutateAsync).toBe('function');
    expect(typeof result.current.saveCatalog.mutateAsync).toBe('function');
    expect(typeof result.current.autoMatchBillings).toBe('function');
  });
});
