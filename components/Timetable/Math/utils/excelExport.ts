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

interface CellPayload {
    classes: TimetableClass[];
    activeStudents: any[];
    holdStudents: any[];
    withdrawnStudents: any[];
    headerLines: string[];
    activeBodyLineCount: number;     // 재원 + 대기 줄수
    withdrawnLineCount: number;      // 퇴원 줄수 (헤더 포함)
    bgColor?: string;
    textColor?: string;
}

const buildCellPayload = (
    cellClasses: TimetableClass[],
    referenceDateStr: string,
): CellPayload | null => {
    if (cellClasses.length === 0) return null;

    const headerLines = cellClasses.map(c => `${c.className}${c.room ? ` ${c.room}` : ''}`);

    // 모든 학생 수집 (cls.studentList 사용 - enrollment-level 정보 포함)
    const allStudents = new Map<string, any>();
    cellClasses.forEach(c => {
        (c.studentList || []).forEach((s: any) => {
            if (s.id && !allStudents.has(s.id)) allStudents.set(s.id, s);
        });
    });

    const today = referenceDateStr;
    const refDateMs = new Date(today).getTime();

    const active: any[] = [];
    const hold: any[] = [];
    const withdrawn: any[] = [];

    allStudents.forEach(s => {
        const isFutureWithdrawal = s.withdrawalDate && s.withdrawalDate > today;
        const hasActiveWithdrawal = s.withdrawalDate && s.withdrawalDate <= today && !s.isTransferred;

        if (hasActiveWithdrawal) {
            const daysSince = Math.floor((refDateMs - new Date(s.withdrawalDate).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince <= 30) withdrawn.push(s);
        } else if (s.onHold && !s.withdrawalDate) {
            hold.push(s);
        } else if (!s.withdrawalDate || isFutureWithdrawal) {
            // 미래 퇴원도 재원 섹션에 표시
            active.push(s);
        }
    });

    const byName = (a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ko');
    active.sort(byName); hold.sort(byName); withdrawn.sort(byName);

    let activeBodyLineCount = 0;
    if (active.length > 0) activeBodyLineCount += 1 + active.length;
    if (hold.length > 0) activeBodyLineCount += (active.length > 0 ? 1 : 0) + 1 + hold.length;
    if (activeBodyLineCount === 0 && withdrawn.length === 0) activeBodyLineCount = 1;

    const withdrawnLineCount = withdrawn.length > 0 ? 1 + withdrawn.length : 0;

    const first = cellClasses[0];
    return {
        classes: cellClasses,
        activeStudents: active,
        holdStudents: hold,
        withdrawnStudents: withdrawn,
        headerLines,
        activeBodyLineCount,
        withdrawnLineCount,
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
}

// 재원 + 대기 richText
const buildActiveBodyRichText = (payload: CellPayload): Array<{ text: string; font: any }> => {
    const baseFont = { name: 'Malgun Gothic', size: 9, color: { argb: 'FF111827' } };
    const rt: Array<{ text: string; font: any }> = [];

    if (payload.activeStudents.length > 0) {
        rt.push({
            text: `${payload.activeStudents.length}명 - 재원생\n`,
            font: { ...baseFont, bold: true, color: { argb: 'FF4F46E5' } },
        });
        payload.activeStudents.forEach((s, i) => {
            const isLast = i === payload.activeStudents.length - 1 && payload.holdStudents.length === 0;
            rt.push({
                text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}${isLast ? '' : '\n'}`,
                font: baseFont,
            });
        });
    }
    if (payload.holdStudents.length > 0) {
        if (rt.length > 0) rt.push({ text: '\n', font: baseFont });
        rt.push({
            text: `${payload.holdStudents.length}명 - 대기\n`,
            font: { ...baseFont, bold: true, color: { argb: 'FFCA8A04' } },
        });
        payload.holdStudents.forEach((s, i) => {
            const isLast = i === payload.holdStudents.length - 1;
            rt.push({
                text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}${isLast ? '' : '\n'}`,
                font: { ...baseFont, color: { argb: 'FF92400E' } },
            });
        });
    }
    return rt;
};

// 퇴원 richText (검정 배경에 흰 글씨)
const buildWithdrawnRichText = (payload: CellPayload): Array<{ text: string; font: any }> => {
    const whiteBase = { name: 'Malgun Gothic', size: 9, color: { argb: 'FFFFFFFF' } };
    const rt: Array<{ text: string; font: any }> = [];

    if (payload.withdrawnStudents.length === 0) return rt;

    rt.push({
        text: `▼ ${payload.withdrawnStudents.length}명 - 퇴원\n`,
        font: { ...whiteBase, bold: true },
    });
    payload.withdrawnStudents.forEach((s, i) => {
        const isLast = i === payload.withdrawnStudents.length - 1;
        rt.push({
            text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}${isLast ? '' : '\n'}`,
            font: { ...whiteBase, color: { argb: 'FFD1D5DB' } },
        });
    });
    return rt;
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
        views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }],
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

    // ─── Row 1: Group titles ───
    let rowIdx = 1;
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

                    const payload = buildCellPayload(cellClasses, refStr);
                    const startCol = col;
                    const endCol = col + colSpan - 1;
                    cells.push({
                        startCol,
                        endCol,
                        payload,
                        isGroupRightEdge: endCol === groupEndCol,
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
                const payload = buildCellPayload(cls, refStr);
                cells.push({
                    startCol: col,
                    endCol: col,
                    payload,
                    isGroupRightEdge: col === groupEndCol,
                });
                col++;
            });
        });
        return cells;
    };

    // 본문 시작 row (모든 교시의 nameRow/bodyRow/withdrawnRow를 여기서부터 차곡차곡)
    const bodyStartRow = rowIdx;

    // 본문 렌더: 각 교시당 2~3 rows (nameRow, bodyRow, optional withdrawnRow)
    const totalPeriodCount = Math.max(weekdayPeriodGroups.length, weekendPeriods.length);

    for (let pi = 0; pi < totalPeriodCount; pi++) {
        const weekdayCells = pi < weekdayPeriodGroups.length ? computeWeekdayCells(weekdayPeriodGroups[pi]) : [];
        const weekendCells = (hasWeekend && pi < weekendPeriods.length) ? computeWeekendCells(weekendPeriods[pi]) : [];
        const allCells = [...weekdayCells, ...weekendCells];

        const hasAnyWithdrawn = allCells.some(c => (c.payload?.withdrawnLineCount || 0) > 0);
        const maxHeaderLines = allCells.reduce((m, c) => Math.max(m, c.payload?.headerLines.length || 1), 1);
        const maxActiveBodyLines = allCells.reduce((m, c) => Math.max(m, c.payload?.activeBodyLineCount || 0), 0);
        const maxWithdrawnLines = allCells.reduce((m, c) => Math.max(m, c.payload?.withdrawnLineCount || 0), 0);

        const nameRow = rowIdx++;
        const bodyRow = rowIdx++;
        const withdrawnRow = hasAnyWithdrawn ? rowIdx++ : 0;

        // 행 높이
        sheet.getRow(nameRow).height = Math.max(24, maxHeaderLines * 18 + 6);
        sheet.getRow(bodyRow).height = Math.max(40, Math.min(400, maxActiveBodyLines * 13.5 + 8));
        if (hasAnyWithdrawn) {
            sheet.getRow(withdrawnRow).height = Math.max(24, maxWithdrawnLines * 13.5 + 6);
        }

        // 평일 교시 라벨
        if (pi < weekdayPeriodGroups.length) {
            const pg = weekdayPeriodGroups[pi];
            const endRow = hasAnyWithdrawn ? withdrawnRow : bodyRow;
            sheet.mergeCells(nameRow, WEEKDAY_PERIOD_COL, endRow, WEEKDAY_PERIOD_COL);
            const pl = sheet.getCell(nameRow, WEEKDAY_PERIOD_COL);
            pl.value = `${pg.info.label}\n${pg.info.time}`;
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
            pl.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
            pl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            pl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
        } else if (hasWeekend) {
            const endRow = hasAnyWithdrawn ? withdrawnRow : bodyRow;
            sheet.mergeCells(nameRow, WEEKDAY_PERIOD_COL, endRow, WEEKDAY_PERIOD_COL);
            const pl = sheet.getCell(nameRow, WEEKDAY_PERIOD_COL);
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            pl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
        }

        // 주말 교시 라벨
        if (hasWeekend && pi < weekendPeriods.length) {
            const period = weekendPeriods[pi];
            const endRow = hasAnyWithdrawn ? withdrawnRow : bodyRow;
            sheet.mergeCells(nameRow, WEEKEND_PERIOD_COL, endRow, WEEKEND_PERIOD_COL);
            const pl = sheet.getCell(nameRow, WEEKEND_PERIOD_COL);
            pl.value = `${period}\n${WEEKEND_PERIOD_TIMES[period] || ''}`;
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_COLORS['주말'].light } };
            pl.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
            pl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            pl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
        } else if (hasWeekend) {
            const endRow = hasAnyWithdrawn ? withdrawnRow : bodyRow;
            sheet.mergeCells(nameRow, WEEKEND_PERIOD_COL, endRow, WEEKEND_PERIOD_COL);
            const pl = sheet.getCell(nameRow, WEEKEND_PERIOD_COL);
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            pl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
        }

        // 셀 렌더
        allCells.forEach(cell => {
            const { startCol, endCol, payload, isGroupRightEdge } = cell;
            const rightBorder = isGroupRightEdge ? MEDIUM : THICK;
            const colSpan = endCol - startCol + 1;

            // 가로 병합 (nameRow, bodyRow, withdrawnRow 모두)
            if (colSpan > 1) {
                sheet.mergeCells(nameRow, startCol, nameRow, endCol);
                sheet.mergeCells(bodyRow, startCol, bodyRow, endCol);
                if (hasAnyWithdrawn) sheet.mergeCells(withdrawnRow, startCol, withdrawnRow, endCol);
            }

            const nameCell = sheet.getCell(nameRow, startCol);
            const bodyCell = sheet.getCell(bodyRow, startCol);

            if (!payload) {
                // 빈 셀: 두/세 행 모두 회색 (세로 병합)
                const endRow = hasAnyWithdrawn ? withdrawnRow : bodyRow;
                sheet.mergeCells(nameRow, startCol, endRow, endCol);
                const c = sheet.getCell(nameRow, startCol);
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                c.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };
                return;
            }

            // 반명 행
            const nameBg = payload.bgColor || 'FFFFFFFF';
            const nameFg = payload.textColor || 'FF111827';
            nameCell.value = payload.headerLines.join('\n');
            nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: nameBg } };
            nameCell.font = { bold: true, color: { argb: nameFg }, size: 10 };
            nameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            nameCell.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

            // 재원+대기 본문
            const activeRT = buildActiveBodyRichText(payload);
            bodyCell.value = activeRT.length > 0 ? ({ richText: activeRT } as any) : '';
            bodyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            bodyCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
            bodyCell.border = { top: THIN, bottom: hasAnyWithdrawn ? THIN : THICK, left: THIN, right: rightBorder };

            // 퇴원 행 (있을 때만)
            if (hasAnyWithdrawn) {
                if (payload.withdrawnLineCount > 0) {
                    // 이 셀에 퇴원자 있음: 검정 배경
                    const wRT = buildWithdrawnRichText(payload);
                    const wCell = sheet.getCell(withdrawnRow, startCol);
                    wCell.value = wRT.length > 0 ? ({ richText: wRT } as any) : '';
                    wCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WITHDRAWN_BG } };
                    wCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
                    wCell.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };
                } else {
                    // 퇴원자 없는 셀: body를 withdrawnRow까지 세로 병합 (body 영역 확장)
                    sheet.mergeCells(bodyRow, startCol, withdrawnRow, endCol);
                    bodyCell.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };
                }
            }
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
