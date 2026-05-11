import type { TimetableClass, Teacher, UnifiedStudent } from '../../../../types';
import {
    MATH_GROUPED_PERIODS,
    MATH_GROUP_PERIOD_IDS,
    MATH_GROUP_DISPLAY,
    LEGACY_TO_UNIFIED_PERIOD_MAP,
    WEEKEND_PERIOD_TIMES,
} from '../../constants';
import { getClassesForCell, isSameClassNameSet } from './gridUtils';
import { formatSchoolGrade } from '../../../../utils/studentUtils';

export interface ExportTimetableParams {
    weekLabel: string;
    filteredClasses: TimetableClass[];
    allResources: string[];
    orderedSelectedDays: string[];
    weekDates: Record<string, { date: Date; formatted: string }>;
    teachers: Teacher[];
    currentPeriods: string[];
    studentMap: Record<string, UnifiedStudent>;
    subjectFilter: string;
    showHoldStudents?: boolean;
    showWithdrawnStudents?: boolean;
    referenceDate?: string;  // YYYY-MM-DD (기준일, 퇴원/대기 분류용)
}

const hexToARGB = (hex: string | undefined, fallback: string): string => {
    if (!hex) return fallback;
    const clean = hex.replace('#', '').trim();
    if (clean.length === 6) return `FF${clean.toUpperCase()}`;
    if (clean.length === 8) return clean.toUpperCase();
    if (clean.length === 3) {
        const expanded = clean.split('').map(c => c + c).join('');
        return `FF${expanded.toUpperCase()}`;
    }
    return fallback;
};

const GROUP_COLORS: Record<string, { bg: string; light: string }> = {
    '월/목': { bg: 'FF2563EB', light: 'FFEFF6FF' },
    '화/금': { bg: 'FF9333EA', light: 'FFFAF5FF' },
    '수': { bg: 'FF16A34A', light: 'FFF0FDF4' },
    '주말': { bg: 'FFEA580C', light: 'FFFFF7ED' },
};

const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } };
const MEDIUM = { style: 'medium' as const, color: { argb: 'FF000000' } };
const THICK = { style: 'thick' as const, color: { argb: 'FF000000' } };
const EMPTY_BG = 'FFE5E7EB';
const WITHDRAWN_BG = 'FF1F2937'; // 검정 (퇴원 행)

// 학생 + 합반 인덱스 메타 (합반 시 어느 수업 소속인지)
interface StudentWithMeta {
    student: any;
    classIdx: number;            // 합반: 1, 2, ... / 단일: 0
    attendingCellDays: string[]; // 이 셀의 요일들 중 학생이 실제로 등원하는 요일
}

// 셀 내부 학생을 공통/부분 등원으로 분리
interface PartitionedStudents {
    common: StudentWithMeta[];                            // 모든 셀 요일에 등원 (가로 병합 표시)
    partialByDay: Record<string, StudentWithMeta[]>;      // 일부 요일만 등원 (해당 요일 컬럼에만 표시)
}

interface CellPayload {
    classes: TimetableClass[];
    uniqueClassNames: string[];      // 합반 시 unique 수업명 (라벨링 순서)
    cellDays: string[];              // 이 셀이 커버하는 요일 (예: ['월','목'])
    active: PartitionedStudents;
    hold: PartitionedStudents;
    withdrawnStudents: StudentWithMeta[];  // 퇴원은 요일 분리 없음 (ClassCard 와 동일)
    activeTotal: number;             // 재원 전체 인원 (헤더용)
    holdTotal: number;
    withdrawnTotal: number;
    headerLines: string[];           // 수업명 (강의실은 별도 줄)
    roomLines: string[];             // 강의실 (수업별)
    bgColor?: string;
    textColor?: string;
}

// 학생이 특정 요일에 등원하는지 (ClassCard.tsx isStudentAttendingDay 와 동일)
const isStudentAttendingDay = (student: any, day: string): boolean => {
    const attendanceDays = student.attendanceDays;
    if (!attendanceDays || attendanceDays.length === 0) return true;  // 설정 없으면 모든 요일 등원
    return attendanceDays.includes(day);
};

// 학생별 엑셀 스타일 (ClassCard.tsx:608-620 와 동일 규칙)
const resolveStudentStyle = (
    student: any,
    refDateMs: number,
): { bgARGB: string; fgARGB: string; bold: boolean } => {
    // 반이동 입학: 초록 (bg-green-200)
    if (student.isTransferredIn) {
        return { bgARGB: 'FFBBF7D0', fgARGB: 'FF111827', bold: true };
    }
    // firstSubjectEnrollmentDate 우선, 없으면 enrollmentDate
    const baseDate = student.firstSubjectEnrollmentDate || student.enrollmentDate;
    if (baseDate) {
        const days = Math.ceil((refDateMs - new Date(baseDate).getTime()) / 86400000);
        if (days <= 30) return { bgARGB: 'FFEF4444', fgARGB: 'FFFFFFFF', bold: true };
        if (days <= 60) return { bgARGB: 'FFFCE7F3', fgARGB: 'FF111827', bold: true };
    }
    return { bgARGB: 'FFFFFFFF', fgARGB: 'FF111827', bold: false };
};

// 정렬 가중치 (ClassCard 와 동일: 반이동 -1 → underline 0 → 일반 1 → 60일 2 → 30일 3)
const getEnrollmentWeight = (student: any, refDateMs: number): number => {
    if (student.isTransferredIn) return -1;
    if (student.underline) return 0;
    if (student.enrollmentDate) {
        const days = Math.ceil((refDateMs - new Date(student.enrollmentDate).getTime()) / 86400000);
        if (days <= 30) return 3;
        if (days <= 60) return 2;
    }
    return 1;
};

// 정렬 + filter 헬퍼 (재원/대기/퇴원 공통)
const sortActiveByWeight = (
    arr: StudentWithMeta[],
    today: string,
    refDateMs: number,
): StudentWithMeta[] => {
    arr.sort((a, b) => {
        const aIsWS = (a.student.withdrawalDate && a.student.withdrawalDate > today && !a.student.isTransferred) ? 1 : 0;
        const bIsWS = (b.student.withdrawalDate && b.student.withdrawalDate > today && !b.student.isTransferred) ? 1 : 0;
        if (aIsWS !== bIsWS) return aIsWS - bIsWS;
        const wA = getEnrollmentWeight(a.student, refDateMs);
        const wB = getEnrollmentWeight(b.student, refDateMs);
        if (wA !== wB) return wA - wB;
        if (a.classIdx !== b.classIdx) return a.classIdx - b.classIdx;
        return (a.student.name || '').localeCompare(b.student.name || '', 'ko');
    });
    return arr;
};

const buildCellPayload = (
    cellClasses: TimetableClass[],
    cellDays: string[],
    referenceDateStr: string,
): CellPayload | null => {
    if (cellClasses.length === 0) return null;

    // 합반 처리: unique 수업명 순서 (className 첫 등장 순)
    const uniqueClassNames: string[] = [];
    const classIdxMap = new Map<string, number>();
    cellClasses.forEach(c => {
        if (c.className && !classIdxMap.has(c.className)) {
            uniqueClassNames.push(c.className);
            classIdxMap.set(c.className, uniqueClassNames.length); // 1부터
        }
    });
    const isMergedClass = uniqueClassNames.length > 1;

    const headerLines = uniqueClassNames.slice();
    const roomLines = uniqueClassNames.map(name => {
        const cls = cellClasses.find(c => c.className === name);
        return cls?.room || '';
    });

    // 학생 수집: 학생ID 별 첫 등장 cls 기준으로 classIdx 결정
    const studentMap = new Map<string, { student: any; classIdx: number }>();
    cellClasses.forEach(c => {
        const classIdx = isMergedClass ? (classIdxMap.get(c.className || '') || 0) : 0;
        (c.studentList || []).forEach((s: any) => {
            if (s.id && !studentMap.has(s.id)) studentMap.set(s.id, { student: s, classIdx });
        });
    });

    const today = referenceDateStr;
    const refDateMs = new Date(today).getTime();

    // 분류 (재원/대기/퇴원) + cellDays 기준 attendingCellDays 계산
    const activeAll: StudentWithMeta[] = [];
    const holdAll: StudentWithMeta[] = [];
    const withdrawnAll: StudentWithMeta[] = [];

    studentMap.forEach(({ student: s, classIdx }) => {
        const attendingCellDays = cellDays.filter(d => isStudentAttendingDay(s, d));
        // 셀의 어느 요일에도 등원하지 않으면 제외
        if (attendingCellDays.length === 0) return;

        const meta: StudentWithMeta = { student: s, classIdx, attendingCellDays };
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
    holdAll.sort((a, b) => (a.student.name || '').localeCompare(b.student.name || '', 'ko'));
    withdrawnAll.sort((a, b) => (a.student.name || '').localeCompare(b.student.name || '', 'ko'));

    // 공통/부분 분리 (active, hold만 — withdrawn은 요일 분리 안 함)
    const partition = (arr: StudentWithMeta[]): PartitionedStudents => {
        const common: StudentWithMeta[] = [];
        const partialByDay: Record<string, StudentWithMeta[]> = {};
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
        bgColor: first.bgColor ? hexToARGB(first.bgColor, 'FFFFFFFF') : undefined,
        textColor: first.textColor ? hexToARGB(first.textColor, 'FF111827') : undefined,
    };
};

interface GroupSpec {
    title: string;
    days: string[];
    resources: { resource: string; days: string[] }[];
}

interface ResolvedCell {
    startCol: number;
    endCol: number;
    payload: CellPayload | null;
    isGroupRightEdge: boolean;
    dayCols: Array<{ day: string; col: number }>;
    // Sub-period 정보 (1교시 = 1-1 + 1-2): 평일 셀만 사용, 주말은 단일
    subTopClasses?: TimetableClass[];  // 1-1, 2-1, 3-1, 4-1 (firstPeriod)
    subBotClasses?: TimetableClass[];  // 1-2, 2-2, 3-2, 4-2 (secondPeriod)
}

// 학생 행 텍스트: "김아름/5칠성초" (합반 시 "[1] 김아름/5칠성초")
const formatStudentRowText = (
    meta: StudentWithMeta,
    isMerged: boolean,
): string => {
    const { student, classIdx } = meta;
    const prefix = isMerged && classIdx > 0 ? `[${classIdx}] ` : '';
    const schoolGrade = formatSchoolGrade(student.school, student.grade);
    return `${prefix}${student.name}/${schoolGrade}`;
};

export async function exportMathTimetableToExcel(params: ExportTimetableParams): Promise<void> {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ijw-Calander';
    workbook.created = new Date();

    const {
        weekLabel,
        filteredClasses,
        allResources,
        orderedSelectedDays,
        weekDates,
        teachers,
        currentPeriods,
        subjectFilter,
        referenceDate,
    } = params;

    // 기준일: param > weekDates 첫 일자 > 오늘
    const refStr = referenceDate
        || (() => {
            const firstDay = orderedSelectedDays[0];
            const d = firstDay && weekDates[firstDay]?.date;
            if (d) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${dd}`;
            }
            const t = new Date();
            return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        })();

    // 시트명: 과목 + 주차 (타이틀 행 제거 대신 시트명에 포함)
    const safeSheetName = `${subjectFilter || '수학'} ${weekLabel}`.replace(/[\\/:*?"\[\]]/g, '_').slice(0, 31);
    const sheet = workbook.addWorksheet(safeSheetName, {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }],
    });

    // 그룹 분류
    const monThuDays = orderedSelectedDays.filter(d => d === '월' || d === '목');
    const tueFriDays = orderedSelectedDays.filter(d => d === '화' || d === '금');
    const hasWed = orderedSelectedDays.includes('수');
    const hasSat = orderedSelectedDays.includes('토');
    const hasSun = orderedSelectedDays.includes('일');
    const weekendDaysList = [hasSat ? '토' : null, hasSun ? '일' : null].filter(Boolean) as string[];

    // 리소스 → 요일 lookup
    const resourceDayLookup = new Map<string, Set<string>>();
    filteredClasses.forEach(cls => {
        (cls.schedule || []).forEach(slot => {
            if (typeof slot !== 'string') return;
            const parts = slot.trim().split(/\s+/);
            if (parts.length < 2) return;
            const day = parts[0];
            const normalizedPeriod = LEGACY_TO_UNIFIED_PERIOD_MAP[parts[1]] || parts[1];
            const slotKey = `${day}-${normalizedPeriod}`;
            const resource = cls.slotTeachers?.[slotKey] || cls.teacher;
            const trimmed = resource?.trim();
            if (!trimmed) return;
            if (!resourceDayLookup.has(trimmed)) resourceDayLookup.set(trimmed, new Set());
            resourceDayLookup.get(trimmed)!.add(day);
        });
    });

    const getResourcesForDays = (days: string[]) => {
        const out: { resource: string; days: string[] }[] = [];
        allResources.forEach(resource => {
            const has = days.filter(d => resourceDayLookup.get(resource?.trim())?.has(d));
            if (has.length > 0) out.push({ resource, days: has });
        });
        return out;
    };

    const weekdayGroups: GroupSpec[] = [];
    if (monThuDays.length > 0) {
        const r = getResourcesForDays(monThuDays);
        if (r.length > 0) weekdayGroups.push({ title: '월/목', days: monThuDays, resources: r });
    }
    if (tueFriDays.length > 0) {
        const r = getResourcesForDays(tueFriDays);
        if (r.length > 0) weekdayGroups.push({ title: '화/금', days: tueFriDays, resources: r });
    }
    if (hasWed) {
        const r = getResourcesForDays(['수']);
        if (r.length > 0) weekdayGroups.push({ title: '수', days: ['수'], resources: r });
    }

    const weekdayGroupColCounts = weekdayGroups.map(g => g.resources.reduce((acc, r) => acc + r.days.length, 0));
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

    const weekdayGroupStartCols: number[] = [];
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

    // ─── 전체 학생 집계 (상단 합계 행용) ───
    const refMs0 = new Date(refStr).getTime();
    const allStudentsAggMap = new Map<string, any>();
    filteredClasses.forEach(c => {
        (c.studentList || []).forEach((s: any) => {
            if (s.id && !allStudentsAggMap.has(s.id)) allStudentsAggMap.set(s.id, s);
        });
    });

    let totalActive = 0, totalHold = 0, totalWithdrawn = 0, totalNew30 = 0, totalTransferIn = 0;
    allStudentsAggMap.forEach((s: any) => {
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

    // ─── Row 1: 합계 행 ───
    let rowIdx = 1;
    const summaryRow = rowIdx++;
    sheet.getRow(summaryRow).height = 24;
    sheet.mergeCells(summaryRow, 1, summaryRow, totalCols);
    const sumCell = sheet.getCell(summaryRow, 1);
    sumCell.value = `${subjectFilter || '수학'} ${weekLabel}    |    재원 ${totalActive}명    |    신입(30일) ${totalNew30}명    |    반이동 ${totalTransferIn}명    |    대기 ${totalHold}명    |    퇴원 ${totalWithdrawn}명    |    기준일: ${refStr}`;
    sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
    sumCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Malgun Gothic' };
    sumCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sumCell.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: MEDIUM };

    // ─── Row 2: Group titles ───
    const groupTitleRow = rowIdx++;
    sheet.getRow(groupTitleRow).height = 22;

    weekdayGroups.forEach((group, gi) => {
        const startCol = weekdayGroupStartCols[gi];
        const endCol = startCol + weekdayGroupColCounts[gi] - 1;
        if (endCol > startCol) sheet.mergeCells(groupTitleRow, startCol, groupTitleRow, endCol);
        const cell = sheet.getCell(groupTitleRow, startCol);
        cell.value = group.title;
        const color = GROUP_COLORS[group.title] || { bg: 'FF6B7280', light: 'FFF3F4F6' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: MEDIUM, bottom: THIN, left: MEDIUM, right: MEDIUM };
    });
    if (hasWeekend) {
        if (WEEKEND_LAST_DAY_COL > WEEKEND_FIRST_DAY_COL) {
            sheet.mergeCells(groupTitleRow, WEEKEND_FIRST_DAY_COL, groupTitleRow, WEEKEND_LAST_DAY_COL);
        }
        const cell = sheet.getCell(groupTitleRow, WEEKEND_FIRST_DAY_COL);
        cell.value = '주말';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_COLORS['주말'].bg } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: MEDIUM, bottom: THIN, left: MEDIUM, right: MEDIUM };
    }

    // ─── Rows 2-3: Teacher + Day ───
    const teacherRow = rowIdx++;
    const dayRow = rowIdx++;
    sheet.getRow(teacherRow).height = 22;
    sheet.getRow(dayRow).height = 28;

    sheet.mergeCells(teacherRow, WEEKDAY_PERIOD_COL, dayRow, WEEKDAY_PERIOD_COL);
    const wdPH = sheet.getCell(teacherRow, WEEKDAY_PERIOD_COL);
    wdPH.value = '교시';
    wdPH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    wdPH.font = { bold: true, color: { argb: 'FF000000' } };
    wdPH.alignment = { horizontal: 'center', vertical: 'middle' };
    wdPH.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: THICK };

    const renderTeacherDayRow = (
        groups: GroupSpec[],
        groupStartCols: number[],
        groupColCounts: number[],
    ) => {
        groups.forEach((group, gi) => {
            let col = groupStartCols[gi];
            group.resources.forEach(({ resource, days }) => {
                const teacherData = teachers.find(t => t.name === resource);
                const bg = hexToARGB(teacherData?.bgColor, 'FF3B82F6');
                const fg = hexToARGB(teacherData?.textColor, 'FFFFFFFF');
                const sc = col;
                const ec = col + days.length - 1;
                if (days.length > 1) sheet.mergeCells(teacherRow, sc, teacherRow, ec);
                const tCell = sheet.getCell(teacherRow, sc);
                tCell.value = resource;
                tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                tCell.font = { bold: true, color: { argb: fg }, size: 11 };
                tCell.alignment = { horizontal: 'center', vertical: 'middle' };
                tCell.border = { top: THIN, bottom: THIN, left: gi === 0 && col === groupStartCols[0] ? MEDIUM : THIN, right: THICK };
                days.forEach((day, di) => {
                    const dCell = sheet.getCell(dayRow, col + di);
                    const dateInfo = weekDates[day];
                    dCell.value = dateInfo ? `${day}\n${dateInfo.formatted}` : day;
                    const isWeekend = day === '토' || day === '일';
                    const dayBg = isWeekend ? 'FFFFF7ED' : day === '수' ? 'FFF0FDF4' : 'FFF3F4F6';
                    dCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dayBg } };
                    dCell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
                    dCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
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
        weH.value = '교시';
        weH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_COLORS['주말'].light } };
        weH.font = { bold: true, color: { argb: 'FF000000' } };
        weH.alignment = { horizontal: 'center', vertical: 'middle' };
        weH.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: THICK };

        const weekendGroup: GroupSpec = { title: '주말', days: weekendDaysList, resources: weekendResources };
        renderTeacherDayRow([weekendGroup], [WEEKEND_FIRST_DAY_COL], [totalWeekendDayCols]);
    }

    // 평일 교시 그룹 사전 계산
    const weekdayPeriodGroups = MATH_GROUPED_PERIODS
        .map(gid => {
            const periodIds = MATH_GROUP_PERIOD_IDS[gid];
            const [firstPeriod, secondPeriod] = periodIds;
            const hasFirst = currentPeriods.includes(firstPeriod);
            const hasSecond = currentPeriods.includes(secondPeriod);
            if (!hasFirst && !hasSecond) return null;
            return { gid, firstPeriod, secondPeriod, hasFirst, hasSecond, info: MATH_GROUP_DISPLAY[gid] };
        })
        .filter(Boolean) as Array<{
            gid: string; firstPeriod: string; secondPeriod: string;
            hasFirst: boolean; hasSecond: boolean; info: { label: string; time: string };
        }>;

    // ─── 완전 빈 (강사×요일) 컬럼 탐지 ───
    // 평일: 모든 교시·서브교시에 수업 없으면 fully-empty
    const fullyEmptyWeekdayCols = new Set<number>();
    weekdayGroups.forEach((group, gi) => {
        let col = weekdayGroupStartCols[gi];
        group.resources.forEach(({ resource, days }) => {
            days.forEach(day => {
                const hasAny = weekdayPeriodGroups.some(pg => {
                    const f = pg.hasFirst ? getClassesForCell(filteredClasses, day, pg.firstPeriod, resource, 'teacher') : [];
                    const s = pg.hasSecond ? getClassesForCell(filteredClasses, day, pg.secondPeriod, resource, 'teacher') : [];
                    return f.length > 0 || s.length > 0;
                });
                if (!hasAny) fullyEmptyWeekdayCols.add(col);
                col++;
            });
        });
    });

    const weekendPeriods = currentPeriods.filter(p => WEEKEND_PERIOD_TIMES[p]);
    const fullyEmptyWeekendCols = new Set<number>();
    if (hasWeekend) {
        let col = WEEKEND_FIRST_DAY_COL;
        weekendResources.forEach(({ resource, days }) => {
            days.forEach(day => {
                const hasAny = weekendPeriods.some(p => {
                    const cls = getClassesForCell(filteredClasses, day, p, resource, 'teacher');
                    return cls.length > 0;
                });
                if (!hasAny) fullyEmptyWeekendCols.add(col);
                col++;
            });
        });
    }

    // 셀 계산 헬퍼: 평일
    const computeWeekdayCells = (pg: typeof weekdayPeriodGroups[0]): ResolvedCell[] => {
        const cells: ResolvedCell[] = [];
        weekdayGroups.forEach((group, gi) => {
            let col = weekdayGroupStartCols[gi];
            const groupEndCol = col + weekdayGroupColCounts[gi] - 1;
            group.resources.forEach(({ resource, days }) => {
                let di = 0;
                while (di < days.length) {
                    const day = days[di];
                    // 완전 빈 컬럼이면 셀 자체를 만들지 않음 (외부에서 세로 병합 처리)
                    if (fullyEmptyWeekdayCols.has(col)) {
                        col++;
                        di++;
                        continue;
                    }
                    const firstCls = pg.hasFirst ? getClassesForCell(filteredClasses, day, pg.firstPeriod, resource, 'teacher') : [];
                    const secondCls = pg.hasSecond ? getClassesForCell(filteredClasses, day, pg.secondPeriod, resource, 'teacher') : [];

                    const mergedSet = new Map<string, TimetableClass>();
                    firstCls.forEach(c => mergedSet.set(c.className, c));
                    secondCls.forEach(c => { if (!mergedSet.has(c.className)) mergedSet.set(c.className, c); });
                    const cellClasses = Array.from(mergedSet.values());

                    let colSpan = 1;
                    if (cellClasses.length > 0 && days.length > 1 && di < days.length - 1) {
                        for (let ni = di + 1; ni < days.length; ni++) {
                            const nDay = days[ni];
                            const nCol = col + (ni - di);
                            // 다음 컬럼이 fully-empty면 병합 금지
                            if (fullyEmptyWeekdayCols.has(nCol)) break;
                            const nFirst = pg.hasFirst ? getClassesForCell(filteredClasses, nDay, pg.firstPeriod, resource, 'teacher') : [];
                            const nSecond = pg.hasSecond ? getClassesForCell(filteredClasses, nDay, pg.secondPeriod, resource, 'teacher') : [];
                            const nMerged = new Map<string, TimetableClass>();
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

                    // dayCols 계산 (셀이 커버하는 요일들 + 컬럼 매핑)
                    const dayCols: Array<{ day: string; col: number }> = [];
                    const cellDays: string[] = [];
                    for (let k = 0; k < colSpan; k++) {
                        dayCols.push({ day: days[di + k], col: col + k });
                        cellDays.push(days[di + k]);
                    }
                    // Sub-period 정보: 가로 병합 시 첫 컬럼의 sub-period 사용 (병합된 셀은 모두 같은 className set)
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

    const computeWeekendCells = (period: string): ResolvedCell[] => {
        const cells: ResolvedCell[] = [];
        let col = WEEKEND_FIRST_DAY_COL;
        const groupEndCol = WEEKEND_LAST_DAY_COL;
        weekendResources.forEach(({ resource, days }) => {
            days.forEach(day => {
                if (fullyEmptyWeekendCols.has(col)) {
                    col++;
                    return;
                }
                const cls = getClassesForCell(filteredClasses, day, period, resource, 'teacher');
                const payload = buildCellPayload(cls, [day], refStr);
                cells.push({
                    startCol: col,
                    endCol: col,
                    payload,
                    isGroupRightEdge: col === groupEndCol,
                    dayCols: [{ day, col }],
                    // 주말은 sub-period 없음
                    subTopClasses: cls,
                    subBotClasses: [],
                });
                col++;
            });
        });
        return cells;
    };

    // 본문 시작 row (모든 교시의 헤더부터 카운트까지)
    const bodyStartRow = rowIdx;
    const refDateMs = new Date(refStr).getTime();

    // 셀별 active/hold 사용 행 수 (공통 + max 부분 등원)
    const cellActiveRows = (c: ResolvedCell): number => {
        if (!c.payload) return 0;
        const cN = c.payload.active.common.length;
        const pMax = Math.max(0, ...Object.values(c.payload.active.partialByDay).map(arr => arr.length));
        return cN + pMax;
    };
    const cellHoldRows = (c: ResolvedCell): number => {
        if (!c.payload) return 0;
        const cN = c.payload.hold.common.length;
        const pMax = Math.max(0, ...Object.values(c.payload.hold.partialByDay).map(arr => arr.length));
        return cN + pMax;
    };

    // 셀의 sub-period 구조: 상/하가 다른 수업이면 분할 필요
    const cellNeedsSubSplit = (c: ResolvedCell): boolean => {
        const topNames = new Set((c.subTopClasses || []).map(cls => cls.className).filter(Boolean) as string[]);
        const botNames = new Set((c.subBotClasses || []).map(cls => cls.className).filter(Boolean) as string[]);
        if (topNames.size !== botNames.size) return true;
        for (const n of topNames) if (!botNames.has(n)) return true;
        return false;
    };

    const totalPeriodCount = Math.max(weekdayPeriodGroups.length, weekendPeriods.length);

    for (let pi = 0; pi < totalPeriodCount; pi++) {
        const weekdayCells = pi < weekdayPeriodGroups.length ? computeWeekdayCells(weekdayPeriodGroups[pi]) : [];
        const weekendCells = (hasWeekend && pi < weekendPeriods.length) ? computeWeekendCells(weekendPeriods[pi]) : [];
        const allCells = [...weekdayCells, ...weekendCells];

        // 교시 내 max 학생 수
        const maxActive = allCells.reduce((m, c) => Math.max(m, cellActiveRows(c)), 0);
        const maxHold = allCells.reduce((m, c) => Math.max(m, cellHoldRows(c)), 0);
        const maxWithdrawn = allCells.reduce((m, c) => Math.max(m, c.payload?.withdrawnStudents.length || 0), 0);
        const hasAnyHold = maxHold > 0;
        const hasAnyWithdrawn = maxWithdrawn > 0;
        // 교시 내 어느 셀이라도 sub-period 분할 필요한가 (1-1만 또는 1-2만 사용하는 셀 있음)
        const needsSubRows = allCells.some(c => c.payload && cellNeedsSubSplit(c));

        // 행 인덱스 할당
        const subTopRow = rowIdx++;
        const subBotRow = needsSubRows ? rowIdx++ : subTopRow; // 분할 안 하면 동일
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
        const countRow = rowIdx++;          // 인원 통계 행 (각 컬럼별 재원 수)
        const periodEndRow = rowIdx - 1;

        // 행 높이
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

        // 평일 교시 라벨 (좌측 첫 컬럼) — subTopRow ~ countRow 세로 병합
        if (pi < weekdayPeriodGroups.length) {
            const pg = weekdayPeriodGroups[pi];
            sheet.mergeCells(subTopRow, WEEKDAY_PERIOD_COL, countRow, WEEKDAY_PERIOD_COL);
            const pl = sheet.getCell(subTopRow, WEEKDAY_PERIOD_COL);
            pl.value = `${pg.info.label}\n${pg.info.time}`;
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
            pl.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
            pl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            pl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
        } else if (hasWeekend) {
            sheet.mergeCells(subTopRow, WEEKDAY_PERIOD_COL, countRow, WEEKDAY_PERIOD_COL);
            const pl = sheet.getCell(subTopRow, WEEKDAY_PERIOD_COL);
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            pl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
        }

        // 주말 교시 라벨
        if (hasWeekend && pi < weekendPeriods.length) {
            const period = weekendPeriods[pi];
            sheet.mergeCells(subTopRow, WEEKEND_PERIOD_COL, countRow, WEEKEND_PERIOD_COL);
            const pl = sheet.getCell(subTopRow, WEEKEND_PERIOD_COL);
            pl.value = `${period}\n${WEEKEND_PERIOD_TIMES[period] || ''}`;
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_COLORS['주말'].light } };
            pl.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
            pl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            pl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
        } else if (hasWeekend) {
            sheet.mergeCells(subTopRow, WEEKEND_PERIOD_COL, countRow, WEEKEND_PERIOD_COL);
            const pl = sheet.getCell(subTopRow, WEEKEND_PERIOD_COL);
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            pl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
        }

        // 각 셀 렌더
        allCells.forEach(cell => {
            const { startCol, endCol, payload, isGroupRightEdge, dayCols, subTopClasses, subBotClasses } = cell;
            const rightBorder = isGroupRightEdge ? MEDIUM : THICK;
            const colSpan = endCol - startCol + 1;

            const mergeAndGet = (row: number) => {
                if (colSpan > 1) sheet.mergeCells(row, startCol, row, endCol);
                return sheet.getCell(row, startCol);
            };

            if (!payload) {
                // 빈 셀: 전체 교시 영역 회색 세로/가로 병합
                sheet.mergeCells(subTopRow, startCol, periodEndRow, endCol);
                const c = sheet.getCell(subTopRow, startCol);
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                c.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };
                return;
            }

            const isMergedClass = payload.uniqueClassNames.length > 1;
            const nameBg = payload.bgColor || 'FFFFFFFF';
            const nameFg = payload.textColor || 'FF111827';

            // 1) Sub-period 수업명 행 (위/아래)
            const topNames = Array.from(new Set((subTopClasses || []).map(c => c.className).filter(Boolean) as string[]));
            const botNames = Array.from(new Set((subBotClasses || []).map(c => c.className).filter(Boolean) as string[]));
            const cellSplitsSub = needsSubRows && cellNeedsSubSplit(cell);

            if (!needsSubRows || !cellSplitsSub) {
                // 분할 안 함 → subTopRow ~ subBotRow 세로 병합 (둘 다 같은 수업 또는 교시 전체가 분할 불요)
                if (needsSubRows) {
                    sheet.mergeCells(subTopRow, startCol, subBotRow, endCol);
                } else if (colSpan > 1) {
                    sheet.mergeCells(subTopRow, startCol, subTopRow, endCol);
                }
                const nc = sheet.getCell(subTopRow, startCol);
                nc.value = payload.headerLines
                    .map((name, i) => isMergedClass ? `[${i + 1}] ${name}` : name)
                    .join('\n');
                nc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: nameBg } };
                nc.font = { bold: true, color: { argb: nameFg }, size: 10 };
                nc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                nc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
            } else {
                // Sub-period 분할: 위/아래 각각 표시
                // 위 (1-1)
                if (colSpan > 1) sheet.mergeCells(subTopRow, startCol, subTopRow, endCol);
                const ntc = sheet.getCell(subTopRow, startCol);
                if (topNames.length > 0) {
                    const topFirst = (subTopClasses || []).find(c => c.className) || payload.classes[0];
                    const topBg = topFirst?.bgColor ? hexToARGB(topFirst.bgColor, 'FFFFFFFF') : nameBg;
                    const topFg = topFirst?.textColor ? hexToARGB(topFirst.textColor, 'FF111827') : nameFg;
                    ntc.value = topNames.map((name, i) => isMergedClass ? `[${i + 1}] ${name}` : name).join('\n');
                    ntc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: topBg } };
                    ntc.font = { bold: true, color: { argb: topFg }, size: 10 };
                } else {
                    ntc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                }
                ntc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                ntc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

                // 아래 (1-2)
                if (colSpan > 1) sheet.mergeCells(subBotRow, startCol, subBotRow, endCol);
                const nbc = sheet.getCell(subBotRow, startCol);
                if (botNames.length > 0) {
                    const botFirst = (subBotClasses || []).find(c => c.className) || payload.classes[0];
                    const botBg = botFirst?.bgColor ? hexToARGB(botFirst.bgColor, 'FFFFFFFF') : nameBg;
                    const botFg = botFirst?.textColor ? hexToARGB(botFirst.textColor, 'FF111827') : nameFg;
                    nbc.value = botNames.map((name, i) => isMergedClass ? `[${i + 1}] ${name}` : name).join('\n');
                    nbc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: botBg } };
                    nbc.font = { bold: true, color: { argb: botFg }, size: 10 };
                } else {
                    nbc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                }
                nbc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                nbc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
            }

            // 2) 강의실 행
            const rc = mergeAndGet(roomRow);
            const roomText = payload.roomLines.filter(r => r).join(' / ');
            rc.value = roomText;
            rc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            rc.font = { color: { argb: 'FF374151' }, size: 9 };
            rc.alignment = { horizontal: 'center', vertical: 'middle' };
            rc.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

            // 3) 재원 헤더 ("N명 - 재원생")
            const ah = mergeAndGet(activeHeaderRow);
            if (payload.activeTotal > 0) {
                ah.value = `${payload.activeTotal}명 - 재원생`;
                ah.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
                ah.font = { bold: true, color: { argb: 'FF4F46E5' }, size: 9 };
            } else {
                ah.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            }
            ah.alignment = { horizontal: 'center', vertical: 'middle' };
            ah.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

            // 4) 재원 학생 행들: 공통(가로병합) + 부분 등원(요일 컬럼)
            const commonActive = payload.active.common;
            const partialActive = payload.active.partialByDay;
            const partialActiveMax = Math.max(0, ...Object.values(partialActive).map(arr => arr.length));

            for (let i = 0; i < effectiveMaxActive; i++) {
                const row = activeStartRow + i;
                if (i < commonActive.length) {
                    // 공통 학생: 가로 병합
                    const c = mergeAndGet(row);
                    const meta = commonActive[i];
                    const style = resolveStudentStyle(meta.student, refDateMs);
                    c.value = formatStudentRowText(meta, isMergedClass);
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.bgARGB } };
                    c.font = { bold: style.bold, color: { argb: style.fgARGB }, size: 9, name: 'Malgun Gothic' };
                    c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                    c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                } else if (i < commonActive.length + partialActiveMax) {
                    // 부분 등원: 요일 컬럼에만 표시
                    const pIdx = i - commonActive.length;
                    dayCols.forEach(({ day, col }, dci) => {
                        const dayList = partialActive[day] || [];
                        const cc = sheet.getCell(row, col);
                        if (pIdx < dayList.length) {
                            const meta = dayList[pIdx];
                            const style = resolveStudentStyle(meta.student, refDateMs);
                            cc.value = formatStudentRowText(meta, isMergedClass);
                            cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.bgARGB } };
                            cc.font = { bold: style.bold, color: { argb: style.fgARGB }, size: 9, name: 'Malgun Gothic' };
                        } else {
                            cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                        }
                        cc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                        cc.border = {
                            top: THIN,
                            bottom: THIN,
                            left: THIN,
                            right: dci === dayCols.length - 1 ? rightBorder : THIN,
                        };
                    });
                } else {
                    // 빈 행 (가로 정렬용)
                    const c = mergeAndGet(row);
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                    c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                }
            }

            // 5) 대기 섹션
            if (hasAnyHold) {
                const hh = mergeAndGet(holdHeaderRow);
                if (payload.holdTotal > 0) {
                    hh.value = `${payload.holdTotal}명 - 대기`;
                    hh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
                    hh.font = { bold: true, color: { argb: 'FFCA8A04' }, size: 9 };
                } else {
                    hh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                }
                hh.alignment = { horizontal: 'center', vertical: 'middle' };
                hh.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

                const commonHold = payload.hold.common;
                const partialHold = payload.hold.partialByDay;
                const partialHoldMax = Math.max(0, ...Object.values(partialHold).map(arr => arr.length));

                for (let i = 0; i < maxHold; i++) {
                    const row = holdStartRow + i;
                    if (i < commonHold.length) {
                        const c = mergeAndGet(row);
                        const meta = commonHold[i];
                        c.value = formatStudentRowText(meta, isMergedClass);
                        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                        c.font = { color: { argb: 'FF92400E' }, size: 9, name: 'Malgun Gothic' };
                        c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                        c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                    } else if (i < commonHold.length + partialHoldMax) {
                        const pIdx = i - commonHold.length;
                        dayCols.forEach(({ day, col }, dci) => {
                            const dayList = partialHold[day] || [];
                            const cc = sheet.getCell(row, col);
                            if (pIdx < dayList.length) {
                                const meta = dayList[pIdx];
                                cc.value = formatStudentRowText(meta, isMergedClass);
                                cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                                cc.font = { color: { argb: 'FF92400E' }, size: 9, name: 'Malgun Gothic' };
                            } else {
                                cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                            }
                            cc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                            cc.border = {
                                top: THIN,
                                bottom: THIN,
                                left: THIN,
                                right: dci === dayCols.length - 1 ? rightBorder : THIN,
                            };
                        });
                    } else {
                        const c = mergeAndGet(row);
                        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                        c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                    }
                }
            }

            // 6) 퇴원 섹션 (▼ 제거, 검정 배경)
            if (hasAnyWithdrawn) {
                const wh = mergeAndGet(withdrawnHeaderRow);
                if (payload.withdrawnStudents.length > 0) {
                    wh.value = `${payload.withdrawnStudents.length}명 - 퇴원`;
                    wh.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
                }
                wh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WITHDRAWN_BG } };
                wh.alignment = { horizontal: 'center', vertical: 'middle' };
                wh.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

                for (let i = 0; i < maxWithdrawn; i++) {
                    const row = withdrawnStartRow + i;
                    const c = mergeAndGet(row);
                    if (i < payload.withdrawnStudents.length) {
                        const meta = payload.withdrawnStudents[i];
                        c.value = formatStudentRowText(meta, isMergedClass);
                        c.font = { color: { argb: 'FFD1D5DB' }, size: 9, name: 'Malgun Gothic' };
                    }
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WITHDRAWN_BG } };
                    c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                    c.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                }
            }

            // 7) 인원 통계 행 (각 컬럼별 재원 인원수)
            dayCols.forEach(({ day, col }, dci) => {
                const dayCount = commonActive.length + (partialActive[day]?.length || 0);
                const cc = sheet.getCell(countRow, col);
                cc.value = dayCount;
                cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
                cc.font = { bold: true, color: { argb: 'FF111827' }, size: 10 };
                cc.alignment = { horizontal: 'center', vertical: 'middle' };
                cc.border = {
                    top: THICK,
                    bottom: THICK,
                    left: THIN,
                    right: dci === dayCols.length - 1 ? rightBorder : THIN,
                };
            });
        });
    }

    // ─── 완전 빈 (강사×요일) 컬럼 세로 병합 ───
    const lastBodyRow = rowIdx - 1;
    fullyEmptyWeekdayCols.forEach(col => {
        if (lastBodyRow >= bodyStartRow) {
            sheet.mergeCells(bodyStartRow, col, lastBodyRow, col);
            const c = sheet.getCell(bodyStartRow, col);
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
            c.border = { top: THIN, bottom: THICK, left: THIN, right: THICK };
        }
    });
    fullyEmptyWeekendCols.forEach(col => {
        if (lastBodyRow >= bodyStartRow) {
            sheet.mergeCells(bodyStartRow, col, lastBodyRow, col);
            const c = sheet.getCell(bodyStartRow, col);
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
            c.border = { top: THIN, bottom: THICK, left: THIN, right: THICK };
        }
    });

    // 다운로드
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const safeWeekLabel = weekLabel.replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${subjectFilter || '수학'}_시간표_${safeWeekLabel}.xlsx`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
