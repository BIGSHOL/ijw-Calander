import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, getDocs, query, where, collection, writeBatch } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../../../../firebaseConfig';
import { TimetableClass, TimetableStudent } from '../../../../types';
import { formatDateKey } from '../../../../utils/dateUtils';
import { logTimetableChange } from '../../../../hooks/useTimetableLog';

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
        e.dataTransfer.setData('studentId', studentId);  // 퇴원 드롭존 등 외부 핸들러용

        // 커스텀 드래그 고스트: 학생 이름 표시
        const target = e.currentTarget as HTMLElement;
        const studentName = target?.textContent?.trim().split('/')[0]?.trim() || '';
        if (studentName) {
            const ghost = document.createElement('div');
            ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;background:#3b82f6;color:#fff;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.3);white-space:nowrap;z-index:99999;pointer-events:none;';
            ghost.textContent = `${studentName} 이동`;
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 10, 10);
            requestAnimationFrame(() => document.body.removeChild(ghost));
        }
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

        // 테두리 드래그: multiStudentIds 체크 (여러 명 동시 이동)
        const multiIdsJson = e.dataTransfer.getData('multiStudentIds');

        if (multiIdsJson) {
            try {
                const multiIds = JSON.parse(multiIdsJson) as string[];
                const fromClassId = e.dataTransfer.getData('fromClassId');
                const isSameClass = fromClassId === toClassId;

                if (multiIds.length > 0 && fromClassId) {
                    if (isSameClass) {
                        // ===== 같은 반 내 zone 이동 (여러 명의 attendanceDays 변경) =====
                        const newAttendanceDays = toZone === 'common' ? [] : [toZone];

                        // localClassesRef.current 사용 (항상 최신 데이터 보장)
                        const snapshot = localClassesRef.current;
                        setLocalClasses(snapshot.map(cls => {
                            if (cls.id !== fromClassId) return cls;
                            const newStudentList = (cls.studentList || []).map(s => {
                                if (multiIds.includes(s.id)) {
                                    return { ...s, attendanceDays: newAttendanceDays };
                                }
                                return s;
                            });
                            return { ...cls, studentList: newStudentList };
                        }));

                        // 각 학생에 대한 pending move 추가
                        setPendingMoves(prev => [
                            ...prev,
                            ...multiIds.map(sid => ({
                                studentId: sid,
                                fromClassId,
                                toClassId,
                                fromZone: 'common', // 멀티 드래그는 zone 정보 없음
                                toZone,
                                student: { id: sid } as TimetableStudent
                            }))
                        ]);
                    } else {
                        // ===== 다른 반으로 이동 (여러 명) =====
                        handleMultiDrop(multiIds, fromClassId, toClassId, toZone);
                    }
                }
            } catch (err) {
                console.error('[handleDrop] multiStudentIds parsing error:', err);
            }
            return;
        }

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

            // localClassesRef.current 사용 (항상 최신 데이터 보장)
            const snapshot = localClassesRef.current;
            setLocalClasses(snapshot.map(cls => {
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

            // 실제 enrollment 문서 ID 조회 헬퍼 (비동기: 맵에 없으면 className으로 쿼리)
            const getEnrollmentDocId = async (studentId: string, classId: string, className: string): Promise<string> => {
                const cached = enrollmentDocIdMap.get(`${studentId}_${classId}`);
                if (cached) return cached;
                // classId로 직접 조회
                const directRef = doc(db, 'students', studentId, 'enrollments', classId);
                const directSnap = await getDoc(directRef);
                if (directSnap.exists()) return classId;
                // className으로 쿼리 fallback
                const q = query(collection(db, 'students', studentId, 'enrollments'), where('className', '==', className));
                const qSnap = await getDocs(q);
                const activeDoc = qSnap.docs.find(d => !d.data().endDate && !d.data().withdrawalDate);
                if (activeDoc) return activeDoc.id;
                return classId; // 최종 fallback: classId 사용
            };

            // 기존 enrollment 데이터 읽기 (실제 문서 ID 사용)
            const enrollmentDataMap = new Map<string, Record<string, any>>();
            await Promise.all(
                Array.from(finalMoves.entries()).map(async ([studentId, move]) => {
                    const fromClass = localClasses.find(c => c.id === move.fromClassId);
                    if (!fromClass) return;

                    const docId = await getEnrollmentDocId(studentId, move.fromClassId, fromClass.className);
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

                    const docId = await getEnrollmentDocId(studentId, move.fromClassId, cls.className);
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
                        const oldDocId = await getEnrollmentDocId(studentId, move.fromClassId, fromClass.className);
                        const oldEnrollmentRef = doc(db, 'students', studentId, 'enrollments', oldDocId);
                        const newEnrollmentRef = doc(db, 'students', studentId, 'enrollments', move.toClassId);

                        const existingData = enrollmentDataMap.get(`${studentId}_${move.fromClassId}`);
                        // 예정일이 있으면 해당 날짜 사용, 없으면 오늘
                        const effectiveDate = move.scheduledDate || defaultToday;

                        // 기존 enrollment 종료 처리 (문서가 존재하는 경우에만)
                        // batch.update 대신 batch.set({ merge: true })를 사용하여 문서 없을 때도 안전
                        if (existingData) {
                            batch.set(oldEnrollmentRef, {
                                endDate: effectiveDate,
                                withdrawalDate: effectiveDate,
                                isTransferred: true,
                                updatedAt: new Date().toISOString()
                            }, { merge: true });
                        }

                        // 새 enrollment 생성 (attendanceDays 포함, isTransferred는 제거 - 실시간 계산으로 판단)
                        if (existingData) {
                            const { endDate, withdrawalDate, isTransferred, ...preservedData } = existingData;
                            batch.set(newEnrollmentRef, {
                                ...preservedData,
                                classId: move.toClassId,
                                className: toClass.className,
                                // 새 반의 담임/부담임/스케줄로 덮어쓰기
                                teacher: toClass.teacher || '',
                                staffId: toClass.teacher || '',
                                schedule: toClass.schedule || [],
                                isSlotTeacher: false, // 부담임 여부는 새 반에서 재설정 필요
                                attendanceDays: newAttendanceDays,
                                // 예정이동: 이동일을 시작일로 설정 → 대기섹션 배치, 이동일 도래 시 초록배경으로 활성화
                                // 즉시이동: 원래 입학일 보존
                                enrollmentDate: move.scheduledDate ? effectiveDate : (preservedData.enrollmentDate || effectiveDate),
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            });
                        } else {
                            batch.set(newEnrollmentRef, {
                                classId: move.toClassId,
                                className: toClass.className,
                                subject: toClass.subject === '고등수학' ? 'highmath' : 'math',
                                teacher: toClass.teacher || '',
                                staffId: toClass.teacher || '',
                                schedule: toClass.schedule || [],
                                attendanceDays: newAttendanceDays,
                                enrollmentDate: effectiveDate,
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                }
            }

            await batch.commit();

            // 로그 기록: 각 학생 이동 기록
            for (const [studentId, move] of finalMoves) {
                const isSameClass = move.fromClassId === move.toClassId;
                const fromClass = localClasses.find(c => c.id === move.fromClassId);
                const toClass = localClasses.find(c => c.id === move.toClassId);

                if (isSameClass) {
                    // zone만 변경 (같은 반 내 월목반 -> 월만 등)
                    const fromZoneLabel = move.fromZone === 'common' ? '모든 요일' : `${move.fromZone}만`;
                    const toZoneLabel = move.toZone === 'common' ? '모든 요일' : `${move.toZone}만`;
                    logTimetableChange({
                        action: 'student_move',
                        subject: fromClass?.subject === '고등수학' ? 'highmath' : 'math',
                        className: fromClass?.className || move.fromClassId,
                        studentId,
                        studentName: studentId,
                        details: `학생 등원일 변경: ${fromClass?.className || ''} (${fromZoneLabel} → ${toZoneLabel})`,
                        before: { zone: fromZoneLabel },
                        after: { zone: toZoneLabel }
                    });
                } else if (fromClass && toClass) {
                    // 반 이동
                    const toZoneLabel = move.toZone === 'common' ? '' : ` (${move.toZone}만)`;
                    logTimetableChange({
                        action: 'student_move',
                        subject: toClass.subject === '고등수학' ? 'highmath' : 'math',
                        className: toClass.className,
                        studentId,
                        studentName: studentId,
                        details: `학생 이동: ${fromClass.className} → ${toClass.className}${toZoneLabel}${move.scheduledDate ? ` (예정: ${move.scheduledDate})` : ''}`,
                        before: { className: fromClass.className },
                        after: { className: toClass.className, attendanceDays: move.toZone === 'common' ? [] : [move.toZone] }
                    });
                }
            }

            // React Query 캐시 무효화 - 실시간 반영
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });

            setPendingMoves([]);
        } catch (e) {
            console.error(e);
            alert('저장 실패');
        } finally {
            setIsSaving(false);
        }
    };

    // 멀티 학생 드롭 (엑셀 모드: 여러 학생을 한 번에 다른 반으로 이동)
    const handleMultiDrop = useCallback((studentIds: string[], fromClassId: string, toClassId: string, toZone: DragZone = 'common') => {
        if (fromClassId === toClassId) return;

        const currentLocalClasses = localClassesRef.current;
        const fromClass = currentLocalClasses.find(c => c.id === fromClassId);
        const toClass = currentLocalClasses.find(c => c.id === toClassId);
        if (!fromClass || !toClass) return;

        const newAttendanceDays = toZone === 'common' ? [] : [toZone];

        // 이동할 학생들 필터링
        const movingStudents = studentIds
            .map(sid => fromClass.studentList?.find(s => s.id === sid))
            .filter(Boolean) as any[];
        if (movingStudents.length === 0) return;

        // Optimistic UI 업데이트
        setLocalClasses(prev => prev.map(cls => {
            if (cls.id === fromClassId) {
                const newIds = (cls.studentIds || []).filter(id => !studentIds.includes(id));
                const newStudentList = (cls.studentList || []).filter(s => !studentIds.includes(s.id));
                return { ...cls, studentIds: newIds, studentList: newStudentList };
            }
            if (cls.id === toClassId) {
                const newIds = [...(cls.studentIds || [])];
                const newStudentList = [...(cls.studentList || [])];
                movingStudents.forEach(ms => {
                    if (!newIds.includes(ms.id)) newIds.push(ms.id);
                    if (!newStudentList.some((s: any) => s.id === ms.id)) {
                        newStudentList.push({ ...ms, attendanceDays: newAttendanceDays });
                    }
                });
                return { ...cls, studentIds: newIds, studentList: newStudentList };
            }
            return cls;
        }));

        // 각 학생에 대해 pendingMove 추가
        setPendingMoves(prev => [
            ...prev,
            ...movingStudents.map(ms => ({
                studentId: ms.id,
                fromClassId,
                toClassId,
                fromZone: 'common' as DragZone,
                toZone,
                student: { id: ms.id } as TimetableStudent
            }))
        ]);

        setDragOverClassId(null);
    }, []);

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

    // 마지막 이동 취소 (Ctrl+Z용)
    const undoLastMove = useCallback(() => {
        if (pendingMoves.length === 0) return null;
        const lastMove = pendingMoves[pendingMoves.length - 1];

        setLocalClasses(prev => prev.map(cls => {
            let students = [...(cls.studentList || [])];
            let ids = [...(cls.studentIds || [])];

            // 타겟 클래스에서 제거
            if (cls.id === lastMove.toClassId) {
                students = students.filter(s => s.id !== lastMove.studentId);
                ids = ids.filter(id => id !== lastMove.studentId);
            }
            // 소스 클래스에 복원
            if (cls.id === lastMove.fromClassId) {
                if (!students.find(s => s.id === lastMove.studentId)) {
                    students.push(lastMove.student);
                }
                if (!ids.includes(lastMove.studentId)) {
                    ids.push(lastMove.studentId);
                }
            }
            return { ...cls, studentList: students, studentIds: ids };
        }));

        setPendingMoves(prev => prev.slice(0, -1));
        return lastMove;
    }, [pendingMoves]);

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
        handleMultiDrop,
        handleSavePendingMoves,
        handleCancelPendingMoves,
        updatePendingMoveDate,
        undoLastMove
    };
};
