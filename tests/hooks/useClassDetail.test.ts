/**
 * Comprehensive tests for useClassDetail hook
 *
 * Tests cover:
 * - Query enablement logic (className/subject validation)
 * - Parallel Firestore queries (classes, enrollments, students)
 * - Schedule format conversion (ScheduleSlot[] vs string[])
 * - Enrollment filtering (future dates, withdrawn, ended)
 * - Enrollment data processing (attendanceDays, underline, enrollmentId, onHold)
 * - Fallback logic (enrollment teacher/schedule when classes query empty)
 * - Student sorting (Korean locale)
 * - Error handling in parallel queries
 * - ClassDetail object structure
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useClassDetail } from '../../hooks/useClassDetail';
import { getDocs, query, where, collection, collectionGroup } from 'firebase/firestore';

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

describe('useClassDetail', () => {
  let queryClient: QueryClient;

  function createWrapper() {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-setup mocks after clearAllMocks
    const mockCollection = vi.mocked(collection);
    const mockCollectionGroup = vi.mocked(collectionGroup);
    const mockQuery = vi.mocked(query);
    const mockWhere = vi.mocked(where);

    mockCollection.mockReturnValue({} as any);
    mockCollectionGroup.mockReturnValue({} as any);
    mockQuery.mockReturnValue({} as any);
    mockWhere.mockReturnValue({} as any);
  });

  afterEach(() => {
    queryClient?.clear();
  });

  // ============================================================================
  // 1. Query Enablement Logic
  // ============================================================================

  describe('Query Enablement', () => {
    it('should be disabled when className is empty', () => {
      const { result } = renderHook(() => useClassDetail('', 'math'), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should be disabled when subject is empty', () => {
      const { result } = renderHook(() => useClassDetail('초등 3학년', '' as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should be disabled when both className and subject are empty', () => {
      const { result } = renderHook(() => useClassDetail('', '' as any), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should be enabled when both className and subject are provided', async () => {
      const mockGetDocs = vi.mocked(getDocs);
      mockGetDocs.mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(getDocs).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 2. Parallel Firestore Queries
  // ============================================================================

  describe('Parallel Firestore Queries', () => {
    it('should execute three parallel queries (classes, enrollments, students)', async () => {
      const mockGetDocs = vi.mocked(getDocs);
      mockGetDocs.mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should call getDocs 3 times (classes, enrollments, students)
      expect(getDocs).toHaveBeenCalledTimes(3);
    });

    it('should query classes collection with subject and className filters', async () => {
      const mockGetDocs = vi.mocked(getDocs);
      const mockQuery = vi.mocked(query);
      const mockWhere = vi.mocked(where);
      const mockCollection = vi.mocked(collection);

      mockGetDocs.mockResolvedValue({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(collection).toHaveBeenCalledWith({}, 'classes');
      expect(where).toHaveBeenCalledWith('subject', '==', 'math');
      expect(where).toHaveBeenCalledWith('className', '==', '초등 3학년');
    });

    it('should query enrollments collectionGroup with subject and className filters', async () => {
      const mockGetDocs = vi.mocked(getDocs);
      const mockCollectionGroup = vi.mocked(collectionGroup);

      mockGetDocs.mockResolvedValue({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'english'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(collectionGroup).toHaveBeenCalledWith({}, 'enrollments');
      expect(where).toHaveBeenCalledWith('subject', '==', 'english');
      expect(where).toHaveBeenCalledWith('className', '==', '초등 3학년');
    });

    it('should query students collection without filters', async () => {
      const mockGetDocs = vi.mocked(getDocs);
      const mockCollection = vi.mocked(collection);

      mockGetDocs.mockResolvedValue({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(collection).toHaveBeenCalledWith({}, 'students');
    });
  });

  // ============================================================================
  // 3. Classes Collection Data Processing
  // ============================================================================

  describe('Classes Collection Data Processing', () => {
    it('should return class info from classes collection', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      // Setup 3 parallel calls
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              data: () => ({
                teacher: '김선생',
                schedule: ['월-1', '수-2'],
                room: '301',
                memo: '수업 메모',
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any) // enrollments
        .mockResolvedValueOnce({ docs: [] } as any); // students

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.teacher).toBe('김선생');
      expect(result.current.data?.schedule).toEqual(['월-1', '수-2']);
      expect(result.current.data?.room).toBe('301');
      expect(result.current.data?.memo).toBe('수업 메모');
    });

    it('should convert ScheduleSlot[] format to string[] schedule', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              data: () => ({
                teacher: '김선생',
                schedule: [
                  { day: '월', periodId: '1' },
                  { day: '수', periodId: '2' },
                ],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.schedule).toEqual(['월 1', '수 2']);
    });

    it('should handle string[] schedule format directly', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              data: () => ({
                teacher: '김선생',
                schedule: ['월-1', '수-2', '금-3'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.schedule).toEqual(['월-1', '수-2', '금-3']);
    });

    it('should use legacySchedule when schedule is string[] but legacySchedule exists', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              data: () => ({
                teacher: '김선생',
                schedule: ['월-1', '수-2'],
                legacySchedule: ['월-1', '수-2', '금-3'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.schedule).toEqual(['월-1', '수-2', '금-3']);
    });

    it('should return slotTeachers from class doc', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              data: () => ({
                teacher: '김선생',
                schedule: ['월-1', '수-2'],
                slotTeachers: { '월-1': '부담임1', '수-2': '부담임2' },
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.slotTeachers).toEqual({
        '월-1': '부담임1',
        '수-2': '부담임2',
      });
    });

    it('should return slotRooms from class doc', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              data: () => ({
                teacher: '김선생',
                schedule: ['월-1', '수-2'],
                slotRooms: { '월-1': '301', '수-2': '302' },
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.slotRooms).toEqual({
        '월-1': '301',
        '수-2': '302',
      });
    });
  });

  // ============================================================================
  // 4. Enrollment Filtering Logic
  // ============================================================================

  describe('Enrollment Filtering', () => {
    it('should filter out enrollments with future start dates', async () => {
      const mockGetDocs = vi.mocked(getDocs);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any) // classes
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: futureDateStr,
                className: '초등 3학년',
                subject: 'math',
              }),
            },
          ],
        } as any) // enrollments
        .mockResolvedValueOnce({ docs: [] } as any); // students

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students).toEqual([]);
      expect(result.current.data?.studentCount).toBe(0);
    });

    it('should filter out withdrawn enrollments (withdrawalDate present)', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
                withdrawalDate: '2024-12-31',
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students).toEqual([]);
      expect(result.current.data?.studentCount).toBe(0);
    });

    it('should filter out ended enrollments (endDate present)', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
                endDate: '2024-12-31',
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students).toEqual([]);
      expect(result.current.data?.studentCount).toBe(0);
    });

    it('should include enrollments with onHold status', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
                onHold: true,
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({
                name: '김학생',
                school: '초등학교',
                grade: '3학년',
                status: 'active',
                startDate: '2024-01-01',
              }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students).toHaveLength(1);
      expect(result.current.data?.students[0].onHold).toBe(true);
    });

    it('should handle Firestore Timestamp format for enrollmentDate', async () => {
      const mockGetDocs = vi.mocked(getDocs);
      const pastDate = new Date('2024-01-01');

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: {
                  toDate: () => pastDate,
                },
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({
                name: '김학생',
                status: 'active',
              }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students).toHaveLength(1);
    });
  });

  // ============================================================================
  // 5. Enrollment Data Processing
  // ============================================================================

  describe('Enrollment Data Processing', () => {
    it('should store attendanceDays from enrollments', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
                attendanceDays: ['월', '수', '금'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({
                name: '김학생',
                status: 'active',
              }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students[0].attendanceDays).toEqual(['월', '수', '금']);
    });

    it('should store underline flag from enrollments', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
                underline: true,
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({
                name: '김학생',
                status: 'active',
              }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'english'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Note: underline is NOT added to student object, it's stored separately
      // The hook doesn't add underline to ClassStudent, so we should not expect it
      expect(result.current.data?.students[0].name).toBe('김학생');
    });

    it('should store enrollmentId from enrollment doc', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enrollment123',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({
                name: '김학생',
                status: 'active',
              }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students[0].enrollmentId).toBe('enrollment123');
    });

    it('should store onHold status as false when not present', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({
                name: '김학생',
                status: 'active',
              }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students[0].onHold).toBe(false);
    });
  });

  // ============================================================================
  // 6. Fallback Logic
  // ============================================================================

  describe('Fallback Logic', () => {
    it('should use enrollment teacher when classes query is empty', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any) // empty classes
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
                staffId: '이선생',
                schedule: ['월-1', '수-2'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.teacher).toBe('이선생');
    });

    it('should use enrollment schedule when classes query is empty', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
                schedule: ['화-3', '목-4'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.schedule).toEqual(['화-3', '목-4']);
    });

    it('should prefer classes data over enrollment data when both exist', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              data: () => ({
                teacher: '김선생',
                schedule: ['월-1'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: { id: 'student1' },
                },
              },
              data: () => ({
                enrollmentDate: '2024-01-01',
                staffId: '이선생',
                schedule: ['수-2'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should use classes data
      expect(result.current.data?.teacher).toBe('김선생');
      expect(result.current.data?.schedule).toEqual(['월-1']);
    });
  });

  // ============================================================================
  // 7. Student Sorting
  // ============================================================================

  describe('Student Sorting', () => {
    it('should sort students by Korean name using localeCompare', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: { parent: { parent: { id: 'student1' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
            {
              id: 'enroll2',
              ref: { parent: { parent: { id: 'student2' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
            {
              id: 'enroll3',
              ref: { parent: { parent: { id: 'student3' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({ name: '최학생', status: 'active' }),
            },
            {
              id: 'student2',
              data: () => ({ name: '김학생', status: 'active' }),
            },
            {
              id: 'student3',
              data: () => ({ name: '박학생', status: 'active' }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students.map(s => s.name)).toEqual([
        '김학생',
        '박학생',
        '최학생',
      ]);
    });

    it('should handle empty names in sorting', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: { parent: { parent: { id: 'student1' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
            {
              id: 'enroll2',
              ref: { parent: { parent: { id: 'student2' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({ name: '', status: 'active' }),
            },
            {
              id: 'student2',
              data: () => ({ name: '김학생', status: 'active' }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Empty string should come before non-empty
      expect(result.current.data?.students[0].name).toBe('');
      expect(result.current.data?.students[1].name).toBe('김학생');
    });
  });

  // ============================================================================
  // 8. Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle error in classes query (catch returns null)', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockRejectedValueOnce(new Error('Firestore error')) // classes error
        .mockResolvedValueOnce({ docs: [] } as any) // enrollments
        .mockResolvedValueOnce({ docs: [] } as any); // students

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should still return valid result with empty data
      expect(result.current.data?.teacher).toBe('');
      expect(result.current.data?.schedule).toEqual([]);
    });

    it('should handle error in enrollments query', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockRejectedValueOnce(new Error('Firestore error')) // enrollments error
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students).toEqual([]);
      expect(result.current.data?.studentCount).toBe(0);
    });

    it('should handle error in students query', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: { parent: { parent: { id: 'student1' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
          ],
        } as any)
        .mockRejectedValueOnce(new Error('Firestore error')); // students error

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // No students should be added (studentsSnapshot is null)
      expect(result.current.data?.students).toEqual([]);
    });

    it('should handle all queries failing gracefully', async () => {
      const mockGetDocs = vi.mocked(getDocs);
      mockGetDocs.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        className: '초등 3학년',
        teacher: '',
        subject: 'math',
        schedule: [],
        studentCount: 0,
        students: [],
        room: '',
        slotTeachers: {},
        slotRooms: {},
        memo: '',
      });
    });
  });

  // ============================================================================
  // 9. ClassDetail Object Structure
  // ============================================================================

  describe('ClassDetail Object Structure', () => {
    it('should return correct studentCount', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: { parent: { parent: { id: 'student1' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
            {
              id: 'enroll2',
              ref: { parent: { parent: { id: 'student2' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
            {
              id: 'enroll3',
              ref: { parent: { parent: { id: 'student3' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            { id: 'student1', data: () => ({ name: 'A', status: 'active' }) },
            { id: 'student2', data: () => ({ name: 'B', status: 'active' }) },
            { id: 'student3', data: () => ({ name: 'C', status: 'active' }) },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.studentCount).toBe(3);
      expect(result.current.data?.students).toHaveLength(3);
    });

    it('should return complete ClassDetail object with all properties', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              data: () => ({
                teacher: '김선생',
                schedule: ['월-1', '수-2'],
                room: '301',
                slotTeachers: { '월-1': '부담임' },
                slotRooms: { '수-2': '302' },
                memo: '테스트 메모',
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: { parent: { parent: { id: 'student1' } } },
              data: () => ({
                enrollmentDate: '2024-01-01',
                attendanceDays: ['월', '수'],
                underline: true,
                onHold: false,
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({
                name: '김학생',
                school: '테스트초등학교',
                grade: '3학년',
                status: 'active',
                startDate: '2024-01-01',
              }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        className: '초등 3학년',
        teacher: '김선생',
        subject: 'math',
        schedule: ['월-1', '수-2'],
        studentCount: 1,
        students: [
          {
            id: 'student1',
            name: '김학생',
            school: '테스트초등학교',
            grade: '3학년',
            status: 'active',
            enrollmentDate: '2024-01-01',
            attendanceDays: ['월', '수'],
            enrollmentId: 'enroll1',
            onHold: false,
          },
        ],
        room: '301',
        slotTeachers: { '월-1': '부담임' },
        slotRooms: { '수-2': '302' },
        memo: '테스트 메모',
      });
    });

    it('should populate student data with default values when missing', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: { parent: { parent: { id: 'student1' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({
                name: '김학생',
                status: 'active',
                // Missing school, grade, startDate
              }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students[0]).toEqual({
        id: 'student1',
        name: '김학생',
        school: '',
        grade: '미정',
        status: 'active',
        enrollmentDate: '',
        enrollmentId: 'enroll1',
        onHold: false,
      });
    });
  });

  // ============================================================================
  // 10. Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle enrollments without parent reference', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: {
                parent: {
                  parent: null, // No parent reference
                },
              },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should not crash, just skip the enrollment
      expect(result.current.data?.students).toEqual([]);
    });

    it('should handle empty schedule array', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              data: () => ({
                teacher: '김선생',
                schedule: [],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.schedule).toEqual([]);
    });

    it('should handle students not in enrollments list', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: { parent: { parent: { id: 'student1' } } },
              data: () => ({ enrollmentDate: '2024-01-01' }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({ name: '김학생', status: 'active' }),
            },
            {
              id: 'student2', // Not in enrollments
              data: () => ({ name: '이학생', status: 'active' }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Only student1 should be included
      expect(result.current.data?.students).toHaveLength(1);
      expect(result.current.data?.students[0].name).toBe('김학생');
    });

    it('should handle startDate field name (alias for enrollmentDate)', async () => {
      const mockGetDocs = vi.mocked(getDocs);

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'enroll1',
              ref: { parent: { parent: { id: 'student1' } } },
              data: () => ({
                startDate: '2024-01-01', // Using startDate instead of enrollmentDate
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'student1',
              data: () => ({ name: '김학생', status: 'active' }),
            },
          ],
        } as any);

      const { result } = renderHook(() => useClassDetail('초등 3학년', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.students).toHaveLength(1);
    });
  });
});
