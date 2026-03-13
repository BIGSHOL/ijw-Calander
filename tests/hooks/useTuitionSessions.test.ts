import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useTuitionSessions } from '../../hooks/useTuitionSessions';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
  limit: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useTuitionSessions Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (collection as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  describe('초기 상태 및 데이터 로딩', () => {
    it('초기에는 isLoading이 true이다', () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionSessions(), { wrapper: createWrapper() });
      expect(result.current.isLoading).toBe(true);
    });

    it('세션 기간 데이터를 로드한다', async () => {
      const mockDocs = [
        {
          id: 'session1',
          data: () => ({
            id: 'session1',
            year: 2026,
            category: '수학',
            month: 3,
            ranges: [{ start: '2026-03-03', end: '2026-03-28' }],
            sessions: 20,
          }),
        },
        {
          id: 'session2',
          data: () => ({
            id: 'session2',
            year: 2026,
            category: '영어',
            month: 3,
            ranges: [{ start: '2026-03-04', end: '2026-03-27' }],
            sessions: 16,
          }),
        },
      ];
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: false, docs: mockDocs });
      const { result } = renderHook(() => useTuitionSessions(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.sessions).toHaveLength(2);
    });

    it('세션이 없으면 빈 배열을 반환한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionSessions(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.sessions).toEqual([]);
    });
  });

  describe('뮤테이션 함수 존재 여부', () => {
    it('saveSession, deleteSession 함수가 존재한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionSessions(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(typeof result.current.saveSession).toBe('function');
      expect(typeof result.current.deleteSession).toBe('function');
    });
  });
});
