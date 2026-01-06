import { useState } from 'react';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableStudent } from '../../../../types';
import { CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from '../englishUtils';

export interface MoveChange {
    student: TimetableStudent;
    fromClass: string;
    toClass: string;
}

export const useEnglishChanges = (isSimulationMode: boolean) => {
    const [moveChanges, setMoveChanges] = useState<Map<string, MoveChange>>(new Map());
    const [isSaving, setIsSaving] = useState(false);

    const handleMoveStudent = (student: TimetableStudent, fromClass: string, toClass: string) => {
        if (fromClass === toClass) return;

        setMoveChanges(prev => {
            const next = new Map(prev);
            const existingMove = next.get(student.id);

            if (existingMove) {
                if (existingMove.fromClass === toClass) {
                    next.delete(student.id);
                } else {
                    next.set(student.id, { ...existingMove, toClass });
                }
            } else {
                next.set(student.id, { student, fromClass, toClass });
            }
            return next;
        });
    };

    const handleCancelChanges = () => {
        if (moveChanges.size === 0) return;
        if (confirm('저장하지 않은 변경사항이 모두 사라집니다.\n계속하시겠습니까?')) {
            setMoveChanges(new Map());
        }
    };

    const handleSaveChanges = async () => {
        if (moveChanges.size === 0) return;
        if (!confirm(`총 ${moveChanges.size}명의 학생 이동을 저장하시겠습니까?`)) return;

        setIsSaving(true);
        try {
            const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;
            const batch = writeBatch(db);
            const classesToUpdate = new Set<string>();
            moveChanges.forEach(change => {
                classesToUpdate.add(change.fromClass);
                classesToUpdate.add(change.toClass);
            });

            const uniqueClasses = Array.from(classesToUpdate);
            const classSnapshots = await Promise.all(
                uniqueClasses.map(cName => {
                    const q = query(collection(db, targetCollection), where('className', '==', cName));
                    return getDocs(q);
                })
            );

            const classDocMap: Record<string, { ref: any, data: any }> = {};

            classSnapshots.forEach(snap => {
                if (!snap.empty) {
                    const docSnap = snap.docs[0];
                    classDocMap[docSnap.data().className] = {
                        ref: docSnap.ref,
                        data: docSnap.data()
                    };
                }
            });

            moveChanges.forEach(({ student, fromClass, toClass }) => {
                if (classDocMap[fromClass]) {
                    const list = (classDocMap[fromClass].data.studentIds || []) as string[];
                    const newList = list.filter(id => id !== student.id);
                    classDocMap[fromClass].data.studentIds = newList;
                }

                if (classDocMap[toClass]) {
                    const list = (classDocMap[toClass].data.studentIds || []) as string[];
                    if (!list.includes(student.id)) {
                        list.push(student.id);
                        // We cannot sort locally easily without student map, but sorting happens on read usually.
                        // Ideally we should sort here if we want consistent DB order, but IDs are not name-sorted usually.
                        // Validation/Sorting usually happens on client render.
                        classDocMap[toClass].data.studentIds = list;
                    }
                }
            });

            Object.values(classDocMap).forEach(({ ref, data }) => {
                batch.update(ref, { studentIds: data.studentIds });
            });

            await batch.commit();
            setMoveChanges(new Map());
            alert('저장되었습니다.');

        } catch (error) {
            console.error('Batch save failed:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return {
        moveChanges,
        isSaving,
        handleMoveStudent,
        handleCancelChanges,
        handleSaveChanges
    };
};
