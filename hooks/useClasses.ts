import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getTodayKST, toDateStringKST } from '../utils/dateUtils';

export type SubjectType = 'math' | 'english' | 'science' | 'korean' | 'highmath' | 'shuttle' | 'other';

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
    // 강사 인수인계 예약 (effectiveDate부터 새 담임으로 교체 예정)
    pendingTeacher?: string;
    pendingTeacherDate?: string;
    pendingTeacherReason?: string;
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

            // 수업명별 학생 수 집계 (중복 학생 제거, 퇴원/미래배정 제외)
            const classStudentCount = new Map<string, Set<string>>();
            // KST 기준 오늘 날짜로 퇴원/미래배정 학생 필터링
            const today = getTodayKST();

            enrollmentsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const className = data.className as string;
                const studentId = doc.ref.parent.parent?.id;

                if (className && studentId) {
                    // 퇴원/종료 학생 제외
                    const withdrawalDate = toDateStringKST(data.withdrawalDate);
                    const endDate = toDateStringKST(data.endDate);
                    if (withdrawalDate || endDate) return;

                    // 미래 배정 학생 제외
                    const enrollmentDate = toDateStringKST(data.enrollmentDate);
                    const startDate = enrollmentDate ?? toDateStringKST(data.startDate);
                    if (startDate && startDate > today) return;

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
                    // 강사 인수인계 예약
                    pendingTeacher: data.pendingTeacher,
                    pendingTeacherDate: data.pendingTeacherDate,
                    pendingTeacherReason: data.pendingTeacherReason,
                };
            });

            // className 기준 정렬
            classes.sort((a, b) => a.className.localeCompare(b.className, 'ko'));

            return classes;
        },
        staleTime: 1000 * 60 * 5,     // 5분 캐싱 (invalidateQueries로 즉시 반영)
        gcTime: 1000 * 60 * 30,
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
