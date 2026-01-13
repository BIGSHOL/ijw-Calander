import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    query,
    orderBy,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    where,
    limit
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Exam, ExamType } from '../types';

const COL_EXAMS = 'exams';

/**
 * 전체 시험 목록 조회 Hook
 *
 * @param options 필터 옵션
 */
export const useExams = (options?: {
    subject?: 'math' | 'english' | 'both';
    type?: ExamType;
    gradeLevel?: string;
    limitCount?: number;
}) => {
    return useQuery<Exam[]>({
        queryKey: ['exams', options],
        queryFn: async () => {
            let q = query(
                collection(db, COL_EXAMS),
                orderBy('date', 'desc')
            );

            if (options?.limitCount) {
                q = query(q, limit(options.limitCount));
            }

            const snapshot = await getDocs(q);
            let exams = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Exam));

            // 클라이언트 사이드 필터링
            if (options?.subject) {
                exams = exams.filter(e => e.subject === options.subject || e.subject === 'both');
            }
            if (options?.type) {
                exams = exams.filter(e => e.type === options.type);
            }
            if (options?.gradeLevel) {
                exams = exams.filter(e => !e.gradeLevel || e.gradeLevel === options.gradeLevel);
            }

            return exams;
        },
        staleTime: 1000 * 60 * 10,   // 10분 캐싱
        gcTime: 1000 * 60 * 30,       // 30분 GC
    });
};

/**
 * 최근 시험 목록 조회 (드롭다운용)
 */
export const useRecentExams = (count: number = 10) => {
    return useExams({ limitCount: count });
};

/**
 * 시험 생성 Mutation
 */
export const useCreateExam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (examData: Omit<Exam, 'id' | 'createdAt'>) => {
            const now = Date.now();
            const docRef = await addDoc(collection(db, COL_EXAMS), {
                ...examData,
                createdAt: now,
            });

            return { id: docRef.id, ...examData, createdAt: now };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exams'] });
        },
    });
};

/**
 * 시험 수정 Mutation
 */
export const useUpdateExam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Exam> }) => {
            const docRef = doc(db, COL_EXAMS, id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: Date.now(),
            });
            return { id, ...updates };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exams'] });
        },
    });
};

/**
 * 시험 삭제 Mutation
 */
export const useDeleteExam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (examId: string) => {
            await deleteDoc(doc(db, COL_EXAMS, examId));
            return examId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            // 관련 성적도 무효화 (삭제는 별도 처리 필요)
            queryClient.invalidateQueries({ queryKey: ['student_scores'] });
        },
    });
};

/**
 * 시험 유형별 그룹화 헬퍼
 */
export const groupExamsByType = (exams: Exam[]): Record<ExamType, Exam[]> => {
    const grouped: Record<ExamType, Exam[]> = {
        daily: [],
        weekly: [],
        monthly: [],
        midterm: [],
        final: [],
        mock: [],
        school: [],
        competition: [],
        diagnostic: [],
        other: [],
    };

    exams.forEach(exam => {
        grouped[exam.type].push(exam);
    });

    return grouped;
};

/**
 * 월별 시험 그룹화 헬퍼
 */
export const groupExamsByMonth = (exams: Exam[]): Record<string, Exam[]> => {
    const grouped: Record<string, Exam[]> = {};

    exams.forEach(exam => {
        const month = exam.date.substring(0, 7); // YYYY-MM
        if (!grouped[month]) {
            grouped[month] = [];
        }
        grouped[month].push(exam);
    });

    return grouped;
};

export default useExams;
