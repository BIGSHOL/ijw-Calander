/**
 * Server-side 시간표 ExcelJS 내보내기 — 래퍼 (단일 소스)
 *
 * ★ 단일 소스 원칙 ★
 * 시간표 xlsx 생성 로직은 클라이언트 `components/Timetable/Math/utils/excelExport.ts`
 * 한 곳에만 존재한다. esbuild가 그것을 `generated/timetableExporterCore.cjs`로 번들하고,
 * 이 래퍼가 그 번들을 require하여 호출한다.
 *   → 자동 동기화(서버)와 "엑셀 내보내기" / "지금 동기화"(클라이언트, 방식 A)가
 *     항상 100% 동일한 xlsx를 생성한다. 예전처럼 서버용 레이아웃 코드를 별도로
 *     유지하지 않으므로, 레이아웃을 한쪽만 고쳐 어긋나는 문제가 원천 차단된다.
 *
 * 번들 재생성:
 *   - 수동: `npm run build:exporter` (프로젝트 루트에서)
 *   - 자동: `firebase deploy --only functions` 시 predeploy 훅이 실행
 *           (firebase.json functions.predeploy 참조)
 *
 * 호출:
 *   const { exportMathTimetableToBuffer } = require('./timetableExporter');
 *   const buf = await exportMathTimetableToBuffer({ ...exportParams });  // Returns Buffer
 */

const { exportMathTimetableToExcel } = require("./generated/timetableExporterCore.cjs");

/**
 * teacherIdFilter / teacherNameFilter가 주어지면 해당 강사가 담임 또는 부담임인 수업만 반환.
 * 담임: cls.staffId === teacherIdFilter (또는 cls.teacher === teacherNameFilter)
 * 부담임: cls.slotTeachers의 어떤 값이라도 teacherNameFilter와 일치
 */
function filterClassesByTeacher(classes, teacherIdFilter, teacherNameFilter) {
    if (!teacherIdFilter && !teacherNameFilter) return classes;
    return classes.filter(cls => {
        // 담임 매칭
        if (teacherIdFilter && cls.staffId === teacherIdFilter) return true;
        if (teacherNameFilter && (cls.teacher || "").trim() === teacherNameFilter.trim()) return true;
        // 부담임 매칭 (slotTeachers)
        if (teacherNameFilter && cls.slotTeachers) {
            const found = Object.values(cls.slotTeachers).some(
                t => (t || "").trim() === teacherNameFilter.trim()
            );
            if (found) return true;
        }
        return false;
    });
}

/**
 * 수학 시간표를 xlsx Buffer로 생성 (Drive API 업로드용).
 *
 * 클라이언트 excelExport.ts의 exportMathTimetableToExcel를 returnBufferOnly 옵션으로 호출한다.
 *
 * @param {object} params - timetableDataCollector가 만든 exportParams
 *   (weekLabel, filteredClasses, allResources, orderedSelectedDays, weekDates,
 *    teachers, currentPeriods, subjectFilter, referenceDate)
 *   + 선택적 강사 필터: teacherIdFilter, teacherNameFilter (강사별 시트용)
 * @returns {Promise<Buffer>} xlsx Buffer
 */
async function exportMathTimetableToBuffer(params) {
    let filteredClasses = params.filteredClasses;
    let allResources = params.allResources;

    // 강사별 시트: 담임 + 부담임 수업만, 강사 본인만 표시
    if (params.teacherIdFilter || params.teacherNameFilter) {
        filteredClasses = filterClassesByTeacher(
            filteredClasses, params.teacherIdFilter, params.teacherNameFilter
        );
        if (params.teacherNameFilter) {
            allResources = (allResources || []).filter(
                r => (r || "").trim() === params.teacherNameFilter.trim()
            );
        }
    }

    const result = await exportMathTimetableToExcel({
        ...params,
        filteredClasses,
        allResources,
        returnBufferOnly: true,
    });

    if (!result) {
        throw new Error("시간표 xlsx 생성 실패 (빈 결과)");
    }
    // Node의 ExcelJS writeBuffer()는 Buffer를 반환하지만, ArrayBuffer일 수도 있으므로 통일.
    return Buffer.from(result);
}

module.exports = {
    exportMathTimetableToBuffer,
    filterClassesByTeacher,
};
