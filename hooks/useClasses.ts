import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type SubjectType = 'math' | 'english' | 'science' | 'korean' | 'other';

const COL_CLASSES = 'classes';

export interface ClassInfo {
    id: string;
    className: string;
    name?: string;        // className 별칭 (레거시 호환)
    teacher: string;
    subject: SubjectType;
    schedule?: string[];
    studentCount?: number;
    /** @deprecated slotTeachers 사용 권장 */
    assistants?: string[];
    room?: string;
    slotTeachers?: Record<string, string>;
    slotRooms?: Record<string, string>;
    memo?: string;
}

/**
 * 반(수업) 목록 조회 Hook
 * @param subject 과목 필터 (선택)
 * @param enabled 쿼리 활성화 여부 (기본값: true)
 *
 * 데이터 소스: classes 컬렉션 (isActive=true) + enrollments를 통한 실시간 학생 수 계산
 */
export const useClasses = (subjectOrEnabled?: SubjectType | boolean, enabled = true) => {
    // 첫 번째 인자가 boolean이면 enabled로 처리, 아니면 subject로 처리
    const subject = typeof subjectOrEnabled === 'boolean' ? undefined : subjectOrEnabled;
    const isEnabled = typeof subjectOrEnabled === 'boolean' ? subjectOrEnabled : enabled;

    return useQuery<ClassInfo[]>({
        queryKey: ['classes', subject],
        enabled: isEnabled,
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

            // 모든 enrollments를 단일 쿼리로 조회하여 수업별 학생 수 계산
            const enrollmentsQuery = subject
                ? query(collectionGroup(db, 'enrollments'), where('subject', '==', subject))
                : collectionGroup(db, 'enrollments');

            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

            // 수업명별 학생 수 집계 (중복 학생 제거)
            const classStudentCount = new Map<string, Set<string>>();

            enrollmentsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const className = data.className as string;
                const studentId = doc.ref.parent.parent?.id;

                if (className && studentId) {
                    if (!classStudentCount.has(className)) {
                        classStudentCount.set(className, new Set());
                    }
                    classStudentCount.get(className)!.add(studentId);
                }
            });

            const classes: ClassInfo[] = snapshot.docs.map(doc => {
                const data = doc.data() as any;

                // schedule을 레거시 문자열 형식으로 변환
                const scheduleStrings = data.schedule?.map((slot: any) =>
                    `${slot.day} ${slot.periodId}`
                ) || data.legacySchedule || [];

                // enrollments 기반 실시간 학생 수 계산 (fallback: studentIds 배열)
                const enrollmentCount = classStudentCount.get(data.className)?.size || 0;
                const studentCount = enrollmentCount > 0 ? enrollmentCount : (data.studentIds?.length || 0);

                return {
                    id: doc.id,
                    className: data.className || '',
                    // 영어 수업은 mainTeacher 필드를 우선 사용 (teacher가 없는 경우)
                    teacher: data.mainTeacher || data.teacher || '',
                    subject: data.subject || 'math',
                    schedule: scheduleStrings,
                    studentCount,
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
        staleTime: 1000 * 60 * 2,     // 2분 캐싱 (더 자주 업데이트)
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: true,   // 창 포커스 시 재조회 (enrollment 변경 감지)
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
