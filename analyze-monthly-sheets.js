import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 엑셀 파일 읽기
const filePath = path.join(__dirname, 'data', '2026 콜앤상담.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== 월별 시트 분석 (n월 형식만) ===\n');

// n월 형식의 시트만 필터링
const monthlySheets = workbook.SheetNames.filter(name => name.includes('월') && !name.includes('데이터'));
console.log('월별 시트:', monthlySheets);
console.log('\n');

// 각 월별 시트 구조 파악
monthlySheets.forEach((sheetName) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📅 시트: ${sheetName}`);
  console.log('='.repeat(60));

  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  console.log(`\n총 행 수: ${data.length}`);

  // Row 0: 제목 행
  console.log('\n[Row 0] 제목 행:');
  console.log(data[0].filter(cell => cell !== '').join(' | '));

  // Row 1: 실제 헤더 행
  console.log('\n[Row 1] 컬럼 헤더:');
  const headers = data[1] || [];
  const cleanHeaders = headers.map((h, idx) => `[${idx}] ${h}`).filter(h => !h.endsWith(' '));
  console.log(cleanHeaders.join('\n'));

  // 데이터가 있는 행 수 계산 (Row 2부터)
  const dataRows = data.slice(2).filter(row =>
    row.some(cell => cell !== '' && cell !== null && cell !== undefined)
  );
  console.log(`\n실제 데이터 행 수: ${dataRows.length}`);

  // 샘플 데이터 3개 (Row 2, 3, 4)
  console.log('\n📋 샘플 데이터:');
  dataRows.slice(0, 3).forEach((row, idx) => {
    console.log(`\n--- 샘플 ${idx + 1} ---`);
    headers.forEach((header, colIdx) => {
      if (header && row[colIdx] !== '' && row[colIdx] !== null && row[colIdx] !== undefined) {
        console.log(`  ${header}: ${row[colIdx]}`);
      }
    });
  });

  // 컬럼별 데이터 존재 여부 통계
  console.log('\n📊 컬럼별 데이터 존재율:');
  const columnStats = headers.map((header, colIdx) => {
    if (!header) return null;

    const filledCount = dataRows.filter(row => {
      const value = row[colIdx];
      return value !== '' && value !== null && value !== undefined;
    }).length;

    const percentage = dataRows.length > 0 ? ((filledCount / dataRows.length) * 100).toFixed(1) : 0;

    return {
      index: colIdx,
      header,
      filled: filledCount,
      total: dataRows.length,
      percentage: `${percentage}%`
    };
  }).filter(stat => stat !== null && stat.header !== '');

  columnStats.forEach(stat => {
    const bar = '█'.repeat(Math.floor(parseFloat(stat.percentage) / 5));
    console.log(`  [${stat.index}] ${stat.header.padEnd(20)} ${stat.percentage.padStart(6)} ${bar}`);
  });
});

console.log('\n\n' + '='.repeat(60));
console.log('✅ 분석 완료');
console.log('='.repeat(60));
