import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type SubjectType = 'math' | 'english' | 'science' | 'korean' | 'other';

const COL_CLASSES = 'classes';

export interface ClassInfo {
    id: string;
    className: string;
    teacher: string;
    subject: SubjectType;
    schedule?: string[];
    studentCount?: number;
    assistants?: string[];
    room?: string;
    slotTeachers?: Record<string, string>;
    slotRooms?: Record<string, string>;
    memo?: string;
}

/**
 * 반(수업) 목록 조회 Hook
 * @param subject 과목 필터 (선택)
 *
 * 데이터 소스: classes 컬렉션 (isActive=true)
 */
export const useClasses = (subject?: SubjectType) => {
    return useQuery<ClassInfo[]>({
        queryKey: ['classes', subject],
        queryFn: async () => {
            let q;

            if (subject) {
                q = query(
                    collection(db, COL_CLASSES),
                    where('subject', '==', subject),
                    where('isActive', '==', true)
                );
            } else {
                q = query(
                    collection(db, COL_CLASSES),
                    where('isActive', '==', true)
                );
            }

            const snapshot = await getDocs(q);

            const classes: ClassInfo[] = snapshot.docs.map(doc => {
                const data = doc.data() as any;

                // schedule을 레거시 문자열 형식으로 변환
                const scheduleStrings = data.schedule?.map((slot: any) =>
                    `${slot.day} ${slot.periodId}`
                ) || data.legacySchedule || [];

                return {
                    id: doc.id,
                    className: data.className || '',
                    teacher: data.teacher || '',
                    subject: data.subject || 'math',
                    schedule: scheduleStrings,
                    studentCount: data.studentIds?.length || 0,
                    assistants: data.assistants,
                    room: data.room,
                    slotTeachers: data.slotTeachers,
                    slotRooms: data.slotRooms,
                    memo: data.memo,
                };
            });

            // className 기준 정렬
            classes.sort((a, b) => a.className.localeCompare(b.className, 'ko'));

            return classes;
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
    });
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
