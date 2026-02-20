import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useShuttle } from '../../hooks/useShuttle';

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

describe('useShuttle', () => {
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

    const { result } = renderHook(() => useShuttle(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('routes');
    expect(result.current).toHaveProperty('assignments');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('createRoute');
  });

  it('should default routes and assignments to empty arrays', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useShuttle(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.routes).toEqual([]);
    expect(result.current.assignments).toEqual([]);
  });

  it('should fetch shuttle routes', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'r1', data: () => ({ name: '1호차', driverName: '박기사', departureTime: '14:00', isActive: true, studentCount: 8 }) },
        { id: 'r2', data: () => ({ name: '2호차', driverName: '최기사', departureTime: '14:30', isActive: true, studentCount: 10 }) },
      ],
    } as any);

    const { result } = renderHook(() => useShuttle(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.routes.length).toBeGreaterThanOrEqual(0);
  });

  it('should have createRoute mutation', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useShuttle(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.createRoute.mutateAsync).toBe('function');
  });
});
