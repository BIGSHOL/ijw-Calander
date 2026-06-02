/**
 * 신입생 모달 — 브라우저 직접 인쇄(window.print) 유틸.
 *
 * 새 창에 A4 인쇄용 HTML 을 그린 뒤 자동으로 print() 호출.
 * 학생의 attendance_records + 상담 + 수강내역을 표 형태로 한 페이지에 정리.
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
    date: string;
    className: string;
    teacher: string;
    status: string;
    examInfo: string;
    assignmentScore: string;
    progress: string;
    classwork: string;
    attitude: string;
    notes: string;
}

const STATUS_LABEL: Record<number, string> = { 1: '출석', 2: '지각', 0: '결석' };

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

const isNonEmpty = (r: AttendanceCellRow): boolean =>
    !!(r.status || r.examInfo || r.assignmentScore || r.progress || r.classwork || r.attitude || r.notes);

const esc = (s: string | undefined): string => {
    if (!s) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const shortDate = (d: string): string => (d && d.length >= 10 ? d.slice(2, 10) : (d || ''));

function buildHTML(params: {
    student: PrintStudent;
    consultations: PrintConsultation[];
    enrollments: PrintEnrollment[];
    attRows: AttendanceCellRow[];
    todayDate: string;
}): string {
    const { student, consultations, enrollments, attRows, todayDate } = params;

    const styles = `
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #000; margin: 0; padding: 0; font-size: 11px; line-height: 1.4; }
        .wrap { width: 100%; max-width: 190mm; margin: 0 auto; }
        h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
        .subtitle { text-align: center; font-size: 10px; color: #555; margin-bottom: 12px; }
        .meta { text-align: right; font-size: 10px; color: #555; margin-bottom: 8px; }
        h2 { font-size: 13px; margin: 14px 0 6px; padding: 4px 8px; background: #f3f4f6; border-left: 4px solid #374151; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; font-size: 10.5px; }
        th { background: #f3f4f6; font-weight: bold; text-align: center; }
        .info-key { background: #f9fafb; font-weight: bold; width: 22%; text-align: center; }
        .empty { color: #9ca3af; text-align: center; font-style: italic; padding: 8px; }
        .nowrap { white-space: nowrap; }
        .center { text-align: center; }
        .footer-note { margin-top: 16px; font-size: 9px; color: #6b7280; text-align: center; font-style: italic; }
        .btn-bar { padding: 12px; text-align: center; background: #f3f4f6; border-bottom: 1px solid #ddd; position: sticky; top: 0; z-index: 10; }
        .btn-bar button { padding: 8px 24px; font-size: 14px; font-weight: bold; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 0 4px; }
        .btn-bar button.secondary { background: #6b7280; }
        @media print { .btn-bar { display: none; } body { padding: 0; } }
    `;

    const enrollmentRows = enrollments.length === 0
        ? `<tr><td colspan="4" class="empty">수강 내역 없음</td></tr>`
        : enrollments.map(e => `
            <tr>
                <td class="nowrap center">${esc(shortDate(e.startDate || ''))}</td>
                <td>${esc(e.className)}</td>
                <td class="center">${esc(e.groupLabel || e.subject)}</td>
                <td class="center">${esc(e.teacher || '')}</td>
            </tr>
        `).join('');

    const consultationRows = consultations.length === 0
        ? `<tr><td colspan="4" class="empty">상담 내역 없음</td></tr>`
        : consultations.map(c => {
            const body = c.title
                ? `<b>${esc(c.title)}</b>${c.content ? '<br/>' + esc(c.content).replace(/\n/g, '<br/>') : ''}`
                : esc(c.content || '').replace(/\n/g, '<br/>');
            return `
                <tr>
                    <td class="nowrap center">${esc(shortDate(c.date || ''))}</td>
                    <td class="center">${esc(c.source)}</td>
                    <td class="center">${esc(c.consultantName || '')}</td>
                    <td>${body}</td>
                </tr>
            `;
        }).join('');

    const attendanceRows = attRows.length === 0
        ? `<tr><td colspan="7" class="empty">출석 기록 없음</td></tr>`
        : attRows.map(r => `
            <tr>
                <td class="nowrap center">${esc(shortDate(r.date))}</td>
                <td>${esc(r.className)}</td>
                <td class="center">${esc(r.teacher)}</td>
                <td class="center">${esc(r.status)}</td>
                <td class="center">${esc(r.examInfo)}${r.assignmentScore ? ' / 과제 ' + esc(r.assignmentScore) : ''}</td>
                <td>${esc(r.progress)}${r.classwork ? ' / 과제: ' + esc(r.classwork) : ''}</td>
                <td>${esc(r.attitude)}${r.notes ? ' ' + esc(r.notes) : ''}</td>
            </tr>
        `).join('');

    return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(student.name)} 학생 보고서 - ${todayDate}</title>
<style>${styles}</style>
</head>
<body>
<div class="btn-bar">
    <button onclick="window.print()">🖨️ 인쇄</button>
    <button class="secondary" onclick="window.close()">닫기</button>
</div>
<div class="wrap">
    <h1>강의하는 아이들 연세학원</h1>
    <div class="subtitle">학생 보고서</div>
    <div class="meta">발행일: ${todayDate}</div>

    <table>
        <tr>
            <td class="info-key">학생명</td><td>${esc(student.name)}</td>
            <td class="info-key">학교</td><td>${esc(student.school || '-')}</td>
        </tr>
        <tr>
            <td class="info-key">학년</td><td>${esc(student.grade || '-')}</td>
            <td class="info-key">학부모</td><td>${esc(student.parentName || '-')}</td>
        </tr>
        <tr>
            <td class="info-key">학부모 연락처</td><td>${esc(student.parentPhone || '-')}</td>
            <td class="info-key">본인 연락처</td><td>${esc(student.studentPhone || '-')}</td>
        </tr>
    </table>

    <h2>◼ 수강내역 (${enrollments.length}건)</h2>
    <table>
        <thead>
            <tr><th style="width:80px">시작일</th><th>반</th><th style="width:80px">과목</th><th style="width:80px">담임</th></tr>
        </thead>
        <tbody>${enrollmentRows}</tbody>
    </table>

    <h2>◼ 상담 내역 (${consultations.length}건)</h2>
    <table>
        <thead>
            <tr><th style="width:80px">날짜</th><th style="width:60px">구분</th><th style="width:70px">상담자</th><th>제목 / 내용</th></tr>
        </thead>
        <tbody>${consultationRows}</tbody>
    </table>

    <div class="footer-note">※ 본 보고서는 시스템에서 자동 생성되었습니다.</div>
</div>
<script>
    window.addEventListener('load', function() {
        setTimeout(function() { window.print(); }, 300);
    });
</script>
</body>
</html>`;
}

export async function printNewStudentDirect(params: {
    student: PrintStudent;
    consultations: PrintConsultation[];
    enrollments: PrintEnrollment[];
    todayDate: string;
}): Promise<void> {
    const { student, consultations, enrollments, todayDate } = params;

    const teacherMap = new Map<string, string>();
    enrollments.forEach(e => {
        if (e.className && e.teacher && !teacherMap.has(e.className)) {
            teacherMap.set(e.className, e.teacher);
        }
    });

    const attRowsAll = await fetchAttendanceRows(student.id, teacherMap);
    const attRows = attRowsAll.filter(isNonEmpty);

    const html = buildHTML({ student, consultations, enrollments, attRows, todayDate });

    const w = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
    if (!w) {
        alert('팝업이 차단되어 인쇄창을 열 수 없습니다.\n브라우저 주소창의 팝업 차단 아이콘에서 허용 후 다시 시도해주세요.');
        return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
}