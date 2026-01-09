import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Exam, StudentScore } from '../types';

const COL_EXAMS = 'exams';
const COL_STUDENT_SCORES = 'student_scores';

/**
 * 날짜 범위 내 시험 목록 조회 Hook
 * 
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 * @param subject 과목 필터 (선택)
 */
export const useExamsByDateRange = (
    startDate: string,
    endDate: string,
    subject?: 'math' | 'english'
) => {
    return useQuery<Exam[]>({
        queryKey: ['exams_by_date', startDate, endDate, subject],
        queryFn: async () => {
            if (!startDate || !endDate) return [];

            let q = query(
                collection(db, COL_EXAMS),
                where('date', '>=', startDate),
                where('date', '<=', endDate),
                orderBy('date', 'asc')
            );

            const snapshot = await getDocs(q);
            let exams = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Exam));

            // 클라이언트 사이드 필터링 (과목)
            if (subject) {
                exams = exams.filter(e => e.subject === subject || e.subject === 'both');
            }

            return exams;
        },
        staleTime: 1000 * 60 * 5,    // 5분 캐싱
        gcTime: 1000 * 60 * 15,       // 15분 GC
        enabled: !!startDate && !!endDate,
    });
};

/**
 * 날짜별 시험 Map 생성 (조회 최적화용)
 */
export const useExamsByDateMap = (
    startDate: string,
    endDate: string,
    subject?: 'math' | 'english'
) => {
    const { data: exams, ...rest } = useExamsByDateRange(startDate, endDate, subject);

    // 날짜별 시험 매핑 (Map<dateKey, Exam[]>)
    const examsByDate = new Map<string, Exam[]>();

    if (exams) {
        exams.forEach(exam => {
            const existing = examsByDate.get(exam.date) || [];
            existing.push(exam);
            examsByDate.set(exam.date, existing);
        });
    }

    return { examsByDate, exams, ...rest };
};

/**
 * 학생별 시험 점수 조회 (날짜 범위 내)
 * 
 * @param studentIds 학생 ID 배열
 * @param examIds 시험 ID 배열
 */
export const useScoresByExams = (studentIds: string[], examIds: string[]) => {
    return useQuery<Map<string, Map<string, StudentScore>>>({
        queryKey: ['scores_by_exams', studentIds.join(','), examIds.join(',')],
        queryFn: async () => {
            if (studentIds.length === 0 || examIds.length === 0) {
                return new Map();
            }

            // Firestore 'in' query limit is 30, so we need to batch
            const batchSize = 30;
            const allScores: StudentScore[] = [];

            // Query by examIds (usually fewer than studentIds)
            for (let i = 0; i < examIds.length; i += batchSize) {
                const batchExamIds = examIds.slice(i, i + batchSize);
                const q = query(
                    collection(db, COL_STUDENT_SCORES),
                    where('examId', 'in', batchExamIds)
                );
                const snapshot = await getDocs(q);
                snapshot.docs.forEach(doc => {
                    const score = { id: doc.id, ...doc.data() } as StudentScore;
                    // Filter by studentIds client-side
                    if (studentIds.includes(score.studentId)) {
                        allScores.push(score);
                    }
                });
            }

            // Map: studentId -> examId -> StudentScore
            const scoreMap = new Map<string, Map<string, StudentScore>>();

            allScores.forEach(score => {
                if (!scoreMap.has(score.studentId)) {
                    scoreMap.set(score.studentId, new Map());
                }
                scoreMap.get(score.studentId)!.set(score.examId, score);
            });

            return scoreMap;
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
        enabled: studentIds.length > 0 && examIds.length > 0,
    });
};

export default useExamsByDateRange;
