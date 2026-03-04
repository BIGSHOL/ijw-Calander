import { doc, setDoc, deleteDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../../../../firebaseConfig';
import { TimetableClass } from '../../../../types';

const COL_CLASSES = 'classes';

/**
 * useClassOperations - 수학 수업 CRUD 작업
 *
 * 데이터 저장: classes 컬렉션
 * 학생 등록: enrollments subcollection
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

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();
    };

    const deleteClass = async (classId: string) => {
        // Soft delete - isActive를 false로 설정
        await updateDoc(doc(db, COL_CLASSES, classId), { isActive: false });

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

        const newStudent = {
            id: newStudentId,
            name: studentData.name.trim(),
            grade: studentData.grade.trim(),
            school: studentData.school.trim(),
            status: 'active',
            subjects: ['math'],
            createdAt: now,
            updatedAt: now
        };

        await setDoc(studentRef, newStudent);

        // 2. Create enrollment
        const enrollmentRef = doc(db, 'students', newStudentId, 'enrollments', `math_${className}`);
        await setDoc(enrollmentRef, {
            className,
            subject: 'math',
            enrollmentDate: now.split('T')[0],
            createdAt: now
        });

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();

        return newStudentId;
    };

    const removeStudent = async (className: string, studentId: string) => {
        // enrollment 문서 삭제
        const enrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${className}`);
        await deleteDoc(enrollmentRef);

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();
    };

    const withdrawStudent = async (className: string, studentId: string) => {
        // Update Student Status
        const studentRef = doc(db, 'students', studentId);
        const now = new Date().toISOString();
        await updateDoc(studentRef, {
            status: 'withdrawn',
            endDate: now.split('T')[0],
            updatedAt: now
        });

        // enrollment에 withdrawalDate 설정
        const enrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${className}`);
        await updateDoc(enrollmentRef, {
            withdrawalDate: now.split('T')[0]
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

        // enrollment에서 withdrawalDate 제거
        const enrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${className}`);
        await updateDoc(enrollmentRef, {
            withdrawalDate: null,
            onHold: false
        });

        // 캐시 무효화 - 실시간 반영
        invalidateMathCaches();
    };

    const enrollExistingStudent = async (studentId: string, className: string, enrollmentDate?: string) => {
        const now = new Date().toISOString();
        const enrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${className}`);
        await setDoc(enrollmentRef, {
            className,
            subject: 'math',
            enrollmentDate: enrollmentDate || now.split('T')[0],
            createdAt: now,
        });
        invalidateMathCaches();
    };

    // 스마트 삭제: 다른 활성 수학수업이 있으면 enrollment만 삭제, 없으면 퇴원 처리
    const smartRemoveStudent = async (className: string, studentId: string): Promise<'removed' | 'withdrawn'> => {
        const enrollmentsRef = collection(db, 'students', studentId, 'enrollments');
        const q = query(enrollmentsRef, where('subject', '==', 'math'));
        const snapshot = await getDocs(q);

        // 현재 반을 제외한 다른 활성 수학수업 수
        const otherActiveMath = snapshot.docs.filter(d => {
            const data = d.data();
            return data.className !== className && !data.withdrawalDate && !data.endDate;
        }).length;

        const enrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${className}`);

        if (otherActiveMath >= 1) {
            await deleteDoc(enrollmentRef);
            invalidateMathCaches();
            return 'removed';
        } else {
            const today = new Date().toISOString().split('T')[0];
            await updateDoc(enrollmentRef, { withdrawalDate: today });
            invalidateMathCaches();
            return 'withdrawn';
        }
    };

    // 퇴원생 수업기록 완전 삭제
    const deleteEnrollmentRecord = async (className: string, studentId: string) => {
        const enrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${className}`);
        await deleteDoc(enrollmentRef);
        invalidateMathCaches();
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
