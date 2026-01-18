import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { listenerRegistry } from '../../../../utils/firebaseCleanup';
import { TimetableClass, TimetableStudent } from '../../../../types';
import { convertToLegacyPeriodId } from '../../constants';

const COL_CLASSES = 'classes';

/**
 * useTimetableClasses - 수학 시간표용 수업 목록 조회
 *
 * 데이터 소스: classes 컬렉션 (isActive=true)
 * 학생 데이터: enrollments에서 별도 조회 (useMathClassStudents)
 */
export const useTimetableClasses = () => {
    const [classes, setClasses] = useState<TimetableClass[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // classes 컬렉션에서 활성 수업만 조회
        const q = query(
            collection(db, COL_CLASSES),
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
            console.error('[useTimetableClasses] Error loading classes:', error);
            setLoading(false);
        });

        return listenerRegistry.register('useTimetableClasses', unsubscribe);
    }, []);

    return { classes, loading };
};
