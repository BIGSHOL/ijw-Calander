import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, collectionGroup, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent, SubjectType } from '../types';
import { convertTimestampToDate } from '../utils/firestoreConverters';
import { getTodayKST } from '../utils/dateUtils';

const COL_CLASSES = 'classes';

export interface ClassStudent {
  id: string;
  name: string;
  school: string;
  grade: string;
  status: 'active' | 'on_hold' | 'withdrawn' | 'prospect' | 'prospective';
  enrollmentDate: string;
  attendanceDays?: string[];  // 실제 등원 요일 (비어있으면 모든 수업 요일에 등원)
  underline?: boolean;  // 영어 시간표용 밑줄 강조 표시
  isSlotTeacher?: boolean;  // 부담임 여부 (슬롯 교사)
  enrollmentId?: string;  // enrollment 문서 ID (onHold 업데이트용)
  onHold?: boolean;  // enrollment.onHold 상태
  isScheduled?: boolean;  // 미래 시작일 (배정 예정)
  isWithdrawn?: boolean;  // 퇴원/종료됨
  withdrawalDate?: string;  // 퇴원/종료일
  // Audit (최종 수정자) — 등록/퇴원/복원 처리한 사람 정보
  lastModifiedByName?: string;   // eg "이성우"
  lastModifiedByRole?: string;   // eg "math_teacher", "admin"
  lastModifiedAt?: string;       // ISO timestamp
  lastAction?: 'enrolled' | 'withdrawn' | 'restored' | 'transferred';
}

export interface ClassDetail {
  className: string;
  teacher: string;
  subject: SubjectType;
  schedule: string[];
  studentCount: number;
  students: ClassStudent[];
  room?: string;
  slotTeachers?: Record<string, string>;  // { "월-4": "부담임명", ... }
  slotRooms?: Record<string, string>;     // { "월-4": "301", ... }
  memo?: string;  // 수업 메모
}

/**
 * 수업 상세 정보 조회 Hook
 *
 * @param className 수업명
 * @param subject 과목 (math/english/science/korean/other)
 * @returns 수업 상세 정보 + 학생 목록
 *
 * 로직:
 * 1. classes 컬렉션에서 수업 정보 (teacher, schedule) 조회
 * 2. enrollments에서 학생 ID 수집
 * 3. students 컬렉션에서 학생 정보 조회
 */
export const useClassDetail = (className: string, subject: SubjectType) => {
  return useQuery<ClassDetail>({
    queryKey: ['classDetail', className, subject],
    queryFn: async () => {
      let teacher = '';
      let schedule: string[] = [];
      let room = '';
      let slotTeachers: Record<string, string> = {};
      let slotRooms: Record<string, string> = {};
      let memo = '';

      // OPTIMIZATION: Parallelize independent queries (async-parallel)
      const classesQuery = query(
        collection(db, COL_CLASSES),
        where('subject', '==', subject),
        where('className', '==', className)
      );
      const enrollmentsQuery = query(
        collectionGroup(db, 'enrollments'),
        where('subject', '==', subject),
        where('className', '==', className)
      );
      const studentsQuery = query(collection(db, 'students'));
      // Audit fallback: 기존 데이터용 timetable_logs 조회 (audit 필드 없는 enrollment 대비)
      const logsQuery = query(
        collection(db, 'timetable_logs'),
        where('subject', '==', subject),
        where('className', '==', className)
      );

      const [classesSnapshot, enrollmentsSnapshot, studentsSnapshot, logsSnapshot] = await Promise.all([
        getDocs(classesQuery).catch(() => null),
        getDocs(enrollmentsQuery).catch(() => null),
        getDocs(studentsQuery).catch(() => null),
        getDocs(logsQuery).catch(() => null),
      ]);

      // timetable_logs → 학생별 최신 항목 (action별 분리 - enroll/withdraw)
      const studentLogLatest: Record<string, { changedBy: string; timestamp: string; action: string }> = {};
      if (logsSnapshot) {
        logsSnapshot.docs.forEach(d => {
          const data = d.data() as any;
          const sid = data.studentId;
          if (!sid) return;
          const ts = data.timestamp;
          if (!ts) return;
          const prev = studentLogLatest[sid];
          if (!prev || ts > prev.timestamp) {
            studentLogLatest[sid] = {
              changedBy: data.changedBy || 'unknown',
              timestamp: ts,
              action: data.action || '',
            };
          }
        });
      }

      // 1. Process classes data
      if (classesSnapshot && classesSnapshot.docs.length > 0) {
        const classDoc = classesSnapshot.docs[0].data();
        teacher = classDoc.teacher || '';
        room = classDoc.room || '';
        slotTeachers = classDoc.slotTeachers || {};
        slotRooms = classDoc.slotRooms || {};
        memo = classDoc.memo || '';
        // schedule이 ScheduleSlot[] 형식이면 문자열로 변환
        if (classDoc.schedule && Array.isArray(classDoc.schedule)) {
          if (typeof classDoc.schedule[0] === 'object') {
            schedule = classDoc.schedule.map((slot: any) => `${slot.day} ${slot.periodId}`);
          } else {
            schedule = classDoc.legacySchedule || classDoc.schedule || [];
          }
        }
      }

      // 2. enrollments에서 학생 ID 수집 (attendanceDays, underline, enrollmentId, onHold, isScheduled, isWithdrawn 포함)
      const studentIds = new Set<string>();
      const studentAttendanceDays: Record<string, string[]> = {};  // studentId -> attendanceDays
      const studentUnderline: Record<string, boolean> = {};  // studentId -> underline
      const studentEnrollmentIds: Record<string, string> = {};  // studentId -> enrollmentId (활성 enrollment 우선)
      const studentOnHold: Record<string, boolean> = {};  // studentId -> onHold
      const studentHasActiveEnrollment: Record<string, boolean> = {};  // 활성 enrollment 존재 여부
      const studentIsScheduledOnly: Record<string, boolean> = {};  // 미래 시작일 enrollment만 있는지
      const studentIsWithdrawnOnly: Record<string, boolean> = {};  // 퇴원 enrollment만 있는지
      const studentWithdrawalDates: Record<string, string> = {};  // studentId -> withdrawalDate
      const studentEnrollmentStartDates: Record<string, string> = {};  // enrollment별 시작일
      // Audit: 학생별 최종 수정자 (활성 enrollment 우선, 없으면 퇴원/예약 enrollment)
      const studentAuditName: Record<string, string> = {};
      const studentAuditRole: Record<string, string> = {};
      const studentAuditAt: Record<string, string> = {};
      const studentAuditAction: Record<string, 'enrolled' | 'withdrawn' | 'restored' | 'transferred'> = {};

      // KST 기준 오늘 날짜로 미래 enrollment 필터링
      const today = getTodayKST();

      if (enrollmentsSnapshot) {
        enrollmentsSnapshot.docs.forEach(doc => {
          const studentId = doc.ref.parent.parent?.id;
          if (studentId) {
            const data = doc.data();

            const startDate = convertTimestampToDate(data.enrollmentDate || data.startDate);
            const withdrawalDate = convertTimestampToDate(data.withdrawalDate);
            const endDate = convertTimestampToDate(data.endDate);

            const isFutureStart = !!(startDate && startDate > today);
            const hasEndDate = !!(withdrawalDate || endDate);

            if (!hasEndDate && !isFutureStart) {
              // 활성 enrollment: 퇴원/미래시작 아님 → 재원생
              studentHasActiveEnrollment[studentId] = true;
              // 활성 enrollment의 데이터를 우선 사용
              studentEnrollmentIds[studentId] = doc.id;
              studentOnHold[studentId] = data.onHold || false;
              if (startDate) studentEnrollmentStartDates[studentId] = startDate;
              if (data.attendanceDays && Array.isArray(data.attendanceDays)) {
                studentAttendanceDays[studentId] = data.attendanceDays;
              }
              if (data.underline !== undefined) {
                studentUnderline[studentId] = data.underline;
              }
              // Audit: 활성 enrollment은 항상 우선 (재원생 정보용)
              if (data.lastModifiedByName) studentAuditName[studentId] = data.lastModifiedByName;
              if (data.lastModifiedByRole) studentAuditRole[studentId] = data.lastModifiedByRole;
              if (data.lastModifiedAt) studentAuditAt[studentId] = data.lastModifiedAt;
              if (data.lastAction) studentAuditAction[studentId] = data.lastAction;
            } else if (isFutureStart && !hasEndDate) {
              // 미래 시작일 enrollment (배정 예정)
              studentIsScheduledOnly[studentId] = true;
              // 활성 enrollment이 없을 때만 데이터 사용
              if (!studentHasActiveEnrollment[studentId]) {
                studentEnrollmentIds[studentId] = doc.id;
                studentOnHold[studentId] = data.onHold || false;
                if (startDate) studentEnrollmentStartDates[studentId] = startDate;
                if (data.lastModifiedByName) studentAuditName[studentId] = data.lastModifiedByName;
                if (data.lastModifiedByRole) studentAuditRole[studentId] = data.lastModifiedByRole;
                if (data.lastModifiedAt) studentAuditAt[studentId] = data.lastModifiedAt;
                if (data.lastAction) studentAuditAction[studentId] = data.lastAction;
              }
            } else if (hasEndDate) {
              // 퇴원/종료 enrollment
              studentIsWithdrawnOnly[studentId] = true;
              studentWithdrawalDates[studentId] = (withdrawalDate || endDate)!;
              // 활성 enrollment이 없을 때만 데이터 사용
              if (!studentHasActiveEnrollment[studentId]) {
                studentEnrollmentIds[studentId] = doc.id;
                studentOnHold[studentId] = data.onHold || false;
                if (startDate) studentEnrollmentStartDates[studentId] = startDate;
                if (data.lastModifiedByName) studentAuditName[studentId] = data.lastModifiedByName;
                if (data.lastModifiedByRole) studentAuditRole[studentId] = data.lastModifiedByRole;
                if (data.lastModifiedAt) studentAuditAt[studentId] = data.lastModifiedAt;
                if (data.lastAction) studentAuditAction[studentId] = data.lastAction;
              }
            }

            studentIds.add(studentId);
          }

          // classes에서 못 가져왔으면 enrollment에서 fallback
          if (!teacher) {
            const data = doc.data();
            teacher = data.staffId || '';
            schedule = data.schedule || [];
          }
        });
      }

      // 최종 플래그 결정: 활성 enrollment이 있으면 isScheduled/isWithdrawn 무시
      const studentIsScheduled: Record<string, boolean> = {};
      const studentIsWithdrawn: Record<string, boolean> = {};
      studentIds.forEach(studentId => {
        if (studentHasActiveEnrollment[studentId]) {
          // 활성 enrollment이 있으면 재원생 (다른 플래그 무시)
          studentIsScheduled[studentId] = false;
          studentIsWithdrawn[studentId] = false;
        } else if (studentIsScheduledOnly[studentId]) {
          studentIsScheduled[studentId] = true;
        } else if (studentIsWithdrawnOnly[studentId]) {
          studentIsWithdrawn[studentId] = true;
        }
      });

      // 3. Build student list (combined map/filter for efficiency)
      const students: ClassStudent[] = [];

      if (studentIds.size > 0 && studentsSnapshot) {
        for (const doc of studentsSnapshot.docs) {
          if (studentIds.has(doc.id)) {
            const data = doc.data() as UnifiedStudent;
            // Audit fallback: enrollment record에 audit 필드 없으면 timetable_logs 사용
            let auditName = studentAuditName[doc.id];
            let auditRole = studentAuditRole[doc.id];
            let auditAt = studentAuditAt[doc.id];
            let auditAction = studentAuditAction[doc.id];
            if (!auditName) {
              const logEntry = studentLogLatest[doc.id];
              if (logEntry) {
                // log의 changedBy는 이메일 또는 displayName — 이메일이면 @ 앞부분만
                const cb = logEntry.changedBy;
                auditName = cb.includes('@') ? cb.split('@')[0] : cb;
                auditAt = logEntry.timestamp;
                // log action → 우리 enum
                if (logEntry.action.includes('withdraw')) auditAction = 'withdrawn';
                else if (logEntry.action.includes('enroll')) auditAction = 'enrolled';
                else if (logEntry.action.includes('transfer')) auditAction = 'transferred';
                else if (logEntry.action.includes('restore')) auditAction = 'restored';
                // role은 알 수 없음 (log에 미저장)
              }
            }
            students.push({
              id: doc.id,
              name: data.name,
              school: data.school || '',
              grade: data.grade || '미정',
              status: data.status,
              // enrollment별 시작일 우선, 없으면 학생 기본 startDate fallback
              enrollmentDate: studentEnrollmentStartDates[doc.id] || data.startDate || '',
              attendanceDays: studentAttendanceDays[doc.id],
              enrollmentId: studentEnrollmentIds[doc.id],
              onHold: studentOnHold[doc.id] || false,
              isScheduled: studentIsScheduled[doc.id] || false,
              isWithdrawn: studentIsWithdrawn[doc.id] || false,
              withdrawalDate: studentWithdrawalDates[doc.id],
              lastModifiedByName: auditName,
              lastModifiedByRole: auditRole,
              lastModifiedAt: auditAt,
              lastAction: auditAction,
            });
          }
        }

        // 이름순 정렬
        students.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      }

      // studentCount는 재원생만 (대기생/퇴원생 제외)
      const activeStudentCount = students.filter(s => !s.isScheduled && !s.isWithdrawn).length;

      return {
        className,
        teacher,
        subject,
        schedule,
        studentCount: activeStudentCount,
        students,
        room,
        slotTeachers,
        slotRooms,
        memo,
      };
    },
    enabled: !!className && !!subject, // className과 subject가 있을 때만 실행
    staleTime: 1000 * 60 * 5,  // 5분 캐싱
    gcTime: 1000 * 60 * 15,    // 15분 GC
  });
};

export default useClassDetail;
