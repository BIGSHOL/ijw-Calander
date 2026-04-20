import { doc, setDoc, deleteDoc, updateDoc, collection, collectionGroup, getDocs, query, where, getDoc, deleteField, writeBatch } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../../../../firebaseConfig';
import { TimetableClass } from '../../../../types';
import { logTimetableChange } from '../../../../hooks/useTimetableLog';

const COL_CLASSES = 'classes';

const MATH_SUBJECTS = ['math', 'highmath'];

/**
 * 학생의 enrollment 문서를 쿼리로 찾기 (doc ID 형식에 무관하게 동작)
 * math/highmath 모두 검색
 */
const findEnrollmentDoc = async (studentId: string, subject: string | string[], className: string) => {
    const subjects = Array.isArray(subject) ? subject : [subject];
    const enrollmentsRef = collection(db, 'students', studentId, 'enrollments');

    for (const subj of subjects) {
        const q = query(enrollmentsRef, where('subject', '==', subj), where('className', '==', className));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const activeDoc = snapshot.docs.find(d => !d.data().endDate && !d.data().withdrawalDate);
            return activeDoc || snapshot.docs[0];
        }
    }
    return null;
};

/**
 * classId로 실제 subject 조회 (math / highmath)
 */
const getClassSubject = async (classId: string): Promise<string> => {
    const classDoc = await getDoc(doc(db, COL_CLASSES, classId));
    return classDoc.exists() ? (classDoc.data().subject || 'math') : 'math';
};

/**
 * useClassOperations - 수학 수업 CRUD 작업
 *
 * 데이터 저장: classes 컬렉션
 * 학생 등록: enrollments subcollection (doc ID = classId)
 */
export const useClassOperations = () => {
    const queryClient = useQueryClient();

    // 캐시 무효화 헬퍼 함수
    const invalidateMathCaches = () => {
        queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });
        queryClient.invalidateQueries({ queryKey: ['students'] });
        queryClient.invalidateQueries({ queryKey: ['classes'] });
        queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });
    };

    // Check for consecutive periods
    const checkConsecutiveSchedule = (schedule: string[], periods: string[]): boolean => {
        const dayMap: Record<string, string[]> = {};
        schedule.forEach(slot => {
            const [day, period] = slot.split(' ');
            if (!dayMap[day]) dayMap[day] = [];
            dayMap[day].push(period);
        });

        for (const day in dayMap) {
            const dayPeriods = dayMap[day];
            if (dayPeriods.length <= 1) continue;

            const sortedIndices = dayPeriods.map(p => periods.indexOf(p)).sort((a, b) => a - b);
            for (let i = 0; i < sortedIndices.length - 1; i++) {
                if (sortedIndices[i + 1] - sortedIndices[i] !== 1) {
                    return false;
                }
            }
        }
        return true;
    };

    const addClass = async (
        classes: TimetableClass[],
        newClassData: {
            className: string;
            teacher: string;
            room: string;
            subject: string;
            schedule: string[];
            isAssistant?: boolean;
        },
        currentPeriods: string[]
    ) => {
        const { className, teacher, room, subject, schedule, isAssistant } = newClassData;

        if (!className.trim() || !teacher.trim()) {
            throw new Error('수업명과 담당 강사를 입력해주세요.');
        }
        if (schedule.length === 0) {
            throw new Error('최소 1개 이상의 시간대를 선택해주세요.');
        }

        // subject 변환: '수학' -> 'math', '영어' -> 'english'
        const subjectKey = subject === '수학' ? 'math' : subject === '영어' ? 'english' : subject;
        const classId = `${subjectKey}_${teacher.trim().replace(/\s/g, '')}_${className.trim().replace(/\s/g, '_')}`;

        const existingClass = classes.find(c => c.id === classId);
        if (existingClass) {
            throw new Error(`이미 동일한 수업이 존재합니다.\n\n수업명: ${existingClass.className}\n강사: ${existingClass.teacher}\n\n기존 수업을 수정하려면 시간표에서 해당 수업을 클릭해주세요.`);
        }

        if (!checkConsecutiveSchedule(schedule, currentPeriods)) {
            throw new Error('같은 요일의 수업 시간은 연속되어야 합니다.\n\n예: 1-1, 1-2 (O) / 1-1, 2-1 (X - 중간에 1-2번이 비어있음)');
        }

        // schedule을 새 구조로 변환: "월 1-1" -> { day: "월", periodId: "1-1" }
        const scheduleObjects = schedule.map(slot => {
            const [day, periodId] = slot.split(' ');
            return { day, periodId };
        });

        // 부담임일 경우 slotTeachers 생성
        const slotTeachers: Record<string, string> | undefined = isAssistant
            ? schedule.reduce((acc, slot) => {
                // "월 1-1" -> "월-1-1"
                const key = slot.replace(' ', '-');
                acc[key] = teacher.trim();
                return acc;
            }, {} as Record<string, string>)
            : undefined;

        const newClass: any = {
            id: classId,
            className: className.trim(),
            teacher: isAssistant ? '' : teacher.trim(), // 부담임이면 teacher 필드는 비움
            room: room.trim(),
            subject: subjectKey,
            schedule: scheduleObjects,
            legacySchedule: schedule, // 호환성용
            studentIds: [],
            isActive: true,
            createdAt: new Date().toISOString(),
            order: classes.length + 1
        };

        // slotTeachers가 있으면 추가
        if (slotTeachers) {
            newClass.slotTeachers = slotTeachers;
        }

        await setDoc(doc(db, COL_CLASSES, classId), newClass);

        logTimetableChange({
            action: 'class_create', subject: subjectKey, className: className.trim(),
            details: `수업 생성: ${className.trim()} (${subjectKey})`,
            after: { className: className.trim(), teacher: teacher.trim(), room: room.trim(), schedule },
        });

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();

        return newClass;
    };

    const updateClass = async (
        classId: string,
        updates: { room?: string; schedule?: string[] },
        currentPeriods: string[]
    ) => {
        if (updates.schedule && updates.schedule.length === 0) {
            throw new Error('최소 1개 이상의 시간대를 선택해주세요.');
        }

        if (updates.schedule && !checkConsecutiveSchedule(updates.schedule, currentPeriods)) {
            throw new Error('같은 요일의 수업 시간은 연속되어야 합니다.\n\n예: 1-1, 1-2 (O) / 1-1, 2-1 (X - 중간에 1-2번이 비어있음)');
        }

        // schedule이 있으면 새 구조로 변환
        const updateData: any = { ...updates };
        if (updates.schedule) {
            updateData.schedule = updates.schedule.map(slot => {
                const [day, periodId] = slot.split(' ');
                return { day, periodId };
            });
            updateData.legacySchedule = updates.schedule;
        }

        await updateDoc(doc(db, COL_CLASSES, classId), updateData);

        // schedule 변경 시 해당 수업의 enrollment.schedule도 동기화
        if (updates.schedule) {
            const classDocSnap = await getDoc(doc(db, COL_CLASSES, classId));
            const className = classDocSnap.exists() ? classDocSnap.data()?.className : null;
            const subject = classDocSnap.exists() ? classDocSnap.data()?.subject : null;

            if (className && subject) {
                const enrollQuery = query(
                    collectionGroup(db, 'enrollments'),
                    where('className', '==', className),
                    where('subject', '==', subject)
                );
                const enrollSnap = await getDocs(enrollQuery);
                const batch = writeBatch(db);
                let batchCount = 0;
                enrollSnap.forEach(enrollDoc => {
                    const data = enrollDoc.data();
                    if (!data.endDate && !data.withdrawalDate) {
                        batch.update(enrollDoc.ref, {
                            schedule: updates.schedule,
                            updatedAt: new Date().toISOString()
                        });
                        batchCount++;
                    }
                });
                if (batchCount > 0) await batch.commit();
            }
        }

        logTimetableChange({
            action: 'class_update', subject: 'math', className: classId,
            details: `수업 수정: ${classId}`,
            after: updateData,
        });

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();
    };

    const deleteClass = async (classId: string) => {
        // Soft delete - isActive를 false로 설정
        const classDocSnap = await getDoc(doc(db, COL_CLASSES, classId));
        const classData = classDocSnap.exists() ? classDocSnap.data() : null;

        await updateDoc(doc(db, COL_CLASSES, classId), { isActive: false, updatedAt: new Date().toISOString() });

        // 해당 수업의 활성 enrollment도 종료 처리
        if (classData?.className && classData?.subject) {
            const _yd = new Date(); _yd.setDate(_yd.getDate() - 1);
            const today = _yd.toISOString().split('T')[0]; // 전날로 설정하여 즉시 퇴원 처리
            const enrollQuery = query(
                collectionGroup(db, 'enrollments'),
                where('className', '==', classData.className),
                where('subject', '==', classData.subject)
            );
            const enrollSnap = await getDocs(enrollQuery);
            const batch = writeBatch(db);
            let batchCount = 0;
            enrollSnap.forEach(enrollDoc => {
                const data = enrollDoc.data();
                if (!data.endDate && !data.withdrawalDate) {
                    batch.update(enrollDoc.ref, {
                        endDate: today,
                        updatedAt: new Date().toISOString()
                    });
                    batchCount++;
                }
            });
            if (batchCount > 0) await batch.commit();
        }

        logTimetableChange({
            action: 'class_delete', subject: 'math', className: classId,
            details: `수업 비활성화: ${classId}`,
            before: { isActive: true }, after: { isActive: false },
        });

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();
    };

    const addStudent = async (
        classId: string,
        className: string,
        studentData: {
            name: string;
            grade: string;
            school: string;
        }
    ) => {
        if (!studentData.name.trim()) {
            throw new Error('학생 이름을 입력해주세요.');
        }

        // 1. Create Unified Student Document
        const studentRef = doc(collection(db, 'students'));
        const newStudentId = studentRef.id;
        const now = new Date().toISOString();

        const classSubject = await getClassSubject(classId);

        const newStudent = {
            id: newStudentId,
            name: studentData.name.trim(),
            grade: studentData.grade.trim(),
            school: studentData.school.trim(),
            status: 'active',
            subjects: [classSubject],
            createdAt: now,
            updatedAt: now
        };

        await setDoc(studentRef, newStudent);

        // 2. Create enrollment (doc ID = classId)
        // class 정보에서 teacher/schedule 가져오기
        const classDocSnap = await getDoc(doc(db, COL_CLASSES, classId));
        const classDocData = classDocSnap.exists() ? classDocSnap.data() : null;
        const classTeacher = classDocData?.teacher || '';
        const classSchedule = classDocData?.schedule?.map((s: any) =>
            typeof s === 'string' ? s : `${s.day} ${s.periodId}`
        ) || [];

        const enrollmentRef = doc(db, 'students', newStudentId, 'enrollments', classId);
        await setDoc(enrollmentRef, {
            classId,
            className,
            subject: classSubject,
            teacher: classTeacher,
            staffId: classTeacher,
            schedule: classSchedule,
            enrollmentDate: now.split('T')[0],
            createdAt: now
        });

        logTimetableChange({
            action: 'student_enroll', subject: classSubject, className,
            studentId: newStudentId, studentName: studentData.name.trim(),
            details: `신규 학생 등록: ${studentData.name.trim()} → ${className}`,
            after: { className, studentName: studentData.name.trim() },
        });

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();

        return newStudentId;
    };

    const removeStudent = async (className: string, studentId: string) => {
        // enrollment 문서 삭제 (쿼리로 찾아서 삭제 - doc ID 형식 무관, math/highmath 모두 검색)
        const enrollDoc = await findEnrollmentDoc(studentId, MATH_SUBJECTS, className);
        if (enrollDoc) await deleteDoc(enrollDoc.ref);

        logTimetableChange({
            action: 'student_unenroll', subject: enrollDoc?.data()?.subject || 'math', className, studentId, studentName: studentId,
            details: `학생 제거: ${studentId} ← ${className}`,
            before: { className },
        });

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();
    };

    const withdrawStudent = async (className: string, studentId: string) => {
        // Update Student Status
        const studentRef = doc(db, 'students', studentId);
        const now = new Date().toISOString();
        const _ydW = new Date(); _ydW.setDate(_ydW.getDate() - 1);
        const yesterdayStr = _ydW.toISOString().split('T')[0];
        await updateDoc(studentRef, {
            status: 'withdrawn',
            endDate: yesterdayStr,
            updatedAt: now
        });

        // enrollment에 withdrawalDate 설정 (쿼리로 찾기 - math/highmath 모두 검색)
        const enrollDoc = await findEnrollmentDoc(studentId, MATH_SUBJECTS, className);
        if (enrollDoc) {
            await updateDoc(enrollDoc.ref, {
                withdrawalDate: yesterdayStr
            });
        }

        logTimetableChange({
            action: 'student_withdraw', subject: enrollDoc?.data()?.subject || 'math', className, studentId, studentName: studentId,
            details: `퇴원 처리: ${studentId} ← ${className}`,
            before: { status: 'active' }, after: { status: 'withdrawn', withdrawalDate: yesterdayStr },
        });

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();
    };

    const restoreStudent = async (className: string, studentId: string) => {
        // Update Student Status
        const studentRef = doc(db, 'students', studentId);
        const now = new Date().toISOString();
        await updateDoc(studentRef, {
            status: 'active',
            endDate: null,
            withdrawalDate: null,
            updatedAt: now
        });

        // enrollment에서 withdrawalDate/endDate 제거 (쿼리로 찾기 - math/highmath 모두 검색)
        const enrollDoc = await findEnrollmentDoc(studentId, MATH_SUBJECTS, className);
        if (enrollDoc) {
            await updateDoc(enrollDoc.ref, {
                withdrawalDate: null,
                endDate: null,
                onHold: false
            });
        }

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();
    };

    const enrollExistingStudent = async (studentId: string, className: string, enrollmentDate?: string) => {
        const now = new Date().toISOString();

        // classId 조회 (enrollment doc ID로 사용) - math/highmath 모두 검색
        const classesRef = collection(db, COL_CLASSES);
        let classSnapshot = await getDocs(query(classesRef, where('className', '==', className), where('subject', '==', 'math')));
        if (classSnapshot.empty) {
            classSnapshot = await getDocs(query(classesRef, where('className', '==', className), where('subject', '==', 'highmath')));
        }
        if (classSnapshot.empty) {
            throw new Error(`수업 "${className}"을(를) 찾을 수 없습니다. 수업을 먼저 생성해주세요.`);
        }
        const classId = classSnapshot.docs[0].id;
        const classSubject = classSnapshot.docs[0].data().subject || 'math';

        // class 정보에서 teacher/schedule 가져오기
        const classDocData = classSnapshot.docs[0].data();
        const classTeacher = classDocData?.teacher || '';
        const classSchedule = classDocData?.schedule?.map((s: any) =>
            typeof s === 'string' ? s : `${s.day} ${s.periodId}`
        ) || [];

        // 기존 퇴원/종료 enrollment이 있으면 부활 처리
        const enrollmentsRef = collection(db, 'students', studentId, 'enrollments');
        const existingQuery = query(enrollmentsRef, where('subject', '==', classSubject), where('className', '==', className));
        const existingSnap = await getDocs(existingQuery);
        const endedDoc = existingSnap.docs.find(d => {
            const data = d.data();
            return data.endDate || data.withdrawalDate;
        });

        if (endedDoc) {
            // 기존 퇴원 enrollment 부활: endDate/withdrawalDate 제거 + 시작일 갱신
            await updateDoc(endedDoc.ref, {
                endDate: null,
                withdrawalDate: null,
                enrollmentDate: enrollmentDate || now.split('T')[0],
                startDate: enrollmentDate || now.split('T')[0],
                staffId: classTeacher,
                teacher: classTeacher,
                schedule: classSchedule,
                updatedAt: now,
            });
        } else {
            const enrollmentRef = doc(db, 'students', studentId, 'enrollments', classId);
            await setDoc(enrollmentRef, {
                classId,
                className,
                subject: classSubject,
                teacher: classTeacher,
                staffId: classTeacher,
                schedule: classSchedule,
                enrollmentDate: enrollmentDate || now.split('T')[0],
                createdAt: now,
            });
        }

        logTimetableChange({
            action: 'student_enroll', subject: classSubject, className, studentId, studentName: studentId,
            details: `기존 학생 등록: ${studentId} → ${className}`,
            after: { className, enrollmentDate: enrollmentDate || now.split('T')[0] },
        });

        invalidateMathCaches();
    };

    // 스마트 삭제: enrollment에 endDate 설정하고 스케줄 정보 저장 (지난수업 기록 유지)
    const smartRemoveStudent = async (className: string, studentId: string): Promise<'removed' | 'withdrawn'> => {
        console.log(`[smartRemoveStudent] 시작: ${studentId} from ${className}`);
        const enrollmentsRef = collection(db, 'students', studentId, 'enrollments');
        // math + highmath 모두 조회
        const qMath = query(enrollmentsRef, where('subject', '==', 'math'));
        const qHighmath = query(enrollmentsRef, where('subject', '==', 'highmath'));
        const [snapMath, snapHighmath] = await Promise.all([getDocs(qMath), getDocs(qHighmath)]);
        const allDocs = [...snapMath.docs, ...snapHighmath.docs];
        console.log(`[smartRemoveStudent] 학생의 수학 enrollments 수: ${allDocs.length}`);

        // 현재 반을 제외한 다른 활성 수학수업 수
        const otherActiveMath = allDocs.filter(d => {
            const data = d.data();
            return data.className !== className && !data.withdrawalDate && !data.endDate;
        }).length;

        // 시간표 "수정 모드" Delete 저장 흐름은 handleWithdrawalDrop(드롭존)과 동일하게
        // 오늘 날짜로 endDate/withdrawalDate를 찍어야 퇴원 섹션으로 즉시 이동함
        // (기존엔 전날로 찍어 의미는 같지만, 날짜 한 칸이 어긋나 재원/퇴원 분류가 흔들리는 케이스가 있었음)
        const today = new Date().toISOString().split('T')[0];

        // 쿼리 결과에서 해당 className의 모든 활성 enrollment 찾기
        // (같은 반에 attendanceDays만 다른 월만/목만 분리 enrollment가 공존할 수 있음 —
        //  find로 하나만 종료하면 남은 건 여전히 활성이라 재원 섹션에 남음)
        const activeTargets = allDocs.filter(d => d.data().className === className && !d.data().endDate && !d.data().withdrawalDate);
        const targetDocs = activeTargets.length > 0
            ? activeTargets
            : allDocs.filter(d => d.data().className === className).slice(0, 1); // 활성 없으면 fallback

        if (targetDocs.length === 0) {
            console.log(`[smartRemoveStudent] ⚠️ enrollment 문서 없음: ${studentId} - ${className}`);
            invalidateMathCaches();
            queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });
            queryClient.invalidateQueries({ queryKey: ['mathClasses'] });
            return otherActiveMath >= 1 ? 'removed' : 'withdrawn';
        }

        // 수업 스케줄 정보 조회하여 enrollment에 저장
        try {
            const classesRef = collection(db, COL_CLASSES);
            let classSnapshot = await getDocs(query(classesRef, where('className', '==', className), where('subject', '==', 'math')));
            if (classSnapshot.empty) {
                classSnapshot = await getDocs(query(classesRef, where('className', '==', className), where('subject', '==', 'highmath')));
            }

            const updateBase: Record<string, any> = {
                endDate: today,
                withdrawalDate: today,
                updatedAt: new Date().toISOString(),
            };
            if (!classSnapshot.empty) {
                const classData = classSnapshot.docs[0].data();
                updateBase.schedule = classData.legacySchedule || classData.schedule?.map((s: any) =>
                    typeof s === 'string' ? s : `${s.day} ${s.periodId}`
                ) || [];
            }

            // 모든 활성 enrollment를 한꺼번에 종료 (월만/목만 분리되어도 반 전체에서 퇴원)
            await Promise.all(targetDocs.map(d => updateDoc(d.ref, updateBase)));
        } catch (error) {
            console.error('enrollment 업데이트 오류:', error);
            throw error;
        }

        const targetSubject = targetDocs[0]?.data()?.subject || 'math';
        if (otherActiveMath >= 1) {
            logTimetableChange({
                action: 'student_unenroll', subject: targetSubject, className, studentId, studentName: studentId,
                details: `학생 제거 (다른 수학수업 있음): ${studentId} ← ${className}`,
                before: { className },
            });
            invalidateMathCaches();
            return 'removed';
        } else {
            logTimetableChange({
                action: 'student_unenroll', subject: targetSubject, className, studentId, studentName: studentId,
                details: `학생 제거 (마지막 수학수업): ${studentId} ← ${className}`,
                before: { className },
            });
            invalidateMathCaches();
            return 'withdrawn';
        }
    };

    // 퇴원생 수업기록 완전 삭제 (쿼리로 찾아서 삭제)
    const deleteEnrollmentRecord = async (className: string, studentId: string, subject?: string) => {
        const subjectKey = subject === 'english' ? 'english' : MATH_SUBJECTS;
        const enrollDoc = await findEnrollmentDoc(studentId, subjectKey, className);
        if (enrollDoc) await deleteDoc(enrollDoc.ref);
        invalidateMathCaches();
        queryClient.invalidateQueries({ queryKey: ['classDetail'] });
        queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
    };

    return {
        checkConsecutiveSchedule,
        addClass,
        updateClass,
        deleteClass,
        addStudent,
        enrollExistingStudent,
        removeStudent,
        withdrawStudent,
        restoreStudent,
        smartRemoveStudent,
        deleteEnrollmentRecord
    };
};
