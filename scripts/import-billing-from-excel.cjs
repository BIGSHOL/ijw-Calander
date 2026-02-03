/**
 * 수납상세.xlsx → Firebase import 스크립트
 * - 엑셀 파일의 수납 데이터를 Firestore billing 컬렉션으로 import
 */

const XLSX = require('xlsx');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const EXCEL_PATH = path.join(__dirname, '../data/수납상세.xlsx');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../serviceAccountKey.json');

// Firebase Admin 초기화
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

/**
 * 엑셀 날짜를 YYYY-MM-DD 형식으로 변환
 */
function excelDateToString(excelDate) {
  if (!excelDate) return '';

  // 이미 문자열인 경우 (20251229)
  if (typeof excelDate === 'string') {
    if (excelDate.length === 8) {
      return `${excelDate.slice(0, 4)}-${excelDate.slice(4, 6)}-${excelDate.slice(6, 8)}`;
    }
    return excelDate;
  }

  // Excel 날짜 숫자인 경우
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return '';
}

/**
 * 청구월 형식 변환 (202601 → 2026-01)
 */
function formatMonth(monthStr) {
  if (!monthStr) return '';
  const str = String(monthStr);
  if (str.length === 6) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}`;
  }
  return str;
}

/**
 * 수납여부 → status 변환
 */
function convertStatus(statusStr) {
  if (!statusStr) return 'pending';
  if (statusStr.includes('납부') || statusStr.includes('완료')) {
    return 'paid';
  }
  return 'pending';
}

/**
 * 엑셀 행 → BillingRecord 변환
 */
function rowToBillingRecord(row, headers) {
  const getValue = (headerName) => {
    const idx = headers.indexOf(headerName);
    return idx >= 0 ? row[idx] : '';
  };

  const getNumber = (headerName) => {
    const val = getValue(headerName);
    return typeof val === 'number' ? val : (parseFloat(val) || 0);
  };

  const record = {
    // 학생 정보
    externalStudentId: String(getValue('원생고유번호') || ''),
    studentName: String(getValue('이름') || ''),
    grade: String(getValue('학년') || ''),
    school: String(getValue('학교') || ''),
    parentPhone: String(getValue('학부모연락처') || ''),
    studentPhone: String(getValue('원생연락처') || ''),

    // 청구 정보
    category: String(getValue('구분') || ''),
    month: formatMonth(getValue('청구월')),
    billingDay: getNumber('청구일'),
    billingName: String(getValue('수납명') || ''),

    // 금액 정보
    status: convertStatus(getValue('수납여부')),
    billedAmount: getNumber('청구액'),
    discountAmount: getNumber('할인액'),
    pointsUsed: getNumber('적립금사용'),
    paidAmount: getNumber('실제낸금액'),
    unpaidAmount: getNumber('미납금액'),

    // 결제 정보
    paymentMethod: String(getValue('결제수단') || ''),
    cardCompany: String(getValue('카드사') || ''),
    paidDate: excelDateToString(getValue('수납일')),
    cashReceipt: String(getValue('현금영수증') || ''),

    // 기타
    memo: String(getValue('메모') || ''),
    teacher: String(getValue('담임강사') || ''),
    discountReason: String(getValue('할인사유') || ''),
    siblings: String(getValue('형제') || ''),

    // 메타데이터
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: '엑셀 일괄 import',
    updatedBy: '엑셀 일괄 import',
  };

  return record;
}

/**
 * Firestore에 배치로 저장
 */
async function saveBatch(records, batchSize = 450) {
  console.log(`\n📤 Firestore에 저장 중... (총 ${records.length}건)`);

  let saved = 0;
  const batches = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);
    batches.push(chunk);
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = db.batch();
    const chunk = batches[i];

    chunk.forEach((record) => {
      const docRef = db.collection('billing').doc();
      batch.set(docRef, record);
    });

    await batch.commit();
    saved += chunk.length;
    console.log(`  ${saved}/${records.length} 저장 완료 (${((saved / records.length) * 100).toFixed(1)}%)`);
  }

  console.log(`\n✅ 저장 완료: ${saved}건`);
}

/**
 * 메인 함수
 */
async function importBillingFromExcel() {
  console.log('📊 수납상세.xlsx → Firebase import 시작\n');

  try {
    // 1. 엑셀 파일 읽기
    console.log('📖 엑셀 파일 읽는 중...');
    const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (data.length === 0) {
      throw new Error('엑셀 파일이 비어있습니다');
    }

    const headers = data[0];
    const dataRows = data.slice(1).filter(row => row.some(cell => cell !== ''));

    console.log(`  시트: ${sheetName}`);
    console.log(`  헤더: ${headers.length}개`);
    console.log(`  데이터: ${dataRows.length}건\n`);

    // 2. 데이터 변환
    console.log('🔄 데이터 변환 중...');
    const records = dataRows.map((row, idx) => {
      if ((idx + 1) % 100 === 0) {
        console.log(`  ${idx + 1}/${dataRows.length} 변환 중...`);
      }
      return rowToBillingRecord(row, headers);
    });
    console.log(`  변환 완료: ${records.length}건\n`);

    // 3. 샘플 데이터 확인
    console.log('📝 샘플 데이터 (첫 3개):');
    records.slice(0, 3).forEach((record, idx) => {
      console.log(`\n  ${idx + 1}. ${record.studentName} (${record.grade}) - ${record.billingName}`);
      console.log(`     청구월: ${record.month}, 청구액: ${record.billedAmount.toLocaleString()}원`);
      console.log(`     상태: ${record.status}, 담임: ${record.teacher || '없음'}`);
    });

    // 4. 사용자 확인
    console.log(`\n\n⚠️  ${records.length}건의 수납 기록을 Firebase에 저장하시겠습니까?`);
    console.log('   (Ctrl+C로 취소 가능)\n');

    // 5초 대기
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Firestore에 저장
    await saveBatch(records);

    console.log('\n✅ 모든 작업 완료!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 에러 발생:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 실행
importBillingFromExcel();
