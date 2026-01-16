/**
 * 원생목록.xlsx를 JSON으로 변환
 * - public/student-migration-data.json 파일로 저장
 * - 브라우저에서 fetch하여 마이그레이션에 사용
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '../data/원생목록.xlsx');
const OUTPUT_PATH = path.join(__dirname, '../public/student-migration-data.json');

console.log('📊 원생목록.xlsx → JSON 변환 중...\n');

try {
  // 엑셀 파일 읽기
  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const worksheet = workbook.Sheets['Sheet0'];

  // JSON으로 변환
  const data = XLSX.utils.sheet_to_json(worksheet, {
    raw: false, // 날짜를 문자열로 변환
    defval: '', // 빈 셀은 빈 문자열
  });

  console.log(`✅ ${data.length}개의 학생 데이터 로드 완료`);

  // 샘플 데이터 출력
  console.log('\n📝 샘플 데이터 (첫 2개):');
  data.slice(0, 2).forEach((row, idx) => {
    console.log(`\n학생 ${idx + 1}:`);
    console.log(JSON.stringify(row, null, 2));
  });

  // JSON 파일로 저장
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`\n✅ JSON 파일 저장 완료: ${OUTPUT_PATH}`);
  console.log(`파일 크기: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(2)} KB`);

  // 영어 수업 통계
  const englishClasses = new Set();
  data.forEach(row => {
    if (row['수업']) {
      const classes = row['수업'].split(',');
      classes.forEach(cls => {
        const trimmed = cls.trim();
        if (trimmed.startsWith('[EiE]')) {
          englishClasses.add(trimmed);
        }
      });
    }
  });

  console.log(`\n📚 영어 수업 종류: ${englishClasses.size}개`);
  console.log('  -', [...englishClasses].sort().join('\n  - '));

  // 학년 통계
  const gradeStats = {};
  data.forEach(row => {
    const grade = row['학년'] || '미정';
    gradeStats[grade] = (gradeStats[grade] || 0) + 1;
  });

  console.log('\n📊 학년별 통계:');
  Object.entries(gradeStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([grade, count]) => {
      console.log(`  ${grade}: ${count}명`);
    });

  console.log('\n✅ 변환 완료!');
  console.log('\n다음 단계:');
  console.log('1. npm run dev로 개발 서버 실행');
  console.log('2. 브라우저 콘솔에서 다음 실행:');
  console.log('   const data = await fetch("/student-migration-data.json").then(r => r.json())');
  console.log('   await migrateStudentsFromExcel(data, true) // DRY RUN');
  console.log('   await migrateStudentsFromExcel(data, false) // 실제 마이그레이션');

} catch (error) {
  console.error('❌ 에러 발생:', error.message);
  if (error.code === 'ENOENT') {
    console.error(`\n파일을 찾을 수 없습니다: ${EXCEL_PATH}`);
  }
  process.exit(1);
}
