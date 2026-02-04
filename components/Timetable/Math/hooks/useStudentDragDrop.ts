import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../../../../firebaseConfig';
import { TimetableClass, TimetableStudent } from '../../../../types';

// 'common' = 모든 요일 등원, 특정 요일 문자열(예: '월', '목') = 해당 요일만 등원
export type DragZone = 'common' | string;

export interface DraggingStudent {
    studentId: string;
    fromClassId: string;
    fromZone: DragZone;
}

export interface PendingMove {
    studentId: string;
    fromClassId: string;
    toClassId: string;
    fromZone: DragZone;
    toZone: DragZone;
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
    // useEffect는 paint 이후 실행되므로 localClasses를 동기화용으로만 사용
    useEffect(() => {
        if (pendingMoves.length === 0) {
            setLocalClasses(initialClasses);
        }
    }, [initialClasses, pendingMoves.length]);

    // 이중 페인트 방지: pendingMoves가 없으면 initialClasses를 직접 사용
    // useEffect의 setLocalClasses는 paint 이후 실행되어 깜빡임 유발하므로
    // 동기적으로 올바른 데이터를 선택
    const effectiveClasses = pendingMoves.length === 0 ? initialClasses : localClasses;

    const handleDragStart = useCallback((e: React.DragEvent, studentId: string, fromClassId: string, fromZone: DragZone = 'common') => {
        setDraggingStudent({ studentId, fromClassId, fromZone });
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, classId: string) => {
        e.preventDefault();
        setDragOverClassId(classId);
    }, []);

    const handleDragLeave = useCallback(() => setDragOverClassId(null), []);

    const handleDrop = async (e: React.DragEvent, toClassId: string, toZone: DragZone = 'common') => {
        e.preventDefault();
        setDragOverClassId(null);
        if (!draggingStudent) return;

        const { studentId, fromClassId, fromZone } = draggingStudent;

        // 같은 반 + 같은 zone → 무시
        if (fromClassId === toClassId && fromZone === toZone) {
            setDraggingStudent(null);
            return;
        }

        const isSameClass = fromClassId === toClassId;

        if (isSameClass) {
            // ===== 같은 반 내 zone 이동 (attendanceDays만 변경) =====
            const newAttendanceDays = toZone === 'common' ? [] : [toZone];

            setLocalClasses(prev => prev.map(cls => {
                if (cls.id !== fromClassId) return cls;
                const newStudentList = (cls.studentList || []).map(s => {
                    if (s.id !== studentId) return s;
                    return { ...s, attendanceDays: newAttendanceDays };
                });
                return { ...cls, studentList: newStudentList };
            }));

            setPendingMoves(prev => [...prev, {
                studentId,
                fromClassId,
                toClassId,
                fromZone,
                toZone,
                student: { id: studentId } as TimetableStudent
            }]);
            setDraggingStudent(null);
            return;
        }

        // ===== 다른 반으로 이동 (기존 로직 + attendanceDays 반영) =====
        const fromClass = localClasses.find(c => c.id === fromClassId);
        const toClass = localClasses.find(c => c.id === toClassId);
        if (!fromClass || !toClass) return;

        const movingStudent = fromClass.studentList?.find(s => s.id === studentId);
        if (!fromClass.studentIds?.includes(studentId) && !movingStudent) return;

        const newAttendanceDays = toZone === 'common' ? [] : [toZone];

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
                    newStudentList.push({ ...movingStudent, attendanceDays: newAttendanceDays });
                }
                return { ...cls, studentIds: newIds, studentList: newStudentList };
            }
            return cls;
        }));

        setPendingMoves(prev => [...prev, {
            studentId,
            fromClassId,
            toClassId,
            fromZone,
            toZone,
            student: { id: studentId } as TimetableStudent
        }]);
        setDraggingStudent(null);
    };

    const handleSavePendingMoves = async () => {
        if (pendingMoves.length === 0) return;
        setIsSaving(true);

        try {
            // 같은 학생의 여러 이동을 최종 결과로 압축
            // A→B, B→C 이동이 있으면 최종적으로 A→C만 처리
            const finalMoves = new Map<string, { fromClassId: string; toClassId: string; fromZone: DragZone; toZone: DragZone }>();
            pendingMoves.forEach(move => {
                const existing = finalMoves.get(move.studentId);
                if (existing) {
                    // 이미 이동 기록이 있으면 최초 출발지 유지, 목적지만 갱신
                    existing.toClassId = move.toClassId;
                    existing.toZone = move.toZone;
                } else {
                    finalMoves.set(move.studentId, {
                        fromClassId: move.fromClassId,
                        toClassId: move.toClassId,
                        fromZone: move.fromZone,
                        toZone: move.toZone
                    });
                }
            });

            // 같은 반 + 같은 zone으로 되돌아온 경우 제거 (A→B→A, 월만→목만→월만)
            for (const [studentId, move] of finalMoves) {
                if (move.fromClassId === move.toClassId && move.fromZone === move.toZone) {
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

            for (const [studentId, move] of finalMoves) {
                const isSameClass = move.fromClassId === move.toClassId;
                const newAttendanceDays = move.toZone === 'common' ? [] : [move.toZone];

                if (isSameClass) {
                    // ===== zone만 변경 (같은 반): attendanceDays만 업데이트 =====
                    const cls = localClasses.find(c => c.id === move.fromClassId);
                    if (!cls) continue;

                    const enrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${cls.className}`);
                    batch.update(enrollmentRef, {
                        attendanceDays: newAttendanceDays,
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    // ===== 반이동 + attendanceDays 설정 =====
                    const fromClass = localClasses.find(c => c.id === move.fromClassId);
                    const toClass = localClasses.find(c => c.id === move.toClassId);

                    if (fromClass && toClass) {
                        const oldEnrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${fromClass.className}`);
                        const newEnrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${toClass.className}`);

                        const existingData = enrollmentDataMap.get(`${studentId}_${move.fromClassId}`);
                        const today = new Date().toISOString().split('T')[0];

                        // 기존 enrollment 종료 처리
                        batch.update(oldEnrollmentRef, {
                            endDate: today,
                            withdrawalDate: today,
                            updatedAt: new Date().toISOString()
                        });

                        // 새 enrollment 생성 (attendanceDays 포함)
                        if (existingData) {
                            const { endDate, withdrawalDate, ...preservedData } = existingData;
                            batch.set(newEnrollmentRef, {
                                ...preservedData,
                                className: toClass.className,
                                attendanceDays: newAttendanceDays,
                                enrollmentDate: today,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            });
                        } else {
                            batch.set(newEnrollmentRef, {
                                className: toClass.className,
                                subject: 'math',
                                attendanceDays: newAttendanceDays,
                                enrollmentDate: today,
                                createdAt: new Date().toISOString()
                            });
                        }
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

    const handleCancelPendingMoves = useCallback(() => {
        setPendingMoves([]);
        setLocalClasses(initialClasses); // Reset to Firebase state
    }, [initialClasses]);

    return {
        localClasses: effectiveClasses,
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
