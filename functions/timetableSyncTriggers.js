/**
 * 시간표 ↔ 구글 스프레드시트 동기화 — HTTPS Callable 모음
 *
 * 동기화 방식 (2026-05 변경):
 *   - 자동 동기화는 **클라이언트 자동 푸시**가 담당한다.
 *     시간표 화면(TimetableManager)이 데이터 변경을 감지하면 디바운스 후
 *     uploadTimetableXlsx를 호출 → 방식 A로 시트 갱신.
 *   - 서버측 스케줄러/Firestore 트리거(onClassesChange 등)는 제거됨.
 *     이유: 서버가 시간표 데이터를 재계산하면 클라이언트의 학생 파생 로직
 *     (반이동 판정 등)과 어긋나 인원이 누락됨. 클라이언트가 이미 정확한
 *     데이터를 갖고 있으므로 클라이언트가 직접 푸시하는 것이 유일한 정답.
 *
 * 이 파일의 Callable:
 *   - syncTimetableSheetsNow : (레거시) 서버측 syncAll 수동 동기화 — 관리자만
 *   - uploadTimetableXlsx    : 클라이언트가 만든 xlsx를 시트에 업로드 (방식 A) — 관리자만
 *   - diagnoseSheetsFolder   : 폴더 접근 진단 — 관리자만
 *   - exportSheetAsXlsx      : 시트를 xlsx로 export (스프레드시트 가져오기용) — 관리자만
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

const { syncAll, GOOGLE_SERVICE_ACCOUNT_KEY, getAuthClient, getDriveClient, getSheetsClient, diagnoseFolderAccess, loadSheetsMapping, saveSheetsMapping, updateSheetContent } = require("./timetableSheetsSync");

const DATABASE_ID = "restore20260319";
const REGION = "asia-northeast3";

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

/**
 * Google 스프레드시트를 xlsx로 export하여 클라이언트에 반환 (스프레드시트 가져오기용).
 *
 * 사용자가 시트 URL/ID를 입력 → 이 함수가 Drive API로 시트를 xlsx로 변환 →
 * base64 반환 → 클라이언트가 기존 엑셀 가져오기 엔진(parseImportedExcel)으로 처리.
 *
 * 권한: master / admin만
 */
const exportSheetAsXlsx = onCall(
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
            throw new HttpsError("permission-denied", "관리자만 스프레드시트를 가져올 수 있습니다.");
        }

        // 시트 URL 또는 ID 파싱
        let spreadsheetId = request.data && request.data.spreadsheetId;
        if (!spreadsheetId || typeof spreadsheetId !== "string") {
            throw new HttpsError("invalid-argument", "시트 URL 또는 ID가 필요합니다.");
        }
        spreadsheetId = String(spreadsheetId).trim();
        // URL이면 /spreadsheets/d/<ID> 에서 ID 추출
        const urlMatch = spreadsheetId.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
        if (urlMatch) spreadsheetId = urlMatch[1];

        try {
            const auth = getAuthClient();
            const { google } = require("googleapis");
            const drive = google.drive({ version: "v3", auth });

            // Google Sheets → xlsx export (files.export, 10MB 제한 — 시간표는 1MB 미만)
            const res = await drive.files.export(
                {
                    fileId: spreadsheetId,
                    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                },
                { responseType: "arraybuffer" }
            );

            const buffer = Buffer.from(res.data);
            const xlsxBase64 = buffer.toString("base64");
            logger.info(`[SheetsSync] 스프레드시트 export 완료: ${spreadsheetId}, size=${buffer.length} bytes`);
            return { success: true, xlsxBase64, spreadsheetId };
        } catch (err) {
            logger.error("[SheetsSync] 스프레드시트 export 실패:", err);
            const msg = err.message || String(err);
            if (err.code === 404 || /not found|notFound/i.test(msg)) {
                throw new HttpsError(
                    "not-found",
                    "시트를 찾을 수 없습니다. 시트 URL을 확인하거나, 해당 시트가 서비스 계정(firebase-adminsdk-fbsvc@ijw-calander.iam.gserviceaccount.com)에 공유되어 있는지 확인해주세요."
                );
            }
            if (err.code === 403 || /forbidden|permission/i.test(msg)) {
                throw new HttpsError("permission-denied", "시트 접근 권한이 없습니다. 시트를 서비스 계정에 공유하거나 '링크 있는 누구나'로 설정해주세요.");
            }
            throw new HttpsError("internal", `스프레드시트 가져오기 실패: ${msg}`);
        }
    }
);

module.exports = {
    syncTimetableSheetsNow,
    uploadTimetableXlsx,
    diagnoseSheetsFolder,
    exportSheetAsXlsx,
};
