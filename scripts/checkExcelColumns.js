/**
 * Excel 파일의 컬럼 구조 확인 스크립트
 */

import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const excelPath = path.join(__dirname, '../data/원생목록.xlsx');

try {
  console.log('📂 Excel 파일 읽는 중:', excelPath);

  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  console.log('\n📋 시트명:', sheetName);

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

  console.log('\n📊 총 데이터 개수:', data.length, '명\n');

  if (data.length > 0) {
    console.log('📝 컬럼 목록:');
    const columns = Object.keys(data[0]);
    columns.forEach((col, idx) => {
      console.log(`   ${idx + 1}. ${col}`);
    });

    console.log('\n📌 출결번호 컬럼 존재 여부:', columns.includes('출결번호') ? '✅ 있음' : '❌ 없음');

    console.log('\n📄 샘플 데이터 (처음 3개):');
    data.slice(0, 3).forEach((row, idx) => {
      console.log(`\n${idx + 1}번째 학생:`);
      console.log(`   - 이름: ${row['이름']}`);
      console.log(`   - 학교: ${row['학교']}`);
      console.log(`   - 학년: ${row['학년']}`);
      console.log(`   - 보호자연락처: ${row['보호자연락처']}`);
      console.log(`   - 출결번호: ${row['출결번호'] || '(없음)'}`);
    });
  }
} catch (error) {
  console.error('❌ 오류:', error.message);
}
