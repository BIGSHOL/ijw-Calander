import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { StudentScore, calculateGrade } from '../types';

const COL_STUDENT_SCORES = 'student_scores';

/**
 * 학생별 성적 조회 Hook
 *
 * @param studentId 학생 ID
 * @param subject 과목 필터 (선택)
 */
export const useStudentScores = (studentId: string, subject?: 'math' | 'english') => {
    return useQuery<StudentScore[]>({
        queryKey: ['student_scores', studentId, subject],
        queryFn: async () => {
            if (!studentId) return [];

            let q = query(
                collection(db, COL_STUDENT_SCORES),
                where('studentId', '==', studentId),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            let scores = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as StudentScore));

            // 클라이언트 사이드 필터링 (과목)
            if (subject) {
                scores = scores.filter(s => s.subject === subject);
            }

            return scores;
        },
        staleTime: 1000 * 60 * 5,    // 5분 캐싱
        gcTime: 1000 * 60 * 15,       // 15분 GC
        enabled: !!studentId,
    });
};

/**
 * 성적 추가 Mutation
 */
export const useAddScore = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (scoreData: Omit<StudentScore, 'id' | 'createdAt' | 'updatedAt'>) => {
            const now = Date.now();
            const percentage = (scoreData.score / scoreData.maxScore) * 100;
            const grade = calculateGrade(percentage);

            const docRef = await addDoc(collection(db, COL_STUDENT_SCORES), {
                ...scoreData,
                percentage,
                grade,
                createdAt: now,
                updatedAt: now,
            });

            return { id: docRef.id, ...scoreData, percentage, grade, createdAt: now, updatedAt: now };
        },
        onSuccess: (data) => {
            // 해당 학생의 성적 캐시 무효화
            queryClient.invalidateQueries({ queryKey: ['student_scores', data.studentId] });
            // 전체 성적 캐시도 무효화
            queryClient.invalidateQueries({ queryKey: ['all_scores'] });
        },
    });
};

/**
 * 성적 수정 Mutation
 */
export const useUpdateScore = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<StudentScore> }) => {
            const docRef = doc(db, COL_STUDENT_SCORES, id);

            // 점수가 변경되면 백분율과 등급 재계산
            let calculatedUpdates = { ...updates, updatedAt: Date.now() };
            if (updates.score !== undefined && updates.maxScore !== undefined) {
                const percentage = (updates.score / updates.maxScore) * 100;
                calculatedUpdates = {
                    ...calculatedUpdates,
                    percentage,
                    grade: calculateGrade(percentage),
                };
            }

            await updateDoc(docRef, calculatedUpdates);
            return { id, ...calculatedUpdates };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['student_scores'] });
        },
    });
};

/**
 * 성적 삭제 Mutation
 */
export const useDeleteScore = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (scoreId: string) => {
            await deleteDoc(doc(db, COL_STUDENT_SCORES, scoreId));
            return scoreId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['student_scores'] });
            queryClient.invalidateQueries({ queryKey: ['all_scores'] });
        },
    });
};

/**
 * 학생 성적 통계 계산 헬퍼
 */
export const calculateScoreStats = (scores: StudentScore[]) => {
    if (scores.length === 0) {
        return {
            averageScore: 0,
            averagePercentage: 0,
            totalExams: 0,
            trend: 'stable' as const,
            highestScore: null as StudentScore | null,
            lowestScore: null as StudentScore | null,
        };
    }

    const totalPercentage = scores.reduce((sum, s) => sum + (s.percentage || 0), 0);
    const averagePercentage = totalPercentage / scores.length;

    // 최근 3개 성적으로 추이 계산
    const recentScores = scores.slice(0, 3);
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (recentScores.length >= 2) {
        const newest = recentScores[0].percentage || 0;
        const oldest = recentScores[recentScores.length - 1].percentage || 0;
        const diff = newest - oldest;
        if (diff > 5) trend = 'up';
        else if (diff < -5) trend = 'down';
    }

    // 최고/최저 점수
    const sortedByPercentage = [...scores].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

    return {
        averageScore: scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
        averagePercentage,
        totalExams: scores.length,
        trend,
        highestScore: sortedByPercentage[0],
        lowestScore: sortedByPercentage[sortedByPercentage.length - 1],
    };
};

export default useStudentScores;
