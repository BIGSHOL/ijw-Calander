import { useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COL_STUDENTS = 'students';

/**
 * 새 수업 추가 (선택된 학생들에게 enrollment 추가)
 *
 * @param classData.className 수업명
 * @param classData.teacher 강사명
 * @param classData.subject 과목
 * @param classData.schedule 스케줄 배열
 * @param classData.studentIds 학생 ID 배열
 */
export interface CreateClassData {
  className: string;
  teacher: string;
  subject: 'math' | 'english';
  schedule?: string[];
  studentIds: string[];
}

export const useCreateClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classData: CreateClassData) => {
      const { className, teacher, subject, schedule = [], studentIds } = classData;

      console.log(`[useCreateClass] Creating class: ${className} for ${studentIds.length} students`);

      // 각 학생의 enrollments 서브컬렉션에 새 enrollment 추가
      const promises = studentIds.map(async (studentId) => {
        const enrollmentsRef = collection(db, COL_STUDENTS, studentId, 'enrollments');
        await addDoc(enrollmentsRef, {
          className,
          teacherId: teacher,
          teacher: teacher,
          subject,
          schedule,
          createdAt: new Date().toISOString(),
        });
      });

      await Promise.all(promises);

      console.log(`[useCreateClass] Successfully created class ${className} for ${studentIds.length} students`);
    },
    onSuccess: () => {
      // 수업 목록 및 학생 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
    },
    onError: (error) => {
      console.error('[useCreateClass] Error creating class:', error);
    },
  });
};

/**
 * 수업 정보 수정 (모든 학생의 해당 enrollment 업데이트)
 *
 * @param updateData.originalClassName 기존 수업명 (검색용)
 * @param updateData.originalSubject 기존 과목 (검색용)
 * @param updateData.newClassName 새 수업명
 * @param updateData.newTeacher 새 강사명
 * @param updateData.newSchedule 새 스케줄
 */
export interface UpdateClassData {
  originalClassName: string;
  originalSubject: 'math' | 'english';
  newClassName: string;
  newTeacher: string;
  newSchedule?: string[];
}

export const useUpdateClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateData: UpdateClassData) => {
      const { originalClassName, originalSubject, newClassName, newTeacher, newSchedule = [] } = updateData;

      console.log(`[useUpdateClass] Updating class: ${originalClassName} -> ${newClassName}`);

      // 해당 className + subject와 일치하는 모든 enrollments 조회
      const enrollmentsQuery = query(
        collectionGroup(db, 'enrollments'),
        where('subject', '==', originalSubject),
        where('className', '==', originalClassName)
      );

      const snapshot = await getDocs(enrollmentsQuery);

      console.log(`[useUpdateClass] Found ${snapshot.docs.length} enrollments to update`);

      // 각 enrollment 업데이트
      const promises = snapshot.docs.map(async (docSnap) => {
        await updateDoc(docSnap.ref, {
          className: newClassName,
          teacherId: newTeacher,
          teacher: newTeacher,
          schedule: newSchedule,
          updatedAt: new Date().toISOString(),
        });
      });

      await Promise.all(promises);

      console.log(`[useUpdateClass] Successfully updated ${snapshot.docs.length} enrollments`);
    },
    onSuccess: () => {
      // 수업 목록 및 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
    },
    onError: (error) => {
      console.error('[useUpdateClass] Error updating class:', error);
    },
  });
};

/**
 * 수업 삭제 (모든 학생의 해당 enrollment 삭제)
 *
 * @param deleteData.className 수업명
 * @param deleteData.subject 과목
 */
export interface DeleteClassData {
  className: string;
  subject: 'math' | 'english';
}

export const useDeleteClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deleteData: DeleteClassData) => {
      const { className, subject } = deleteData;

      console.log(`[useDeleteClass] Deleting class: ${className}`);

      // 해당 className + subject와 일치하는 모든 enrollments 조회
      const enrollmentsQuery = query(
        collectionGroup(db, 'enrollments'),
        where('subject', '==', subject),
        where('className', '==', className)
      );

      const snapshot = await getDocs(enrollmentsQuery);

      console.log(`[useDeleteClass] Found ${snapshot.docs.length} enrollments to delete`);

      // 각 enrollment 삭제
      const promises = snapshot.docs.map(async (docSnap) => {
        await deleteDoc(docSnap.ref);
      });

      await Promise.all(promises);

      console.log(`[useDeleteClass] Successfully deleted ${snapshot.docs.length} enrollments`);
    },
    onSuccess: () => {
      // 수업 목록 및 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
    },
    onError: (error) => {
      console.error('[useDeleteClass] Error deleting class:', error);
    },
  });
};

/**
 * 수업에 학생 추가/제거
 */
export interface ManageClassStudentsData {
  className: string;
  teacher: string;
  subject: 'math' | 'english';
  schedule?: string[];
  addStudentIds?: string[];     // 추가할 학생 IDs
  removeStudentIds?: string[];  // 제거할 학생 IDs
}

export const useManageClassStudents = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ManageClassStudentsData) => {
      const { className, teacher, subject, schedule = [], addStudentIds = [], removeStudentIds = [] } = data;

      console.log(`[useManageClassStudents] Managing students for class: ${className}`);
      console.log(`[useManageClassStudents] Adding: ${addStudentIds.length}, Removing: ${removeStudentIds.length}`);

      // 학생 추가
      if (addStudentIds.length > 0) {
        const addPromises = addStudentIds.map(async (studentId) => {
          const enrollmentsRef = collection(db, COL_STUDENTS, studentId, 'enrollments');
          await addDoc(enrollmentsRef, {
            className,
            teacherId: teacher,
            teacher: teacher,
            subject,
            schedule,
            createdAt: new Date().toISOString(),
          });
        });
        await Promise.all(addPromises);
      }

      // 학생 제거
      if (removeStudentIds.length > 0) {
        const removePromises = removeStudentIds.map(async (studentId) => {
          // 해당 학생의 enrollments에서 className + subject 일치하는 것 찾아서 삭제
          const enrollmentsQuery = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('subject', '==', subject),
            where('className', '==', className)
          );
          const snapshot = await getDocs(enrollmentsQuery);

          const deletionPromises = snapshot.docs.map(async (docSnap) => {
            await deleteDoc(docSnap.ref);
          });

          await Promise.all(deletionPromises);
        });
        await Promise.all(removePromises);
      }

      console.log(`[useManageClassStudents] Successfully managed students for class ${className}`);
    },
    onSuccess: () => {
      // 수업 목록 및 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
    },
    onError: (error) => {
      console.error('[useManageClassStudents] Error managing class students:', error);
    },
  });
};
