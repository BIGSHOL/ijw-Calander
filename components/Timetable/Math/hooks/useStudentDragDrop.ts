import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, getDocs, query, where, collection, writeBatch } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../../../../firebaseConfig';
import { TimetableClass, TimetableStudent } from '../../../../types';
import { formatDateKey } from '../../../../utils/dateUtils';
import { logTimetableChange } from '../../../../hooks/useTimetableLog';
import { syncStudentStatus } from '../../../../utils/studentStatusSync';

// 'common' = 모든 요일 등원, 특정 요일 문자열(예: '월', '목') = 해당 요일만 등원
export type DragZone = 'common' | string;

export interface DraggingStudent {
    studentId: string;
    fromClassId: string;
    fromZone: DragZone;
    /**
     * 퇴원생 여부.
     * - true 면 다른 반으로의 드래그앤드롭 차단 (cross-class restriction).
     * - 같은 반 안에서 재원 섹션으로 이동만 허용 — 복원 의미.
     */
    isWithdrawn?: boolean;
}

export interface PendingMove {
    studentId: string;
    fromClassId: string;
    toClassId: string;
    fromZone: DragZone;
    toZone: DragZone;
    student: TimetableStudent;
    scheduledDate?: string;  // 'YYYY-MM-DD' 예정일 (undefined = 오늘 즉시 이동)
    /**
     * 출발지가 퇴원 섹션이었음을 명시.
     * 같은 반 + 같은 zone(common→common) 으로 되돌아온 것처럼 보이는 dedup 가드를 우회하기 위함.
     * (퇴원생 복원은 zone 동일해도 enrollment split 으로 active 새로 만들어야 함)
     */
    isWithdrawn?: boolean;
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

    const handleDragStart = useCallback((
        e: React.DragEvent,
        studentId: string,
        fromClassId: string,
        fromZone: DragZone = 'common',
        isWithdrawn: boolean = false,
    ) => {
        const dragInfo = { studentId, fromClassId, fromZone, isWithdrawn };
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
        // 퇴원생을 다른 반으로 드롭 시도 → preventDefault 호출 안 함 → 브라우저가 not-allowed 커서 표시 + 드롭 자체 차단
        const dragging = draggingStudentRef.current;
        if (dragging?.isWithdrawn && dragging.fromClassId !== classId) {
            e.dataTransfer.dropEffect = 'none';
            return;
        }
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

        const { studentId, fromClassId, fromZone, isWithdrawn } = currentDragging;

        // 퇴원생은 다른 반으로 이동 불가 — 같은 반 내에서만 재원 섹션으로 복원 가능
        // (handleDragOver 에서 1차 차단되지만 안전망)
        if (isWithdrawn && fromClassId !== toClassId) {
            alert('다른 반으로 보내려면 먼저 해당 반에서 재원으로 복원한 뒤 이동하세요.');
            draggingStudentRef.current = null;
            setDraggingStudent(null);
            return;
        }

        // 같은 반 + 같은 zone → 무시 (활성 학생 한정)
        // 퇴원생은 zone 동일해도 복원 필요 → isWithdrawn 면 통과
        if (fromClassId === toClassId && fromZone === toZone && !isWithdrawn) {
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
                student: { id: studentId } as TimetableStudent,
                isWithdrawn,
            }]);
            draggingStudentRef.current = null;
            setDraggingStudent(null);
            return;
        }

        // ===== 다른 반으로 이동 (기존 로직 + attendanceDays 반영) =====
        const newAttendanceDays = toZone === 'common' ? [] : [toZone];
        const todayKey = formatDateKey(new Date());

        // 검증과 업데이트를 prev 기반으로 수행 (ref stale 방지).
        // 연속 이동(A→B→C)에서 첫 setLocalClasses 커밋 전에 두 번째 드롭이 들어오면
        // localClassesRef가 stale → moving=undefined → studentList 누락되는 버그 방지.
        let dropApplied = false;
        setLocalClasses(prev => {
            const fromCls = prev.find(c => c.id === fromClassId);
            const toCls = prev.find(c => c.id === toClassId);
            if (!fromCls || !toCls) return prev;

            const moving = fromCls.studentList?.find(s => s.id === studentId);
            if (!fromCls.studentIds?.includes(studentId) && !moving) return prev;

            dropApplied = true;
            return prev.map(cls => {
                if (cls.id === fromClassId) {
                    // 이전 위치: 학생 제거하지 않고 유지 (취소선으로 표시됨)
                    return cls;
                }
                if (cls.id === toClassId) {
                    const newIds = [...(cls.studentIds || [])];
                    if (!newIds.includes(studentId)) {
                        newIds.push(studentId);
                    }
                    const newStudentList = [...(cls.studentList || [])];
                    if (!newStudentList.some(s => s.id === studentId)) {
                        // 반이동 시 대기/배정예정 상태는 해제 + enrollmentDate를 오늘로 갱신 →
                        // 도착지의 미래 입학일 필터를 통과하여 재원생 섹션에 표시(보라 하이라이트).
                        // moving 없을 때도 최소 객체로 push (도착지 학생명/하이라이트 보장).
                        newStudentList.push(
                            moving
                                ? { ...moving, attendanceDays: newAttendanceDays, onHold: false, isScheduled: false, enrollmentDate: todayKey }
                                : { id: studentId, attendanceDays: newAttendanceDays, enrollmentDate: todayKey } as TimetableStudent
                        );
                    }
                    return { ...cls, studentIds: newIds, studentList: newStudentList };
                }
                return cls;
            });
        });

        if (dropApplied) {
            setPendingMoves(prev => [...prev, {
                studentId,
                fromClassId,
                toClassId,
                fromZone,
                toZone,
                student: { id: studentId } as TimetableStudent
            }]);
        }
        draggingStudentRef.current = null;
        setDraggingStudent(null);
    }, []);

    const handleSavePendingMoves = async () => {
        if (pendingMoves.length === 0) return;
        setIsSaving(true);

        try {
            // 같은 학생의 여러 이동을 최종 결과로 압축
            // A→B, B→C 이동이 있으면 최종적으로 A→C만 처리
            const finalMoves = new Map<string, { fromClassId: string; toClassId: string; fromZone: DragZone; toZone: DragZone; scheduledDate?: string; isWithdrawn?: boolean }>();
            pendingMoves.forEach(move => {
                const existing = finalMoves.get(move.studentId);
                if (existing) {
                    // 이미 이동 기록이 있으면 최초 출발지 유지, 목적지만 갱신
                    existing.toClassId = move.toClassId;
                    existing.toZone = move.toZone;
                    existing.scheduledDate = move.scheduledDate;
                    // 출발이 한 번이라도 퇴원이면 복원 처리 보존
                    if (move.isWithdrawn) existing.isWithdrawn = true;
                } else {
                    finalMoves.set(move.studentId, {
                        fromClassId: move.fromClassId,
                        toClassId: move.toClassId,
                        fromZone: move.fromZone,
                        toZone: move.toZone,
                        scheduledDate: move.scheduledDate,
                        isWithdrawn: move.isWithdrawn,
                    });
                }
            });

            // 같은 반 + 같은 zone으로 되돌아온 경우 제거 (A→B→A, 월만→목만→월만)
            // 단, 퇴원생 복원(common→common 등) 은 zone 동일해도 처리 필요 → 예외
            for (const [studentId, move] of finalMoves) {
                if (move.fromClassId === move.toClassId && move.fromZone === move.toZone && !move.isWithdrawn) {
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
                    // ===== zone만 변경 (같은 반): enrollment 분리 (소급 변경 방지) =====
                    // 기존 enrollment 종료 + 새 enrollment 생성하여 과거 주차 데이터 보존
                    const cls = localClasses.find(c => c.id === move.fromClassId);
                    if (!cls) continue;

                    const docId = await getEnrollmentDocId(studentId, move.fromClassId, cls.className);
                    const enrollmentRef = doc(db, 'students', studentId, 'enrollments', docId);
                    const existingData = enrollmentDataMap.get(`${studentId}_${move.fromClassId}`);

                    // 기존 attendanceDays와 비교하여 변경 없으면 스킵
                    const existingDays = existingData?.attendanceDays || [];
                    const sortedExisting = [...existingDays].sort();
                    const sortedNew = [...newAttendanceDays].sort();
                    const isChanged = sortedExisting.length !== sortedNew.length ||
                        sortedExisting.some((d: string, i: number) => d !== sortedNew[i]);

                    // 퇴원생 복원은 attendanceDays 동일해도 진행해야 함
                    //  - 퇴원: endDate/withdrawalDate 존재 → 같은 반 common 으로 드래그 시 newDays=[]==existingDays=[] → 'unchanged' 로 잘못 스킵됨
                    //  - 이 경우엔 enrollment 분리(아래 split)로 진행해야 새 enrollment 가 active 로 생성됨
                    const isWithdrawnEnrollment = !!(existingData?.endDate || existingData?.withdrawalDate);
                    if (!isChanged && !isWithdrawnEnrollment) continue;

                    // 예정일이 있으면 해당 날짜 사용, 없으면 오늘
                    const effectiveDate = move.scheduledDate || defaultToday;

                    // enrollment 분리: 기존 종료 + 새 생성
                    const yesterday = (() => {
                        const d = new Date(effectiveDate);
                        d.setDate(d.getDate() - 1);
                        return formatDateKey(d);
                    })();

                    // 1. 기존 enrollment에 endDate 설정 (변경일 전날로)
                    batch.set(enrollmentRef, {
                        endDate: yesterday,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });

                    // 2. 새 enrollment 생성 (변경일부터, 새 attendanceDays 적용)
                    const newDocId = `${move.fromClassId}_${Date.now()}_${studentId.substring(0, 4)}`;
                    const newEnrollmentRef = doc(db, 'students', studentId, 'enrollments', newDocId);

                    if (existingData) {
                        const { endDate, withdrawalDate, isTransferred, ...preservedData } = existingData;
                        batch.set(newEnrollmentRef, {
                            ...preservedData,
                            attendanceDays: newAttendanceDays,
                            startDate: effectiveDate,
                            enrollmentDate: preservedData.enrollmentDate || effectiveDate,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    } else {
                        batch.set(newEnrollmentRef, {
                            classId: move.fromClassId,
                            className: cls.className,
                            subject: cls.subject === '고등수학' ? 'highmath' : 'math',
                            teacher: cls.teacher || '',
                            staffId: cls.teacher || '',
                            schedule: cls.schedule || [],
                            attendanceDays: newAttendanceDays,
                            startDate: effectiveDate,
                            enrollmentDate: effectiveDate,
                            createdAt: new Date().toISOString()
                        });
                    }
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
                            const _ydDrag = new Date(effectiveDate);
                            _ydDrag.setDate(_ydDrag.getDate() - 1);
                            const dragYesterday = formatDateKey(_ydDrag);
                            batch.set(oldEnrollmentRef, {
                                endDate: dragYesterday,
                                withdrawalDate: dragYesterday,
                                isTransferred: true,
                                updatedAt: new Date().toISOString()
                            }, { merge: true });
                        }

                        // 새 enrollment 생성 (attendanceDays 포함, isTransferred는 제거 - 실시간 계산으로 판단)
                        // 반이동 시 onHold/isScheduled도 제거 — 도착지는 재원생으로 시작 (대기 → 재원 승격 등)
                        if (existingData) {
                            const { endDate, withdrawalDate, isTransferred, onHold, isScheduled, ...preservedData } = existingData;
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
                                // 이동 시 시작일은 이동일(오늘)로 설정
                                enrollmentDate: effectiveDate,
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

            // 학생 status 동기화 — enrollment 만 바꾸고 student.status 가 그대로면
            // 퇴원생을 재학생으로 복원해도 student 본인은 여전히 'withdrawn' 으로 남아
            // 퇴원 드롭존/학생 리스트 등에서 비활성으로 취급됨.
            // syncStudentStatus 가 활성 enrollment 존재 시 'active' 로 자동 복구함.
            await Promise.all(
                Array.from(finalMoves.keys()).map(sid =>
                    syncStudentStatus(sid).catch(err => console.error('[syncStudentStatus]', sid, err))
                )
            );

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

        const newAttendanceDays = toZone === 'common' ? [] : [toZone];
        const todayKey = formatDateKey(new Date());

        // 검증/업데이트를 prev 기반으로 (ref stale 방지). 연속 이동 시 누락되던 버그 대응.
        let appliedIds: string[] = [];
        setLocalClasses(prev => {
            const fromCls = prev.find(c => c.id === fromClassId);
            const toCls = prev.find(c => c.id === toClassId);
            if (!fromCls || !toCls) return prev;

            // 출발지에 존재하는 학생만 이동 (studentList 또는 studentIds 기준)
            const validIds = studentIds.filter(sid =>
                fromCls.studentList?.some(s => s.id === sid) ||
                fromCls.studentIds?.includes(sid)
            );
            if (validIds.length === 0) return prev;

            appliedIds = validIds;

            return prev.map(cls => {
                if (cls.id === fromClassId) {
                    // 출발지: 학생 유지 (취소선 표시용)
                    return cls;
                }
                if (cls.id === toClassId) {
                    const newIds = [...(cls.studentIds || [])];
                    const newStudentList = [...(cls.studentList || [])];
                    validIds.forEach(sid => {
                        if (!newIds.includes(sid)) newIds.push(sid);
                        if (!newStudentList.some((s: any) => s.id === sid)) {
                            const moving = fromCls.studentList?.find(s => s.id === sid);
                            // 반이동 시 대기/배정예정 해제 + enrollmentDate를 오늘로 → 도착지 재원생 섹션 표시
                            newStudentList.push(
                                moving
                                    ? { ...moving, attendanceDays: newAttendanceDays, onHold: false, isScheduled: false, enrollmentDate: todayKey }
                                    : { id: sid, attendanceDays: newAttendanceDays, enrollmentDate: todayKey } as TimetableStudent
                            );
                        }
                    });
                    return { ...cls, studentIds: newIds, studentList: newStudentList };
                }
                return cls;
            });
        });

        if (appliedIds.length > 0) {
            setPendingMoves(prev => [
                ...prev,
                ...appliedIds.map(sid => ({
                    studentId: sid,
                    fromClassId,
                    toClassId,
                    fromZone: 'common' as DragZone,
                    toZone,
                    student: { id: sid } as TimetableStudent
                }))
            ]);
        }

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
