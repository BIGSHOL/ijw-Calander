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
    headerLines: string[];  // className+room per class
    bodyLineCount: number;  // for row height calc
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

    // 본문 줄 수: 헤더 카운트 + active 줄 + (hold 있으면 빈줄+헤더+학생) + (withdrawn 있으면 빈줄+헤더+학생)
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
    const weekendDays = [hasSat ? '토' : null, hasSun ? '일' : null].filter(Boolean) as string[];

    // 리소스 → 요일 lookup (slotTeachers 포함)
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

    // 그룹 정의 (가로 side-by-side)
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

    // 그룹별 day-col 개수
    const groupColCounts = weekdayGroups.map(g => g.resources.reduce((acc, r) => acc + r.days.length, 0));
    const totalDayCols = groupColCounts.reduce((a, b) => a + b, 0);
    const totalCols = 1 + totalDayCols;  // +1 for period column

    // 그룹별 col 시작 (1-indexed, col 1은 period)
    const groupStartCols: number[] = [];
    let acc = 2;
    for (let i = 0; i < weekdayGroups.length; i++) {
        groupStartCols.push(acc);
        acc += groupColCounts[i];
    }

    const PERIOD_COL_W = 13;
    const DAY_COL_W = 24;

    // 컬럼 폭 설정
    sheet.getColumn(1).width = PERIOD_COL_W;
    for (let c = 2; c <= totalCols; c++) {
        sheet.getColumn(c).width = DAY_COL_W;
    }

    // ========================================
    // Row 1: Title
    // ========================================
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

    // ========================================
    // Row 3: Group titles (side-by-side)
    // ========================================
    const groupTitleRow = rowIdx++;
    sheet.getRow(groupTitleRow).height = 22;
    weekdayGroups.forEach((group, gi) => {
        const startCol = groupStartCols[gi];
        const endCol = startCol + groupColCounts[gi] - 1;
        if (endCol > startCol) sheet.mergeCells(groupTitleRow, startCol, groupTitleRow, endCol);
        const cell = sheet.getCell(groupTitleRow, startCol);
        cell.value = group.title;
        const color = GROUP_COLORS[group.title] || { bg: 'FF6B7280', light: 'FFF3F4F6' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: MEDIUM, bottom: THIN, left: MEDIUM, right: MEDIUM };
    });

    // ========================================
    // Rows 4-5: Teacher row (4) + Day row (5)
    // ========================================
    const teacherRow = rowIdx++;
    const dayRow = rowIdx++;
    sheet.getRow(teacherRow).height = 22;
    sheet.getRow(dayRow).height = 28;

    // 교시 헤더 (col 1, teacherRow+dayRow 병합)
    sheet.mergeCells(teacherRow, 1, dayRow, 1);
    const periodHeader = sheet.getCell(teacherRow, 1);
    periodHeader.value = '교시';
    periodHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    periodHeader.font = { bold: true, color: { argb: 'FF000000' } };
    periodHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    periodHeader.border = { top: MEDIUM, bottom: THICK, left: MEDIUM, right: THICK };

    weekdayGroups.forEach((group, gi) => {
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
                const dayBg = day === '수' ? 'FFF0FDF4' : 'FFF3F4F6';
                dCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dayBg } };
                dCell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
                dCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                const isLastInGroup = di === days.length - 1;
                dCell.border = {
                    top: THIN,
                    bottom: THICK,
                    left: di === 0 && col === groupStartCols[gi] ? MEDIUM : THIN,
                    right: isLastInGroup && col + days.length - 1 === groupStartCols[gi] + groupColCounts[gi] - 1
                        ? MEDIUM : isLastInGroup ? THICK : THIN,
                };
            });
            col = ec + 1;
        });
    });

    // ========================================
    // Period body rows (각 교시당 2 rows: 반명 + 학생본문)
    // ========================================
    const periodGroups = MATH_GROUPED_PERIODS
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
            hasFirst: boolean; hasSecond: boolean;
            info: { label: string; time: string };
        }>;

    // 각 교시별로 셀 페이로드 미리 계산 (행 높이 산정용)
    interface ResolvedCell {
        startCol: number;
        endCol: number;
        payload: CellPayload | null;
        groupIdx: number;
        resourceIdx: number;
        startDayIdx: number;
    }

    const periodCellsByIdx: ResolvedCell[][] = periodGroups.map(pg => {
        const cells: ResolvedCell[] = [];
        weekdayGroups.forEach((group, gi) => {
            let col = groupStartCols[gi];
            group.resources.forEach(({ resource, days }, ri) => {
                let di = 0;
                while (di < days.length) {
                    const day = days[di];
                    const firstCls = pg.hasFirst ? getClassesForCell(filteredClasses, day, pg.firstPeriod, resource, 'teacher') : [];
                    const secondCls = pg.hasSecond ? getClassesForCell(filteredClasses, day, pg.secondPeriod, resource, 'teacher') : [];

                    // 두 서브교시 합집합 (다른 반이어도 모두 포함)
                    const mergedSet = new Map<string, TimetableClass>();
                    firstCls.forEach(c => mergedSet.set(c.className, c));
                    secondCls.forEach(c => { if (!mergedSet.has(c.className)) mergedSet.set(c.className, c); });
                    const cellClasses = Array.from(mergedSet.values());

                    // 가로 병합 span 계산
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
                    cells.push({
                        startCol: col,
                        endCol: col + colSpan - 1,
                        payload,
                        groupIdx: gi,
                        resourceIdx: ri,
                        startDayIdx: di,
                    });
                    col += colSpan;
                    di += colSpan;
                }
            });
        });
        return cells;
    });

    periodGroups.forEach((pg, pgi) => {
        const cells = periodCellsByIdx[pgi];

        // 교시당 2 rows: 반명 행 + 학생 행
        const nameRow = rowIdx++;
        const bodyRow = rowIdx++;

        // 행 높이: 반명행 = 클래스개수 최대치 * 18 + 6, 학생행 = 최대 본문 줄수 * 13.5 + 8
        const maxHeaderLines = cells.reduce((m, c) => Math.max(m, c.payload?.headerLines.length || 1), 1);
        const maxBodyLines = cells.reduce((m, c) => Math.max(m, c.payload?.bodyLineCount || 0), 0);
        sheet.getRow(nameRow).height = Math.max(24, maxHeaderLines * 18 + 6);
        sheet.getRow(bodyRow).height = Math.max(50, Math.min(500, maxBodyLines * 13.5 + 8));

        // Period label col 1 (nameRow + bodyRow 병합)
        sheet.mergeCells(nameRow, 1, bodyRow, 1);
        const pLabel = sheet.getCell(nameRow, 1);
        pLabel.value = `${pg.info.label}\n${pg.info.time}`;
        pLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        pLabel.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
        pLabel.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        pLabel.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };

        // Cells
        cells.forEach(cell => {
            const { startCol, endCol, payload } = cell;
            // colspan 병합 (nameRow, bodyRow 둘 다)
            if (endCol > startCol) {
                sheet.mergeCells(nameRow, startCol, nameRow, endCol);
                sheet.mergeCells(bodyRow, startCol, bodyRow, endCol);
            }

            // 그룹 경계용 우측 굵은선
            const isGroupRightEdge = endCol === groupStartCols[cell.groupIdx] + groupColCounts[cell.groupIdx] - 1;
            const rightBorder = isGroupRightEdge ? MEDIUM : THICK;

            const nameCell = sheet.getCell(nameRow, startCol);
            const bodyCell = sheet.getCell(bodyRow, startCol);

            if (!payload) {
                // 빈 셀: 두 행 모두 회색
                nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                bodyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                nameCell.border = { top: THIN, bottom: THIN, left: THIN, right: rightBorder };
                bodyCell.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };
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

            // 학생 행 (richText: 헤더는 굵게/배경, 퇴원은 어두운 색)
            const richText: Array<{ text: string; font: any }> = [];
            const baseFont = { name: 'Malgun Gothic', size: 9, color: { argb: 'FF111827' } };

            if (payload.activeStudents.length > 0) {
                richText.push({
                    text: `${payload.activeStudents.length}명 - 재원생\n`,
                    font: { ...baseFont, bold: true, color: { argb: 'FF6366F1' } },
                });
                payload.activeStudents.forEach((s, i) => {
                    const isLast = i === payload.activeStudents.length - 1
                        && payload.holdStudents.length === 0
                        && payload.withdrawnStudents.length === 0;
                    richText.push({
                        text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}${isLast ? '' : '\n'}`,
                        font: baseFont,
                    });
                });
            }
            if (payload.holdStudents.length > 0) {
                richText.push({ text: '\n', font: baseFont });
                richText.push({
                    text: `${payload.holdStudents.length}명 - 대기\n`,
                    font: { ...baseFont, bold: true, color: { argb: 'FFCA8A04' } },
                });
                payload.holdStudents.forEach((s, i) => {
                    const isLast = i === payload.holdStudents.length - 1 && payload.withdrawnStudents.length === 0;
                    richText.push({
                        text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}${isLast ? '' : '\n'}`,
                        font: baseFont,
                    });
                });
            }
            if (payload.withdrawnStudents.length > 0) {
                richText.push({ text: '\n', font: baseFont });
                richText.push({
                    text: `${payload.withdrawnStudents.length}명 - 퇴원\n`,
                    font: { ...baseFont, bold: true, color: { argb: 'FFFFFFFF' } },
                });
                payload.withdrawnStudents.forEach((s, i) => {
                    const isLast = i === payload.withdrawnStudents.length - 1;
                    richText.push({
                        text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}${isLast ? '' : '\n'}`,
                        font: { ...baseFont, color: { argb: 'FFE5E7EB' } },
                    });
                });
            }

            if (richText.length === 0) {
                bodyCell.value = '';
            } else {
                bodyCell.value = { richText } as any;
            }
            // 본문 셀 배경: 기본 흰색 (퇴원만 어둡게 하려면 셀 분리 필요 — Excel 한 셀 한 배경)
            bodyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            bodyCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
            bodyCell.border = { top: THIN, bottom: THICK, left: THIN, right: rightBorder };
        });
    });

    // ========================================
    // 주말 섹션 (있을 경우 평일 블록 아래)
    // ========================================
    if (weekendDays.length > 0) {
        const weekendResources = getResourcesForDays(weekendDays);
        if (weekendResources.length > 0) {
            rowIdx++; // spacer
            sheet.getRow(rowIdx - 1).height = 8;

            const weCols = weekendResources.reduce((a, r) => a + r.days.length, 0);
            const weColor = GROUP_COLORS['주말'];

            const wgtRow = rowIdx++;
            sheet.mergeCells(wgtRow, 1, wgtRow, 1 + weCols);
            const wgt = sheet.getCell(wgtRow, 1);
            wgt.value = '주말';
            wgt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: weColor.bg } };
            wgt.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            wgt.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            wgt.border = { top: MEDIUM, bottom: THIN, left: MEDIUM, right: MEDIUM };
            sheet.getRow(wgtRow).height = 22;

            const wtRow = rowIdx++;
            const wdRow = rowIdx++;
            sheet.mergeCells(wtRow, 1, wdRow, 1);
            const wph = sheet.getCell(wtRow, 1);
            wph.value = '교시';
            wph.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: weColor.light } };
            wph.font = { bold: true };
            wph.alignment = { horizontal: 'center', vertical: 'middle' };
            wph.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };
            sheet.getRow(wtRow).height = 22;
            sheet.getRow(wdRow).height = 28;

            let wcol = 2;
            weekendResources.forEach(({ resource, days }) => {
                const td = teachers.find(t => t.name === resource);
                const bg = hexToARGB(td?.bgColor, 'FF3B82F6');
                const fg = hexToARGB(td?.textColor, 'FFFFFFFF');
                const sc = wcol;
                const ec = wcol + days.length - 1;
                if (days.length > 1) sheet.mergeCells(wtRow, sc, wtRow, ec);
                const tc = sheet.getCell(wtRow, sc);
                tc.value = resource;
                tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                tc.font = { bold: true, color: { argb: fg } };
                tc.alignment = { horizontal: 'center', vertical: 'middle' };
                tc.border = { top: THIN, bottom: THIN, left: THIN, right: THICK };
                days.forEach((day, di) => {
                    const dc = sheet.getCell(wdRow, wcol + di);
                    const dinfo = weekDates[day];
                    dc.value = dinfo ? `${day}\n${dinfo.formatted}` : day;
                    dc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
                    dc.font = { bold: true };
                    dc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    dc.border = { top: THIN, bottom: THICK, left: THIN, right: THICK };
                });
                wcol = ec + 1;
            });

            const weekendPeriods = currentPeriods.filter(p => WEEKEND_PERIOD_TIMES[p]);
            weekendPeriods.forEach(period => {
                const nameRow = rowIdx++;
                const bodyRow = rowIdx++;
                sheet.mergeCells(nameRow, 1, bodyRow, 1);
                const pl = sheet.getCell(nameRow, 1);
                pl.value = `${period}\n${WEEKEND_PERIOD_TIMES[period] || ''}`;
                pl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: weColor.light } };
                pl.font = { bold: true, size: 10 };
                pl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                pl.border = { top: THIN, bottom: THICK, left: MEDIUM, right: THICK };

                let col = 2;
                let maxHeader = 1;
                let maxBody = 0;
                weekendResources.forEach(({ resource, days }) => {
                    days.forEach(day => {
                        const cls = getClassesForCell(filteredClasses, day, period, resource, 'teacher');
                        const payload = buildCellPayload(cls, studentMap);
                        const nameCell = sheet.getCell(nameRow, col);
                        const bodyCell = sheet.getCell(bodyRow, col);
                        if (!payload) {
                            nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                            bodyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_BG } };
                        } else {
                            nameCell.value = payload.headerLines.join('\n');
                            nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: payload.bgColor || 'FFFFFFFF' } };
                            nameCell.font = { bold: true, color: { argb: payload.textColor || 'FF111827' }, size: 10 };
                            nameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                            maxHeader = Math.max(maxHeader, payload.headerLines.length);

                            const rt: any[] = [];
                            const bf = { name: 'Malgun Gothic', size: 9, color: { argb: 'FF111827' } };
                            if (payload.activeStudents.length > 0) {
                                rt.push({ text: `${payload.activeStudents.length}명 - 재원생\n`, font: { ...bf, bold: true, color: { argb: 'FF6366F1' } } });
                                payload.activeStudents.forEach(s => rt.push({ text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}\n`, font: bf }));
                            }
                            if (payload.holdStudents.length > 0) {
                                rt.push({ text: '\n', font: bf });
                                rt.push({ text: `${payload.holdStudents.length}명 - 대기\n`, font: { ...bf, bold: true, color: { argb: 'FFCA8A04' } } });
                                payload.holdStudents.forEach(s => rt.push({ text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}\n`, font: bf }));
                            }
                            if (payload.withdrawnStudents.length > 0) {
                                rt.push({ text: '\n', font: bf });
                                rt.push({ text: `${payload.withdrawnStudents.length}명 - 퇴원\n`, font: { ...bf, bold: true, color: { argb: 'FF6B7280' } } });
                                payload.withdrawnStudents.forEach(s => rt.push({ text: `${s.name}/${formatSchoolGrade(s.school, s.grade)}\n`, font: { ...bf, color: { argb: 'FF6B7280' } } }));
                            }
                            bodyCell.value = rt.length > 0 ? ({ richText: rt } as any) : '';
                            bodyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                            bodyCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
                            maxBody = Math.max(maxBody, payload.bodyLineCount);
                        }
                        nameCell.border = { top: THIN, bottom: THIN, left: THIN, right: THICK };
                        bodyCell.border = { top: THIN, bottom: THICK, left: THIN, right: THICK };
                        col++;
                    });
                });
                sheet.getRow(nameRow).height = Math.max(24, maxHeader * 18 + 6);
                sheet.getRow(bodyRow).height = Math.max(50, Math.min(500, maxBody * 13.5 + 8));
            });
        }
    }

    // ========================================
    // 다운로드
    // ========================================
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