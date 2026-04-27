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
export const firebaseConfig = {
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

// 임베드 모드 감지 (iframe 내 cross-origin 환경에서 IndexedDB 접근 차단 방지)
const isEmbedContext = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed');

let dbInstance;
const DATABASE_ID = 'restore20260319';  // 복원된 데이터베이스 사용
try {
    if (isEmbedContext) {
        // 임베드 모드: persistentLocalCache 비활성화 (iframe에서 IndexedDB 차단 이슈 방지)
        dbInstance = initializeFirestore(app, {}, DATABASE_ID);
    } else {
        dbInstance = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        }, DATABASE_ID);
    }
} catch {
    dbInstance = getFirestore(app, DATABASE_ID);
}

export const db = dbInstance;

export const auth = getAuth(app);

import { getStorage } from "firebase/storage";
export const storage = getStorage(app);

// ======== Firebase Cloud Messaging (푸시 알림) ========
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

let messagingInstance: Messaging | null = null;

/**
 * FCM Messaging 인스턴스 반환 (지원되는 브라우저에서만)
 */
export const getMessagingInstance = async (): Promise<Messaging | null> => {
    if (messagingInstance) return messagingInstance;
    const supported = await isSupported();
    if (!supported) return null;
    messagingInstance = getMessaging(app);
    return messagingInstance;
};

/**
 * FCM 토큰 발급 (알림 권한 허용 후 호출)
 * VAPID 키는 Firebase Console > 프로젝트 설정 > Cloud Messaging > 웹 푸시 인증서에서 발급
 */
export const requestFcmToken = async (vapidKey: string): Promise<string | null> => {
    try {
        const messaging = await getMessagingInstance();
        if (!messaging) return null;

        // Service Worker 등록 및 활성화 대기
        const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        // SW가 아직 installing/waiting 상태이면 active될 때까지 대기
        if (!swRegistration.active) {
            await new Promise<void>((resolve) => {
                const sw = swRegistration.installing || swRegistration.waiting;
                if (!sw) { resolve(); return; }
                sw.addEventListener('statechange', () => {
                    if (sw.state === 'activated') resolve();
                });
            });
        }

        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: swRegistration,
        });
        return token || null;
    } catch (err) {
        console.error('FCM 토큰 발급 실패:', err);
        return null;
    }
};

/**
 * 포그라운드 메시지 리스너 등록
 */
export const onForegroundMessage = async (callback: (payload: any) => void) => {
    const messaging = await getMessagingInstance();
    if (!messaging) return () => {};
    return onMessage(messaging, callback);
};

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

// 상담 필요 학생 진단 함수
async function diagnoseConsultationNeeds(): Promise<void> {
    console.log('🔍 상담 필요 학생 진단 시작...');

    // 1. 재원생 조회 (status === 'active')
    const { query: q, where: w } = await import('firebase/firestore');
    const studentsQuery = q(collection(dbInstance, 'students'), w('status', '==', 'active'));
    const studentsSnapshot = await getDocs(studentsQuery);
    console.log(`📊 재원생(active) 수: ${studentsSnapshot.size}`);

    // 2. classes 컬렉션에서 학생 배정 정보 확인
    const classesSnap = await getDocs(collection(dbInstance, 'classes'));
    console.log(`📚 수업(classes) 수: ${classesSnap.size}`);

    // 수업별 학생 배정 확인
    const studentClassMap = new Map<string, { math: string[], english: string[] }>();

    for (const classDoc of classesSnap.docs) {
        const classData = classDoc.data();
        const subject = classData.subject as string; // 'math' | 'english'
        const className = classData.className || classDoc.id;

        // students 서브컬렉션 확인
        const studentsSubSnap = await getDocs(collection(dbInstance, 'classes', classDoc.id, 'students'));

        if (studentsSubSnap.size > 0) {
            console.log(`  📖 ${className} (${subject}): ${studentsSubSnap.size}명`);
        }

        studentsSubSnap.docs.forEach(studentDoc => {
            const studentId = studentDoc.id;
            if (!studentClassMap.has(studentId)) {
                studentClassMap.set(studentId, { math: [], english: [] });
            }
            const entry = studentClassMap.get(studentId)!;
            if (subject === 'math') {
                entry.math.push(className);
            } else if (subject === 'english') {
                entry.english.push(className);
            }
        });
    }

    console.log(`👥 수업에 배정된 학생 수: ${studentClassMap.size}명`);

    // 3. 재원생 중 수업 배정된 학생 확인
    const studentsWithClasses: any[] = [];
    const studentsWithoutClasses: any[] = [];

    studentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const studentId = doc.id;
        const classInfo = studentClassMap.get(studentId);

        if (classInfo && (classInfo.math.length > 0 || classInfo.english.length > 0)) {
            studentsWithClasses.push({
                id: studentId,
                name: data.name,
                math: classInfo.math,
                english: classInfo.english
            });
        } else {
            studentsWithoutClasses.push({
                id: studentId,
                name: data.name
            });
        }
    });

    console.log(`✅ 수업 배정된 재원생: ${studentsWithClasses.length}명`);
    console.log(`❌ 수업 미배정 재원생: ${studentsWithoutClasses.length}명`);

    if (studentsWithClasses.length > 0) {
        console.log('📌 수업 배정된 학생 샘플:');
        console.table(studentsWithClasses.slice(0, 10));
    }

    // 4. 이번 달 상담 기록 확인
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

    console.log(`📅 상담 기간: ${monthStart} ~ ${monthEnd}`);

    const consultationsSnap = await getDocs(collection(dbInstance, 'student_consultations'));
    const consultations = consultationsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((c: any) => c.date >= monthStart && c.date <= monthEnd);

    console.log(`💬 이번 달 상담 기록: ${consultations.length}건`);

    // 5. 상담 기록이 있는 학생 ID 추출
    const consultedStudentIds = new Set(consultations.map((c: any) => c.studentId));
    console.log(`👥 상담받은 학생 수: ${consultedStudentIds.size}명`);

    // 6. 상담 필요 학생 계산 (수업 배정된 학생 중 이번달 상담 없는 학생)
    const needingConsultation = studentsWithClasses.filter(s => !consultedStudentIds.has(s.id));
    console.log(`⚠️ 상담 필요 학생: ${needingConsultation.length}명`);

    if (needingConsultation.length > 0) {
        console.log('📌 상담 필요 학생 목록 (상위 20명):');
        console.table(needingConsultation.slice(0, 20));
    }

    return;
}

// 진단 함수는 개발 환경에서만 노출
if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as any).diagnoseEnrollments = diagnoseEnrollments;
    (window as any).diagnoseClassNameMatching = diagnoseClassNameMatching;
    (window as any).diagnoseConsultationNeeds = diagnoseConsultationNeeds;
    (window as any).db = dbInstance;
}

// ======== 모순 enrollment record cleanup (admin/master 전용) ========
// 사용자가 master/admin 으로 로그인된 브라우저 세션에서 호출.
// Firestore rules 가 권한 체크 — 일반 사용자는 PERMISSION_DENIED 받음.
// 사용 예: window.cleanupBrokenEnrollments() — dry-run, 결과만 표시
//        window.cleanupBrokenEnrollments({ apply: true }) — 실제 적용
import { writeBatch as _writeBatch, deleteField as _deleteField, doc as _doc } from "firebase/firestore";

interface BrokenRecord {
    studentId: string;
    studentName: string;
    enrollmentId: string;
    className: string;
    subject: string;
    staffId: string | null;
    start: string;
    end: string;
}

async function cleanupBrokenEnrollments(opts: { apply?: boolean } = {}): Promise<{
    found: number;
    applied: number;
    records: BrokenRecord[];
}> {
    const apply = !!opts.apply;
    const today = new Date().toISOString().split('T')[0];
    const fmtDate = (v: any): string => {
        if (!v) return '-';
        if (typeof v === 'string') return v;
        if (v?.toDate) return v.toDate().toISOString().split('T')[0];
        return String(v);
    };

    console.log(`🔍 모순 enrollment cleanup ${apply ? '(APPLY MODE)' : '(DRY-RUN)'} — 오늘=${today}`);
    const studentsSnap = await getDocs(collection(dbInstance, 'students'));
    console.log(`전체 학생: ${studentsSnap.size}명 스캔 중...`);

    const broken: BrokenRecord[] = [];
    for (const studentDoc of studentsSnap.docs) {
        const studentId = studentDoc.id;
        const studentName = studentDoc.data().name || '(이름없음)';
        const enrollSnap = await getDocs(collection(dbInstance, 'students', studentId, 'enrollments'));
        for (const e of enrollSnap.docs) {
            const data: any = e.data();
            const start = fmtDate(data.startDate || data.enrollmentDate);
            const end = fmtDate(data.endDate || data.withdrawalDate);
            if (start === '-' || end === '-') continue;
            if (start <= end) continue;
            if (data.cancelledAt) continue; // 이미 변환됨
            broken.push({
                studentId,
                studentName,
                enrollmentId: e.id,
                className: data.className,
                subject: data.subject,
                staffId: data.staffId || null,
                start,
                end,
            });
        }
    }

    console.log(`📊 모순 record 발견: ${broken.length}개`);
    if (broken.length === 0) {
        console.log('✅ 청소할 record 없음');
        return { found: 0, applied: 0, records: [] };
    }

    // 학생별 그룹 출력
    const byStudent = new Map<string, { name: string; items: BrokenRecord[] }>();
    for (const b of broken) {
        if (!byStudent.has(b.studentId)) byStudent.set(b.studentId, { name: b.studentName, items: [] });
        byStudent.get(b.studentId)!.items.push(b);
    }
    console.table(broken.map(b => ({
        student: b.studentName,
        subject: b.subject,
        className: b.className,
        start: b.start,
        end: b.end,
        teacher: b.staffId,
    })));

    if (!apply) {
        console.log('💡 적용하려면: window.cleanupBrokenEnrollments({ apply: true })');
        return { found: broken.length, applied: 0, records: broken };
    }

    let applied = 0;
    for (const [sid, info] of byStudent) {
        const batch = _writeBatch(dbInstance);
        for (const b of info.items) {
            const ref = _doc(dbInstance, 'students', sid, 'enrollments', b.enrollmentId);
            batch.update(ref, {
                cancelledAt: b.end,
                cancelledBy: 'system-cleanup',
                cancelReason: `일회성 cleanup: 모순 record (startDate ${b.start} > endDate ${b.end})`,
                endDate: _deleteField(),
                withdrawalDate: _deleteField(),
                updatedAt: new Date().toISOString(),
            });
            applied += 1;
        }
        await batch.commit();
        console.log(`  ✓ ${info.name} ${info.items.length}건`);
    }
    console.log(`✅ 총 ${applied}개 record 정리 완료`);
    return { found: broken.length, applied, records: broken };
}

if (typeof window !== 'undefined') {
    (window as any).cleanupBrokenEnrollments = cleanupBrokenEnrollments;
}

