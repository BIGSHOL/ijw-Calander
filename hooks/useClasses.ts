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

            console.log(`[useClasses] subject: ${subject}, useNewStructure: ${useNewStructure}`);

            if (useNewStructure) {
                // 새로운 구조: enrollments에서 데이터 조회
                const classes = await fetchClassesFromEnrollments(subject);
                console.log(`[useClasses] Fetched ${classes.length} classes from enrollments for subject: ${subject}`);
                return classes;
            } else {
                // 기존 구조: 수업목록에서 데이터 조회
                const classes = await fetchClassesFromOldStructure(subject);
                console.log(`[useClasses] Fetched ${classes.length} classes from old structure for subject: ${subject}`);
                return classes;
            }
        },
        staleTime: 1000 * 60 * 10,   // 10분 캐싱 (자주 변경되지 않는 데이터)
        gcTime: 1000 * 60 * 30,      // 30분 GC
        refetchOnMount: false,       // 캐시된 데이터 우선 사용 (성능 최적화)
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
    // collectionGroup으로 enrollments 조회 (subject 필터링 적용)
    let enrollmentsQuery;
    if (subject) {
        // subject가 지정된 경우 필터 적용하여 조회 최적화
        enrollmentsQuery = query(
            collectionGroup(db, 'enrollments'),
            where('subject', '==', subject)
        );
    } else {
        // subject가 없는 경우 전체 조회
        enrollmentsQuery = query(collectionGroup(db, 'enrollments'));
    }
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

    console.log(`[fetchClassesFromEnrollments] Before filtering: ${classes.length} classes`);
    console.log(`[fetchClassesFromEnrollments] Subjects in data:`, [...new Set(classes.map(c => c.subject))]);

    // 과목 필터링
    if (subject) {
        const beforeFilter = classes.length;
        classes = classes.filter(c => c.subject === subject);
        console.log(`[fetchClassesFromEnrollments] After filtering by ${subject}: ${classes.length} classes (was ${beforeFilter})`);
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
        /^JP/, /^KW/, /^LT/, /^MEC/, /^PJ/, /^RTS/,  // 영어 레벨 약어 추가
        /E_/,  // E_ 포함
        /phonics/i, /grammar/i, /reading/i, /writing/i,
        /초등\s*브릿지/, /중등E/, /고등E/, /중고E/,
    ];

    for (const pattern of englishPatterns) {
        if (pattern.test(className)) {
            return 'english';
        }
    }

    // 수학 패턴
    const mathPatterns = [
        /수학/, /개념/, /유형/, /심화/, /최상위/, /사고력/,
        /M_/,
    ];

    for (const pattern of mathPatterns) {
        if (pattern.test(className)) {
            return 'math';
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
