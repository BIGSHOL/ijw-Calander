import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useManageClassStudents,
  type CreateClassData,
  type UpdateClassData,
  type DeleteClassData,
  type ManageClassStudentsData
} from '../../hooks/useClassMutations';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  collectionGroup: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  collectionGroup,
  setDoc
} from 'firebase/firestore';

// Mock helpers
const createMockDocSnap = (id: string, data: any) => ({
  id,
  data: () => data,
  exists: () => true,
  ref: { id, path: `mock/${id}` },
});

const createMockQuerySnapshot = (docs: any[]) => ({
  docs,
  empty: docs.length === 0,
  size: docs.length,
});

// Test setup
let queryClient: QueryClient;

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe('useClassMutations', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  describe('useCreateClass', () => {
    it('creates class document with correct data', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      const classData: CreateClassData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: ['월 4', '수 4'],
        studentIds: ['student1', 'student2'],
      };

      await act(async () => {
        await result.current.mutateAsync(classData);
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          schedule: [
            { day: '월', periodId: '4' },
            { day: '수', periodId: '4' },
          ],
          legacySchedule: ['월 4', '수 4'],
          isActive: true,
        })
      );
    });

    it('parses schedule strings correctly', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      const classData: CreateClassData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: ['월 4', '화 2', '금 1'],
        studentIds: [],
      };

      await act(async () => {
        await result.current.mutateAsync(classData);
      });

      const callArgs = vi.mocked(addDoc).mock.calls[0][1] as any;
      expect(callArgs.schedule).toEqual([
        { day: '월', periodId: '4' },
        { day: '화', periodId: '2' },
        { day: '금', periodId: '1' },
      ]);
    });

    it('includes room when provided', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      const classData: CreateClassData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: ['월 4'],
        room: '301',
        studentIds: [],
      };

      await act(async () => {
        await result.current.mutateAsync(classData);
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          room: '301',
        })
      );
    });

    it('includes slotTeachers when provided', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      const slotTeachers = { '월-4': 'teacher2', '수-4': 'teacher3' };
      const classData: CreateClassData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: ['월 4', '수 4'],
        slotTeachers,
        studentIds: [],
      };

      await act(async () => {
        await result.current.mutateAsync(classData);
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slotTeachers,
        })
      );
    });

    it('includes slotRooms when provided', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      const slotRooms = { '월-4': '301', '수-4': '302' };
      const classData: CreateClassData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: ['월 4', '수 4'],
        slotRooms,
        studentIds: [],
      };

      await act(async () => {
        await result.current.mutateAsync(classData);
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slotRooms,
        })
      );
    });

    it('creates enrollments for each student', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      const classData: CreateClassData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: ['월 4', '수 4'],
        studentIds: ['student1', 'student2', 'student3'],
      };

      await act(async () => {
        await result.current.mutateAsync(classData);
      });

      // First call is for class creation, then 3 calls for enrollments
      expect(addDoc).toHaveBeenCalledTimes(4);
      expect(collection).toHaveBeenCalledWith({}, 'students', 'student1', 'enrollments');
      expect(collection).toHaveBeenCalledWith({}, 'students', 'student2', 'enrollments');
      expect(collection).toHaveBeenCalledWith({}, 'students', 'student3', 'enrollments');
    });

    it('creates enrollment with correct data structure', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      const classData: CreateClassData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: ['월 4', '수 4'],
        studentIds: ['student1'],
      };

      await act(async () => {
        await result.current.mutateAsync(classData);
      });

      // Second call should be the enrollment creation
      const enrollmentCall = vi.mocked(addDoc).mock.calls[1];
      expect(enrollmentCall[1]).toEqual(
        expect.objectContaining({
          className: 'Math A',
          staffId: 'teacher1',
          teacher: 'teacher1',
          subject: 'math',
          schedule: ['월 4', '수 4'],
        })
      );
    });

    it('handles empty studentIds array', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      const classData: CreateClassData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: ['월 4'],
        studentIds: [],
      };

      await act(async () => {
        await result.current.mutateAsync(classData);
      });

      // Only class creation, no enrollments
      expect(addDoc).toHaveBeenCalledTimes(1);
    });

    it('handles empty schedule array', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      const classData: CreateClassData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: [],
        studentIds: [],
      };

      await act(async () => {
        await result.current.mutateAsync(classData);
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          schedule: [],
          legacySchedule: [],
        })
      );
    });

    it('invalidates correct query keys on success', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-class-1' } as any);
      vi.mocked(collection).mockReturnValue({} as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateClass(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          studentIds: [],
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classes'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students', true] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classDetail'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['englishClassStudents'] });
    });
  });

  describe('useUpdateClass', () => {
    it('finds and updates class documents by originalClassName and originalSubject', async () => {
      const mockClassDoc = createMockDocSnap('class1', {
        className: 'Math A',
        subject: 'math',
      });

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockQuerySnapshot([mockClassDoc]) as any
      ).mockResolvedValueOnce(
        createMockQuerySnapshot([]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      const updateData: UpdateClassData = {
        originalClassName: 'Math A',
        originalSubject: 'math',
        newClassName: 'Math B',
        newTeacher: 'teacher2',
        newSchedule: ['화 3'],
      };

      await act(async () => {
        await result.current.mutateAsync(updateData);
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockClassDoc.ref,
        expect.objectContaining({
          className: 'Math B',
          teacher: 'teacher2',
          schedule: [{ day: '화', periodId: '3' }],
          legacySchedule: ['화 3'],
        })
      );
    });

    it('updates room when provided', async () => {
      const mockClassDoc = createMockDocSnap('class1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockQuerySnapshot([mockClassDoc]) as any
      ).mockResolvedValueOnce(
        createMockQuerySnapshot([]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          originalClassName: 'Math A',
          originalSubject: 'math',
          newClassName: 'Math A',
          newTeacher: 'teacher1',
          newRoom: '401',
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockClassDoc.ref,
        expect.objectContaining({
          room: '401',
        })
      );
    });

    it('updates slotTeachers when provided', async () => {
      const mockClassDoc = createMockDocSnap('class1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockQuerySnapshot([mockClassDoc]) as any
      ).mockResolvedValueOnce(
        createMockQuerySnapshot([]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      const slotTeachers = { '월-4': 'teacher2' };

      await act(async () => {
        await result.current.mutateAsync({
          originalClassName: 'Math A',
          originalSubject: 'math',
          newClassName: 'Math A',
          newTeacher: 'teacher1',
          slotTeachers,
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockClassDoc.ref,
        expect.objectContaining({
          slotTeachers,
        })
      );
    });

    it('updates slotRooms when provided', async () => {
      const mockClassDoc = createMockDocSnap('class1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockQuerySnapshot([mockClassDoc]) as any
      ).mockResolvedValueOnce(
        createMockQuerySnapshot([]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      const slotRooms = { '월-4': '301' };

      await act(async () => {
        await result.current.mutateAsync({
          originalClassName: 'Math A',
          originalSubject: 'math',
          newClassName: 'Math A',
          newTeacher: 'teacher1',
          slotRooms,
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockClassDoc.ref,
        expect.objectContaining({
          slotRooms,
        })
      );
    });

    it('updates memo when provided', async () => {
      const mockClassDoc = createMockDocSnap('class1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockQuerySnapshot([mockClassDoc]) as any
      ).mockResolvedValueOnce(
        createMockQuerySnapshot([]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          originalClassName: 'Math A',
          originalSubject: 'math',
          newClassName: 'Math A',
          newTeacher: 'teacher1',
          memo: 'Important class note',
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockClassDoc.ref,
        expect.objectContaining({
          memo: 'Important class note',
        })
      );
    });

    it('finds and updates enrollments via collectionGroup', async () => {
      const mockClassDoc = createMockDocSnap('class1', {});
      const mockEnrollment1 = createMockDocSnap('enroll1', {});
      const mockEnrollment2 = createMockDocSnap('enroll2', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(collectionGroup).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockClassDoc]) as any)
        .mockResolvedValueOnce(
          createMockQuerySnapshot([mockEnrollment1, mockEnrollment2]) as any
        );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          originalClassName: 'Math A',
          originalSubject: 'math',
          newClassName: 'Math B',
          newTeacher: 'teacher2',
          newSchedule: ['화 3'],
        });
      });

      expect(collectionGroup).toHaveBeenCalledWith({}, 'enrollments');
      expect(updateDoc).toHaveBeenCalledWith(
        mockEnrollment1.ref,
        expect.objectContaining({
          className: 'Math B',
          staffId: 'teacher2',
          teacher: 'teacher2',
          schedule: ['화 3'],
        })
      );
      expect(updateDoc).toHaveBeenCalledWith(
        mockEnrollment2.ref,
        expect.objectContaining({
          className: 'Math B',
          staffId: 'teacher2',
          teacher: 'teacher2',
          schedule: ['화 3'],
        })
      );
    });

    it('handles case where classes found but enrollments fail', async () => {
      const mockClassDoc = createMockDocSnap('class1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(collectionGroup).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockClassDoc]) as any)
        .mockRejectedValueOnce(new Error('Enrollments query failed'));
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.mutate({
          originalClassName: 'Math A',
          originalSubject: 'math',
          newClassName: 'Math B',
          newTeacher: 'teacher2',
        });
      });

      // Should succeed since classes were updated even though enrollments failed
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(updateDoc).toHaveBeenCalled();
    });

    it('handles case where classes not found but enrollments found', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(collectionGroup).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockEnrollment]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.mutate({
          originalClassName: 'Math A',
          originalSubject: 'math',
          newClassName: 'Math B',
          newTeacher: 'teacher2',
        });
      });

      // Should succeed since enrollments were updated even though classes were not found
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(updateDoc).toHaveBeenCalled();
    });

    it('throws error when neither classes nor enrollments found', async () => {
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(collectionGroup).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.mutate({
          originalClassName: 'Math A',
          originalSubject: 'math',
          newClassName: 'Math B',
          newTeacher: 'teacher2',
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toContain('수업을 찾을 수 없습니다');
    });

    it('invalidates correct query keys on success', async () => {
      const mockClassDoc = createMockDocSnap('class1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockClassDoc]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateClass(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          originalClassName: 'Math A',
          originalSubject: 'math',
          newClassName: 'Math B',
          newTeacher: 'teacher2',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classes'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students', true] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classDetail'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['englishClassStudents'] });
    });
  });

  describe('useDeleteClass', () => {
    it('deletes class documents matching className and subject', async () => {
      const mockClassDoc1 = createMockDocSnap('class1', {});
      const mockClassDoc2 = createMockDocSnap('class2', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(collectionGroup).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(
          createMockQuerySnapshot([mockClassDoc1, mockClassDoc2]) as any
        )
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteClass(), { wrapper: createWrapper() });

      const deleteData: DeleteClassData = {
        className: 'Math A',
        subject: 'math',
      };

      await act(async () => {
        await result.current.mutateAsync(deleteData);
      });

      expect(deleteDoc).toHaveBeenCalledWith(mockClassDoc1.ref);
      expect(deleteDoc).toHaveBeenCalledWith(mockClassDoc2.ref);
    });

    it('deletes matching enrollments via collectionGroup', async () => {
      const mockEnrollment1 = createMockDocSnap('enroll1', {});
      const mockEnrollment2 = createMockDocSnap('enroll2', {});
      const mockEnrollment3 = createMockDocSnap('enroll3', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(collectionGroup).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(
          createMockQuerySnapshot([mockEnrollment1, mockEnrollment2, mockEnrollment3]) as any
        );
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteClass(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          subject: 'math',
        });
      });

      expect(collectionGroup).toHaveBeenCalledWith({}, 'enrollments');
      expect(deleteDoc).toHaveBeenCalledWith(mockEnrollment1.ref);
      expect(deleteDoc).toHaveBeenCalledWith(mockEnrollment2.ref);
      expect(deleteDoc).toHaveBeenCalledWith(mockEnrollment3.ref);
    });

    it('handles class deletion failure silently', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(collectionGroup).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockRejectedValueOnce(new Error('Class deletion failed'))
        .mockResolvedValueOnce(createMockQuerySnapshot([mockEnrollment]) as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteClass(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.mutate({
          className: 'Math A',
          subject: 'math',
        });
      });

      // Should succeed since enrollment deletion worked even though class query failed
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(deleteDoc).toHaveBeenCalled();
    });

    it('handles enrollment deletion failure silently', async () => {
      const mockClassDoc = createMockDocSnap('class1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(collectionGroup).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockClassDoc]) as any)
        .mockRejectedValueOnce(new Error('Enrollment deletion failed'));
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteClass(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.mutate({
          className: 'Math A',
          subject: 'math',
        });
      });

      // Should succeed since class deletion worked even though enrollment deletion failed
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(deleteDoc).toHaveBeenCalled();
    });

    it('invalidates correct query keys on success', async () => {
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(collectionGroup).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteClass(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          subject: 'math',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classes'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students', true] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classDetail'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['englishClassStudents'] });
    });
  });

  describe('useManageClassStudents - Adding students', () => {
    it('creates enrollment with correct data when adding students', async () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'enroll1' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const data: ManageClassStudentsData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        schedule: ['월 4', '수 4'],
        addStudentIds: ['student1', 'student2'],
      };

      await act(async () => {
        await result.current.mutateAsync(data);
      });

      expect(addDoc).toHaveBeenCalledTimes(2);
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          className: 'Math A',
          staffId: 'teacher1',
          teacher: 'teacher1',
          subject: 'math',
          schedule: ['월 4', '수 4'],
        })
      );
    });

    it('uses individual startDate from studentStartDates when provided', async () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'enroll1' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const data: ManageClassStudentsData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        addStudentIds: ['student1'],
        studentStartDates: {
          student1: '2024-01-15',
        },
      };

      await act(async () => {
        await result.current.mutateAsync(data);
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          startDate: '2024-01-15',
          enrollmentDate: '2024-01-15',
        })
      );
    });

    it('uses today as default startDate when not provided', async () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'enroll1' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const today = new Date().toISOString().split('T')[0];

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          addStudentIds: ['student1'],
        });
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          startDate: today,
          enrollmentDate: today,
        })
      );
    });

    it('includes attendanceDays when provided for new students', async () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'enroll1' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const data: ManageClassStudentsData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        addStudentIds: ['student1'],
        studentAttendanceDays: {
          student1: ['월', '수', '금'],
        },
      };

      await act(async () => {
        await result.current.mutateAsync(data);
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          attendanceDays: ['월', '수', '금'],
        })
      );
    });

    it('includes underline when set to true for new students', async () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'enroll1' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const data: ManageClassStudentsData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'english',
        addStudentIds: ['student1'],
        studentUnderlines: {
          student1: true,
        },
      };

      await act(async () => {
        await result.current.mutateAsync(data);
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          underline: true,
        })
      );
    });

    it('includes isSlotTeacher when set to true for new students', async () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'enroll1' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const data: ManageClassStudentsData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        addStudentIds: ['student1'],
        studentSlotTeachers: {
          student1: true,
        },
      };

      await act(async () => {
        await result.current.mutateAsync(data);
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isSlotTeacher: true,
        })
      );
    });

    it('does not include attendanceDays when empty array for new students', async () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'enroll1' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const data: ManageClassStudentsData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        addStudentIds: ['student1'],
        studentAttendanceDays: {
          student1: [],
        },
      };

      await act(async () => {
        await result.current.mutateAsync(data);
      });

      const enrollmentData = vi.mocked(addDoc).mock.calls[0][1] as any;
      expect(enrollmentData.attendanceDays).toBeUndefined();
    });
  });

  describe('useManageClassStudents - Removing students', () => {
    it('finds enrollment and sets endDate and withdrawalDate', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const today = new Date().toISOString().split('T')[0];

      const data: ManageClassStudentsData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        removeStudentIds: ['student1'],
      };

      await act(async () => {
        await result.current.mutateAsync(data);
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockEnrollment.ref,
        expect.objectContaining({
          endDate: today,
          withdrawalDate: today,
        })
      );
    });

    it('processes multiple student removals', async () => {
      const mockEnrollment1 = createMockDocSnap('enroll1', {});
      const mockEnrollment2 = createMockDocSnap('enroll2', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockEnrollment1]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockEnrollment2]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          removeStudentIds: ['student1', 'student2'],
        });
      });

      expect(updateDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('useManageClassStudents - Transfer students', () => {
    it('sets endDate on old enrollment when transferring', async () => {
      const mockOldEnrollment = createMockDocSnap('old-enroll', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockOldEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-enroll' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const data: ManageClassStudentsData = {
        className: 'Math B',
        teacher: 'teacher1',
        subject: 'math',
        addStudentIds: ['student1'],
        transferMode: {
          student1: 'transfer',
        },
        transferFromClass: {
          student1: 'Math A',
        },
        studentStartDates: {
          student1: '2024-02-01',
        },
      };

      await act(async () => {
        await result.current.mutateAsync(data);
      });

      // Old enrollment should have endDate = 2024-01-31 (one day before new start)
      expect(updateDoc).toHaveBeenCalledWith(
        mockOldEnrollment.ref,
        expect.objectContaining({
          endDate: '2024-01-31',
        })
      );
    });

    it('sets transferTo field on old enrollment', async () => {
      const mockOldEnrollment = createMockDocSnap('old-enroll', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockOldEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-enroll' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math B',
          teacher: 'teacher1',
          subject: 'math',
          addStudentIds: ['student1'],
          transferMode: {
            student1: 'transfer',
          },
          transferFromClass: {
            student1: 'Math A',
          },
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockOldEnrollment.ref,
        expect.objectContaining({
          transferTo: 'Math B',
        })
      );
    });

    it('creates new enrollment for new class', async () => {
      const mockOldEnrollment = createMockDocSnap('old-enroll', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockOldEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-enroll' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math B',
          teacher: 'teacher2',
          subject: 'math',
          schedule: ['화 3'],
          addStudentIds: ['student1'],
          transferMode: {
            student1: 'transfer',
          },
          transferFromClass: {
            student1: 'Math A',
          },
        });
      });

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          className: 'Math B',
          teacher: 'teacher2',
          subject: 'math',
          schedule: ['화 3'],
        })
      );
    });
  });

  describe('useManageClassStudents - Updating existing students', () => {
    it('updates attendanceDays for existing students', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      const data: ManageClassStudentsData = {
        className: 'Math A',
        teacher: 'teacher1',
        subject: 'math',
        studentAttendanceDays: {
          student1: ['월', '수'],
        },
      };

      await act(async () => {
        await result.current.mutateAsync(data);
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockEnrollment.ref,
        expect.objectContaining({
          attendanceDays: ['월', '수'],
        })
      );
    });

    it('sets empty attendanceDays array when empty', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          studentAttendanceDays: {
            student1: [],
          },
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockEnrollment.ref,
        expect.objectContaining({
          attendanceDays: [],
        })
      );
    });

    it('updates underline field for existing students', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'English A',
          teacher: 'teacher1',
          subject: 'english',
          studentUnderlines: {
            student1: true,
          },
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockEnrollment.ref,
        expect.objectContaining({
          underline: true,
        })
      );
    });

    it('updates isSlotTeacher field for existing students', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          studentSlotTeachers: {
            student1: true,
          },
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockEnrollment.ref,
        expect.objectContaining({
          isSlotTeacher: true,
        })
      );
    });

    it('updates endDate and withdrawalDate for existing students', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          studentEndDates: {
            student1: '2024-12-31',
          },
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockEnrollment.ref,
        expect.objectContaining({
          endDate: '2024-12-31',
          withdrawalDate: '2024-12-31',
        })
      );
    });

    it('clears endDate and withdrawalDate when empty string', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          studentEndDates: {
            student1: '',
          },
        });
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockEnrollment.ref,
        expect.objectContaining({
          endDate: null,
          withdrawalDate: null,
        })
      );
    });

    it('does not update students in add or remove lists', async () => {
      const mockEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(addDoc).mockResolvedValue({ id: 'enroll2' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          addStudentIds: ['student2'],
          removeStudentIds: ['student3'],
          studentAttendanceDays: {
            student2: ['월'],  // In add list - should not update
            student3: ['화'],  // In remove list - should not update
          },
        });
      });

      // getDocs is only called for remove (finding enrollment to update endDate)
      // addStudentIds uses addDoc, not getDocs
      expect(getDocs).toHaveBeenCalledTimes(1);
    });
  });

  describe('useManageClassStudents - Query invalidation', () => {
    it('invalidates correct query keys on success', async () => {
      vi.mocked(collection).mockReturnValue({} as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classes'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students', true] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['classDetail'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['englishClassStudents'] });
    });
  });

  describe('useManageClassStudents - Complex scenarios', () => {
    it('handles adding and removing students simultaneously', async () => {
      const mockRemoveEnrollment = createMockDocSnap('enroll1', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockRemoveEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(addDoc).mockResolvedValue({ id: 'enroll2' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          addStudentIds: ['student2', 'student3'],
          removeStudentIds: ['student1'],
        });
      });

      // Should update for removal
      expect(updateDoc).toHaveBeenCalledTimes(1);
      // Should add for new students
      expect(addDoc).toHaveBeenCalledTimes(2);
    });

    it('handles transfer with custom start dates', async () => {
      const mockOldEnrollment = createMockDocSnap('old-enroll', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(
        createMockQuerySnapshot([mockOldEnrollment]) as any
      );
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-enroll' } as any);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math B',
          teacher: 'teacher1',
          subject: 'math',
          addStudentIds: ['student1'],
          transferMode: {
            student1: 'transfer',
          },
          transferFromClass: {
            student1: 'Math A',
          },
          studentStartDates: {
            student1: '2024-03-01',
          },
          studentAttendanceDays: {
            student1: ['월', '수', '금'],
          },
        });
      });

      // Old enrollment endDate should be 2024-02-29
      expect(updateDoc).toHaveBeenCalledWith(
        mockOldEnrollment.ref,
        expect.objectContaining({
          endDate: '2024-02-29',
        })
      );

      // New enrollment should have attendanceDays
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          startDate: '2024-03-01',
          attendanceDays: ['월', '수', '금'],
        })
      );
    });

    it('handles all field updates for existing students', async () => {
      const mockEnrollment1 = createMockDocSnap('enroll1', {});
      const mockEnrollment2 = createMockDocSnap('enroll2', {});
      const mockEnrollment3 = createMockDocSnap('enroll3', {});
      const mockEnrollment4 = createMockDocSnap('enroll4', {});

      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockEnrollment1]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockEnrollment2]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockEnrollment3]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([mockEnrollment4]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useManageClassStudents(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.mutateAsync({
          className: 'Math A',
          teacher: 'teacher1',
          subject: 'math',
          studentAttendanceDays: {
            student1: ['월', '수'],
          },
          studentUnderlines: {
            student2: true,
          },
          studentSlotTeachers: {
            student3: true,
          },
          studentEndDates: {
            student4: '2024-12-31',
          },
        });
      });

      expect(updateDoc).toHaveBeenCalledTimes(4);
    });
  });
});
