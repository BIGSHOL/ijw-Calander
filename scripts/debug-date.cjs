const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../data/상담내역.xls');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 'A' });

    console.log('Sample Data (First 3 rows):');
    data.slice(0, 3).forEach((row, i) => {
        console.log(`[Row ${i}] I (Date?):`, row['I'], 'Type:', typeof row['I']);
        console.log(`[Row ${i}] Keys:`, Object.keys(row).join(', '));
    });

} catch (error) {
    console.error(error);
}
