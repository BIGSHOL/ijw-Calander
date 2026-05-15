/**
 * Google Sheets 자동 동기화 - 시트 라이프사이클 관리
 *
 * 역할:
 * - JWT 인증 (Drive + Sheets 스코프)
 * - 시트 생성/조회/공유/갱신
 * - settings/sheetsSync 매핑 관리
 *
 * 동기화 메인 흐름은 syncAll()을 사용하며, Firestore 데이터 수집은
 * `timetableDataCollector.js`에 위임한다.
 *
 * 인증은 기존 `googleCalendarSync.js`와 동일한 `GOOGLE_SERVICE_ACCOUNT_KEY` Secret 재사용.
 */

const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

const { exportMathTimetableToBuffer } = require("./timetableExporter");
const { collectTimetableData } = require("./timetableDataCollector");

// googleapis lazy load
let _google = null;
function getGoogle() {
    if (!_google) _google = require("googleapis").google;
    return _google;
}

const GOOGLE_SERVICE_ACCOUNT_KEY = defineSecret("GOOGLE_SERVICE_ACCOUNT_KEY");

const DATABASE_ID = "restore20260319";

// ============ 에러 메시지 한글 변환 ============

/**
 * Google API / Drive / Sheets 에러를 사용자 친화 한글 메시지로 변환.
 * 알려진 패턴이 없으면 원문 + "(원문 영문)" 형태로 반환.
 */
function translateError(err) {
    if (!err) return "알 수 없는 오류";
    const raw = typeof err === "string" ? err : (err.message || String(err));
    const code = err.code || (err.errors && err.errors[0] && err.errors[0].reason) || "";
    const lower = raw.toLowerCase();

    // 가장 흔한 케이스부터
    if (lower.includes("storage quota") || code === "storageQuotaExceeded") {
        return "Google Drive 저장 공간 부족 — 시트는 새로 만들지 말고 원장님이 미리 만든 빈 시트의 ID를 settings/sheetsSync.spreadsheetId에 등록한 뒤 update 방식으로 동기화해주세요.";
    }
    if (lower.includes("spreadsheetid가 등록되지 않")) {
        return raw; // 이미 한글 자세한 안내
    }
    // "File not found: <ID>" → 폴더 접근 권한 부족 (Drive API는 권한 없는 리소스를 not found로 응답)
    if (lower.startsWith("file not found:")) {
        const idMatch = raw.match(/File not found:\s*([A-Za-z0-9_-]+)/);
        const id = idMatch ? idMatch[1] : "";
        return `폴더 또는 시트에 접근 권한이 없습니다 (${id}). 서비스 계정(firebase-adminsdk-fbsvc@ijw-calander.iam.gserviceaccount.com)이 해당 폴더의 "편집자"로 공유되었는지 확인해주세요.`;
    }
    if (lower.includes("rate limit") || code === "rateLimitExceeded") {
        return "Google API 호출 제한을 초과했습니다. 잠시 후 자동으로 다시 시도됩니다.";
    }
    if (code === "userRateLimitExceeded") {
        return "Google API 사용자 호출 제한을 초과했습니다. 1~2분 후 다시 시도해주세요.";
    }
    if (code === "quotaExceeded" || lower.includes("quota exceeded")) {
        return "Google API 일일 할당량을 초과했습니다. 내일 다시 시도해주세요.";
    }
    if (code === "forbidden" || err.code === 403) {
        return "Google Drive 접근 권한이 없습니다. 폴더 공유 설정을 확인해주세요.";
    }
    if (code === "notFound" || err.code === 404) {
        return "시트를 찾을 수 없습니다. 누군가 시트를 삭제했을 수 있습니다.";
    }
    if (code === "unauthenticated" || err.code === 401) {
        return "Google API 인증에 실패했습니다. 서비스 계정 키를 확인해주세요.";
    }
    if (code === "unavailable" || err.code === 503) {
        return "Google 서비스가 일시적으로 사용 불가합니다. 잠시 후 자동으로 재시도됩니다.";
    }
    if (lower.includes("invalid_grant") || lower.includes("jwt")) {
        return "서비스 계정 인증 토큰이 만료되었거나 잘못되었습니다.";
    }
    if (lower.includes("permission")) {
        return "권한이 없습니다. 시트 공유 설정 또는 서비스 계정 권한을 확인해주세요.";
    }
    if (lower.includes("network") || lower.includes("timeout") || lower.includes("etimedout")) {
        return "네트워크 연결 오류 또는 시간 초과. 잠시 후 자동으로 재시도됩니다.";
    }

    // 데이터 수집 관련
    if (lower.includes("no-data") || lower.includes("시간표 데이터")) {
        return "시간표 데이터가 없습니다. 수학 수업이 등록되어 있는지 확인해주세요.";
    }

    // 폴백: 원문 그대로
    return `동기화 중 오류 발생: ${raw}`;
}

// ============ 인증 클라이언트 ============

/**
 * Drive + Sheets 스코프를 가진 JWT 클라이언트 생성
 * `googleCalendarSync.js`의 `getCalendarClient`와 동일한 패턴.
 */
function getAuthClient() {
    const g = getGoogle();
    const keyJson = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY.value());
    const auth = new g.auth.JWT(
        keyJson.client_email,
        null,
        keyJson.private_key,
        [
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/spreadsheets",
        ]
    );
    return auth;
}

function getDriveClient(auth) {
    return getGoogle().drive({ version: "v3", auth });
}

function getSheetsClient(auth) {
    return getGoogle().sheets({ version: "v4", auth });
}

// ============ 시트 생성/갱신 ============

/**
 * 새 Google Sheets 파일 생성 (xlsx Buffer 업로드 → 자동 변환)
 *
 * parentFolderId 지정 시 해당 폴더 안에 생성됨 → 폴더 소유자의 Drive quota 사용.
 * 미지정 시 서비스 계정 Drive에 생성 → quota 0이라 storageQuotaExceeded 에러.
 *
 * @returns {{sheetId: string, url: string}}
 */
async function createNewSheet(drive, name, xlsxBuffer, parentFolderId) {
    const { Readable } = require("stream");
    const stream = Readable.from(xlsxBuffer);

    // parentFolderId의 보이지 않는 공백 / URL 잔여물 제거
    const cleanFolderId = parentFolderId
        ? String(parentFolderId).trim().replace(/^.*\/folders\//, "").replace(/[\?&].*$/, "")
        : null;

    const requestBody = {
        name,
        mimeType: "application/vnd.google-apps.spreadsheet",
    };
    if (cleanFolderId) {
        requestBody.parents = [cleanFolderId];
    }

    try {
        const res = await drive.files.create({
            requestBody,
            media: {
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                body: stream,
            },
            fields: "id, webViewLink",
            supportsAllDrives: true,
        });

        return {
            sheetId: res.data.id,
            url: res.data.webViewLink,
        };
    } catch (err) {
        // 폴더 접근 실패 시 더 자세한 진단 추가
        const msg = err.message || "";
        if (cleanFolderId && msg.includes("File not found")) {
            logger.error(`[SheetsSync] createNewSheet 실패. 폴더 진단 시작: ${cleanFolderId}`);
            try {
                const folder = await drive.files.get({
                    fileId: cleanFolderId,
                    fields: "id, name, mimeType, capabilities, owners",
                    supportsAllDrives: true,
                });
                logger.error(`[SheetsSync] 폴더는 조회 가능: ${JSON.stringify(folder.data)}`);
                // 폴더 조회는 되지만 파일 생성 실패 → 권한 부족 (편집자 아닌 뷰어 등)
                const newErr = new Error(`폴더 ${cleanFolderId} 접근은 가능하나 파일 생성 권한 없음. 서비스 계정을 "편집자"로 공유해주세요. (현재 권한: ${JSON.stringify(folder.data.capabilities)})`);
                newErr.code = err.code;
                throw newErr;
            } catch (diagErr) {
                if (diagErr.message && diagErr.message.includes("File not found")) {
                    logger.error(`[SheetsSync] 폴더 자체 조회 실패: ${cleanFolderId} → 서비스 계정에 공유 안 됨`);
                    const newErr = new Error(`폴더 ${cleanFolderId}에 접근 권한 없음. 폴더 우클릭 → 공유 → firebase-adminsdk-fbsvc@ijw-calander.iam.gserviceaccount.com 에 "편집자" 권한 부여 필요.`);
                    newErr.code = err.code;
                    throw newErr;
                }
                throw diagErr;
            }
        }
        throw err;
    }
}

/**
 * 폴더 접근 진단 (디버깅용)
 * @returns {{accessible: boolean, name?: string, error?: string, capabilities?: object}}
 */
async function diagnoseFolderAccess(auth, folderId) {
    const drive = getDriveClient(auth);
    const cleanId = String(folderId || "").trim().replace(/^.*\/folders\//, "").replace(/[\?&].*$/, "");
    if (!cleanId) return { accessible: false, error: "폴더 ID가 비어있습니다." };
    try {
        const res = await drive.files.get({
            fileId: cleanId,
            fields: "id, name, mimeType, capabilities, owners, permissions",
            supportsAllDrives: true,
        });
        return {
            accessible: true,
            name: res.data.name,
            mimeType: res.data.mimeType,
            capabilities: res.data.capabilities,
            owners: res.data.owners,
            cleanId,
        };
    } catch (err) {
        return {
            accessible: false,
            cleanId,
            error: err.message,
            code: err.code,
        };
    }
}

/**
 * 기존 sheetId에 xlsx 덮어쓰기 (Drive API files.update)
 */
async function updateSheetContent(drive, sheetId, xlsxBuffer) {
    const { Readable } = require("stream");
    const stream = Readable.from(xlsxBuffer);

    await drive.files.update({
        fileId: sheetId,
        media: {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            body: stream,
        },
    });
}

/**
 * "링크 있는 누구나 편집자" 권한 설정
 * type: anyone + role: writer → URL을 아는 누구나 편집 가능 (allowFileDiscovery: false 라서 검색엔 안 잡힘)
 *
 * 주의: 학생 개인정보가 포함되므로 URL 외부 유출 금지. 자동 동기화로 편집은 60초~30분 내 덮어써짐.
 */
async function shareWithAnyoneAsEditor(drive, sheetId) {
    try {
        await drive.permissions.create({
            fileId: sheetId,
            sendNotificationEmail: false,
            requestBody: {
                role: "writer",
                type: "anyone",
                allowFileDiscovery: false,
            },
        });
        logger.info(`[SheetsSync] anyone-writer 권한 설정: ${sheetId}`);
    } catch (err) {
        logger.warn(`[SheetsSync] anyone-writer 권한 설정 실패 (${sheetId}):`, err.message);
    }
}

/**
 * 이메일에 권한 부여 (선택적 — 강사 본인 Drive에 표시되게 하려면 사용)
 * anyone-writer가 이미 설정된 시트라도 본인 Drive에서 검색되도록 추가 공유 가능.
 */
async function shareSheetWithEmail(drive, sheetId, email, role = "writer") {
    if (!email) return;
    try {
        await drive.permissions.create({
            fileId: sheetId,
            sendNotificationEmail: false,
            requestBody: {
                role,
                type: "user",
                emailAddress: email,
            },
        });
        logger.info(`[SheetsSync] 개별 공유: ${sheetId} → ${email} (${role})`);
    } catch (err) {
        if (err.code === 400 && /already/i.test(err.message || "")) return;
        logger.warn(`[SheetsSync] 개별 공유 실패 (${email}):`, err.message);
    }
}

/**
 * 이메일에서 공유 권한 제거
 */
async function unshareSheetWithEmail(drive, sheetId, email) {
    if (!email) return;
    try {
        const list = await drive.permissions.list({
            fileId: sheetId,
            fields: "permissions(id, emailAddress, role)",
        });
        const found = (list.data.permissions || []).find(
            p => p.emailAddress && p.emailAddress.toLowerCase() === email.toLowerCase()
        );
        if (found) {
            await drive.permissions.delete({ fileId: sheetId, permissionId: found.id });
            logger.info(`[SheetsSync] 공유 제거: ${sheetId} ← ${email}`);
        }
    } catch (err) {
        logger.warn(`[SheetsSync] 공유 제거 실패 (${email}):`, err.message);
    }
}

// ============ 매핑 관리 (settings/sheetsSync) ============

const SETTINGS_DOC = ["settings", "sheetsSync"];

async function loadSheetsMapping() {
    const db = getFirestore(DATABASE_ID);
    const doc = await db.collection(SETTINGS_DOC[0]).doc(SETTINGS_DOC[1]).get();
    if (!doc.exists) return { all: null, byTeacherId: {} };
    return doc.data() || { all: null, byTeacherId: {} };
}

async function saveSheetsMapping(mapping) {
    const db = getFirestore(DATABASE_ID);
    await db
        .collection(SETTINGS_DOC[0])
        .doc(SETTINGS_DOC[1])
        .set(mapping, { merge: true });
}

async function setSyncInProgress(value) {
    const db = getFirestore(DATABASE_ID);
    await db
        .collection(SETTINGS_DOC[0])
        .doc(SETTINGS_DOC[1])
        .set({ syncInProgress: value, lastSyncAttemptAt: FieldValue.serverTimestamp() }, { merge: true });
}

// ============ 전체 시트 ============

/**
 * 전체 시트 동기화
 *
 * 동작 방식:
 * - settings/sheetsSync.spreadsheetId가 있으면 → 그 시트에 xlsx 덮어쓰기 (update만)
 *   · 시트 owner는 등록자(원장님) → 원장님 Drive quota 사용 → quota 문제 해결
 *   · 서비스 계정은 편집자 권한으로 update만 수행 (storage 차지 안 함)
 * - 없으면 → 에러 (이전처럼 자동 생성하면 서비스 계정 owner 되어 quota 0 문제)
 *
 * (옵션 A — 사용자가 빈 시트 1개 미리 생성 + ID 등록 + 서비스 계정 편집자 공유)
 */
async function syncFullSheet(auth, exportParams, _adminEmails, _teacherEmails) {
    const drive = getDriveClient(auth);
    const mapping = await loadSheetsMapping();
    const spreadsheetId = (mapping.spreadsheetId || "").trim();

    logger.info(`[SheetsSync] syncFullSheet 시작. spreadsheetId=${JSON.stringify(spreadsheetId)}, mapping keys=${Object.keys(mapping || {}).join(",")}`);

    if (!spreadsheetId) {
        throw new Error(
            "settings/sheetsSync.spreadsheetId가 등록되지 않았습니다. " +
            "원장님 Drive에 빈 Google Sheets 1개를 만들고, " +
            "그 시트에 서비스 계정(firebase-adminsdk-fbsvc@ijw-calander.iam.gserviceaccount.com)을 " +
            "편집자로 공유한 뒤, 시트 ID를 spreadsheetId 필드에 등록해주세요."
        );
    }

    const xlsxBuffer = await exportMathTimetableToBuffer(exportParams);

    // 시트 내용 덮어쓰기 (storage quota는 시트 owner인 원장님 Drive 사용)
    await updateSheetContent(drive, spreadsheetId, xlsxBuffer);
    logger.info(`[SheetsSync] 전체 시트 갱신: ${spreadsheetId}`);

    // 시트 URL 구성 (확장 가능)
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    await saveSheetsMapping({
        all: {
            sheetId: spreadsheetId,
            url,
            lastSyncedAt: FieldValue.serverTimestamp(),
        },
    });

    return { sheetId: spreadsheetId, url };
}

// ============ 강사별 시트 ============

/**
 * 단일 강사 시트 동기화
 */
async function syncTeacherSheet(auth, teacher, exportParams, _adminEmails) {
    const drive = getDriveClient(auth);
    const mapping = await loadSheetsMapping();
    const existing = (mapping.byTeacherId && mapping.byTeacherId[teacher.id]) || null;
    const parentFolderId = mapping.parentFolderId || null;

    // 강사별 필터 적용된 xlsx 생성
    const teacherParams = {
        ...exportParams,
        teacherIdFilter: teacher.id,
        teacherNameFilter: teacher.name,
    };
    const xlsxBuffer = await exportMathTimetableToBuffer(teacherParams);

    let sheetId = existing && existing.sheetId;
    let url = existing && existing.url;

    if (!sheetId) {
        const name = `[${teacher.name} 시간표] ${exportParams.subjectFilter || "수학"}`;
        const created = await createNewSheet(drive, name, xlsxBuffer, parentFolderId);
        sheetId = created.sheetId;
        url = created.url;
        logger.info(`[SheetsSync] 강사 시트 생성 (${teacher.name}): ${sheetId} (parentFolder: ${parentFolderId || "없음"})`);

        // 링크 있는 누구나 편집자 권한
        await shareWithAnyoneAsEditor(drive, sheetId);
    } else {
        await updateSheetContent(drive, sheetId, xlsxBuffer);
        logger.info(`[SheetsSync] 강사 시트 갱신 (${teacher.name}): ${sheetId}`);
    }

    // 매핑 업데이트
    await saveSheetsMapping({
        byTeacherId: {
            [teacher.id]: {
                sheetId,
                url,
                isActive: true,
                teacherName: teacher.name,
                teacherEmail: teacher.email || "",
                lastSyncedAt: FieldValue.serverTimestamp(),
            },
        },
    });

    return { sheetId, url };
}

/**
 * 비활성화된 강사: 시트는 보존하되 다음 갱신에서 제외
 */
async function deactivateTeacherSheet(teacherId) {
    const mapping = await loadSheetsMapping();
    const existing = mapping.byTeacherId && mapping.byTeacherId[teacherId];
    if (!existing) return;
    if (existing.isActive === false) return;

    await saveSheetsMapping({
        byTeacherId: {
            [teacherId]: {
                ...existing,
                isActive: false,
                deactivatedAt: FieldValue.serverTimestamp(),
            },
        },
    });
    logger.info(`[SheetsSync] 강사 시트 비활성화: ${teacherId}`);
}

// ============ 메인 동기화 ============

/**
 * 전체 + 모든 활성 강사 시트 동기화 (메인 진입점)
 *
 * @param {{forceUpdate?: boolean}} [opts]
 */
async function syncAll(opts = {}) {
    const startedAt = Date.now();
    const db = getFirestore(DATABASE_ID);

    // 동시 실행 방지
    const mapping = await loadSheetsMapping();
    if (mapping.syncInProgress && !opts.forceUpdate) {
        // 5분 이상 진행 중이면 stuck으로 간주
        const lastAttempt = mapping.lastSyncAttemptAt && mapping.lastSyncAttemptAt.toMillis
            ? mapping.lastSyncAttemptAt.toMillis()
            : 0;
        if (Date.now() - lastAttempt < 5 * 60 * 1000) {
            logger.info("[SheetsSync] 다른 동기화가 진행 중. 스킵.");
            return { skipped: true, reason: "in-progress" };
        }
    }
    await setSyncInProgress(true);

    try {
        const auth = getAuthClient();

        // 데이터 수집
        const { exportParams, teachers, adminEmails } = await collectTimetableData();

        if (!exportParams) {
            logger.warn("[SheetsSync] 시간표 데이터 없음. 스킵.");
            await setSyncInProgress(false);
            return { skipped: true, reason: "no-data" };
        }

        // 강사 이메일 수집
        const activeTeachers = teachers.filter(t => t.isActive !== false);
        const teacherEmails = activeTeachers.map(t => t.email).filter(Boolean);

        // 1) 전체 시트 (단일 시트, 사용자 등록 spreadsheetId에 update)
        const fullResult = await syncFullSheet(auth, exportParams, adminEmails, teacherEmails);

        // 2) 강사별 시트는 Phase 2에서 단일 시트 안의 워크시트(탭)로 통합 예정.
        //    현재는 전체 시트만 작동. (옵션 A 방식 — 서비스 계정의 Drive quota 0 제약 회피)
        const teacherResults = [];

        // 4) 최종 매핑 업데이트
        await saveSheetsMapping({
            lastFullSyncAt: FieldValue.serverTimestamp(),
            syncInProgress: false,
            lastError: null,
        });

        const elapsedMs = Date.now() - startedAt;
        logger.info(`[SheetsSync] 동기화 완료: 전체+${teacherResults.length}개 강사 시트 (${elapsedMs}ms)`);

        return {
            success: true,
            full: fullResult,
            teachers: teacherResults,
            elapsedMs,
        };
    } catch (err) {
        logger.error("[SheetsSync] 동기화 실패:", err);
        await saveSheetsMapping({
            syncInProgress: false,
            lastError: translateError(err),
            lastErrorRaw: err.message || String(err),  // 원문도 보관 (디버깅용)
            lastErrorAt: FieldValue.serverTimestamp(),
        });
        throw err;
    }
}

// ============ 유틸 ============

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

module.exports = {
    GOOGLE_SERVICE_ACCOUNT_KEY,
    syncAll,
    syncFullSheet,
    syncTeacherSheet,
    deactivateTeacherSheet,
    loadSheetsMapping,
    saveSheetsMapping,
    updateSheetContent,
    getAuthClient,
    getDriveClient,
    getSheetsClient,
    diagnoseFolderAccess,
};
