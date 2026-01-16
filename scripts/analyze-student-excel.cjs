/**
 * 원생목록.xlsx 분석 스크립트
 * - 엑셀 파일의 구조를 파악하고 학생 데이터를 분석합니다
 * - UnifiedStudent 타입에 맞게 변환 가능한지 검토합니다
 */

const XLSX = require('xlsx');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '../data/원생목록.xlsx');

function analyzeStudentExcel() {
  console.log('📊 원생목록 엑셀 파일 분석 중...\n');

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

      // 샘플 데이터 (첫 3개)
      console.log('\n📝 샘플 데이터 (첫 3개):');
      dataRows.slice(0, 3).forEach((row, idx) => {
        console.log(`\n  학생 ${idx + 1}:`);
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
        const sampleValues = [...new Set(values)].slice(0, 5);
        const types = new Set(values.map(v => typeof v));

        console.log(`\n  ${header}:`);
        console.log(`    - 데이터 수: ${values.length}`);
        console.log(`    - 고유값 수: ${uniqueCount}`);
        console.log(`    - 데이터 타입: ${[...types].join(', ')}`);
        console.log(`    - 샘플값: ${sampleValues.join(', ')}`);
      });

      // UnifiedStudent 매핑 제안
      console.log('\n🔄 UnifiedStudent 타입 매핑 제안:');
      console.log('\n  interface UnifiedStudent {');

      const mappingSuggestions = [];

      // 이름 관련
      const nameColumns = headers.filter(h =>
        h.includes('이름') || h.includes('성명') || h.includes('학생')
      );
      if (nameColumns.length > 0) {
        mappingSuggestions.push(`    name: "${nameColumns[0]}" 컬럼`);
      }

      // 영어 이름
      const englishNameColumns = headers.filter(h =>
        h.includes('영어') && h.includes('이름')
      );
      if (englishNameColumns.length > 0) {
        mappingSuggestions.push(`    englishName: "${englishNameColumns[0]}" 컬럼`);
      }

      // 학교
      const schoolColumns = headers.filter(h => h.includes('학교'));
      if (schoolColumns.length > 0) {
        mappingSuggestions.push(`    school: "${schoolColumns[0]}" 컬럼`);
      }

      // 학년
      const gradeColumns = headers.filter(h => h.includes('학년'));
      if (gradeColumns.length > 0) {
        mappingSuggestions.push(`    grade: "${gradeColumns[0]}" 컬럼`);
      }

      // 성별
      const genderColumns = headers.filter(h => h.includes('성별'));
      if (genderColumns.length > 0) {
        mappingSuggestions.push(`    gender: "${genderColumns[0]}" 컬럼`);
      }

      // 연락처
      const phoneColumns = headers.filter(h =>
        h.includes('전화') || h.includes('연락처') || h.includes('휴대폰') || h.includes('핸드폰')
      );
      phoneColumns.forEach(col => {
        if (col.includes('학생') || col.includes('본인')) {
          mappingSuggestions.push(`    studentPhone: "${col}" 컬럼`);
        } else if (col.includes('부모') || col.includes('보호자')) {
          mappingSuggestions.push(`    parentPhone: "${col}" 컬럼`);
        }
      });

      // 주소
      const addressColumns = headers.filter(h => h.includes('주소'));
      if (addressColumns.length > 0) {
        mappingSuggestions.push(`    address: "${addressColumns[0]}" 컬럼`);
      }

      // 메모
      const memoColumns = headers.filter(h =>
        h.includes('메모') || h.includes('비고') || h.includes('특이사항')
      );
      if (memoColumns.length > 0) {
        mappingSuggestions.push(`    memo: "${memoColumns[0]}" 컬럼`);
      }

      mappingSuggestions.forEach(suggestion => {
        console.log(`  ${suggestion}`);
      });

      console.log('  }');

      // 매핑되지 않은 컬럼
      const mappedColumns = new Set();
      mappingSuggestions.forEach(s => {
        const match = s.match(/"([^"]+)"/);
        if (match) mappedColumns.add(match[1]);
      });

      const unmappedColumns = headers.filter(h => !mappedColumns.has(h) && h !== '');
      if (unmappedColumns.length > 0) {
        console.log('\n  ⚠️  매핑되지 않은 컬럼:');
        unmappedColumns.forEach(col => {
          console.log(`    - ${col}`);
        });
      }
    });

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ 분석 완료');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    if (error.code === 'ENOENT') {
      console.error(`\n파일을 찾을 수 없습니다: ${EXCEL_PATH}`);
    }
    process.exit(1);
  }
}

// 실행
analyzeStudentExcel();
