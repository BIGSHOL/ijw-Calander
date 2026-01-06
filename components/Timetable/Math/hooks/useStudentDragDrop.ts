import { useState, useEffect } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableClass, TimetableStudent } from '../../../../types';

export interface DraggingStudent {
    studentId: string;
    fromClassId: string;
}

export interface PendingMove {
    studentId: string;
    fromClassId: string;
    toClassId: string;
    student: TimetableStudent;
}

export const useStudentDragDrop = (initialClasses: TimetableClass[]) => {
    const [draggingStudent, setDraggingStudent] = useState<DraggingStudent | null>(null);
    const [dragOverClassId, setDragOverClassId] = useState<string | null>(null);

    // Optimistic UI state
    const [localClasses, setLocalClasses] = useState<TimetableClass[]>([]);
    const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Sync local classes with Firestore classes when there are no pending moves
    useEffect(() => {
        if (pendingMoves.length === 0) {
            setLocalClasses(initialClasses);
        }
    }, [initialClasses, pendingMoves.length]);

    const handleDragStart = (e: React.DragEvent, studentId: string, fromClassId: string) => {
        setDraggingStudent({ studentId, fromClassId });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, classId: string) => {
        e.preventDefault();
        setDragOverClassId(classId);
    };

    const handleDragLeave = () => setDragOverClassId(null);

    const handleDrop = async (e: React.DragEvent, toClassId: string) => {
        e.preventDefault();
        setDragOverClassId(null);
        if (!draggingStudent) return;

        const { studentId, fromClassId } = draggingStudent;
        if (fromClassId === toClassId) {
            setDraggingStudent(null);
            return;
        }

        // Logic check: make sure class exists
        const fromClass = localClasses.find(c => c.id === fromClassId);
        const toClass = localClasses.find(c => c.id === toClassId);
        if (!fromClass || !toClass) return;

        // Verify student exists in fromClass (using IDs)
        if (!fromClass.studentIds?.includes(studentId)) return;

        // Update local state
        setLocalClasses(prev => prev.map(cls => {
            if (cls.id === fromClassId) {
                const newIds = (cls.studentIds || []).filter(id => id !== studentId);
                return { ...cls, studentIds: newIds };
            }
            if (cls.id === toClassId) {
                const newIds = [...(cls.studentIds || [])];
                if (!newIds.includes(studentId)) {
                    newIds.push(studentId);
                }
                return { ...cls, studentIds: newIds };
            }
            return cls;
        }));

        // Add to pending moves
        setPendingMoves(prev => [...prev, { studentId, fromClassId, toClassId, student: { id: studentId } as TimetableStudent }]); // Partial student obj is enough for tracking
        setDraggingStudent(null);
    };

    const handleSavePendingMoves = async () => {
        if (pendingMoves.length === 0) return;
        setIsSaving(true);

        try {
            const batch = writeBatch(db);

            // Build final state for each affected class
            const affectedClassIds = new Set<string>();
            pendingMoves.forEach(m => {
                affectedClassIds.add(m.fromClassId);
                affectedClassIds.add(m.toClassId);
            });

            affectedClassIds.forEach(classId => {
                const cls = localClasses.find(c => c.id === classId);
                if (cls) {
                    batch.update(doc(db, '수업목록', classId), { studentIds: cls.studentIds || [] });
                }
            });

            await batch.commit();
            setPendingMoves([]);
        } catch (e) {
            console.error(e);
            alert('저장 실패');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelPendingMoves = () => {
        setPendingMoves([]);
        setLocalClasses(initialClasses); // Reset to Firebase state
    };

    return {
        localClasses,
        pendingMoves,
        isSaving,
        draggingStudent,
        dragOverClassId,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleSavePendingMoves,
        handleCancelPendingMoves
    };
};
