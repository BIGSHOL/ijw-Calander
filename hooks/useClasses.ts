import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COL_CLASSES = '수업목록';

export interface ClassInfo {
    id: string;
    className: string;
    teacher: string;
    subject: 'math' | 'english';
    schedule?: string[];
    studentCount?: number;
}

/**
 * 반(수업) 목록 조회 Hook
 * @param subject 과목 필터 (선택)
 */
export const useClasses = (subject?: 'math' | 'english') => {
    return useQuery<ClassInfo[]>({
        queryKey: ['classes', subject],
        queryFn: async () => {
            const q = query(
                collection(db, COL_CLASSES),
                orderBy('className')
            );

            const snapshot = await getDocs(q);
            let classes = snapshot.docs.map(doc => {
                const data = doc.data();
                // subject 추론: className 패턴이나 teacher 기반으로 추론
                const inferredSubject = inferSubject(data.className, data.teacher);

                return {
                    id: doc.id,
                    className: data.className || '',
                    teacher: data.teacher || '',
                    subject: inferredSubject,
                    schedule: data.schedule || [],
                    studentCount: data.studentIds?.length || data.studentList?.length || 0,
                } as ClassInfo;
            });

            // 과목 필터링
            if (subject) {
                classes = classes.filter(c => c.subject === subject);
            }

            return classes;
        },
        staleTime: 1000 * 60 * 10,  // 10분 캐싱
        gcTime: 1000 * 60 * 30,     // 30분 GC
    });
};

/**
 * 과목 추론 헬퍼
 * 클래스명이나 선생님 이름으로 수학/영어 판별
 */
const inferSubject = (className: string, teacher: string): 'math' | 'english' => {
    const englishPatterns = [
        /^DP/, /^PL/, /^LE/, /^RTT/, /^RW/, /^GR/, /^VT/,  // 영어 레벨 약어
        /phonics/i, /grammar/i, /reading/i, /writing/i,
    ];

    for (const pattern of englishPatterns) {
        if (pattern.test(className)) {
            return 'english';
        }
    }

    // 기본값: 수학
    return 'math';
};

/**
 * 학년 목록 (선택용 상수)
 */
export const GRADE_OPTIONS = [
    '초1', '초2', '초3', '초4', '초5', '초6',
    '중1', '중2', '중3',
    '고1', '고2', '고3',
];

export default useClasses;
