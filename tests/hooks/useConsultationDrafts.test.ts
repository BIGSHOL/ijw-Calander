import { vi } from 'vitest';

const { mockOnSnapshot } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: mockOnSnapshot,
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useConsultationDrafts, usePendingDraftCount } from '../../hooks/useConsultationDrafts';

describe('useConsultationDrafts', () => {
  beforeEach(() => {
    mockOnSnapshot.mockImplementation((_q: any, callback: any) => {
      callback({
        docs: [
          { id: 'd1', data: () => ({ status: 'pending', submittedAt: '2026-01-01' }) },
        ],
      });
      return vi.fn(); // unsubscribe
    });
  });

  it('drafts 목록 로드', async () => {
    const { result } = renderHook(() => useConsultationDrafts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].id).toBe('d1');
  });
});

describe('usePendingDraftCount', () => {
  beforeEach(() => {
    mockOnSnapshot.mockImplementation((_q: any, callback: any) => {
      callback({ size: 3 });
      return vi.fn();
    });
  });

  it('pending draft 개수 반환', async () => {
    const { result } = renderHook(() => usePendingDraftCount());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(3);
  });
});
