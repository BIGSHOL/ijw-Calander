import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { StudentScore } from '../../../types';

// 시험별 전체 성적 조회 Hook
export const useExamScores = (examId: string) => {
  return useQuery<StudentScore[]>({
    queryKey: ['exam_scores', examId],
    queryFn: async () => {
      if (!examId) return [];
      const q = query(
        collection(db, 'student_scores'),
        where('examId', '==', examId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StudentScore));
    },
    enabled: !!examId,
    staleTime: 1000 * 60 * 5,
  });
};
