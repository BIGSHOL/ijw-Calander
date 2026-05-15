/**
 * useSheetsSync - Google Sheets 동기화 매핑 구독 + 수동 동기화 mutation
 *
 * Firestore `settings/sheetsSync` 문서를 onSnapshot으로 구독하여
 * - 전체 시트 URL
 * - 강사별 시트 URL (현재 사용자의 staffId 기준)
 * - 마지막 동기화 시각
 * 을 실시간 제공.
 *
 * `syncNow()`는 관리자 전용 HTTPS callable (`syncTimetableSheetsNow`)을 호출하여
 * 즉시 동기화를 트리거.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebaseConfig';

export interface SheetEntry {
    sheetId: string;
    url: string;
    isActive?: boolean;
    teacherName?: string;
    teacherEmail?: string;
    lastSyncedAt?: Timestamp;
    deactivatedAt?: Timestamp;
}

export interface SheetsSyncMapping {
    all?: SheetEntry | null;
    byTeacherId?: Record<string, SheetEntry>;
    lastFullSyncAt?: Timestamp;
    lastChangeAt?: Timestamp;
    pendingSync?: boolean;
    syncInProgress?: boolean;
    lastError?: string | null;
}

export interface UseSheetsSyncResult {
    mapping: SheetsSyncMapping | null;
    loading: boolean;
    error: string | null;
    syncNow: () => Promise<void>;
    syncing: boolean;
    /** 현재 사용자의 staffId 기준 강사 시트 (해당 시 반환, 없으면 null) */
    mySheet: SheetEntry | null;
}

const SYNC_THROTTLE_MS = 5000;

export const useSheetsSync = (currentStaffId?: string | null): UseSheetsSyncResult => {
    const [mapping, setMapping] = useState<SheetsSyncMapping | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const lastSyncCallAtRef = useRef<number>(0);

    // Firestore 구독
    useEffect(() => {
        const ref = doc(db, 'settings', 'sheetsSync');
        const unsubscribe = onSnapshot(
            ref,
            snap => {
                if (snap.exists()) {
                    setMapping(snap.data() as SheetsSyncMapping);
                } else {
                    setMapping({});
                }
                setLoading(false);
                setError(null);
            },
            err => {
                console.error('[useSheetsSync] onSnapshot error:', err);
                setError(err.message || 'sheets-sync subscribe failed');
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, []);

    const syncNow = useCallback(async () => {
        const now = Date.now();
        if (now - lastSyncCallAtRef.current < SYNC_THROTTLE_MS) {
            console.warn('[useSheetsSync] 동기화 호출이 너무 빠릅니다. 잠시 후 다시 시도해주세요.');
            return;
        }
        lastSyncCallAtRef.current = now;

        setSyncing(true);
        setError(null);
        try {
            const functions = getFunctions(undefined, 'asia-northeast3');
            const syncFn = httpsCallable(functions, 'syncTimetableSheetsNow');
            await syncFn({});
        } catch (err: any) {
            console.error('[useSheetsSync] syncNow error:', err);
            setError(err?.message || 'sync failed');
            throw err;
        } finally {
            setSyncing(false);
        }
    }, []);

    // 현재 사용자의 강사 시트 찾기
    const mySheet =
        currentStaffId && mapping?.byTeacherId?.[currentStaffId]
            ? mapping.byTeacherId[currentStaffId]
            : null;

    return { mapping, loading, error, syncNow, syncing, mySheet };
};
