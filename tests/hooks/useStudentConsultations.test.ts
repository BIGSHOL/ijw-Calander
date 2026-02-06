import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import {
  useStudentConsultations,
  useStudentConsultationHistory,
  useFollowUpConsultations,
  usePaginatedConsultations,
  getFollowUpUrgency,
  getFollowUpDaysLeft,
  COL_STUDENT_CONSULTATIONS,
  DEFAULT_PAGE_SIZE,
} from '../../hooks/useStudentConsultations';
import type { Consultation } from '../../types';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

// Helper to create a consultation
const createConsultation = (overrides: Partial<Consultation> = {}): Consultation => ({
  id: `c-${Math.random().toString(36).substr(2, 5)}`,
  studentId: 'student1',
  studentName: '학생1',
  school: '테스트초등학교',
  grade: '초5',
  consultantId: 'teacher1',
  consultantName: '선생님1',
  date: '2026-02-01',
  type: 'parent',
  category: 'academic',
  subject: 'math',
  title: '상담 제목',
  content: '상담 내용',
  followUpNeeded: false,
  followUpDone: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'teacher1',
  ...overrides,
});

// Helper to create QueryClient wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

// Mock Firestore snapshot
const createMockSnapshot = (consultations: Consultation[]) => ({
  docs: consultations.map(c => ({
    id: c.id,
    data: () => {
      const { id, ...data } = c;
      return data;
    },
  })),
});

describe('useStudentConsultations Hook', () => {
  let mockGetDocs: ReturnType<typeof vi.fn>;
  let mockQuery: ReturnType<typeof vi.fn>;
  let mockWhere: ReturnType<typeof vi.fn>;
  let mockOrderBy: ReturnType<typeof vi.fn>;
  let mockLimit: ReturnType<typeof vi.fn>;
  let mockCollection: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetDocs = vi.mocked(getDocs);
    mockQuery = vi.mocked(query);
    mockWhere = vi.mocked(where);
    mockOrderBy = vi.mocked(orderBy);
    mockLimit = vi.mocked(limit);
    mockCollection = vi.mocked(collection);

    mockGetDocs.mockReset();
    mockQuery.mockReset();
    mockWhere.mockReset();
    mockOrderBy.mockReset();
    mockLimit.mockReset();
    mockCollection.mockReset();

    // Default mock implementations
    mockCollection.mockReturnValue({} as any);
    mockQuery.mockImplementation((...args) => args as any);
    mockWhere.mockImplementation((field, op, value) => ({ field, op, value }) as any);
    mockOrderBy.mockImplementation((field, dir) => ({ field, dir }) as any);
    mockLimit.mockImplementation((count) => ({ count }) as any);
  });

  describe('Constants', () => {
    it('COL_STUDENT_CONSULTATIONS has correct value', () => {
      expect(COL_STUDENT_CONSULTATIONS).toBe('student_consultations');
    });

    it('DEFAULT_PAGE_SIZE has correct value', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(50);
    });
  });

  describe('getFollowUpUrgency - Pure Function', () => {
    it('returns null when followUpNeeded is false', () => {
      const consultation = createConsultation({
        followUpNeeded: false,
        followUpDone: false,
      });

      expect(getFollowUpUrgency(consultation)).toBeNull();
    });

    it('returns "done" when followUpDone is true', () => {
      const consultation = createConsultation({
        followUpNeeded: true,
        followUpDone: true,
        followUpDate: '2026-02-10',
      });

      expect(getFollowUpUrgency(consultation)).toBe('done');
    });

    it('returns "pending" when no followUpDate', () => {
      const consultation = createConsultation({
        followUpNeeded: true,
        followUpDone: false,
        followUpDate: undefined,
      });

      expect(getFollowUpUrgency(consultation)).toBe('pending');
    });

    it('returns "urgent" when followUpDate is within 3 days', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const followUpDate = tomorrow.toISOString().split('T')[0];

      const consultation = createConsultation({
        followUpNeeded: true,
        followUpDone: false,
        followUpDate,
      });

      expect(getFollowUpUrgency(consultation)).toBe('urgent');
    });

    it('returns "urgent" when followUpDate is today', () => {
      const today = new Date().toISOString().split('T')[0];

      const consultation = createConsultation({
        followUpNeeded: true,
        followUpDone: false,
        followUpDate: today,
      });

      expect(getFollowUpUrgency(consultation)).toBe('urgent');
    });

    it('returns "pending" when followUpDate is more than 3 days away', () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      const followUpDate = future.toISOString().split('T')[0];

      const consultation = createConsultation({
        followUpNeeded: true,
        followUpDone: false,
        followUpDate,
      });

      expect(getFollowUpUrgency(consultation)).toBe('pending');
    });
  });

  describe('getFollowUpDaysLeft - Pure Function', () => {
    it('returns positive number for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      const followUpDate = future.toISOString().split('T')[0];

      const daysLeft = getFollowUpDaysLeft(followUpDate);
      expect(daysLeft).toBeGreaterThan(0);
      expect(daysLeft).toBeCloseTo(5, 0);
    });

    it('returns 0 for today', () => {
      const today = new Date().toISOString().split('T')[0];
      const daysLeft = getFollowUpDaysLeft(today);
      expect(daysLeft).toBe(0);
    });

    it('returns negative number for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      const followUpDate = past.toISOString().split('T')[0];

      const daysLeft = getFollowUpDaysLeft(followUpDate);
      expect(daysLeft).toBeLessThan(0);
      expect(daysLeft).toBeCloseTo(-3, 0);
    });
  });

  describe('useStudentConsultations - Basic Functionality', () => {
    it('returns empty array when no data', async () => {
      mockGetDocs.mockResolvedValue(createMockSnapshot([]));

      const { result } = renderHook(() => useStudentConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it.skip('returns consultations array when data exists', async () => {
      const consultations = [
        createConsultation({ id: 'c1', title: '상담1' }),
        createConsultation({ id: 'c2', title: '상담2' }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(() => useStudentConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(2);
      expect(result.current.consultations[0].title).toBe('상담1');
      expect(result.current.consultations[1].title).toBe('상담2');
    });

    it('sets loading to true initially, then false after data loads', async () => {
      mockGetDocs.mockResolvedValue(createMockSnapshot([]));

      const { result } = renderHook(() => useStudentConsultations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('provides refetch function', async () => {
      mockGetDocs.mockResolvedValue(createMockSnapshot([]));

      const { result } = renderHook(() => useStudentConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('useStudentConsultations - Server-side Filtering', () => {
    it('with studentId filter: uses single where clause only', async () => {
      mockGetDocs.mockResolvedValue(createMockSnapshot([]));

      renderHook(() => useStudentConsultations({ studentId: 'student123' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetDocs).toHaveBeenCalled();
      });

      expect(mockWhere).toHaveBeenCalledWith('studentId', '==', 'student123');
      expect(mockOrderBy).not.toHaveBeenCalled();
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it('without studentId: applies type filter as where clause', async () => {
      mockGetDocs.mockResolvedValue(createMockSnapshot([]));

      renderHook(() => useStudentConsultations({ type: 'parent' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetDocs).toHaveBeenCalled();
      });

      expect(mockWhere).toHaveBeenCalledWith('type', '==', 'parent');
    });

    it('without studentId: applies consultantId filter as where clause', async () => {
      mockGetDocs.mockResolvedValue(createMockSnapshot([]));

      renderHook(() => useStudentConsultations({ consultantId: 'teacher1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetDocs).toHaveBeenCalled();
      });

      expect(mockWhere).toHaveBeenCalledWith('consultantId', '==', 'teacher1');
    });

    it('without studentId: applies category filter as where clause', async () => {
      mockGetDocs.mockResolvedValue(createMockSnapshot([]));

      renderHook(() => useStudentConsultations({ category: 'academic' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetDocs).toHaveBeenCalled();
      });

      expect(mockWhere).toHaveBeenCalledWith('category', '==', 'academic');
    });

    it('without studentId: applies subject filter as where clause', async () => {
      mockGetDocs.mockResolvedValue(createMockSnapshot([]));

      renderHook(() => useStudentConsultations({ subject: 'math' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetDocs).toHaveBeenCalled();
      });

      expect(mockWhere).toHaveBeenCalledWith('subject', '==', 'math');
    });

    it('without studentId: adds orderBy and limit', async () => {
      mockGetDocs.mockResolvedValue(createMockSnapshot([]));

      renderHook(() => useStudentConsultations({ type: 'parent' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetDocs).toHaveBeenCalled();
      });

      expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(200);
    });
  });

  describe('useStudentConsultations - Client-side Filtering', () => {
    it('with studentId + type: client-side filters type', async () => {
      const consultations = [
        createConsultation({ id: 'c1', studentId: 'student1', type: 'parent' }),
        createConsultation({ id: 'c2', studentId: 'student1', type: 'student' }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultations({ studentId: 'student1', type: 'parent' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].type).toBe('parent');
    });

    it('with studentId + category: client-side filters category', async () => {
      const consultations = [
        createConsultation({ id: 'c1', studentId: 'student1', category: 'academic' }),
        createConsultation({ id: 'c2', studentId: 'student1', category: 'behavior' }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultations({ studentId: 'student1', category: 'academic' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].category).toBe('academic');
    });

    it('with studentId + subject: client-side filters subject', async () => {
      const consultations = [
        createConsultation({ id: 'c1', studentId: 'student1', subject: 'math' }),
        createConsultation({ id: 'c2', studentId: 'student1', subject: 'english' }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultations({ studentId: 'student1', subject: 'math' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].subject).toBe('math');
    });

    it('dateRange filter: filters by start and end dates', async () => {
      const consultations = [
        createConsultation({ id: 'c1', date: '2026-02-01' }),
        createConsultation({ id: 'c2', date: '2026-02-05' }),
        createConsultation({ id: 'c3', date: '2026-02-10' }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultations({ dateRange: { start: '2026-02-02', end: '2026-02-09' } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].id).toBe('c2');
    });

    it('followUpStatus "needed": filters followUpNeeded && !followUpDone', async () => {
      const consultations = [
        createConsultation({ id: 'c1', followUpNeeded: true, followUpDone: false }),
        createConsultation({ id: 'c2', followUpNeeded: true, followUpDone: true }),
        createConsultation({ id: 'c3', followUpNeeded: false, followUpDone: false }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultations({ followUpStatus: 'needed' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].id).toBe('c1');
    });

    it('followUpStatus "done": filters followUpNeeded && followUpDone', async () => {
      const consultations = [
        createConsultation({ id: 'c1', followUpNeeded: true, followUpDone: false }),
        createConsultation({ id: 'c2', followUpNeeded: true, followUpDone: true }),
        createConsultation({ id: 'c3', followUpNeeded: false, followUpDone: false }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultations({ followUpStatus: 'done' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].id).toBe('c2');
    });

    it('searchQuery: filters by studentName (case insensitive)', async () => {
      const consultations = [
        createConsultation({ id: 'c1', studentName: '홍길동' }),
        createConsultation({ id: 'c2', studentName: '김철수' }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultations({ searchQuery: '길동' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].studentName).toBe('홍길동');
    });

    it('searchQuery: filters by title (case insensitive)', async () => {
      const consultations = [
        createConsultation({ id: 'c1', title: 'Math Progress' }),
        createConsultation({ id: 'c2', title: 'English Test' }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultations({ searchQuery: 'progress' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].title).toBe('Math Progress');
    });

    it('searchQuery: filters by content (case insensitive)', async () => {
      const consultations = [
        createConsultation({ id: 'c1', content: '학생이 열심히 노력하고 있습니다' }),
        createConsultation({ id: 'c2', content: '집중력 향상이 필요합니다' }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultations({ searchQuery: '열심히' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].content).toContain('열심히');
    });
  });

  describe('useStudentConsultations - Sorting', () => {
    it('sorts by date descending, then by createdAt descending', async () => {
      const consultations = [
        createConsultation({ id: 'c1', date: '2026-02-01', createdAt: 1000 }),
        createConsultation({ id: 'c2', date: '2026-02-05', createdAt: 2000 }),
        createConsultation({ id: 'c3', date: '2026-02-05', createdAt: 3000 }),
        createConsultation({ id: 'c4', date: '2026-02-10', createdAt: 4000 }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(() => useStudentConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const sorted = result.current.consultations;
      expect(sorted[0].id).toBe('c4'); // Latest date
      expect(sorted[1].id).toBe('c3'); // Same date, higher createdAt
      expect(sorted[2].id).toBe('c2'); // Same date, lower createdAt
      expect(sorted[3].id).toBe('c1'); // Earliest date
    });
  });

  describe('useStudentConsultationHistory', () => {
    it('calls useStudentConsultations with studentId filter', async () => {
      const consultations = [
        createConsultation({ id: 'c1', studentId: 'student123' }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => useStudentConsultationHistory('student123'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockWhere).toHaveBeenCalledWith('studentId', '==', 'student123');
      expect(result.current.consultations).toHaveLength(1);
    });
  });

  describe('useFollowUpConsultations', () => {
    it('calls useStudentConsultations with followUpStatus=needed', async () => {
      const consultations = [
        createConsultation({ id: 'c1', followUpNeeded: true, followUpDone: false }),
        createConsultation({ id: 'c2', followUpNeeded: true, followUpDone: true }),
      ];
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(() => useFollowUpConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(1);
      expect(result.current.consultations[0].id).toBe('c1');
    });
  });

  describe('usePaginatedConsultations', () => {
    it('returns correct page of data', async () => {
      const consultations = Array.from({ length: 100 }, (_, i) =>
        createConsultation({ id: `c${i}`, date: `2026-02-${String(i + 1).padStart(2, '0')}` })
      );
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => usePaginatedConsultations({}, { page: 2, pageSize: 10 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(10);
      expect(result.current.currentPage).toBe(2);
    });

    it('calculates totalCount correctly', async () => {
      const consultations = Array.from({ length: 75 }, (_, i) =>
        createConsultation({ id: `c${i}` })
      );
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(() => usePaginatedConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.totalCount).toBe(75);
    });

    it('calculates totalPages correctly', async () => {
      const consultations = Array.from({ length: 75 }, (_, i) =>
        createConsultation({ id: `c${i}` })
      );
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => usePaginatedConsultations({}, { pageSize: 10 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.totalPages).toBe(8); // 75 / 10 = 8 pages
    });

    it('calculates hasNextPage correctly', async () => {
      const consultations = Array.from({ length: 100 }, (_, i) =>
        createConsultation({ id: `c${i}` })
      );
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => usePaginatedConsultations({}, { page: 1, pageSize: 50 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasNextPage).toBe(true);
    });

    it('calculates hasPrevPage correctly', async () => {
      const consultations = Array.from({ length: 100 }, (_, i) =>
        createConsultation({ id: `c${i}` })
      );
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(
        () => usePaginatedConsultations({}, { page: 2, pageSize: 50 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasPrevPage).toBe(true);
    });

    it('uses DEFAULT_PAGE_SIZE when not specified', async () => {
      const consultations = Array.from({ length: 100 }, (_, i) =>
        createConsultation({ id: `c${i}` })
      );
      mockGetDocs.mockResolvedValue(createMockSnapshot(consultations));

      const { result } = renderHook(() => usePaginatedConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.consultations).toHaveLength(50);
    });

    it('applies filters correctly', async () => {
      // studentId 필터는 서버사이드 where 절로 적용되므로
      // mock은 해당 학생의 데이터만 반환해야 함
      const student1Consultations = Array.from({ length: 30 }, (_, i) =>
        createConsultation({ id: `c${i}`, studentId: 'student1' })
      );
      mockGetDocs.mockResolvedValue(createMockSnapshot(student1Consultations));

      const { result } = renderHook(
        () => usePaginatedConsultations({ studentId: 'student1' }, { pageSize: 10 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.totalCount).toBe(30);
      expect(result.current.consultations.every(c => c.studentId === 'student1')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('returns error message when getDocs fails', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() => useStudentConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Firestore error');
      expect(result.current.consultations).toEqual([]);
    });

    it('returns error message in usePaginatedConsultations when getDocs fails', async () => {
      mockGetDocs.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePaginatedConsultations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.consultations).toEqual([]);
    });
  });
});
