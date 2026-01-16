const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../data/상담내역.xls');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 'A' });

    console.log('Searching for No="1"...');

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row['A'] == '1') {
            console.log(`\n=== Found No="1" at Row Index ${i} ===`);
            ['H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach(col => {
                const val = row[col];
                console.log(`  ${col}: [${typeof val}] ${val}`);
            });
            break;
        }
    }

} catch (error) {
    console.error(error);
}
