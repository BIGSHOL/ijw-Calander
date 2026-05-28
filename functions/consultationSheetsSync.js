/**
 * 상담 등록 → Google Sheets 동기화
 *
 * 트리거: Firestore `consultations/{id}` 문서 생성 시
 * 대상: https://docs.google.com/spreadsheets/d/1ENoJBr44fFLSAvs5pCQAfrlXMdnKMrPwH_IgSfA6rQg/
 * 인증: googleCalendarSync / timetableSheetsSync와 동일한 GOOGLE_SERVICE_ACCOUNT_KEY 재사용
 *
 * 시트 컬럼 매핑 (A~W):
 *   A 학생이름   B 학생 연락처  C 성별   D 학교    E 학교 구분
 *   F 학년       G 희망진로     H 부/모  I 부모님 성함  J 부모님 연락처
 *   K 주소       L 상담경로     M 인터넷(경로)  N 지인소개(경로)  O 기타(경로)
 *   P 상담완료 과목  Q 상담기록  R 셔틀버스 신청  S 셔틀버스#  T 정류장
 *   U 상태       V 예외        W 사유
 *
 * Q열(상담기록) 포맷:
 *   [기타 인적사항]
 *   - 상담일: ...
 *   - 상담자: ...
 *   - 남매: ...
 *   - 메모:
 *   {multi-line content}
 *
 *   MATH
 *
 *   [수학 상담]
 *   - 레테 수기입력 ✏️:
 *   {score line}
 *   - 학원 히스토리:
 *   {content}
 *   - 학습 진도:
 *   {content}
 *   - 시험 성적:
 *   {content}
 *   - 상담 내역:
 *   {content}
 *   - 추천반: ...
 *   - 담임: ...
 *   - 첫 수업일: ...
 *
 *   ENGLISH
 *
 *   [영어 상담]
 *   ...
 */

const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

let _google = null;
function getGoogle() {
    if (!_google) _google = require("googleapis").google;
    return _google;
}

const GOOGLE_SERVICE_ACCOUNT_KEY = defineSecret("GOOGLE_SERVICE_ACCOUNT_KEY");

const TARGET_SPREADSHEET_ID = "1ENoJBr44fFLSAvs5pCQAfrlXMdnKMrPwH_IgSfA6rQg";

function getAuthClient() {
    const g = getGoogle();
    const keyJson = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY.value());
    return new g.auth.JWT(
        keyJson.client_email,
        null,
        keyJson.private_key,
        ["https://www.googleapis.com/auth/spreadsheets"]
    );
}

function getSheetsClient(auth) {
    return getGoogle().sheets({ version: "v4", auth });
}

// ============ Helpers ============

function nonEmpty(v) {
    return v !== undefined && v !== null && String(v).trim() !== "";
}

function isDetailFilled(detail) {
    if (!detail || typeof detail !== "object") return false;
    return Object.values(detail).some(nonEmpty);
}

function genderKr(g) {
    if (g === "male" || g === "남") return "남";
    if (g === "female" || g === "여") return "여";
    return "";
}

function schoolTypeFromGrade(grade) {
    if (!grade) return "";
    const s = String(grade);
    if (s.startsWith("초")) return "초등학교";
    if (s.startsWith("중")) return "중학교";
    if (s.startsWith("고")) return "고등학교";
    return "";
}

function joinAddress(a, b) {
    return [a, b].filter(nonEmpty).join(" ");
}

// 라벨 + 다음 줄 내용 (multi-line 텍스트용)
function blockLine(label, content) {
    return `- ${label}:\n${content}`;
}

// 라벨 + 같은 줄 값 (single-value용)
function inlineLine(label, value) {
    return `- ${label}: ${value}`;
}

// ============ Level Test Compact Format ============

function buildMathLevelTest(detail) {
    const head = [];
    if (nonEmpty(detail.myTotalScore)) head.push(detail.myTotalScore + "점");
    if (nonEmpty(detail.scoreGrade)) head.push(detail.scoreGrade + "등급");
    if (nonEmpty(detail.averageScore)) head.push("평균 " + detail.averageScore);
    const sub = [];
    if (nonEmpty(detail.calculationScore)) sub.push("계" + detail.calculationScore);
    if (nonEmpty(detail.comprehensionScore)) sub.push("이" + detail.comprehensionScore);
    if (nonEmpty(detail.reasoningScore)) sub.push("추" + detail.reasoningScore);
    if (nonEmpty(detail.problemSolvingScore)) sub.push("문제" + detail.problemSolvingScore);
    if (head.length === 0 && sub.length === 0) {
        // 별도 levelTestScore 텍스트 필드 폴백
        return nonEmpty(detail.levelTestScore) ? detail.levelTestScore : "";
    }
    let s = head.join(", ");
    if (sub.length) s += (s ? "  " : "") + sub.join(", ");
    return s;
}

function buildEnglishLevelTest(detail) {
    const lines = [];
    if (detail.englishTestType === "ai") {
        const head = [];
        if (nonEmpty(detail.engLevel)) head.push("Lv " + detail.engLevel);
        if (nonEmpty(detail.engAiGradeLevel)) head.push("학년수준 " + detail.engAiGradeLevel);
        if (nonEmpty(detail.engAiArIndex)) head.push("AR " + detail.engAiArIndex);
        if (nonEmpty(detail.engAiTopPercent)) head.push("상위% " + detail.engAiTopPercent);
        if (head.length) lines.push("AI 종합: " + head.join(", "));
        const skills = [];
        if (nonEmpty(detail.engAiWordMy) || nonEmpty(detail.engAiWordAvg)) skills.push(`Word ${detail.engAiWordMy || "-"}/${detail.engAiWordAvg || "-"}`);
        if (nonEmpty(detail.engAiListenMy) || nonEmpty(detail.engAiListenAvg)) skills.push(`Listen ${detail.engAiListenMy || "-"}/${detail.engAiListenAvg || "-"}`);
        if (nonEmpty(detail.engAiReadMy) || nonEmpty(detail.engAiReadAvg)) skills.push(`Read ${detail.engAiReadMy || "-"}/${detail.engAiReadAvg || "-"}`);
        if (nonEmpty(detail.engAiWriteMy) || nonEmpty(detail.engAiWriteAvg)) skills.push(`Write ${detail.engAiWriteMy || "-"}/${detail.engAiWriteAvg || "-"}`);
        if (skills.length) lines.push("AI 세부(나/평균): " + skills.join(", "));
    } else if (detail.englishTestType === "nelt") {
        const head = [];
        if (nonEmpty(detail.engLevel)) head.push("Lv " + detail.engLevel);
        if (nonEmpty(detail.engNeltOverallLevel)) head.push("종합 " + detail.engNeltOverallLevel);
        if (nonEmpty(detail.engNeltRank)) head.push("석차 " + detail.engNeltRank);
        if (head.length) lines.push("NELT 종합: " + head.join(", "));
        const skills = [];
        if (nonEmpty(detail.engNeltVocab)) skills.push("어휘 " + detail.engNeltVocab);
        if (nonEmpty(detail.engNeltGrammar)) skills.push("문법 " + detail.engNeltGrammar);
        if (nonEmpty(detail.engNeltListening)) skills.push("듣기 " + detail.engNeltListening);
        if (nonEmpty(detail.engNeltReading)) skills.push("독해 " + detail.engNeltReading);
        if (skills.length) lines.push("NELT 세부: " + skills.join(", "));
    } else if (detail.englishTestType === "eie") {
        const head = [];
        if (nonEmpty(detail.engLevel)) head.push("Lv " + detail.engLevel);
        if (nonEmpty(detail.engEieGradeLevel)) head.push("학년수준 " + detail.engEieGradeLevel);
        if (nonEmpty(detail.engEieVocabLevel)) head.push("어휘수준 " + detail.engEieVocabLevel);
        if (nonEmpty(detail.engEieRank)) head.push("동학년순위 " + detail.engEieRank);
        if (head.length) lines.push("EiE 종합: " + head.join(", "));
        const chart = [];
        if (nonEmpty(detail.engEieCourse)) chart.push("과정 " + detail.engEieCourse);
        if (nonEmpty(detail.engEieChartLevel)) chart.push("레벨 " + detail.engEieChartLevel);
        if (nonEmpty(detail.engEieTextbook)) chart.push("교재 " + detail.engEieTextbook);
        if (chart.length) lines.push("EiE 차트: " + chart.join(", "));
        const skills = [];
        if (nonEmpty(detail.engEieVocabMy) || nonEmpty(detail.engEieVocabAvg)) skills.push(`Vocab ${detail.engEieVocabMy || "-"}/${detail.engEieVocabAvg || "-"}`);
        if (nonEmpty(detail.engEieListenMy) || nonEmpty(detail.engEieListenAvg)) skills.push(`Listen ${detail.engEieListenMy || "-"}/${detail.engEieListenAvg || "-"}`);
        if (nonEmpty(detail.engEieReadMy) || nonEmpty(detail.engEieReadAvg)) skills.push(`Read ${detail.engEieReadMy || "-"}/${detail.engEieReadAvg || "-"}`);
        if (nonEmpty(detail.engEieGrammarMy) || nonEmpty(detail.engEieGrammarAvg)) skills.push(`Grammar ${detail.engEieGrammarMy || "-"}/${detail.engEieGrammarAvg || "-"}`);
        if (skills.length) lines.push("EiE 세부(나/평균): " + skills.join(", "));
    } else if (nonEmpty(detail.levelTestScore)) {
        return detail.levelTestScore;
    }
    return lines.join("\n");
}

function buildGenericLevelTest(detail) {
    return nonEmpty(detail.levelTestScore) ? detail.levelTestScore : "";
}

// ============ Subject Block ============

const SUBJECT_META = {
    math:    { header: "MATH",    label: "수학", lt: buildMathLevelTest    },
    english: { header: "ENGLISH", label: "영어", lt: buildEnglishLevelTest },
    korean:  { header: "KOREAN",  label: "국어", lt: buildGenericLevelTest },
    science: { header: "SCIENCE", label: "과학", lt: buildGenericLevelTest },
    etc:     { header: "ETC",     label: "기타", lt: buildGenericLevelTest },
};

function buildSubjectBlock(subjectKey, detail) {
    if (!isDetailFilled(detail)) return "";
    const meta = SUBJECT_META[subjectKey];
    const lines = [];

    // 레벨테스트
    const ltText = meta.lt(detail);
    if (nonEmpty(ltText)) {
        lines.push("- 레테 수기입력 ✏️:");
        lines.push(ltText);
    }

    // 다중행 텍스트 필드 (라벨 다음 줄에 내용)
    if (nonEmpty(detail.academyHistory))       { lines.push("- 학원 히스토리:");  lines.push(detail.academyHistory); }
    if (nonEmpty(detail.learningProgress))     { lines.push("- 학습 진도:");      lines.push(detail.learningProgress); }
    if (nonEmpty(detail.examResults))          { lines.push("- 시험 성적:");      lines.push(detail.examResults); }
    if (nonEmpty(detail.consultationHistory))  { lines.push("- 상담 내역:");      lines.push(detail.consultationHistory); }

    // 단일값 필드 (라벨 같은 줄)
    if (nonEmpty(detail.recommendedClass)) lines.push(inlineLine("추천반", detail.recommendedClass));
    if (nonEmpty(detail.homeRoomTeacher))  lines.push(inlineLine("담임",   detail.homeRoomTeacher));
    if (nonEmpty(detail.firstClassDate))   lines.push(inlineLine("첫 수업일", detail.firstClassDate));

    if (lines.length === 0) return "";

    return `${meta.header}\n\n[${meta.label} 상담]\n${lines.join("\n")}`;
}

// ============ 기타 인적사항 Block ============

function buildPersonalBlock(c) {
    const lines = [];
    if (nonEmpty(c.consultationDate)) lines.push(inlineLine("상담일", c.consultationDate));
    if (nonEmpty(c.counselor))        lines.push(inlineLine("상담자", c.counselor));
    if (nonEmpty(c.receiver))         lines.push(inlineLine("수신자", c.receiver));

    // 남매: 라벨은 항상 표시 (값 없어도)
    const sibVal = [c.siblings, c.siblingsDetails].filter(nonEmpty).join(" ");
    lines.push(inlineLine("남매", sibVal));

    if (nonEmpty(c.notes))                 { lines.push("- 메모:");        lines.push(c.notes); }
    if (nonEmpty(c.safetyNotes))           { lines.push("- 안전사항:");    lines.push(c.safetyNotes); }
    if (nonEmpty(c.enrollmentReason))      { lines.push("- 입학 동기:");   lines.push(c.enrollmentReason); }
    if (nonEmpty(c.nonRegistrationReason)) { lines.push("- 미등록 사유:"); lines.push(c.nonRegistrationReason); }
    if (nonEmpty(c.followUpDate))          lines.push(inlineLine("후속 조치일", c.followUpDate));
    if (nonEmpty(c.followUpContent))       { lines.push("- 후속 조치:");   lines.push(c.followUpContent); }

    return "[기타 인적사항]\n" + lines.join("\n");
}

function buildConsultationRecord(c) {
    const blocks = [];
    blocks.push(buildPersonalBlock(c));
    for (const key of ["math", "english", "korean", "science", "etc"]) {
        const detailKey = key === "etc" ? "etcConsultation" : `${key}Consultation`;
        const block = buildSubjectBlock(key, c[detailKey]);
        if (block) blocks.push(block);
    }
    return blocks.join("\n\n");
}

function buildCompletedSubjects(c) {
    const arr = [];
    if (isDetailFilled(c.mathConsultation))    arr.push("수학");
    if (isDetailFilled(c.englishConsultation)) arr.push("영어");
    if (isDetailFilled(c.koreanConsultation))  arr.push("국어");
    if (isDetailFilled(c.scienceConsultation)) arr.push("과학");
    if (isDetailFilled(c.etcConsultation))     arr.push("기타");
    return arr.join(" ");
}

// ============ Row Builder ============

function buildRow(c) {
    return [
        c.studentName || "",                                          // A
        c.studentPhone || c.parentPhone || "",                        // B
        genderKr(c.gender),                                           // C
        c.schoolName || "",                                           // D
        schoolTypeFromGrade(c.grade),                                 // E
        c.grade || "",                                                // F
        c.careerGoal || "",                                           // G
        c.parentRelation || "",                                       // H
        c.parentName || "",                                           // I
        c.parentPhone || "",                                          // J
        joinAddress(c.address, c.addressDetail),                      // K
        c.consultationPath || "",                                     // L
        "",                                                           // M 인터넷(경로)
        "",                                                           // N 지인소개(경로)
        "",                                                           // O 기타(경로)
        buildCompletedSubjects(c),                                    // P
        buildConsultationRecord(c),                                   // Q
        c.shuttleBusRequest ? "신청" : "미신청",                       // R
        "",                                                           // S
        "",                                                           // T
        "성공",                                                       // U
        "",                                                           // V
        "",                                                           // W
    ];
}

// ============ Sheets API ============

async function appendConsultationRow(consultation) {
    const auth = getAuthClient();
    await auth.authorize();
    const sheets = getSheetsClient(auth);
    const row = buildRow(consultation);
    const res = await sheets.spreadsheets.values.append({
        spreadsheetId: TARGET_SPREADSHEET_ID,
        range: "A1",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
    });
    logger.info("[consultationSheetsSync] appended row, updatedRange=" + (res.data?.updates?.updatedRange || ""));
    return res.data;
}

module.exports = {
    GOOGLE_SERVICE_ACCOUNT_KEY,
    appendConsultationRow,
    buildRow,
    buildConsultationRecord,
    buildCompletedSubjects,
};