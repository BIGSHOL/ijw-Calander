const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../data/2026 콜앤상담.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('📊 시트 목록:');
workbook.SheetNames.forEach((name, index) => {
  console.log(`${index + 1}. ${name}`);
});

console.log('\n📋 월별 시트 데이터 샘플:');
workbook.SheetNames
  .filter(name => /^\d+월$/.test(name))
  .forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    console.log(`\n[${sheetName}] 총 ${data.length}개 행`);
    if (data.length > 0) {
      console.log('컬럼:', Object.keys(data[0]).join(', '));
      console.log('첫 번째 행 샘플:', JSON.stringify(data[0], null, 2));
    }
  });
