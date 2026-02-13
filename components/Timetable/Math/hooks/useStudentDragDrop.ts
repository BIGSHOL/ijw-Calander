import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../../../../firebaseConfig';
import { TimetableClass, TimetableStudent } from '../../../../types';
import { formatDateKey } from '../../../../utils/dateUtils';

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
    scheduledDate?: string;  // 'YYYY-MM-DD' 예정일 (undefined = 오늘 즉시 이동)
}

export const useStudentDragDrop = (initialClasses: TimetableClass[]) => {
    const queryClient = useQueryClient();
    const [draggingStudent, setDraggingStudent] = useState<DraggingStudent | null>(null);
    const [dragOverClassId, setDragOverClassId] = useState<string | null>(null);

    // Optimistic UI state
    const [localClasses, setLocalClasses] = useState<TimetableClass[]>([]);
    const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Refs: ClassCard의 React.memo가 onDrop을 비교하지 않아 stale closure 발생 방지
    // handleDrop이 항상 최신 상태를 읽을 수 있도록 ref 사용
    const draggingStudentRef = useRef<DraggingStudent | null>(null);
    const localClassesRef = useRef<TimetableClass[]>([]);

    // 렌더 시 동기적으로 ref 업데이트 (항상 최신 상태 유지)
    // effectiveClasses와 동일한 로직: pendingMoves 없으면 initialClasses 사용
    localClassesRef.current = pendingMoves.length === 0 ? initialClasses : localClasses;

    // Sync local classes with Firestore classes when there are no pending moves
    // useEffect는 paint 이후 실행되므로 localClasses를 동기화용으로만 사용
    // IMPORTANT: initialClasses를 JSON.stringify로 비교하여 실제 내용이 변경되었을 때만 업데이트
    const initialClassesRef = useRef<string>('');
    useEffect(() => {
        if (pendingMoves.length === 0) {
            const serialized = JSON.stringify(initialClasses);
            if (serialized !== initialClassesRef.current) {
                initialClassesRef.current = serialized;
                setLocalClasses(initialClasses);
            }
        }
    }, [initialClasses, pendingMoves.length]);

    // 이중 페인트 방지: pendingMoves가 없으면 initialClasses를 직접 사용
    // useEffect의 setLocalClasses는 paint 이후 실행되어 깜빡임 유발하므로
    // 동기적으로 올바른 데이터를 선택
    const effectiveClasses = pendingMoves.length === 0 ? initialClasses : localClasses;

    const handleDragStart = useCallback((e: React.DragEvent, studentId: string, fromClassId: string, fromZone: DragZone = 'common') => {
        const dragInfo = { studentId, fromClassId, fromZone };
        draggingStudentRef.current = dragInfo;  // 동기적 ref 업데이트 (stale closure 방지)
        setDraggingStudent(dragInfo);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, classId: string) => {
        e.preventDefault();
        setDragOverClassId(classId);
    }, []);

    const handleDragLeave = useCallback(() => setDragOverClassId(null), []);

    // useCallback + ref로 안정적인 참조 유지
    // ClassCard의 React.memo가 onDrop을 비교하지 않아도 항상 최신 상태를 읽음
    const handleDrop = useCallback(async (e: React.DragEvent, toClassId: string, toZone: DragZone = 'common') => {
        e.preventDefault();
        setDragOverClassId(null);

        // ref에서 최신 draggingStudent 읽기 (stale closure 방지)
        const currentDragging = draggingStudentRef.current;
        if (!currentDragging) return;

        const { studentId, fromClassId, fromZone } = currentDragging;

        // 같은 반 + 같은 zone → 무시
        if (fromClassId === toClassId && fromZone === toZone) {
            draggingStudentRef.current = null;
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
            draggingStudentRef.current = null;
            setDraggingStudent(null);
            return;
        }

        // ===== 다른 반으로 이동 (기존 로직 + attendanceDays 반영) =====
        // ref에서 최신 localClasses 읽기 (stale closure 방지)
        const currentLocalClasses = localClassesRef.current;
        const fromClass = currentLocalClasses.find(c => c.id === fromClassId);
        const toClass = currentLocalClasses.find(c => c.id === toClassId);
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
        draggingStudentRef.current = null;
        setDraggingStudent(null);
    }, []);

    const handleSavePendingMoves = async () => {
        if (pendingMoves.length === 0) return;
        setIsSaving(true);

        try {
            // 같은 학생의 여러 이동을 최종 결과로 압축
            // A→B, B→C 이동이 있으면 최종적으로 A→C만 처리
            const finalMoves = new Map<string, { fromClassId: string; toClassId: string; fromZone: DragZone; toZone: DragZone; scheduledDate?: string }>();
            pendingMoves.forEach(move => {
                const existing = finalMoves.get(move.studentId);
                if (existing) {
                    // 이미 이동 기록이 있으면 최초 출발지 유지, 목적지만 갱신
                    existing.toClassId = move.toClassId;
                    existing.toZone = move.toZone;
                    existing.scheduledDate = move.scheduledDate;
                } else {
                    finalMoves.set(move.studentId, {
                        fromClassId: move.fromClassId,
                        toClassId: move.toClassId,
                        fromZone: move.fromZone,
                        toZone: move.toZone,
                        scheduledDate: move.scheduledDate
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

            // initialClasses(서버 원본)에서 실제 enrollment 문서 ID 조회 맵 구축
            // localClasses는 optimistic update로 학생이 이동되어 있어 원본 반에서 찾을 수 없음
            const enrollmentDocIdMap = new Map<string, string>();
            initialClasses.forEach(cls => {
                cls.studentList?.forEach(s => {
                    if (s.enrollmentDocId) {
                        enrollmentDocIdMap.set(`${s.id}_${cls.id}`, s.enrollmentDocId);
                    }
                });
            });

            // 실제 enrollment 문서 ID 조회 헬퍼
            const getEnrollmentDocId = (studentId: string, classId: string, className: string) => {
                return enrollmentDocIdMap.get(`${studentId}_${classId}`) || `math_${className}`;
            };

            // 기존 enrollment 데이터 읽기 (실제 문서 ID 사용)
            const enrollmentDataMap = new Map<string, Record<string, any>>();
            await Promise.all(
                Array.from(finalMoves.entries()).map(async ([studentId, move]) => {
                    const fromClass = localClasses.find(c => c.id === move.fromClassId);
                    if (!fromClass) return;

                    const docId = getEnrollmentDocId(studentId, move.fromClassId, fromClass.className);
                    const oldEnrollmentRef = doc(db, 'students', studentId, 'enrollments', docId);
                    const oldDoc = await getDoc(oldEnrollmentRef);
                    if (oldDoc.exists()) {
                        enrollmentDataMap.set(`${studentId}_${move.fromClassId}`, oldDoc.data());
                    }
                })
            );

            const batch = writeBatch(db);
            const defaultToday = formatDateKey(new Date());

            for (const [studentId, move] of finalMoves) {
                const isSameClass = move.fromClassId === move.toClassId;
                const newAttendanceDays = move.toZone === 'common' ? [] : [move.toZone];

                if (isSameClass) {
                    // ===== zone만 변경 (같은 반): attendanceDays만 업데이트 =====
                    const cls = localClasses.find(c => c.id === move.fromClassId);
                    if (!cls) continue;

                    const docId = getEnrollmentDocId(studentId, move.fromClassId, cls.className);
                    const enrollmentRef = doc(db, 'students', studentId, 'enrollments', docId);
                    batch.set(enrollmentRef, {
                        attendanceDays: newAttendanceDays,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                } else {
                    // ===== 반이동 + attendanceDays 설정 =====
                    const fromClass = localClasses.find(c => c.id === move.fromClassId);
                    const toClass = localClasses.find(c => c.id === move.toClassId);

                    if (fromClass && toClass) {
                        const oldDocId = getEnrollmentDocId(studentId, move.fromClassId, fromClass.className);
                        const oldEnrollmentRef = doc(db, 'students', studentId, 'enrollments', oldDocId);
                        const newEnrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${toClass.className}`);

                        const existingData = enrollmentDataMap.get(`${studentId}_${move.fromClassId}`);
                        // 예정일이 있으면 해당 날짜 사용, 없으면 오늘
                        const effectiveDate = move.scheduledDate || defaultToday;

                        // 기존 enrollment 종료 처리 (문서가 존재하는 경우에만)
                        if (existingData) {
                            batch.update(oldEnrollmentRef, {
                                endDate: effectiveDate,
                                withdrawalDate: effectiveDate,
                                isTransferred: true,
                                updatedAt: new Date().toISOString()
                            });
                        }

                        // 새 enrollment 생성 (attendanceDays 포함)
                        if (existingData) {
                            const { endDate, withdrawalDate, ...preservedData } = existingData;
                            batch.set(newEnrollmentRef, {
                                ...preservedData,
                                className: toClass.className,
                                attendanceDays: newAttendanceDays,
                                enrollmentDate: preservedData.enrollmentDate || effectiveDate,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            });
                        } else {
                            batch.set(newEnrollmentRef, {
                                className: toClass.className,
                                subject: 'math',
                                attendanceDays: newAttendanceDays,
                                enrollmentDate: effectiveDate,
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

    // 특정 학생의 예정일 업데이트
    const updatePendingMoveDate = useCallback((studentId: string, scheduledDate: string | undefined) => {
        setPendingMoves(prev => prev.map(m =>
            m.studentId === studentId ? { ...m, scheduledDate } : m
        ));
    }, []);

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
        handleCancelPendingMoves,
        updatePendingMoveDate
    };
};
