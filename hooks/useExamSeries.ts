import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COL_EXAM_SERIES = 'exam_series';

export interface ExamSeries {
    id: string;
    name: string;               // "2026년 1월 모의고사 시리즈"
    description?: string;
    subject?: 'math' | 'english' | 'both';
    createdAt: number;
    createdBy: string;
    examCount?: number;         // 소속 시험 수 (조회 시 계산)
}

/**
 * 시험 시리즈 목록 조회 Hook
 */
export const useExamSeries = () => {
    return useQuery<ExamSeries[]>({
        queryKey: ['exam_series'],
        queryFn: async () => {
            const q = query(
                collection(db, COL_EXAM_SERIES),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as ExamSeries));
        },
        staleTime: 1000 * 60 * 10,  // 10분 캐싱
    });
};

/**
 * 시험 시리즈 생성 Mutation
 */
export const useCreateExamSeries = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Omit<ExamSeries, 'id' | 'createdAt'>) => {
            const docRef = await addDoc(collection(db, COL_EXAM_SERIES), {
                ...data,
                createdAt: Date.now(),
            });
            return { id: docRef.id, ...data, createdAt: Date.now() };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exam_series'] });
        },
        onError: (error: Error) => {
            console.error('[useCreateExamSeries] mutation error:', error);
        },
    });
};

export default useExamSeries;
