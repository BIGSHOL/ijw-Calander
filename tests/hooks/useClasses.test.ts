import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useClasses } from '../../hooks/useClasses';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  collectionGroup: vi.fn(),
}));

// Mock Firebase app
vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

describe('useClasses Hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  // Class documents from 'classes' collection
  const mockClassDocs = [
    {
      id: 'class1',
      data: () => ({
        className: '수학 A반',
        teacher: '김선생',
        subject: 'math',
        isActive: true,
        schedule: [{ day: '월', periodId: '14:00' }, { day: '수', periodId: '14:00' }],
      }),
    },
    {
      id: 'class2',
      data: () => ({
        className: '영어 B반',
        teacher: '이선생',
        subject: 'english',
        isActive: true,
        schedule: [{ day: '화', periodId: '15:00' }],
      }),
    },
    {
      id: 'class3',
      data: () => ({
        className: '수학 B반',
        teacher: '박선생',
        subject: 'math',
        isActive: true,
        schedule: [],
      }),
    },
  ];

  // Enrollment documents from collectionGroup('enrollments') for student count calculation
  const mockEnrollmentDocs = [
    {
      id: 'e1',
      data: () => ({ className: '수학 A반', subject: 'math' }),
      ref: { parent: { parent: { id: 'student1' } } },
    },
    {
      id: 'e2',
      data: () => ({ className: '수학 A반', subject: 'math' }),
      ref: { parent: { parent: { id: 'student2' } } },
    },
    {
      id: 'e3',
      data: () => ({ className: '영어 B반', subject: 'english' }),
      ref: { parent: { parent: { id: 'student3' } } },
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup default mocks
    (collection as any).mockReturnValue({});
    (query as any).mockImplementation((...args: any[]) => args[0]);
    (where as any).mockReturnValue({});
    (collectionGroup as any).mockReturnValue({});
  });

  describe('Fetching Classes', () => {
    it('should fetch all classes', async () => {
      // Mock 1: classes collection query
      (getDocs as any).mockResolvedValueOnce({
        docs: mockClassDocs,
        empty: false,
        size: mockClassDocs.length,
      });
      // Mock 2: enrollments collectionGroup (for student count)
      (getDocs as any).mockResolvedValueOnce({
        docs: mockEnrollmentDocs,
        empty: false,
        size: mockEnrollmentDocs.length,
      });

      const { result } = renderHook(() => useClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(3);

      // Verify student counts from enrollments
      const mathA = result.current.data!.find(c => c.className === '수학 A반');
      expect(mathA?.studentCount).toBe(2);
      const englishB = result.current.data!.find(c => c.className === '영어 B반');
      expect(englishB?.studentCount).toBe(1);
    });

    it('should filter classes by subject (math)', async () => {
      const mathDocs = mockClassDocs.filter(d => d.data().subject === 'math');
      const mathEnrollments = mockEnrollmentDocs.filter(d => d.data().subject === 'math');

      (getDocs as any).mockResolvedValueOnce({
        docs: mathDocs,
        empty: false,
        size: mathDocs.length,
      });
      (getDocs as any).mockResolvedValueOnce({
        docs: mathEnrollments,
        empty: false,
        size: mathEnrollments.length,
      });

      const { result } = renderHook(() => useClasses('math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(2);
      result.current.data?.forEach((classInfo) => {
        expect(classInfo.subject).toBe('math');
      });
    });

    it('should filter classes by subject (english)', async () => {
      const englishDocs = mockClassDocs.filter(d => d.data().subject === 'english');
      const englishEnrollments = mockEnrollmentDocs.filter(d => d.data().subject === 'english');

      (getDocs as any).mockResolvedValueOnce({
        docs: englishDocs,
        empty: false,
        size: englishDocs.length,
      });
      (getDocs as any).mockResolvedValueOnce({
        docs: englishEnrollments,
        empty: false,
        size: englishEnrollments.length,
      });

      const { result } = renderHook(() => useClasses('english'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(1);
      result.current.data?.forEach((classInfo) => {
        expect(classInfo.subject).toBe('english');
      });
    });

    it('should return empty array when no classes exist', async () => {
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });

      const { result } = renderHook(() => useClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors gracefully', async () => {
      const mockError = new Error('Firestore query failed');
      (getDocs as any).mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Caching Behavior', () => {
    it('should cache results with staleTime', async () => {
      (getDocs as any).mockResolvedValue({
        docs: mockClassDocs,
        empty: false,
        size: mockClassDocs.length,
      });

      const { result, rerender } = renderHook(() => useClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstCallCount = (getDocs as any).mock.calls.length;

      // Rerender should use cache, not make another query
      rerender();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not have made additional calls due to caching
      expect((getDocs as any).mock.calls.length).toBe(firstCallCount);
    });
  });
});
