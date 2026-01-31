import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useStudents } from '../../hooks/useStudents';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, collectionGroup, getDoc } from 'firebase/firestore';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  collectionGroup: vi.fn(),
  orderBy: vi.fn(),
}));

// Mock Firebase app
vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

describe('useStudents Hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  const mockStudents = [
    {
      id: 'student1',
      name: '김철수',
      birthdate: '2010-05-15',
      school: '테스트초등학교',
      grade: '초5',
      phone: '010-1234-5678',
      parentPhone: '010-8765-4321',
      address: '서울시 강남구',
      startDate: '2024-03-01',
      enrollments: [],
      status: 'active',
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-03-01T00:00:00Z',
    },
    {
      id: 'student2',
      name: '이영희',
      birthdate: '2011-08-22',
      school: '테스트중학교',
      grade: '중3',
      phone: '010-2345-6789',
      parentPhone: '010-9876-5432',
      address: '서울시 서초구',
      startDate: '2024-03-01',
      enrollments: [],
      status: 'active',
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-03-01T00:00:00Z',
    },
  ];

  const mockWithdrawnStudent = {
    id: 'student3',
    name: '박민수',
    birthdate: '2009-12-10',
    school: '테스트고등학교',
    grade: '고2',
    phone: '010-3456-7890',
    parentPhone: '010-7654-3210',
    address: '서울시 송파구',
    startDate: '2023-03-01',
    withdrawalDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    enrollments: [],
    status: 'withdrawn',
    createdAt: '2023-03-01T00:00:00Z',
    updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup default mocks
    (collection as any).mockReturnValue({});
    (doc as any).mockReturnValue({});
    (query as any).mockImplementation((...args: any[]) => args[0]);
    (where as any).mockReturnValue({});
    (collectionGroup as any).mockReturnValue({});
    (getDoc as any).mockResolvedValue({
      exists: () => false,
      id: '',
      data: () => ({}),
    });
  });

  describe('Querying Students', () => {
    it('should fetch active students by default', async () => {
      // Setup mock to return active students
      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.students).toHaveLength(2);
      expect(result.current.students[0].name).toBe('김철수');
      expect(result.current.students[1].name).toBe('이영희');
    });

    it('should include withdrawn students when includeWithdrawn is true', async () => {
      // includeWithdrawn=true: single query for ALL students, then enrollments
      const allStudents = [...mockStudents, mockWithdrawnStudent];
      const allMockDocs = allStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      // Mock 1: all students (single query)
      (getDocs as any).mockResolvedValueOnce({
        docs: allMockDocs,
        empty: false,
        size: allMockDocs.length,
      });
      // Mock 2: enrollments collectionGroup (empty)
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });

      const { result } = renderHook(() => useStudents(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.students).toHaveLength(3);
      expect(result.current.students.some((s) => s.id === 'student3')).toBe(true);
    });

    it('should return all students including withdrawn when includeWithdrawn is true', async () => {
      const oldWithdrawnStudent = {
        ...mockWithdrawnStudent,
        id: 'student4',
        name: '정수영',
        status: 'withdrawn' as const,
      };

      const recentWithdrawnStudent = {
        ...mockWithdrawnStudent,
        id: 'student5',
        name: '최민호',
        status: 'withdrawn' as const,
      };

      // includeWithdrawn=true: single query returns ALL students
      const allStudents = [...mockStudents, oldWithdrawnStudent, recentWithdrawnStudent];
      const allMockDocs = allStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      // Mock 1: all students
      (getDocs as any).mockResolvedValueOnce({
        docs: allMockDocs,
        empty: false,
        size: allMockDocs.length,
      });
      // Mock 2: enrollments (empty)
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });

      const { result } = renderHook(() => useStudents(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // All students returned (no date-based filtering)
      expect(result.current.students).toHaveLength(4);
      expect(result.current.students.some((s) => s.id === 'student4')).toBe(true);
      expect(result.current.students.some((s) => s.id === 'student5')).toBe(true);
    });

    it('should return empty array when no students exist', async () => {
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });

      (collectionGroup as any).mockReturnValue({});
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.students).toEqual([]);
    });

    it('should handle query errors gracefully', async () => {
      const mockError = new Error('Firestore query failed');
      (getDocs as any).mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('getStudent by ID', () => {
    it('should return student when found', async () => {
      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });

      // Mock getDoc for getStudent function
      (getDoc as any).mockResolvedValueOnce({
        exists: () => true,
        id: 'student1',
        data: () => mockStudents[0],
      });

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const student = await result.current.getStudent('student1');
      expect(student).toBeDefined();
      expect(student?.name).toBe('김철수');
    });

    it('should return undefined when student not found', async () => {
      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValueOnce({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
        empty: true,
        size: 0,
      });

      // Mock getDoc for non-existent student
      (getDoc as any).mockResolvedValueOnce({
        exists: () => false,
        id: 'nonexistent-id',
        data: () => undefined,
      });

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const student = await result.current.getStudent('nonexistent-id');
      expect(student).toBeNull();
    });
  });

  describe('addStudent Mutation', () => {
    it('should add a new student successfully', async () => {
      const newStudent = {
        name: '최지훈',
        birthdate: '2012-03-18',
        school: '테스트초등학교',
        grade: '초4',
        phone: '010-4567-8901',
        parentPhone: '010-6543-2109',
        address: '서울시 강동구',
        startDate: '2024-03-01',
        enrollments: [],
        status: 'active' as const,
      };

      (addDoc as any).mockResolvedValueOnce({
        id: 'student-new',
      });

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.addStudent(newStudent);

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: '최지훈',
          status: 'active',
        })
      );
    });

    it('should handle add student errors', async () => {
      const newStudent = {
        name: '최지훈',
        birthdate: '2012-03-18',
        school: '테스트초등학교',
        grade: '초4',
        phone: '010-4567-8901',
        parentPhone: '010-6543-2109',
        address: '서울시 강동구',
        startDate: '2024-03-01',
        enrollments: [],
        status: 'active' as const,
      };

      const mockError = new Error('Failed to add student');
      (addDoc as any).mockRejectedValueOnce(mockError);

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(result.current.addStudent(newStudent)).rejects.toThrow('Failed to add student');
    });
  });

  describe('updateStudent Mutation', () => {
    it('should update student successfully', async () => {
      const updatedData = {
        school: '변경된초등학교',
        grade: '초6',
      };

      (updateDoc as any).mockResolvedValueOnce(undefined);

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.updateStudent('student1', updatedData);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining(updatedData)
      );
    });

    it('should handle update student errors', async () => {
      const updatedData = {
        school: '변경된초등학교',
      };

      const mockError = new Error('Failed to update student');
      (updateDoc as any).mockRejectedValueOnce(mockError);

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(result.current.updateStudent('student1', updatedData)).rejects.toThrow(
        'Failed to update student'
      );
    });
  });

  describe('deleteStudent Mutation', () => {
    it('should soft delete student by default', async () => {
      (updateDoc as any).mockResolvedValueOnce(undefined);

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.deleteStudent('student1');

      // Should call updateDoc to set status to withdrawn, not deleteDoc
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'withdrawn',
        })
      );
    });

    it('should hard delete student when hardDelete is true', async () => {
      (deleteDoc as any).mockResolvedValueOnce(undefined);

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.deleteStudent('student1', true);

      expect(deleteDoc).toHaveBeenCalledWith(expect.anything());
    });

    it('should handle delete student errors', async () => {
      const mockError = new Error('Failed to delete student');
      (updateDoc as any).mockRejectedValueOnce(mockError);

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(result.current.deleteStudent('student1')).rejects.toThrow('Failed to delete student');
    });
  });

  describe('refreshStudents', () => {
    it('should refetch students data', async () => {
      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = (getDocs as any).mock.calls.length;

      await result.current.refreshStudents();

      await waitFor(() => {
        expect((getDocs as any).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Loading and Mutation States', () => {
    it('should expose isAdding mutation state', async () => {
      const newStudent = {
        name: '최지훈',
        birthdate: '2012-03-18',
        school: '테스트초등학교',
        grade: '초4',
        phone: '010-4567-8901',
        parentPhone: '010-6543-2109',
        address: '서울시 강동구',
        startDate: '2024-03-01',
        enrollments: [],
        status: 'active' as const,
      };

      (addDoc as any).mockResolvedValueOnce({ id: 'new-id' });

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have isAdding state available
      expect(result.current.isAdding).toBeDefined();
      expect(typeof result.current.isAdding).toBe('boolean');

      await result.current.addStudent(newStudent);

      // Mutation completed successfully
      expect(addDoc).toHaveBeenCalled();
    });

    it('should expose isUpdating mutation state', async () => {
      (updateDoc as any).mockResolvedValueOnce(undefined);

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have isUpdating state available
      expect(result.current.isUpdating).toBeDefined();
      expect(typeof result.current.isUpdating).toBe('boolean');

      await result.current.updateStudent('student1', { school: '변경된초등학교' });

      // Mutation completed successfully
      expect(updateDoc).toHaveBeenCalled();
    });

    it('should expose isDeleting mutation state', async () => {
      (updateDoc as any).mockResolvedValueOnce(undefined);

      const mockDocs = mockStudents.map((student) => ({
        id: student.id,
        data: () => student,
      }));

      (getDocs as any).mockResolvedValue({
        docs: mockDocs,
        empty: false,
        size: mockDocs.length,
      });

      (collectionGroup as any).mockReturnValue({});

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have isDeleting state available
      expect(result.current.isDeleting).toBeDefined();
      expect(typeof result.current.isDeleting).toBe('boolean');

      await result.current.deleteStudent('student1');

      // Mutation completed successfully
      expect(updateDoc).toHaveBeenCalled();
    });
  });
});
