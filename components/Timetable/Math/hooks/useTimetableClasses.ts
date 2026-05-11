import { useQuery } from '@tanstack/react-query';
import { collection, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableClass, TimetableStudent } from '../../../../types';
import { convertToLegacyPeriodId } from '../../constants';
import { getTodayKST, toDateStringKST } from '../../../../utils/dateUtils';
import { parseStudentIdWithCampus } from '../../../../utils/campusUtils';

const COL_CLASSES = 'classes';

/**
 * useTimetableClasses - 수학 시간표용 수업 목록 조회
 *
 * 데이터 소스: classes 컬렉션 (isActive=true) + enrollments collectionGroup
 * 학생 수: enrollments 기반 직접 집계 (퇴원/미래배정 제외)
 * 상세 학생 데이터: useMathClassStudents에서 별도 파생
 *
 * React Query로 전환:
 * - onSnapshot → getDocs (실시간 업데이트 제거, 폴링 기반)
 * - staleTime: 10초 (실시간성 향상)
 * - gcTime: 5분 (가비지 컬렉션 시간)
 */
export const useTimetableClasses = () => {
    const { data: classes = [], isLoading: loading } = useQuery({
        queryKey: ['timetableClasses'],
        queryFn: async () => {
            // classes + enrollments 병렬 조회
            const classesQuery = query(
                collection(db, COL_CLASSES),
                where('isActive', '==', true)
            );
            const enrollmentsQuery = collectionGroup(db, 'enrollments');

            const [snapshot, enrollmentsSnapshot] = await Promise.all([
                getDocs(classesQuery),
                getDocs(enrollmentsQuery),
            ]);

            // enrollment 기반 수업별 학생 ID 집계 (퇴원/미래배정 제외)
            const classStudentIds = new Map<string, Set<string>>();
            const today = getTodayKST();

            enrollmentsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const className = data.className as string;
                const studentId = doc.ref.parent.parent?.id;

                if (!className || !studentId) return;

                // 퇴원/종료 학생 제외
                const withdrawalDate = toDateStringKST(data.withdrawalDate);
                const endDate = toDateStringKST(data.endDate);
                if (withdrawalDate || endDate) return;

                // 미래 배정 학생 제외
                const startDate = toDateStringKST(data.enrollmentDate) ?? toDateStringKST(data.startDate);
                if (startDate && startDate > today) return;

                if (!classStudentIds.has(className)) {
                    classStudentIds.set(className, new Set());
                }
                classStudentIds.get(className)!.add(studentId);
            });

            const loadedClasses: TimetableClass[] = snapshot.docs.map(doc => {
                const data = doc.data();

                // schedule을 레거시 문자열 형식으로 변환 ("요일 periodId")
                // TimetableGrid는 "월 1-1" 형식을 기대하므로 레거시 형식으로 변환
                const scheduleStrings = data.schedule?.map((slot: any) => {
                    // 새 periodId (1~8)를 레거시 형식 (1-1, 1-2 등)으로 변환
                    const legacyPeriodId = convertToLegacyPeriodId(slot.periodId);
                    return `${slot.day} ${legacyPeriodId}`;
                }) || data.legacySchedule || [];

                // enrollment 기반 학생 ID (classes 문서의 studentIds 대신)
                const enrollmentStudentIds = classStudentIds.get(data.className);
                const studentIds = enrollmentStudentIds
                    ? Array.from(enrollmentStudentIds)
                    : (data.studentIds || []);

                // studentIds를 TimetableStudent[] 형식으로 변환 (gd_ 프리픽스 처리)
                const studentList: TimetableStudent[] = studentIds.map((sid: string) => {
                    const parsed = parseStudentIdWithCampus(sid);
                    if (parsed.school) {
                        return {
                            id: sid,
                            name: parsed.name,
                            school: parsed.school,
                            grade: parsed.grade
                        };
                    }
                    return { id: sid, name: sid };
                });

                // subject 매핑: 'math' -> '수학', 'english' -> '영어', 'highmath' -> '고등수학'
                const subjectLabel = data.subject === 'math' ? '수학' :
                    data.subject === 'english' ? '영어' :
                    data.subject === 'highmath' ? '고등수학' : data.subject;

                return {
                    id: doc.id,
                    className: data.className || '',
                    teacher: data.teacher || '',
                    subject: subjectLabel,
                    studentList,
                    studentIds,
                    schedule: scheduleStrings,
                    room: data.room || '',
                    color: data.color,
                    slotTeachers: data.slotTeachers || {},
                    slotRooms: data.slotRooms || {},
                    // 스케줄 변경 예정 (기존 기능)
                    pendingSchedule: data.pendingLegacySchedule || data.pendingSchedule,
                    pendingScheduleDate: data.pendingScheduleDate,
                    // 강사 인수인계 예정 (신규) — 반 카드 🔄 배지 + 수업 상세 모달 배너/상세 섹션 렌더에 필수
                    pendingTeacher: data.pendingTeacher,
                    pendingTeacherDate: data.pendingTeacherDate,
                    pendingTeacherReason: data.pendingTeacherReason,
                    bgColor: data.bgColor,
                    textColor: data.textColor,
                };
            });

            // className 기준 정렬
            loadedClasses.sort((a, b) => a.className.localeCompare(b.className, 'ko'));

            return loadedClasses;
        },
        staleTime: 1000 * 10, // 10초 (실시간성 향상)
        gcTime: 1000 * 60 * 5, // 5분
        refetchOnWindowFocus: true,  // 탭 전환 시 자동 갱신
    });

    return { classes, loading };
};
