/**
 * Google Calendar 다중 캘린더 동기화
 *
 * 구글 → 앱: 여러 Google Calendar 일정을 각각 매핑된 부서로 가져오기
 * 앱 → 구글: 구글에서 온 일정(gcalEventId 있는)만 수정 시 push back
 * 앱 전용 일정(gcalEventId 없는): 구글로 보내지 않음
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

// googleapis lazy load (패키지가 크므로)
let _google = null;
function getGoogle() {
  if (!_google) {
    _google = require("googleapis").google;
  }
  return _google;
}

const GOOGLE_SERVICE_ACCOUNT_KEY = defineSecret("GOOGLE_SERVICE_ACCOUNT_KEY");

// ============ 헬퍼 함수 ============

function firestoreToGcalEvent(data) {
  const event = {};
  event.summary = data.제목 || "제목 없음";
  if (data.상세내용) event.description = data.상세내용;

  const startDate = data.시작일;
  const endDate = data.종료일;
  const startTime = data.시작시간;
  const endTime = data.종료시간;
  const isAllDay = data.하루종일 || (!startTime && !endTime);

  if (isAllDay) {
    event.start = { date: startDate };
    event.end = { date: addOneDay(endDate) };
  } else {
    event.start = {
      dateTime: `${startDate}T${startTime || "00:00"}:00+09:00`,
      timeZone: "Asia/Seoul",
    };
    event.end = {
      dateTime: `${endDate}T${endTime || "23:59"}:00+09:00`,
      timeZone: "Asia/Seoul",
    };
  }
  return event;
}

function gcalToFirestoreEvent(gcalEvent, departmentId) {
  const isAllDay = !!gcalEvent.start?.date;
  let startDate, endDate, startTime = "", endTime = "";

  if (isAllDay) {
    startDate = gcalEvent.start.date;
    endDate = subtractOneDay(gcalEvent.end.date);
  } else {
    const startDt = new Date(gcalEvent.start.dateTime);
    const endDt = new Date(gcalEvent.end.dateTime);
    startDate = toKSTDateString(startDt);
    endDate = toKSTDateString(endDt);
    startTime = toKSTTimeString(startDt);
    endTime = toKSTTimeString(endDt);
  }

  return {
    제목: gcalEvent.summary || "제목 없음",
    상세내용: gcalEvent.description || "",
    참가자: "",
    부서ID: departmentId,
    부서ID목록: departmentId ? [departmentId] : [],
    시작일: startDate,
    종료일: endDate,
    시작시간: startTime,
    종료시간: endTime,
    하루종일: isAllDay,
    색상: "#4285F4",
    글자색: "#ffffff",
    테두리색: "#4285F4",
    작성자ID: "",
    작성자명: "Google Calendar",
    생성일시: gcalEvent.created || new Date().toISOString(),
    수정일시: gcalEvent.updated || new Date().toISOString(),
    버전: 1,
    참가현황: {},
    참조링크: gcalEvent.htmlLink || "",
    반복그룹ID: "",
    반복순서: 0,
    반복유형: "",
    연결그룹ID: "",
    구글캘린더ID: gcalEvent.id,
    구글캘린더소스: gcalEvent.organizer?.email || "", // 어느 캘린더에서 온 건지
  };
}

function addOneDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function subtractOneDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function toKSTDateString(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

function toKSTTimeString(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[1].substring(0, 5);
}

function getCalendarClient() {
  const g = getGoogle();
  const keyJson = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY.value());
  const auth = new g.auth.JWT(
    keyJson.client_email,
    null,
    keyJson.private_key,
    ["https://www.googleapis.com/auth/calendar"]
  );
  return g.calendar({ version: "v3", auth });
}

async function loadSyncSettings() {
  const db = getFirestore();
  const configDoc = await db.collection("system").doc("config").get();
  if (!configDoc.exists) return null;
  const settings = configDoc.data()?.gcalSync || null;
  if (!settings) return null;

  // 레거시 호환: 단일 calendarId → mappings 배열로 변환
  if (!settings.mappings && settings.calendarId) {
    settings.mappings = [{
      calendarId: settings.calendarId,
      departmentId: settings.syncDepartmentId || "",
    }];
  }
  return settings;
}

/**
 * 매핑에서 부서ID로 캘린더ID 찾기
 */
function findCalendarIdByDepartment(mappings, departmentId) {
  if (!mappings || !mappings.length) return null;
  const mapping = mappings.find(m => m.departmentId === departmentId);
  return mapping ? mapping.calendarId : null;
}

// ============ Cloud Functions ============

/**
 * Firestore onWrite 트리거:
 * 구글에서 온 일정(gcalEventId 있는)이 수정되면 → 구글에 push back
 * 앱 전용 일정(gcalEventId 없는)은 무시
 */
exports.syncEventToGcal = onDocumentWritten(
  {
    document: "events/{eventId}",
    region: "asia-northeast3",
    secrets: [GOOGLE_SERVICE_ACCOUNT_KEY],
  },
  async (event) => {
    const { eventId } = event.params;
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    const settings = await loadSyncSettings();
    if (!settings || !settings.enabled || !settings.mappings?.length) {
      return null;
    }

    const calendar = getCalendarClient();

    try {
      // === 삭제: 구글 연결 일정이 앱에서 삭제됨 ===
      if (!afterData && beforeData) {
        const gcalEventId = beforeData.구글캘린더ID;
        if (gcalEventId) {
          // 부서ID로 어느 캘린더인지 찾기
          const calendarId = findCalendarIdByDepartment(settings.mappings, beforeData.부서ID)
            || (beforeData.구글캘린더소스); // fallback: 소스 캘린더
          if (calendarId) {
            try {
              await calendar.events.delete({ calendarId, eventId: gcalEventId });
              logger.info(`[GCalSync] 삭제: ${eventId} → ${gcalEventId}`);
            } catch (err) {
              if (err.code !== 404 && err.code !== 410) throw err;
            }
          }
        }
        return null;
      }

      // === 수정: 구글 연결 일정만 push back ===
      if (afterData) {
        const existingGcalId = afterData.구글캘린더ID;
        if (!existingGcalId) return null; // 앱 전용 → 무시

        const calendarId = findCalendarIdByDepartment(settings.mappings, afterData.부서ID)
          || (afterData.구글캘린더소스);
        if (!calendarId) return null;

        const gcalEvent = firestoreToGcalEvent(afterData);
        try {
          await calendar.events.update({
            calendarId,
            eventId: existingGcalId,
            resource: gcalEvent,
          });
          logger.info(`[GCalSync] Push back: ${eventId} → ${existingGcalId} (${calendarId})`);
        } catch (err) {
          if (err.code !== 404 && err.code !== 410) throw err;
          logger.warn(`[GCalSync] GCal에서 이미 삭제됨: ${existingGcalId}`);
        }
      }
    } catch (error) {
      logger.error(`[GCalSync] 동기화 오류 (${eventId}):`, error);
    }

    return null;
  }
);

/**
 * HTTP Callable: 다중 캘린더에서 일정 가져오기 (pull)
 */
exports.triggerGcalSync = onCall(
  {
    region: "asia-northeast3",
    secrets: [GOOGLE_SERVICE_ACCOUNT_KEY],
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const db = getFirestore();
    const settings = await loadSyncSettings();
    if (!settings || !settings.enabled || !settings.mappings?.length) {
      throw new HttpsError("failed-precondition", "Google Calendar 동기화가 설정되지 않았습니다.");
    }

    await db.collection("system").doc("config").update({
      "gcalSync.lastSyncStatus": "running",
      "gcalSync.lastSyncAt": new Date().toISOString(),
    });

    const calendar = getCalendarClient();
    let totalCreated = 0, totalUpdated = 0, totalDeleted = 0, totalErrors = 0;
    const details = [];

    try {
      const now = new Date();
      const timeMin = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString();
      const timeMax = new Date(now.getFullYear() + 1, 11, 31).toISOString();

      // 각 매핑별로 동기화
      for (const mapping of settings.mappings) {
        const { calendarId, departmentId, label } = mapping;
        let created = 0, updated = 0, deleted = 0, errors = 0;

        try {
          // 1. Google Calendar에서 일정 가져오기
          let allGcalEvents = [];
          let pageToken = undefined;

          do {
            const res = await calendar.events.list({
              calendarId,
              timeMin,
              timeMax,
              maxResults: 2500,
              singleEvents: true,
              orderBy: "startTime",
              pageToken,
            });
            allGcalEvents = allGcalEvents.concat(res.data.items || []);
            pageToken = res.data.nextPageToken;
          } while (pageToken);

          // 2. Firestore에서 이 캘린더의 기존 일정 조회
          const existingSnapshot = await db.collection("events")
            .where("구글캘린더ID", "!=", "")
            .where("부서ID", "==", departmentId)
            .get();

          const existingMap = new Map();
          existingSnapshot.docs.forEach(doc => {
            const gcalId = doc.data().구글캘린더ID;
            if (gcalId) existingMap.set(gcalId, doc.id);
          });

          // 3. Google → Firestore
          const processedGcalIds = new Set();

          for (const gcalEvent of allGcalEvents) {
            if (!gcalEvent.id || gcalEvent.status === "cancelled") continue;
            processedGcalIds.add(gcalEvent.id);

            try {
              const firestoreData = gcalToFirestoreEvent(gcalEvent, departmentId);

              if (existingMap.has(gcalEvent.id)) {
                const docId = existingMap.get(gcalEvent.id);
                await db.collection("events").doc(docId).update({
                  제목: firestoreData.제목,
                  상세내용: firestoreData.상세내용,
                  시작일: firestoreData.시작일,
                  종료일: firestoreData.종료일,
                  시작시간: firestoreData.시작시간,
                  종료시간: firestoreData.종료시간,
                  하루종일: firestoreData.하루종일,
                  수정일시: new Date().toISOString(),
                });
                updated++;
              } else {
                await db.collection("events").add(firestoreData);
                created++;
              }
            } catch (err) {
              logger.error(`[GCalSync] Pull 오류 (${gcalEvent.id}):`, err);
              errors++;
            }
          }

          // 4. Google에서 삭제된 일정 → Firestore에서도 삭제
          for (const [gcalId, docId] of existingMap) {
            if (!processedGcalIds.has(gcalId)) {
              try {
                await db.collection("events").doc(docId).delete();
                deleted++;
              } catch (err) {
                errors++;
              }
            }
          }

          details.push({
            calendar: label || calendarId,
            created, updated, deleted, errors,
            total: allGcalEvents.length,
          });

        } catch (err) {
          logger.error(`[GCalSync] 캘린더 오류 (${calendarId}):`, err);
          details.push({
            calendar: label || calendarId,
            error: err.message,
          });
          totalErrors++;
        }

        totalCreated += created;
        totalUpdated += updated;
        totalDeleted += deleted;
        totalErrors += errors;
      }

      await db.collection("system").doc("config").update({
        "gcalSync.lastSyncStatus": "success",
        "gcalSync.lastSyncAt": new Date().toISOString(),
        "gcalSync.lastSyncError": "",
      });

      const msg = `생성 ${totalCreated}, 수정 ${totalUpdated}, 삭제 ${totalDeleted}, 실패 ${totalErrors} (${settings.mappings.length}개 캘린더)`;
      logger.info(`[GCalSync] ${msg}`);
      return { success: true, created: totalCreated, updated: totalUpdated, deleted: totalDeleted, errorCount: totalErrors, message: msg, details };
    } catch (error) {
      await db.collection("system").doc("config").update({
        "gcalSync.lastSyncStatus": "error",
        "gcalSync.lastSyncError": error.message || "알 수 없는 오류",
      });
      throw new HttpsError("internal", `동기화 실패: ${error.message}`);
    }
  }
);
