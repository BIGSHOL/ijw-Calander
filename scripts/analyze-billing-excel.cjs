/**
 * 수납상세.xlsx 분석 스크립트
 * - 엑셀 파일의 구조를 파악하고 수납 데이터를 분석합니다
 * - BillingRecord 타입에 맞게 변환 가능한지 검토합니다
 */

const XLSX = require('xlsx');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '../data/수납상세.xlsx');

function analyzeBillingExcel() {
  console.log('📊 수납상세 엑셀 파일 분석 중...\n');

  try {
    // 엑셀 파일 읽기
    const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });

    console.log(`📋 시트 목록: ${workbook.SheetNames.join(', ')}\n`);

    // 각 시트 분석
    workbook.SheetNames.forEach((sheetName) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 시트: ${sheetName}`);
      console.log('='.repeat(60));

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (data.length === 0) {
        console.log('⚠️  빈 시트입니다.\n');
        return;
      }

      // 헤더 확인
      const headers = data[0];
      console.log('\n📌 컬럼 헤더:');
      headers.forEach((header, idx) => {
        console.log(`  ${idx + 1}. ${header}`);
      });

      // 데이터 행 수
      const dataRows = data.slice(1).filter(row => row.some(cell => cell !== ''));
      console.log(`\n📊 데이터 행 수: ${dataRows.length}개`);

      // 샘플 데이터 (첫 5개)
      console.log('\n📝 샘플 데이터 (첫 5개):');
      dataRows.slice(0, 5).forEach((row, idx) => {
        console.log(`\n  수납 ${idx + 1}:`);
        headers.forEach((header, colIdx) => {
          const value = row[colIdx];
          if (value !== '' && value !== undefined) {
            console.log(`    ${header}: ${value}`);
          }
        });
      });

      // 컬럼별 데이터 타입 및 샘플값 분석
      console.log('\n📋 컬럼별 상세 분석:');
      headers.forEach((header, colIdx) => {
        const values = dataRows.map(row => row[colIdx]).filter(v => v !== '' && v !== undefined);

        if (values.length === 0) {
          console.log(`\n  ${header}:`);
          console.log(`    - 빈 컬럼`);
          return;
        }

        const uniqueCount = new Set(values).size;
        const sampleValues = [...new Set(values)].slice(0, 10);
        const types = new Set(values.map(v => typeof v));

        console.log(`\n  ${header}:`);
        console.log(`    - 데이터 수: ${values.length}`);
        console.log(`    - 고유값 수: ${uniqueCount}`);
        console.log(`    - 데이터 타입: ${[...types].join(', ')}`);
        console.log(`    - 샘플값: ${sampleValues.join(', ')}`);

        // 숫자형 컬럼 통계
        if (types.has('number')) {
          const numericValues = values.filter(v => typeof v === 'number');
          const sum = numericValues.reduce((a, b) => a + b, 0);
          const avg = sum / numericValues.length;
          const min = Math.min(...numericValues);
          const max = Math.max(...numericValues);

          console.log(`    - 평균: ${avg.toLocaleString()}`);
          console.log(`    - 최소: ${min.toLocaleString()}`);
          console.log(`    - 최대: ${max.toLocaleString()}`);
        }
      });

      // BillingRecord 매핑 제안
      console.log('\n🔄 BillingRecord 타입 매핑 제안:');
      console.log('\n  interface BillingRecord {');

      const mappingSuggestions = [];

      // 학생 정보
      const studentNameColumns = headers.filter(h =>
        h.includes('이름') || h.includes('성명') || h.includes('학생')
      );
      if (studentNameColumns.length > 0) {
        mappingSuggestions.push(`    studentName: "${studentNameColumns[0]}" 컬럼`);
      }

      const gradeColumns = headers.filter(h => h.includes('학년'));
      if (gradeColumns.length > 0) {
        mappingSuggestions.push(`    grade: "${gradeColumns[0]}" 컬럼`);
      }

      const schoolColumns = headers.filter(h => h.includes('학교'));
      if (schoolColumns.length > 0) {
        mappingSuggestions.push(`    school: "${schoolColumns[0]}" 컬럼`);
      }

      // 청구 정보
      const monthColumns = headers.filter(h => h.includes('청구월') || h.includes('월'));
      if (monthColumns.length > 0) {
        mappingSuggestions.push(`    month: "${monthColumns[0]}" 컬럼`);
      }

      const billingNameColumns = headers.filter(h => h.includes('수납명') || h.includes('항목'));
      if (billingNameColumns.length > 0) {
        mappingSuggestions.push(`    billingName: "${billingNameColumns[0]}" 컬럼`);
      }

      // 금액 정보
      const billedAmountColumns = headers.filter(h => h.includes('청구액') || h.includes('청구금액'));
      if (billedAmountColumns.length > 0) {
        mappingSuggestions.push(`    billedAmount: "${billedAmountColumns[0]}" 컬럼`);
      }

      const paidAmountColumns = headers.filter(h => h.includes('납부액') || h.includes('실제') || h.includes('입금'));
      if (paidAmountColumns.length > 0) {
        mappingSuggestions.push(`    paidAmount: "${paidAmountColumns[0]}" 컬럼`);
      }

      const unpaidAmountColumns = headers.filter(h => h.includes('미납') || h.includes('잔액'));
      if (unpaidAmountColumns.length > 0) {
        mappingSuggestions.push(`    unpaidAmount: "${unpaidAmountColumns[0]}" 컬럼`);
      }

      // 상태 정보
      const statusColumns = headers.filter(h => h.includes('상태') || h.includes('수납여부'));
      if (statusColumns.length > 0) {
        mappingSuggestions.push(`    status: "${statusColumns[0]}" 컬럼`);
      }

      const paymentMethodColumns = headers.filter(h => h.includes('결제수단') || h.includes('결제방법'));
      if (paymentMethodColumns.length > 0) {
        mappingSuggestions.push(`    paymentMethod: "${paymentMethodColumns[0]}" 컬럼`);
      }

      const paidDateColumns = headers.filter(h => h.includes('수납일') || h.includes('납부일') || h.includes('입금일'));
      if (paidDateColumns.length > 0) {
        mappingSuggestions.push(`    paidDate: "${paidDateColumns[0]}" 컬럼`);
      }

      mappingSuggestions.forEach(suggestion => {
        console.log(`  ${suggestion}`);
      });

      console.log('  }');

      // 누락된 필드 확인
      console.log('\n⚠️  BillingRecord에 있지만 엑셀에 없는 필드:');
      const requiredFields = [
        'externalStudentId',
        'parentPhone',
        'studentPhone',
        'category',
        'billingDay',
        'discountAmount',
        'pointsUsed',
        'cardCompany',
        'cashReceipt',
        'memo'
      ];

      requiredFields.forEach(field => {
        const found = headers.some(h => h.toLowerCase().includes(field.toLowerCase()));
        if (!found) {
          console.log(`  - ${field} (엑셀에 없음)`);
        }
      });
    });

    console.log('\n\n✅ 분석 완료!\n');
  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    if (error.code === 'ENOENT') {
      console.error(`파일을 찾을 수 없습니다: ${EXCEL_PATH}`);
    }
  }
}

// 실행
analyzeBillingExcel();
