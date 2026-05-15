/**
 * Server-side 시간표 ExcelJS 내보내기
 *
 * 클라이언트 `components/Timetable/Math/utils/excelExport.ts` (1230줄)를 JS로 포팅.
 * 차이점:
 * - Node.js 환경 (Buffer 반환, 클라이언트 download 로직 제거)
 * - `teacherIdFilter` 옵션 추가 → 강사별 시트 생성 시 사용 (담임+부담임)
 * - 의존 헬퍼(getClassesForCell, isSameClassNameSet, formatSchoolGrade, 상수)를
 *   자체 포함하여 외부 의존성 최소화
 *
 * 호출:
 *   const { exportMathTimetableToBuffer } = require('./timetableExporter');
 *   const buf = await exportMathTimetableToBuffer({ ... });  // Returns Buffer
 */

const ExcelJS = require("exceljs");

// ============ 상수 (components/Timetable/constants.ts에서 복제) ============

const MATH_GROUPED_PERIODS = ["1", "2", "3", "4"];

const MATH_GROUP_PERIOD_IDS = {
    "1": ["1-1", "1-2"],
    "2": ["2-1", "2-2"],
    "3": ["3-1", "3-2"],
    "4": ["4-1", "4-2"],
};

const MATH_GROUP_DISPLAY = {
    "1": { label: "1교시", time: "14:30~16:20" },
    "2": { label: "2교시", time: "16:20~18:10" },
    "3": { label: "3교시", time: "18:20~20:10" },
    "4": { label: "4교시", time: "20:10~22:00" },
};

const LEGACY_TO_UNIFIED_PERIOD_MAP = {
    "1-1": "1", "1-2": "2",
    "2-1": "3", "2-2": "4",
    "3-1": "5", "3-2": "6",
    "4-1": "7", "4-2": "8",
    "1": "1", "2": "2", "3": "3", "4": "4",
    "5": "5", "6": "6", "7": "7", "8": "8",
};

const WEEKEND_PERIOD_TIMES = {
    "1-1": "09:00~10:00",
    "1-2": "10:00~11:00",
    "2-1": "11:00~12:00",
    "2-2": "12:00~13:00",
    "3-1": "13:00~14:00",
    "3-2": "14:00~15:00",
    "4-1": "15:00~16:00",
    "4-2": "16:00~17:00",
};

const convertLegacyPeriodId = (legacyId) => LEGACY_TO_UNIFIED_PERIOD_MAP[legacyId] || legacyId;

// ============ 헬퍼 함수 (utils/studentUtils.ts + gridUtils.ts에서 복제) ============

const getGradeNumber = (grade) => {
    if (!grade) return "";
    const match = grade.match(/\d+/);
    return match ? match[0] : grade;
};

const getGradeLevel = (grade) => {
    if (!grade) return "";
    if (grade.startsWith("초") || grade.includes("초등")) return "초";
    if (grade.startsWith("중") || grade.includes("중학")) return "중";
    if (grade.startsWith("고") || grade.includes("고등")) return "고";
    return "";
};

const formatSchoolGrade = (school, grade) => {
    const schoolStr = (school || "").trim();
    const gradeStr = (grade || "").trim();
    if (!schoolStr && !gradeStr) return "-";
    if (!schoolStr) return gradeStr || "-";
    if (!gradeStr) return schoolStr;

    const gradeNum = getGradeNumber(gradeStr);
    const gradeLevel = getGradeLevel(gradeStr);

    const schoolEndsWithLevel =
        schoolStr.endsWith("초") || schoolStr.endsWith("중") || schoolStr.endsWith("고");

    if (schoolEndsWithLevel) return `${gradeNum}${schoolStr}`;
    if (gradeLevel) return `${gradeStr}${schoolStr}`;
    return `${gradeNum}${schoolStr}`;
};

const getClassesForCell = (filteredClasses, day, period, resource, viewType) => {
    return filteredClasses.filter(cls => {
        const targetSlot = `${day}${period}`.replace(/\s+/g, "");
        const scheduleMatch = (cls.schedule || []).some(s => {
            if (typeof s !== "string") return false;
            const normalizedS = s.replace(/\s+/g, "");
            return normalizedS === targetSlot || normalizedS.startsWith(`${targetSlot}-`);
        });
        if (!scheduleMatch) return false;

        if (viewType === "teacher") {
            const normalizedPeriod = convertLegacyPeriodId(period);
            const slotKey = `${day}-${normalizedPeriod}`;
            const slotTeacher = cls.slotTeachers && cls.slotTeachers[slotKey];
            const effectiveTeacher = slotTeacher || cls.teacher;
            return (effectiveTeacher || "").trim() === (resource || "").trim();
        } else {
            const normalizedPeriod = convertLegacyPeriodId(period);
            const slotKey = `${day}-${normalizedPeriod}`;
            const slotRoom = cls.slotRooms && cls.slotRooms[slotKey];
            const effectiveRoom = slotRoom || cls.room;
            return (effectiveRoom || "").trim() === (resource || "").trim();
        }
    });
};

const isSameClassNameSet = (classesA, classesB) => {
    const namesA = classesA.map(c => c.className).sort();
    const namesB = classesB.map(c => c.className).sort();
    if (namesA.length !== namesB.length) return false;
    return namesA.every((name, i) => name === namesB[i]);
};

// ============ ExcelJS 스타일 헬퍼 ============

const hexToARGB = (hex, fallback) => {
    if (!hex) return fallback;
    const clean = hex.replace("#", "").trim();
    if (clean.length === 6) return `FF${clean.toUpperCase()}`;
    if (clean.length === 8) return clean.toUpperCase();
    if (clean.length === 3) {
        const expanded = clean.split("").map(c => c + c).join("");
        return `FF${expanded.toUpperCase()}`;
    }
    return fallback;
};

const GROUP_COLORS = {
    "월/목": { bg: "FF2563EB", light: "FFEFF6FF" },
    "화/금": { bg: "FF9333EA", light: "FFFAF5FF" },
    "수": { bg: "FF16A34A", light: "FFF0FDF4" },
    "주말": { bg: "FFEA580C", light: "FFFFF7ED" },
};

const THIN = { style: "thin", color: { argb: "FF000000" } };
const MEDIUM = { style: "medium", color: { argb: "FF000000" } };
const THICK = { style: "thick", color: { argb: "FF000000" } };
const EMPTY_BG = "FFE5E7EB";
const WITHDRAWN_BG = "FF1F2937";

// 학생이 특정 요일에 등원하는지
const isStudentAttendingDay = (student, day) => {
    const attendanceDays = student.attendanceDays;
    if (!attendanceDays || attendanceDays.length === 0) return true;
    return attendanceDays.includes(day);
};

// 학생별 엑셀 스타일
const resolveStudentStyle = (student, refDateMs) => {
    if (student.isTransferredIn) {
        return { bgARGB: "FFBBF7D0", fgARGB: "FF111827", bold: true };
    }
    const baseDate = student.firstSubjectEnrollmentDate || student.enrollmentDate;
    if (baseDate) {
        const days = Math.ceil((refDateMs - new Date(baseDate).getTime()) / 86400000);
        if (days <= 30) return { bgARGB: "FFEF4444", fgARGB: "FFFFFFFF", bold: true };
        if (days <= 60) return { bgARGB: "FFFCE7F3", fgARGB: "FF111827", bold: true };
    }
    return { bgARGB: "FFFFFFFF", fgARGB: "FF111827", bold: false };
};

// 정렬 가중치
const getEnrollmentWeight = (student, refDateMs) => {
    if (student.isTransferredIn) return -1;
    if (student.underline) return 0;
    if (student.enrollmentDate) {
        const days = Math.ceil((refDateMs - new Date(student.enrollmentDate).getTime()) / 86400000);
        if (days <= 30) return 3;
        if (days <= 60) return 2;
    }
    return 1;
};

const sortActiveByWeight = (arr, today, refDateMs) => {
    arr.sort((a, b) => {
        const aIsWS = (a.student.withdrawalDate && a.student.withdrawalDate > today && !a.student.isTransferred) ? 1 : 0;
        const bIsWS = (b.student.withdrawalDate && b.student.withdrawalDate > today && !b.student.isTransferred) ? 1 : 0;
        if (aIsWS !== bIsWS) return aIsWS - bIsWS;
        const wA = getEnrollmentWeight(a.student, refDateMs);
        const wB = getEnrollmentWeight(b.student, refDateMs);
        if (wA !== wB) return wA - wB;
        if (a.classIdx !== b.classIdx) return a.classIdx - b.classIdx;
        return (a.student.name || "").localeCompare(b.student.name || "", "ko");
    });
    return arr;
};

const buildCellPayload = (cellClasses, cellDays, referenceDateStr) => {
    if (cellClasses.length === 0) return null;

    const uniqueClassNames = [];
    const classIdxMap = new Map();
    cellClasses.forEach(c => {
        if (c.className && !classIdxMap.has(c.className)) {
            uniqueClassNames.push(c.className);
            classIdxMap.set(c.className, uniqueClassNames.length);
        }
    });
    const isMergedClass = uniqueClassNames.length > 1;

    const headerLines = uniqueClassNames.slice();
    const roomLines = uniqueClassNames.map(name => {
        const cls = cellClasses.find(c => c.className === name);
        return (cls && cls.room) || "";
    });

    const studentMap = new Map();
    cellClasses.forEach(c => {
        const classIdx = isMergedClass ? (classIdxMap.get(c.className || "") || 0) : 0;
        (c.studentList || []).forEach(s => {
            if (s.id && !studentMap.has(s.id)) studentMap.set(s.id, { student: s, classIdx });
        });
    });

    const today = referenceDateStr;
    const refDateMs = new Date(today).getTime();

    const activeAll = [];
    const holdAll = [];
    const withdrawnAll = [];

    studentMap.forEach(({ student: s, classIdx }) => {
        const attendingCellDays = cellDays.filter(d => isStudentAttendingDay(s, d));
        if (attendingCellDays.length === 0) return;

        const meta = { student: s, classIdx, attendingCellDays };
        const isFutureWithdrawal = s.withdrawalDate && s.withdrawalDate > today;
        const hasActiveWithdrawal = s.withdrawalDate && s.withdrawalDate <= today && !s.isTransferred;

        if (hasActiveWithdrawal) {
            const daysSince = Math.floor((refDateMs - new Date(s.withdrawalDate).getTime()) / 86400000);
            if (daysSince <= 30) withdrawnAll.push(meta);
        } else if (s.onHold && !s.withdrawalDate) {
            holdAll.push(meta);
        } else if (!s.withdrawalDate || isFutureWithdrawal) {
            activeAll.push(meta);
        }
    });

    sortActiveByWeight(activeAll, today, refDateMs);
    holdAll.sort((a, b) => (a.student.name || "").localeCompare(b.student.name || "", "ko"));
    withdrawnAll.sort((a, b) => (a.student.name || "").localeCompare(b.student.name || "", "ko"));

    const partition = (arr) => {
        const common = [];
        const partialByDay = {};
        cellDays.forEach(d => { partialByDay[d] = []; });
        arr.forEach(meta => {
            if (meta.attendingCellDays.length === cellDays.length) {
                common.push(meta);
            } else {
                meta.attendingCellDays.forEach(d => {
                    if (partialByDay[d]) partialByDay[d].push(meta);
                });
            }
        });
        return { common, partialByDay };
    };

    const first = cellClasses[0];
    return {
        classes: cellClasses,
        uniqueClassNames,
        cellDays,
        active: partition(activeAll),
        hold: partition(holdAll),
        withdrawnStudents: withdrawnAll,
        activeTotal: activeAll.length,
        holdTotal: holdAll.length,
        withdrawnTotal: withdrawnAll.length,
        headerLines,
        roomLines,
        bgColor: first.bgColor ? hexToARGB(first.bgColor, "FFFFFFFF") : undefined,
        textColor: first.textColor ? hexToARGB(first.textColor, "FF111827") : undefined,
    };
};

const formatStudentRowText = (meta, isMerged) => {
    const { student, classIdx } = meta;
    const prefix = isMerged && classIdx > 0 ? `[${classIdx}] ` : "";
    const schoolGrade = formatSchoolGrade(student.school, student.grade);
    return `${prefix}${student.name}/${schoolGrade}`;
};

// ============ 강사 필터 ============

/**
 * teacherIdFilter / teacherNameFilter가 주어지면 해당 강사가 담임 또는 부담임인 수업만 반환.
 * 담임: cls.staffId === teacherIdFilter (또는 cls.teacher === teacherNameFilter)
 * 부담임: cls.slotTeachers의 어떤 값이라도 teacherNameFilter와 일치
 */
const filterClassesByTeacher = (classes, teacherIdFilter, teacherNameFilter) => {
    if (!teacherIdFilter && !teacherNameFilter) return classes;
    return classes.filter(cls => {
        // 담임 매칭
        if (teacherIdFilter && cls.staffId === teacherIdFilter) return true;
        if (teacherNameFilter && (cls.teacher || "").trim() === teacherNameFilter.trim()) return true;
        // 부담임 매칭 (slotTeachers)
        if (teacherNameFilter && cls.slotTeachers) {
            const found = Object.values(cls.slotTeachers).some(t =>
                (t || "").trim() === teacherNameFilter.trim()
            );
            if (found) return true;
        }
        return false;
    });
};

// ============ 메인 내보내기 함수 ============

/**
 * 수학 시간표를 ExcelJS Buffer로 생성
 *
 * @param {object} params
 * @param {string} params.weekLabel - 주차 라벨 (예: "2026-05-13~05-19")
 * @param {Array} params.filteredClasses - 시간표 수업 목록 (필터 적용 후)
 * @param {Array} params.allResources - 전체 강사명 배열 (강사 순서대로)
 * @param {Array} params.orderedSelectedDays - 표시 요일 (예: ["월","화","수","목","금","토","일"])
 * @param {Object} params.weekDates - { 월: { date, formatted } } 형태
 * @param {Array} params.teachers - Teacher 정보 (bgColor/textColor용)
 * @param {Array} params.currentPeriods - 현재 표시 교시 ID 배열
 * @param {string} params.subjectFilter - 과목 (예: "수학")
 * @param {string} [params.referenceDate] - 기준일 (YYYY-MM-DD)
 * @param {string} [params.teacherIdFilter] - 강사 ID 필터 (담임+부담임만)
 * @param {string} [params.teacherNameFilter] - 강사 이름 필터 (담임+부담임만)
 * @returns {Promise<Buffer>} xlsx Buffer (Drive API 업로드용)
 */
async function exportMathTimetableToBuffer(params) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ijw-Calander Server";
    workbook.created = new Date();

    let {
        weekLabel,
        filteredClasses,
        allResources,
        orderedSelectedDays,
        weekDates,
        teachers,
        currentPeriods,
        subjectFilter,
        referenceDate,
        teacherIdFilter,
        teacherNameFilter,
    } = params;

    // 강사 필터 적용 (담임 + 부담임)
    if (teacherIdFilter || teacherNameFilter) {
        filteredClasses = filterClassesByTeacher(filteredClasses, teacherIdFilter, teacherNameFilter);
        // 강사별 시트에서는 본인만 표시
        if (teacherNameFilter) {
            allResources = allResources.filter(r => (r || "").trim() === teacherNameFilter.trim());
        }
    }

    const refStr = referenceDate
        || (() => {
            const firstDay = orderedSelectedDays[0];
            const d = firstDay && weekDates[firstDay] && weekDates[firstDay].date;
            if (d) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                return `${y}-${m}-${dd}`;
            }
            const t = new Date();
            return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
        })();

    const sheetSuffix = teacherNameFilter ? ` (${teacherNameFilter})` : "";
    const safeSheetName = `${subjectFilter || "수학"} ${weekLabel}${sheetSuffix}`
        .replace(/[\\/:*?"\[\]]/g, "_").slice(0, 31);
    const sheet = workbook.addWorksheet(safeSheetName, {
        views: [{ state: "frozen", xSplit: 1, ySplit: 4 }],
    });

    const monThuDays = orderedSelectedDays.filter(d => d === "월" || d === "목");
    const tueFriDays = orderedSelectedDays.filter(d => d === "화" || d === "금");
    const hasWed = orderedSelectedDays.includes("수");
    const hasSat = orderedSelectedDays.includes("토");
    const hasSun = orderedSelectedDays.includes("일");
    const weekendDaysList = [hasSat ? "토" : null, hasSun ? "일" : null].filter(Boolean);

    // 리소스 → 요일 lookup
    const resourceDayLookup = new Map();
    filteredClasses.forEach(cls => {
        (cls.schedule || []).forEach(slot => {
            if (typeof slot !== "string") return;
            const parts = slot.trim().split(/\s+/);
            if (parts.length < 2) return;
            const day = parts[0];
            const normalizedPeriod = LEGACY_TO_UNIFIED_PERIOD_MAP[parts[1]] || parts[1];
            const slotKey = `${day}-${normalizedPeriod}`;
            const resource = (cls.slotTeachers && cls.slotTeachers[slotKey]) || cls.teacher;
            const trimmed = (resource || "").trim();
            if (!trimmed) return;
            if (!resourceDayLookup.has(trimmed)) resourceDayLookup.set(trimmed, new Set());
            resourceDayLookup.get(trimmed).add(day);
        });
    });

    const getResourcesForDays = (days) => {
        const out = [];
        allResources.forEach(resource => {
            const trimmed = (resource || "").trim();
            const lookup = resourceDayLookup.get(trimmed);
            const has = days.filter(d => lookup && lookup.has(d));
            if (has.length > 0) out.push({ resource, days: has });
        });
        return out;
    };

    const weekdayGroups = [];
    if (monThuDays.length > 0) {
        const r = getResourcesForDays(monThuDays);
        if (r.length > 0) weekdayGroups.push({ title: "월/목", days: monThuDays, resources: r });
    }
    if (tueFriDays.length > 0) {
        const r = getResourcesForDays(tueFriDays);
        if (r.length > 0) weekdayGroups.push({ title: "화/금", days: tueFriDays, resources: r });
    }
    if (hasWed) {
        const r = getResourcesForDays(["수"]);
        if (r.length > 0) weekdayGroups.push({ title: "수", days: ["수"], resources: r });
    }

    const weekdayGroupColCounts = weekdayGroups.map(g =>
        g.resources.reduce((acc, r) => acc + r.days.length, 0)
    );
    const totalWeekdayDayCols = weekdayGroupColCounts.reduce((a, b) => a + b, 0);

    const weekendResources = weekendDaysList.length > 0 ? getResourcesForDays(weekendDaysList) : [];
    const totalWeekendDayCols = weekendResources.reduce((a, r) => a + r.days.length, 0);
    const hasWeekend = weekendResources.length > 0;

    const WEEKDAY_PERIOD_COL = 1;
    const WEEKDAY_FIRST_DAY_COL = 2;
    const WEEKDAY_LAST_DAY_COL = 1 + totalWeekdayDayCols;
    const WEEKEND_PERIOD_COL = hasWeekend ? WEEKDAY_LAST_DAY_COL + 1 : 0;
    const WEEKEND_FIRST_DAY_COL = hasWeekend ? WEEKEND_PERIOD_COL + 1 : 0;
    const WEEKEND_LAST_DAY_COL = hasWeekend ? WEEKEND_PERIOD_COL + totalWeekendDayCols : 0;
    const totalCols = hasWeekend ? WEEKEND_LAST_DAY_COL : WEEKDAY_LAST_DAY_COL;

    // 빈 시간표 처리: 강사 필터에 매칭되는 수업이 없을 경우
    if (totalCols === 0) {
        sheet.getCell(1, 1).value = `${subjectFilter || "수학"} ${weekLabel}${sheetSuffix} - 표시할 수업 없음`;
        sheet.getCell(1, 1).font = { bold: true, size: 12 };
        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    const weekdayGroupStartCols = [];
    {
        let acc = WEEKDAY_FIRST_DAY_COL;
        for (let i = 0; i < weekdayGroups.length; i++) {
            weekdayGroupStartCols.push(acc);
            acc += weekdayGroupColCounts[i];
        }
    }

    const PERIOD_COL_W = 13;
    const DAY_COL_W = 24;

    sheet.getColumn(WEEKDAY_PERIOD_COL).width = PERIOD_COL_W;
    for (let c = WEEKDAY_FIRST_DAY_COL; c <= WEEKDAY_LAST_DAY_COL; c++) {
        sheet.getColumn(c).width = DAY_COL_W;
    }
    if (hasWeekend) {
        sheet.getColumn(WEEKEND_PERIOD_COL).width = PERIOD_COL_W;
        for (let c = WEEKEND_FIRST_DAY_COL; c <= WEEKEND_LAST_DAY_COL; c++) {
            sheet.getColumn(c).width = DAY_COL_W;
        }
    }

    // 전체 학생 집계
    const refMs0 = new Date(refStr).getTime();
    const allStudentsAggMap = new Map();
    filteredClasses.forEach(c => {
        (c.studentList || []).forEach(s => {
            if (s.id && !allStudentsAggMap.has(s.id)) allStudentsAggMap.set(s.id, s);
        });
    });

    let totalActive = 0, totalHold = 0, totalWithdrawn = 0, totalNew30 = 0, totalTransferIn = 0;
    allStudentsAggMap.forEach(s => {
        const isFutureWithdrawal = s.withdrawalDate && s.withdrawalDate > refStr;
        const hasActiveWithdrawal = s.withdrawalDate && s.withdrawalDate <= refStr && !s.isTransferred;
        if (hasActiveWithdrawal) {
            const daysSince = Math.floor((refMs0 - new Date(s.withdrawalDate).getTime()) / 86400000);
            if (daysSince <= 30) totalWithdrawn++;
        } else if (s.onHold && !s.withdrawalDate) {
            totalHold++;
        } else if (!s.withdrawalDate || isFutureWithdrawal) {
            totalActive++;
            if (s.isTransferredIn) totalTransferIn++;
            const baseDate = s.firstSubjectEnrollmentDate || s.enrollmentDate;
            if (baseDate && !s.isTransferredIn) {
                const days = Math.ceil((refMs0 - new Date(baseDate).getTime()) / 86400000);
                if (days <= 30) totalNew30++;
            }
        }
    });

    // Row 1: 합계
    let rowIdx = 1;
    const summaryRow = rowIdx++;
    sheet.getRow(summaryRow).height = 24;
    sheet.mergeCells(summaryRow, 1, summaryRow, totalCols);
    const sumCell = sheet.getCell(summaryRow, 1);
    const teacherSuffix = teacherNameFilter ? `    |    강사: ${teacherNameFilter}` : "";
    sumCell.value = `${subjectFilter || "수학"} ${weekLabel}${teacherSuffix}    |    재원 ${totalActive}명    |    신입(30일) ${totalNew30}명    |    반이동 ${totalTransferIn}명    |    대기 ${totalHold}명    |    퇴원 ${totalWithdrawn}명    |    기준일: ${refStr}`;
    sumCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
    sumCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Malgun Gothic" };
    sumCell.alignment = { horizontal: "center", vertical: "middle" };
    sumCell.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: MEDIUM };

    // Row 2: 그룹 타이틀
    const groupTitleRow = rowIdx++;
    sheet.getRow(groupTitleRow).height = 22;

    weekdayGroups.forEach((group, gi) => {
        const startCol = weekdayGroupStartCols[gi];
        const endCol = startCol + weekdayGroupColCounts[gi] - 1;
        if (endCol > startCol) sheet.mergeCells(groupTitleRow, startCol, groupTitleRow, endCol);
        const cell = sheet.getCell(groupTitleRow, startCol);
        cell.value = group.title;
        const color = GROUP_COLORS[group.title] || { bg: "FF6B7280", light: "FFF3F4F6" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color.bg } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: MEDIUM, bottom: THIN, left: MEDIUM, right: MEDIUM };
    });
    if (hasWeekend) {
        if (WEEKEND_LAST_DAY_COL > WEEKEND_FIRST_DAY_COL) {
            sheet.mergeCells(groupTitleRow, WEEKEND_FIRST_DAY_COL, groupTitleRow, WEEKEND_LAST_DAY_COL);
        }
        const cell = sheet.getCell(groupTitleRow, WEEKEND_FIRST_DAY_COL);
        cell.value = "주말";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS["주말"].bg } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: MEDIUM, bottom: THIN, left: MEDIUM, right: MEDIUM };
    }

    // Rows 3-4: 강사 + 요일
    const teacherRow = rowIdx++;
    const dayRow = rowIdx++;
    sheet.getRow(teacherRow).height = 22;
    sheet.getRow(dayRow).height = 28;

    sheet.mergeCells(teacherRow, WEEKDAY_PERIOD_COL, dayRow, WEEKDAY_PERIOD_COL);
    const wdPH = sheet.getCell(teacherRow, WEEKDAY_PERIOD_COL);
    wdPH.value = "교시";
    wdPH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    wdPH.font = { bold: true, color: { argb: "FF000000" } };
    wdPH.alignment = { horizontal: "center", vertical: "middle" };
    wdPH.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: THICK };

    const renderTeacherDayRow = (groups, groupStartCols, groupColCounts) => {
        groups.forEach((group, gi) => {
            let col = groupStartCols[gi];
            group.resources.forEach(({ resource, days }) => {
                const teacherData = teachers.find(t => t.name === resource);
                const bg = hexToARGB(teacherData && teacherData.bgColor, "FF3B82F6");
                const fg = hexToARGB(teacherData && teacherData.textColor, "FFFFFFFF");
                const sc = col;
                const ec = col + days.length - 1;
                if (days.length > 1) sheet.mergeCells(teacherRow, sc, teacherRow, ec);
                const tCell = sheet.getCell(teacherRow, sc);
                tCell.value = resource;
                tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
                tCell.font = { bold: true, color: { argb: fg }, size: 11 };
                tCell.alignment = { horizontal: "center", vertical: "middle" };
                tCell.border = { top: THIN, bottom: THIN, left: gi === 0 && col === groupStartCols[0] ? MEDIUM : THIN, right: THICK };
                days.forEach((day, di) => {
                    const dCell = sheet.getCell(dayRow, col + di);
                    const dateInfo = weekDates[day];
                    dCell.value = dateInfo ? `${day}\n${dateInfo.formatted}` : day;
                    const isWeekend = day === "토" || day === "일";
                    const dayBg = isWeekend ? "FFFFF7ED" : day === "수" ? "FFF0FDF4" : "FFF3F4F6";
                    dCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dayBg } };
                    dCell.font = { bold: true, color: { argb: "FF000000" }, size: 10 };
                    dCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                    const isLastInGroup = di === days.length - 1;
                    const groupEndCol = groupStartCols[gi] + groupColCounts[gi] - 1;
                    dCell.border = {
                        top: THIN,
                        bottom: THICK,
                        left: di === 0 && col === groupStartCols[gi] ? MEDIUM : THIN,
                        right: isLastInGroup && col + days.length - 1 === groupEndCol
                            ? MEDIUM : isLastInGroup ? THICK : THIN,
                    };
                });
                col = ec + 1;
            });
        });
    };

    renderTeacherDayRow(weekdayGroups, weekdayGroupStartCols, weekdayGroupColCounts);

    if (hasWeekend) {
        sheet.mergeCells(teacherRow, WEEKEND_PERIOD_COL, dayRow, WEEKEND_PERIOD_COL);
        const weH = sheet.getCell(teacherRow, WEEKEND_PERIOD_COL);
        weH.value = "교시";
        weH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS["주말"].light } };
        weH.font = { bold: true, color: { argb: "FF000000" } };
        weH.alignment = { horizontal: "center", vertical: "middle" };
        weH.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: THICK };

        const weekendGroup = { title: "주말", days: weekendDaysList, resources: weekendResources };
        renderTeacherDayRow([weekendGroup], [WEEKEND_FIRST_DAY_COL], [totalWeekendDayCols]);
    }

    const weekdayPeriodGroups = MATH_GROUPED_PERIODS
        .map(gid => {
            const periodIds = MATH_GROUP_PERIOD_IDS[gid];
            const [firstPeriod, secondPeriod] = periodIds;
            const hasFirst = currentPeriods.includes(firstPeriod);
            const hasSecond = currentPeriods.includes(secondPeriod);
            if (!hasFirst && !hasSecond) return null;
            return { gid, firstPeriod, secondPeriod, hasFirst, hasSecond, info: MATH_GROUP_DISPLAY[gid] };
        })
        .filter(Boolean);

    // 완전 빈 컬럼 탐지
    const fullyEmptyWeekdayCols = new Set();
    weekdayGroups.forEach((group, gi) => {
        let col = weekdayGroupStartCols[gi];
        group.resources.forEach(({ resource, days }) => {
            days.forEach(day => {
                const hasAny = weekdayPeriodGroups.some(pg => {
                    const f = pg.hasFirst ? getClassesForCell(filteredClasses, day, pg.firstPeriod, resource, "teacher") : [];
                    const s = pg.hasSecond ? getClassesForCell(filteredClasses, day, pg.secondPeriod, resource, "teacher") : [];
                    return f.length > 0 || s.length > 0;
                });
                if (!hasAny) fullyEmptyWeekdayCols.add(col);
                col++;
            });
        });
    });

    const weekendPeriods = currentPeriods.filter(p => WEEKEND_PERIOD_TIMES[p]);
    const fullyEmptyWeekendCols = new Set();
    if (hasWeekend) {
        let col = WEEKEND_FIRST_DAY_COL;
        weekendResources.forEach(({ resource, days }) => {
            days.forEach(day => {
                const hasAny = weekendPeriods.some(p => {
                    const cls = getClassesForCell(filteredClasses, day, p, resource, "teacher");
                    return cls.length > 0;
                });
                if (!hasAny) fullyEmptyWeekendCols.add(col);
                col++;
            });
        });
    }

    const computeWeekdayCells = (pg) => {
        const cells = [];
        weekdayGroups.forEach((group, gi) => {
            let col = weekdayGroupStartCols[gi];
            const groupEndCol = col + weekdayGroupColCounts[gi] - 1;
            group.resources.forEach(({ resource, days }) => {
                let di = 0;
                while (di < days.length) {
                    const day = days[di];
                    if (fullyEmptyWeekdayCols.has(col)) {
                        col++;
                        di++;
                        continue;
                    }
                    const firstCls = pg.hasFirst ? getClassesForCell(filteredClasses, day, pg.firstPeriod, resource, "teacher") : [];
                    const secondCls = pg.hasSecond ? getClassesForCell(filteredClasses, day, pg.secondPeriod, resource, "teacher") : [];

                    const mergedSet = new Map();
                    firstCls.forEach(c => mergedSet.set(c.className, c));
                    secondCls.forEach(c => { if (!mergedSet.has(c.className)) mergedSet.set(c.className, c); });
                    const cellClasses = Array.from(mergedSet.values());

                    let colSpan = 1;
                    if (cellClasses.length > 0 && days.length > 1 && di < days.length - 1) {
                        for (let ni = di + 1; ni < days.length; ni++) {
                            const nDay = days[ni];
                            const nCol = col + (ni - di);
                            if (fullyEmptyWeekdayCols.has(nCol)) break;
                            const nFirst = pg.hasFirst ? getClassesForCell(filteredClasses, nDay, pg.firstPeriod, resource, "teacher") : [];
                            const nSecond = pg.hasSecond ? getClassesForCell(filteredClasses, nDay, pg.secondPeriod, resource, "teacher") : [];
                            const nMerged = new Map();
                            nFirst.forEach(c => nMerged.set(c.className, c));
                            nSecond.forEach(c => { if (!nMerged.has(c.className)) nMerged.set(c.className, c); });
                            const nCellClasses = Array.from(nMerged.values());
                            if (isSameClassNameSet(cellClasses, nCellClasses)) {
                                colSpan++;
                            } else {
                                break;
                            }
                        }
                    }

                    const dayCols = [];
                    const cellDays = [];
                    for (let k = 0; k < colSpan; k++) {
                        dayCols.push({ day: days[di + k], col: col + k });
                        cellDays.push(days[di + k]);
                    }
                    const payload = buildCellPayload(cellClasses, cellDays, refStr);
                    const startCol = col;
                    const endCol = col + colSpan - 1;
                    cells.push({
                        startCol,
                        endCol,
                        payload,
                        isGroupRightEdge: endCol === groupEndCol,
                        dayCols,
                        subTopClasses: firstCls,
                        subBotClasses: secondCls,
                    });
                    col += colSpan;
                    di += colSpan;
                }
            });
        });
        return cells;
    };

    const computeWeekendCells = (period) => {
        const cells = [];
        let col = WEEKEND_FIRST_DAY_COL;
        const groupEndCol = WEEKEND_LAST_DAY_COL;
        weekendResources.forEach(({ resource, days }) => {
            days.forEach(day => {
                if (fullyEmptyWeekendCols.has(col)) {
                    col++;
                    return;
                }
                const cls = getClassesForCell(filteredClasses, day, period, resource, "teacher");
                const payload = buildCellPayload(cls, [day], refStr);
                cells.push({
                    startCol: col,
                    endCol: col,
                    payload,
                    isGroupRightEdge: col === groupEndCol,
                    dayCols: [{ day, col }],
                    subTopClasses: cls,
                    subBotClasses: [],
                });
                col++;
            });
        });
        return cells;
    };

    const bodyStartRow = rowIdx;
    const refDateMs = new Date(refStr).getTime();

    const metaEntries = [];

    const cellActiveRows = (c) => {
        if (!c.payload) return 0;
        const cN = c.payload.active.common.length;
        const pMax = Math.max(0, ...Object.values(c.payload.active.partialByDay).map(arr => arr.length));
        return cN + pMax;
    };
    const cellHoldRows = (c) => {
        if (!c.payload) return 0;
        const cN = c.payload.hold.common.length;
        const pMax = Math.max(0, ...Object.values(c.payload.hold.partialByDay).map(arr => arr.length));
        return cN + pMax;
    };

    const cellNeedsSubSplit = (c) => {
        const topNames = new Set((c.subTopClasses || []).map(cls => cls.className).filter(Boolean));
        const botNames = new Set((c.subBotClasses || []).map(cls => cls.className).filter(Boolean));
        if (topNames.size !== botNames.size) return true;
        for (const n of topNames) if (!botNames.has(n)) return true;
        return false;
    };

    const totalPeriodCount = Math.max(weekdayPeriodGroups.length, weekendPeriods.length);

    for (let pi = 0; pi < totalPeriodCount; pi++) {
        const weekdayCells = pi < weekdayPeriodGroups.length ? computeWeekdayCells(weekdayPeriodGroups[pi]) : [];
        const weekendCells = (hasWeekend && pi < weekendPeriods.length) ? computeWeekendCells(weekendPeriods[pi]) : [];
        const allCells = [...weekdayCells, ...weekendCells];

        const maxActive = allCells.reduce((m, c) => Math.max(m, cellActiveRows(c)), 0);
        const maxHold = allCells.reduce((m, c) => Math.max(m, cellHoldRows(c)), 0);
        const maxWithdrawn = allCells.reduce((m, c) => Math.max(m, (c.payload && c.payload.withdrawnStudents.length) || 0), 0);
        const hasAnyHold = maxHold > 0;
        const hasAnyWithdrawn = maxWithdrawn > 0;
        const needsSubRows = allCells.some(c => c.payload && cellNeedsSubSplit(c));

        const subTopRow = rowIdx++;
        const subBotRow = needsSubRows ? rowIdx++ : subTopRow;
        const roomRow = rowIdx++;
        const activeHeaderRow = rowIdx++;
        const activeStartRow = rowIdx;
        const effectiveMaxActive = Math.max(1, maxActive);
        rowIdx += effectiveMaxActive;
        const holdHeaderRow = hasAnyHold ? rowIdx++ : 0;
        const holdStartRow = rowIdx;
        if (hasAnyHold) rowIdx += maxHold;
        const withdrawnHeaderRow = hasAnyWithdrawn ? rowIdx++ : 0;
        const withdrawnStartRow = rowIdx;
        if (hasAnyWithdrawn) rowIdx += maxWithdrawn;
        const countRow = rowIdx++;
        const periodEndRow = rowIdx - 1;

        sheet.getRow(subTopRow).height = 22;
        if (needsSubRows) sheet.getRow(subBotRow).height = 22;
        sheet.getRow(roomRow).height = 16;
        sheet.getRow(activeHeaderRow).height = 18;
        for (let r = 0; r < effectiveMaxActive; r++) sheet.getRow(activeStartRow + r).height = 16;
        if (hasAnyHold) {
            sheet.getRow(holdHeaderRow).height = 18;
            for (let r = 0; r < maxHold; r++) sheet.getRow(holdStartRow + r).height = 16;
        }
        if (hasAnyWithdrawn) {
            sheet.getRow(withdrawnHeaderRow).height = 18;
            for (let r = 0; r < maxWithdrawn; r++) sheet.getRow(withdrawnStartRow + r).height = 16;
        }
        sheet.getRow(countRow).height = 20;

        if (pi < weekdayPeriodGroups.length) {
            const pg = weekdayPeriodGroups[pi];
            sheet.mergeCells(subTopRow, WEEKDAY_PERIOD_COL, countRow, WEEKDAY_PERIOD_COL);
            const pl = sheet.getCell(subTopRow, WEEKDAY_PERIOD_COL);
            pl.value = `${pg.info.label}\n${pg.info.time}`;
            pl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
            pl.font = { bold: true, color: { argb: "FF000000" }, size: 11 };
            pl.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            pl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
        } else if (hasWeekend) {
            sheet.mergeCells(subTopRow, WEEKDAY_PERIOD_COL, countRow, WEEKDAY_PERIOD_COL);
            const pl = sheet.getCell(subTopRow, WEEKDAY_PERIOD_COL);
            pl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
            pl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
        }

        if (hasWeekend && pi < weekendPeriods.length) {
            const period = weekendPeriods[pi];
            sheet.mergeCells(subTopRow, WEEKEND_PERIOD_COL, countRow, WEEKEND_PERIOD_COL);
            const pl = sheet.getCell(subTopRow, WEEKEND_PERIOD_COL);
            pl.value = `${period}\n${WEEKEND_PERIOD_TIMES[period] || ""}`;
            pl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS["주말"].light } };
            pl.font = { bold: true, color: { argb: "FF000000" }, size: 11 };
            pl.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            pl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
        } else if (hasWeekend) {
            sheet.mergeCells(subTopRow, WEEKEND_PERIOD_COL, countRow, WEEKEND_PERIOD_COL);
            const pl = sheet.getCell(subTopRow, WEEKEND_PERIOD_COL);
            pl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
            pl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
        }

        allCells.forEach(cell => {
            const { startCol, endCol, payload, isGroupRightEdge, dayCols, subTopClasses, subBotClasses } = cell;
            const rightBorder = isGroupRightEdge ? MEDIUM : THICK;
            const colSpan = endCol - startCol + 1;

            const mergeAndGet = (row) => {
                if (colSpan > 1) sheet.mergeCells(row, startCol, row, endCol);
                return sheet.getCell(row, startCol);
            };

            if (!payload) {
                sheet.mergeCells(subTopRow, startCol, periodEndRow, endCol);
                const c = sheet.getCell(subTopRow, startCol);
                c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
                c.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };
                return;
            }

            const isMergedClass = payload.uniqueClassNames.length > 1;
            const nameBg = payload.bgColor || "FFFFFFFF";
            const nameFg = payload.textColor || "FF111827";

            const topNames = Array.from(new Set((subTopClasses || []).map(c => c.className).filter(Boolean)));
            const botNames = Array.from(new Set((subBotClasses || []).map(c => c.className).filter(Boolean)));
            const cellSplitsSub = needsSubRows && cellNeedsSubSplit(cell);

            const primaryClassId = (payload.classes[0] && payload.classes[0].id) || "";
            const primaryClassName = payload.uniqueClassNames[0] || "";

            if (!needsSubRows || !cellSplitsSub) {
                if (needsSubRows) {
                    sheet.mergeCells(subTopRow, startCol, subBotRow, endCol);
                } else if (colSpan > 1) {
                    sheet.mergeCells(subTopRow, startCol, subTopRow, endCol);
                }
                const nc = sheet.getCell(subTopRow, startCol);
                nc.value = payload.headerLines
                    .map((name, i) => isMergedClass ? `[${i + 1}] ${name}` : name)
                    .join("\n");
                nc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: nameBg } };
                nc.font = { bold: true, color: { argb: nameFg }, size: 10 };
                nc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                nc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

                metaEntries.push({
                    kind: "class_name",
                    row: subTopRow,
                    startCol,
                    endCol,
                    subPeriod: "both",
                    classId: primaryClassId,
                    classNameSnapshot: primaryClassName,
                    bgColorSnapshot: nameBg,
                    textColorSnapshot: nameFg,
                });
            } else {
                if (colSpan > 1) sheet.mergeCells(subTopRow, startCol, subTopRow, endCol);
                const ntc = sheet.getCell(subTopRow, startCol);
                if (topNames.length > 0) {
                    const topFirst = (subTopClasses || []).find(c => c.className) || payload.classes[0];
                    const topBg = topFirst && topFirst.bgColor ? hexToARGB(topFirst.bgColor, "FFFFFFFF") : nameBg;
                    const topFg = topFirst && topFirst.textColor ? hexToARGB(topFirst.textColor, "FF111827") : nameFg;
                    ntc.value = topNames.map((name, i) => isMergedClass ? `[${i + 1}] ${name}` : name).join("\n");
                    ntc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: topBg } };
                    ntc.font = { bold: true, color: { argb: topFg }, size: 10 };

                    metaEntries.push({
                        kind: "class_name",
                        row: subTopRow,
                        startCol,
                        endCol,
                        subPeriod: "top",
                        classId: (topFirst && topFirst.id) || "",
                        classNameSnapshot: topNames[0] || "",
                        bgColorSnapshot: topBg,
                        textColorSnapshot: topFg,
                    });
                } else {
                    ntc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
                }
                ntc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                ntc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

                if (colSpan > 1) sheet.mergeCells(subBotRow, startCol, subBotRow, endCol);
                const nbc = sheet.getCell(subBotRow, startCol);
                if (botNames.length > 0) {
                    const botFirst = (subBotClasses || []).find(c => c.className) || payload.classes[0];
                    const botBg = botFirst && botFirst.bgColor ? hexToARGB(botFirst.bgColor, "FFFFFFFF") : nameBg;
                    const botFg = botFirst && botFirst.textColor ? hexToARGB(botFirst.textColor, "FF111827") : nameFg;
                    nbc.value = botNames.map((name, i) => isMergedClass ? `[${i + 1}] ${name}` : name).join("\n");
                    nbc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: botBg } };
                    nbc.font = { bold: true, color: { argb: botFg }, size: 10 };

                    metaEntries.push({
                        kind: "class_name",
                        row: subBotRow,
                        startCol,
                        endCol,
                        subPeriod: "bot",
                        classId: (botFirst && botFirst.id) || "",
                        classNameSnapshot: botNames[0] || "",
                    });
                } else {
                    nbc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
                }
                nbc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                nbc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
            }

            // 강의실
            const rc = mergeAndGet(roomRow);
            const roomText = payload.roomLines.filter(r => r).join(" / ");
            rc.value = roomText;
            rc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
            rc.font = { color: { argb: "FF374151" }, size: 9 };
            rc.alignment = { horizontal: "center", vertical: "middle" };
            rc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

            metaEntries.push({
                kind: "class_room",
                row: roomRow,
                startCol,
                endCol,
                classId: primaryClassId,
                roomSnapshot: roomText,
            });

            // 재원 헤더
            const ah = mergeAndGet(activeHeaderRow);
            if (payload.activeTotal > 0) {
                ah.value = `${payload.activeTotal}명 - 재원생`;
                ah.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
                ah.font = { bold: true, color: { argb: "FF4F46E5" }, size: 9 };
            } else {
                ah.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            }
            ah.alignment = { horizontal: "center", vertical: "middle" };
            ah.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

            const commonActive = payload.active.common;
            const partialActive = payload.active.partialByDay;
            const partialActiveMax = Math.max(0, ...Object.values(partialActive).map(arr => arr.length));

            for (let i = 0; i < effectiveMaxActive; i++) {
                const row = activeStartRow + i;
                if (i < commonActive.length) {
                    const c = mergeAndGet(row);
                    const meta = commonActive[i];
                    const style = resolveStudentStyle(meta.student, refDateMs);
                    const textVal = formatStudentRowText(meta, isMergedClass);
                    c.value = textVal;
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.bgARGB } };
                    c.font = { bold: style.bold, color: { argb: style.fgARGB }, size: 9, name: "Malgun Gothic" };
                    c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
                    c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

                    metaEntries.push({
                        kind: "student",
                        row,
                        startCol,
                        endCol,
                        section: "active",
                        studentId: meta.student.id || "",
                        studentNameSnapshot: textVal,
                        sourceClassId: primaryClassId,
                    });
                } else if (i < commonActive.length + partialActiveMax) {
                    const pIdx = i - commonActive.length;
                    dayCols.forEach(({ day, col }, dci) => {
                        const dayList = partialActive[day] || [];
                        const cc = sheet.getCell(row, col);
                        if (pIdx < dayList.length) {
                            const meta = dayList[pIdx];
                            const style = resolveStudentStyle(meta.student, refDateMs);
                            const textVal = formatStudentRowText(meta, isMergedClass);
                            cc.value = textVal;
                            cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.bgARGB } };
                            cc.font = { bold: style.bold, color: { argb: style.fgARGB }, size: 9, name: "Malgun Gothic" };

                            metaEntries.push({
                                kind: "student",
                                row,
                                startCol: col,
                                endCol: col,
                                section: "active",
                                studentId: meta.student.id || "",
                                studentNameSnapshot: textVal,
                                sourceClassId: primaryClassId,
                            });
                        } else {
                            cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                        }
                        cc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
                        cc.border = {
                            top: THIN,
                            bottom: THIN,
                            left: THIN,
                            right: dci === dayCols.length - 1 ? rightBorder : THIN,
                        };
                    });
                } else {
                    const c = mergeAndGet(row);
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                    c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                }
            }

            // 대기 섹션
            if (hasAnyHold) {
                const hh = mergeAndGet(holdHeaderRow);
                if (payload.holdTotal > 0) {
                    hh.value = `${payload.holdTotal}명 - 대기`;
                    hh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
                    hh.font = { bold: true, color: { argb: "FFCA8A04" }, size: 9 };
                } else {
                    hh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                }
                hh.alignment = { horizontal: "center", vertical: "middle" };
                hh.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

                const commonHold = payload.hold.common;
                const partialHold = payload.hold.partialByDay;
                const partialHoldMax = Math.max(0, ...Object.values(partialHold).map(arr => arr.length));

                for (let i = 0; i < maxHold; i++) {
                    const row = holdStartRow + i;
                    if (i < commonHold.length) {
                        const c = mergeAndGet(row);
                        const meta = commonHold[i];
                        const textVal = formatStudentRowText(meta, isMergedClass);
                        c.value = textVal;
                        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
                        c.font = { color: { argb: "FF92400E" }, size: 9, name: "Malgun Gothic" };
                        c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
                        c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

                        metaEntries.push({
                            kind: "student",
                            row,
                            startCol,
                            endCol,
                            section: "hold",
                            studentId: meta.student.id || "",
                            studentNameSnapshot: textVal,
                            sourceClassId: primaryClassId,
                        });
                    } else if (i < commonHold.length + partialHoldMax) {
                        const pIdx = i - commonHold.length;
                        dayCols.forEach(({ day, col }, dci) => {
                            const dayList = partialHold[day] || [];
                            const cc = sheet.getCell(row, col);
                            if (pIdx < dayList.length) {
                                const meta = dayList[pIdx];
                                const textVal = formatStudentRowText(meta, isMergedClass);
                                cc.value = textVal;
                                cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
                                cc.font = { color: { argb: "FF92400E" }, size: 9, name: "Malgun Gothic" };

                                metaEntries.push({
                                    kind: "student",
                                    row,
                                    startCol: col,
                                    endCol: col,
                                    section: "hold",
                                    studentId: meta.student.id || "",
                                    studentNameSnapshot: textVal,
                                    sourceClassId: primaryClassId,
                                });
                            } else {
                                cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                            }
                            cc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
                            cc.border = {
                                top: THIN,
                                bottom: THIN,
                                left: THIN,
                                right: dci === dayCols.length - 1 ? rightBorder : THIN,
                            };
                        });
                    } else {
                        const c = mergeAndGet(row);
                        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                        c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                    }
                }
            }

            // 퇴원 섹션
            if (hasAnyWithdrawn) {
                const wh = mergeAndGet(withdrawnHeaderRow);
                if (payload.withdrawnStudents.length > 0) {
                    wh.value = `${payload.withdrawnStudents.length}명 - 퇴원`;
                    wh.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
                }
                wh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WITHDRAWN_BG } };
                wh.alignment = { horizontal: "center", vertical: "middle" };
                wh.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

                for (let i = 0; i < maxWithdrawn; i++) {
                    const row = withdrawnStartRow + i;
                    const c = mergeAndGet(row);
                    if (i < payload.withdrawnStudents.length) {
                        const meta = payload.withdrawnStudents[i];
                        const textVal = formatStudentRowText(meta, isMergedClass);
                        c.value = textVal;
                        c.font = { color: { argb: "FFD1D5DB" }, size: 9, name: "Malgun Gothic" };

                        metaEntries.push({
                            kind: "student",
                            row,
                            startCol,
                            endCol,
                            section: "withdrawn",
                            studentId: meta.student.id || "",
                            studentNameSnapshot: textVal,
                            sourceClassId: primaryClassId,
                        });
                    }
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WITHDRAWN_BG } };
                    c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
                    c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                }
            }

            // 인원 통계
            dayCols.forEach(({ day, col }, dci) => {
                const dayCount = commonActive.length + ((partialActive[day] && partialActive[day].length) || 0);
                const cc = sheet.getCell(countRow, col);
                cc.value = dayCount;
                cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
                cc.font = { bold: true, color: { argb: "FF111827" }, size: 10 };
                cc.alignment = { horizontal: "center", vertical: "middle" };
                cc.border = {
                    top: THICK,
                    bottom: THICK,
                    left: THIN,
                    right: dci === dayCols.length - 1 ? rightBorder : THIN,
                };
            });
        });
    }

    // 완전 빈 컬럼 세로 병합
    const lastBodyRow = rowIdx - 1;
    fullyEmptyWeekdayCols.forEach(col => {
        if (lastBodyRow >= bodyStartRow) {
            sheet.mergeCells(bodyStartRow, col, lastBodyRow, col);
            const c = sheet.getCell(bodyStartRow, col);
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
            c.border = { top: THIN, bottom: THICK, left: THIN, right: THICK };
        }
    });
    fullyEmptyWeekendCols.forEach(col => {
        if (lastBodyRow >= bodyStartRow) {
            sheet.mergeCells(bodyStartRow, col, lastBodyRow, col);
            const c = sheet.getCell(bodyStartRow, col);
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
            c.border = { top: THIN, bottom: THICK, left: THIN, right: THICK };
        }
    });

    // _meta hidden 시트
    const metaSheet = workbook.addWorksheet("_meta", { state: "hidden" });
    metaSheet.addRow(["__schema_version__", "subjectFilter", "weekLabel", "referenceDate", "sheetName", "teacherFilter"]);
    metaSheet.addRow(["1", subjectFilter || "수학", weekLabel, refStr, safeSheetName, teacherNameFilter || ""]);
    metaSheet.addRow([]);
    metaSheet.addRow([
        "kind", "row", "startCol", "endCol",
        "section", "subPeriod",
        "classId", "classNameSnapshot", "roomSnapshot",
        "studentId", "studentNameSnapshot", "sourceClassId",
    ]);
    metaEntries.forEach(e => {
        metaSheet.addRow([
            e.kind, e.row, e.startCol, e.endCol,
            e.section || "", e.subPeriod || "",
            e.classId || "", e.classNameSnapshot || "", e.roomSnapshot || "",
            e.studentId || "", e.studentNameSnapshot || "", e.sourceClassId || "",
        ]);
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}

module.exports = {
    exportMathTimetableToBuffer,
    // 내부 헬퍼 노출 (테스트 / 강사 시트 빌더에서 사용)
    filterClassesByTeacher,
    formatSchoolGrade,
    getClassesForCell,
};
