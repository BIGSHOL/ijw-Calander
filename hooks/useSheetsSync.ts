/**
 * useSheetsSync - Google Sheets 동기화 매핑 구독 + 수동 동기화 mutation
 *
 * Firestore `settings/sheetsSync` 문서를 onSnapshot으로 구독하여
 * - 전체 시트 URL
 * - 강사별 시트 URL (현재 사용자의 staffId 기준)
 * - 마지막 동기화 시각
 * 을 실시간 제공.
 *
 * `syncNow(exportParams)`는 클라이언트에서 직접 xlsx를 생성하여
 * Functions `uploadTimetableXlsx` callable에 base64로 전송 → 시트 update.
 * → 엑셀 내보내기와 100% 동일한 결과 보장 (방식 A).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebaseConfig';
import { exportMathTimetableToExcel, type ExportTimetableParams } from '../components/Timetable/Math/utils/excelExport';

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
    spreadsheetId?: string;
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
    /**
     * 클라이언트가 현재 시간표 데이터로 xlsx를 만들고 Functions에 전송하여 시트 update.
     * exportParams를 받지 못하면 (= 시간표 페이지가 아님) 서버측 동기화로 fallback.
     */
    syncNow: (exportParams?: ExportTimetableParams) => Promise<void>;
    syncing: boolean;
    /** 현재 사용자의 staffId 기준 강사 시트 (해당 시 반환, 없으면 null) */
    mySheet: SheetEntry | null;
}

const SYNC_THROTTLE_MS = 5000;

/** ArrayBuffer → base64 변환 (브라우저 호환) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000; // 32KB 청크로 분할 처리 (큰 파일 stack overflow 방지)
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
}

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

    const syncNow = useCallback(async (exportParams?: ExportTimetableParams) => {
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

            if (exportParams) {
                // 방식 A: 클라이언트에서 xlsx 생성 → base64로 전송 (정확한 데이터)
                const buffer = await exportMathTimetableToExcel({
                    ...exportParams,
                    returnBufferOnly: true,
                }) as ArrayBuffer;

                if (!buffer || buffer.byteLength === 0) {
                    throw new Error('xlsx 생성 실패 (빈 buffer)');
                }

                const xlsxBase64 = arrayBufferToBase64(buffer);
                const uploadFn = httpsCallable(functions, 'uploadTimetableXlsx');
                await uploadFn({ xlsxBase64 });
            } else {
                // Fallback: 서버측 동기화 (시간표 페이지 외 컨텍스트에서 호출 시)
                const syncFn = httpsCallable(functions, 'syncTimetableSheetsNow');
                await syncFn({});
            }
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
