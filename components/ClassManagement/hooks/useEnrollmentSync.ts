/**
 * useEnrollmentSync - enrollment 데이터 동기화 전용 훅
 *
 * useStudents(true) 대신 사용하여 성능 최적화:
 * - collectionGroup으로 enrollment만 직접 조회
 * - 필요한 학생 이름만 별도로 조회
 */

import { useState, useEffect } from 'react';
import { collectionGroup, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

interface EnrollmentData {
  studentId: string;
  studentName: string;
  enrollmentId: string;
  className: string;
  subject: string;
}

export function useEnrollmentSync(enabled: boolean) {
  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEnrollments = async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. collectionGroup으로 모든 enrollment 조회
      const enrollmentsSnap = await getDocs(collectionGroup(db, 'enrollments'));

      // 2. 학생 ID 추출
      const studentIds = new Set<string>();
      const enrollmentList: Array<{
        studentId: string;
        enrollmentId: string;
        className: string;
        subject: string;
      }> = [];

      enrollmentsSnap.docs.forEach(enrollDoc => {
        const pathParts = enrollDoc.ref.path.split('/');
        const studentId = pathParts[1];
        const data = enrollDoc.data();

        if (data.className) {
          studentIds.add(studentId);
          enrollmentList.push({
            studentId,
            enrollmentId: enrollDoc.id,
            className: data.className,
            subject: data.subject || 'math',
          });
        }
      });

      // 3. 필요한 학생 이름만 조회 (병렬 처리)
      const studentNameMap = new Map<string, string>();
      const studentPromises = Array.from(studentIds).map(async (studentId) => {
        try {
          const studentDoc = await getDoc(doc(db, 'students', studentId));
          if (studentDoc.exists()) {
            const name = studentDoc.data().name || '이름없음';
            studentNameMap.set(studentId, name);
          }
        } catch (err) {
          console.warn(`Failed to fetch student ${studentId}:`, err);
        }
      });

      await Promise.all(studentPromises);

      // 4. 최종 데이터 구성
      const result = enrollmentList.map(enroll => ({
        ...enroll,
        studentName: studentNameMap.get(enroll.studentId) || '이름없음',
      }));

      setEnrollments(result);
    } catch (err) {
      console.error('Failed to fetch enrollments:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [enabled]);

  return {
    enrollments,
    isLoading,
    error,
    refetch: fetchEnrollments,
  };
}
