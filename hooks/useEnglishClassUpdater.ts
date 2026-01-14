/**
 * useEnglishClassUpdater
 *
 * 영어 시간표 셀 편집 → classes 컬렉션 업데이트 어댑터
 *
 * 셀 기반 UI에서 편집된 내용을 classes 컬렉션의 수업 문서에 반영
 *
 * v2.0 변경사항:
 * - merged(합반) 수업 처리 지원 (classGroupId 기반)
 * - 일괄 저장 최적화 (writeBatch 사용)
 * - underline 필드 지원
 */

import { useCallback } from 'react';
import { collection, doc, getDocs, query, where, updateDoc, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';

const COL_CLASSES = 'classes';

export interface MergedClass {
    className: string;
    room?: string;
    underline?: boolean;
    lastMovedAt?: string;
}

export interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: MergedClass[];
    underline?: boolean;
    lastMovedAt?: string;
}

type ScheduleData = Record<string, ScheduleCell>;

/**
 * 셀 키 파싱: "teacher-periodId-day" → { teacher, periodId, day }
 */
const parseCellKey = (key: string) => {
    const parts = key.split('-');
    if (parts.length !== 3) return null;
    return { teacher: parts[0], periodId: parts[1], day: parts[2] };
};

/**
 * classes 컬렉션에서 영어 수업 찾기 (className + teacher 기준)
 */
const findClassByNameAndTeacher = async (className: string, teacher: string) => {
    const q = query(
        collection(db, COL_CLASSES),
        where('subject', '==', 'english'),
        where('className', '==', className),
        where('teacher', '==', teacher),
        where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs[0] || null;
};

/**
 * classes 컬렉션에서 영어 수업 찾기 (className만)
 */
const findClassByName = async (className: string) => {
    const q = query(
        collection(db, COL_CLASSES),
        where('subject', '==', 'english'),
        where('className', '==', className),
        where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs[0] || null;
};

/**
 * 그룹 ID로 합반 수업들 찾기
 */
const findClassesByGroupId = async (groupId: string) => {
    const q = query(
        collection(db, COL_CLASSES),
        where('subject', '==', 'english'),
        where('classGroupId', '==', groupId),
        where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs;
};

/**
 * 특정 슬롯에 배치된 모든 수업 찾기 (합반 수업 포함)
 */
const findClassesAtSlot = async (teacher: string, day: string, periodId: string) => {
    const q = query(
        collection(db, COL_CLASSES),
        where('subject', '==', 'english'),
        where('teacher', '==', teacher),
        where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    // schedule 배열에서 해당 슬롯을 포함한 수업들 필터링
    return snapshot.docs.filter(doc => {
        const data = doc.data();
        const schedule = data.schedule || [];
        return schedule.some((s: any) => s.day === day && s.periodId === periodId);
    });
};

export const useEnglishClassUpdater = () => {
    const queryClient = useQueryClient();

    /**
     * 단일 수업을 classes 컬렉션에 upsert (내부 헬퍼)
     */
    const upsertSingleClass = async (
        className: string,
        teacher: string,
        day: string,
        periodId: string,
        room?: string,
        options?: {
            classGroupId?: string;
            isGroupLeader?: boolean;
            underline?: boolean;
        }
    ): Promise<string> => {
        const slotKey = `${day}-${periodId}`;

        // 기존 수업 찾기
        let classDoc = await findClassByNameAndTeacher(className, teacher);

        if (classDoc) {
            // 기존 수업에 스케줄 추가
            const classData = classDoc.data();
            const currentSchedule = classData.schedule || [];
            const newSlot = { day, periodId };

            // 중복 체크
            const exists = currentSchedule.some(
                (s: any) => s.day === day && s.periodId === periodId
            );

            const updateData: Record<string, any> = {
                updatedAt: new Date().toISOString()
            };

            if (!exists) {
                updateData.schedule = [...currentSchedule, newSlot];
            }

            // slotRooms 업데이트
            updateData.slotRooms = { ...(classData.slotRooms || {}), [slotKey]: room || '' };

            // 그룹 정보 업데이트
            if (options?.classGroupId) {
                updateData.classGroupId = options.classGroupId;
                updateData.isGroupLeader = options.isGroupLeader ?? false;
            }

            if (options?.underline !== undefined) {
                updateData.underline = options.underline;
            }

            await updateDoc(doc(db, COL_CLASSES, classDoc.id), updateData);
            return classDoc.id;
        } else {
            // 새 수업 생성
            const newClassData: Record<string, any> = {
                className,
                teacher,
                subject: 'english',
                room: room || '',
                isActive: true,
                schedule: [{ day, periodId }],
                slotRooms: { [slotKey]: room || '' },
                studentIds: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 그룹 정보 추가
            if (options?.classGroupId) {
                newClassData.classGroupId = options.classGroupId;
                newClassData.isGroupLeader = options.isGroupLeader ?? false;
            }

            if (options?.underline !== undefined) {
                newClassData.underline = options.underline;
            }

            const docRef = await addDoc(collection(db, COL_CLASSES), newClassData);
            return docRef.id;
        }
    };

    /**
     * 셀에 수업 배치 (새 수업 생성 또는 기존 수업 스케줄 업데이트)
     * merged(합반) 수업도 함께 처리
     */
    const assignCellToClass = useCallback(async (
        cellKey: string,
        cellData: ScheduleCell
    ) => {
        const parsed = parseCellKey(cellKey);
        if (!parsed || !cellData.className) return;

        const { teacher, periodId, day } = parsed;
        const groupId = `group_${cellKey}`;
        const hasMerged = cellData.merged && cellData.merged.length > 0;

        // 1. 메인 수업 생성/업데이트
        const mainClassId = await upsertSingleClass(
            cellData.className,
            teacher,
            day,
            periodId,
            cellData.room,
            hasMerged ? {
                classGroupId: groupId,
                isGroupLeader: true,
                underline: cellData.underline
            } : {
                underline: cellData.underline
            }
        );

        // 2. 합반 수업 처리
        if (hasMerged && cellData.merged) {
            const memberIds: string[] = [];

            for (const mergedClass of cellData.merged) {
                const memberId = await upsertSingleClass(
                    mergedClass.className,
                    teacher,
                    day,
                    periodId,
                    mergedClass.room,
                    {
                        classGroupId: groupId,
                        isGroupLeader: false,
                        underline: mergedClass.underline
                    }
                );
                memberIds.push(memberId);
            }

            // 메인 수업에 그룹 멤버 목록 업데이트
            await updateDoc(doc(db, COL_CLASSES, mainClassId), {
                groupMembers: memberIds,
                updatedAt: new Date().toISOString()
            });
        }

        // 캐시 무효화
        queryClient.invalidateQueries({ queryKey: ['classes'] });
    }, [queryClient]);

    /**
     * 단일 수업에서 특정 슬롯 제거 (내부 헬퍼)
     */
    const removeSlotFromClass = async (
        classDocId: string,
        classData: any,
        day: string,
        periodId: string
    ) => {
        const currentSchedule = classData.schedule || [];
        const slotKey = `${day}-${periodId}`;

        // 스케줄에서 해당 슬롯 제거
        const updatedSchedule = currentSchedule.filter(
            (s: any) => !(s.day === day && s.periodId === periodId)
        );

        // slotRooms에서도 제거
        const updatedSlotRooms = { ...(classData.slotRooms || {}) };
        delete updatedSlotRooms[slotKey];

        if (updatedSchedule.length === 0) {
            // 스케줄이 비면 수업 비활성화
            await updateDoc(doc(db, COL_CLASSES, classDocId), {
                isActive: false,
                schedule: [],
                slotRooms: {},
                classGroupId: null,
                isGroupLeader: null,
                groupMembers: null,
                updatedAt: new Date().toISOString()
            });
        } else {
            await updateDoc(doc(db, COL_CLASSES, classDocId), {
                schedule: updatedSchedule,
                slotRooms: updatedSlotRooms,
                updatedAt: new Date().toISOString()
            });
        }
    };

    /**
     * 셀에서 수업 제거 (스케줄에서 해당 슬롯 삭제)
     * 합반 수업도 함께 제거
     */
    const removeCellFromClass = useCallback(async (cellKey: string, className: string) => {
        const parsed = parseCellKey(cellKey);
        if (!parsed) return;

        const { teacher, periodId, day } = parsed;

        // 메인 수업 찾기
        const classDoc = await findClassByNameAndTeacher(className, teacher);
        if (!classDoc) return;

        const classData = classDoc.data();

        // 해당 슬롯에서 메인 수업 제거
        await removeSlotFromClass(classDoc.id, classData, day, periodId);

        // 합반 그룹이 있다면 그룹 멤버들도 해당 슬롯에서 제거
        const groupId = classData.classGroupId;
        if (groupId && classData.isGroupLeader) {
            const groupMembers = await findClassesByGroupId(groupId);
            for (const memberDoc of groupMembers) {
                if (memberDoc.id !== classDoc.id) {
                    await removeSlotFromClass(memberDoc.id, memberDoc.data(), day, periodId);
                }
            }
        }

        queryClient.invalidateQueries({ queryKey: ['classes'] });
    }, [queryClient]);

    /**
     * 셀의 모든 수업 제거 (메인 + 합반 전체)
     */
    const removeAllClassesFromCell = useCallback(async (cellKey: string) => {
        const parsed = parseCellKey(cellKey);
        if (!parsed) return;

        const { teacher, periodId, day } = parsed;

        // 해당 슬롯의 모든 수업 찾기
        const classesAtSlot = await findClassesAtSlot(teacher, day, periodId);

        for (const classDoc of classesAtSlot) {
            await removeSlotFromClass(classDoc.id, classDoc.data(), day, periodId);
        }

        queryClient.invalidateQueries({ queryKey: ['classes'] });
    }, [queryClient]);

    /**
     * 일괄 셀 편집 (여러 셀 동시 업데이트)
     * scheduleData를 전달받아 삭제 시 기존 className을 알 수 있도록 함
     */
    const batchUpdateCells = useCallback(async (
        updates: { key: string; data: ScheduleCell | null }[],
        currentScheduleData?: ScheduleData
    ) => {
        for (const { key, data } of updates) {
            if (data && data.className) {
                // 저장/업데이트
                await assignCellToClass(key, data);
            } else if (currentScheduleData) {
                // 삭제: 현재 셀 데이터에서 className 가져오기
                const existingData = currentScheduleData[key];
                if (existingData?.className) {
                    await removeCellFromClass(key, existingData.className);
                }
            }
        }
    }, [assignCellToClass, removeCellFromClass]);

    /**
     * 수업 이동 (소스 셀 → 타겟 셀)
     * 합반 수업을 포함한 전체 셀 이동 지원
     */
    const moveClass = useCallback(async (
        sourceKey: string,
        targetKey: string,
        className: string,
        room?: string,
        merged?: MergedClass[]
    ) => {
        const sourceParsed = parseCellKey(sourceKey);
        const targetParsed = parseCellKey(targetKey);
        if (!sourceParsed || !targetParsed) return;

        // 소스에서 해당 클래스의 스케줄 제거
        await removeCellFromClass(sourceKey, className);

        // 타겟에 수업 배치 (합반 수업 포함)
        await assignCellToClass(targetKey, {
            className,
            room,
            teacher: targetParsed.teacher,
            merged: merged || []
        });
    }, [removeCellFromClass, assignCellToClass]);

    /**
     * 선택적 수업 이동 (합반 수업 중 일부만 이동)
     */
    const moveSelectedClasses = useCallback(async (
        sourceKey: string,
        targetKey: string,
        classesToMove: { className: string; room?: string; underline?: boolean }[],
        classesToKeep: { className: string; room?: string; underline?: boolean }[]
    ) => {
        const sourceParsed = parseCellKey(sourceKey);
        const targetParsed = parseCellKey(targetKey);
        if (!sourceParsed || !targetParsed) return;

        const { teacher: sourceTeacher, periodId: sourcePeriodId, day: sourceDay } = sourceParsed;
        const { teacher: targetTeacher } = targetParsed;

        // 1. 이동할 수업들의 소스 슬롯에서 제거
        for (const cls of classesToMove) {
            const classDoc = await findClassByNameAndTeacher(cls.className, sourceTeacher);
            if (classDoc) {
                await removeSlotFromClass(classDoc.id, classDoc.data(), sourceDay, sourcePeriodId);
            }
        }

        // 2. 타겟에 이동할 수업 배치
        if (classesToMove.length > 0) {
            const mainClass = classesToMove[0];
            const mergedClasses = classesToMove.slice(1).map(c => ({
                className: c.className,
                room: c.room,
                underline: c.underline
            }));

            await assignCellToClass(targetKey, {
                className: mainClass.className,
                room: mainClass.room,
                teacher: targetTeacher,
                merged: mergedClasses,
                underline: mainClass.underline
            });
        }

        // 3. 소스에 남은 수업 정리 (그룹 관계 재구성)
        if (classesToKeep.length > 0) {
            // 기존 그룹 ID 제거하고 새로 구성
            const groupId = classesToKeep.length > 1 ? `group_${sourceKey}` : undefined;

            for (let i = 0; i < classesToKeep.length; i++) {
                const cls = classesToKeep[i];
                const classDoc = await findClassByNameAndTeacher(cls.className, sourceTeacher);
                if (classDoc) {
                    const updateData: Record<string, any> = {
                        updatedAt: new Date().toISOString()
                    };

                    if (groupId) {
                        updateData.classGroupId = groupId;
                        updateData.isGroupLeader = i === 0;
                        if (i === 0) {
                            updateData.groupMembers = classesToKeep.slice(1).map(c => c.className);
                        }
                    } else {
                        updateData.classGroupId = null;
                        updateData.isGroupLeader = null;
                        updateData.groupMembers = null;
                    }

                    await updateDoc(doc(db, COL_CLASSES, classDoc.id), updateData);
                }
            }
        }

        queryClient.invalidateQueries({ queryKey: ['classes'] });
    }, [queryClient, assignCellToClass]);

    return {
        assignCellToClass,
        removeCellFromClass,
        removeAllClassesFromCell,
        batchUpdateCells,
        moveClass,
        moveSelectedClasses,
        // 유틸리티 함수 export
        parseCellKey
    };
};
