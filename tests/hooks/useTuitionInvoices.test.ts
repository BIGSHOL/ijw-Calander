import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useTuitionInvoices } from '../../hooks/useTuitionInvoices';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

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
  getDoc: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useTuitionInvoices Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (collection as ReturnType<typeof vi.fn>).mockReturnValue({});
    (query as ReturnType<typeof vi.fn>).mockImplementation((...args) => args[0]);
    (orderBy as ReturnType<typeof vi.fn>).mockReturnValue({});
    (limit as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  describe('초기 상태 및 데이터 로딩', () => {
    it('초기에는 isLoading이 true이다', () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionInvoices(), { wrapper: createWrapper() });
      expect(result.current.isLoading).toBe(true);
    });

    it('청구서 데이터를 로드한다', async () => {
      const mockDocs = [
        {
          id: '260312_홍길동_중학교2',
          data: () => ({
            id: '260312_홍길동_중학교2',
            studentInfo: { name: '홍길동', school: '중학교', grade: '2' },
            courses: [],
            extras: [],
            discounts: [],
            totalAmount: 300000,
            createdAt: '2026-03-12T10:00:00Z',
            updatedAt: '2026-03-12T10:00:00Z',
          }),
        },
      ];
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: false, docs: mockDocs });
      const { result } = renderHook(() => useTuitionInvoices(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.invoices).toHaveLength(1);
    });

    it('청구서가 없으면 빈 배열을 반환한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionInvoices(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.invoices).toEqual([]);
    });
  });

  describe('searchByName 기능', () => {
    it('이름으로 청구서를 필터링한다', async () => {
      const mockDocs = [
        { id: 'inv1', data: () => ({ id: 'inv1', studentInfo: { name: '홍길동', school: '중학교', grade: '2' }, courses: [], extras: [], discounts: [], totalAmount: 300000, createdAt: '', updatedAt: '' }) },
        { id: 'inv2', data: () => ({ id: 'inv2', studentInfo: { name: '김철수', school: '고등학교', grade: '1' }, courses: [], extras: [], discounts: [], totalAmount: 400000, createdAt: '', updatedAt: '' }) },
      ];
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: false, docs: mockDocs });
      const { result } = renderHook(() => useTuitionInvoices(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const filtered = result.current.searchByName('홍길동');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].studentInfo.name).toBe('홍길동');
    });
  });

  describe('뮤테이션 함수 존재 여부', () => {
    it('saveInvoice, updateInvoice, deleteInvoice 함수가 존재한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionInvoices(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(typeof result.current.saveInvoice).toBe('function');
      expect(typeof result.current.updateInvoice).toBe('function');
      expect(typeof result.current.deleteInvoice).toBe('function');
    });
  });
});
