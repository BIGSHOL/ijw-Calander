/**
 * 시간표 엑셀 가져오기 — 라운드트립 변경점 추출
 *
 * 흐름:
 * 1. parseImportedExcel(file) → _meta 시트 + 주 시트 데이터 추출
 * 2. computeChanges(parsed, studentLookups) → 추가/삭제/이동/반이름변경 분류
 * 3. (Phase 3에서) 미리보기 모달 → 사용자 검토 → 적용
 *
 * Phase 2 범위 (지원):
 *  - 학생 이동: 메타 위치 A의 학생 → 메타 위치 B로 이동 (A에서 사라지고 B에서 나타남)
 *  - 학생 삭제: 메타 위치의 학생이 셀에서 사라짐 (셀이 비거나 다른 학생으로 교체)
 *  - 학생 교체: 메타 위치의 학생 A가 다른 학생 B로 바뀜 (A 삭제 + B 추가)
 *  - 반이름 변경: class_name 셀 텍스트가 메타와 다름
 *
 * Phase 2 미지원:
 *  - 새로운 빈 셀에 학생 추가 (메타에 위치 정보 없음 → 어느 수업인지 모름)
 *  - 새로운 수업 추가
 *  - 강사·강의실 변경
 */

import type { UnifiedStudent } from '../../../../types';

export interface ImportedMetaEntry {
    kind: 'class_name' | 'class_room' | 'student';
    row: number;
    startCol: number;
    endCol: number;
    section?: 'active' | 'hold' | 'withdrawn';
    subPeriod?: 'top' | 'bot' | 'both';
    classId?: string;
    classNameSnapshot?: string;
    roomSnapshot?: string;
    studentId?: string;
    studentNameSnapshot?: string;
    sourceClassId?: string;
    /** class_name 셀의 배경 ARGB (export 시점 스냅샷) */
    bgColorSnapshot?: string;
    /** class_name 셀의 글자 ARGB */
    textColorSnapshot?: string;
}

export interface ImportedExcel {
    schemaVersion: string;
    subjectFilter: string;
    weekLabel: string;
    referenceDate: string;
    sheetName: string;
    entries: ImportedMetaEntry[];
    /**
     * 주 시트의 셀 텍스트.
     * Key: `"row,col"` (병합셀의 마스터 row,col 기준)
     * Value: 현재 셀 텍스트 (없으면 빈 문자열)
     */
    cellValues: Map<string, string>;
    /** col 번호 → 요일 (월/화/수/목/금/토/일) — row 4 의 day row 에서 파싱 */
    colToDay: Map<number, string>;
    /** col 번호 → 강사명 — row 3 의 teacher row 에서 파싱 (가로 병합 자식 col 도 포함) */
    colToTeacher: Map<number, string>;
    /**
     * 가로 병합 정보 — 마스터 셀 (row,col) → endCol
     * 사용자가 가로 병합된 셀(예: 월/목 공통 등원 영역)에 학생을 적었을 때
     * 그 영역 전체를 추적하기 위함.
     */
    mergeEndColByMaster: Map<string, number>;
    /**
     * 셀별 현재 색상 (class_name 위치만 추출).
     * Key: `"row,col"` (메타 entry startCol 기준)
     * Value: { bg: ARGB, fg: ARGB }
     */
    cellColors: Map<string, { bg?: string; fg?: string }>;
}

/** 학생 텍스트 ("김아름/5칠성초") → 학생ID 매칭 */
export interface StudentLookups {
    /** key: `"name__schoolGrade"` (예: "김아름__5칠성초") */
    byNameSchoolGrade: Map<string, string>; // → studentId
    /** key: name */
    byName: Map<string, string[]>; // → [studentId, ...]
}

/** 변경점 분류 */
export interface ImportChanges {
    classNameRenames: Array<{
        classId: string;
        oldName: string;
        newName: string;
    }>;
    /** 수업 색상 변경 (배경/글자) */
    classColorChanges: Array<{
        classId: string;
        className: string;
        oldBg?: string;
        newBg?: string;
        oldFg?: string;
        newFg?: string;
    }>;
    studentRemovals: Array<{
        studentId: string;
        studentNameSnapshot: string;
        sourceClassId: string;
        row: number;
        col: number;
    }>;
    studentAdditions: Array<{
        /** 셀에 적힌 새 학생 이름 텍스트 (파싱 전) */
        text: string;
        /** 매칭된 학생 (이름+학교/학년) — null이면 모호/미매칭 */
        matchedStudentId: string | null;
        /** 모호한 매칭일 때 후보 */
        candidates?: string[];
        targetClassId: string;
        row: number;
        col: number;
    }>;
    studentMoves: Array<{
        studentId: string;
        studentNameSnapshot: string;
        fromClassId: string;
        toClassId: string;
        fromRow: number;
        fromCol: number;
        toRow: number;
        toCol: number;
        /** UI 표시용 — 출처 요일 (예: "월" 또는 "월/목") */
        fromDay?: string;
        toDay?: string;
        /** UI 표시용 — 출처 강사명 */
        fromTeacher?: string;
        toTeacher?: string;
        /** 강사가 변경된 이동인지 (담임 변경 강조용) */
        teacherChanged?: boolean;
    }>;
    /** 변경 없는 항목 수 (참고용) */
    unchanged: number;
    /** 인식 못한 셀 (메타 외 위치에 새로 추가된 텍스트 등) */
    unmatchedAdditions: Array<{ row: number; col: number; text: string }>;
}

/**
 * 엑셀 파일을 파싱해서 _meta + 주 시트 데이터를 추출.
 */
export async function parseImportedExcel(file: File): Promise<ImportedExcel> {
    const ExcelJS = (await import('exceljs')).default;
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // _meta 시트 (hidden) 찾기
    const metaSheet = workbook.getWorksheet('_meta');
    if (!metaSheet) {
        throw new Error('이 파일은 라운드트립 메타데이터(_meta 시트)가 없습니다. 시간표 엑셀저장으로 내보낸 파일만 가져올 수 있습니다.');
    }

    // _meta 첫 행: 스키마 헤더 (값)
    const schemaHeaderRow = metaSheet.getRow(1);
    const schemaValueRow = metaSheet.getRow(2);
    const schemaVersion = String(schemaValueRow.getCell(1).value ?? '');
    const subjectFilter = String(schemaValueRow.getCell(2).value ?? '');
    const weekLabel = String(schemaValueRow.getCell(3).value ?? '');
    const referenceDate = String(schemaValueRow.getCell(4).value ?? '');
    const sheetName = String(schemaValueRow.getCell(5).value ?? '');

    if (schemaVersion !== '1') {
        throw new Error(`지원하지 않는 메타 스키마 버전입니다: ${schemaVersion}`);
    }

    // 4행 = entry 컬럼 헤더, 5행부터 entry 본문
    const ENTRY_START_ROW = 5;
    const entries: ImportedMetaEntry[] = [];

    for (let r = ENTRY_START_ROW; r <= metaSheet.rowCount; r++) {
        const row = metaSheet.getRow(r);
        const kind = String(row.getCell(1).value ?? '').trim();
        if (!kind) continue;
        if (kind !== 'class_name' && kind !== 'class_room' && kind !== 'student') continue;

        entries.push({
            kind: kind as ImportedMetaEntry['kind'],
            row: Number(row.getCell(2).value) || 0,
            startCol: Number(row.getCell(3).value) || 0,
            endCol: Number(row.getCell(4).value) || 0,
            section: (String(row.getCell(5).value ?? '').trim() || undefined) as ImportedMetaEntry['section'],
            subPeriod: (String(row.getCell(6).value ?? '').trim() || undefined) as ImportedMetaEntry['subPeriod'],
            classId: String(row.getCell(7).value ?? '').trim() || undefined,
            classNameSnapshot: String(row.getCell(8).value ?? '').trim() || undefined,
            roomSnapshot: String(row.getCell(9).value ?? '').trim() || undefined,
            studentId: String(row.getCell(10).value ?? '').trim() || undefined,
            studentNameSnapshot: String(row.getCell(11).value ?? '').trim() || undefined,
            sourceClassId: String(row.getCell(12).value ?? '').trim() || undefined,
            bgColorSnapshot: String(row.getCell(13).value ?? '').trim() || undefined,
            textColorSnapshot: String(row.getCell(14).value ?? '').trim() || undefined,
        });
    }

    // 주 시트 (sheetName 또는 첫 번째 일반 시트)
    let mainSheet = workbook.getWorksheet(sheetName);
    if (!mainSheet) {
        // fallback: _meta 가 아닌 첫 시트
        for (const ws of workbook.worksheets) {
            if (ws.name !== '_meta') {
                mainSheet = ws;
                break;
            }
        }
    }
    if (!mainSheet) throw new Error('주 시트를 찾을 수 없습니다.');

    // 주 시트의 모든 셀 텍스트를 (row,col) 키로 추출
    // 가로 병합 셀은 마스터 셀에만 등록 (자식 셀은 ExcelJS 가 동일 값 반환할 수 있어 중복 방지)
    const cellValues = new Map<string, string>();
    mainSheet.eachRow({ includeEmpty: false }, (row, rowIdx) => {
        row.eachCell({ includeEmpty: false }, (cell, colIdx) => {
            // 병합 자식 셀은 스킵 (마스터에서만 등록)
            const master = (cell as any).master;
            if (master && master !== cell) return;

            const v = cell.value;
            let text = '';
            if (v == null) text = '';
            else if (typeof v === 'string') text = v;
            else if (typeof v === 'number') text = String(v);
            else if (typeof v === 'object' && 'richText' in v) {
                text = (v.richText as Array<{ text: string }>).map(r => r.text).join('');
            } else if (typeof v === 'object' && 'result' in v) {
                text = String((v as any).result ?? '');
            } else {
                text = String(v);
            }
            cellValues.set(`${rowIdx},${colIdx}`, text.trim());
        });
    });

    // ─── 가로 병합 정보 추출 (마스터 → endCol) ───
    // ExcelJS 의 model.merges 또는 _merges 활용 ("D9:E9" 같은 range 문자열)
    const mergeEndColByMaster = new Map<string, number>();
    const wsAny = mainSheet as any;
    const mergesData = wsAny._merges || wsAny.model?.merges || {};
    let mergeRanges: string[] = [];
    if (Array.isArray(mergesData)) {
        mergeRanges = mergesData;
    } else if (typeof mergesData === 'object') {
        mergeRanges = Object.keys(mergesData);
    }
    const parseCellAddr = (addr: string): { row: number; col: number } | null => {
        const m = addr.match(/^([A-Z]+)(\d+)$/);
        if (!m) return null;
        let col = 0;
        for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
        return { row: Number(m[2]), col };
    };
    for (const range of mergeRanges) {
        const parts = range.split(':');
        if (parts.length !== 2) continue;
        const start = parseCellAddr(parts[0]);
        const end = parseCellAddr(parts[1]);
        if (!start || !end) continue;
        // 가로 병합만 관심 (start.row === end.row)
        if (start.row !== end.row) continue;
        mergeEndColByMaster.set(`${start.row},${start.col}`, end.col);
    }

    // ─── teacher row (row 3) → col → 강사명 매핑 ───
    // 가로 병합된 강사 셀: 자식 col 은 마스터 값 참조
    const colToTeacher = new Map<number, string>();
    const teacherRow = mainSheet.getRow(3);
    teacherRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
        const master = (cell as any).master;
        const sourceCell = master && master !== cell ? master : cell;
        const v = sourceCell.value;
        let text = '';
        if (typeof v === 'string') text = v;
        else if (typeof v === 'number') text = String(v);
        else if (v && typeof v === 'object' && 'richText' in v) {
            text = (v.richText as Array<{ text: string }>).map(r => r.text).join('');
        }
        text = text.trim();
        if (text && text !== '교시') colToTeacher.set(colIdx, text);
    });

    // ─── day row (row 4) → col → 요일 매핑 ───
    // dayCell value 는 "월\n5/11" 형식 → 첫 줄(요일) 만 추출
    const colToDay = new Map<number, string>();
    const dayRow = mainSheet.getRow(4);
    dayRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
        const master = (cell as any).master;
        const sourceCell = master && master !== cell ? master : cell;
        const v = sourceCell.value;
        let text = '';
        if (typeof v === 'string') text = v;
        else if (typeof v === 'number') text = String(v);
        else if (v && typeof v === 'object' && 'richText' in v) {
            text = (v.richText as Array<{ text: string }>).map(r => r.text).join('');
        }
        const firstLine = text.split('\n')[0].trim();
        if (/^[월화수목금토일]$/.test(firstLine)) {
            colToDay.set(colIdx, firstLine);
        }
    });

    // ─── class_name 셀의 현재 색상 추출 ───
    // 사용자가 엑셀에서 변경한 fill/font 색상을 ARGB 로 추출하여 메타 스냅샷과 비교
    const cellColors = new Map<string, { bg?: string; fg?: string }>();
    const normalizeArgb = (v: any): string | undefined => {
        if (!v) return undefined;
        if (typeof v === 'string') {
            const s = v.replace('#', '').toUpperCase();
            if (s.length === 6) return `FF${s}`;
            if (s.length === 8) return s;
        }
        return undefined;
    };
    for (const e of entries) {
        if (e.kind !== 'class_name') continue;
        if (!e.row || !e.startCol) continue;
        const cell = mainSheet.getCell(e.row, e.startCol);
        const fill: any = cell.fill;
        const font: any = cell.font;
        const bg = normalizeArgb(fill?.fgColor?.argb || fill?.bgColor?.argb);
        const fg = normalizeArgb(font?.color?.argb);
        cellColors.set(`${e.row},${e.startCol}`, { bg, fg });
    }

    // 사용 안 하는 변수 경고 방지
    void schemaHeaderRow;

    return {
        schemaVersion,
        subjectFilter,
        weekLabel,
        referenceDate,
        sheetName,
        entries,
        cellValues,
        colToDay,
        colToTeacher,
        mergeEndColByMaster,
        cellColors,
    };
}

/**
 * 학생 셀 텍스트 ("김아름/5칠성초" 또는 "[1] 김아름/5칠성초") → 학생 식별.
 * 합반 prefix "[N] " 는 제거.
 *
 * 엄격한 패턴 매칭 — 학생 텍스트가 아닌 셀(수업명/강의실/카운트/헤더 등)은 null 반환.
 * 패턴: "이름(한글2-8자, 끝에 영문 1자 허용)/학년숫자1-2자 + 학교(한글1-10자)"
 * - "서지원/6칠성초" ✓
 * - "이서현C/4옥산초" ✓
 * - "안민규/4칠성초" ✓
 * - "본원603 / 본원603" ✗ (학교명 패턴 아님)
 * - "7명 - 재원생" ✗ (슬래시 없음 / 패턴 불일치)
 * - "고등M_토 개별진도" ✗
 * - "9" ✗
 */
const STUDENT_TEXT_PATTERN = /^([가-힣]{1,6}[A-Z]?)\/([0-9]{1,2}[가-힣]{1,12}[0-9]?)$/;

function parseStudentCellText(text: string): { name: string; schoolGrade: string } | null {
    if (!text) return null;
    // 합반 prefix "[1] " 제거
    const cleaned = text.replace(/^\[\d+\]\s*/, '').trim();
    const m = cleaned.match(STUDENT_TEXT_PATTERN);
    if (!m) return null;
    return {
        name: m[1].trim(),
        schoolGrade: m[2].trim(),
    };
}

/**
 * 메타와 현재 셀 값을 비교해서 변경점 분류.
 *
 * 알고리즘:
 * 1. 메타의 student entry 위치를 순회 → 메타 학생 ID와 현재 셀 학생 ID 비교
 * 2. 다른 경우 일단 (removal, addition) 으로 마킹
 * 3. 모든 위치 처리 후 (removal, addition) 페어 매칭 → 같은 studentId면 'moved'
 * 4. class_name entry 순회 → 현재 셀 텍스트와 비교 → 다르면 'renamed'
 */
export function computeChanges(
    imported: ImportedExcel,
    studentLookups: StudentLookups,
): ImportChanges {
    const result: ImportChanges = {
        classNameRenames: [],
        classColorChanges: [],
        studentRemovals: [],
        studentAdditions: [],
        studentMoves: [],
        unchanged: 0,
        unmatchedAdditions: [],
    };

    // (1) 학생 변경 분석
    // 각 student entry 위치에서 현재 셀 텍스트 추출
    const studentEntries = imported.entries.filter(e => e.kind === 'student');

    // 영역 매핑: 각 sourceClassId 별 active section의 (row, col) 범위
    // → 메타에 없는 빈 셀에 새 학생이 적혔을 때, 어느 수업에 속하는지 추론
    interface ClassZone {
        rowMin: number;
        rowMax: number;
        colMin: number;
        colMax: number;
    }

    // (a) 같은 교시 = 연속 row 그룹 찾기 (active section만)
    //     셀 별로 학생 수가 다르면 rowMax가 달라지므로, 그룹 max로 통일해서
    //     "다른 셀이 더 많은 학생을 가져서 비어있는 슬롯"까지 영역에 포함
    const activeRows = Array.from(
        new Set(studentEntries.filter(e => e.section === 'active').map(e => e.row))
    ).sort((a, b) => a - b);
    const rowGroups: Array<{ min: number; max: number }> = [];
    if (activeRows.length > 0) {
        let curMin = activeRows[0];
        let curMax = activeRows[0];
        for (let i = 1; i < activeRows.length; i++) {
            const r = activeRows[i];
            // row 차이 3 이내면 같은 교시 그룹 (hold/withdrawn 헤더가 끼어들면 4 이상 차이남)
            if (r - curMax <= 3) {
                curMax = r;
            } else {
                rowGroups.push({ min: curMin, max: curMax });
                curMin = r; curMax = r;
            }
        }
        rowGroups.push({ min: curMin, max: curMax });
    }

    // (b) sourceClassId 별 col 범위 + 어느 row 그룹에 속하는지 → ClassZone
    const zonesByClassId = new Map<string, ClassZone>();
    studentEntries
        .filter(e => e.section === 'active' && e.sourceClassId)
        .forEach(e => {
            const group = rowGroups.find(g => e.row >= g.min && e.row <= g.max);
            if (!group) return;
            const z = zonesByClassId.get(e.sourceClassId!);
            if (!z) {
                zonesByClassId.set(e.sourceClassId!, {
                    rowMin: group.min, rowMax: group.max,
                    colMin: e.startCol, colMax: e.endCol,
                });
            } else {
                // row 범위는 같은 그룹의 min/max로 통일 (확장)
                z.rowMin = Math.min(z.rowMin, group.min);
                z.rowMax = Math.max(z.rowMax, group.max);
                z.colMin = Math.min(z.colMin, e.startCol);
                z.colMax = Math.max(z.colMax, e.endCol);
            }
        });

    // 메타 학생 위치 set (메타 외 스캔 시 제외용)
    // 가로 병합 셀의 모든 col 을 등록 — ExcelJS 가 자식 셀에도 값 반환할 수 있어 안전망
    const metaStudentPositions = new Set<string>();
    studentEntries.forEach(e => {
        for (let c = e.startCol; c <= e.endCol; c++) {
            metaStudentPositions.add(`${e.row},${c}`);
        }
    });

    // 임시 버킷 (이동 매칭용)
    const removalsByStudent = new Map<string, ImportChanges['studentRemovals'][number]>();
    const additionsByStudent = new Map<string, ImportChanges['studentAdditions'][number]>();

    for (const entry of studentEntries) {
        if (!entry.studentId) continue;
        // 셀 텍스트는 startCol 기준 (병합셀의 마스터)
        const key = `${entry.row},${entry.startCol}`;
        const currentText = imported.cellValues.get(key) || '';
        const metaText = entry.studentNameSnapshot || '';

        if (currentText === metaText) {
            result.unchanged++;
            continue;
        }

        // 메타 학생은 이 셀에 더 이상 없음 → removed (또는 이동의 from)
        // 단, withdrawn 섹션의 검정 행은 사용자가 셀 텍스트를 변경하기 어려움(편집 가능하지만 위험)
        // → withdrawn은 일단 보존: 텍스트가 비면 무시 (사용자가 흰 글씨 못 봤을 수도)
        if (entry.section === 'withdrawn' && !currentText) {
            // 퇴원 행 비어졌어도 변경 무시 — Phase 3에서 옵션 토글 추가 가능
            continue;
        }

        result.studentRemovals.push({
            studentId: entry.studentId,
            studentNameSnapshot: metaText,
            sourceClassId: entry.sourceClassId || '',
            row: entry.row,
            col: entry.startCol,
        });
        removalsByStudent.set(entry.studentId, result.studentRemovals[result.studentRemovals.length - 1]);

        // 셀에 새 텍스트가 있으면 → addition (이 셀의 sourceClassId에 추가)
        if (currentText) {
            const parsed = parseStudentCellText(currentText);
            if (parsed) {
                const matched = matchStudent(parsed.name, parsed.schoolGrade, studentLookups);
                const addEntry: ImportChanges['studentAdditions'][number] = {
                    text: currentText,
                    matchedStudentId: matched.id,
                    candidates: matched.candidates,
                    targetClassId: entry.sourceClassId || '',
                    row: entry.row,
                    col: entry.startCol,
                };
                result.studentAdditions.push(addEntry);
                if (matched.id) {
                    additionsByStudent.set(matched.id, addEntry);
                }
            }
        }
    }

    // (1.5) 메타 외 위치 스캔 — 같은 셀 안 요일 이동, 다른 셀로의 이동 캐치
    // 빈 슬롯에 새로 적힌 학생을 영역 매핑으로 sourceClassId 추론
    for (const [key, text] of imported.cellValues.entries()) {
        if (!text) continue;
        if (metaStudentPositions.has(key)) continue; // 메타 위치는 (1)에서 처리됨

        const [rowStr, colStr] = key.split(',');
        const row = Number(rowStr);
        const col = Number(colStr);
        if (!row || !col) continue;

        // 학생 텍스트 형식("이름/학교학년" 또는 "[N] 이름/학교학년")만 처리
        const parsed = parseStudentCellText(text);
        if (!parsed || !parsed.name) continue;

        // 영역 매핑으로 sourceClassId 추론
        let zoneClassId: string | null = null;
        for (const [classId, z] of zonesByClassId.entries()) {
            if (row >= z.rowMin && row <= z.rowMax && col >= z.colMin && col <= z.colMax) {
                zoneClassId = classId;
                break;
            }
        }

        if (!zoneClassId) {
            // 영역 밖 셀에 학생 텍스트가 적힘 → 어느 수업인지 모름
            // 단, 학생 텍스트로 인식되는 셀만 unmatchedAdditions 에 기록
            result.unmatchedAdditions.push({ row, col, text });
            continue;
        }

        // 학생 매칭
        const matched = matchStudent(parsed.name, parsed.schoolGrade, studentLookups);
        const addEntry: ImportChanges['studentAdditions'][number] = {
            text,
            matchedStudentId: matched.id,
            candidates: matched.candidates,
            targetClassId: zoneClassId,
            row,
            col,
        };
        result.studentAdditions.push(addEntry);
        // additionsByStudent 에 등록 (이미 있으면 첫 등록만 유지 — 가장 자연스러운 우선순위)
        if (matched.id && !additionsByStudent.has(matched.id)) {
            additionsByStudent.set(matched.id, addEntry);
        }
    }

    // (2) removal + addition 페어 매칭 → moved
    // 같은 studentId가 양쪽에 있으면 이동으로 분류
    // 가로 병합 셀(공통 등원, 예: 월/목 둘다) 인 경우 startCol~endCol 의 모든 day 를 결합
    const colToDayDisplay = (startCol: number, endCol: number): string => {
        const days: string[] = [];
        for (let c = startCol; c <= endCol; c++) {
            const d = imported.colToDay.get(c);
            if (d && !days.includes(d)) days.push(d);
        }
        return days.join('/');
    };
    // entry 의 startCol/endCol 을 알아야 day 결합 가능 — studentEntries 인덱스 미리 빌드
    const entryByPos = new Map<string, ImportedMetaEntry>();
    studentEntries.forEach(e => entryByPos.set(`${e.row},${e.startCol}`, e));

    const movedStudentIds = new Set<string>();
    for (const [studentId, removal] of removalsByStudent.entries()) {
        const addition = additionsByStudent.get(studentId);
        if (addition) {
            // 출처: meta entry 에서 endCol 가져옴 (또는 가로 병합 정보)
            const fromEntry = entryByPos.get(`${removal.row},${removal.col}`);
            const fromStartCol = removal.col;
            const fromEndCol = fromEntry?.endCol
                ?? imported.mergeEndColByMaster.get(`${removal.row},${removal.col}`)
                ?? removal.col;
            const fromWasMerged = fromEndCol > fromStartCol;
            const fromDay = colToDayDisplay(fromStartCol, fromEndCol);
            const fromTeacher = imported.colToTeacher.get(fromStartCol) || '';

            // 목적지: 메타 외 위치는 가로 병합 정보로 endCol 추론 (예: 월/목 공통 등원 영역)
            const toEntry = entryByPos.get(`${addition.row},${addition.col}`);
            let toStartCol = addition.col;
            let toEndCol = toEntry?.endCol
                ?? imported.mergeEndColByMaster.get(`${addition.row},${addition.col}`)
                ?? addition.col;

            // 자동 확장: 출발이 공통(가로 병합)이었는데 도착이 단일 col 이면
            // → 같은 row 의 인접 빈 col 들로 확장 (사용자가 빈 슬롯에 적었어도 공통 의도로 해석)
            if (fromWasMerged && toStartCol === toEndCol) {
                const zone = zonesByClassId.get(addition.targetClassId);
                if (zone) {
                    // 오른쪽 확장
                    while (toEndCol < zone.colMax) {
                        const adjKey = `${addition.row},${toEndCol + 1}`;
                        if (imported.cellValues.get(adjKey)) break; // 다른 학생/텍스트 있음
                        toEndCol++;
                    }
                    // 왼쪽 확장
                    while (toStartCol > zone.colMin) {
                        const adjKey = `${addition.row},${toStartCol - 1}`;
                        if (imported.cellValues.get(adjKey)) break;
                        toStartCol--;
                    }
                }
            }

            const toDay = colToDayDisplay(toStartCol, toEndCol);
            const toTeacher = imported.colToTeacher.get(toStartCol) || '';

            result.studentMoves.push({
                studentId,
                studentNameSnapshot: removal.studentNameSnapshot,
                fromClassId: removal.sourceClassId,
                toClassId: addition.targetClassId,
                fromRow: removal.row,
                fromCol: removal.col,
                toRow: addition.row,
                toCol: addition.col,
                fromDay: fromDay || undefined,
                toDay: toDay || undefined,
                fromTeacher: fromTeacher || undefined,
                toTeacher: toTeacher || undefined,
                teacherChanged: !!(fromTeacher && toTeacher && fromTeacher !== toTeacher),
            });
            movedStudentIds.add(studentId);
        }
    }
    // 이동된 학생은 removals/additions에서 제거
    result.studentRemovals = result.studentRemovals.filter(r => !movedStudentIds.has(r.studentId));
    result.studentAdditions = result.studentAdditions.filter(a =>
        !a.matchedStudentId || !movedStudentIds.has(a.matchedStudentId)
    );

    // (3) 반이름 변경 분석 + 수업 색상 변경 분석
    const classNameEntries = imported.entries.filter(e => e.kind === 'class_name');
    // classId 별 중복 방지 (sub-period 분할 시 같은 classId 가 top/bot 둘 다 나올 수 있음)
    const seenRenameClassIds = new Set<string>();
    const seenColorClassIds = new Set<string>();
    for (const entry of classNameEntries) {
        if (!entry.classId) continue;
        const key = `${entry.row},${entry.startCol}`;
        const currentText = imported.cellValues.get(key) || '';
        const metaText = entry.classNameSnapshot || '';

        // 통합 셀 + 합반은 여러 수업명이 줄바꿈으로 들어가 있을 수 있음. 일단 단일 수업만 처리.
        // 통합 분기 (subPeriod='both') 에서는 첫 className 비교
        const cleanCurrent = currentText.split('\n')[0].replace(/^\[\d+\]\s*/, '').trim();
        const cleanMeta = metaText.replace(/^\[\d+\]\s*/, '').trim();

        if (cleanCurrent && cleanCurrent !== cleanMeta && !seenRenameClassIds.has(entry.classId)) {
            result.classNameRenames.push({
                classId: entry.classId,
                oldName: cleanMeta,
                newName: cleanCurrent,
            });
            seenRenameClassIds.add(entry.classId);
        }

        // 색상 비교 (메타 스냅샷 vs 현재 셀)
        if (!seenColorClassIds.has(entry.classId)) {
            const cur = imported.cellColors.get(key);
            const oldBg = (entry.bgColorSnapshot || '').toUpperCase();
            const oldFg = (entry.textColorSnapshot || '').toUpperCase();
            const newBg = (cur?.bg || '').toUpperCase();
            const newFg = (cur?.fg || '').toUpperCase();
            const bgChanged = newBg && newBg !== oldBg;
            const fgChanged = newFg && newFg !== oldFg;
            if (bgChanged || fgChanged) {
                result.classColorChanges.push({
                    classId: entry.classId,
                    className: cleanCurrent || cleanMeta,
                    oldBg: oldBg || undefined,
                    newBg: bgChanged ? newBg : undefined,
                    oldFg: oldFg || undefined,
                    newFg: fgChanged ? newFg : undefined,
                });
                seenColorClassIds.add(entry.classId);
            }
        }
    }

    return result;
}

/** 이름 + 학교/학년 → 학생 매칭. 동명이인 시 candidates 반환. */
function matchStudent(
    name: string,
    schoolGrade: string,
    lookups: StudentLookups,
): { id: string | null; candidates?: string[] } {
    if (!name) return { id: null };
    // 정확 매칭
    const exact = lookups.byNameSchoolGrade.get(`${name}__${schoolGrade}`);
    if (exact) return { id: exact };
    // 이름만 매칭
    const byName = lookups.byName.get(name) || [];
    if (byName.length === 1) return { id: byName[0] };
    if (byName.length > 1) return { id: null, candidates: byName };
    return { id: null };
}

/** 학생 lookups 빌드 (BillingManager 와 동일 패턴) */
export function buildStudentLookups(students: UnifiedStudent[]): StudentLookups {
    const byNameSchoolGrade = new Map<string, string>();
    const byName = new Map<string, string[]>();
    students.forEach(s => {
        const name = s.name || '';
        if (!name) return;
        // 텍스트 형식은 formatStudentRowText 와 동일하게 — formatSchoolGrade 결과 사용
        const schoolGrade = formatSchoolGrade(s.school, s.grade);
        byNameSchoolGrade.set(`${name}__${schoolGrade}`, s.id);
        const arr = byName.get(name) || [];
        arr.push(s.id);
        byName.set(name, arr);
    });
    return { byNameSchoolGrade, byName };
}

/** utils/studentUtils.ts 의 formatSchoolGrade 와 동일 — 순환 import 회피용 사본 */
function formatSchoolGrade(
    school: string | undefined | null,
    grade: string | undefined | null,
): string {
    const schoolStr = (school || '').trim();
    const gradeStr = (grade || '').trim();
    if (!schoolStr && !gradeStr) return '-';
    if (!schoolStr) return gradeStr || '-';
    if (!gradeStr) return schoolStr;

    // "초3", "중2", "고1" 같은 짧은 형식 → 학년숫자만 추출
    const gradeMatch = gradeStr.match(/^([초중고])([0-9]+)$/);
    if (gradeMatch) {
        const gradeNum = gradeMatch[2];
        // 학교명에 "초/중/고" 가 포함되어 있으면 학교 뒤에 학년숫자
        // 예: "칠성초" + "초3" → "3칠성초" / "대구중" + "중2" → "2대구중"
        // (formatSchoolGrade 의 일반 변환과 동일)
        if (/[초중고]/.test(schoolStr)) {
            // schoolStr 이 "칠성초" 같으면 학년숫자 앞에 학교
            return `${gradeNum}${schoolStr}`;
        }
        // 학교명에 학교종류가 없으면 — 학년 + 학교
        return `${gradeStr}${schoolStr}`;
    }
    // 학년이 숫자만 ("3") → 학교 뒤에 학년 (예: "칠성초3")
    if (/^[0-9]+$/.test(gradeStr)) {
        return `${schoolStr}${gradeStr}`;
    }
    return `${schoolStr}${gradeStr}`;
}
