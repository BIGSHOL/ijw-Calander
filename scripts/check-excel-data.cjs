const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../data/2026 콜앤상담.xlsx');
const workbook = XLSX.readFile(filePath);

workbook.SheetNames
  .filter(name => /^\d+월$/.test(name))
  .slice(0, 1) // 1월만 확인
  .forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

    console.log(`\n[${sheetName}] 실제 데이터:`);
    console.log('헤더 (row 0):', data[0]);
    console.log('\n데이터 샘플 (row 1-3):');
    data.slice(1, 4).forEach((row, idx) => {
      console.log(`\nRow ${idx + 1}:`, row);
    });
  });
