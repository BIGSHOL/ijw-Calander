import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent } from '../types';

export interface ClassStudent {
  id: string;
  name: string;
  grade: string;
  status: 'active' | 'on_hold' | 'withdrawn';
  enrollmentDate: string;
}

export interface ClassDetail {
  className: string;
  teacher: string;
  subject: 'math' | 'english';
  schedule: string[];
  studentCount: number;
  students: ClassStudent[];
}

/**
 * 수업 상세 정보 조회 Hook
 *
 * @param className 수업명
 * @param subject 과목 (math/english)
 * @returns 수업 상세 정보 + 학생 목록
 *
 * 로직:
 * 1. students 컬렉션 전체 조회
 * 2. 각 학생의 enrollments 서브컬렉션에서 해당 className + subject와 일치하는 것만 필터
 * 3. 학생 정보 + enrollment 정보 조합
 */
export const useClassDetail = (className: string, subject: 'math' | 'english') => {
  return useQuery<ClassDetail>({
    queryKey: ['classDetail', className, subject],
    queryFn: async () => {
      console.log(`[useClassDetail] Fetching details for class: ${className}, subject: ${subject}`);

      // collectionGroup으로 모든 enrollments 조회 (subject + className 필터)
      const enrollmentsQuery = query(
        collectionGroup(db, 'enrollments'),
        where('subject', '==', subject),
        where('className', '==', className)
      );

      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

      // 학생 ID 수집
      const studentIds = new Set<string>();
      let teacher = '';
      let schedule: string[] = [];

      enrollmentsSnapshot.docs.forEach(doc => {
        const studentId = doc.ref.parent.parent?.id;
        if (studentId) {
          studentIds.add(studentId);
        }

        // enrollment 데이터에서 teacher, schedule 가져오기 (첫 번째 것 사용)
        if (!teacher) {
          const data = doc.data();
          teacher = data.teacherId || data.teacher || '';
          schedule = data.schedule || [];
        }
      });

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
      };
    },
    enabled: !!className && !!subject, // className과 subject가 있을 때만 실행
    staleTime: 1000 * 60 * 5,  // 5분 캐싱
    gcTime: 1000 * 60 * 15,    // 15분 GC
  });
};

export default useClassDetail;
