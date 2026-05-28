/**
 * 상담 등록 → Google Sheets 동기화
 *
 * 트리거: Firestore `consultations/{id}` 문서 생성 시
 * 대상: https://docs.google.com/spreadsheets/d/1ENoJBr44fFLSAvs5pCQAfrlXMdnKMrPwH_IgSfA6rQg/
 * 인증: googleCalendarSync / timetableSheetsSync와 동일한 GOOGLE_SERVICE_ACCOUNT_KEY 재사용
 *
 * 시트 컬럼 매핑 (A~W):
 *   A 학생이름        B 학생 연락처       C 성별         D 학교
 *   E 학교 구분       F 학년             G 희망진로     H 부/모
 *   I 부모님 성함     J 부모님 연락처     K 주소         L 상담경로
 *   M 인터넷(경로)    N 지인소개(경로)    O 기타(경로)   P 상담완료 과목
 *   Q 상담기록        R 셔틀버스 신청     S 셔틀버스#    T 정류장
 *   U 상태            V 예외             W 사유
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

function pushIf(arr, cond, line) {
    if (cond) arr.push(line);
}

// ============ Subject Block Builders ============

function buildMathBlock(detail) {
    if (!isDetailFilled(detail)) return "";
    const lines = [];
    const lt = [];
    if (nonEmpty(detail.calculationScore)) lt.push("계산력 " + detail.calculationScore);
    if (nonEmpty(detail.comprehensionScore)) lt.push("이해력 " + detail.comprehensionScore);
    if (nonEmpty(detail.reasoningScore)) lt.push("추론력 " + detail.reasoningScore);
    if (nonEmpty(detail.problemSolvingScore)) lt.push("문제해결력 " + detail.problemSolvingScore);
    if (nonEmpty(detail.myTotalScore)) lt.push("내 점수 " + detail.myTotalScore);
    if (nonEmpty(detail.averageScore)) lt.push("평균 " + detail.averageScore);
    if (nonEmpty(detail.scoreGrade)) lt.push("등급 " + detail.scoreGrade);
    if (lt.length) lines.push("- 레벨테스트: " + lt.join(", "));
    pushIf(lines, nonEmpty(detail.academyHistory), "- 학원 히스토리: " + detail.academyHistory);
    pushIf(lines, nonEmpty(detail.learningProgress), "- 학습 진도: " + detail.learningProgress);
    pushIf(lines, nonEmpty(detail.examResults), "- 학생 시험 성적: " + detail.examResults);
    pushIf(lines, nonEmpty(detail.consultationHistory), "- 학생 상담 내역: " + detail.consultationHistory);
    pushIf(lines, nonEmpty(detail.recommendedClass), "- 추천반: " + detail.recommendedClass);
    pushIf(lines, nonEmpty(detail.homeRoomTeacher), "- 담임: " + detail.homeRoomTeacher);
    pushIf(lines, nonEmpty(detail.firstClassDate), "- 첫 수업일: " + detail.firstClassDate);
    if (lines.length === 0) return "";
    return "[수학 상담]\n" + lines.join("\n");
}

function buildEnglishBlock(detail) {
    if (!isDetailFilled(detail)) return "";
    const lines = [];

    // 시험 종류별 점수 라인
    if (detail.englishTestType === "ai") {
        const sub = [];
        if (nonEmpty(detail.engLevel)) sub.push("Lv " + detail.engLevel);
        if (nonEmpty(detail.engAiGradeLevel)) sub.push("학년수준 " + detail.engAiGradeLevel);
        if (nonEmpty(detail.engAiArIndex)) sub.push("AR " + detail.engAiArIndex);
        if (nonEmpty(detail.engAiTopPercent)) sub.push("상위% " + detail.engAiTopPercent);
        if (sub.length) lines.push("- AI 종합: " + sub.join(", "));
        const skills = [];
        if (nonEmpty(detail.engAiWordMy) || nonEmpty(detail.engAiWordAvg)) skills.push(`Word ${detail.engAiWordMy || "-"}/${detail.engAiWordAvg || "-"}`);
        if (nonEmpty(detail.engAiListenMy) || nonEmpty(detail.engAiListenAvg)) skills.push(`Listen ${detail.engAiListenMy || "-"}/${detail.engAiListenAvg || "-"}`);
        if (nonEmpty(detail.engAiReadMy) || nonEmpty(detail.engAiReadAvg)) skills.push(`Read ${detail.engAiReadMy || "-"}/${detail.engAiReadAvg || "-"}`);
        if (nonEmpty(detail.engAiWriteMy) || nonEmpty(detail.engAiWriteAvg)) skills.push(`Write ${detail.engAiWriteMy || "-"}/${detail.engAiWriteAvg || "-"}`);
        if (skills.length) lines.push("- AI 세부 (나/평균): " + skills.join(", "));
    } else if (detail.englishTestType === "nelt") {
        const sub = [];
        if (nonEmpty(detail.engLevel)) sub.push("Lv " + detail.engLevel);
        if (nonEmpty(detail.engNeltOverallLevel)) sub.push("종합 " + detail.engNeltOverallLevel);
        if (nonEmpty(detail.engNeltRank)) sub.push("석차 " + detail.engNeltRank);
        if (sub.length) lines.push("- NELT 종합: " + sub.join(", "));
        const skills = [];
        if (nonEmpty(detail.engNeltVocab)) skills.push("어휘 " + detail.engNeltVocab);
        if (nonEmpty(detail.engNeltGrammar)) skills.push("문법 " + detail.engNeltGrammar);
        if (nonEmpty(detail.engNeltListening)) skills.push("듣기 " + detail.engNeltListening);
        if (nonEmpty(detail.engNeltReading)) skills.push("독해 " + detail.engNeltReading);
        if (skills.length) lines.push("- NELT 세부: " + skills.join(", "));
    } else if (detail.englishTestType === "eie") {
        const sub = [];
        if (nonEmpty(detail.engLevel)) sub.push("Lv " + detail.engLevel);
        if (nonEmpty(detail.engEieGradeLevel)) sub.push("학년수준 " + detail.engEieGradeLevel);
        if (nonEmpty(detail.engEieVocabLevel)) sub.push("어휘수준 " + detail.engEieVocabLevel);
        if (nonEmpty(detail.engEieRank)) sub.push("동학년순위 " + detail.engEieRank);
        if (sub.length) lines.push("- EiE 종합: " + sub.join(", "));
        const chart = [];
        if (nonEmpty(detail.engEieCourse)) chart.push("과정 " + detail.engEieCourse);
        if (nonEmpty(detail.engEieChartLevel)) chart.push("레벨 " + detail.engEieChartLevel);
        if (nonEmpty(detail.engEieTextbook)) chart.push("교재 " + detail.engEieTextbook);
        if (chart.length) lines.push("- EiE 차트: " + chart.join(", "));
        const skills = [];
        if (nonEmpty(detail.engEieVocabMy) || nonEmpty(detail.engEieVocabAvg)) skills.push(`Vocab ${detail.engEieVocabMy || "-"}/${detail.engEieVocabAvg || "-"}`);
        if (nonEmpty(detail.engEieListenMy) || nonEmpty(detail.engEieListenAvg)) skills.push(`Listen ${detail.engEieListenMy || "-"}/${detail.engEieListenAvg || "-"}`);
        if (nonEmpty(detail.engEieReadMy) || nonEmpty(detail.engEieReadAvg)) skills.push(`Read ${detail.engEieReadMy || "-"}/${detail.engEieReadAvg || "-"}`);
        if (nonEmpty(detail.engEieGrammarMy) || nonEmpty(detail.engEieGrammarAvg)) skills.push(`Grammar ${detail.engEieGrammarMy || "-"}/${detail.engEieGrammarAvg || "-"}`);
        if (skills.length) lines.push("- EiE 세부 (나/평균): " + skills.join(", "));
    } else if (nonEmpty(detail.levelTestScore)) {
        lines.push("- 레벨테스트: " + detail.levelTestScore);
    }

    pushIf(lines, nonEmpty(detail.academyHistory), "- 학원 히스토리: " + detail.academyHistory);
    pushIf(lines, nonEmpty(detail.learningProgress), "- 학습 진도: " + detail.learningProgress);
    pushIf(lines, nonEmpty(detail.examResults), "- 학생 시험 성적: " + detail.examResults);
    pushIf(lines, nonEmpty(detail.consultationHistory), "- 학생 상담 내역: " + detail.consultationHistory);
    pushIf(lines, nonEmpty(detail.recommendedClass), "- 추천반: " + detail.recommendedClass);
    pushIf(lines, nonEmpty(detail.homeRoomTeacher), "- 담임: " + detail.homeRoomTeacher);
    pushIf(lines, nonEmpty(detail.firstClassDate), "- 첫 수업일: " + detail.firstClassDate);
    if (lines.length === 0) return "";
    return "[영어 상담]\n" + lines.join("\n");
}

function buildGenericSubjectBlock(label, detail) {
    if (!isDetailFilled(detail)) return "";
    const lines = [];
    if (nonEmpty(detail.levelTestScore)) lines.push("- 레벨테스트: " + detail.levelTestScore);
    pushIf(lines, nonEmpty(detail.academyHistory), "- 학원 히스토리: " + detail.academyHistory);
    pushIf(lines, nonEmpty(detail.learningProgress), "- 학습 진도: " + detail.learningProgress);
    pushIf(lines, nonEmpty(detail.examResults), "- 학생 시험 성적: " + detail.examResults);
    pushIf(lines, nonEmpty(detail.consultationHistory), "- 학생 상담 내역: " + detail.consultationHistory);
    pushIf(lines, nonEmpty(detail.recommendedClass), "- 추천반: " + detail.recommendedClass);
    pushIf(lines, nonEmpty(detail.homeRoomTeacher), "- 담임: " + detail.homeRoomTeacher);
    pushIf(lines, nonEmpty(detail.firstClassDate), "- 첫 수업일: " + detail.firstClassDate);
    if (lines.length === 0) return "";
    return "[" + label + " 상담]\n" + lines.join("\n");
}

// ============ Row Builders ============

function buildPersonalBlock(c) {
    const lines = [];
    pushIf(lines, nonEmpty(c.consultationDate), "- 상담일: " + c.consultationDate);
    pushIf(lines, nonEmpty(c.counselor), "- 상담자: " + c.counselor);
    pushIf(lines, nonEmpty(c.receiver), "- 수신자: " + c.receiver);
    pushIf(lines, nonEmpty(c.siblings), "- 남매: " + c.siblings + (nonEmpty(c.siblingsDetails) ? " / " + c.siblingsDetails : ""));
    pushIf(lines, nonEmpty(c.safetyNotes), "- 안전사항: " + c.safetyNotes);
    pushIf(lines, nonEmpty(c.enrollmentReason), "- 입학 동기: " + c.enrollmentReason);
    pushIf(lines, nonEmpty(c.notes), "- 메모: " + c.notes);
    pushIf(lines, nonEmpty(c.nonRegistrationReason), "- 미등록 사유: " + c.nonRegistrationReason);
    pushIf(lines, nonEmpty(c.followUpDate), "- 후속 조치일: " + c.followUpDate);
    pushIf(lines, nonEmpty(c.followUpContent), "- 후속 조치: " + c.followUpContent);
    if (lines.length === 0) return "";
    return "[기타 인적사항]\n" + lines.join("\n");
}

function buildConsultationRecord(c) {
    const blocks = [];
    const personal = buildPersonalBlock(c);
    if (personal) blocks.push(personal);
    const m = buildMathBlock(c.mathConsultation); if (m) blocks.push(m);
    const e = buildEnglishBlock(c.englishConsultation); if (e) blocks.push(e);
    const k = buildGenericSubjectBlock("국어", c.koreanConsultation); if (k) blocks.push(k);
    const s = buildGenericSubjectBlock("과학", c.scienceConsultation); if (s) blocks.push(s);
    const etc = buildGenericSubjectBlock("기타", c.etcConsultation); if (etc) blocks.push(etc);
    return blocks.join("\n\n");
}

function buildCompletedSubjects(c) {
    const arr = [];
    if (isDetailFilled(c.mathConsultation)) arr.push("수학");
    if (isDetailFilled(c.englishConsultation)) arr.push("영어");
    if (isDetailFilled(c.koreanConsultation)) arr.push("국어");
    if (isDetailFilled(c.scienceConsultation)) arr.push("과학");
    if (isDetailFilled(c.etcConsultation)) arr.push("기타");
    return arr.join(" ");
}

function buildRow(c) {
    return [
        c.studentName || "",                                          // A
        c.studentPhone || c.parentPhone || "",                        // B (학생연락처 우선)
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
        "",                                                           // M 인터넷(경로) — 폼에 별도 필드 없음
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

// ============ Sheets API call ============

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
    buildRow,            // test용 export
    buildConsultationRecord,
    buildCompletedSubjects,
};