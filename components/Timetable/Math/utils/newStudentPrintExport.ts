/**
 * 신입생 모달 — K프린트 업로드용 엑셀 다운로드.
 *
 * 시트 구성:
 *  - "통합데이터": 출석부(attendance_records) + 상담 + 수강내역을 한 표로 누적
 *  - "K프린트양식": 일반 기업용 인쇄 양식 (수식으로 통합데이터를 참조)
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';

const RECORDS_COLLECTION = 'attendance_records';

export interface PrintStudent {
    id: string;
    name: string;
    school?: string;
    grade?: string;
    parentName?: string;
    parentPhone?: string;
    studentPhone?: string;
}

export interface PrintConsultation {
    date?: string;
    title?: string;
    content?: string;
    consultantName?: string;
    source: '입학' | '재원';
}

export interface PrintEnrollment {
    subject: string;
    className: string;
    teacher?: string;
    startDate?: string;
    endDate?: string;
    groupLabel?: string;
}

interface AttendanceCellRow {
    date: string;          // YYYY-MM-DD
    className: string;
    teacher: string;
    status: string;        // 출석/지각/결석/-
    examInfo: string;      // 시험결과 (분자/분모)
    assignmentScore: string;
    progress: string;
    classwork: string;     // 오늘과제
    attitude: string;
    notes: string;
}

const STATUS_LABEL: Record<number, string> = {
    1: '출석',
    2: '지각',
    0: '결석',
};

/** 학생의 attendance_records 전체 fetch → 셀 단위 row 로 평탄화 */
async function fetchAttendanceRows(
    studentId: string,
    teacherMap: Map<string, string>,
): Promise<AttendanceCellRow[]> {
    const q = query(collection(db, RECORDS_COLLECTION), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    const rows: AttendanceCellRow[] = [];

    snap.docs.forEach(d => {
        const data = d.data() as any;
        const attendance: Record<string, number> = data.attendance || {};
        const examInfoRaw: Record<string, string> = data.examInfoRaw || {};
        const assignmentScoreRaw: Record<string, string> = data.assignmentScoreRaw || {};
        const progressRaw: Record<string, string> = data.progressRaw || {};
        const classwork: Record<string, string> = data.classwork || {};
        const attitude: Record<string, string> = data.attitude || {};
        const notes: Record<string, string> = data.attendanceNotes || data.notes || {};
        const memos: Record<string, string> = data.memos || {};

        const cellKeys = new Set<string>([
            ...Object.keys(attendance),
            ...Object.keys(examInfoRaw),
            ...Object.keys(assignmentScoreRaw),
            ...Object.keys(progressRaw),
            ...Object.keys(classwork),
            ...Object.keys(attitude),
            ...Object.keys(notes),
            ...Object.keys(memos),
        ]);

        cellKeys.forEach(key => {
            const hasComposite = key.includes('::');
            const className = hasComposite ? key.split('::')[0] : (data.className || '');
            const date = hasComposite ? key.split('::')[1] : key;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

            const statusRaw = attendance[key];
            const statusLabel = typeof statusRaw === 'number'
                ? (STATUS_LABEL[statusRaw] ?? '')
                : '';

            const noteVal = notes[key] || memos[key] || '';

            rows.push({
                date,
                className,
                teacher: teacherMap.get(className) || '',
                status: statusLabel,
                examInfo: examInfoRaw[key] || '',
                assignmentScore: assignmentScoreRaw[key] || '',
                progress: progressRaw[key] || '',
                classwork: classwork[key] || '',
                attitude: attitude[key] || '',
                notes: noteVal,
            });
        });
    });

    rows.sort((a, b) => b.date.localeCompare(a.date) || a.className.localeCompare(b.className));
    return rows;
}

/** 셀에 데이터가 하나라도 있는 row 만 유지 (전부 빈 줄 제거) */
const isNonEmpty = (r: AttendanceCellRow): boolean =>
    !!(r.status || r.examInfo || r.assignmentScore || r.progress || r.classwork || r.attitude || r.notes);

/** YY-MM-DD 짧은 형식 */
const shortDate = (d: string): string => (d?.length >= 10 ? d.slice(2, 10) : d || '');

export async function exportNewStudentPrint(params: {
    student: PrintStudent;
    consultations: PrintConsultation[];
    enrollments: PrintEnrollment[];
    todayDate: string; // YYYY-MM-DD
}): Promise<void> {
    const { student, consultations, enrollments, todayDate } = params;

    // className → teacher 매핑 (enrollment 기반)
    const teacherMap = new Map<string, string>();
    enrollments.forEach(e => {
        if (e.className && e.teacher && !teacherMap.has(e.className)) {
            teacherMap.set(e.className, e.teacher);
        }
    });

    const attRowsAll = await fetchAttendanceRows(student.id, teacherMap);
    const attRows = attRowsAll.filter(isNonEmpty);

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '강의하는 아이들 연세학원';
    workbook.created = new Date();

    // ─────────────────────────────────────────────────────────────
    // 시트 1: 통합데이터
    // ─────────────────────────────────────────────────────────────
    const ws1 = workbook.addWorksheet('통합데이터', {
        views: [{ state: 'frozen', ySplit: 1 }],
    });
    const HEADERS = [
        '구분', '날짜', '담임', '학생명', '학교', '학년', '반', '출결',
        '시험결과', '과제점수', '교재/진도', '오늘과제', '태도', '특이사항',
    ];
    ws1.addRow(HEADERS);
    const headerRow = ws1.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FF374151' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    // 1-A) 출석 기록
    attRows.forEach(r => {
        ws1.addRow([
            '출석', r.date, r.teacher, student.name,
            student.school || '', student.grade || '',
            r.className, r.status,
            r.examInfo, r.assignmentScore, r.progress, r.classwork, r.attitude, r.notes,
        ]);
    });

    // 1-B) 상담 기록
    consultations.forEach(c => {
        ws1.addRow([
            `상담(${c.source})`, c.date || '', c.consultantName || '', student.name,
            student.school || '', student.grade || '',
            '', '',
            '', '', c.title || '', '', '', c.content || '',
        ]);
    });

    // 1-C) 수강내역
    enrollments.forEach(e => {
        ws1.addRow([
            '수강', e.startDate || '', e.teacher || '', student.name,
            student.school || '', student.grade || '',
            e.className, '',
            '', '', e.groupLabel || e.subject, '', '', e.endDate ? `종료: ${e.endDate}` : '',
        ]);
    });

    // 컬럼 너비
    const WIDTHS = [10, 12, 10, 10, 18, 8, 18, 8, 12, 10, 24, 24, 8, 30];
    WIDTHS.forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

    // 모든 데이터 셀 테두리 + 정렬
    const lastRow = ws1.rowCount;
    for (let r = 1; r <= lastRow; r++) {
        const row = ws1.getRow(r);
        for (let c = 1; c <= HEADERS.length; c++) {
            const cell = row.getCell(c);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            };
            if (r > 1) {
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.font = { size: 10 };
            }
        }
    }

    // 자동필터
    ws1.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: HEADERS.length },
    };

    // ─────────────────────────────────────────────────────────────
    // 시트 2: K프린트양식 (일반 기업용 인쇄 양식)
    // ─────────────────────────────────────────────────────────────
    const ws2 = workbook.addWorksheet('K프린트양식', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 1,
            margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
        },
    });

    ws2.getColumn(1).width = 14;
    ws2.getColumn(2).width = 24;
    ws2.getColumn(3).width = 14;
    ws2.getColumn(4).width = 24;

    // 제목
    ws2.mergeCells('A1:D1');
    ws2.getCell('A1').value = '강의하는 아이들 연세학원 — 학생 보고서';
    ws2.getCell('A1').font = { size: 16, bold: true };
    ws2.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws2.getRow(1).height = 30;

    ws2.mergeCells('A2:D2');
    ws2.getCell('A2').value = `발행일: ${todayDate}`;
    ws2.getCell('A2').font = { size: 10, color: { argb: 'FF6B7280' } };
    ws2.getCell('A2').alignment = { horizontal: 'right' };

    // 학생 기본정보 박스
    const infoRows: [string, string, string, string][] = [
        ['학생명', student.name, '학교', student.school || '-'],
        ['학년', student.grade || '-', '학부모', student.parentName || '-'],
        ['학부모연락처', student.parentPhone || '-', '본인연락처', student.studentPhone || '-'],
    ];
    let row = 4;
    infoRows.forEach(([k1, v1, k2, v2]) => {
        ws2.getCell(`A${row}`).value = k1;
        ws2.getCell(`B${row}`).value = v1;
        ws2.getCell(`C${row}`).value = k2;
        ws2.getCell(`D${row}`).value = v2;
        ['A', 'C'].forEach(col => {
            const c = ws2.getCell(`${col}${row}`);
            c.font = { bold: true };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        });
        for (const col of ['A', 'B', 'C', 'D']) {
            const c = ws2.getCell(`${col}${row}`);
            c.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' },
            };
            c.alignment = { vertical: 'middle', horizontal: col === 'A' || col === 'C' ? 'center' : 'left' };
        }
        row++;
    });

    // ─── 수강내역 섹션 ───
    row += 1;
    ws2.mergeCells(`A${row}:D${row}`);
    ws2.getCell(`A${row}`).value = '◼ 수강내역';
    ws2.getCell(`A${row}`).font = { bold: true, size: 12 };
    ws2.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    row++;

    const enrHeader = ['시작일', '반', '과목', '담임'];
    enrHeader.forEach((h, i) => {
        const c = ws2.getCell(row, i + 1);
        c.value = h;
        c.font = { bold: true };
        c.alignment = { horizontal: 'center' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        c.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
        };
    });
    row++;

    if (enrollments.length === 0) {
        ws2.mergeCells(`A${row}:D${row}`);
        ws2.getCell(`A${row}`).value = '(수강내역 없음)';
        ws2.getCell(`A${row}`).alignment = { horizontal: 'center' };
        ws2.getCell(`A${row}`).font = { color: { argb: 'FF9CA3AF' } };
        row++;
    } else {
        enrollments.forEach(e => {
            ws2.getCell(row, 1).value = shortDate(e.startDate || '');
            ws2.getCell(row, 2).value = e.className;
            ws2.getCell(row, 3).value = e.groupLabel || e.subject;
            ws2.getCell(row, 4).value = e.teacher || '';
            for (let c = 1; c <= 4; c++) {
                ws2.getCell(row, c).border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' },
                };
                ws2.getCell(row, c).alignment = { vertical: 'middle' };
            }
            row++;
        });
    }

    // ─── 상담 요약 섹션 ───
    row += 1;
    ws2.mergeCells(`A${row}:D${row}`);
    ws2.getCell(`A${row}`).value = '◼ 상담 요약 (최근순)';
    ws2.getCell(`A${row}`).font = { bold: true, size: 12 };
    ws2.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEAFE' } };
    row++;

    const conHeader = ['날짜', '구분', '상담자', '제목/내용'];
    conHeader.forEach((h, i) => {
        const c = ws2.getCell(row, i + 1);
        c.value = h;
        c.font = { bold: true };
        c.alignment = { horizontal: 'center' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        c.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
        };
    });
    row++;

    if (consultations.length === 0) {
        ws2.mergeCells(`A${row}:D${row}`);
        ws2.getCell(`A${row}`).value = '(상담 내역 없음)';
        ws2.getCell(`A${row}`).alignment = { horizontal: 'center' };
        ws2.getCell(`A${row}`).font = { color: { argb: 'FF9CA3AF' } };
        row++;
    } else {
        consultations.forEach(c => {
            ws2.getCell(row, 1).value = shortDate(c.date || '');
            ws2.getCell(row, 2).value = c.source;
            ws2.getCell(row, 3).value = c.consultantName || '';
            const body = c.title ? `[${c.title}] ${c.content || ''}` : (c.content || '');
            ws2.getCell(row, 4).value = body;
            ws2.getCell(row, 4).alignment = { wrapText: true, vertical: 'top' };
            for (let cc = 1; cc <= 4; cc++) {
                ws2.getCell(row, cc).border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' },
                };
            }
            ws2.getRow(row).height = 30;
            row++;
        });
    }

    // ─── 출석부 기록 섹션 (통합데이터 시트 수식 참조) ───
    row += 1;
    ws2.mergeCells(`A${row}:D${row}`);
    ws2.getCell(`A${row}`).value = '◼ 출석부 기록 (최근 10건)';
    ws2.getCell(`A${row}`).font = { bold: true, size: 12 };
    ws2.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
    row++;

    const attHeader = ['날짜', '반/담임', '출결/시험', '진도·특이사항'];
    attHeader.forEach((h, i) => {
        const c = ws2.getCell(row, i + 1);
        c.value = h;
        c.font = { bold: true };
        c.alignment = { horizontal: 'center' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        c.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
        };
    });
    row++;

    // 통합데이터 시트의 출석 row 는 헤더(1) 다음부터 attRows.length 만큼.
    // 수식으로 직접 참조 → 사용자가 통합데이터 시트를 수정하면 양식도 자동 업데이트.
    const previewCount = Math.min(attRows.length, 10);
    if (previewCount === 0) {
        ws2.mergeCells(`A${row}:D${row}`);
        ws2.getCell(`A${row}`).value = '(출석 기록 없음)';
        ws2.getCell(`A${row}`).alignment = { horizontal: 'center' };
        ws2.getCell(`A${row}`).font = { color: { argb: 'FF9CA3AF' } };
        row++;
    } else {
        for (let i = 0; i < previewCount; i++) {
            const srcRow = i + 2; // 통합데이터 시트의 데이터 시작 row
            // 날짜
            ws2.getCell(row, 1).value = { formula: `통합데이터!B${srcRow}` };
            // 반/담임
            ws2.getCell(row, 2).value = { formula: `통합데이터!G${srcRow}&" / "&통합데이터!C${srcRow}` };
            // 출결/시험
            ws2.getCell(row, 3).value = {
                formula: `통합데이터!H${srcRow}&IF(통합데이터!I${srcRow}<>"", " · 시험 "&통합데이터!I${srcRow}, "")&IF(통합데이터!J${srcRow}<>"", " · 과제 "&통합데이터!J${srcRow}, "")`,
            };
            // 진도/특이사항
            ws2.getCell(row, 4).value = {
                formula: `IF(통합데이터!K${srcRow}<>"", 통합데이터!K${srcRow}, "")&IF(통합데이터!L${srcRow}<>"", " | 과제: "&통합데이터!L${srcRow}, "")&IF(통합데이터!N${srcRow}<>"", " | "&통합데이터!N${srcRow}, "")`,
            };
            ws2.getCell(row, 4).alignment = { wrapText: true, vertical: 'top' };
            for (let cc = 1; cc <= 4; cc++) {
                ws2.getCell(row, cc).border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' },
                };
            }
            row++;
        }
    }

    // 페이지 footer 안내
    row += 1;
    ws2.mergeCells(`A${row}:D${row}`);
    ws2.getCell(`A${row}`).value = '※ 본 보고서는 "통합데이터" 시트를 원본으로 자동 생성됩니다. 인쇄 전 원본 데이터를 검토하세요.';
    ws2.getCell(`A${row}`).font = { size: 9, color: { argb: 'FF6B7280' }, italic: true };
    ws2.getCell(`A${row}`).alignment = { horizontal: 'center' };

    // 다운로드
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const safeName = student.name.replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${safeName}_보고서_${todayDate}.xlsx`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
