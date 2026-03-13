import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useTuitionHolidays } from '../../hooks/useTuitionHolidays';
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

describe('useTuitionHolidays Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (collection as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  describe('초기 상태 및 데이터 로딩', () => {
    it('초기에는 isLoading이 true이다', () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionHolidays(), { wrapper: createWrapper() });
      expect(result.current.isLoading).toBe(true);
    });

    it('공휴일 데이터를 로드한다', async () => {
      const mockDocs = [
        { id: '2026-01-01', data: () => ({ id: '2026-01-01', date: '2026-01-01', name: '신정', year: 2026 }) },
        { id: '2026-03-01', data: () => ({ id: '2026-03-01', date: '2026-03-01', name: '삼일절', year: 2026 }) },
      ];
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: false, docs: mockDocs });
      const { result } = renderHook(() => useTuitionHolidays(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.holidays).toHaveLength(2);
    });

    it('공휴일이 없으면 빈 배열을 반환한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionHolidays(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.holidays).toEqual([]);
    });

    it('holidayDateSet이 공휴일 날짜 Set을 반환한다', async () => {
      const mockDocs = [
        { id: '2026-01-01', data: () => ({ id: '2026-01-01', date: '2026-01-01', name: '신정', year: 2026 }) },
      ];
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: false, docs: mockDocs });
      const { result } = renderHook(() => useTuitionHolidays(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.holidayDateSet).toBeInstanceOf(Set);
      expect(result.current.holidayDateSet.has('2026-01-01')).toBe(true);
    });
  });

  describe('뮤테이션 함수 존재 여부', () => {
    it('saveHoliday, deleteHoliday, migrateHolidays 함수가 존재한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionHolidays(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(typeof result.current.saveHoliday).toBe('function');
      expect(typeof result.current.deleteHoliday).toBe('function');
      expect(typeof result.current.migrateHolidays).toBe('function');
    });
  });
});
