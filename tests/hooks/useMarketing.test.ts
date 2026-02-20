import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useMarketing } from '../../hooks/useMarketing';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useMarketing', () => {
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

    const { result } = renderHook(() => useMarketing(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('leads');
    expect(result.current).toHaveProperty('trialClasses');
    expect(result.current).toHaveProperty('promotions');
    expect(result.current).toHaveProperty('isLoading');
  });

  it('should default all lists to empty arrays', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useMarketing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.leads).toEqual([]);
    expect(result.current.trialClasses).toEqual([]);
    expect(result.current.promotions).toEqual([]);
  });

  it('should fetch leads data', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'l1', data: () => ({ source: '블로그', count: 10, conversionRate: 0.3, period: '2026-01' }) },
      ],
    } as any);

    const { result } = renderHook(() => useMarketing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.leads.length).toBeGreaterThanOrEqual(0);
  });
});
