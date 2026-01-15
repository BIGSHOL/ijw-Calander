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
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubjectType } from '../types';

const COL_STUDENTS = 'students';
const COL_CLASSES = 'classes';

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
  subject: SubjectType;
  schedule?: string[];
  room?: string;
  studentIds: string[];
  slotTeachers?: Record<string, string>;
  slotRooms?: Record<string, string>;
}

export const useCreateClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classData: CreateClassData) => {
      const { className, teacher, subject, schedule = [], room, studentIds, slotTeachers, slotRooms } = classData;

      console.log(`[useCreateClass] Creating class: ${className} for ${studentIds.length} students`);

      // 1. classes 컬렉션에 수업 추가
      const scheduleSlots = schedule.map(s => {
        const parts = s.split(' ');
        return { day: parts[0], periodId: parts[1] || '' };
      });

      const classDoc: any = {
        className,
        teacher,
        subject,
        schedule: scheduleSlots,
        legacySchedule: schedule,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (room) classDoc.room = room;
      if (slotTeachers && Object.keys(slotTeachers).length > 0) classDoc.slotTeachers = slotTeachers;
      if (slotRooms && Object.keys(slotRooms).length > 0) classDoc.slotRooms = slotRooms;

      await addDoc(collection(db, COL_CLASSES), classDoc);

      // 2. 각 학생의 enrollments 서브컬렉션에 새 enrollment 추가
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
  originalSubject: SubjectType;
  newClassName: string;
  newTeacher: string;
  newSchedule?: string[];
  newRoom?: string;
  slotTeachers?: Record<string, string>;  // { "월-4": "부담임명", ... }
  slotRooms?: Record<string, string>;  // { "월-4": "301", ... }
  memo?: string;  // 수업 메모
}

export const useUpdateClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateData: UpdateClassData) => {
      const { originalClassName, originalSubject, newClassName, newTeacher, newSchedule = [], newRoom, slotTeachers, slotRooms, memo } = updateData;

      console.log(`[useUpdateClass] Updating class: ${originalClassName} (${originalSubject}) -> ${newClassName}`);

      let classesUpdated = 0;
      let enrollmentsUpdated = 0;

      // 스케줄을 ScheduleSlot[] 형식으로 변환
      const scheduleSlots = newSchedule.map(s => {
        const parts = s.split(' ');
        return { day: parts[0], periodId: parts[1] || '' };
      });

      // 1. classes 컬렉션에서 해당 수업 찾기 및 업데이트
      try {
        const classesQuery = query(
          collection(db, COL_CLASSES),
          where('subject', '==', originalSubject),
          where('className', '==', originalClassName)
        );

        const classesSnapshot = await getDocs(classesQuery);
        console.log(`[useUpdateClass] Found ${classesSnapshot.docs.length} classes in unified collection`);

        // classes 컬렉션 업데이트
        const classUpdatePromises = classesSnapshot.docs.map(async (docSnap) => {
          const updatePayload: Record<string, any> = {
            className: newClassName,
            teacher: newTeacher,
            schedule: scheduleSlots,
            legacySchedule: newSchedule,
            updatedAt: new Date().toISOString(),
          };
          // room, slotTeachers, slotRooms 추가/업데이트
          if (newRoom !== undefined) {
            updatePayload.room = newRoom;
          }
          // slotTeachers와 slotRooms는 항상 업데이트 (비어있어도 빈 객체로 저장하여 기존 데이터 삭제)
          if (slotTeachers !== undefined) {
            updatePayload.slotTeachers = slotTeachers;
          }
          if (slotRooms !== undefined) {
            updatePayload.slotRooms = slotRooms;
          }
          // 메모 업데이트
          if (memo !== undefined) {
            updatePayload.memo = memo;
          }
          console.log('[useUpdateClass] Updating doc:', docSnap.id, 'with:', updatePayload);
          await updateDoc(docSnap.ref, updatePayload);
        });

        await Promise.all(classUpdatePromises);
        classesUpdated = classesSnapshot.docs.length;
      } catch (err) {
        console.error('[useUpdateClass] Error updating classes collection:', err);
      }

      // 2. enrollments도 업데이트 (레거시 호환 - 인덱스 없으면 스킵)
      try {
        const enrollmentsQuery = query(
          collectionGroup(db, 'enrollments'),
          where('subject', '==', originalSubject),
          where('className', '==', originalClassName)
        );

        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        console.log(`[useUpdateClass] Found ${enrollmentsSnapshot.docs.length} enrollments to update`);

        // 각 enrollment 업데이트
        const enrollmentPromises = enrollmentsSnapshot.docs.map(async (docSnap) => {
          await updateDoc(docSnap.ref, {
            className: newClassName,
            teacherId: newTeacher,
            teacher: newTeacher,
            schedule: newSchedule,
            updatedAt: new Date().toISOString(),
          });
        });

        await Promise.all(enrollmentPromises);
        enrollmentsUpdated = enrollmentsSnapshot.docs.length;
      } catch (err: any) {
        // 인덱스 에러는 경고만 표시 (classes가 업데이트되면 괜찮음)
        if (err?.message?.includes('index')) {
          console.warn('[useUpdateClass] Enrollments index not available, skipping enrollment update');
        } else {
          console.error('[useUpdateClass] Error updating enrollments:', err);
        }
      }

      // classes가 업데이트되었으면 성공
      if (classesUpdated > 0) {
        console.log(`[useUpdateClass] Successfully updated ${classesUpdated} classes and ${enrollmentsUpdated} enrollments`);
        return;
      }

      // classes도 enrollments도 업데이트 실패한 경우에만 에러 throw
      if (enrollmentsUpdated === 0) {
        throw new Error(`수업을 찾을 수 없습니다: ${originalClassName} (${originalSubject})`);
      }

      console.log(`[useUpdateClass] Successfully updated ${classesUpdated} classes and ${enrollmentsUpdated} enrollments`);
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
  subject: SubjectType;
}

export const useDeleteClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deleteData: DeleteClassData) => {
      const { className, subject } = deleteData;

      console.log(`[useDeleteClass] Deleting class: ${className} (${subject})`);

      let classesDeleted = 0;
      let enrollmentsDeleted = 0;

      // 1. classes 컬렉션에서 수업 문서 삭제
      try {
        const classesQuery = query(
          collection(db, COL_CLASSES),
          where('subject', '==', subject),
          where('className', '==', className)
        );

        const classesSnapshot = await getDocs(classesQuery);
        console.log(`[useDeleteClass] Found ${classesSnapshot.docs.length} classes to delete`);

        const classDeletePromises = classesSnapshot.docs.map(async (docSnap) => {
          await deleteDoc(docSnap.ref);
        });

        await Promise.all(classDeletePromises);
        classesDeleted = classesSnapshot.docs.length;
      } catch (err) {
        console.error('[useDeleteClass] Error deleting from classes collection:', err);
      }

      // 2. 해당 className + subject와 일치하는 모든 enrollments 조회 및 삭제
      try {
        const enrollmentsQuery = query(
          collectionGroup(db, 'enrollments'),
          where('subject', '==', subject),
          where('className', '==', className)
        );

        const snapshot = await getDocs(enrollmentsQuery);
        console.log(`[useDeleteClass] Found ${snapshot.docs.length} enrollments to delete`);

        const promises = snapshot.docs.map(async (docSnap) => {
          await deleteDoc(docSnap.ref);
        });

        await Promise.all(promises);
        enrollmentsDeleted = snapshot.docs.length;
      } catch (err: any) {
        // 인덱스 에러는 경고만 표시
        if (err?.message?.includes('index')) {
          console.warn('[useDeleteClass] Enrollments index not available, skipping enrollment deletion');
        } else {
          console.error('[useDeleteClass] Error deleting enrollments:', err);
        }
      }

      console.log(`[useDeleteClass] Successfully deleted ${classesDeleted} classes and ${enrollmentsDeleted} enrollments`);
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
  subject: SubjectType;
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
