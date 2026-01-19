import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TimetableClass, TimetableStudent, SubjectType } from '../types';

export interface EnrollmentInfo {
    id: string;
    studentId: string;
    studentName: string;
    subject: SubjectType;
    className: string;
    teacherId: string;
    days?: string[];
    period?: string | null;
    room?: string | null;
    schedule?: string[];
    startDate?: string | null;
    endDate?: string | null;
    color?: string | null;
}

/**
 * 모든 학생의 enrollments를 조회하여 클래스 중심으로 재구성
 * 새로운 students/enrollments 구조에서 데이터를 읽어옴
 */
export const useEnrollmentsAsClasses = (subject?: SubjectType) => {
    return useQuery<TimetableClass[]>({
        queryKey: ['enrollments-as-classes', subject],
        queryFn: async () => {
            // collectionGroup을 사용하여 모든 students/{studentId}/enrollments 조회
            const enrollmentsQuery = query(collectionGroup(db, 'enrollments'));
            const snapshot = await getDocs(enrollmentsQuery);

            // Enrollment 데이터를 파싱
            const enrollments: EnrollmentInfo[] = snapshot.docs.map(doc => {
                const data = doc.data();
                // studentId는 부모 문서 ID에서 추출
                const studentId = doc.ref.parent.parent?.id || '';

                // studentId 파싱: "이름_학교_학년" 형식
                const parseStudentId = (id: string) => {
                    const parts = id.split('_');
                    if (parts.length >= 3) {
                        return {
                            name: parts[0],
                            school: parts[1],
                            grade: parts[2]
                        };
                    }
                    return { name: id, school: '', grade: '' };
                };

                const parsedStudent = parseStudentId(studentId);

                return {
                    id: doc.id,
                    studentId,
                    studentName: parsedStudent.name, // 이름만 추출
                    subject: data.subject || 'math',
                    className: data.className || '',
                    teacherId: data.teacherId || data.teacher || '',
                    days: data.days || [],
                    period: data.period || null,
                    room: data.room || null,
                    schedule: data.schedule || [],
                    startDate: data.startDate || null,
                    endDate: data.endDate || null,
                    color: data.color || null,
                };
            });

            // 과목 필터링
            let filteredEnrollments = enrollments;
            if (subject) {
                filteredEnrollments = enrollments.filter(e => e.subject === subject);
            }

            // className별로 그룹화
            const classMap = new Map<string, {
                className: string;
                teacher: string;
                subject: SubjectType;
                studentList: TimetableStudent[];
                schedule?: string[];
                days?: string[];
                room?: string;
                color?: string;
            }>();

            filteredEnrollments.forEach(enrollment => {
                const key = enrollment.className;

                if (!classMap.has(key)) {
                    classMap.set(key, {
                        className: enrollment.className,
                        teacher: enrollment.teacherId,
                        subject: enrollment.subject,
                        studentList: [],
                        schedule: enrollment.schedule,
                        days: enrollment.days,
                        room: enrollment.room || undefined,
                        color: enrollment.color || undefined,
                    });
                }

                // 학생 정보를 studentList에 추가 (중복 방지)
                const classData = classMap.get(key)!;
                if (!classData.studentList.some(s => s.id === enrollment.studentId)) {
                    // studentId 파싱: "이름_학교_학년" 형식
                    const parseStudentId = (id: string) => {
                        const parts = id.split('_');
                        if (parts.length >= 3) {
                            return {
                                name: parts[0],
                                school: parts[1],
                                grade: parts[2]
                            };
                        }
                        return { name: id, school: '', grade: '' };
                    };

                    const parsedInfo = parseStudentId(enrollment.studentId);

                    classData.studentList.push({
                        id: enrollment.studentId,
                        name: parsedInfo.name,      // 이름만
                        school: parsedInfo.school,  // 학교
                        grade: parsedInfo.grade,    // 학년
                    });
                }

                // [Fix] 스케줄 및 강사 정보 보강
                // 먼저 등록된 데이터에 정보가 없을 경우를 대비하여 업데이트
                if ((!classData.schedule || classData.schedule.length === 0) && enrollment.schedule && enrollment.schedule.length > 0) {
                    classData.schedule = enrollment.schedule;
                    classData.days = enrollment.days;
                    if (enrollment.room) classData.room = enrollment.room;
                    if (enrollment.color) classData.color = enrollment.color;
                }

                // 강사 정보가 비어있으면 보강
                if (!classData.teacher && enrollment.teacherId) {
                    classData.teacher = enrollment.teacherId;
                }
            });

            // TimetableClass 형식으로 변환
            const classes: TimetableClass[] = Array.from(classMap.values()).map((classData, index) => ({
                // 고유한 ID 생성: subject + className + teacher + index
                // 같은 이름의 수업이 여러 개 있어도 강사명으로 구분
                id: `${classData.subject}_${classData.className}_${classData.teacher}_${index}`,
                className: classData.className,
                teacher: classData.teacher,
                subject: classData.subject,
                studentList: classData.studentList,
                schedule: classData.schedule,
                days: classData.days,
                room: classData.room,
                color: classData.color,
            }));

            // className으로 정렬
            classes.sort((a, b) => a.className.localeCompare(b.className, 'ko'));

            return classes;
        },
        staleTime: 1000 * 60 * 5,    // 5분 캐싱
        gcTime: 1000 * 60 * 15,       // 15분 GC
        refetchOnWindowFocus: false
    });
};

/**
 * 특정 학생의 enrollments 조회
 */
export const useStudentEnrollments = (studentId: string) => {
    return useQuery<EnrollmentInfo[]>({
        queryKey: ['student-enrollments', studentId],
        queryFn: async () => {
            if (!studentId) return [];

            const enrollmentsRef = collection(db, `students/${studentId}/enrollments`);
            const snapshot = await getDocs(enrollmentsRef);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    studentId,
                    studentName: studentId,
                    subject: data.subject || 'math',
                    className: data.className || '',
                    teacherId: data.teacherId || data.teacher || '',
                    days: data.days || [],
                    period: data.period || null,
                    room: data.room || null,
                    schedule: data.schedule || [],
                    startDate: data.startDate || null,
                    endDate: data.endDate || null,
                    color: data.color || null,
                };
            });
        },
        enabled: !!studentId,
        staleTime: 1000 * 60 * 5,
    });
};

/**
 * 특정 클래스의 학생 목록 조회 (enrollments에서 역산)
 */
export const useClassStudents = (className: string, subject?: SubjectType) => {
    return useQuery<TimetableStudent[]>({
        queryKey: ['class-students', className, subject],
        queryFn: async () => {
            if (!className) return [];

            // collectionGroup으로 모든 enrollments 조회
            let enrollmentsQuery = query(
                collectionGroup(db, 'enrollments'),
                where('className', '==', className)
            );

            if (subject) {
                enrollmentsQuery = query(
                    collectionGroup(db, 'enrollments'),
                    where('className', '==', className),
                    where('subject', '==', subject)
                );
            }

            const snapshot = await getDocs(enrollmentsQuery);

            const students: TimetableStudent[] = snapshot.docs.map(doc => {
                const studentId = doc.ref.parent.parent?.id || '';
                return {
                    id: studentId,
                    name: studentId,
                };
            });

            // 중복 제거 및 정렬
            const uniqueStudents = Array.from(
                new Map(students.map(s => [s.id, s])).values()
            );

            uniqueStudents.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

            return uniqueStudents;
        },
        enabled: !!className,
        staleTime: 1000 * 60 * 5,
    });
};

export default useEnrollmentsAsClasses;
