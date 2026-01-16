const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '../data/상담내역.xls');
const outputPath = path.join(__dirname, '../data/consultation-preview.json');

// Enum Helpers
const mapGrade = (raw) => {
    if (!raw) return '기타';
    const normalized = String(raw).trim();
    const map = {
        '초1': '초1', '초2': '초2', '초3': '초3', '초4': '초4', '초5': '초5', '초6': '초6',
        '중1': '중1', '중2': '중2', '중3': '중3',
        '고1': '고1', '고2': '고2', '고3': '고3'
    };
    return map[normalized] || '기타';
};

const mapSubjectFromContent = (content) => {
    if (!content) return '기타';
    const text = String(content);

    // Priority: Brackets first, then specific phrases
    if (text.includes('[수학')) return '수학';
    if (text.includes('[영어')) return '영어';
    if (text.includes('수학 상담')) return '수학';
    if (text.includes('영어 상담')) return '영어';
    // EiE is English
    if (text.includes('EiE')) return '영어';

    // Scan body
    const hasMath = text.includes('수학');
    const hasEng = text.includes('영어');

    if (hasMath && !hasEng) return '수학';
    if (hasEng && !hasMath) return '영어';
    if (hasMath && hasEng) return '수학'; // Default prioritize Math

    return '기타';
};

const mapStatus = (statusCell, subject) => {
    const status = String(statusCell || '').trim();
    if (status === '재원생') {
        if (subject === '수학') return '수학등록';
        if (subject === '영어') return '영어등록';
        return '수학등록'; // Default to Math Registered
    }
    if (status.includes('대기')) return '추후 등록예정';
    if (status.includes('퇴원')) return '미등록';
    if (status.includes('미등록')) return '미등록';
    return '미등록';
};

const parseDate = (cellVal) => {
    if (!cellVal) return '';
    if (cellVal instanceof Date) return cellVal.toISOString().split('T')[0];
    const str = String(cellVal).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    return '';
};

try {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 'A' });

    // Confirmed Mapping:
    // A: No
    // B: Status (재원생)
    // C: Name
    // D: School
    // E: Grade
    // F: ParentPhone
    // K: Counselor (허은진) -> Was header '등록자'
    // L: ConsultationDate -> Was header '상담일' (Serial/Date)
    // P: Notes (Content) -> Source of Subject

    const records = [];
    let currentRecord = null;

    // Check if first row is header
    const firstRow = data[0];
    if (firstRow && firstRow['A'] === 'No') {
        data.shift();
    }

    data.forEach((row, index) => {
        const no = row['A'];

        // New Record
        if (no && !isNaN(parseInt(no))) {
            if (currentRecord) records.push(currentRecord);

            const content = row['P'] || '';
            const subject = mapSubjectFromContent(content);
            const statusStr = row['B'];

            // Build Notes
            let noteContent = '';
            if (row['G']) noteContent += `[원생연락처: ${row['G']}]\n`;
            // J was undefined in debug, skipping
            if (content) noteContent += content;

            currentRecord = {
                id: `migrated_${Date.now()}_${index}`,
                no: no,
                studentName: row['C'] || '',
                consultationPath: '기타', // J missing, default
                schoolName: row['D'] || '',
                grade: mapGrade(row['E']),
                parentPhone: row['F'] || '',
                subject: subject,
                status: mapStatus(statusStr, subject),
                counselor: row['K'] || '미정',
                receiver: 'MakeEdu_Migration',
                registrar: 'MakeEdu_Migration',
                consultationDate: parseDate(row['L']), // Corrected to L
                notes: noteContent.trim(),
                paymentAmount: '',
                paymentDate: '',
                nonRegistrationReason: '',
                followUpDate: '',
                followUpContent: '',
                createdAt: new Date().toISOString(),
                source: 'MakeEdu_Excel'
            };
        } else if (currentRecord) {
            // Append multi-line content
            if (row['P']) {
                currentRecord.notes += '\n' + row['P'];
            }
        }
    });

    if (currentRecord) records.push(currentRecord);

    const validRecords = records.filter(r => r.studentName && r.studentName !== '이름');

    fs.writeFileSync(outputPath, JSON.stringify(validRecords, null, 2));

    console.log(`Successfully parsed ${validRecords.length} records.`);

    // Stats
    const subjectCounts = validRecords.reduce((acc, r) => { acc[r.subject] = (acc[r.subject] || 0) + 1; return acc; }, {});
    const dateSample = validRecords.slice(0, 3).map(r => r.consultationDate);
    const counselorSample = validRecords.slice(0, 3).map(r => r.counselor);

    console.log('\n=== Statistics ===');
    console.log('Subjects:', subjectCounts);
    console.log('Date Sample:', dateSample);
    console.log('Counselor Sample:', counselorSample);

} catch (error) {
    console.error('Error:', error);
}
