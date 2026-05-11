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

interface CellPayload {
    classes: TimetableClass[];
    activeStudents: UnifiedStudent[];
    holdStudents: UnifiedStudent[];
    withdrawnStudents: UnifiedStudent[];
    headerLines: string[];
    bodyLineCount: number;
    bgColor?: string;
    textColor?: string;
}

const buildCellPayload = (
    cellClasses: TimetableClass[],
    studentMap: Record<string, UnifiedStudent>,
): CellPayload | null => {
    if (cellClasses.length === 0) return null;

    const headerLines = cellClasses.map(c => `${c.className}${c.room ? ` ${c.room}` : ''}`);

    const idsByClass = cellClasses.map(c => {
        const set = new Set<string>();
        (c.studentIds || []).forEach(id => set.add(id));
        (c.studentList || []).forEach((s: any) => set.add(s.id));
        return set;
    });
    const allIds = new Set<string>();
    idsByClass.forEach(s => s.forEach(id => allIds.add(id)));

    const active: UnifiedStudent[] = [];
    const hold: UnifiedStudent[] = [];
    const withdrawn: UnifiedStudent[] = [];
    allIds.forEach(id => {
        const s = studentMap[id];
        if (!s) return;
        if (s.status === 'withdrawn') withdrawn.push(s);
        else if (s.status === 'on_hold') hold.push(s);
        else active.push(s);
    });
    const byName = (a: UnifiedStudent, b: UnifiedStudent) => (a.name || '').localeCompare(b.name || '', 'ko');
    active.sort(byName); hold.sort(byName); withdrawn.sort(byName);

    let bodyLineCount = 0;
    if (active.length > 0) bodyLineCount += 1 + active.length;
    if (hold.length > 0) bodyLineCount += 2 + hold.length;
    if (withdrawn.length > 0) bodyLineCount += 2 + withdrawn.length;
    if (bodyLineCount === 0) bodyLineCount = 1;

    const first = cellClasses[0];
    return {
        classes: cellClasses,
        activeStudents: active,
        holdStudents: hold,
        withdrawnStudents: withdrawn,
        headerLines,
        bodyLineCount,
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

// 학생본문 richText 생성 (흰색 배경에서 잘 보이는 색상 사용)
const buildBodyRichText = (payload: CellPayload): Array<{ text: string; font: any }> => {
    const baseFont = { name: 'Malgun Gothic', size: 9, color: { argb: 'FF111827' } };
    const rt: Array<{ text: string; font: any }> = [];

    if (payload.activeStudents.length > 0) {
        rt.push({
            text: `${payload.activeStudents.length}명 - 재원생\n`,
            font: { ...baseFont, bold: true, color: { argb: 'FF4F46E5' } },
        });
        payload.activeStudents.forEach((s, i) => {
            const isLast = i === payload.activeStudents.length - 1
                && payload.holdStudents.length === 0
                && payload.withdrawnStudents.length === 0;
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
            const isLast = i === payload.holdStudents.length - 1 && payload.withdrawnStudents.length === 0;
            rt.push({
                text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}${isLast ? '' : '\n'}`,
                font: { ...baseFont, color: { argb: 'FF92400E' } },
            });
        });
    }
    if (payload.withdrawnStudents.length > 0) {
        if (rt.length > 0) rt.push({ text: '\n', font: baseFont });
        rt.push({
            text: `${payload.withdrawnStudents.length}명 - 퇴원\n`,
            font: { ...baseFont, bold: true, color: { argb: 'FFDC2626' } },
        });
        payload.withdrawnStudents.forEach((s, i) => {
            const isLast = i === payload.withdrawnStudents.length - 1;
            rt.push({
                text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}${isLast ? '' : '\n'}`,
                font: { ...baseFont, color: { argb: 'FF6B7280' }, strike: true },
            });
        });
    }
    return rt;
};

export async function exportMathTimetableToExcel(params: ExportTimetableParams): Promise<void> {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ijw-Calander';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`${params.subjectFilter || '수학'} 시간표`, {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }],
    });

    const {
        weekLabel,
        filteredClasses,
        allResources,
        orderedSelectedDays,
        weekDates,
        teachers,
        currentPeriods,
        studentMap,
        subjectFilter,
    } = params;

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

    // 평일 그룹
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

    // 주말 그룹
    const weekendResources = weekendDaysList.length > 0 ? getResourcesForDays(weekendDaysList) : [];
    const totalWeekendDayCols = weekendResources.reduce((a, r) => a + r.days.length, 0);
    const hasWeekend = weekendResources.length > 0;

    // ─── 컬럼 레이아웃 ───
    // 평일 블록: col 1 = 교시(평일), col 2..(1+W) = 평일 일자들
    // 주말 블록: col (W+2) = 교시(주말), col (W+3)..(W+2+S) = 주말 일자들
    const WEEKDAY_PERIOD_COL = 1;
    const WEEKDAY_FIRST_DAY_COL = 2;
    const WEEKDAY_LAST_DAY_COL = 1 + totalWeekdayDayCols;
    const WEEKEND_PERIOD_COL = hasWeekend ? WEEKDAY_LAST_DAY_COL + 1 : 0;
    const WEEKEND_FIRST_DAY_COL = hasWeekend ? WEEKEND_PERIOD_COL + 1 : 0;
    const WEEKEND_LAST_DAY_COL = hasWeekend ? WEEKEND_PERIOD_COL + totalWeekendDayCols : 0;

    const totalCols = hasWeekend ? WEEKEND_LAST_DAY_COL : WEEKDAY_LAST_DAY_COL;

    // 그룹별 시작컬럼
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

    // 컬럼 폭
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

    // ───── Row 1: Title ─────
    let rowIdx = 1;
    const titleRow = rowIdx++;
    sheet.mergeCells(titleRow, 1, titleRow, totalCols);
    const titleCell = sheet.getCell(titleRow, 1);
    titleCell.value = `${subjectFilter || '수학'} 시간표 — ${weekLabel}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF111827' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(titleRow).height = 24;

    rowIdx++; // spacer
    sheet.getRow(rowIdx - 1).height = 6;

    // ───── Row 3: Group titles ─────
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
        const color = GROUP_COLORS['주말'];
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: MEDIUM, bottom: THIN, left: MEDIUM, right: MEDIUM };
    }

    // ───── Rows 4-5: Teacher row + Day row ─────
    const teacherRow = rowIdx++;
    const dayRow = rowIdx++;
    sheet.getRow(teacherRow).height = 22;
    sheet.getRow(dayRow).height = 28;

    // 평일 교시 헤더 (col 1)
    sheet.mergeCells(teacherRow, WEEKDAY_PERIOD_COL, dayRow, WEEKDAY_PERIOD_COL);
    const wdPeriodH = sheet.getCell(teacherRow, WEEKDAY_PERIOD_COL);
    wdPeriodH.value = '교시';
    wdPeriodH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    wdPeriodH.font = { bold: true, color: { argb: 'FF000000' } };
    wdPeriodH.alignment = { horizontal: 'center', vertical: 'middle' };
    wdPeriodH.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: THICK };

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

    // 주말 교시 헤더 + 강사 + 일자
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

    // ───── 본문: 평일 + 주말 동시 렌더 ─────
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

    // 셀 계산 헬퍼: 평일 (서브교시 합집합 + 가로 병합)
    const computeWeekdayCells = (pg: typeof weekdayPeriodGroups[0]): ResolvedCell[] => {
        const cells: ResolvedCell[] = [];
        weekdayGroups.forEach((group, gi) => {
            let col = weekdayGroupStartCols[gi];
            const groupEndCol = col + weekdayGroupColCounts[gi] - 1;
            group.resources.forEach(({ resource, days }) => {
                let di = 0;
                while (di < days.length) {
                    const day = days[di];
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

                    const payload = buildCellPayload(cellClasses, studentMap);
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

    // 셀 계산 헬퍼: 주말 (단일 교시)
    const weekendPeriods = currentPeriods.filter(p => WEEKEND_PERIOD_TIMES[p]);
    const computeWeekendCells = (period: string): ResolvedCell[] => {
        const cells: ResolvedCell[] = [];
        let col = WEEKEND_FIRST_DAY_COL;
        const groupEndCol = WEEKEND_LAST_DAY_COL;
        weekendResources.forEach(({ resource, days }) => {
            days.forEach(day => {
                const cls = getClassesForCell(filteredClasses, day, period, resource, 'teacher');
                const payload = buildCellPayload(cls, studentMap);
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

    // 셀 렌더 헬퍼
    const renderPeriodRows = (
        nameRow: number,
        bodyRow: number,
        cells: ResolvedCell[],
    ): { maxHeader: number; maxBody: number } => {
        let maxHeader = 1;
        let maxBody = 0;
        cells.forEach(cell => {
            const { startCol, endCol, payload, isGroupRightEdge } = cell;
            if (endCol > startCol) {
                sheet.mergeCells(nameRow, startCol, nameRow, endCol);
                sheet.mergeCells(bodyRow, startCol, bodyRow, endCol);
            }
            const rightBorder = isGroupRightEdge ? MEDIUM : THICK;
            const nameCell = sheet.getCell(nameRow, startCol);
            const bodyCell = sheet.getCell(bodyRow, startCol);

            if (!payload) {
                nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                bodyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                nameCell.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                bodyCell.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };
                return;
            }

            const nameBg = payload.bgColor || 'FFFFFFFF';
            const nameFg = payload.textColor || 'FF111827';
            nameCell.value = payload.headerLines.join('\n');
            nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: nameBg } };
            nameCell.font = { bold: true, color: { argb: nameFg }, size: 10 };
            nameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            nameCell.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };

            const rt = buildBodyRichText(payload);
            bodyCell.value = rt.length > 0 ? ({ richText: rt } as any) : '';
            bodyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            bodyCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
            bodyCell.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };

            maxHeader = Math.max(maxHeader, payload.headerLines.length);
            maxBody = Math.max(maxBody, payload.bodyLineCount);
        });
        return { maxHeader, maxBody };
    };

    // 평일과 주말 row 정렬: 같은 nameRow/bodyRow에 양쪽 모두 채움
    // 평일 교시 개수 vs 주말 교시 개수 중 큰 쪽이 총 교시 행 수
    const totalPeriodCount = Math.max(weekdayPeriodGroups.length, weekendPeriods.length);

    for (let pi = 0; pi < totalPeriodCount; pi++) {
        const nameRow = rowIdx++;
        const bodyRow = rowIdx++;

        // 평일 교시 라벨 + 평일 셀
        if (pi < weekdayPeriodGroups.length) {
            const pg = weekdayPeriodGroups[pi];
            sheet.mergeCells(nameRow, WEEKDAY_PERIOD_COL, bodyRow, WEEKDAY_PERIOD_COL);
            const pl = sheet.getCell(nameRow, WEEKDAY_PERIOD_COL);
            pl.value = `${pg.info.label}\n${pg.info.time}`;
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
            pl.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
            pl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            pl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
        } else if (hasWeekend) {
            // 평일 교시 없지만 주말은 있는 행: 평일 측 빈칸 처리
            sheet.mergeCells(nameRow, WEEKDAY_PERIOD_COL, bodyRow, WEEKDAY_PERIOD_COL);
            const pl = sheet.getCell(nameRow, WEEKDAY_PERIOD_COL);
            pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            pl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
        }

        const weekdayCellResult = pi < weekdayPeriodGroups.length
            ? renderPeriodRows(nameRow, bodyRow, computeWeekdayCells(weekdayPeriodGroups[pi]))
            : { maxHeader: 1, maxBody: 0 };

        // 평일 영역에 교시 없으면 빈 회색으로 채우기 (주말만 있는 경우)
        if (pi >= weekdayPeriodGroups.length) {
            for (let c = WEEKDAY_FIRST_DAY_COL; c <= WEEKDAY_LAST_DAY_COL; c++) {
                sheet.getCell(nameRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                sheet.getCell(bodyRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            }
        }

        // 주말 교시 라벨 + 주말 셀
        let weekendCellResult = { maxHeader: 1, maxBody: 0 };
        if (hasWeekend) {
            if (pi < weekendPeriods.length) {
                const period = weekendPeriods[pi];
                sheet.mergeCells(nameRow, WEEKEND_PERIOD_COL, bodyRow, WEEKEND_PERIOD_COL);
                const pl = sheet.getCell(nameRow, WEEKEND_PERIOD_COL);
                pl.value = `${period}\n${WEEKEND_PERIOD_TIMES[period] || ''}`;
                pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_COLORS['주말'].light } };
                pl.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
                pl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                pl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
                weekendCellResult = renderPeriodRows(nameRow, bodyRow, computeWeekendCells(period));
            } else {
                // 주말 교시 없는 행: 주말 측 빈칸 처리
                sheet.mergeCells(nameRow, WEEKEND_PERIOD_COL, bodyRow, WEEKEND_PERIOD_COL);
                const pl = sheet.getCell(nameRow, WEEKEND_PERIOD_COL);
                pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                pl.border = { top: THIN, bottom: THIN, left: MEDIUM, right: THICK };
                for (let c = WEEKEND_FIRST_DAY_COL; c <= WEEKEND_LAST_DAY_COL; c++) {
                    sheet.getCell(nameRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                    sheet.getCell(bodyRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                }
            }
        }

        const maxHeader = Math.max(weekdayCellResult.maxHeader, weekendCellResult.maxHeader);
        const maxBody = Math.max(weekdayCellResult.maxBody, weekendCellResult.maxBody);
        sheet.getRow(nameRow).height = Math.max(24, maxHeader * 18 + 6);
        sheet.getRow(bodyRow).height = Math.max(50, Math.min(500, maxBody * 13.5 + 8));
    }

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
