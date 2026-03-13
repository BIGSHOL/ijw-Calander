import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useTuitionExtras } from '../../hooks/useTuitionExtras';
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

describe('useTuitionExtras Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (collection as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  describe('초기 상태 및 데이터 로딩', () => {
    it('초기에는 isLoading이 true이다', () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionExtras(), { wrapper: createWrapper() });
      expect(result.current.isLoading).toBe(true);
    });

    it('DB가 비어있으면 isEmpty가 true이다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionExtras(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isEmpty).toBe(true);
    });

    it('DB에서 부가 항목을 로드한다', async () => {
      const mockDocs = [
        { id: 'extra1', data: () => ({ id: 'extra1', category: '교재', name: '수학교재', defaultPrice: 20000 }) },
        { id: 'extra2', data: () => ({ id: 'extra2', category: '셔틀', name: '셔틀버스', defaultPrice: 50000 }) },
      ];
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: false, docs: mockDocs });
      const { result } = renderHook(() => useTuitionExtras(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.extras).toHaveLength(2);
      expect(result.current.isEmpty).toBe(false);
    });

    it('DB가 비어있으면 effectiveExtras로 하드코딩 상수를 반환한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionExtras(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // effectiveExtras는 TUITION_SERVICE_EXTRAS 폴백이므로 빈 배열이 아님
      expect(result.current.extras.length).toBeGreaterThan(0);
    });
  });

  describe('뮤테이션 함수 존재 여부', () => {
    it('updateExtra, addExtra, deleteExtra, seedExtras 함수가 존재한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionExtras(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(typeof result.current.updateExtra).toBe('function');
      expect(typeof result.current.addExtra).toBe('function');
      expect(typeof result.current.deleteExtra).toBe('function');
      expect(typeof result.current.seedExtras).toBe('function');
    });
  });
});
