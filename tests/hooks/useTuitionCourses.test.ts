import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useTuitionCourses } from '../../hooks/useTuitionCourses';
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

describe('useTuitionCourses Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (collection as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  describe('초기 상태 및 데이터 로딩', () => {
    it('초기에는 isLoading이 true이다', () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionCourses(), { wrapper: createWrapper() });
      expect(result.current.isLoading).toBe(true);
    });

    it('DB가 비어있으면 빈 배열을 반환하고 isEmpty가 true이다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionCourses(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isEmpty).toBe(true);
    });

    it('DB에서 과목 데이터를 로드한다', async () => {
      const mockDocs = [
        { id: 'course1', data: () => ({ id: 'course1', category: '수학', name: '수학(주5)', days: 5, defaultPrice: 300000 }) },
        { id: 'course2', data: () => ({ id: 'course2', category: '영어', name: '영어(주3)', days: 3, defaultPrice: 220000 }) },
      ];
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: false, docs: mockDocs });
      const { result } = renderHook(() => useTuitionCourses(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.courses).toHaveLength(2);
      expect(result.current.isEmpty).toBe(false);
    });

    it('DB가 비어있으면 effectiveCourses로 하드코딩 상수를 반환한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionCourses(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // effectiveCourses는 TUITION_COURSES 폴백이므로 빈 배열이 아님
      expect(result.current.courses.length).toBeGreaterThan(0);
    });
  });

  describe('뮤테이션 함수 존재 여부', () => {
    it('updateCoursePrice, addCourse, deleteCourse, seedCourses 함수가 존재한다', async () => {
      (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });
      const { result } = renderHook(() => useTuitionCourses(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(typeof result.current.updateCoursePrice).toBe('function');
      expect(typeof result.current.addCourse).toBe('function');
      expect(typeof result.current.deleteCourse).toBe('function');
      expect(typeof result.current.seedCourses).toBe('function');
    });
  });
});
