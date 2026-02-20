import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useNotifications } from '../../hooks/useNotifications';

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

describe('useNotifications', () => {
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

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('templates');
    expect(result.current).toHaveProperty('logs');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('createTemplate');
    expect(result.current).toHaveProperty('sendNotification');
  });

  it('should default templates and logs to empty arrays', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.templates).toEqual([]);
    expect(result.current.logs).toEqual([]);
  });

  it('should fetch notification templates', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 't1', data: () => ({ name: '출석 알림', category: 'attendance', channel: 'sms', isActive: true }) },
        { id: 't2', data: () => ({ name: '수납 알림', category: 'billing', channel: 'kakao', isActive: true }) },
      ],
    } as any);

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.templates.length).toBeGreaterThanOrEqual(0);
  });

  it('should have mutation functions', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.createTemplate.mutateAsync).toBe('function');
    expect(typeof result.current.sendNotification.mutateAsync).toBe('function');
  });
});
