/**
 * MakeEdu 상담내역 엑셀 분석 스크립트
 * 엑셀 구조를 파악하고 파싱 전략을 수립합니다.
 */
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../data/상담내역.xls');

// 엑셀 파일 읽기
const workbook = XLSX.readFile(filePath, { cellStyles: true, cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

console.log('=== 엑셀 분석 결과 ===\n');
console.log('시트 이름:', sheetName);

// 범위 확인
const range = XLSX.utils.decode_range(sheet['!ref']);
console.log(`범위: A${range.s.r + 1} ~ ${XLSX.utils.encode_col(range.e.c)}${range.e.r + 1}`);
console.log(`총 행: ${range.e.r + 1}, 총 열: ${range.e.c + 1}\n`);

// 병합된 셀 확인
if (sheet['!merges']) {
    console.log(`병합된 셀 수: ${sheet['!merges'].length}\n`);
}

// 헤더 행 확인 (첫 번째 행)
console.log('=== 헤더 (1행) ===');
const headers = [];
for (let col = 0; col <= range.e.c; col++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[cellAddr];
    const value = cell ? cell.v : '';
    headers.push(value);
    if (value) console.log(`${XLSX.utils.encode_col(col)}: ${value}`);
}

// 데이터 샘플 (처음 50행)
console.log('\n=== 데이터 샘플 (No 컬럼 기준 레코드 탐지) ===');
const records = [];
let currentRecord = null;

for (let row = 1; row <= Math.min(100, range.e.r); row++) {
    // No 컬럼 (A열) 확인
    const noCell = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    const noValue = noCell ? String(noCell.v).trim() : '';

    // 숫자인지 확인 (새 레코드 시작)
    if (noValue && !isNaN(parseInt(noValue))) {
        if (currentRecord) {
            records.push(currentRecord);
        }

        currentRecord = {
            no: parseInt(noValue),
            rowStart: row + 1,
            data: {}
        };

        // 각 컬럼 데이터 수집
        for (let col = 1; col <= range.e.c; col++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
            if (cell && cell.v) {
                const header = headers[col] || `Col${col}`;
                currentRecord.data[header] = cell.v;
            }
        }
    }
}

if (currentRecord) {
    records.push(currentRecord);
}

console.log(`\n총 감지된 레코드 수: ${records.length}\n`);

// 처음 5개 레코드 출력
records.slice(0, 5).forEach((rec, idx) => {
    console.log(`\n--- 레코드 ${idx + 1} (No: ${rec.no}, 행: ${rec.rowStart}) ---`);
    Object.entries(rec.data).forEach(([key, value]) => {
        const displayValue = String(value).substring(0, 50);
        console.log(`  ${key}: ${displayValue}${String(value).length > 50 ? '...' : ''}`);
    });
});

// 컬럼 매핑 제안
console.log('\n\n=== 컬럼 매핑 제안 ===');
const mapping = {
    'No': '(무시)',
    '구분': 'consultationPath (상담경로)',
    '이름': 'studentName',
    '학교': 'schoolName',
    '학년': 'grade',
    '보호자연락처': 'parentPhone',
    '원생연락처': 'studentPhone (추가 필요)',
    '상담구분': 'subject',
    '상담구분2': 'notes에 추가',
    '등원가능성': 'status 매핑',
    '등록일': 'paymentDate',
    '상담일': 'consultationDate',
    '기초상담': 'notes',
};

headers.forEach(h => {
    if (h && mapping[h]) {
        console.log(`  "${h}" -> ${mapping[h]}`);
    } else if (h) {
        console.log(`  "${h}" -> (매핑 필요)`);
    }
});
