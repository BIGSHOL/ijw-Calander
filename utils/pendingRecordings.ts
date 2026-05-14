/**
 * 진행 중인 녹음의 컨텍스트 메타데이터 (localStorage)
 *
 * 시나리오:
 * 1. 사용자가 회의록/학생상담/등록상담 탭에서 녹음 시작
 *    → savePending() 으로 type + context 저장 + 토큰 발급
 * 2. 녹음 팝업이 다운로드 파일명에 토큰 포함
 * 3. 메인 페이지가 (배포/새로고침/실수로) 닫혀도 팝업은 살아있음
 *    → 팝업이 자동 다운로드만 수행 (postMessage 실패)
 * 4. 사용자가 다시 메인을 열면 listPending() 으로 미처리 항목 발견
 *    → 알림 배너로 "○○ 녹음이 있습니다, 파일을 끌어놓으면 자동 분석합니다"
 * 5. 사용자가 파일 선택 시 파일명에서 토큰 추출
 *    → getPendingByFileName() 으로 컨텍스트 복원
 *    → 해당 탭의 분석 플로우 자동 실행 + removePending()
 *
 * IndexedDB 청크 백업(`recordingRecovery.ts`)과는 별개:
 *   - `recordingRecovery`: 인라인 녹음 시 청크 단위 백업 (대용량)
 *   - `pendingRecordings`: 컨텍스트 메타만 (작은 JSON)
 */

export type RecordingType =
    | 'meeting'                 // 회의록
    | 'student-consultation'    // 학생 상담
    | 'registration-consultation'; // 등록 상담

export interface PendingRecording {
    id: string;              // crypto.randomUUID() — 짧게 줄여서 파일명에 사용
    type: RecordingType;
    startedAt: number;       // Date.now()
    context: Record<string, any>; // 타입별 자유 필드 (제목/참석자/학생ID 등)
    /**
     * 다운로드 파일명 인식용 토큰.
     * - savePending() 호출 시 자동 생성 (id 의 앞 8자)
     * - recorderPopup 에 전달 → 파일명에 포함
     * - 가져오기 시 파일명에서 추출 → 매칭
     */
    fileToken: string;
}

const STORAGE_PREFIX = 'pending_recording_';
const EXPIRY_DAYS = 7;

/** 짧은 토큰 (파일명용) */
function makeFileToken(id: string): string {
    // UUID 앞 8자 (영숫자) — 파일명에 안전
    return id.replace(/-/g, '').slice(0, 8);
}

/**
 * 진행 중인 녹음 메타 저장.
 * @returns 저장된 메타 (id, fileToken 포함)
 */
export function savePending(
    type: RecordingType,
    context: Record<string, any> = {},
): PendingRecording {
    const id =
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const fileToken = makeFileToken(id);

    const meta: PendingRecording = {
        id,
        type,
        startedAt: Date.now(),
        context,
        fileToken,
    };

    try {
        localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(meta));
    } catch (err) {
        // localStorage 가득 차거나 비허용 환경
        console.warn('[pendingRecordings] save failed:', err);
    }

    return meta;
}

/** 만료된 항목 정리 후 전체 pending 목록 반환 */
export function listPending(): PendingRecording[] {
    cleanupExpired();
    const result: PendingRecording[] = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            try {
                const meta = JSON.parse(raw) as PendingRecording;
                if (meta && meta.id && meta.type) result.push(meta);
            } catch {
                // 손상된 항목은 제거
                localStorage.removeItem(key);
            }
        }
    } catch (err) {
        console.warn('[pendingRecordings] list failed:', err);
    }
    // 최신 순
    return result.sort((a, b) => b.startedAt - a.startedAt);
}

export function getPending(id: string): PendingRecording | null {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + id);
        if (!raw) return null;
        return JSON.parse(raw) as PendingRecording;
    } catch {
        return null;
    }
}

/**
 * 파일명에서 토큰을 추출해서 매칭되는 pending 반환.
 * 파일명 패턴: `*_TOKEN_*.ext` 또는 `*-TOKEN-*.ext` 등 토큰이 포함되어 있으면 OK
 */
export function getPendingByFileName(fileName: string): PendingRecording | null {
    const list = listPending();
    // 토큰이 파일명에 포함되어 있는지 단순 검색 (8자 영숫자)
    return list.find(meta => fileName.includes(meta.fileToken)) || null;
}

export function removePending(id: string): void {
    try {
        localStorage.removeItem(STORAGE_PREFIX + id);
    } catch {
        // 무시
    }
}

/**
 * 7일 이상 된 미처리 항목 자동 정리.
 * @returns 삭제된 개수
 */
export function cleanupExpired(maxAgeDays: number = EXPIRY_DAYS): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    try {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            try {
                const meta = JSON.parse(raw) as PendingRecording;
                if (!meta?.startedAt || meta.startedAt < cutoff) {
                    toRemove.push(key);
                }
            } catch {
                toRemove.push(key);
            }
        }
        toRemove.forEach(k => { localStorage.removeItem(k); removed++; });
    } catch {
        // 무시
    }
    return removed;
}

/** 디버그용: 모든 pending 삭제 */
export function clearAllPending(): void {
    try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
        }
        keys.forEach(k => localStorage.removeItem(k));
    } catch {
        // 무시
    }
}

/** 타입별 한국어 라벨 (UI용) */
export const RECORDING_TYPE_LABELS: Record<RecordingType, string> = {
    'meeting': '회의록',
    'student-consultation': '학생 상담',
    'registration-consultation': '등록 상담',
};

/** 타입별 대상 탭 (라우팅용) */
export const RECORDING_TYPE_TAB: Record<RecordingType, string> = {
    'meeting': 'meeting-minutes',
    'student-consultation': 'student-consultations',
    'registration-consultation': 'consultation',
};
