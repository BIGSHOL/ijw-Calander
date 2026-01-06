import { doc, setDoc, deleteDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableClass, TimetableStudent } from '../../../../types';

export const useClassOperations = () => {
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
        },
        currentPeriods: string[]
    ) => {
        const { className, teacher, room, subject, schedule } = newClassData;

        if (!className.trim() || !teacher.trim()) {
            throw new Error('수업명과 담당 강사를 입력해주세요.');
        }
        if (schedule.length === 0) {
            throw new Error('최소 1개 이상의 시간대를 선택해주세요.');
        }

        const classId = `${subject}_${teacher.trim().replace(/\s/g, '')}_${className.trim().replace(/\s/g, '_')}`;

        const existingClass = classes.find(c => c.id === classId);
        if (existingClass) {
            throw new Error(`이미 동일한 수업이 존재합니다.\n\n수업명: ${existingClass.className}\n강사: ${existingClass.teacher}\n\n기존 수업을 수정하려면 시간표에서 해당 수업을 클릭해주세요.`);
        }

        if (!checkConsecutiveSchedule(schedule, currentPeriods)) {
            throw new Error('같은 요일의 수업 시간은 연속되어야 합니다.\n\n예: 1-1, 1-2 (O) / 1-1, 2-1 (X - 중간에 1-2번이 비어있음)');
        }

        const newClass: TimetableClass = {
            id: classId,
            className: className.trim(),
            teacher: teacher.trim(),
            room: room.trim(),
            subject: subject,
            schedule: schedule,
            studentList: [],
            order: classes.length + 1
        };

        await setDoc(doc(db, '수업목록', classId), newClass);
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

        await updateDoc(doc(db, '수업목록', classId), updates);
    };

    const deleteClass = async (classId: string) => {
        await deleteDoc(doc(db, '수업목록', classId));
    };

    const addStudent = async (
        classId: string,
        currentStudentIds: string[] | undefined,
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
            subject: 'math', // Default for this context
            teacherIds: [], // Could populate if we knew the teacher ID from class
            createdAt: now,
            updatedAt: now
        };

        await setDoc(studentRef, newStudent);

        // 2. Link to Class
        const updatedIds = [...(currentStudentIds || []), newStudentId];
        await updateDoc(doc(db, '수업목록', classId), {
            studentIds: updatedIds,
            // Deprecated: maintain for compatibility if needed, else remove
            // studentList: ... 
        });

        return updatedIds; // Return IDs instead of list
    };

    const removeStudent = async (classId: string, currentStudentIds: string[] | undefined, studentId: string) => {
        const updatedIds = (currentStudentIds || []).filter(id => id !== studentId);
        await updateDoc(doc(db, '수업목록', classId), { studentIds: updatedIds });
        return updatedIds;
    };

    const withdrawStudent = async (classId: string, currentStudentIds: string[] | undefined, studentId: string) => {
        // Update Student Status
        const studentRef = doc(db, 'students', studentId);
        const now = new Date().toISOString();
        await updateDoc(studentRef, {
            status: 'withdrawn',
            endDate: now.split('T')[0],
            updatedAt: now
        });
        // We don't remove from class if we want to keep showing them as withdrawn
        return currentStudentIds || [];
    };

    const restoreStudent = async (classId: string, currentStudentIds: string[] | undefined, studentId: string) => {
        // Update Student Status
        const studentRef = doc(db, 'students', studentId);
        const now = new Date().toISOString();
        await updateDoc(studentRef, {
            status: 'active',
            endDate: null, // Clear end date
            withdrawalDate: null, // Clear if any
            updatedAt: now
        });
        return currentStudentIds || [];
    };

    return {
        checkConsecutiveSchedule,
        addClass,
        updateClass,
        deleteClass,
        addStudent,
        removeStudent,
        withdrawStudent,
        restoreStudent
    };
};
