import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, collectionGroup, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent, SubjectType } from '../types';

const COL_CLASSES = 'classes';

// Helper to convert Firestore Timestamp to YYYY-MM-DD string (hoisted to module level)
const convertTimestampToDate = (timestamp: any): string | undefined => {
  if (!timestamp) return undefined;
  if (typeof timestamp === 'string') return timestamp;
  if (timestamp?.toDate) {
    const date = timestamp.toDate();
    return date.toISOString().split('T')[0];
  }
  return undefined;
};

export interface ClassStudent {
  id: string;
  name: string;
  school: string;
  grade: string;
  status: 'active' | 'on_hold' | 'withdrawn';
  enrollmentDate: string;
  attendanceDays?: string[];  // 실제 등원 요일 (비어있으면 모든 수업 요일에 등원)
  underline?: boolean;  // 영어 시간표용 밑줄 강조 표시
  enrollmentId?: string;  // enrollment 문서 ID (onHold 업데이트용)
  onHold?: boolean;  // enrollment.onHold 상태
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

      const [classesSnapshot, enrollmentsSnapshot, studentsSnapshot] = await Promise.all([
        getDocs(classesQuery).catch(() => null),
        getDocs(enrollmentsQuery).catch(() => null),
        getDocs(studentsQuery).catch(() => null),
      ]);

      // 1. Process classes data
      if (classesSnapshot && classesSnapshot.docs.length > 0) {
        const classDoc = classesSnapshot.docs[0].data();
        teacher = classDoc.teacher || '';
        room = classDoc.room || '';
        slotTeachers = classDoc.slotTeachers || {};
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

      // 2. enrollments에서 학생 ID 수집 (attendanceDays, underline, enrollmentId, onHold 포함)
      const studentIds = new Set<string>();
      const studentAttendanceDays: Record<string, string[]> = {};  // studentId -> attendanceDays
      const studentUnderline: Record<string, boolean> = {};  // studentId -> underline
      const studentEnrollmentIds: Record<string, string> = {};  // studentId -> enrollmentId
      const studentOnHold: Record<string, boolean> = {};  // studentId -> onHold

      // Get today's date for filtering future enrollments
      const today = new Date().toISOString().split('T')[0];

      if (enrollmentsSnapshot) {
        enrollmentsSnapshot.docs.forEach(doc => {
          const studentId = doc.ref.parent.parent?.id;
          if (studentId) {
            const data = doc.data();

            // Filter out students with future start dates (not yet started)
            const startDate = convertTimestampToDate(data.enrollmentDate || data.startDate);
            if (startDate && startDate > today) return;

            // Filter out withdrawn students
            const withdrawalDate = convertTimestampToDate(data.withdrawalDate);
            if (withdrawalDate) return;

            // Don't completely filter out onHold students (they should appear in the list)
            // The onHold state will be shown visually in the UI

            studentIds.add(studentId);
            // enrollmentId 저장
            studentEnrollmentIds[studentId] = doc.id;
            // onHold 상태 저장
            studentOnHold[studentId] = data.onHold || false;
            // attendanceDays 저장
            if (data.attendanceDays && Array.isArray(data.attendanceDays)) {
              studentAttendanceDays[studentId] = data.attendanceDays;
            }
            // underline 저장 (영어 과목용)
            if (data.underline !== undefined) {
              studentUnderline[studentId] = data.underline;
            }
          }

          // classes에서 못 가져왔으면 enrollment에서 fallback
          if (!teacher) {
            const data = doc.data();
            teacher = data.teacherId || data.teacher || '';
            schedule = data.schedule || [];
          }
        });
      }

      // 3. Build student list (combined map/filter for efficiency)
      const students: ClassStudent[] = [];

      if (studentIds.size > 0 && studentsSnapshot) {
        for (const doc of studentsSnapshot.docs) {
          if (studentIds.has(doc.id)) {
            const data = doc.data() as UnifiedStudent;
            students.push({
              id: doc.id,
              name: data.name,
              school: data.school || '',
              grade: data.grade || '미정',
              status: data.status,
              enrollmentDate: data.startDate || '',
              attendanceDays: studentAttendanceDays[doc.id],
              enrollmentId: studentEnrollmentIds[doc.id],
              onHold: studentOnHold[doc.id] || false,
            });
          }
        }

        // 이름순 정렬
        students.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      }

      return {
        className,
        teacher,
        subject,
        schedule,
        studentCount: students.length,
        students,
        room,
        slotTeachers,
        memo,
      };
    },
    enabled: !!className && !!subject, // className과 subject가 있을 때만 실행
    staleTime: 1000 * 60 * 5,  // 5분 캐싱
    gcTime: 1000 * 60 * 15,    // 15분 GC
    refetchOnWindowFocus: false,  // 창 포커스 시 자동 재요청 비활성화 (비용 절감)
  });
};

export default useClassDetail;
