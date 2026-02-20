import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { getDocs } from 'firebase/firestore';
import { useParentMessages } from '../../hooks/useParentMessages';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('useParentMessages', () => {
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

    const { result } = renderHook(() => useParentMessages(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('messages');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('sendMessage');
  });

  it('should default messages to empty array', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useParentMessages(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.messages).toEqual([]);
  });

  it('should fetch messages list', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'm1', data: () => ({ type: 'sms', content: '출석 안내', status: 'sent', recipientCount: 5 }) },
        { id: 'm2', data: () => ({ type: 'kakao', content: '수납 안내', status: 'draft', recipientCount: 10 }) },
      ],
    } as any);

    const { result } = renderHook(() => useParentMessages(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].id).toBe('m1');
  });

  it('should have sendMessage mutation', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const { result } = renderHook(() => useParentMessages(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.sendMessage.mutateAsync).toBe('function');
  });
});
