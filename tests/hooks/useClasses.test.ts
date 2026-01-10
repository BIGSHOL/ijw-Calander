import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useClasses } from '../../hooks/useClasses';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy, where, collectionGroup } from 'firebase/firestore';

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

  const mockClasses = [
    {
      id: 'class1',
      className: '수학 A반',
      teacher: '김선생',
      subject: 'math' as const,
      schedule: ['월 14:00', '수 14:00'],
      studentCount: 5,
    },
    {
      id: 'class2',
      className: '영어 B반',
      teacher: '이선생',
      subject: 'english' as const,
      schedule: ['화 15:00', '목 15:00'],
      studentCount: 8,
    },
    {
      id: 'class3',
      className: '수학 B반',
      teacher: '박선생',
      subject: 'math' as const,
      schedule: ['금 16:00'],
      studentCount: 3,
    },
  ];

  const mockEnrollments = [
    {
      id: 'enroll1',
      className: '수학 A반',
      teacher: '김선생',
      subject: 'math',
      ref: { parent: { parent: { id: 'student1' } } },
    },
    {
      id: 'enroll2',
      className: '영어 B반',
      teacher: '이선생',
      subject: 'english',
      ref: { parent: { parent: { id: 'student2' } } },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (collection as any).mockReturnValue({});
    (query as any).mockImplementation((...args) => args[0]);
    (orderBy as any).mockReturnValue({});
    (where as any).mockReturnValue({});
    (collectionGroup as any).mockReturnValue({});

    // Set localStorage default
    localStorage.setItem('useNewDataStructure', 'true');
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Fetching from New Structure (enrollments)', () => {
    it('should fetch all classes from enrollments', async () => {
      const mockDocs = mockEnrollments.map((enrollment) => ({
        id: enrollment.id,
        data: () => enrollment,
        ref: enrollment.ref,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBeGreaterThan(0);
    });

    it('should filter classes by subject (math)', async () => {
      const mathEnrollments = mockEnrollments.filter((e) => e.subject === 'math');
      const mockDocs = mathEnrollments.map((enrollment) => ({
        id: enrollment.id,
        data: () => enrollment,
        ref: enrollment.ref,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useClasses('math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      // All returned classes should be math
      result.current.data?.forEach((classInfo) => {
        expect(classInfo.subject).toBe('math');
      });
    });

    it('should filter classes by subject (english)', async () => {
      const englishEnrollments = mockEnrollments.filter((e) => e.subject === 'english');
      const mockDocs = englishEnrollments.map((enrollment) => ({
        id: enrollment.id,
        data: () => enrollment,
        ref: enrollment.ref,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useClasses('english'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      // All returned classes should be english
      result.current.data?.forEach((classInfo) => {
        expect(classInfo.subject).toBe('english');
      });
    });

    it('should return empty array when no enrollments exist', async () => {
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

  describe('Fetching from Old Structure (수업목록)', () => {
    beforeEach(() => {
      localStorage.setItem('useNewDataStructure', 'false');
    });

    it('should fetch all classes from old structure', async () => {
      const mockDocs = mockClasses.map((classInfo) => ({
        id: classInfo.id,
        data: () => ({
          className: classInfo.className,
          teacher: classInfo.teacher,
          schedule: classInfo.schedule,
          studentIds: new Array(classInfo.studentCount).fill('student-id'),
        }),
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      const { result } = renderHook(() => useClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(3);
    });

    it('should filter classes by subject from old structure', async () => {
      const mathClasses = mockClasses.filter((c) => c.subject === 'math');
      const mockDocs = mathClasses.map((classInfo) => ({
        id: classInfo.id,
        data: () => ({
          className: classInfo.className,
          teacher: classInfo.teacher,
          schedule: classInfo.schedule,
          studentIds: new Array(classInfo.studentCount).fill('student-id'),
        }),
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockClasses.map((classInfo) => ({
          id: classInfo.id,
          data: () => ({
            className: classInfo.className,
            teacher: classInfo.teacher,
            schedule: classInfo.schedule,
            studentIds: new Array(classInfo.studentCount).fill('student-id'),
          }),
        })),
        empty: false,
        size: mockClasses.length,
      });

      const { result } = renderHook(() => useClasses('math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      // Should only return math classes
      result.current.data?.forEach((classInfo) => {
        expect(classInfo.subject).toBe('math');
      });
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
    it('should cache results with 10 minute staleTime', async () => {
      const mockDocs = mockEnrollments.map((enrollment) => ({
        id: enrollment.id,
        data: () => enrollment,
        ref: enrollment.ref,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
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
