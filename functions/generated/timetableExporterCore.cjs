var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// components/Timetable/Math/utils/excelExport.ts
var excelExport_exports = {};
__export(excelExport_exports, {
  exportMathTimetableToExcel: () => exportMathTimetableToExcel
});
module.exports = __toCommonJS(excelExport_exports);

// components/Timetable/constants.ts
var WEEKEND_PERIOD_TIMES = {
  "1-1": "09:00~10:00",
  "1-2": "10:00~11:00",
  "2-1": "11:00~12:00",
  "2-2": "12:00~13:00",
  "3-1": "13:00~14:00",
  "3-2": "14:00~15:00",
  "4-1": "15:00~16:00",
  "4-2": "16:00~17:00"
};
var LEGACY_TO_UNIFIED_PERIOD_MAP = {
  "1-1": "1",
  "1-2": "2",
  "2-1": "3",
  "2-2": "4",
  "3-1": "5",
  "3-2": "6",
  "4-1": "7",
  "4-2": "8",
  // 이미 통일된 ID도 지원
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8"
};
var convertLegacyPeriodId = (legacyId) => {
  return LEGACY_TO_UNIFIED_PERIOD_MAP[legacyId] || legacyId;
};
var MATH_GROUPED_PERIODS = ["1", "2", "3", "4"];
var MATH_GROUP_PERIOD_IDS = {
  "1": ["1-1", "1-2"],
  // 1교시 = 1-1 + 1-2
  "2": ["2-1", "2-2"],
  // 2교시 = 2-1 + 2-2
  "3": ["3-1", "3-2"],
  // 3교시 = 3-1 + 3-2
  "4": ["4-1", "4-2"]
  // 4교시 = 4-1 + 4-2
};
var MATH_GROUP_DISPLAY = {
  "1": { label: "1\uAD50\uC2DC", time: "14:30~16:20" },
  "2": { label: "2\uAD50\uC2DC", time: "16:20~18:10" },
  "3": { label: "3\uAD50\uC2DC", time: "18:20~20:10" },
  "4": { label: "4\uAD50\uC2DC", time: "20:10~22:00" }
};

// components/Timetable/Math/utils/gridUtils.ts
var getClassesForCell = (filteredClasses, day, period, resource, viewType) => {
  return filteredClasses.filter((cls) => {
    const targetSlot = `${day}${period}`.replace(/\s+/g, "");
    const scheduleMatch = cls.schedule?.some((s) => {
      const normalizedS = s.replace(/\s+/g, "");
      return normalizedS === targetSlot || normalizedS.startsWith(`${targetSlot}-`);
    });
    if (!scheduleMatch) return false;
    if (viewType === "teacher") {
      const normalizedPeriod = convertLegacyPeriodId(period);
      const slotKey = `${day}-${normalizedPeriod}`;
      const slotTeacher = cls.slotTeachers?.[slotKey];
      const effectiveTeacher = slotTeacher || cls.teacher;
      return effectiveTeacher?.trim() === resource?.trim();
    } else {
      const normalizedPeriod = convertLegacyPeriodId(period);
      const slotKey = `${day}-${normalizedPeriod}`;
      const slotRoom = cls.slotRooms?.[slotKey];
      const effectiveRoom = slotRoom || cls.room;
      return effectiveRoom?.trim() === resource?.trim();
    }
  });
};
var getEffectiveResource = (cls, day, period, viewType) => {
  const normalizedPeriod = convertLegacyPeriodId(period);
  const slotKey = `${day}-${normalizedPeriod}`;
  if (viewType === "teacher") {
    return cls.slotTeachers?.[slotKey] || cls.teacher || "";
  } else {
    return cls.slotRooms?.[slotKey] || cls.room || "";
  }
};
var isSameClassNameSet = (classesA, classesB) => {
  const namesA = classesA.map((c) => c.className).sort();
  const namesB = classesB.map((c) => c.className).sort();
  if (namesA.length !== namesB.length) return false;
  return namesA.every((name, i) => name === namesB[i]);
};
var getConsecutiveSpan = (cls, day, startPeriodIndex, periods, filteredClasses, viewType) => {
  let span = 1;
  const startPeriod = periods[startPeriodIndex];
  const startResource = getEffectiveResource(cls, day, startPeriod, viewType);
  for (let i = startPeriodIndex + 1; i < periods.length; i++) {
    const nextPeriod = periods[i];
    const nextResource = getEffectiveResource(cls, day, nextPeriod, viewType);
    if (nextResource !== startResource) break;
    const classesInNextSlot = getClassesForCell(filteredClasses, day, nextPeriod, startResource, viewType);
    if (classesInNextSlot.length === 0) break;
    const classesInStartSlot = getClassesForCell(filteredClasses, day, startPeriod, startResource, viewType);
    if (isSameClassNameSet(classesInStartSlot, classesInNextSlot)) {
      span++;
    } else {
      break;
    }
  }
  return span;
};
var shouldSkipCell = (cls, day, periodIndex, currentCellClasses, periods, filteredClasses, viewType) => {
  const currentPeriod = periods[periodIndex];
  const currentResource = getEffectiveResource(cls, day, currentPeriod, viewType);
  for (let i = periodIndex - 1; i >= 0; i--) {
    const prevPeriod = periods[i];
    const prevResource = getEffectiveResource(cls, day, prevPeriod, viewType);
    if (prevResource !== currentResource) {
      return false;
    }
    const classesInPrevSlot = getClassesForCell(filteredClasses, day, prevPeriod, currentResource, viewType);
    if (classesInPrevSlot.length === 0) break;
    if (!isSameClassNameSet(currentCellClasses, classesInPrevSlot)) {
      return false;
    }
    return true;
  }
  return false;
};

// utils/studentUtils.ts
var getGradeNumber = (grade) => {
  if (!grade) return "";
  const match = grade.match(/\d+/);
  return match ? match[0] : grade;
};
var getGradeLevel = (grade) => {
  if (!grade) return "";
  if (grade.startsWith("\uCD08") || grade.includes("\uCD08\uB4F1")) return "\uCD08";
  if (grade.startsWith("\uC911") || grade.includes("\uC911\uD559")) return "\uC911";
  if (grade.startsWith("\uACE0") || grade.includes("\uACE0\uB4F1")) return "\uACE0";
  return "";
};
var formatSchoolGrade = (school, grade, options) => {
  const schoolStr = school?.trim() || "";
  const gradeStr = grade?.trim() || "";
  if (!schoolStr && !gradeStr) return "-";
  if (!schoolStr) return gradeStr || "-";
  if (!gradeStr) return schoolStr;
  const gradeNum = getGradeNumber(gradeStr);
  const gradeLevel = getGradeLevel(gradeStr);
  if (options?.numberLast) {
    return `${schoolStr}${gradeNum}`;
  }
  const schoolEndsWithLevel = schoolStr.endsWith("\uCD08") || schoolStr.endsWith("\uC911") || schoolStr.endsWith("\uACE0");
  if (schoolEndsWithLevel) {
    return `${gradeNum}${schoolStr}`;
  }
  if (gradeLevel) {
    return `${gradeStr}${schoolStr}`;
  }
  return `${gradeNum}${schoolStr}`;
};

// components/Timetable/Math/utils/excelExport.ts
var hexToARGB = (hex, fallback) => {
  if (!hex) return fallback;
  const clean = hex.replace("#", "").trim();
  if (clean.length === 6) return `FF${clean.toUpperCase()}`;
  if (clean.length === 8) return clean.toUpperCase();
  if (clean.length === 3) {
    const expanded = clean.split("").map((c) => c + c).join("");
    return `FF${expanded.toUpperCase()}`;
  }
  return fallback;
};
var GROUP_COLORS = {
  "\uC6D4/\uBAA9": { bg: "FF2563EB", light: "FFEFF6FF" },
  "\uD654/\uAE08": { bg: "FF9333EA", light: "FFFAF5FF" },
  "\uC218": { bg: "FF16A34A", light: "FFF0FDF4" },
  "\uC8FC\uB9D0": { bg: "FFEA580C", light: "FFFFF7ED" }
};
var THIN = { style: "thin", color: { argb: "FF000000" } };
var MEDIUM = { style: "medium", color: { argb: "FF000000" } };
var THICK = { style: "thick", color: { argb: "FF000000" } };
var EMPTY_BG = "FFE5E7EB";
var WITHDRAWN_BG = "FF1F2937";
var isStudentAttendingDay = (student, day) => {
  const attendanceDays = student.attendanceDays;
  if (!attendanceDays || attendanceDays.length === 0) return true;
  return attendanceDays.includes(day);
};
var resolveStudentStyle = (student, refDateMs) => {
  if (student.isTransferredIn) {
    return { bgARGB: "FFBBF7D0", fgARGB: "FF111827", bold: true };
  }
  const baseDate = student.firstSubjectEnrollmentDate || student.enrollmentDate;
  if (baseDate) {
    const days = Math.ceil((refDateMs - new Date(baseDate).getTime()) / 864e5);
    if (days <= 30) return { bgARGB: "FFEF4444", fgARGB: "FFFFFFFF", bold: true };
    if (days <= 60) return { bgARGB: "FFFCE7F3", fgARGB: "FF111827", bold: true };
  }
  return { bgARGB: "FFFFFFFF", fgARGB: "FF111827", bold: false };
};
var getEnrollmentWeight = (student, refDateMs) => {
  if (student.isTransferredIn) return -1;
  if (student.underline) return 0;
  if (student.enrollmentDate) {
    const days = Math.ceil((refDateMs - new Date(student.enrollmentDate).getTime()) / 864e5);
    if (days <= 30) return 3;
    if (days <= 60) return 2;
  }
  return 1;
};
var sortActiveByWeight = (arr, today, refDateMs) => {
  arr.sort((a, b) => {
    const aIsWS = a.student.withdrawalDate && a.student.withdrawalDate > today && !a.student.isTransferred ? 1 : 0;
    const bIsWS = b.student.withdrawalDate && b.student.withdrawalDate > today && !b.student.isTransferred ? 1 : 0;
    if (aIsWS !== bIsWS) return aIsWS - bIsWS;
    const wA = getEnrollmentWeight(a.student, refDateMs);
    const wB = getEnrollmentWeight(b.student, refDateMs);
    if (wA !== wB) return wA - wB;
    if (a.classIdx !== b.classIdx) return a.classIdx - b.classIdx;
    return (a.student.name || "").localeCompare(b.student.name || "", "ko");
  });
  return arr;
};
var buildCellPayload = (cellClasses, cellDays, referenceDateStr) => {
  if (cellClasses.length === 0) return null;
  const uniqueClassNames = [];
  const classIdxMap = /* @__PURE__ */ new Map();
  cellClasses.forEach((c) => {
    if (c.className && !classIdxMap.has(c.className)) {
      uniqueClassNames.push(c.className);
      classIdxMap.set(c.className, uniqueClassNames.length);
    }
  });
  const isMergedClass = uniqueClassNames.length > 1;
  const headerLines = uniqueClassNames.slice();
  const roomLines = uniqueClassNames.map((name) => {
    const cls = cellClasses.find((c) => c.className === name);
    return cls?.room || "";
  });
  const studentMap = /* @__PURE__ */ new Map();
  cellClasses.forEach((c) => {
    const classIdx = isMergedClass ? classIdxMap.get(c.className || "") || 0 : 0;
    (c.studentList || []).forEach((s) => {
      if (s.id && !studentMap.has(s.id)) studentMap.set(s.id, { student: s, classIdx });
    });
  });
  const today = (() => {
    const d = new Date(referenceDateStr);
    d.setDate(d.getDate() + 6);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  })();
  const weekEndMs = new Date(today).getTime();
  const refDateMs = new Date(referenceDateStr).getTime();
  const activeAll = [];
  const holdAll = [];
  const withdrawnAll = [];
  studentMap.forEach(({ student: s, classIdx }) => {
    const attendingCellDays = cellDays.filter((d) => isStudentAttendingDay(s, d));
    if (attendingCellDays.length === 0) return;
    const meta = { student: s, classIdx, attendingCellDays };
    const isFutureWithdrawal = s.withdrawalDate && s.withdrawalDate > today;
    const hasActiveWithdrawal = s.withdrawalDate && s.withdrawalDate <= today && !s.isTransferred;
    if (hasActiveWithdrawal) {
      const daysSince = Math.floor((weekEndMs - new Date(s.withdrawalDate).getTime()) / 864e5);
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
    cellDays.forEach((d) => {
      partialByDay[d] = [];
    });
    arr.forEach((meta) => {
      if (meta.attendingCellDays.length === cellDays.length) {
        common.push(meta);
      } else {
        meta.attendingCellDays.forEach((d) => {
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
    bgColor: first.bgColor ? hexToARGB(first.bgColor, "FFFFFFFF") : void 0,
    textColor: first.textColor ? hexToARGB(first.textColor, "FF111827") : void 0
  };
};
var formatStudentRowText = (meta, isMerged) => {
  const { student, classIdx } = meta;
  const prefix = isMerged && classIdx > 0 ? `[${classIdx}] ` : "";
  const schoolGrade = formatSchoolGrade(student.school, student.grade);
  return `${prefix}${student.name}/${schoolGrade}`;
};
async function exportMathTimetableToExcel(params) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ijw-Calander";
  workbook.created = /* @__PURE__ */ new Date();
  const {
    weekLabel,
    filteredClasses,
    allResources,
    orderedSelectedDays,
    weekDates,
    teachers,
    currentPeriods,
    subjectFilter,
    referenceDate
  } = params;
  const refStr = referenceDate || (() => {
    const firstDay = orderedSelectedDays[0];
    const d = firstDay && weekDates[firstDay]?.date;
    if (d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
    const t = /* @__PURE__ */ new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();
  const safeSheetName = `${subjectFilter || "\uC218\uD559"} ${weekLabel}`.replace(/[\\/:*?"\[\]]/g, "_").slice(0, 31);
  const sheet = workbook.addWorksheet(safeSheetName, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 4 }]
  });
  const monThuDays = orderedSelectedDays.filter((d) => d === "\uC6D4" || d === "\uBAA9");
  const tueFriDays = orderedSelectedDays.filter((d) => d === "\uD654" || d === "\uAE08");
  const hasWed = orderedSelectedDays.includes("\uC218");
  const hasSat = orderedSelectedDays.includes("\uD1A0");
  const hasSun = orderedSelectedDays.includes("\uC77C");
  const weekendDaysList = [hasSat ? "\uD1A0" : null, hasSun ? "\uC77C" : null].filter(Boolean);
  const resourceDayLookup = /* @__PURE__ */ new Map();
  filteredClasses.forEach((cls) => {
    (cls.schedule || []).forEach((slot) => {
      if (typeof slot !== "string") return;
      const parts = slot.trim().split(/\s+/);
      if (parts.length < 2) return;
      const day = parts[0];
      const normalizedPeriod = LEGACY_TO_UNIFIED_PERIOD_MAP[parts[1]] || parts[1];
      const slotKey = `${day}-${normalizedPeriod}`;
      const resource = cls.slotTeachers?.[slotKey] || cls.teacher;
      const trimmed = resource?.trim();
      if (!trimmed) return;
      if (!resourceDayLookup.has(trimmed)) resourceDayLookup.set(trimmed, /* @__PURE__ */ new Set());
      resourceDayLookup.get(trimmed).add(day);
    });
  });
  const getResourcesForDays = (days) => {
    const out = [];
    allResources.forEach((resource) => {
      const has = days.filter((d) => resourceDayLookup.get(resource?.trim())?.has(d));
      if (has.length > 0) out.push({ resource, days: has });
    });
    return out;
  };
  const weekdayGroups = [];
  if (monThuDays.length > 0) {
    const r = getResourcesForDays(monThuDays);
    if (r.length > 0) weekdayGroups.push({ title: "\uC6D4/\uBAA9", days: monThuDays, resources: r });
  }
  if (tueFriDays.length > 0) {
    const r = getResourcesForDays(tueFriDays);
    if (r.length > 0) weekdayGroups.push({ title: "\uD654/\uAE08", days: tueFriDays, resources: r });
  }
  if (hasWed) {
    const r = getResourcesForDays(["\uC218"]);
    if (r.length > 0) weekdayGroups.push({ title: "\uC218", days: ["\uC218"], resources: r });
  }
  const weekdayGroupColCounts = weekdayGroups.map((g) => g.resources.reduce((acc, r) => acc + r.days.length, 0));
  const totalWeekdayDayCols = weekdayGroupColCounts.reduce((a2, b) => a2 + b, 0);
  const weekendResources = weekendDaysList.length > 0 ? getResourcesForDays(weekendDaysList) : [];
  const totalWeekendDayCols = weekendResources.reduce((a2, r) => a2 + r.days.length, 0);
  const hasWeekend = weekendResources.length > 0;
  const WEEKDAY_PERIOD_COL = 1;
  const WEEKDAY_FIRST_DAY_COL = 2;
  const WEEKDAY_LAST_DAY_COL = 1 + totalWeekdayDayCols;
  const WEEKEND_PERIOD_COL = hasWeekend ? WEEKDAY_LAST_DAY_COL + 1 : 0;
  const WEEKEND_FIRST_DAY_COL = hasWeekend ? WEEKEND_PERIOD_COL + 1 : 0;
  const WEEKEND_LAST_DAY_COL = hasWeekend ? WEEKEND_PERIOD_COL + totalWeekendDayCols : 0;
  const totalCols = hasWeekend ? WEEKEND_LAST_DAY_COL : WEEKDAY_LAST_DAY_COL;
  const weekdayGroupStartCols = [];
  {
    let acc = WEEKDAY_FIRST_DAY_COL;
    for (let i = 0; i < weekdayGroups.length; i++) {
      weekdayGroupStartCols.push(acc);
      acc += weekdayGroupColCounts[i];
    }
  }
  const PERIOD_COL_W = 11.5;
  const DAY_COL_W = 7.5;
  const WED_COL_W = 15;
  sheet.getColumn(WEEKDAY_PERIOD_COL).width = PERIOD_COL_W;
  for (let c = WEEKDAY_FIRST_DAY_COL; c <= WEEKDAY_LAST_DAY_COL; c++) {
    sheet.getColumn(c).width = DAY_COL_W;
  }
  weekdayGroups.forEach((group, gi) => {
    if (group.title === "\uC218") {
      const startCol = weekdayGroupStartCols[gi];
      const colCount = weekdayGroupColCounts[gi];
      for (let c = startCol; c < startCol + colCount; c++) {
        sheet.getColumn(c).width = WED_COL_W;
      }
    }
  });
  if (hasWeekend) {
    sheet.getColumn(WEEKEND_PERIOD_COL).width = PERIOD_COL_W;
    for (let c = WEEKEND_FIRST_DAY_COL; c <= WEEKEND_LAST_DAY_COL; c++) {
      sheet.getColumn(c).width = WED_COL_W;
    }
  }
  const refMs0 = new Date(refStr).getTime();
  const weekEndStr0 = (() => {
    const d = new Date(refStr);
    d.setDate(d.getDate() + 6);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  })();
  const weekEndMs0 = new Date(weekEndStr0).getTime();
  const getStatusRank = (s) => {
    if (!s.withdrawalDate && !s.onHold) return 3;
    if (s.onHold && !s.withdrawalDate) return 2;
    return s.isTransferred ? 0 : 1;
  };
  const allStudentsAggMap = /* @__PURE__ */ new Map();
  filteredClasses.forEach((c) => {
    (c.studentList || []).forEach((s) => {
      if (!s.id) return;
      const existing = allStudentsAggMap.get(s.id);
      if (!existing || getStatusRank(s) > getStatusRank(existing)) {
        allStudentsAggMap.set(s.id, s);
      }
    });
  });
  let totalActive = 0, totalHold = 0, totalWithdrawn = 0, totalNew30 = 0, totalTransferIn = 0;
  allStudentsAggMap.forEach((s) => {
    const isFutureWithdrawal = s.withdrawalDate && s.withdrawalDate > weekEndStr0;
    const hasActiveWithdrawal = s.withdrawalDate && s.withdrawalDate <= weekEndStr0 && !s.isTransferred;
    if (hasActiveWithdrawal) {
      const daysSince = Math.floor((weekEndMs0 - new Date(s.withdrawalDate).getTime()) / 864e5);
      if (daysSince <= 30) totalWithdrawn++;
    } else if (s.onHold && !s.withdrawalDate) {
      totalHold++;
    } else if (!s.withdrawalDate || isFutureWithdrawal) {
      totalActive++;
      if (s.isTransferredIn) totalTransferIn++;
      const baseDate = s.firstSubjectEnrollmentDate || s.enrollmentDate;
      if (baseDate && !s.isTransferredIn) {
        const days = Math.ceil((refMs0 - new Date(baseDate).getTime()) / 864e5);
        if (days <= 30) totalNew30++;
      }
    }
  });
  let rowIdx = 1;
  const summaryRow = rowIdx++;
  sheet.getRow(summaryRow).height = 24;
  sheet.mergeCells(summaryRow, 1, summaryRow, totalCols);
  const sumCell = sheet.getCell(summaryRow, 1);
  sumCell.value = `${subjectFilter || "\uC218\uD559"} ${weekLabel}    |    \uC7AC\uC6D0 ${totalActive}\uBA85    |    \uC2E0\uC785(30\uC77C) ${totalNew30}\uBA85    |    \uBC18\uC774\uB3D9 ${totalTransferIn}\uBA85    |    \uB300\uAE30 ${totalHold}\uBA85    |    \uD1F4\uC6D0 ${totalWithdrawn}\uBA85    |    \uAE30\uC900\uC77C: ${refStr}`;
  sumCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  sumCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Malgun Gothic" };
  sumCell.alignment = { horizontal: "center", vertical: "middle" };
  sumCell.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: MEDIUM };
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
    cell.value = "\uC8FC\uB9D0";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS["\uC8FC\uB9D0"].bg } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: MEDIUM, bottom: THIN, left: MEDIUM, right: MEDIUM };
  }
  const teacherRow = rowIdx++;
  const dayRow = rowIdx++;
  sheet.getRow(teacherRow).height = 22;
  sheet.getRow(dayRow).height = 28;
  sheet.mergeCells(teacherRow, WEEKDAY_PERIOD_COL, dayRow, WEEKDAY_PERIOD_COL);
  const wdPH = sheet.getCell(teacherRow, WEEKDAY_PERIOD_COL);
  wdPH.value = "\uAD50\uC2DC";
  wdPH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  wdPH.font = { bold: true, color: { argb: "FF000000" } };
  wdPH.alignment = { horizontal: "center", vertical: "middle" };
  wdPH.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: THICK };
  const renderTeacherDayRow = (groups, groupStartCols, groupColCounts) => {
    groups.forEach((group, gi) => {
      let col = groupStartCols[gi];
      group.resources.forEach(({ resource, days }) => {
        const teacherData = teachers.find((t) => t.name === resource);
        const bg = hexToARGB(teacherData?.bgColor, "FF3B82F6");
        const fg = hexToARGB(teacherData?.textColor, "FFFFFFFF");
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
          dCell.value = dateInfo ? `${day}
${dateInfo.formatted}` : day;
          const isWeekend = day === "\uD1A0" || day === "\uC77C";
          const dayBg = isWeekend ? "FFFFF7ED" : day === "\uC218" ? "FFF0FDF4" : "FFF3F4F6";
          dCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dayBg } };
          dCell.font = { bold: true, color: { argb: "FF000000" }, size: 10 };
          dCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          const isLastInGroup = di === days.length - 1;
          const groupEndCol = groupStartCols[gi] + groupColCounts[gi] - 1;
          dCell.border = {
            top: THIN,
            bottom: THICK,
            left: di === 0 && col === groupStartCols[gi] ? MEDIUM : THIN,
            right: isLastInGroup && col + days.length - 1 === groupEndCol ? MEDIUM : isLastInGroup ? THICK : THIN
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
    weH.value = "\uAD50\uC2DC";
    weH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS["\uC8FC\uB9D0"].light } };
    weH.font = { bold: true, color: { argb: "FF000000" } };
    weH.alignment = { horizontal: "center", vertical: "middle" };
    weH.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: THICK };
    const weekendGroup = { title: "\uC8FC\uB9D0", days: weekendDaysList, resources: weekendResources };
    renderTeacherDayRow([weekendGroup], [WEEKEND_FIRST_DAY_COL], [totalWeekendDayCols]);
  }
  const SLOT_ROWS = 12;
  const GROUP_ROWS = SLOT_ROWS * 2;
  const WD_NAME_ROWS = 2;
  const WD_ROOM_ROWS = 1;
  const WD_ACTIVE_HEADER_ROWS = 1;
  const WD_ACTIVE_ROWS = 14;
  const WD_HOLD_HEADER_ROWS = 1;
  const WD_HOLD_ROWS = 2;
  const WD_WITHDRAWN_HEADER_ROWS = 1;
  const WD_WITHDRAWN_ROWS = 1;
  const WD_COUNT_ROWS = 1;
  const WEEKDAY_SLOTS = currentPeriods.slice();
  const weekdayPeriodGroups = MATH_GROUPED_PERIODS.map((gid) => {
    const periodIds = MATH_GROUP_PERIOD_IDS[gid];
    const [firstPeriod, secondPeriod] = periodIds;
    const hasFirst = currentPeriods.includes(firstPeriod);
    const hasSecond = currentPeriods.includes(secondPeriod);
    if (!hasFirst && !hasSecond) return null;
    return { gid, firstPeriod, secondPeriod, hasFirst, hasSecond, info: MATH_GROUP_DISPLAY[gid] };
  }).filter(Boolean);
  const fullyEmptyWeekdayCols = /* @__PURE__ */ new Set();
  weekdayGroups.forEach((group, gi) => {
    let col = weekdayGroupStartCols[gi];
    group.resources.forEach(({ resource, days }) => {
      days.forEach((day) => {
        const hasAny = weekdayPeriodGroups.some((pg) => {
          const f = pg.hasFirst ? getClassesForCell(filteredClasses, day, pg.firstPeriod, resource, "teacher") : [];
          const s = pg.hasSecond ? getClassesForCell(filteredClasses, day, pg.secondPeriod, resource, "teacher") : [];
          return f.length > 0 || s.length > 0;
        });
        if (!hasAny) fullyEmptyWeekdayCols.add(col);
        col++;
      });
    });
  });
  const weekendPeriods = currentPeriods.filter((p) => WEEKEND_PERIOD_TIMES[p]);
  const weekendPeriodGroups = MATH_GROUPED_PERIODS.map((gid) => {
    const periodIds = MATH_GROUP_PERIOD_IDS[gid];
    const [firstPeriod, secondPeriod] = periodIds;
    const hasFirst = weekendPeriods.includes(firstPeriod);
    const hasSecond = weekendPeriods.includes(secondPeriod);
    if (!hasFirst && !hasSecond) return null;
    const firstTime = WEEKEND_PERIOD_TIMES[firstPeriod] || "";
    const secondTime = WEEKEND_PERIOD_TIMES[secondPeriod] || "";
    const startT = (firstTime || secondTime).split("~")[0] || "";
    const endT = (secondTime || firstTime).split("~")[1] || "";
    return {
      gid,
      firstPeriod,
      secondPeriod,
      hasFirst,
      hasSecond,
      info: { label: `${gid}\uAD50\uC2DC`, time: `${startT}~${endT}` }
    };
  }).filter(Boolean);
  const fullyEmptyWeekendCols = /* @__PURE__ */ new Set();
  if (hasWeekend) {
    let col = WEEKEND_FIRST_DAY_COL;
    weekendResources.forEach(({ resource, days }) => {
      days.forEach((day) => {
        const hasAny = weekendPeriods.some((p) => {
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
          const mergedSet = /* @__PURE__ */ new Map();
          firstCls.forEach((c) => mergedSet.set(c.className, c));
          secondCls.forEach((c) => {
            if (!mergedSet.has(c.className)) mergedSet.set(c.className, c);
          });
          const cellClasses = Array.from(mergedSet.values());
          let colSpan = 1;
          if (cellClasses.length > 0 && days.length > 1 && di < days.length - 1) {
            for (let ni = di + 1; ni < days.length; ni++) {
              const nDay = days[ni];
              const nCol = col + (ni - di);
              if (fullyEmptyWeekdayCols.has(nCol)) break;
              const nFirst = pg.hasFirst ? getClassesForCell(filteredClasses, nDay, pg.firstPeriod, resource, "teacher") : [];
              const nSecond = pg.hasSecond ? getClassesForCell(filteredClasses, nDay, pg.secondPeriod, resource, "teacher") : [];
              const nMerged = /* @__PURE__ */ new Map();
              nFirst.forEach((c) => nMerged.set(c.className, c));
              nSecond.forEach((c) => {
                if (!nMerged.has(c.className)) nMerged.set(c.className, c);
              });
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
            subBotClasses: secondCls
          });
          col += colSpan;
          di += colSpan;
        }
      });
    });
    return cells;
  };
  const computeWeekendCells = () => {
    const cells = [];
    if (!hasWeekend) return cells;
    const groupEndCol = WEEKEND_LAST_DAY_COL;
    const dayColMap = /* @__PURE__ */ new Map();
    {
      let col = WEEKEND_FIRST_DAY_COL;
      weekendResources.forEach(({ resource, days }) => {
        days.forEach((day) => {
          dayColMap.set(`${resource}__${day}`, col);
          col++;
        });
      });
    }
    weekendResources.forEach(({ resource, days }) => {
      for (let si = 0; si < weekendPeriods.length; si++) {
        const slot = weekendPeriods[si];
        let di = 0;
        while (di < days.length) {
          const day = days[di];
          const col = dayColMap.get(`${resource}__${day}`);
          if (fullyEmptyWeekendCols.has(col)) {
            di++;
            continue;
          }
          const cellClasses = getClassesForCell(filteredClasses, day, slot, resource, "teacher");
          const skip = cellClasses.some(
            (cls) => shouldSkipCell(cls, day, si, cellClasses, weekendPeriods, filteredClasses, "teacher")
          );
          if (skip) {
            di++;
            continue;
          }
          const slotSpan = Math.max(1, ...cellClasses.map(
            (cls) => getConsecutiveSpan(cls, day, si, weekendPeriods, filteredClasses, "teacher")
          ));
          let colSpan = 1;
          if (cellClasses.length > 0) {
            for (let ni = di + 1; ni < days.length; ni++) {
              const nDay = days[ni];
              const nCol = dayColMap.get(`${resource}__${nDay}`);
              if (fullyEmptyWeekendCols.has(nCol)) break;
              const nClasses = getClassesForCell(filteredClasses, nDay, slot, resource, "teacher");
              if (nClasses.length === 0) break;
              if (!isSameClassNameSet(cellClasses, nClasses)) break;
              const nSpan = Math.max(1, ...nClasses.map(
                (c) => getConsecutiveSpan(c, nDay, si, weekendPeriods, filteredClasses, "teacher")
              ));
              if (nSpan !== slotSpan) break;
              colSpan++;
            }
          }
          const dayCols = [];
          const cellDays = [];
          for (let k = 0; k < colSpan; k++) {
            dayCols.push({ day: days[di + k], col: col + k });
            cellDays.push(days[di + k]);
          }
          const payload = buildCellPayload(cellClasses, cellDays, refStr);
          const endCol = col + colSpan - 1;
          cells.push({
            startCol: col,
            endCol,
            slotIndex: si,
            slotSpan,
            payload,
            isGroupRightEdge: endCol === groupEndCol,
            dayCols
          });
          di += colSpan;
        }
      }
    });
    return cells;
  };
  const refDateMs = new Date(refStr).getTime();
  const metaEntries = [];
  const cellNeedsSubSplit = (c) => {
    const topNames = new Set((c.subTopClasses || []).map((cls) => cls.className).filter(Boolean));
    const botNames = new Set((c.subBotClasses || []).map((cls) => cls.className).filter(Boolean));
    if (topNames.size !== botNames.size) return true;
    for (const n of topNames) if (!botNames.has(n)) return true;
    return false;
  };
  const allWeekendCells = computeWeekendCells();
  const weekdayGroupByIdx = /* @__PURE__ */ new Map();
  weekdayPeriodGroups.forEach((pg) => {
    const idx = MATH_GROUPED_PERIODS.indexOf(pg.gid);
    if (idx >= 0) weekdayGroupByIdx.set(idx, pg);
  });
  const weekendGroupByIdx = /* @__PURE__ */ new Map();
  weekendPeriodGroups.forEach((pg) => {
    const idx = MATH_GROUPED_PERIODS.indexOf(pg.gid);
    if (idx >= 0) weekendGroupByIdx.set(idx, pg);
  });
  allWeekendCells.forEach((wc) => {
    const gIdx = Math.floor(wc.slotIndex / 2);
    if (!weekendGroupByIdx.has(gIdx) && gIdx >= 0 && gIdx < MATH_GROUPED_PERIODS.length) {
      weekendGroupByIdx.set(gIdx, null);
    }
  });
  const activeGroupIndices = [];
  for (let g = 0; g < MATH_GROUPED_PERIODS.length; g++) {
    if (weekdayGroupByIdx.has(g) || weekendGroupByIdx.has(g)) activeGroupIndices.push(g);
  }
  const bodyStartRow2 = rowIdx;
  const blockStartRowByGroupIdx = /* @__PURE__ */ new Map();
  activeGroupIndices.forEach((gIdx, order) => {
    blockStartRowByGroupIdx.set(gIdx, bodyStartRow2 + order * GROUP_ROWS);
  });
  const totalBodyRows = activeGroupIndices.length * GROUP_ROWS;
  const bodyEndRow = bodyStartRow2 + totalBodyRows - 1;
  rowIdx = bodyEndRow + 1;
  for (let r = bodyStartRow2; r <= bodyEndRow; r++) {
    sheet.getRow(r).height = 16;
  }
  const slotStartRow = (slotIdx) => {
    const gIdx = Math.floor(slotIdx / 2);
    const blockStart = blockStartRowByGroupIdx.get(gIdx);
    if (blockStart == null) return bodyStartRow2;
    return blockStart + slotIdx % 2 * SLOT_ROWS;
  };
  const weekdayLayout = (blockStart) => {
    let r = blockStart;
    const nameTopRow = r;
    r += WD_NAME_ROWS;
    const roomRow = r;
    r += WD_ROOM_ROWS;
    const activeHeaderRow = r;
    r += WD_ACTIVE_HEADER_ROWS;
    const activeStartRow = r;
    r += WD_ACTIVE_ROWS;
    const holdHeaderRow = r;
    r += WD_HOLD_HEADER_ROWS;
    const holdStartRow = r;
    r += WD_HOLD_ROWS;
    const withdrawnHeaderRow = r;
    r += WD_WITHDRAWN_HEADER_ROWS;
    const withdrawnStartRow = r;
    r += WD_WITHDRAWN_ROWS;
    const countRow = r;
    r += WD_COUNT_ROWS;
    return {
      nameTopRow,
      nameBotRow: nameTopRow + 1,
      roomRow,
      activeHeaderRow,
      activeStartRow,
      activeRows: WD_ACTIVE_ROWS,
      holdHeaderRow,
      holdStartRow,
      holdRows: WD_HOLD_ROWS,
      withdrawnHeaderRow,
      withdrawnStartRow,
      withdrawnRows: WD_WITHDRAWN_ROWS,
      countRow,
      blockEndRow: r - 1
    };
  };
  const weekendLayout = (cell) => {
    const blockStart = slotStartRow(cell.slotIndex);
    const totalRows = cell.slotSpan * SLOT_ROWS;
    const p = cell.payload;
    const holdCount = p ? cellHoldRowsFromPayload(p) : 0;
    const wdCount = p ? p.withdrawnStudents.length : 0;
    const holdRows = holdCount > 0 ? holdCount : 0;
    const withdrawnRows = wdCount > 0 ? wdCount : 0;
    const holdHeader = holdRows > 0 ? 1 : 0;
    const withdrawnHeader = withdrawnRows > 0 ? 1 : 0;
    const fixed = WD_NAME_ROWS + WD_ROOM_ROWS + WD_ACTIVE_HEADER_ROWS + WD_COUNT_ROWS;
    const reserved = fixed + holdHeader + holdRows + withdrawnHeader + withdrawnRows;
    const activeRows = Math.max(1, totalRows - reserved);
    let r = blockStart;
    const nameTopRow = r;
    r += WD_NAME_ROWS;
    const roomRow = r;
    r += WD_ROOM_ROWS;
    const activeHeaderRow = r;
    r += WD_ACTIVE_HEADER_ROWS;
    const activeStartRow = r;
    r += activeRows;
    const holdHeaderRow = r;
    r += holdHeader;
    const holdStartRow = r;
    r += holdRows;
    const withdrawnHeaderRow = r;
    r += withdrawnHeader;
    const withdrawnStartRow = r;
    r += withdrawnRows;
    const countRow = blockStart + totalRows - 1;
    return {
      nameTopRow,
      nameBotRow: nameTopRow + 1,
      roomRow,
      activeHeaderRow,
      activeStartRow,
      activeRows,
      holdHeaderRow: holdHeader > 0 ? holdHeaderRow : 0,
      holdStartRow,
      holdRows,
      withdrawnHeaderRow: withdrawnHeader > 0 ? withdrawnHeaderRow : 0,
      withdrawnStartRow,
      withdrawnRows,
      countRow,
      blockEndRow: blockStart + totalRows - 1
    };
  };
  function cellHoldRowsFromPayload(p) {
    const cN = p.hold.common.length;
    const pMax = Math.max(0, ...Object.values(p.hold.partialByDay).map((arr) => arr.length));
    return cN + pMax;
  }
  const renderCell = (opts) => {
    const { startCol, endCol, payload, isGroupRightEdge, dayCols, subTopClasses, subBotClasses, layout, forceSubSplit } = opts;
    const rightBorder = isGroupRightEdge ? MEDIUM : THICK;
    const colSpan = endCol - startCol + 1;
    const L = layout;
    const mergeAndGet = (row) => {
      if (colSpan > 1) sheet.mergeCells(row, startCol, row, endCol);
      return sheet.getCell(row, startCol);
    };
    if (!payload) {
      sheet.mergeCells(L.nameTopRow, startCol, L.blockEndRow, endCol);
      const c = sheet.getCell(L.nameTopRow, startCol);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
      c.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };
      return;
    }
    const isMergedClass = payload.uniqueClassNames.length > 1;
    const nameBg = payload.bgColor || "FFFFFFFF";
    const nameFg = payload.textColor || "FF111827";
    const topNames = Array.from(new Set((subTopClasses || []).map((c) => c.className).filter(Boolean)));
    const botNames = Array.from(new Set((subBotClasses || []).map((c) => c.className).filter(Boolean)));
    const splits = (() => {
      if (topNames.length !== botNames.length) return true;
      const bSet = new Set(botNames);
      return topNames.some((n) => !bSet.has(n));
    })();
    const cellSplitsSub = forceSubSplit && splits;
    const primaryClassId = payload.classes[0]?.id || "";
    const primaryClassName = payload.uniqueClassNames[0] || "";
    if (!cellSplitsSub) {
      sheet.mergeCells(L.nameTopRow, startCol, L.nameBotRow, endCol);
      const nc = sheet.getCell(L.nameTopRow, startCol);
      nc.value = payload.headerLines.map((name, i) => isMergedClass ? `[${i + 1}] ${name}` : name).join("\n");
      nc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: nameBg } };
      nc.font = { bold: true, color: { argb: nameFg }, size: 10 };
      nc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      nc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
      metaEntries.push({
        kind: "class_name",
        row: L.nameTopRow,
        startCol,
        endCol,
        subPeriod: "both",
        classId: primaryClassId,
        classNameSnapshot: primaryClassName,
        bgColorSnapshot: nameBg,
        textColorSnapshot: nameFg
      });
    } else {
      if (colSpan > 1) sheet.mergeCells(L.nameTopRow, startCol, L.nameTopRow, endCol);
      const ntc = sheet.getCell(L.nameTopRow, startCol);
      if (topNames.length > 0) {
        const topFirst = (subTopClasses || []).find((c) => c.className) || payload.classes[0];
        const topBg = topFirst?.bgColor ? hexToARGB(topFirst.bgColor, "FFFFFFFF") : nameBg;
        const topFg = topFirst?.textColor ? hexToARGB(topFirst.textColor, "FF111827") : nameFg;
        ntc.value = topNames.map((name, i) => isMergedClass ? `[${i + 1}] ${name}` : name).join("\n");
        ntc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: topBg } };
        ntc.font = { bold: true, color: { argb: topFg }, size: 10 };
        metaEntries.push({
          kind: "class_name",
          row: L.nameTopRow,
          startCol,
          endCol,
          subPeriod: "top",
          classId: topFirst?.id || "",
          classNameSnapshot: topNames[0] || "",
          bgColorSnapshot: topBg,
          textColorSnapshot: topFg
        });
      } else {
        ntc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
      }
      ntc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      ntc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
      if (colSpan > 1) sheet.mergeCells(L.nameBotRow, startCol, L.nameBotRow, endCol);
      const nbc = sheet.getCell(L.nameBotRow, startCol);
      if (botNames.length > 0) {
        const botFirst = (subBotClasses || []).find((c) => c.className) || payload.classes[0];
        const botBg = botFirst?.bgColor ? hexToARGB(botFirst.bgColor, "FFFFFFFF") : nameBg;
        const botFg = botFirst?.textColor ? hexToARGB(botFirst.textColor, "FF111827") : nameFg;
        nbc.value = botNames.map((name, i) => isMergedClass ? `[${i + 1}] ${name}` : name).join("\n");
        nbc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: botBg } };
        nbc.font = { bold: true, color: { argb: botFg }, size: 10 };
        metaEntries.push({
          kind: "class_name",
          row: L.nameBotRow,
          startCol,
          endCol,
          subPeriod: "bot",
          classId: botFirst?.id || "",
          classNameSnapshot: botNames[0] || "",
          bgColorSnapshot: botBg,
          textColorSnapshot: botFg
        });
      } else {
        nbc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
      }
      nbc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      nbc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
    }
    sheet.getRow(L.nameTopRow).height = 22;
    sheet.getRow(L.nameBotRow).height = 22;
    const rc = mergeAndGet(L.roomRow);
    const roomText = payload.roomLines.filter((r) => r).join(" / ");
    rc.value = roomText;
    rc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    rc.font = { color: { argb: "FF374151" }, size: 9 };
    rc.alignment = { horizontal: "center", vertical: "middle" };
    rc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
    sheet.getRow(L.roomRow).height = 16;
    metaEntries.push({
      kind: "class_room",
      row: L.roomRow,
      startCol,
      endCol,
      classId: primaryClassId,
      roomSnapshot: roomText
    });
    const ah = mergeAndGet(L.activeHeaderRow);
    if (payload.activeTotal > 0) {
      ah.value = `${payload.activeTotal}\uBA85 - \uC7AC\uC6D0\uC0DD`;
      ah.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
      ah.font = { bold: true, color: { argb: "FF4F46E5" }, size: 9 };
    } else {
      ah.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    }
    ah.alignment = { horizontal: "center", vertical: "middle" };
    ah.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
    sheet.getRow(L.activeHeaderRow).height = 18;
    const commonActive = payload.active.common;
    const partialActive = payload.active.partialByDay;
    const partialActiveMax = Math.max(0, ...Object.values(partialActive).map((arr) => arr.length));
    const usedActive = commonActive.length + partialActiveMax;
    if (usedActive > L.activeRows) {
      console.warn(`[excelExport] \uC7AC\uC6D0 \uD559\uC0DD ${usedActive}\uBA85\uC774 \uACE0\uC815 \uD589(${L.activeRows})\uC744 \uCD08\uACFC \u2014 \uC77C\uBD80 \uC798\uB9BC (\uBC18: ${primaryClassName})`);
    }
    for (let i = 0; i < L.activeRows; i++) {
      const row = L.activeStartRow + i;
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
          sourceClassId: primaryClassId
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
              sourceClassId: primaryClassId
            });
          } else {
            cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
          }
          cc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
          cc.border = {
            top: THIN,
            bottom: THIN,
            left: THIN,
            right: dci === dayCols.length - 1 ? rightBorder : THIN
          };
        });
      } else {
        const c = mergeAndGet(row);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
      }
    }
    if (L.holdHeaderRow > 0 && L.holdRows > 0) {
      const hh = mergeAndGet(L.holdHeaderRow);
      if (payload.holdTotal > 0) {
        hh.value = `${payload.holdTotal}\uBA85 - \uB300\uAE30`;
        hh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
        hh.font = { bold: true, color: { argb: "FFCA8A04" }, size: 9 };
      } else {
        hh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      }
      hh.alignment = { horizontal: "center", vertical: "middle" };
      hh.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
      sheet.getRow(L.holdHeaderRow).height = 18;
      const commonHold = payload.hold.common;
      const partialHold = payload.hold.partialByDay;
      const partialHoldMax = Math.max(0, ...Object.values(partialHold).map((arr) => arr.length));
      for (let i = 0; i < L.holdRows; i++) {
        const row = L.holdStartRow + i;
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
            sourceClassId: primaryClassId
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
                sourceClassId: primaryClassId
              });
            } else {
              cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            }
            cc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
            cc.border = {
              top: THIN,
              bottom: THIN,
              left: THIN,
              right: dci === dayCols.length - 1 ? rightBorder : THIN
            };
          });
        } else {
          const c = mergeAndGet(row);
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
          c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
        }
      }
    }
    if (L.withdrawnHeaderRow > 0 && L.withdrawnRows > 0) {
      const wh = mergeAndGet(L.withdrawnHeaderRow);
      if (payload.withdrawnStudents.length > 0) {
        wh.value = `${payload.withdrawnStudents.length}\uBA85 - \uD1F4\uC6D0`;
        wh.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      }
      wh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WITHDRAWN_BG } };
      wh.alignment = { horizontal: "center", vertical: "middle" };
      wh.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
      sheet.getRow(L.withdrawnHeaderRow).height = 18;
      for (let i = 0; i < L.withdrawnRows; i++) {
        const row = L.withdrawnStartRow + i;
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
            sourceClassId: primaryClassId
          });
        }
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WITHDRAWN_BG } };
        c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
        c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
      }
    }
    sheet.getRow(L.countRow).height = 20;
    dayCols.forEach(({ day, col }, dci) => {
      const dayCount = commonActive.length + (partialActive[day]?.length || 0);
      const cc = sheet.getCell(L.countRow, col);
      cc.value = dayCount;
      cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      cc.font = { bold: true, color: { argb: "FF111827" }, size: 10 };
      cc.alignment = { horizontal: "center", vertical: "middle" };
      cc.border = {
        top: THICK,
        bottom: THICK,
        left: THIN,
        right: dci === dayCols.length - 1 ? rightBorder : THIN
      };
    });
  };
  activeGroupIndices.forEach((gIdx) => {
    const blockStart = blockStartRowByGroupIdx.get(gIdx);
    const blockEnd = blockStart + GROUP_ROWS - 1;
    const weekdayPg = weekdayGroupByIdx.get(gIdx);
    const weekendPg = weekendGroupByIdx.get(gIdx);
    sheet.mergeCells(blockStart, WEEKDAY_PERIOD_COL, blockEnd, WEEKDAY_PERIOD_COL);
    const wpl = sheet.getCell(blockStart, WEEKDAY_PERIOD_COL);
    if (weekdayPg) {
      wpl.value = `${weekdayPg.info.label}
${weekdayPg.info.time}`;
      wpl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      wpl.font = { bold: true, color: { argb: "FF000000" }, size: 11 };
      wpl.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      wpl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
    } else {
      wpl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
      wpl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
    }
    if (hasWeekend) {
      sheet.mergeCells(blockStart, WEEKEND_PERIOD_COL, blockEnd, WEEKEND_PERIOD_COL);
      const epl = sheet.getCell(blockStart, WEEKEND_PERIOD_COL);
      if (weekendPg) {
        epl.value = `${weekendPg.info.label}
${weekendPg.info.time}`;
        epl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS["\uC8FC\uB9D0"].light } };
        epl.font = { bold: true, color: { argb: "FF000000" }, size: 11 };
        epl.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        epl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
      } else {
        epl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
        epl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
      }
    }
    if (weekdayPg) {
      const wdCells = computeWeekdayCells(weekdayPg);
      const forceSubSplit = wdCells.some((c) => c.payload && cellNeedsSubSplit(c));
      const layout = weekdayLayout(blockStart);
      wdCells.forEach((cell) => {
        renderCell({
          startCol: cell.startCol,
          endCol: cell.endCol,
          payload: cell.payload,
          isGroupRightEdge: cell.isGroupRightEdge,
          dayCols: cell.dayCols,
          subTopClasses: cell.subTopClasses,
          subBotClasses: cell.subBotClasses,
          layout,
          forceSubSplit
        });
      });
    }
  });
  allWeekendCells.forEach((cell) => {
    const layout = weekendLayout(cell);
    renderCell({
      startCol: cell.startCol,
      endCol: cell.endCol,
      payload: cell.payload,
      isGroupRightEdge: cell.isGroupRightEdge,
      dayCols: cell.dayCols,
      // 주말은 sub-period 분할 없음 (슬롯=1시간 단위, getConsecutiveSpan 이 병합 처리)
      subTopClasses: cell.payload?.classes || [],
      subBotClasses: cell.payload?.classes || [],
      layout,
      forceSubSplit: false
    });
  });
  const lastBodyRow = bodyEndRow;
  fullyEmptyWeekdayCols.forEach((col) => {
    if (lastBodyRow >= bodyStartRow2) {
      sheet.mergeCells(bodyStartRow2, col, lastBodyRow, col);
      const c = sheet.getCell(bodyStartRow2, col);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
      c.border = { top: THIN, bottom: THICK, left: THIN, right: THICK };
    }
  });
  fullyEmptyWeekendCols.forEach((col) => {
    if (lastBodyRow >= bodyStartRow2) {
      sheet.mergeCells(bodyStartRow2, col, lastBodyRow, col);
      const c = sheet.getCell(bodyStartRow2, col);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
      c.border = { top: THIN, bottom: THICK, left: THIN, right: THICK };
    }
  });
  const metaSheet = workbook.addWorksheet("_meta", { state: "hidden" });
  metaSheet.addRow(["__schema_version__", "subjectFilter", "weekLabel", "referenceDate", "sheetName"]);
  metaSheet.addRow(["1", subjectFilter || "\uC218\uD559", weekLabel, refStr, safeSheetName]);
  metaSheet.addRow([]);
  metaSheet.addRow([
    "kind",
    "row",
    "startCol",
    "endCol",
    "section",
    "subPeriod",
    "classId",
    "classNameSnapshot",
    "roomSnapshot",
    "studentId",
    "studentNameSnapshot",
    "sourceClassId",
    "bgColorSnapshot",
    "textColorSnapshot"
  ]);
  metaEntries.forEach((e) => {
    metaSheet.addRow([
      e.kind,
      e.row,
      e.startCol,
      e.endCol,
      e.section || "",
      e.subPeriod || "",
      e.classId || "",
      e.classNameSnapshot || "",
      e.roomSnapshot || "",
      e.studentId || "",
      e.studentNameSnapshot || "",
      e.sourceClassId || "",
      e.bgColorSnapshot || "",
      e.textColorSnapshot || ""
    ]);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  if (params.returnBufferOnly) {
    return buffer;
  }
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const safeWeekLabel = weekLabel.replace(/[\\/:*?"<>|]/g, "_");
  const filename = `${subjectFilter || "\uC218\uD559"}_\uC2DC\uAC04\uD45C_${safeWeekLabel}.xlsx`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  exportMathTimetableToExcel
});
