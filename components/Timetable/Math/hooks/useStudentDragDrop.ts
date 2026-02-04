import { useState, useEffect } from 'react';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
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
    const queryClient = useQueryClient();
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

        // Find the student being moved (from studentList for optimistic UI)
        const movingStudent = fromClass.studentList?.find(s => s.id === studentId);
        if (!fromClass.studentIds?.includes(studentId) && !movingStudent) return;

        // Update local state - both studentIds AND studentList
        // ClassCard uses studentList first, so both must be updated for optimistic UI
        setLocalClasses(prev => prev.map(cls => {
            if (cls.id === fromClassId) {
                const newIds = (cls.studentIds || []).filter(id => id !== studentId);
                const newStudentList = (cls.studentList || []).filter(s => s.id !== studentId);
                return { ...cls, studentIds: newIds, studentList: newStudentList };
            }
            if (cls.id === toClassId) {
                const newIds = [...(cls.studentIds || [])];
                if (!newIds.includes(studentId)) {
                    newIds.push(studentId);
                }
                const newStudentList = [...(cls.studentList || [])];
                if (movingStudent && !newStudentList.some(s => s.id === studentId)) {
                    newStudentList.push(movingStudent);
                }
                return { ...cls, studentIds: newIds, studentList: newStudentList };
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
            // 같은 학생의 여러 이동을 최종 결과로 압축
            // A→B, B→C 이동이 있으면 최종적으로 A→C만 처리
            const finalMoves = new Map<string, { fromClassId: string; toClassId: string }>();
            pendingMoves.forEach(move => {
                const existing = finalMoves.get(move.studentId);
                if (existing) {
                    // 이미 이동 기록이 있으면 최초 출발지 유지, 목적지만 갱신
                    existing.toClassId = move.toClassId;
                } else {
                    finalMoves.set(move.studentId, {
                        fromClassId: move.fromClassId,
                        toClassId: move.toClassId
                    });
                }
            });

            // 같은 반으로 되돌아온 경우 제거 (A→B→A)
            for (const [studentId, move] of finalMoves) {
                if (move.fromClassId === move.toClassId) {
                    finalMoves.delete(studentId);
                }
            }

            if (finalMoves.size === 0) {
                setPendingMoves([]);
                return;
            }

            // 기존 enrollment 데이터 읽기
            const enrollmentDataMap = new Map<string, Record<string, any>>();
            await Promise.all(
                Array.from(finalMoves.entries()).map(async ([studentId, move]) => {
                    const fromClass = localClasses.find(c => c.id === move.fromClassId);
                    if (!fromClass) return;

                    const oldEnrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${fromClass.className}`);
                    const oldDoc = await getDoc(oldEnrollmentRef);
                    if (oldDoc.exists()) {
                        enrollmentDataMap.set(`${studentId}_${move.fromClassId}`, oldDoc.data());
                    }
                })
            );

            const batch = writeBatch(db);

            // 각 최종 이동에 대해 enrollment 업데이트
            for (const [studentId, move] of finalMoves) {
                const fromClass = localClasses.find(c => c.id === move.fromClassId);
                const toClass = localClasses.find(c => c.id === move.toClassId);

                if (fromClass && toClass) {
                    const oldEnrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${fromClass.className}`);
                    const newEnrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${toClass.className}`);

                    // 기존 데이터 가져오기
                    const existingData = enrollmentDataMap.get(`${studentId}_${move.fromClassId}`);
                    const today = new Date().toISOString().split('T')[0];

                    // 기존 enrollment 종료 처리 (삭제 대신 endDate 설정 → 반이동 감지용)
                    batch.update(oldEnrollmentRef, {
                        endDate: today,
                        withdrawalDate: today,
                        updatedAt: new Date().toISOString()
                    });

                    // 기존 데이터 보존하며 className만 변경하여 새 enrollment 생성
                    if (existingData) {
                        const { endDate, withdrawalDate, ...preservedData } = existingData;
                        batch.set(newEnrollmentRef, {
                            ...preservedData,
                            className: toClass.className,
                            enrollmentDate: today,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    } else {
                        batch.set(newEnrollmentRef, {
                            className: toClass.className,
                            subject: 'math',
                            enrollmentDate: today,
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            }

            await batch.commit();

            // React Query 캐시 무효화 - 실시간 반영
            queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });

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
