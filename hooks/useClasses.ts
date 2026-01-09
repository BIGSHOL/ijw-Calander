import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy, where, collectionGroup } from 'firebase/firestore';
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
 *
 * localStorage의 'useNewDataStructure' 설정에 따라:
 * - true: students/enrollments 구조에서 데이터 조회
 * - false: 수업목록 컬렉션에서 데이터 조회 (기존 방식)
 */
export const useClasses = (subject?: 'math' | 'english') => {
    return useQuery<ClassInfo[]>({
        queryKey: ['classes', subject],
        queryFn: async () => {
            const stored = localStorage.getItem('useNewDataStructure');
            // 기본값: true (새 구조 사용)
            const useNewStructure = stored === null ? true : stored === 'true';
            if (stored === null) {
                localStorage.setItem('useNewDataStructure', 'true');
            }

            if (useNewStructure) {
                // 새로운 구조: enrollments에서 데이터 조회
                return await fetchClassesFromEnrollments(subject);
            } else {
                // 기존 구조: 수업목록에서 데이터 조회
                return await fetchClassesFromOldStructure(subject);
            }
        },
        staleTime: 1000 * 60 * 10,  // 10분 캐싱
        gcTime: 1000 * 60 * 30,     // 30분 GC
    });
};

/**
 * 기존 구조에서 클래스 조회 (수업목록 컬렉션)
 */
async function fetchClassesFromOldStructure(subject?: 'math' | 'english'): Promise<ClassInfo[]> {
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
}

/**
 * 새로운 구조에서 클래스 조회 (students/enrollments)
 */
async function fetchClassesFromEnrollments(subject?: 'math' | 'english'): Promise<ClassInfo[]> {
    // collectionGroup으로 모든 enrollments 조회
    const enrollmentsQuery = query(collectionGroup(db, 'enrollments'));
    const snapshot = await getDocs(enrollmentsQuery);

    // className + subject 조합으로 그룹화 (같은 이름이라도 과목이 다르면 별개)
    const classMap = new Map<string, {
        className: string;
        teacher: string;
        subject: 'math' | 'english';
        schedule: string[];
        studentIds: Set<string>;
    }>();

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const studentId = doc.ref.parent.parent?.id || '';
        const className = data.className || '';
        const enrollmentSubject = data.subject || 'math';

        if (!className) return;

        // 키: subject + className (같은 이름이라도 과목이 다르면 다른 수업)
        const key = `${enrollmentSubject}_${className}`;

        if (!classMap.has(key)) {
            classMap.set(key, {
                className,
                teacher: data.teacherId || data.teacher || '',
                subject: enrollmentSubject,
                schedule: data.schedule || [],
                studentIds: new Set(),
            });
        }

        classMap.get(key)!.studentIds.add(studentId);
    });

    // ClassInfo 배열로 변환
    let classes: ClassInfo[] = Array.from(classMap.values()).map((classData, index) => ({
        id: `${classData.subject}_${classData.className}_${index}`,
        className: classData.className,
        teacher: classData.teacher,
        subject: classData.subject,
        schedule: classData.schedule,
        studentCount: classData.studentIds.size,
    }));

    // 과목 필터링
    if (subject) {
        classes = classes.filter(c => c.subject === subject);
    }

    // 정렬
    classes.sort((a, b) => a.className.localeCompare(b.className, 'ko'));

    return classes;
}

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
