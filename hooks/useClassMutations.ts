import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  collectionGroup,
  setDoc,
  deleteField,
} from 'firebase/firestore';
import { subDays, parseISO, format } from 'date-fns';
import { db } from '../firebaseConfig';
import { SubjectType } from '../types';
import { getTodayKST, formatDateKST } from '../utils/dateUtils';
import { logTimetableChange } from './useTimetableLog';

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

      const classRef = await addDoc(collection(db, COL_CLASSES), classDoc);
      const classId = classRef.id;

      // 2. 각 학생의 enrollments 서브컬렉션에 새 enrollment 추가 (doc ID = classId)
      const promises = studentIds.map(async (studentId) => {
        const enrollmentRef = doc(db, COL_STUDENTS, studentId, 'enrollments', classId);
        await setDoc(enrollmentRef, {
          className,
          classId,
          staffId: teacher,
          teacher: teacher,
          subject,
          schedule,
          createdAt: new Date().toISOString(),
        });
      });

      await Promise.all(promises);

      logTimetableChange({
        action: 'class_create',
        subject,
        className,
        details: `수업 생성: ${className} (${subject}), 학생 ${studentIds.length}명`,
        after: { className, teacher, subject, schedule, room, studentCount: studentIds.length },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', true] });  // 시간표 studentMap 갱신
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
      queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });  // 수학 시간표 실시간 반영
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
  // 스케줄 변경 예정
  pendingSchedule?: string[];       // 예정 스케줄 (레거시 형식)
  pendingScheduleDate?: string;     // 적용 예정일
  clearPending?: boolean;           // 즉시 적용 시 pending 필드 삭제
}

export const useUpdateClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateData: UpdateClassData) => {
      const { originalClassName, originalSubject, newClassName, newTeacher, newSchedule = [], newRoom, slotTeachers, slotRooms, memo, pendingSchedule, pendingScheduleDate, clearPending } = updateData;

      let classesUpdated = 0;
      let enrollmentsUpdated = 0;
      const hasPendingSchedule = !!(pendingSchedule && pendingScheduleDate);

      // 스케줄을 ScheduleSlot[] 형식으로 변환
      const scheduleSlots = newSchedule.map(s => {
        const parts = s.split(' ');
        return { day: parts[0], periodId: parts[1] || '' };
      });

      // pendingSchedule도 ScheduleSlot[] 형식으로 변환
      const pendingScheduleSlots = pendingSchedule?.map(s => {
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
          // 스케줄 변경 예정 저장
          if (hasPendingSchedule) {
            updatePayload.pendingSchedule = pendingScheduleSlots;
            updatePayload.pendingLegacySchedule = pendingSchedule;
            updatePayload.pendingScheduleDate = pendingScheduleDate;
          }
          // 즉시 적용 시 기존 pending 필드 삭제
          if (clearPending) {
            updatePayload.pendingSchedule = deleteField();
            updatePayload.pendingLegacySchedule = deleteField();
            updatePayload.pendingScheduleDate = deleteField();
          }
          await updateDoc(docSnap.ref, updatePayload);
        });

        await Promise.all(classUpdatePromises);
        classesUpdated = classesSnapshot.docs.length;
      } catch {
        // classes 컬렉션 업데이트 실패 시 무시
      }

      // 2. enrollments도 업데이트
      // className 기반 + classId 기반 이중 조회로 누락 방지
      // pendingSchedule이 있으면 enrollment schedule은 아직 업데이트하지 않음
      try {
        // classId 조회 (classes에서 찾은 문서 ID)
        const classDocIds = new Set<string>();
        try {
          const classesQuery2 = query(
            collection(db, COL_CLASSES),
            where('subject', '==', originalSubject),
            where('className', '==', newClassName)
          );
          const classSnap2 = await getDocs(classesQuery2);
          classSnap2.docs.forEach(d => classDocIds.add(d.id));
        } catch { /* ignore */ }

        // 2-1. className 기반 조회 (기존)
        const enrollmentsQuery = query(
          collectionGroup(db, 'enrollments'),
          where('subject', '==', originalSubject),
          where('className', '==', originalClassName)
        );
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

        // 2-2. classId 기반 조회 (className이 이미 변경된 enrollment 포착)
        const enrollmentDocPaths = new Set(enrollmentsSnapshot.docs.map(d => d.ref.path));
        const additionalDocs: typeof enrollmentsSnapshot.docs = [];

        for (const classDocId of classDocIds) {
          try {
            const classIdQuery = query(
              collectionGroup(db, 'enrollments'),
              where('classId', '==', classDocId)
            );
            const classIdSnap = await getDocs(classIdQuery);
            classIdSnap.docs.forEach(d => {
              if (!enrollmentDocPaths.has(d.ref.path)) {
                // 활성 enrollment만 (종료된 것은 건너뛰기)
                const data = d.data();
                if (!data.endDate && !data.withdrawalDate) {
                  additionalDocs.push(d);
                  enrollmentDocPaths.add(d.ref.path);
                }
              }
            });
          } catch { /* ignore */ }
        }

        const allEnrollmentDocs = [...enrollmentsSnapshot.docs, ...additionalDocs];

        // 각 enrollment 업데이트
        const enrollmentPromises = allEnrollmentDocs.map(async (docSnap) => {
          const data = docSnap.data();
          // 종료된 enrollment은 건너뛰기
          if (data.endDate || data.withdrawalDate) return;

          const enrollUpdate: Record<string, any> = {
            className: newClassName,
            staffId: newTeacher,
            teacher: newTeacher,
            updatedAt: new Date().toISOString(),
          };
          // classId 보정
          if (classDocIds.size > 0) {
            const correctClassId = [...classDocIds][0];
            if (data.classId !== correctClassId) {
              enrollUpdate.classId = correctClassId;
            }
          }
          // pendingSchedule이 없으면 (즉시 적용) enrollment schedule도 업데이트
          if (!hasPendingSchedule) {
            // attendanceDays가 있는 개별 스케줄 학생도 class schedule로 동기화
            enrollUpdate.schedule = newSchedule;
          }
          await updateDoc(docSnap.ref, enrollUpdate);
        });

        await Promise.all(enrollmentPromises);
        enrollmentsUpdated = allEnrollmentDocs.length;
      } catch {
        // enrollments 업데이트 실패 시 무시 (classes가 업데이트되면 괜찮음)
      }

      // 로그 기록
      if (classesUpdated > 0 || enrollmentsUpdated > 0) {
        logTimetableChange({
          action: 'class_update',
          subject: originalSubject,
          className: newClassName,
          details: `수업 수정: ${originalClassName} → ${newClassName} (${originalSubject})`,
          before: { className: originalClassName },
          after: { className: newClassName, teacher: newTeacher, schedule: newSchedule, room: newRoom, memo },
        });
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
      queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });  // 수학 시간표 실시간 반영
      // mathClassStudents는 students 쿼리 무효화로 자동 갱신됨 (useMemo 의존성)
    },
  });
};

/**
 * 강사 인수인계 (Teacher Handover)
 *
 * 인수일 D 기준 enrollment를 찢어서 이력 보존:
 * - 기존 enrollment: endDate = D-1 (D-1까지 이전 담임)
 * - 새 enrollment: startDate = D, staffId = 새 강사 (D부터 새 담임)
 * - classes/{classId}: staffId/teacher 새 강사로 즉시 교체 (적용 날짜가 오늘 또는 과거인 경우)
 *                     또는 pendingTeacher* 필드로 저장 (미래 날짜)
 *
 * @param handoverData.classId 대상 수업 문서 ID
 * @param handoverData.subject 과목
 * @param handoverData.className 수업명
 * @param handoverData.currentTeacher 현재 담임 (검증/로그용)
 * @param handoverData.newTeacher 새 담임
 * @param handoverData.effectiveDate 적용일 (YYYY-MM-DD) — 오늘 이전/오늘이면 즉시 실행, 미래면 예약
 * @param handoverData.reason 사유 메모 (옵션)
 */
export interface HandoverTeacherData {
  classId: string;
  subject: SubjectType;
  className: string;
  currentTeacher: string;
  newTeacher: string;
  effectiveDate: string;
  reason?: string;
}

/**
 * 핵심 migrate 로직 — 지정된 class의 모든 활성 enrollment를 찢어서 새 담임으로 넘김
 * - 기존 enrollment: endDate = effectiveDate - 1일
 * - 새 enrollment: addDoc 으로 신규 생성, 동일 classId/className/schedule, staffId=newTeacher, startDate=effectiveDate
 *                   + handoverBatchId 필드 저장 — 취소/롤백 시 이 단일 값으로 정확히 범위를 좁힘
 * - classes/{classId}: options.skipClassDocUpdate=false(기본) 시 staffId/teacher 필드 즉시 교체 + pending 필드 삭제
 *                       options.skipClassDocUpdate=true(미래 예약 시) 시 classes 본체는 건드리지 않음 (auto-apply가 효력일에 처리)
 *
 * @param options.batchId 호출자가 부여한 인수인계 batch 식별자 (예약 시 생성). 없으면 내부 생성.
 * @param options.previousStaffId 롤백용으로 저장할 이전 담임 (cancel 시 classes.staffId 복구에 사용)
 */
export async function executeTeacherHandover(
  data: HandoverTeacherData,
  options: { skipClassDocUpdate?: boolean; batchId?: string; previousStaffId?: string } = {}
): Promise<{ enrollmentsSplit: number; batchId: string }> {
  const { classId, subject, className, newTeacher, effectiveDate, reason } = data;

  // D-1 계산 (effectiveDate의 전날) — date-fns로 DST-safe 캘린더 연산
  const prevDateStr = format(subDays(parseISO(effectiveDate), 1), 'yyyy-MM-dd');

  // batchId 보장 — 예약 시 생성되어 전달되는 게 원칙, 없으면 여기서 생성 (즉시 실행 경로)
  const batchId = options.batchId || `${classId}_${effectiveDate}_${Date.now()}`;

  // 1. 대상 class의 활성 enrollment들 수집 (classId 또는 className 기반)
  const enrollmentDocs: Array<{ ref: any; data: any; studentId: string }> = [];
  const seenPaths = new Set<string>();

  try {
    const classIdQuery = query(
      collectionGroup(db, 'enrollments'),
      where('classId', '==', classId)
    );
    const snap1 = await getDocs(classIdQuery);
    snap1.docs.forEach(d => {
      const raw = d.data();
      // 활성 enrollment만 (종료된 것은 제외)
      if (raw.endDate || raw.withdrawalDate) return;
      if (seenPaths.has(d.ref.path)) return;
      seenPaths.add(d.ref.path);
      const pathParts = d.ref.path.split('/');
      const studentId = pathParts[1];
      enrollmentDocs.push({ ref: d.ref, data: raw, studentId });
    });
  } catch { /* ignore */ }

  // className + subject 기반 보완 조회 (classId 필드 누락된 레거시 데이터만)
  // — 다른 classId가 명시된 문서는 엉뚱한 반 데이터이므로 제외
  try {
    const classNameQuery = query(
      collectionGroup(db, 'enrollments'),
      where('subject', '==', subject),
      where('className', '==', className)
    );
    const snap2 = await getDocs(classNameQuery);
    snap2.docs.forEach(d => {
      const raw = d.data();
      if (raw.endDate || raw.withdrawalDate) return;
      if (seenPaths.has(d.ref.path)) return;
      // classId가 명시되어 있고 대상 classId와 다르면 제외 (다른 반 데이터)
      if (raw.classId && raw.classId !== classId) return;
      seenPaths.add(d.ref.path);
      const pathParts = d.ref.path.split('/');
      const studentId = pathParts[1];
      enrollmentDocs.push({ ref: d.ref, data: raw, studentId });
    });
  } catch { /* ignore */ }

  // 2. 각 enrollment 찢기: 기존 endDate=D-1, 새 enrollment addDoc 으로 생성
  const now = new Date().toISOString();
  const splitPromises = enrollmentDocs.map(async ({ ref, data, studentId }) => {
    // 기존 enrollment 종료 — handoverBatchId 를 원본에도 박아 나중에 cancel 시 pair 식별
    await updateDoc(ref, {
      endDate: prevDateStr,
      handoverEndedByBatchId: batchId,
      updatedAt: now,
    });
    // 새 enrollment 생성 (addDoc으로 자동 ID — 같은 classId로 여러 enrollment 허용)
    const enrollmentsCol = collection(db, COL_STUDENTS, studentId, 'enrollments');
    const newDoc: Record<string, any> = {
      classId,
      className,
      subject,
      staffId: newTeacher,
      teacher: newTeacher,
      schedule: data.schedule || [],
      // 원본에 attendanceDays 필드가 없으면 신규에도 넣지 않기 — "모든 요일 등원" 의미 보존
      ...(data.attendanceDays ? { attendanceDays: data.attendanceDays } : {}),
      startDate: effectiveDate,
      enrollmentDate: effectiveDate,
      handoverBatchId: batchId,
      handoverFromEnrollmentId: ref.id,
      handoverFromStaffId: data.staffId || data.teacher || '',
      createdAt: now,
      updatedAt: now,
    };
    if (reason) newDoc.handoverReason = reason;
    await addDoc(enrollmentsCol, newDoc);
  });
  await Promise.all(splitPromises);

  // slotTeachers에서 이전 담임 이름과 일치하는 엔트리를 새 담임으로 교체 (slot별 담임 오버라이드 반영)
  // — 즉시 적용 경로에서만 실행 (미래 예약은 auto-apply 시점에 처리)
  const slotTeachersUpdate: Record<string, string> = {};
  if (!options.skipClassDocUpdate && options.previousStaffId) {
    try {
      const classSnap = await getDoc(doc(db, COL_CLASSES, classId));
      const classData = classSnap.data();
      const slotTeachers: Record<string, string> | undefined = classData?.slotTeachers;
      if (slotTeachers && typeof slotTeachers === 'object') {
        Object.entries(slotTeachers).forEach(([k, v]) => {
          slotTeachersUpdate[k] = (v === options.previousStaffId) ? newTeacher : (v as string);
        });
      }
    } catch { /* ignore */ }
  }

  // 3. classes/{classId} 본체 업데이트 (효력일이 이미 도래한 경우에만)
  // 미래 예약 시(skipClassDocUpdate=true)는 건드리지 않고, pendingTeacher* 필드만 별도로 저장
  // 반 카드는 referenceDate 기반으로 pending 필드를 참조해 주차별 프리뷰를 제공함
  if (!options.skipClassDocUpdate) {
    try {
      const classRef = doc(db, COL_CLASSES, classId);
      const payload: Record<string, any> = {
        staffId: newTeacher,
        teacher: newTeacher,
        pendingTeacher: deleteField(),
        pendingTeacherDate: deleteField(),
        pendingTeacherReason: deleteField(),
        pendingHandoverBatchId: deleteField(),
        pendingHandoverPreviousTeacher: deleteField(),
        updatedAt: now,
      };
      if (Object.keys(slotTeachersUpdate).length > 0) {
        payload.slotTeachers = slotTeachersUpdate;
      }
      // 영어 반의 mainTeacher 필드도 동기화
      if (subject === 'english') {
        payload.mainTeacher = newTeacher;
      }
      await updateDoc(classRef, payload);
    } catch (err) {
      console.warn('[handover] classes doc 업데이트 실패:', err);
    }
  }

  return { enrollmentsSplit: enrollmentDocs.length, batchId };
}

/**
 * 예약/적용된 강사 인수인계 취소 / 롤백
 *
 * 개선된 설계:
 * - batchId로만 롤백 범위를 좁혀, 같은 반의 다른(과거·다른 회차) 인수인계를 건드리지 않음
 * - previousStaffId가 classes 문서에 저장되어 있으면 classes.staffId 도 원상 복구 (auto-apply 이후 취소 시나리오)
 * - 원본 enrollment의 endDate는 "batchId 매칭 시에만" deleteField — 과거 인수인계로 이미 설정된 endDate는 보존
 */
export async function cancelTeacherHandover(classId: string): Promise<{ restored: number; removed: number; batchId?: string }> {
  let restored = 0;
  let removed = 0;
  const now = new Date().toISOString();

  // 1. classes/{id}에서 현재 예약 batchId와 이전 담임 읽기
  let batchId: string | undefined;
  let previousStaffId: string | undefined;
  let classData: any = null;
  try {
    const classSnap = await getDoc(doc(db, COL_CLASSES, classId));
    classData = classSnap.data();
    batchId = classData?.pendingHandoverBatchId;
    previousStaffId = classData?.pendingHandoverPreviousTeacher;
  } catch (err) {
    console.warn('[cancel handover] classes doc 조회 실패:', err);
  }

  // batchId가 없는 경우 — 구버전 예약이거나 데이터 이상 상태
  // enrollment 찢기가 없었으므로 롤백할 건 없고, classes 문서의 pending 필드만 정리 (폴백)
  if (!batchId) {
    console.warn('[cancel handover] pendingHandoverBatchId 없음 — 구버전 예약으로 간주하고 pending 필드만 정리');
    try {
      await updateDoc(doc(db, COL_CLASSES, classId), {
        pendingTeacher: deleteField(),
        pendingTeacherDate: deleteField(),
        pendingTeacherReason: deleteField(),
        pendingHandoverBatchId: deleteField(),
        pendingHandoverPreviousTeacher: deleteField(),
        updatedAt: now,
      });
    } catch (err) {
      console.warn('[cancel handover] 구버전 pending 필드 정리 실패:', err);
    }
    return { restored: 0, removed: 0 };
  }

  // 2. batchId 기준으로 새 enrollment 식별 & 삭제 + 원본 endDate 복구
  try {
    const batchEnrollQuery = query(
      collectionGroup(db, 'enrollments'),
      where('handoverBatchId', '==', batchId)
    );
    const snap = await getDocs(batchEnrollQuery);

    const restorePromises: Promise<any>[] = [];
    const deletePromises: Promise<any>[] = [];

    snap.docs.forEach(d => {
      const raw = d.data();
      // 같은 batch에 속하는 새 enrollment 삭제
      deletePromises.push(
        deleteDoc(d.ref).catch(err => {
          console.warn('[cancel handover] 새 enrollment 삭제 실패:', d.ref.path, err);
        })
      );
      // 대응하는 원본 enrollment 찾아서 endDate 복구
      if (raw.handoverFromEnrollmentId) {
        const studentId = d.ref.path.split('/')[1];
        const originalRef = doc(db, 'students', studentId, 'enrollments', raw.handoverFromEnrollmentId);
        restorePromises.push(
          getDoc(originalRef).then(origSnap => {
            if (!origSnap.exists()) return;
            const origData = origSnap.data();
            // sanity check: 이 enrollment가 정말 이 batch로 마감된 것인지 확인
            if (origData.handoverEndedByBatchId !== batchId) {
              console.warn('[cancel handover] batch 불일치로 endDate 복구 스킵:', originalRef.path);
              return;
            }
            return updateDoc(originalRef, {
              endDate: deleteField(),
              handoverEndedByBatchId: deleteField(),
              updatedAt: now,
            });
          }).catch(err => {
            console.warn('[cancel handover] endDate 복구 실패:', studentId, raw.handoverFromEnrollmentId, err);
          })
        );
      }
    });

    await Promise.all([...deletePromises, ...restorePromises]);
    removed = snap.docs.length;
    restored = restorePromises.length;
  } catch (err) {
    console.warn('[cancel handover] enrollment 롤백 중 오류:', err);
  }

  // 3. classes/{id}의 pending 필드 삭제 + auto-apply 이후면 staffId/teacher 도 원복
  try {
    const classRef = doc(db, COL_CLASSES, classId);
    const payload: Record<string, any> = {
      pendingTeacher: deleteField(),
      pendingTeacherDate: deleteField(),
      pendingTeacherReason: deleteField(),
      pendingHandoverBatchId: deleteField(),
      pendingHandoverPreviousTeacher: deleteField(),
      updatedAt: now,
    };
    // auto-apply 완료 후 취소 시나리오: classes.staffId가 pending 대상과 동일하면 previousStaffId로 롤백
    if (previousStaffId && classData) {
      const appliedTeacher = classData.pendingTeacher;
      if (appliedTeacher && classData.staffId === appliedTeacher) {
        payload.staffId = previousStaffId;
        payload.teacher = previousStaffId;
        if (classData.subject === 'english') {
          payload.mainTeacher = previousStaffId;
        }
      }
    }
    await updateDoc(classRef, payload);
  } catch (err) {
    console.warn('[cancel handover] classes doc 필드 삭제 실패:', err);
  }

  return { restored, removed, batchId };
}

export const useHandoverTeacher = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: HandoverTeacherData) => {
      const { classId, subject, className, currentTeacher, newTeacher, effectiveDate, reason } = data;
      const todayStr = getTodayKST();

      // 동일인 인수인계 방지
      if (currentTeacher === newTeacher) {
        throw new Error('현재 담임과 동일한 강사로는 인수인계할 수 없습니다.');
      }

      // 과거 날짜 방지 (모달에서도 막지만 API 직접 호출 방어)
      if (effectiveDate < todayStr) {
        throw new Error('과거 날짜로는 인수인계할 수 없습니다. 인수일은 오늘 또는 미래로 지정해 주세요.');
      }

      // 중복 예약 방지 — classes/{id}에 이미 pendingTeacher가 있으면 거절
      try {
        const existingSnap = await getDoc(doc(db, COL_CLASSES, classId));
        const existingData = existingSnap.data();
        if (existingData?.pendingTeacher && existingData?.pendingTeacherDate) {
          throw new Error(
            `이미 예약된 인수인계가 있습니다 (${existingData.pendingTeacherDate} 부터 ${existingData.pendingTeacher}). ` +
            `수정하려면 기존 예약을 먼저 취소한 후 다시 예약해 주세요.`
          );
        }
      } catch (err: any) {
        if (err?.message?.startsWith('이미 예약된')) throw err;
        // 그 외 조회 실패는 무시하고 진행
      }

      // 예약 시점 batchId 생성 (cancel/rollback 시 이 값으로 정확히 좁힘)
      const batchId = `${classId}_${effectiveDate}_${Date.now()}`;

      // 미래 날짜면 예약(eager split), 오늘이면 즉시 실행 (classes.staffId까지 교체)
      if (effectiveDate > todayStr) {
        // 1. enrollment를 "즉시" 찢어서 미래 주차로 이동 시 학생 enrollment가 이미 새 담임으로 보이도록
        //    단 classes/{id}.staffId 는 교체하지 않음 (auto-apply가 효력일에 처리)
        const result = await executeTeacherHandover(data, {
          skipClassDocUpdate: true,
          batchId,
          previousStaffId: currentTeacher,
        });

        // 2. classes 문서에 pendingTeacher* 필드 저장 (반 카드 referenceDate 기반 프리뷰 + auto-apply 트리거)
        const classRef = doc(db, COL_CLASSES, classId);
        const payload: Record<string, any> = {
          pendingTeacher: newTeacher,
          pendingTeacherDate: effectiveDate,
          pendingHandoverBatchId: batchId,
          pendingHandoverPreviousTeacher: currentTeacher,
          updatedAt: new Date().toISOString(),
        };
        if (reason) payload.pendingTeacherReason = reason;
        await updateDoc(classRef, payload);

        logTimetableChange({
          action: 'class_update',
          subject,
          className,
          details: `강사 인수인계 예약: ${currentTeacher} → ${newTeacher} (${effectiveDate}부터, enrollment ${result.enrollmentsSplit}건 사전 분리, batchId=${batchId})`,
          before: { teacher: currentTeacher },
          after: { teacher: newTeacher, effectiveDate, reason, batchId },
        });

        return { scheduled: true, enrollmentsSplit: result.enrollmentsSplit, batchId };
      }

      // 즉시 실행 (enrollment 찢기 + classes/{id}.staffId 교체)
      const result = await executeTeacherHandover(data, { batchId, previousStaffId: currentTeacher });

      logTimetableChange({
        action: 'class_update',
        subject,
        className,
        details: `강사 인수인계 적용: ${currentTeacher} → ${newTeacher} (${effectiveDate}부터, enrollment ${result.enrollmentsSplit}건 분리, batchId=${batchId})`,
        before: { teacher: currentTeacher },
        after: { teacher: newTeacher, effectiveDate, reason, batchId },
      });

      return { scheduled: false, ...result };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', true] });
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
      queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });
      queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });
      queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
      queryClient.invalidateQueries({ queryKey: ['classStudents'] });
    },
  });
};

export const useCancelTeacherHandover = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { classId: string; className: string; subject: SubjectType; currentTeacher: string; pendingTeacher?: string }) => {
      const result = await cancelTeacherHandover(payload.classId);
      logTimetableChange({
        action: 'class_update',
        subject: payload.subject,
        className: payload.className,
        details: `강사 인수인계 예약 취소 (새 enrollment ${result.removed}건 삭제 / 기존 ${result.restored}건 endDate 복구)`,
        before: { teacher: payload.currentTeacher, pendingTeacher: payload.pendingTeacher },
        after: { teacher: payload.currentTeacher },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', true] });
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
      queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });
      queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });
      queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
      queryClient.invalidateQueries({ queryKey: ['classStudents'] });
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

      // 2. 해당 className + subject와 일치하는 모든 enrollments에 endDate 설정
      // 하드 삭제 대신 endDate 설정으로 이력 보존
      const yd = new Date(); yd.setDate(yd.getDate() - 1);
      const yesterday = yd.toISOString().split('T')[0];
      try {
        const enrollmentsQuery = query(
          collectionGroup(db, 'enrollments'),
          where('subject', '==', subject),
          where('className', '==', className)
        );

        const snapshot = await getDocs(enrollmentsQuery);

        const promises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          // 이미 종료된 enrollment은 건너뛰기
          if (data.endDate || data.withdrawalDate) return;
          await updateDoc(docSnap.ref, {
            endDate: yesterday,
            withdrawalDate: yesterday,
            updatedAt: new Date().toISOString(),
          });
        });

        await Promise.all(promises);
      } catch {
        // enrollments 업데이트 실패 시 무시
      }

      logTimetableChange({
        action: 'class_delete',
        subject,
        className,
        details: `수업 삭제: ${className} (${subject})`,
        before: { className, subject },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', true] });  // 시간표 studentMap 갱신
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
      queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });  // 수학 시간표 실시간 반영
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
  studentEnrollmentDates?: Record<string, string>;  // { studentId: 'YYYY-MM-DD' } 기존 학생 등원일 변경
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
        studentEnrollmentDates = {},
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
          // KST 기준 오늘 날짜를 기본값으로 사용
          const startDate = studentStartDates[studentId] || getTodayKST();
          const startDateObj = new Date(startDate);
          startDateObj.setDate(startDateObj.getDate() - 1);
          // KST 기준으로 -1일 후 날짜 문자열 계산
          const endDate = formatDateKST(startDateObj);

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

      // 학생 추가 (기존 종료 enrollment이 있으면 부활, 없으면 신규 생성)
      if (addStudentIds.length > 0) {
        // KST 기준 오늘 날짜
        const today = getTodayKST();
        const addPromises = addStudentIds.map(async (studentId) => {
          const enrollmentsRef = collection(db, COL_STUDENTS, studentId, 'enrollments');
          // 개별 시작일이 지정되어 있으면 사용, 없으면 오늘 날짜
          const startDate = studentStartDates[studentId] || today;

          // 기존 종료된 enrollment 확인 (같은 subject + className)
          const existingQuery = query(
            enrollmentsRef,
            where('subject', '==', subject),
            where('className', '==', className)
          );
          const existingSnap = await getDocs(existingQuery);
          const endedDoc = existingSnap.docs.find(d => {
            const data = d.data();
            return data.endDate || data.withdrawalDate;
          });

          if (endedDoc) {
            // 기존 종료 enrollment 부활: endDate/withdrawalDate 제거 + 시작일 갱신
            const updateData: any = {
              endDate: null,
              withdrawalDate: null,
              enrollmentDate: startDate,
              startDate: startDate,
              staffId: teacher,
              teacher: teacher,
              schedule,
              updatedAt: new Date().toISOString(),
            };
            if (studentAttendanceDays[studentId] && studentAttendanceDays[studentId].length > 0) {
              updateData.attendanceDays = studentAttendanceDays[studentId];
            }
            if (studentUnderlines[studentId]) updateData.underline = true;
            if (studentSlotTeachers[studentId]) updateData.isSlotTeacher = true;
            await updateDoc(endedDoc.ref, updateData);
          } else {
            // 기존 enrollment 없음 → 신규 생성 (doc ID = classId)
            // classId 조회
            const classQuery = query(collection(db, COL_CLASSES), where('className', '==', className), where('subject', '==', subject));
            const classSnap = await getDocs(classQuery);
            if (classSnap.empty) {
              console.error(`[enrollment] 수업을 찾을 수 없습니다: ${className} (${subject})`);
              throw new Error(`수업 "${className}"을(를) 찾을 수 없습니다. 수업을 먼저 생성해주세요.`);
            }
            const classId = classSnap.docs[0].id;

            const enrollmentRef = doc(db, COL_STUDENTS, studentId, 'enrollments', classId);
            const enrollmentData: any = {
              className,
              classId,
              staffId: teacher,
              teacher: teacher,
              subject,
              schedule,
              startDate,
              enrollmentDate: startDate,
              createdAt: new Date().toISOString(),
            };
            if (studentAttendanceDays[studentId] && studentAttendanceDays[studentId].length > 0) {
              enrollmentData.attendanceDays = studentAttendanceDays[studentId];
            }
            if (studentUnderlines[studentId]) {
              enrollmentData.underline = true;
            }
            if (studentSlotTeachers[studentId]) {
              enrollmentData.isSlotTeacher = true;
            }
            await setDoc(enrollmentRef, enrollmentData);
          }
        });
        await Promise.all(addPromises);
      }

      // 학생 제거 (반이동): enrollment에 endDate 설정 (삭제하지 않음)
      // 이렇게 하면 출석부에서 해당 월의 수강 기록을 유지하면서, 이후 월에서는 제외됨
      if (removeStudentIds.length > 0) {
        // KST 기준 오늘 날짜
        // 전날로 설정하여 즉시 퇴원 처리
        const yd = new Date(); yd.setDate(yd.getDate() - 1);
        const yesterday = yd.toISOString().split('T')[0];
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
              endDate: yesterday,
              withdrawalDate: yesterday,  // useClassDetail 필터링 + 시간표 퇴원 섹션 표시용
              updatedAt: new Date().toISOString()
            });
          });

          await Promise.all(updatePromises);
        });
        await Promise.all(removePromises);
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

      // 기존 학생 등원일(enrollmentDate) 변경 (추가/제거 대상이 아닌 학생들)
      const enrollmentDateStudentIds = Object.keys(studentEnrollmentDates).filter(
        id => !addStudentIds.includes(id) && !removeStudentIds.includes(id)
      );

      if (enrollmentDateStudentIds.length > 0) {
        const enrollmentDatePromises = enrollmentDateStudentIds.map(async (studentId) => {
          const enrollmentsQuery = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('subject', '==', subject),
            where('className', '==', className)
          );
          const snapshot = await getDocs(enrollmentsQuery);

          const updateOps = snapshot.docs.map(async (docSnap) => {
            const newDate = studentEnrollmentDates[studentId];
            if (newDate) {
              await updateDoc(docSnap.ref, {
                startDate: newDate,
                enrollmentDate: newDate,
                updatedAt: new Date().toISOString()
              });
            }
          });

          await Promise.all(updateOps);
        });
        await Promise.all(enrollmentDatePromises);
      }

      // ===== attendanceDays 변경 처리 (맨 마지막에 실행: 다른 step들이 새 enrollment을 덮어쓰지 않도록) =====
      // attendanceDays가 실제로 변경된 경우: 기존 enrollment 종료 + 새 enrollment 생성
      // (등록일부터 소급 변경되지 않도록 분리)
      const updateStudentIds = Object.keys(studentAttendanceDays).filter(
        id => !addStudentIds.includes(id) && !removeStudentIds.includes(id)
      );

      if (updateStudentIds.length > 0) {
        const today = getTodayKST();
        const yesterday = (() => {
          const d = new Date(today);
          d.setDate(d.getDate() - 1);
          return formatDateKST(d);
        })();

        // classId 조회 (새 enrollment doc ID 생성에 필요)
        let classId = '';
        const classQuery2 = query(collection(db, COL_CLASSES), where('className', '==', className), where('subject', '==', subject));
        const classSnap2 = await getDocs(classQuery2);
        if (!classSnap2.empty) {
          classId = classSnap2.docs[0].id;
        }

        const updatePromises = updateStudentIds.map(async (studentId) => {
          const enrollmentsQuery = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('subject', '==', subject),
            where('className', '==', className)
          );
          // 최신 상태 re-read (이전 step들의 업데이트 반영)
          const snapshot = await getDocs(enrollmentsQuery);

          // 활성 enrollment만 대상 (이미 종료된 것은 건드리지 않음)
          const activeDocs = snapshot.docs.filter(d => {
            const data = d.data();
            return !data.endDate && !data.withdrawalDate;
          });

          for (const docSnap of activeDocs) {
            const existingData = docSnap.data();
            const existingDays = existingData.attendanceDays || [];
            const newDays = studentAttendanceDays[studentId] || [];

            // 정렬 후 비교하여 실제 변경 여부 확인
            const sortedExisting = [...existingDays].sort();
            const sortedNew = [...newDays].sort();
            const isChanged = sortedExisting.length !== sortedNew.length ||
              sortedExisting.some((d: string, i: number) => d !== sortedNew[i]);

            if (!isChanged) continue; // 변경 없으면 스킵

            if (!classId) {
              // classId를 못 찾으면 단순 업데이트 (fallback)
              await updateDoc(docSnap.ref, { attendanceDays: newDays });
              continue;
            }

            // 기존 enrollment 종료 (어제 날짜로)
            await updateDoc(docSnap.ref, {
              endDate: yesterday,
              updatedAt: new Date().toISOString(),
            });

            // 새 enrollment 생성 (오늘부터, 새 attendanceDays 적용)
            const newDocId = `${classId}_${Date.now()}`;
            const newEnrollmentRef = doc(db, COL_STUDENTS, studentId, 'enrollments', newDocId);
            await setDoc(newEnrollmentRef, {
              className,
              classId,
              staffId: existingData.staffId || teacher,
              teacher: existingData.teacher || teacher,
              subject,
              schedule: existingData.schedule || schedule,
              startDate: today,
              enrollmentDate: today,
              createdAt: new Date().toISOString(),
              // attendanceDays: 특정 요일만 등원하는 경우만 저장
              ...(newDays.length > 0 ? { attendanceDays: newDays } : {}),
              ...(existingData.underline ? { underline: true } : {}),
              ...(existingData.isSlotTeacher ? { isSlotTeacher: true } : {}),
            });
          }
        });
        await Promise.all(updatePromises);
      }

      // 로그 기록
      if (transferStudentIds.length > 0) {
        transferStudentIds.forEach(studentId => {
          logTimetableChange({
            action: 'student_transfer',
            subject,
            className,
            studentId,
            details: `반이동: ${transferFromClass[studentId]} → ${className}`,
            before: { className: transferFromClass[studentId] },
            after: { className },
          });
        });
      }
      if (addStudentIds.length > 0) {
        logTimetableChange({
          action: 'student_enroll',
          subject,
          className,
          details: `학생 등록: ${addStudentIds.length}명 → ${className}`,
          after: { className, studentIds: addStudentIds },
        });
      }
      if (removeStudentIds.length > 0) {
        logTimetableChange({
          action: 'student_unenroll',
          subject,
          className,
          details: `학생 제거: ${removeStudentIds.length}명 ← ${className}`,
          before: { className, studentIds: removeStudentIds },
        });
      }
      if (endDateStudentIds.length > 0) {
        logTimetableChange({
          action: 'enrollment_update',
          subject,
          className,
          details: `종료예정일 변경: ${endDateStudentIds.length}명`,
          after: { studentEndDates: Object.fromEntries(endDateStudentIds.map(id => [id, studentEndDates[id]])) },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', true] });  // 시간표 studentMap 갱신
      queryClient.invalidateQueries({ queryKey: ['classDetail'] });
      queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });  // 수학 시간표 실시간 반영
      // mathClassStudents는 students 쿼리 무효화로 자동 갱신됨 (useMemo 의존성)
    },
  });
};
