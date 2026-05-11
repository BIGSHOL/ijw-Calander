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

const THIN_BORDER = { style: 'thin' as const, color: { argb: 'FF000000' } };
const MEDIUM_BORDER = { style: 'medium' as const, color: { argb: 'FF000000' } };
const THICK_BORDER = { style: 'thick' as const, color: { argb: 'FF000000' } };

interface CellContent {
    text: string;
    bgColor?: string;   // ARGB
    textColor?: string; // ARGB
    isClassCell?: boolean;
    studentLines?: string[];
}

const buildCellContent = (
    cellClasses: TimetableClass[],
    studentMap: Record<string, UnifiedStudent>,
    showHoldStudents: boolean,
    showWithdrawnStudents: boolean,
): CellContent | null => {
    if (cellClasses.length === 0) return null;

    const lines: string[] = [];
    const header = cellClasses
        .map(c => `${c.className}${c.room ? ` ${c.room}` : ''}`)
        .join(' / ');
    lines.push(header);

    const allIds = new Set<string>();
    cellClasses.forEach(c => {
        (c.studentIds || []).forEach(id => allIds.add(id));
        (c.studentList || []).forEach((s: any) => allIds.add(s.id));
    });

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

    if (active.length > 0) {
        lines.push(`${active.length}명 - 재원생`);
        active.forEach(s => {
            lines.push(`${s.name}/${formatSchoolGrade(s.school, s.grade)}`);
        });
    }
    if (showHoldStudents && hold.length > 0) {
        lines.push('');
        lines.push(`${hold.length}명 - 대기`);
        hold.forEach(s => {
            lines.push(`${s.name}/${formatSchoolGrade(s.school, s.grade)}`);
        });
    }
    if (showWithdrawnStudents && withdrawn.length > 0) {
        lines.push('');
        lines.push(`${withdrawn.length}명 - 퇴원`);
        withdrawn.forEach(s => {
            lines.push(`${s.name}/${formatSchoolGrade(s.school, s.grade)}`);
        });
    }

    const cls = cellClasses[0];
    return {
        text: lines.join('\n'),
        bgColor: cls.bgColor ? hexToARGB(cls.bgColor, 'FFFFFFFF') : undefined,
        textColor: cls.textColor ? hexToARGB(cls.textColor, 'FF111827') : undefined,
        isClassCell: true,
        studentLines: lines,
    };
};

export async function exportMathTimetableToExcel(params: ExportTimetableParams): Promise<void> {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ijw-Calander';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`${params.subjectFilter || '수학'} 시간표`, {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 0 }],
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
        showHoldStudents = true,
        showWithdrawnStudents = false,
    } = params;

    // 그룹 분류
    const monThuDays = orderedSelectedDays.filter(d => d === '월' || d === '목');
    const tueFriDays = orderedSelectedDays.filter(d => d === '화' || d === '금');
    const hasWednesday = orderedSelectedDays.includes('수');
    const hasSaturday = orderedSelectedDays.includes('토');
    const hasSunday = orderedSelectedDays.includes('일');
    const weekendDays = [hasSaturday ? '토' : null, hasSunday ? '일' : null].filter(Boolean) as string[];

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

    const getResourcesForDays = (days: string[]): Array<{ resource: string; days: string[] }> => {
        const result: Array<{ resource: string; days: string[] }> = [];
        allResources.forEach(resource => {
            const has = days.filter(d => resourceDayLookup.get(resource?.trim())?.has(d));
            if (has.length > 0) result.push({ resource, days: has });
        });
        return result;
    };

    // 컬럼 폭 (고정)
    const PERIOD_COL_WIDTH = 14;
    const DAY_COL_WIDTH = 22;

    let currentRow = 1;

    // 시트 제목
    const titleCell = sheet.getCell(currentRow, 1);
    titleCell.value = `${params.subjectFilter || '수학'} 시간표 — ${weekLabel}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF111827' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(currentRow).height = 22;
    currentRow += 2;

    // 그룹 테이블 렌더링 함수
    const renderGroupTable = (
        groupTitle: string,
        days: string[],
        forceWednesday?: boolean,
    ): boolean => {
        const resources = forceWednesday
            ? allResources
                .filter(r => resourceDayLookup.get(r?.trim())?.has('수'))
                .map(r => ({ resource: r, days: ['수'] }))
            : getResourcesForDays(days);

        if (resources.length === 0) return false;

        const colors = GROUP_COLORS[groupTitle] || { bg: 'FF6B7280', light: 'FFF3F4F6' };

        // 컬럼 레이아웃: [period] [day1_t1, day2_t1, ..., day1_t2, ...]
        // 컬럼 인덱스: 1 = period, 2~N = 요일 셀
        const totalDayCols = resources.reduce((acc, r) => acc + r.days.length, 0);
        const totalCols = 1 + totalDayCols;

        // 컬럼 폭 설정
        sheet.getColumn(1).width = PERIOD_COL_WIDTH;
        let colIdx = 2;
        resources.forEach(r => {
            r.days.forEach(() => {
                const col = sheet.getColumn(colIdx);
                if (!col.width || col.width < DAY_COL_WIDTH) col.width = DAY_COL_WIDTH;
                colIdx++;
            });
        });

        // ── Row: Group Title ──
        const groupTitleRow = currentRow;
        sheet.mergeCells(groupTitleRow, 1, groupTitleRow, 1);
        sheet.mergeCells(groupTitleRow, 2, groupTitleRow, totalCols);
        const gtLeft = sheet.getCell(groupTitleRow, 1);
        gtLeft.value = groupTitle;
        gtLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        gtLeft.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        gtLeft.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        gtLeft.border = { top: MEDIUM_BORDER, left: MEDIUM_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
        const gtRight = sheet.getCell(groupTitleRow, 2);
        gtRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        gtRight.alignment = { horizontal: 'center', vertical: 'middle' };
        gtRight.border = { top: MEDIUM_BORDER, right: MEDIUM_BORDER, bottom: THIN_BORDER };
        sheet.getRow(groupTitleRow).height = 22;
        currentRow++;

        // ── Row: Teacher header ──
        const teacherRow = currentRow;
        // 교시 셀 (2행 병합: teacherRow + dayRow)
        sheet.mergeCells(teacherRow, 1, teacherRow + 1, 1);
        const periodHeaderCell = sheet.getCell(teacherRow, 1);
        periodHeaderCell.value = '교시';
        periodHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
        periodHeaderCell.font = { bold: true, color: { argb: 'FF000000' } };
        periodHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
        periodHeaderCell.border = { top: THIN_BORDER, left: MEDIUM_BORDER, right: THICK_BORDER, bottom: THICK_BORDER };

        let teacherColIdx = 2;
        resources.forEach(({ resource, days: rDays }) => {
            const teacherData = teachers.find(t => t.name === resource);
            const bg = hexToARGB(teacherData?.bgColor, 'FF3B82F6');
            const fg = hexToARGB(teacherData?.textColor, 'FFFFFFFF');
            const startCol = teacherColIdx;
            const endCol = teacherColIdx + rDays.length - 1;
            if (rDays.length > 1) {
                sheet.mergeCells(teacherRow, startCol, teacherRow, endCol);
            }
            const cell = sheet.getCell(teacherRow, startCol);
            cell.value = resource;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.font = { bold: true, color: { argb: fg }, size: 11 };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: THIN_BORDER, right: THICK_BORDER, bottom: THICK_BORDER, left: teacherColIdx === 2 ? THIN_BORDER : undefined };
            teacherColIdx = endCol + 1;
        });
        sheet.getRow(teacherRow).height = 22;
        currentRow++;

        // ── Row: Day header ──
        const dayRow = currentRow;
        let dayColIdx = 2;
        resources.forEach(({ resource, days: rDays }) => {
            rDays.forEach(day => {
                const dateInfo = weekDates[day];
                const cell = sheet.getCell(dayRow, dayColIdx);
                cell.value = dateInfo ? `${day}\n${dateInfo.formatted}` : day;
                const isWeekend = day === '토' || day === '일';
                const bg = isWeekend ? 'FFFFF7ED' : day === '수' ? 'FFF0FDF4' : 'FFF3F4F6';
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = { top: THIN_BORDER, right: THICK_BORDER, bottom: THICK_BORDER, left: dayColIdx === 2 ? THIN_BORDER : undefined };
                dayColIdx++;
            });
        });
        sheet.getRow(dayRow).height = 26;
        currentRow++;

        // ── Body rows: 교시별 ──
        const periodGroups: Array<{
            groupId: string;
            firstPeriod: string;
            secondPeriod: string;
            hasFirst: boolean;
            hasSecond: boolean;
        }> = [];

        MATH_GROUPED_PERIODS.forEach(groupId => {
            const periodIds = MATH_GROUP_PERIOD_IDS[groupId];
            const [firstPeriod, secondPeriod] = periodIds;
            const hasFirst = currentPeriods.includes(firstPeriod);
            const hasSecond = currentPeriods.includes(secondPeriod);
            if (!hasFirst && !hasSecond) return;
            periodGroups.push({ groupId, firstPeriod, secondPeriod, hasFirst, hasSecond });
        });

        periodGroups.forEach(({ groupId, firstPeriod, secondPeriod, hasFirst, hasSecond }) => {
            const groupInfo = MATH_GROUP_DISPLAY[groupId];
            const bodyRow = currentRow;

            // 교시 라벨
            const periodCell = sheet.getCell(bodyRow, 1);
            periodCell.value = `${groupInfo.label}\n${groupInfo.time}`;
            periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
            periodCell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
            periodCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            periodCell.border = { top: THIN_BORDER, left: MEDIUM_BORDER, right: THICK_BORDER, bottom: THICK_BORDER };

            // 각 강사/요일 셀
            let bodyColIdx = 2;
            let maxStudentLines = 0;
            resources.forEach(({ resource, days: rDays }) => {
                // 가로 병합 처리 (같은 className 세트가 인접 요일에 있으면 병합)
                let dayIdx = 0;
                while (dayIdx < rDays.length) {
                    const day = rDays[dayIdx];
                    const firstClasses = hasFirst ? getClassesForCell(filteredClasses, day, firstPeriod, resource, 'teacher') : [];
                    const secondClasses = hasSecond ? getClassesForCell(filteredClasses, day, secondPeriod, resource, 'teacher') : [];

                    // 두 교시 모두 있고 같은 수업 → 하나의 셀로
                    const isSameAcrossPeriods = hasFirst && hasSecond &&
                        firstClasses.length > 0 && secondClasses.length > 0 &&
                        isSameClassNameSet(firstClasses, secondClasses);

                    let cellClasses: TimetableClass[];
                    if (isSameAcrossPeriods) {
                        cellClasses = firstClasses;
                    } else if (firstClasses.length > 0) {
                        cellClasses = firstClasses;
                    } else if (secondClasses.length > 0) {
                        cellClasses = secondClasses;
                    } else {
                        cellClasses = [];
                    }

                    // 가로 병합 span 계산
                    let colSpan = 1;
                    if (cellClasses.length > 0 && rDays.length > 1) {
                        for (let nextIdx = dayIdx + 1; nextIdx < rDays.length; nextIdx++) {
                            const nextDay = rDays[nextIdx];
                            const nextFirst = hasFirst ? getClassesForCell(filteredClasses, nextDay, firstPeriod, resource, 'teacher') : [];
                            const nextSecond = hasSecond ? getClassesForCell(filteredClasses, nextDay, secondPeriod, resource, 'teacher') : [];
                            const nextCellClasses: TimetableClass[] = nextFirst.length > 0 ? nextFirst : nextSecond;
                            if (isSameClassNameSet(cellClasses, nextCellClasses)) {
                                colSpan++;
                            } else {
                                break;
                            }
                        }
                    }

                    const content = buildCellContent(cellClasses, studentMap, showHoldStudents, showWithdrawnStudents);
                    const startCol = bodyColIdx;
                    const endCol = bodyColIdx + colSpan - 1;
                    if (colSpan > 1) {
                        sheet.mergeCells(bodyRow, startCol, bodyRow, endCol);
                    }
                    const cell = sheet.getCell(bodyRow, startCol);

                    if (content) {
                        cell.value = content.text;
                        if (content.bgColor) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: content.bgColor } };
                        } else {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                        }
                        cell.font = {
                            color: { argb: content.textColor || 'FF111827' },
                            size: 9,
                        };
                        cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
                        maxStudentLines = Math.max(maxStudentLines, content.studentLines?.length || 0);
                    } else {
                        // 빈 셀
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
                        cell.value = '';
                    }
                    cell.border = {
                        top: THIN_BORDER,
                        bottom: THICK_BORDER,
                        right: endCol === bodyColIdx + colSpan - 1 ? THICK_BORDER : THIN_BORDER,
                        left: startCol === 2 ? THIN_BORDER : undefined,
                    };

                    bodyColIdx += colSpan;
                    dayIdx += colSpan;
                }
            });

            // 행 높이: 학생 줄 수에 따라 동적 조정
            const minHeight = 40;
            const lineHeight = 13;
            const calcHeight = Math.max(minHeight, Math.min(400, maxStudentLines * lineHeight + 10));
            sheet.getRow(bodyRow).height = calcHeight;

            currentRow++;
        });

        // 그룹 간 여백
        currentRow++;
        return true;
    };

    // 그룹별 렌더링
    if (monThuDays.length > 0) renderGroupTable('월/목', monThuDays);
    if (tueFriDays.length > 0) renderGroupTable('화/금', tueFriDays);
    if (hasWednesday) renderGroupTable('수', ['수'], true);
    if (weekendDays.length > 0) {
        // 주말은 별도 처리 (단일 셀씩, 각 교시 행)
        const resources = getResourcesForDays(weekendDays);
        if (resources.length > 0) {
            const colors = GROUP_COLORS['주말'];
            const totalDayCols = resources.reduce((acc, r) => acc + r.days.length, 0);
            const totalCols = 1 + totalDayCols;

            sheet.getColumn(1).width = PERIOD_COL_WIDTH;
            let colIdx = 2;
            resources.forEach(r => {
                r.days.forEach(() => {
                    const col = sheet.getColumn(colIdx);
                    if (!col.width || col.width < DAY_COL_WIDTH) col.width = DAY_COL_WIDTH;
                    colIdx++;
                });
            });

            // Group title
            const gtRow = currentRow;
            sheet.mergeCells(gtRow, 1, gtRow, totalCols);
            const gt = sheet.getCell(gtRow, 1);
            gt.value = '주말';
            gt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
            gt.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            gt.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            gt.border = { top: MEDIUM_BORDER, left: MEDIUM_BORDER, right: MEDIUM_BORDER, bottom: THIN_BORDER };
            sheet.getRow(gtRow).height = 22;
            currentRow++;

            // Teacher row
            const tRow = currentRow;
            sheet.mergeCells(tRow, 1, tRow + 1, 1);
            const periodHead = sheet.getCell(tRow, 1);
            periodHead.value = '교시/시간';
            periodHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
            periodHead.font = { bold: true };
            periodHead.alignment = { horizontal: 'center', vertical: 'middle' };
            periodHead.border = { top: THIN_BORDER, left: MEDIUM_BORDER, right: THICK_BORDER, bottom: THICK_BORDER };

            let tcIdx = 2;
            resources.forEach(({ resource, days: rDays }) => {
                const teacherData = teachers.find(t => t.name === resource);
                const bg = hexToARGB(teacherData?.bgColor, 'FF3B82F6');
                const fg = hexToARGB(teacherData?.textColor, 'FFFFFFFF');
                const sc = tcIdx;
                const ec = tcIdx + rDays.length - 1;
                if (rDays.length > 1) sheet.mergeCells(tRow, sc, tRow, ec);
                const c = sheet.getCell(tRow, sc);
                c.value = resource;
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                c.font = { bold: true, color: { argb: fg } };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = { top: THIN_BORDER, right: THICK_BORDER, bottom: THICK_BORDER };
                tcIdx = ec + 1;
            });
            sheet.getRow(tRow).height = 22;
            currentRow++;

            // Day row
            const dRow = currentRow;
            let dcIdx = 2;
            resources.forEach(({ days: rDays }) => {
                rDays.forEach(day => {
                    const dateInfo = weekDates[day];
                    const cell = sheet.getCell(dRow, dcIdx);
                    cell.value = dateInfo ? `${day}\n${dateInfo.formatted}` : day;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.border = { top: THIN_BORDER, right: THICK_BORDER, bottom: THICK_BORDER };
                    dcIdx++;
                });
            });
            sheet.getRow(dRow).height = 26;
            currentRow++;

            // 주말 교시 행들: 개별 교시 ID로 처리
            const weekendPeriods = currentPeriods.filter(p => WEEKEND_PERIOD_TIMES[p]);
            weekendPeriods.forEach(period => {
                const bRow = currentRow;
                const pCell = sheet.getCell(bRow, 1);
                pCell.value = `${period}\n${WEEKEND_PERIOD_TIMES[period] || ''}`;
                pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.light } };
                pCell.font = { bold: true, size: 10 };
                pCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                pCell.border = { top: THIN_BORDER, left: MEDIUM_BORDER, right: THICK_BORDER, bottom: THICK_BORDER };

                let bcIdx = 2;
                let maxLines = 0;
                resources.forEach(({ resource, days: rDays }) => {
                    rDays.forEach(day => {
                        const classes = getClassesForCell(filteredClasses, day, period, resource, 'teacher');
                        const content = buildCellContent(classes, studentMap, showHoldStudents, showWithdrawnStudents);
                        const cell = sheet.getCell(bRow, bcIdx);
                        if (content) {
                            cell.value = content.text;
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: content.bgColor || 'FFFFFFFF' } };
                            cell.font = { color: { argb: content.textColor || 'FF111827' }, size: 9 };
                            cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
                            maxLines = Math.max(maxLines, content.studentLines?.length || 0);
                        } else {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
                        }
                        cell.border = { top: THIN_BORDER, right: THICK_BORDER, bottom: THICK_BORDER };
                        bcIdx++;
                    });
                });
                sheet.getRow(bRow).height = Math.max(40, Math.min(400, maxLines * 13 + 10));
                currentRow++;
            });
            currentRow++;
        }
    }

    // 다운로드 (브라우저)
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const safeWeekLabel = weekLabel.replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${params.subjectFilter || '수학'}_시간표_${safeWeekLabel}.xlsx`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
