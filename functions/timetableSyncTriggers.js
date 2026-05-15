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

const { syncAll, GOOGLE_SERVICE_ACCOUNT_KEY } = require("./timetableSheetsSync");

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

module.exports = {
    onClassesChange,
    onStudentsChange,
    onEnrollmentsChange,
    onStaffChange,
    syncTimetableSheetsScheduled,
    syncTimetableSheetsNow,
};
