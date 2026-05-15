/**
 * 시간표 → 구글 스프레드시트 동기화 트리거
 *
 * 구성:
 * 1. Firestore onWrite 트리거 (classes/students/enrollments/staff) → settings/sheetsSync에 pendingSync 마킹
 * 2. onSchedule every 1 minute → 60초 idle 체크 후 syncAll() 실행
 *    (60초 디바운스: 변경 후 60초 동안 추가 변경 없으면 동기화)
 *    (30분 보정: 마지막 동기화 후 30분 경과하면 강제 실행)
 * 3. HTTPS callable syncTimetableSheetsNow → 권한 체크 후 즉시 동기화 (관리자만)
 *
 * 60초 디바운스 방식:
 *   - Firestore 변경 발생 시 settings/sheetsSync.lastChangeAt = now() 기록
 *   - onSchedule 매 분 실행:
 *       if (now - lastChangeAt >= 60s AND lastChangeAt > lastFullSyncAt) → syncAll()
 *       elif (now - lastFullSyncAt >= 30분) → syncAll() (보정)
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

const { syncAll, GOOGLE_SERVICE_ACCOUNT_KEY, getAuthClient, getDriveClient, getSheetsClient, diagnoseFolderAccess, loadSheetsMapping, saveSheetsMapping, updateSheetContent } = require("./timetableSheetsSync");

const DATABASE_ID = "restore20260319";
const REGION = "asia-northeast3";
const SETTINGS_DOC_PATH = "settings/sheetsSync";

const DEBOUNCE_SECONDS = 60;
const CORRECTION_MINUTES = 30;

// ============ 변경 감지 → pendingSync 마킹 ============

/**
 * settings/sheetsSync에 lastChangeAt 기록 (트리거 공통 핸들러)
 */
async function markPendingSync() {
    const db = getFirestore(DATABASE_ID);
    await db
        .collection("settings")
        .doc("sheetsSync")
        .set(
            {
                lastChangeAt: FieldValue.serverTimestamp(),
                pendingSync: true,
            },
            { merge: true }
        );
}

const triggerOptions = (collection) => ({
    document: `${collection}/{docId}`,
    database: DATABASE_ID,
    region: REGION,
});

const enrollmentsTriggerOptions = {
    document: "students/{studentId}/enrollments/{enrollmentId}",
    database: DATABASE_ID,
    region: REGION,
};

const onClassesChange = onDocumentWritten(triggerOptions("classes"), async () => {
    await markPendingSync();
    return null;
});

const onStudentsChange = onDocumentWritten(triggerOptions("students"), async () => {
    await markPendingSync();
    return null;
});

const onEnrollmentsChange = onDocumentWritten(enrollmentsTriggerOptions, async () => {
    await markPendingSync();
    return null;
});

const onStaffChange = onDocumentWritten(triggerOptions("staff"), async () => {
    await markPendingSync();
    return null;
});

// ============ 디바운스 스케줄러 (매 분 실행) ============

/**
 * 매 분 실행하면서 60초 idle 또는 30분 보정 조건에 맞으면 syncAll() 호출.
 */
const syncTimetableSheetsScheduled = onSchedule(
    {
        schedule: "every 1 minutes",
        region: REGION,
        secrets: [GOOGLE_SERVICE_ACCOUNT_KEY],
        timeoutSeconds: 540,
        memory: "512MiB",
    },
    async () => {
        const db = getFirestore(DATABASE_ID);
        const docRef = db.collection("settings").doc("sheetsSync");
        const snap = await docRef.get();
        const data = snap.exists ? snap.data() : {};

        const now = Date.now();
        const lastChangeAt = data.lastChangeAt && data.lastChangeAt.toMillis ? data.lastChangeAt.toMillis() : 0;
        const lastFullSyncAt = data.lastFullSyncAt && data.lastFullSyncAt.toMillis ? data.lastFullSyncAt.toMillis() : 0;
        const pendingSync = !!data.pendingSync;

        // 1) 60초 디바운스 조건: pending 있고 마지막 변경 후 60초 경과 + 마지막 동기화보다 늦은 변경
        const debounceOk =
            pendingSync &&
            lastChangeAt > 0 &&
            now - lastChangeAt >= DEBOUNCE_SECONDS * 1000 &&
            lastChangeAt > lastFullSyncAt;

        // 2) 30분 보정 조건: 마지막 동기화 후 30분 경과 (변경 없어도 실행)
        const correctionOk = now - lastFullSyncAt >= CORRECTION_MINUTES * 60 * 1000;

        if (!debounceOk && !correctionOk) {
            // 아무것도 안 함 (가장 흔한 경우)
            return null;
        }

        if (correctionOk && !debounceOk) {
            logger.info(`[SheetsSync] 30분 보정 동기화 실행`);
        } else {
            logger.info(`[SheetsSync] 60초 디바운스 동기화 실행 (마지막 변경: ${Math.round((now - lastChangeAt) / 1000)}초 전)`);
        }

        try {
            await syncAll();
            // pendingSync 플래그 해제
            await docRef.set({ pendingSync: false }, { merge: true });
        } catch (err) {
            logger.error("[SheetsSync] 스케줄 동기화 실패:", err);
        }
        return null;
    }
);

// ============ 수동 동기화 (HTTPS Callable) ============

/**
 * 관리자가 클라이언트에서 "지금 동기화" 버튼 누르면 호출.
 * 권한 체크: master 또는 admin role만 허용.
 */
const syncTimetableSheetsNow = onCall(
    {
        region: REGION,
        secrets: [GOOGLE_SERVICE_ACCOUNT_KEY],
        timeoutSeconds: 540,
        memory: "512MiB",
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
        }
        const uid = request.auth.uid;

        // 권한 확인 (master / admin만)
        const db = getFirestore(DATABASE_ID);
        const indexDoc = await db.collection("staffIndex").doc(uid).get();
        const role = indexDoc.exists ? indexDoc.data().systemRole : null;
        if (role !== "master" && role !== "admin") {
            throw new HttpsError("permission-denied", "관리자만 수동 동기화할 수 있습니다.");
        }

        try {
            const result = await syncAll({ forceUpdate: true });
            // pendingSync 플래그 해제
            await db
                .collection("settings")
                .doc("sheetsSync")
                .set({ pendingSync: false }, { merge: true });
            return result;
        } catch (err) {
            logger.error("[SheetsSync] 수동 동기화 실패:", err);
            throw new HttpsError("internal", `동기화 실패: ${err.message || err}`);
        }
    }
);

/**
 * 클라이언트에서 ExcelJS로 생성한 xlsx를 받아 그대로 시트에 업로드.
 *
 * 방식 A: 클라이언트가 화면에 보이는 데이터로 직접 xlsx 생성 → base64 전송
 *   → Functions는 단순 update만 → 100% 엑셀 내보내기와 동일한 결과 보장
 *
 * 권한: master / admin만
 */
const uploadTimetableXlsx = onCall(
    {
        region: REGION,
        secrets: [GOOGLE_SERVICE_ACCOUNT_KEY],
        timeoutSeconds: 120,
        memory: "512MiB",
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
        }
        const uid = request.auth.uid;
        const db = getFirestore(DATABASE_ID);
        const indexDoc = await db.collection("staffIndex").doc(uid).get();
        const role = indexDoc.exists ? indexDoc.data().systemRole : null;
        if (role !== "master" && role !== "admin") {
            throw new HttpsError("permission-denied", "관리자만 시트를 업로드할 수 있습니다.");
        }

        const xlsxBase64 = request.data && request.data.xlsxBase64;
        if (!xlsxBase64 || typeof xlsxBase64 !== "string") {
            throw new HttpsError("invalid-argument", "xlsxBase64가 필요합니다.");
        }

        const mapping = await loadSheetsMapping();
        const spreadsheetId = (mapping.spreadsheetId || "").trim();
        if (!spreadsheetId) {
            throw new HttpsError(
                "failed-precondition",
                "settings/sheetsSync.spreadsheetId가 등록되지 않았습니다. 원장님 Drive에 빈 시트 1개를 만들고 서비스 계정에 편집자로 공유한 뒤, 시트 ID를 등록해주세요."
            );
        }

        try {
            const xlsxBuffer = Buffer.from(xlsxBase64, "base64");
            logger.info(`[SheetsSync] 클라이언트 xlsx 업로드 시작. spreadsheetId=${spreadsheetId}, size=${xlsxBuffer.length} bytes`);

            const auth = getAuthClient();
            const drive = getDriveClient(auth);
            await updateSheetContent(drive, spreadsheetId, xlsxBuffer);

            // 모든 워크시트에 wrapStrategy: CLIP 적용 (셀 텍스트 넘침 방지 → 자르기)
            // CLIP은 자동 줄바꿈/넘침만 막고 명시적 \n(요일·교시 라벨)은 유지
            try {
                const sheets = getSheetsClient(auth);
                const meta = await sheets.spreadsheets.get({
                    spreadsheetId,
                    fields: "sheets.properties.sheetId",
                });
                const requests = (meta.data.sheets || []).map(sh => ({
                    repeatCell: {
                        range: { sheetId: sh.properties.sheetId },
                        cell: { userEnteredFormat: { wrapStrategy: "CLIP" } },
                        fields: "userEnteredFormat.wrapStrategy",
                    },
                }));
                if (requests.length > 0) {
                    await sheets.spreadsheets.batchUpdate({
                        spreadsheetId,
                        requestBody: { requests },
                    });
                    logger.info(`[SheetsSync] wrapStrategy CLIP 적용: ${requests.length}개 워크시트`);
                }
            } catch (clipErr) {
                // CLIP 적용 실패해도 동기화 자체는 성공으로 처리
                logger.warn("[SheetsSync] wrapStrategy CLIP 적용 실패:", clipErr.message);
            }

            const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
            await saveSheetsMapping({
                all: {
                    sheetId: spreadsheetId,
                    url,
                    lastSyncedAt: FieldValue.serverTimestamp(),
                },
                lastFullSyncAt: FieldValue.serverTimestamp(),
                lastError: null,
                lastErrorRaw: null,
                pendingSync: false,
                syncInProgress: false,
            });

            logger.info(`[SheetsSync] 클라이언트 xlsx 업로드 완료: ${spreadsheetId}`);
            return { success: true, sheetId: spreadsheetId, url };
        } catch (err) {
            logger.error("[SheetsSync] 클라이언트 xlsx 업로드 실패:", err);
            await saveSheetsMapping({
                syncInProgress: false,
                lastError: err.message || String(err),
                lastErrorAt: FieldValue.serverTimestamp(),
            });
            throw new HttpsError("internal", err.message || "업로드 실패");
        }
    }
);

/**
 * 폴더 접근 진단 HTTPS Callable
 * 관리자가 "왜 시트 생성이 안 되는지" 진단할 때 사용.
 * 인자 없이 호출하면 settings/sheetsSync.parentFolderId를 사용.
 */
const diagnoseSheetsFolder = onCall(
    {
        region: REGION,
        secrets: [GOOGLE_SERVICE_ACCOUNT_KEY],
        timeoutSeconds: 60,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
        }
        const uid = request.auth.uid;

        const db = getFirestore(DATABASE_ID);
        const indexDoc = await db.collection("staffIndex").doc(uid).get();
        const role = indexDoc.exists ? indexDoc.data().systemRole : null;
        if (role !== "master" && role !== "admin") {
            throw new HttpsError("permission-denied", "관리자만 진단할 수 있습니다.");
        }

        const folderId = (request.data && request.data.folderId)
            || (await loadSheetsMapping()).parentFolderId
            || null;

        if (!folderId) {
            return { ok: false, error: "settings/sheetsSync.parentFolderId가 비어있고, 호출 시 folderId도 전달되지 않았습니다." };
        }

        const auth = getAuthClient();
        const result = await diagnoseFolderAccess(auth, folderId);
        logger.info(`[SheetsSync] 폴더 진단 결과 (${folderId}):`, JSON.stringify(result));
        return result;
    }
);

module.exports = {
    onClassesChange,
    onStudentsChange,
    onEnrollmentsChange,
    onStaffChange,
    syncTimetableSheetsScheduled,
    syncTimetableSheetsNow,
    uploadTimetableXlsx,
    diagnoseSheetsFolder,
};
