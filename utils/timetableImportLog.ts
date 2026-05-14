/**
 * 시간표 엑셀 가져오기 변경 이력 로그 (timetable_import_logs)
 *
 * 누가, 언제, 무엇을 적용했는지 기록.
 * 스냅샷 ID 를 참조하여 추적 + 되돌리기 가능.
 */

import { collection, doc, getDocs, query, orderBy, limit as fbLimit, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COL_LOGS = 'timetable_import_logs';

/** 미리보기 모달에 표시되는 디테일과 동일 구조 — 이력에서 펼쳐 볼 때 사용 */
export interface ImportLogDetails {
    additions?: Array<{
        studentName: string;        // 표시용 (이미 lookup 된 텍스트)
        targetClassName: string;
        matched: boolean;           // 매칭 성공 여부
    }>;
    removals?: Array<{
        studentName: string;
        sourceClassName: string;
    }>;
    moves?: Array<{
        studentName: string;
        fromClassName: string;
        toClassName: string;
        fromDay?: string;
        toDay?: string;
        fromTeacher?: string;
        toTeacher?: string;
        teacherChanged: boolean;
    }>;
    renames?: Array<{
        oldName: string;
        newName: string;
    }>;
    colorChanges?: Array<{
        className: string;
        oldBg?: string;
        newBg?: string;
        oldFg?: string;
        newFg?: string;
    }>;
}

export interface ImportLog {
    id: string;
    createdAt: number;
    actorId?: string;
    actorName?: string;
    weekLabel: string;
    referenceDate: string;
    subjectFilter: string;
    snapshotId?: string;
    /** 적용 결과 요약 */
    result: {
        additions: number;
        removals: number;
        moves: number;
        renames: number;
        colorChanges: number;
        errors?: string[];
    };
    /** 변경 항목별 상세 (이력 펼침 시 표시) */
    details?: ImportLogDetails;
    /** 되돌렸으면 복원 시각 (undefined 면 활성) */
    restoredAt?: number;
}

/** Firestore 는 undefined 값을 거부 — 재귀적으로 undefined 키 제거 */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
    const out: any = Array.isArray(obj) ? [...obj] : {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
            out[k] = stripUndefined(v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

export async function writeImportLog(log: Omit<ImportLog, 'id' | 'createdAt'>): Promise<string> {
    const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const data: ImportLog = {
        ...log,
        id,
        createdAt: Date.now(),
    };
    await setDoc(doc(db, COL_LOGS, id), stripUndefined(data));
    return id;
}

export async function markLogRestored(logId: string): Promise<void> {
    await setDoc(doc(db, COL_LOGS, logId), { restoredAt: Date.now() }, { merge: true });
}

export async function listImportLogs(maxItems = 20): Promise<ImportLog[]> {
    const q = query(collection(db, COL_LOGS), orderBy('createdAt', 'desc'), fbLimit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ImportLog);
}
