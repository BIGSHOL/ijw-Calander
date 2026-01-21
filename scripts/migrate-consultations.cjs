const XLSX = require('xlsx');
const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin 초기화
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 학년 매핑
function mapGrade(raw) {
  if (!raw) return '기타';
  const str = String(raw).trim();

  // 패턴: "종로초3" → "초3", "일중3" → "중3"
  if (str.includes('초')) return str.match(/초(\d)/) ? `초${str.match(/초(\d)/)[1]}` : '초등';
  if (str.includes('중')) return str.match(/중(\d)/) ? `중${str.match(/중(\d)/)[1]}` : '중등';
  if (str.includes('고')) return str.match(/고(\d)/) ? `고${str.match(/고(\d)/)[1]}` : '고등';

  return '기타';
}

// 학교 추출
function extractSchool(raw) {
  if (!raw) return '';
  const str = String(raw).trim();

  // "종로초3" → "종로초등학교"
  const match = str.match(/^([가-힣]+)[초중고]/);
  if (match) {
    if (str.includes('초')) return match[1] + '초등학교';
    if (str.includes('중')) return match[1] + '중학교';
    if (str.includes('고')) return match[1] + '고등학교';
  }

  return str;
}

// 과목 매핑
function mapSubject(raw) {
  if (!raw) return '기타';
  const str = String(raw).toUpperCase();

  if (str.includes('EIE') || str.includes('영어') || str.includes('ENGLISH')) return 'English';
  if (str.includes('수학') || str.includes('MATH')) return 'Math';

  return '기타';
}

// 등록여부 매핑
function mapStatus(raw) {
  if (!raw) return '미등록';
  const str = String(raw).trim();

  if (str.includes('영어등록')) return '영어등록';
  if (str.includes('수학등록')) return '수학등록';
  if (str.includes('영수등록')) return '영수등록';
  if (str.includes('미등록')) return '미등록';
  if (str.includes('이번달') || str.includes('등록예정')) return '이번달 등록예정';
  if (str.includes('추후')) return '추후 등록예정';

  return str || '미등록';
}

// 날짜 변환
function parseDate(raw, yearMonth) {
  if (!raw) return '';

  const str = String(raw).trim();

  // "2026.01.03" 형식
  if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(str)) {
    const [year, month, day] = str.split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 숫자 (1.03 = 1월 3일)
  if (typeof raw === 'number') {
    const [month, day] = String(raw).split('.');
    const year = yearMonth.split('-')[0];
    return `${year}-${month.padStart(2, '0')}-${(day || '01').padStart(2, '0')}`;
  }

  return '';
}

// 메인 마이그레이션 함수
async function migrateConsultations() {
  console.log('🚀 등록 상담 마이그레이션 시작...\n');

  const filePath = path.join(__dirname, '../data/2026 콜앤상담.xlsx');
  const workbook = XLSX.readFile(filePath);

  // 기존 상담 기록 로드 (중복 체크용)
  console.log('📥 기존 상담 기록 로딩...');
  const existingSnapshot = await db.collection('consultations').get();
  const existingKeys = new Set();

  existingSnapshot.docs.forEach(doc => {
    const data = doc.data();
    // 중복 키: 이름_상담일_내용앞50자
    const key = `${data.studentName}_${data.consultationDate}_${(data.notes || '').substring(0, 50)}`;
    existingKeys.add(key);
  });

  console.log(`✅ 기존 상담 기록 ${existingKeys.size}개 확인\n`);

  // 월별 시트 필터링
  const monthSheets = workbook.SheetNames.filter(name => /^\d+월$/.test(name));
  console.log(`📋 처리할 시트: ${monthSheets.join(', ')}\n`);

  let totalRecords = 0;
  let newRecords = 0;
  let skippedRecords = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const sheetName of monthSheets) {
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

    // 월 추출 (예: "1월" → "2026-01")
    const monthNum = sheetName.replace('월', '').padStart(2, '0');
    const yearMonth = `2026-${monthNum}`;

    console.log(`\n📅 [${sheetName}] 처리 중...`);

    // Row 0: 빈 행, Row 1: 헤더, Row 2+: 데이터
    const dataRows = rawData.slice(2);

    for (const row of dataRows) {
      // 빈 행 스킵
      if (!row[3] || row[3] === '') continue; // 이름 없으면 스킵

      totalRecords++;

      const studentName = String(row[3] || '').trim();
      const consultationDate = parseDate(row[6], yearMonth) || parseDate(row[1], yearMonth);
      const notes = String(row[15] || '').trim();

      // 중복 체크
      const key = `${studentName}_${consultationDate}_${notes.substring(0, 50)}`;
      if (existingKeys.has(key)) {
        skippedRecords++;
        console.log(`  ⏭️  중복 스킵: ${studentName} (${consultationDate})`);
        continue;
      }

      // 문서 ID 생성
      const timestamp = Date.now().toString(36);
      const docId = `${consultationDate.replace(/-/g, '')}_${studentName}_${timestamp}`;

      const record = {
        // 학생 정보
        studentName,
        schoolName: extractSchool(row[4]),
        grade: mapGrade(row[4]),
        address: String(row[5] || '').trim(),
        parentPhone: '', // 엑셀에 없음

        // 상담 정보
        consultationDate: consultationDate + 'T00:00:00.000Z',
        subject: mapSubject(row[7]),
        counselor: String(row[8] || '').trim(),
        receiver: String(row[2] || '').trim(),

        // 등록 정보
        status: mapStatus(row[9]),
        registrar: String(row[11] || '').trim(),
        paymentAmount: String(row[12] || ''),
        paymentDate: parseDate(row[14], yearMonth) ? parseDate(row[14], yearMonth) + 'T00:00:00.000Z' : '',

        // 상담 내용
        notes,
        nonRegistrationReason: String(row[16] || '').trim(),
        followUpDate: parseDate(row[17], yearMonth) ? parseDate(row[17], yearMonth) + 'T00:00:00.000Z' : '',
        followUpContent: String(row[18] || '').trim(),
        consultationPath: String(row[19] || '').trim(),

        // 메타데이터
        createdAt: parseDate(row[1], yearMonth) + 'T00:00:00.000Z',
        updatedAt: new Date().toISOString()
      };

      const docRef = db.collection('consultations').doc(docId);
      batch.set(docRef, record);
      batchCount++;
      newRecords++;

      console.log(`  ✅ 추가: ${studentName} (${consultationDate})`);

      // Firestore batch limit: 500
      if (batchCount >= 450) {
        await batch.commit();
        console.log(`\n💾 ${batchCount}개 배치 저장 완료`);
        batchCount = 0;
      }
    }
  }

  // 남은 배치 커밋
  if (batchCount > 0) {
    await batch.commit();
    console.log(`\n💾 ${batchCount}개 최종 배치 저장 완료`);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✨ 마이그레이션 완료!`);
  console.log(`   총 레코드: ${totalRecords}개`);
  console.log(`   신규 추가: ${newRecords}개`);
  console.log(`   중복 스킵: ${skippedRecords}개`);
  console.log('='.repeat(50));
}

// 실행
migrateConsultations()
  .then(() => {
    console.log('\n✅ 성공적으로 완료되었습니다.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  });
