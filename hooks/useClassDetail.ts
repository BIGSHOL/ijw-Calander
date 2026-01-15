import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, collectionGroup, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent, SubjectType } from '../types';

const COL_CLASSES = 'classes';

export interface ClassStudent {
  id: string;
  name: string;
  school: string;
  grade: string;
  status: 'active' | 'on_hold' | 'withdrawn';
  enrollmentDate: string;
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
      console.log(`[useClassDetail] Fetching details for class: ${className}, subject: ${subject}`);

      let teacher = '';
      let schedule: string[] = [];
      let room = '';
      let slotTeachers: Record<string, string> = {};
      let memo = '';

      // 1. classes 컬렉션에서 수업 정보 조회 (우선)
      try {
        const classesQuery = query(
          collection(db, COL_CLASSES),
          where('subject', '==', subject),
          where('className', '==', className)
        );
        const classesSnapshot = await getDocs(classesQuery);

        if (classesSnapshot.docs.length > 0) {
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
          console.log(`[useClassDetail] Found class info from classes collection: teacher=${teacher}, room=${room}, schedule=${JSON.stringify(schedule)}`);
        }
      } catch (err) {
        console.warn('[useClassDetail] Error fetching from classes collection:', err);
      }

      // 2. enrollments에서 학생 ID 수집
      const studentIds = new Set<string>();

      try {
        const enrollmentsQuery = query(
          collectionGroup(db, 'enrollments'),
          where('subject', '==', subject),
          where('className', '==', className)
        );

        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

        enrollmentsSnapshot.docs.forEach(doc => {
          const studentId = doc.ref.parent.parent?.id;
          if (studentId) {
            studentIds.add(studentId);
          }

          // classes에서 못 가져왔으면 enrollment에서 fallback
          if (!teacher) {
            const data = doc.data();
            teacher = data.teacherId || data.teacher || '';
            schedule = data.schedule || [];
          }
        });
      } catch (err) {
        console.warn('[useClassDetail] Error fetching from enrollments:', err);
      }

      console.log(`[useClassDetail] Found ${studentIds.size} students in class ${className}`);

      // 학생 정보 조회
      const students: ClassStudent[] = [];

      if (studentIds.size > 0) {
        const studentsQuery = query(collection(db, 'students'));
        const studentsSnapshot = await getDocs(studentsQuery);

        studentsSnapshot.docs.forEach(doc => {
          if (studentIds.has(doc.id)) {
            const data = doc.data() as UnifiedStudent;
            students.push({
              id: doc.id,
              name: data.name,
              school: data.school || '',
              grade: data.grade || '미정',
              status: data.status,
              enrollmentDate: data.startDate || '',
            });
          }
        });

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
  });
};

export default useClassDetail;
