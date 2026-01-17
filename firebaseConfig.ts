import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Helper to access environment variables in both Vite and Node environments
const getEnv = (key: string) => {
    // Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
        return import.meta.env[key];
    }
    // Node environment
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key];
    }
    return undefined;
};

// Firebase configuration loaded from environment variables
// All sensitive keys are now stored in .env.local (not committed to Git)
const firebaseConfig = {
    apiKey: getEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Validate required environment variables
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
        'Firebase configuration error: Missing required environment variables.\n' +
        'Please ensure .env.local file exists with all VITE_FIREBASE_* variables.'
    );
}

const app = initializeApp(firebaseConfig);
// Initialize Firestore with multi-tab persistent local cache
// Handle case where Firestore is already initialized (e.g. in browser console re-runs)
import { getFirestore } from "firebase/firestore";

let dbInstance;
try {
    dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
} catch {
    dbInstance = getFirestore(app);
}

export const db = dbInstance;

export const auth = getAuth(app);

// ======== 개발용 전역 진단 함수 ========
// 브라우저 콘솔에서 window.diagnoseEnrollments() 로 호출
import { collection, getDocs } from "firebase/firestore";

interface EnrollmentDiagData {
    studentId: string;
    studentName: string;
    enrollmentCount: number;
    enrollments: any[];
}

async function diagnoseEnrollments(): Promise<EnrollmentDiagData[]> {
    console.log('🔍 Enrollment 진단 시작...');

    const studentsSnap = await getDocs(collection(dbInstance, 'students'));
    console.log(`📊 총 학생 수: ${studentsSnap.size}`);

    const results: EnrollmentDiagData[] = [];

    for (const doc of studentsSnap.docs) {
        const enrollSnap = await getDocs(collection(dbInstance, 'students', doc.id, 'enrollments'));
        if (enrollSnap.size > 0) {
            results.push({
                studentId: doc.id,
                studentName: doc.data().name || '(이름없음)',
                enrollmentCount: enrollSnap.size,
                enrollments: enrollSnap.docs.map(e => ({ id: e.id, ...e.data() }))
            });
        }
    }

    console.log(`✅ Enrollment가 있는 학생: ${results.length}명`);
    console.table(results.map(r => ({
        id: r.studentId,
        name: r.studentName,
        count: r.enrollmentCount
    })));

    // 공민규 확인
    const gongmingyu = results.find(r => r.studentName?.includes('공민규'));
    if (gongmingyu) {
        console.log('📌 공민규:', gongmingyu);
    } else {
        console.warn('⚠️ 공민규를 찾을 수 없음!');
    }

    return results;
}

// 수업명 매칭 진단: 학생 문서의 수업명 vs classes 컬렉션
interface ClassMismatch {
    studentId: string;
    studentName: string;
    field: string;  // 'enrollment' | '_excelEnglishClasses'
    className: string;
    matched: boolean;
    matchedClassId?: string;
}

async function diagnoseClassNameMatching(): Promise<{
    mismatched: ClassMismatch[];
    matched: ClassMismatch[];
    summary: any;
}> {
    console.log('🔍 수업명 매칭 진단 시작...');

    // 1. classes 컬렉션의 모든 수업명 수집
    const classesSnap = await getDocs(collection(dbInstance, 'classes'));
    const classNameToId = new Map<string, string>();
    classesSnap.docs.forEach(doc => {
        const className = doc.data().className;
        if (className) {
            classNameToId.set(className, doc.id);
        }
    });
    console.log(`📚 classes 컬렉션: ${classesSnap.size}개 수업`);

    // 2. 학생 문서 조회
    const studentsSnap = await getDocs(collection(dbInstance, 'students'));
    console.log(`👨‍🎓 총 학생 수: ${studentsSnap.size}`);

    const mismatched: ClassMismatch[] = [];
    const matched: ClassMismatch[] = [];

    for (const doc of studentsSnap.docs) {
        const data = doc.data();
        const studentId = doc.id;
        const studentName = data.name || '(이름없음)';

        // 2.1 _excelEnglishClasses 필드 확인
        const excelClasses = data._excelEnglishClasses as string[] | undefined;
        if (excelClasses && excelClasses.length > 0) {
            for (const className of excelClasses) {
                const matchedId = classNameToId.get(className);
                const item: ClassMismatch = {
                    studentId,
                    studentName,
                    field: '_excelEnglishClasses',
                    className,
                    matched: !!matchedId,
                    matchedClassId: matchedId
                };
                if (matchedId) {
                    matched.push(item);
                } else {
                    mismatched.push(item);
                }
            }
        }

        // 2.2 enrollments 서브컬렉션 확인
        const enrollSnap = await getDocs(collection(dbInstance, 'students', studentId, 'enrollments'));
        for (const enrollDoc of enrollSnap.docs) {
            const enrollData = enrollDoc.data();
            const className = enrollData.className;
            if (className) {
                const matchedId = classNameToId.get(className);
                const item: ClassMismatch = {
                    studentId,
                    studentName,
                    field: 'enrollment',
                    className,
                    matched: !!matchedId,
                    matchedClassId: matchedId
                };
                if (matchedId) {
                    matched.push(item);
                } else {
                    mismatched.push(item);
                }
            }
        }
    }

    // 요약
    const summary = {
        totalClasses: classesSnap.size,
        totalStudents: studentsSnap.size,
        matchedCount: matched.length,
        mismatchedCount: mismatched.length,
        mismatchedByField: {
            excelEnglishClasses: mismatched.filter(m => m.field === '_excelEnglishClasses').length,
            enrollment: mismatched.filter(m => m.field === 'enrollment').length
        }
    };

    console.log('📊 요약:', summary);

    if (mismatched.length > 0) {
        console.log('❌ 매칭되지 않는 수업명:');
        console.table(mismatched.map(m => ({
            student: m.studentName,
            field: m.field,
            className: m.className
        })));

        // 유니크 수업명 목록
        const uniqueUnmatched = [...new Set(mismatched.map(m => m.className))];
        console.log('📌 누락된 수업명 목록:', uniqueUnmatched);
    } else {
        console.log('✅ 모든 수업명이 정상 매칭됩니다!');
    }

    return { mismatched, matched, summary };
}

// 전역 expose (콘솔 로그 제거)
if (typeof window !== 'undefined') {
    (window as any).diagnoseEnrollments = diagnoseEnrollments;
    (window as any).diagnoseClassNameMatching = diagnoseClassNameMatching;
    (window as any).db = dbInstance;
}

