import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 엑셀 파일 읽기
const filePath = path.join(__dirname, 'data', '2026 콜앤상담.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== 엑셀 파일 분석 ===\n');
console.log('시트 목록:', workbook.SheetNames);
console.log('\n');

// 각 시트 분석
workbook.SheetNames.forEach((sheetName) => {
  console.log(`\n=== 시트: ${sheetName} ===`);
  const worksheet = workbook.Sheets[sheetName];

  // 시트를 JSON으로 변환 (헤더 포함)
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  console.log(`총 행 수: ${data.length}`);

  if (data.length > 0) {
    console.log('\n첫 5개 행:');
    data.slice(0, 5).forEach((row, idx) => {
      console.log(`Row ${idx}:`, row);
    });

    // 헤더 분석 (첫 번째 행)
    if (data.length > 0) {
      console.log('\n헤더 (첫 번째 행):');
      console.log(data[0]);

      // 컬럼 개수
      console.log(`\n컬럼 개수: ${data[0].length}`);
    }

    // 데이터가 있는 행 찾기
    const dataRows = data.filter((row, idx) => {
      if (idx === 0) return false; // 헤더 제외
      return row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    });

    console.log(`\n데이터가 있는 행 수 (헤더 제외): ${dataRows.length}`);

    // 샘플 데이터 (첫 3개)
    if (dataRows.length > 0) {
      console.log('\n샘플 데이터 (처음 3개):');
      dataRows.slice(0, 3).forEach((row, idx) => {
        console.log(`\nData ${idx + 1}:`);
        data[0].forEach((header, colIdx) => {
          if (row[colIdx]) {
            console.log(`  ${header}: ${row[colIdx]}`);
          }
        });
      });
    }
  }

  console.log('\n' + '='.repeat(50));
});

console.log('\n\n=== 분석 완료 ===');
