import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { listenerRegistry } from '../../../../utils/firebaseCleanup';
import { storage, STORAGE_KEYS } from '../../../../utils/localStorage';
import { TimetableClass, TimetableStudent } from '../../../../types';
import { useEnrollmentsAsClasses } from '../../../../hooks/useEnrollments';
import { useTeachers } from '../../../../hooks/useFirebaseQueries';
import { convertToLegacyPeriodId } from '../../constants';

const COL_CLASSES_NEW = 'classes';

export const useTimetableClasses = () => {
    const [classes, setClasses] = useState<TimetableClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [useNewStructure, setUseNewStructure] = useState(false);
    const [unifiedClassesCount, setUnifiedClassesCount] = useState<number | null>(null);

    // Check localStorage for data structure preference
    useEffect(() => {
        // 기본값: true (새 구조 사용)
        const stored = storage.getBoolean(STORAGE_KEYS.USE_NEW_DATA_STRUCTURE, true);
        setUseNewStructure(stored);
    }, []);

    // 통일된 classes 컬렉션 확인 (Phase 1 마이그레이션 후)
    useEffect(() => {
        const checkUnifiedCollection = async () => {
            try {
                const q = query(
                    collection(db, COL_CLASSES_NEW),
                    where('isActive', '==', true)
                );
                const snapshot = await getDocs(q);
                setUnifiedClassesCount(snapshot.size);
            } catch (error) {
                console.error('[useTimetableClasses] Error checking unified collection:', error);
                setUnifiedClassesCount(0);
            }
        };
        checkUnifiedCollection();
    }, []);

    // New structure: Use enrollments-based hook (fallback)
    const { data: enrollmentClasses, isLoading: enrollmentLoading } = useEnrollmentsAsClasses('math');
    // 강사 정보 매핑을 위한 훅
    const { data: teachers } = useTeachers();

    // 통일된 classes 컬렉션 구독 (Phase 1 마이그레이션 후)
    useEffect(() => {
        // 아직 확인 중이면 대기
        if (unifiedClassesCount === null) return;

        // 통일된 컬렉션에 데이터가 있으면 사용
        if (unifiedClassesCount > 0) {
            const q = query(
                collection(db, COL_CLASSES_NEW),
                where('isActive', '==', true)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loadedClasses: TimetableClass[] = snapshot.docs.map(doc => {
                    const data = doc.data();

                    // schedule을 레거시 문자열 형식으로 변환 ("요일 periodId")
                    // TimetableGrid는 "월 1-1" 형식을 기대하므로 레거시 형식으로 변환
                    const scheduleStrings = data.schedule?.map((slot: any) => {
                        // 새 periodId (1~8)를 레거시 형식 (1-1, 1-2 등)으로 변환
                        const legacyPeriodId = convertToLegacyPeriodId(slot.periodId);
                        return `${slot.day} ${legacyPeriodId}`;
                    }) || data.legacySchedule || [];

                    // studentIds를 TimetableStudent[] 형식으로 변환
                    const studentList: TimetableStudent[] = (data.studentIds || []).map((sid: string) => {
                        // studentId 파싱: "이름_학교_학년" 형식
                        const parts = sid.split('_');
                        if (parts.length >= 3) {
                            return {
                                id: sid,
                                name: parts[0],
                                school: parts[1],
                                grade: parts[2]
                            };
                        }
                        return { id: sid, name: sid };
                    });

                    // subject 매핑: 'math' -> '수학', 'english' -> '영어'
                    const subjectLabel = data.subject === 'math' ? '수학' :
                        data.subject === 'english' ? '영어' : data.subject;

                    return {
                        id: doc.id,
                        className: data.className || '',
                        teacher: data.teacher || '',
                        subject: subjectLabel,
                        studentList,
                        studentIds: data.studentIds || [],
                        schedule: scheduleStrings,
                        room: data.room || '',
                        color: data.color,
                        slotTeachers: data.slotTeachers || {},
                        slotRooms: data.slotRooms || {},
                    };
                });

                // className 기준 정렬
                loadedClasses.sort((a, b) => a.className.localeCompare(b.className, 'ko'));

                setClasses(loadedClasses);
                setLoading(false);
            }, (error) => {
                console.error('[useTimetableClasses] Error loading unified classes:', error);
                setLoading(false);
            });
            return listenerRegistry.register('useTimetableClasses(new)', unsubscribe);
        }

        // 통일된 컬렉션이 비어있으면 레거시 방식 사용
        if (useNewStructure) {
            // Use new structure data (enrollments)
            if (enrollmentClasses) {
                // 강사 ID -> 이름 매핑
                const mappedClasses = enrollmentClasses.map(cls => {
                    const teacherInfo = teachers?.find(t => t.id === cls.teacher);
                    return {
                        ...cls,
                        teacher: (teacherInfo?.name || cls.teacher).trim(),
                        // Subject mapping for TimetableManager filter compatibility ('수학' vs 'math')
                        subject: cls.subject === 'math' ? '수학' : (cls.subject === 'english' ? '영어' : cls.subject)
                    };
                });

                setClasses(mappedClasses);
                setLoading(enrollmentLoading);
            }
            return;
        }

        // Use old structure (existing code)
        const q = query(collection(db, '수업목록'), orderBy('className'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedClasses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TimetableClass));
            setClasses(loadedClasses);
            setLoading(false);
        }, (error) => {
            console.error("수업 목록 로딩 에러:", error);
            setLoading(false);
        });
        return listenerRegistry.register('useTimetableClasses(old)', unsubscribe);
    }, [unifiedClassesCount, useNewStructure, enrollmentClasses, enrollmentLoading, teachers]);

    return { classes, loading };
};
