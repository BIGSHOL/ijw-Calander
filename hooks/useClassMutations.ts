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
          staffId: teacher, // teacher는 이제 staffId (문서 ID)
          teacher: teacher,  // 호환성을 위해 유지
          subject,
          schedule,
          createdAt: new Date().toISOString(),
        });
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', true] });  // 시간표 studentMap 갱신
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
      queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });  // 영어 시간표 실시간 반영
      // mathClassStudents는 students 쿼리 무효화로 자동 갱신됨 (useMemo 의존성)
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
          await updateDoc(docSnap.ref, updatePayload);
        });

        await Promise.all(classUpdatePromises);
        classesUpdated = classesSnapshot.docs.length;
      } catch {
        // classes 컬렉션 업데이트 실패 시 무시
      }

      // 2. enrollments도 업데이트 (레거시 호환 - 인덱스 없으면 스킵)
      try {
        const enrollmentsQuery = query(
          collectionGroup(db, 'enrollments'),
          where('subject', '==', originalSubject),
          where('className', '==', originalClassName)
        );

        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

        // 각 enrollment 업데이트
        const enrollmentPromises = enrollmentsSnapshot.docs.map(async (docSnap) => {
          await updateDoc(docSnap.ref, {
            className: newClassName,
            staffId: newTeacher, // newTeacher는 이제 staffId
            teacher: newTeacher,  // 호환성을 위해 유지
            schedule: newSchedule,
            updatedAt: new Date().toISOString(),
          });
        });

        await Promise.all(enrollmentPromises);
        enrollmentsUpdated = enrollmentsSnapshot.docs.length;
      } catch {
        // enrollments 업데이트 실패 시 무시 (classes가 업데이트되면 괜찮음)
      }

      // classes가 업데이트되었으면 성공
      if (classesUpdated > 0) {
        return;
      }

      // classes도 enrollments도 업데이트 실패한 경우에만 에러 throw
      if (enrollmentsUpdated === 0) {
        throw new Error(`수업을 찾을 수 없습니다: ${originalClassName} (${originalSubject})`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', true] });  // 시간표 studentMap 갱신
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
      queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });  // 영어 시간표 실시간 반영
      // mathClassStudents는 students 쿼리 무효화로 자동 갱신됨 (useMemo 의존성)
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

      // 1. classes 컬렉션에서 수업 문서 삭제
      try {
        const classesQuery = query(
          collection(db, COL_CLASSES),
          where('subject', '==', subject),
          where('className', '==', className)
        );

        const classesSnapshot = await getDocs(classesQuery);

        const classDeletePromises = classesSnapshot.docs.map(async (docSnap) => {
          await deleteDoc(docSnap.ref);
        });

        await Promise.all(classDeletePromises);
      } catch {
        // classes 컬렉션 삭제 실패 시 무시
      }

      // 2. 해당 className + subject와 일치하는 모든 enrollments 조회 및 삭제
      try {
        const enrollmentsQuery = query(
          collectionGroup(db, 'enrollments'),
          where('subject', '==', subject),
          where('className', '==', className)
        );

        const snapshot = await getDocs(enrollmentsQuery);

        const promises = snapshot.docs.map(async (docSnap) => {
          await deleteDoc(docSnap.ref);
        });

        await Promise.all(promises);
      } catch {
        // enrollments 삭제 실패 시 무시
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', true] });  // 시간표 studentMap 갱신
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
      queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });  // 영어 시간표 실시간 반영
      // mathClassStudents는 students 쿼리 무효화로 자동 갱신됨 (useMemo 의존성)
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
  studentAttendanceDays?: Record<string, string[]>;  // { studentId: ['월', '목'] } 학생별 등원 요일 (수학용)
  studentUnderlines?: Record<string, boolean>;  // { studentId: true } 학생별 밑줄 강조 (영어용)
  studentSlotTeachers?: Record<string, boolean>;  // { studentId: true } 학생별 부담임 여부 (수학용)
  studentStartDates?: Record<string, string>;  // { studentId: 'YYYY-MM-DD' } 학생별 시작일 (미지정시 오늘)
  studentEndDates?: Record<string, string>;  // { studentId: 'YYYY-MM-DD' } 학생별 종료 예정일
  // 반이동 관련
  transferMode?: Record<string, 'add' | 'transfer'>;  // 학생별 추가/반이동 선택
  transferFromClass?: Record<string, string>;  // 반이동 시 이전 수업명
}

export const useManageClassStudents = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ManageClassStudentsData) => {
      const {
        className,
        teacher,
        subject,
        schedule = [],
        addStudentIds = [],
        removeStudentIds = [],
        studentAttendanceDays = {},
        studentUnderlines = {},
        studentSlotTeachers = {},
        studentStartDates = {},
        studentEndDates = {},
        transferMode = {},
        transferFromClass = {}
      } = data;

      // 반이동 학생 처리: 기존 수업 enrollment에 endDate 설정
      const transferStudentIds = Object.keys(transferMode).filter(id => transferMode[id] === 'transfer');

      if (transferStudentIds.length > 0) {
        const transferPromises = transferStudentIds.map(async (studentId) => {
          const fromClass = transferFromClass[studentId];
          if (!fromClass) return;

          // 학생의 기존 수업 enrollment 찾아서 endDate 설정
          const enrollmentsQuery = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('subject', '==', subject),
            where('className', '==', fromClass)
          );
          const snapshot = await getDocs(enrollmentsQuery);

          // 기존 수업 종료일 = 새 수업 시작일의 하루 전
          const startDate = studentStartDates[studentId] || new Date().toISOString().split('T')[0];
          const startDateObj = new Date(startDate);
          startDateObj.setDate(startDateObj.getDate() - 1);
          const endDate = startDateObj.toISOString().split('T')[0];

          const updateOps = snapshot.docs.map(async (docSnap) => {
            await updateDoc(docSnap.ref, {
              endDate: endDate,
              updatedAt: new Date().toISOString(),
              transferTo: className,  // 어디로 반이동했는지 기록
            });
          });

          await Promise.all(updateOps);
        });
        await Promise.all(transferPromises);
      }

      // 학생 추가
      if (addStudentIds.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const addPromises = addStudentIds.map(async (studentId) => {
          const enrollmentsRef = collection(db, COL_STUDENTS, studentId, 'enrollments');
          // 개별 시작일이 지정되어 있으면 사용, 없으면 오늘 날짜
          const startDate = studentStartDates[studentId] || today;
          const enrollmentData: any = {
            className,
            staffId: teacher, // teacher는 이제 staffId
            teacher: teacher,  // 호환성을 위해 유지
            subject,
            schedule,
            startDate,  // 수업 시작일 기록 (레거시 호환)
            enrollmentDate: startDate,  // 수업 시작일 (표준 필드)
            createdAt: new Date().toISOString(),
          };
          // 신규 학생에게 attendanceDays가 설정되어 있으면 추가 (수학용)
          if (studentAttendanceDays[studentId] && studentAttendanceDays[studentId].length > 0) {
            enrollmentData.attendanceDays = studentAttendanceDays[studentId];
          }
          // 신규 학생에게 underline이 설정되어 있으면 추가 (영어용)
          if (studentUnderlines[studentId]) {
            enrollmentData.underline = true;
          }
          // 신규 학생에게 slotTeacher 여부가 설정되어 있으면 추가 (수학용 부담임)
          if (studentSlotTeachers[studentId]) {
            enrollmentData.isSlotTeacher = true;
          }
          await addDoc(enrollmentsRef, enrollmentData);
        });
        await Promise.all(addPromises);
      }

      // 학생 제거 (반이동): enrollment에 endDate 설정 (삭제하지 않음)
      // 이렇게 하면 출석부에서 해당 월의 수강 기록을 유지하면서, 이후 월에서는 제외됨
      if (removeStudentIds.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const removePromises = removeStudentIds.map(async (studentId) => {
          // 해당 학생의 enrollments에서 className + subject 일치하는 것 찾아서 endDate 설정
          const enrollmentsQuery = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('subject', '==', subject),
            where('className', '==', className)
          );
          const snapshot = await getDocs(enrollmentsQuery);

          const updatePromises = snapshot.docs.map(async (docSnap) => {
            await updateDoc(docSnap.ref, {
              endDate: today,
              withdrawalDate: today,  // useClassDetail 필터링 + 시간표 퇴원 섹션 표시용
              updatedAt: new Date().toISOString()
            });
          });

          await Promise.all(updatePromises);
        });
        await Promise.all(removePromises);
      }

      // 기존 학생 attendanceDays 업데이트 (추가/제거 대상이 아닌 학생들) - 수학용
      const updateStudentIds = Object.keys(studentAttendanceDays).filter(
        id => !addStudentIds.includes(id) && !removeStudentIds.includes(id)
      );

      if (updateStudentIds.length > 0) {
        const updatePromises = updateStudentIds.map(async (studentId) => {
          const enrollmentsQuery = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('subject', '==', subject),
            where('className', '==', className)
          );
          const snapshot = await getDocs(enrollmentsQuery);

          const updateOps = snapshot.docs.map(async (docSnap) => {
            const newDays = studentAttendanceDays[studentId];
            if (newDays && newDays.length > 0) {
              await updateDoc(docSnap.ref, { attendanceDays: newDays });
            } else {
              // 빈 배열이면 필드 삭제 (모든 요일 등원)
              await updateDoc(docSnap.ref, { attendanceDays: [] });
            }
          });

          await Promise.all(updateOps);
        });
        await Promise.all(updatePromises);
      }

      // 기존 학생 underline 업데이트 (추가/제거 대상이 아닌 학생들) - 영어용
      const underlineStudentIds = Object.keys(studentUnderlines).filter(
        id => !addStudentIds.includes(id) && !removeStudentIds.includes(id)
      );

      if (underlineStudentIds.length > 0) {
        const underlinePromises = underlineStudentIds.map(async (studentId) => {
          const enrollmentsQuery = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('subject', '==', subject),
            where('className', '==', className)
          );
          const snapshot = await getDocs(enrollmentsQuery);

          const updateOps = snapshot.docs.map(async (docSnap) => {
            const hasUnderline = studentUnderlines[studentId];
            await updateDoc(docSnap.ref, { underline: hasUnderline || false });
          });

          await Promise.all(updateOps);
        });
        await Promise.all(underlinePromises);
      }

      // 기존 학생 isSlotTeacher 업데이트 (추가/제거 대상이 아닌 학생들) - 수학용
      const slotTeacherStudentIds = Object.keys(studentSlotTeachers).filter(
        id => !addStudentIds.includes(id) && !removeStudentIds.includes(id)
      );

      if (slotTeacherStudentIds.length > 0) {
        const slotTeacherPromises = slotTeacherStudentIds.map(async (studentId) => {
          const enrollmentsQuery = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('subject', '==', subject),
            where('className', '==', className)
          );
          const snapshot = await getDocs(enrollmentsQuery);

          const updateOps = snapshot.docs.map(async (docSnap) => {
            const isSlotTeacher = studentSlotTeachers[studentId];
            await updateDoc(docSnap.ref, { isSlotTeacher: isSlotTeacher || false });
          });

          await Promise.all(updateOps);
        });
        await Promise.all(slotTeacherPromises);
      }

      // 기존 학생 종료 예정일 업데이트 (추가/제거 대상이 아닌 학생들)
      const endDateStudentIds = Object.keys(studentEndDates).filter(
        id => !addStudentIds.includes(id) && !removeStudentIds.includes(id)
      );

      if (endDateStudentIds.length > 0) {
        const endDatePromises = endDateStudentIds.map(async (studentId) => {
          const enrollmentsQuery = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('subject', '==', subject),
            where('className', '==', className)
          );
          const snapshot = await getDocs(enrollmentsQuery);

          const updateOps = snapshot.docs.map(async (docSnap) => {
            const endDate = studentEndDates[studentId];
            if (endDate) {
              // 종료 예정일 설정
              await updateDoc(docSnap.ref, {
                endDate: endDate,
                withdrawalDate: endDate,  // CoursesTab 호환성
                updatedAt: new Date().toISOString()
              });
            } else {
              // 종료 예정일 해제 (빈 문자열인 경우)
              await updateDoc(docSnap.ref, {
                endDate: null,
                withdrawalDate: null,
                updatedAt: new Date().toISOString()
              });
            }
          });

          await Promise.all(updateOps);
        });
        await Promise.all(endDatePromises);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', true] });  // 시간표 studentMap 갱신
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
      queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });  // 영어 시간표 실시간 반영
      // mathClassStudents는 students 쿼리 무효화로 자동 갱신됨 (useMemo 의존성)
    },
  });
};
