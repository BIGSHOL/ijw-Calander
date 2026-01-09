import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableClass } from '../../../../types';
import { useEnrollmentsAsClasses } from '../../../../hooks/useEnrollments';
import { useTeachers } from '../../../../hooks/useFirebaseQueries';

export const useTimetableClasses = () => {
    const [classes, setClasses] = useState<TimetableClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [useNewStructure, setUseNewStructure] = useState(false);

    // Check localStorage for data structure preference
    useEffect(() => {
        const stored = localStorage.getItem('useNewDataStructure');
        // 기본값: true (새 구조 사용)
        if (stored === null) {
            localStorage.setItem('useNewDataStructure', 'true');
            setUseNewStructure(true);
        } else {
            setUseNewStructure(stored === 'true');
        }
    }, []);

    // New structure: Use enrollments-based hook
    const { data: enrollmentClasses, isLoading: enrollmentLoading } = useEnrollmentsAsClasses('math');
    // 강사 정보 매핑을 위한 훅
    const { data: teachers } = useTeachers();

    // Old structure: Use 수업목록 collection
    useEffect(() => {
        if (useNewStructure) {
            // Use new structure data
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
        return () => unsubscribe();
    }, [useNewStructure, enrollmentClasses, enrollmentLoading, teachers]);

    return { classes, loading };
};
