/**
 * 시간표 엑셀 가져오기 — 변경 적용 전 자동 스냅샷
 *
 * 안전장치: 적용 직전 영향 받는 enrollment + class 문서의 현재 상태를 백업.
 * 잘못 적용해도 1클릭 복원으로 되돌릴 수 있음.
 *
 * 컬렉션 구조:
 *   timetable_snapshots/{snapshotId}
 *     - metadata (createdAt, createdBy, summary 등)
 *     - enrollments: Record<"{studentId}/{classId}", before-state | null>
 *     - classes: Record<classId, before-state>
 */

import {
    collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy, limit as fbLimit,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COL_SNAPSHOTS = 'timetable_snapshots';
const COL_STUDENTS = 'students';
const COL_CLASSES = 'classes';

export interface SnapshotMetadata {
    id: string;
    createdAt: number;
    createdBy?: string;
    weekLabel: string;
    referenceDate: string;
    subjectFilter: string;
    summary: {
        additions: number;
        removals: number;
        moves: number;
        renames: number;
        colorChanges: number;
    };
}

export interface SnapshotData extends SnapshotMetadata {
    /** key: `"studentId/classId"` → 변경 전 enrollment data. null 이면 없었음 (추가된 enrollment) */
    enrollments: Record<string, any | null>;
    /** key: `classId` → 변경 전 class data (rename/colorChange 영향 받은 것만) */
    classes: Record<string, any>;
}

/**
 * 영향 받는 enrollment + class 의 변경 전 상태 백업.
 * @param affectedPairs - 영향 받는 (studentId, classId) 페어 목록
 * @param affectedClassIds - 영향 받는 classId 목록 (rename/color)
 */
export async function createSnapshot(
    metadata: Omit<SnapshotMetadata, 'id' | 'createdAt'>,
    affectedPairs: Array<{ studentId: string; classId: string }>,
    affectedClassIds: string[],
): Promise<string> {
    const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();

    // 1. enrollment 변경 전 상태 수집
    //    학생별로 그룹화 → 각 학생의 enrollments 서브컬렉션 전체에서 영향받는 classId 매칭 doc 모두 백업
    //    (doc ID = classId 인 경우 + addDoc 자동 ID 인 경우 모두 잡힘)
    //    Key 는 `${studentId}/${actualDocId}` — 실제 doc ID 사용
    const enrollments: Record<string, any | null> = {};
    const studentToClassIds = new Map<string, Set<string>>();
    affectedPairs.forEach(({ studentId, classId }) => {
        if (!studentId || !classId) return;
        const set = studentToClassIds.get(studentId) || new Set<string>();
        set.add(classId);
        studentToClassIds.set(studentId, set);
    });

    await Promise.all(
        Array.from(studentToClassIds.entries()).map(async ([studentId, classIds]) => {
            try {
                const enrCol = collection(db, COL_STUDENTS, studentId, 'enrollments');
                const snap = await getDocs(enrCol);
                const foundClassIds = new Set<string>();
                snap.docs.forEach(d => {
                    const data = d.data();
                    // doc ID 가 classId 든 field classId 매칭이든 모두 백업
                    if (classIds.has(d.id) || (data.classId && classIds.has(data.classId))) {
                        enrollments[`${studentId}/${d.id}`] = data;
                        if (data.classId) foundClassIds.add(data.classId);
                        if (classIds.has(d.id)) foundClassIds.add(d.id);
                    }
                });
                // 영향받는 classId 중 enrollment 가 없는 것 → null 마커 (복원 시 deleteDoc 으로 제거)
                // (새로 추가될 예정의 classId — toClassId 등)
                classIds.forEach(classId => {
                    if (!foundClassIds.has(classId)) {
                        enrollments[`${studentId}/${classId}`] = null;
                    }
                });
            } catch (err) {
                console.warn(`[snapshot] enrollments 읽기 실패: ${studentId}`, err);
            }
        })
    );

    // 2. class 변경 전 상태 수집
    const classes: Record<string, any> = {};
    await Promise.all(
        affectedClassIds.map(async (classId) => {
            if (!classId) return;
            try {
                const ref = doc(db, COL_CLASSES, classId);
                const snap = await getDoc(ref);
                if (snap.exists()) classes[classId] = snap.data();
            } catch (err) {
                console.warn(`[snapshot] class 읽기 실패: ${classId}`, err);
            }
        })
    );

    // 3. 스냅샷 저장 (단일 문서 — 변경 양이 적을 때만 OK, ~1MB 제한 주의)
    const data: SnapshotData = {
        ...metadata,
        id,
        createdAt,
        enrollments,
        classes,
    };
    // Firestore 는 undefined 거부 — 재귀 제거
    const stripUndefined = (obj: any): any => {
        if (obj === null) return null;
        if (Array.isArray(obj)) return obj.map(stripUndefined);
        if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
            const out: any = {};
            for (const [k, v] of Object.entries(obj)) {
                if (v === undefined) continue;
                out[k] = stripUndefined(v);
            }
            return out;
        }
        return obj;
    };
    await setDoc(doc(db, COL_SNAPSHOTS, id), stripUndefined(data));
    return id;
}

/**
 * 스냅샷으로 복원.
 * - enrollments: 백업 데이터로 setDoc (null 이면 deleteDoc — 추가되었던 enrollment 제거)
 * - classes: 백업 데이터로 setDoc (merge)
 */
export async function restoreSnapshot(snapshotId: string): Promise<{
    restoredEnrollments: number;
    deletedEnrollments: number;
    restoredClasses: number;
    errors: string[];
}> {
    const errors: string[] = [];
    let restoredEnrollments = 0;
    let deletedEnrollments = 0;
    let restoredClasses = 0;

    const ref = doc(db, COL_SNAPSHOTS, snapshotId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`스냅샷을 찾을 수 없습니다: ${snapshotId}`);
    const data = snap.data() as SnapshotData;

    // enrollments 복원
    for (const [key, before] of Object.entries(data.enrollments || {})) {
        const [studentId, classId] = key.split('/');
        if (!studentId || !classId) continue;
        try {
            const enrRef = doc(db, COL_STUDENTS, studentId, 'enrollments', classId);
            if (before === null) {
                // 변경 전 없었음 → 추가됐던 enrollment 삭제
                await deleteDoc(enrRef);
                deletedEnrollments++;
            } else {
                await setDoc(enrRef, before);
                restoredEnrollments++;
            }
        } catch (err: any) {
            errors.push(`enrollment ${key} 복원 실패: ${err?.message || err}`);
        }
    }

    // classes 복원
    for (const [classId, before] of Object.entries(data.classes || {})) {
        try {
            await setDoc(doc(db, COL_CLASSES, classId), before, { merge: false });
            restoredClasses++;
        } catch (err: any) {
            errors.push(`class ${classId} 복원 실패: ${err?.message || err}`);
        }
    }

    return { restoredEnrollments, deletedEnrollments, restoredClasses, errors };
}

/** 최근 스냅샷 목록 (createdAt 내림차순) */
export async function listSnapshots(maxItems = 20): Promise<SnapshotMetadata[]> {
    const q = query(collection(db, COL_SNAPSHOTS), orderBy('createdAt', 'desc'), fbLimit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data() as SnapshotData;
        // 본문(enrollments, classes) 은 빼고 메타만
        const { enrollments, classes, ...meta } = data;
        void enrollments; void classes;
        return meta as SnapshotMetadata;
    });
}

/** 스냅샷 삭제 (만료 또는 수동 정리) */
export async function deleteSnapshot(snapshotId: string): Promise<void> {
    await deleteDoc(doc(db, COL_SNAPSHOTS, snapshotId));
}
