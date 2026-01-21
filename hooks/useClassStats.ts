import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface ClassStatsResult {
  attendanceRate: number;
  consultationRate: number;
  isLoading: boolean;
}

/**
 * 특정 수업의 이번 달 통계 조회
 * @param className - 수업명
 * @param subject - 과목
 * @param studentIds - 수업에 등록된 학생 ID 목록
 */
export const useClassStats = (
  className: string,
  subject: string,
  studentIds: string[]
): ClassStatsResult => {
  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  // 출석률 계산
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['classAttendance', className, subject, monthStart, monthEnd],
    queryFn: async () => {
      if (studentIds.length === 0) return { rate: 0 };

      let totalRecords = 0;
      let presentRecords = 0;

      // 이번 달의 각 날짜에 대해 출석 데이터 조회
      const dates: string[] = [];
      const start = new Date(monthStart);
      const end = new Date(monthEnd);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      // 배치로 데이터 조회 (성능 최적화)
      const BATCH_SIZE = 7;
      for (let i = 0; i < dates.length; i += BATCH_SIZE) {
        const batch = dates.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (date) => {
            try {
              const recordsRef = collection(db, 'daily_attendance', date, 'records');
              const snapshot = await getDocs(recordsRef);

              snapshot.docs.forEach(doc => {
                const data = doc.data();
                // 해당 수업의 학생만 필터링
                if (
                  studentIds.includes(data.studentId) &&
                  data.className === className &&
                  data.subject === subject
                ) {
                  totalRecords++;
                  if (data.status === 'present' || data.status === 'late') {
                    presentRecords++;
                  }
                }
              });
            } catch (error) {
              console.warn(`Failed to fetch attendance for ${date}:`, error);
            }
          })
        );
      }

      const rate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;
      return { rate };
    },
    enabled: !!className && !!subject && studentIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5분 캐싱
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  // 상담률 계산
  const { data: consultationData, isLoading: consultationLoading } = useQuery({
    queryKey: ['classConsultation', className, subject, studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return { rate: 0 };

      // 이번 달 상담 기록 조회
      const consultationsRef = collection(db, 'consultations');
      const snapshot = await getDocs(consultationsRef);

      const thisMonth = format(now, 'yyyy-MM');

      // 상담 완료한 학생 집합
      const consultedStudents = new Set<string>();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const consultDate = data.consultationDate;

        // 이번 달 상담인지 확인
        if (consultDate && consultDate.startsWith(thisMonth)) {
          // registeredStudentId가 수업 학생 목록에 있는지 확인
          if (data.registeredStudentId && studentIds.includes(data.registeredStudentId)) {
            consultedStudents.add(data.registeredStudentId);
          }
        }
      });

      const rate = studentIds.length > 0
        ? Math.round((consultedStudents.size / studentIds.length) * 100)
        : 0;

      return { rate };
    },
    enabled: !!className && !!subject && studentIds.length > 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  return {
    attendanceRate: attendanceData?.rate || 0,
    consultationRate: consultationData?.rate || 0,
    isLoading: attendanceLoading || consultationLoading,
  };
};

export default useClassStats;
