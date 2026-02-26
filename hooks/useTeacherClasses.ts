import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { toDateStringKST } from '../utils/dateUtils';

export interface TeacherClassInfo {
  id: string;
  className: string;
  subject: string;
  role: '담임' | '부담임';
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
}

/**
 * 강사의 수업 이력 조회 Hook
 * - 담임(teacher/mainTeacher) + 부담임(slotTeachers) 수업 모두 조회
 * - isActive 필터 없이 전체 수업 (이력 포함)
 */
export const useTeacherClasses = (teacherName: string | undefined) => {
  return useQuery<TeacherClassInfo[]>({
    queryKey: ['teacherClasses', teacherName],
    enabled: !!teacherName,
    queryFn: async () => {
      if (!teacherName) return [];

      // 1) 담임 수업 조회: teacher == teacherName (isActive 필터 없음)
      const teacherQuery = query(
        collection(db, 'classes'),
        where('teacher', '==', teacherName)
      );
      const teacherSnapshot = await getDocs(teacherQuery);

      // 2) mainTeacher 필드도 조회 (영어 수업 등)
      const mainTeacherQuery = query(
        collection(db, 'classes'),
        where('mainTeacher', '==', teacherName)
      );
      const mainTeacherSnapshot = await getDocs(mainTeacherQuery);

      // 담임 수업 맵 (중복 방지)
      const classMap = new Map<string, TeacherClassInfo>();

      // teacher 필드 매칭
      teacherSnapshot.docs.forEach(doc => {
        const data = doc.data();
        classMap.set(doc.id, {
          id: doc.id,
          className: data.className || '',
          subject: data.subject || 'math',
          role: '담임',
          isActive: data.isActive !== false,
          // KST 기준으로 Firestore Timestamp 변환
          startDate: toDateStringKST(data.createdAt),
          endDate: data.isActive === false ? toDateStringKST(data.updatedAt) : null,
        });
      });

      // mainTeacher 필드 매칭 (중복 제외)
      mainTeacherSnapshot.docs.forEach(doc => {
        if (classMap.has(doc.id)) return;
        const data = doc.data();
        classMap.set(doc.id, {
          id: doc.id,
          className: data.className || '',
          subject: data.subject || 'math',
          role: '담임',
          isActive: data.isActive !== false,
          // KST 기준으로 Firestore Timestamp 변환
          startDate: toDateStringKST(data.createdAt),
          endDate: data.isActive === false ? toDateStringKST(data.updatedAt) : null,
        });
      });

      // 3) 부담임 수업 조회: 전체 수업에서 slotTeachers 값에 teacherName 포함된 것 필터
      const allClassesSnapshot = await getDocs(collection(db, 'classes'));
      allClassesSnapshot.docs.forEach(doc => {
        if (classMap.has(doc.id)) return; // 이미 담임으로 등록된 수업
        const data = doc.data();
        const slotTeachers = data.slotTeachers as Record<string, string> | undefined;
        if (!slotTeachers) return;

        const isSubTeacher = Object.values(slotTeachers).some(name => name === teacherName);
        if (isSubTeacher) {
          classMap.set(doc.id, {
            id: doc.id,
            className: data.className || '',
            subject: data.subject || 'math',
            role: '부담임',
            isActive: data.isActive !== false,
            // KST 기준으로 Firestore Timestamp 변환
            startDate: toDateStringKST(data.createdAt),
            endDate: data.isActive === false ? toDateStringKST(data.updatedAt) : null,
          });
        }
      });

      const classes = Array.from(classMap.values());

      // 진행중 수업 상단, 종료 수업 하단. 같은 그룹 내에서는 className 정렬
      classes.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.className.localeCompare(b.className, 'ko');
      });

      return classes;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
};
