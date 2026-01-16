/**
 * 원생목록.xlsx → UnifiedStudent 마이그레이션 스크립트
 *
 * 실행 방법:
 * 1. 개발 환경: npm run dev (vite 실행 후 브라우저 콘솔에서 실행)
 * 2. 또는 이 스크립트를 복사하여 브라우저 콘솔에서 실행
 *
 * 특징:
 * - 기존 학생 이름과 일치하면 데이터 보완 (업데이트)
 * - 새로운 학생이면 추가
 * - 영어 수업 정보만 매핑 (수학은 수동 매핑 필요)
 */

import { collection, doc, setDoc, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent } from '../types';

// 영어 레벨 매핑 (Full Name → Abbreviation)
const ENGLISH_LEVEL_MAP: Record<string, string> = {
  'Dr. Phonics': 'DP',
  'Dr.Phonics': 'DP',
  "Pre Let's": 'PL',
  'Ready To Talk': 'RTT',
  "Let's Talk": 'LT',
  'Ready To Speak': 'RTS',
  "Let's Speak": 'LS',
  "Let's Express": 'LE',
  'Kopi Wang': 'KW',
  'Pre Junior': 'PJ',
  'Junior Plus': 'JP',
  'Middle School English Course': 'MEC',
  // 교재명 매핑
  'PHONICS&ROOKIES': 'DP',
  'ROOKIES&LEADERS': 'PL',
};

// 엑셀에서 추출한 학생 데이터 타입
interface ExcelStudentData {
  이름: string;
  성별: '남' | '여';
  출결번호?: string;
  학교?: string;
  학년?: string;
  원생연락처?: string;
  보호자연락처?: string;
  보호자구분?: string;
  보호자이름?: string;
  기타보호자연락처?: string;
  기타보호자이름?: string;
  입학일?: string;
  주소1?: string;
  주소2?: string;
  메모?: string;
  수업?: string;
  담임강사?: string;
  기타항목1?: string; // M, E, Me 등 (수학/영어 구분)
  원생고유번호?: string;
  등록일?: string;
}

/**
 * 학년을 정규화 (초3, 중1, 고2 등 → 3학년, 중1, 고2)
 */
function normalizeGrade(grade: string): string {
  if (!grade) return '';

  // 초3, 중1, 고2 형식
  if (/^초\d/.test(grade)) {
    return grade.replace('초', '') + '학년';
  }
  if (/^중\d/.test(grade)) {
    return grade; // 중1, 중2 그대로 유지
  }
  if (/^고\d/.test(grade)) {
    return grade; // 고1, 고2 그대로 유지
  }

  return grade;
}

/**
 * 성별을 male/female로 변환
 */
function normalizeGender(gender: string): 'male' | 'female' | undefined {
  if (gender === '남') return 'male';
  if (gender === '여') return 'female';
  return undefined;
}

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 변환
 * 예: "20250122" → "2025-01-22"
 */
function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return '';

  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  return `${year}-${month}-${day}`;
}

/**
 * 수업 정보에서 수강 과목 추출
 * "기타항목1" 컬럼: M (수학), E (영어), ME (둘 다)
 */
function extractSubjects(기타항목1?: string): ('math' | 'english')[] {
  if (!기타항목1) return [];

  const subjects: ('math' | 'english')[] = [];
  const upper = 기타항목1.toUpperCase();

  if (upper.includes('M')) subjects.push('math');
  if (upper.includes('E')) subjects.push('english');

  return subjects;
}

/**
 * 영어 Full Name을 약어로 변환
 * 예: "Dr. Phonics 2" → "DP2"
 */
function convertEnglishClassNameToAbbr(fullName: string): string {
  // 숫자와 알파벳 suffix 추출
  const match = fullName.match(/(\d+)([a-z]?)$/i);
  const number = match ? match[1] : '';
  const suffix = match ? match[2] : '';

  // Full Name에서 레벨 이름 매칭
  for (const [levelName, abbr] of Object.entries(ENGLISH_LEVEL_MAP)) {
    if (fullName.includes(levelName)) {
      return `${abbr}${number}${suffix}`;
    }
  }

  // 매핑 실패 시 원본 반환
  return fullName;
}

/**
 * 수업 정보에서 영어 수업명만 추출하고 약어로 변환
 * 수학 수업은 시간표의 수업명과 차이가 커서 제외 (수동 매핑 필요)
 * 예: "[EiE] Let's Talk 1" → "LT1"
 * 예: "[EiE] 교재 PHONICS&ROOKIES 40,000" → "DP"
 */
function extractEnglishClassNames(수업?: string): string[] {
  if (!수업) return [];

  const classNames: string[] = [];
  const parts = 수업.split(',');

  parts.forEach(part => {
    const trimmed = part.trim();

    // 영어 수업 패턴: "[EiE] Let's Talk 1"
    const englishMatch = trimmed.match(/\[EiE\]\s*(.+)/);
    if (englishMatch) {
      let className = englishMatch[1].trim();

      // "교재 PHONICS&ROOKIES 40,000" 패턴 처리
      if (className.includes('교재')) {
        const bookMatch = className.match(/교재\s+([A-Z&]+)/);
        if (bookMatch) {
          className = bookMatch[1];
        }
      }

      // Full Name을 약어로 변환
      const abbrClassName = convertEnglishClassNameToAbbr(className);
      classNames.push(abbrClassName);
    }
  });

  return [...new Set(classNames)]; // 중복 제거
}

/**
 * 담임강사 정보 추출 (영어 강사만)
 * 예: "김민주,김윤하,이영현(Ellen)" → ["이영현"] (Ellen만 추출)
 */
function extractEnglishTeachers(담임강사?: string): string[] {
  if (!담임강사) return [];

  return 담임강사
    .split(',')
    .map(t => {
      // "이영현(Ellen)" 형식에서 한글 이름 추출
      const match = t.match(/^([가-힣]+)(?:\([^)]+\))?/);
      return match ? match[1] : t.trim();
    })
    .filter(Boolean);
}

/**
 * ExcelStudentData를 UnifiedStudent로 변환
 */
function convertToUnifiedStudent(
  excelData: ExcelStudentData,
  existingStudent?: UnifiedStudent
): UnifiedStudent {
  const now = new Date().toISOString();

  // UUID: 기존 학생이 있으면 그대로 사용, 없으면 원생고유번호 또는 생성
  const id = existingStudent?.id || excelData.원생고유번호 || `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 주소 통합
  const address = [excelData.주소1, excelData.주소2]
    .filter(Boolean)
    .join(' ')
    .trim();

  // 보호자 정보 통합
  const parentName = excelData.보호자이름 || excelData.보호자구분 || existingStudent?.parentName;

  // 영어 수업 정보 추출
  const englishClasses = extractEnglishClassNames(excelData.수업);

  const student: UnifiedStudent = {
    // 기존 데이터 유지 (있으면)
    ...existingStudent,

    // 기본 정보 (덮어쓰기)
    id,
    name: excelData.이름,

    // 영어 이름은 기존 데이터 유지 (엑셀에 없음)
    englishName: existingStudent?.englishName || null,

    // 학교/학년 (엑셀 데이터 우선, 없으면 기존 데이터)
    school: excelData.학교 || existingStudent?.school,
    grade: excelData.학년 ? normalizeGrade(excelData.학년) : existingStudent?.grade,

    // 성별
    gender: normalizeGender(excelData.성별) || existingStudent?.gender,

    // 연락처 정보 (엑셀 데이터 우선)
    studentPhone: excelData.원생연락처 || existingStudent?.studentPhone,
    parentPhone: excelData.보호자연락처 || existingStudent?.parentPhone,
    parentPhone2: excelData.기타보호자연락처 || existingStudent?.parentPhone2,

    // 보호자 정보
    parentName,

    // 주소
    address: address || existingStudent?.address,

    // 메모 (엑셀 메모 추가, 기존 메모 유지)
    memo: excelData.메모
      ? existingStudent?.memo
        ? `${existingStudent.memo}\n\n[엑셀 마이그레이션]\n${excelData.메모}`
        : excelData.메모
      : existingStudent?.memo,

    // 수강 정보 (엑셀 데이터로 업데이트)
    subjects: extractSubjects(excelData.기타항목1),

    // 재원 상태 (엑셀 데이터 우선, 없으면 기존 데이터)
    status: existingStudent?.status || 'active',

    // 입학일 (엑셀 데이터 우선)
    enrollmentDate: excelData.입학일 ? formatDate(excelData.입학일) : existingStudent?.enrollmentDate,

    // 메타데이터
    createdAt: existingStudent?.createdAt || now,
    updatedAt: now,
    source: existingStudent ? 'excel_migration_update' : 'excel_migration_new',
    legacyId: excelData.출결번호 || excelData.원생고유번호 || existingStudent?.legacyId,

    // 영어 수업 정보 (추가)
    _excelEnglishClasses: englishClasses.length > 0 ? englishClasses : undefined,
  } as any;

  return student;
}

/**
 * Firebase에 학생 데이터 마이그레이션
 */
export async function migrateStudentsToFirebase(
  excelData: ExcelStudentData[],
  dryRun: boolean = true
): Promise<void> {
  console.log('📊 학생 데이터 마이그레이션 시작...');
  console.log(`모드: ${dryRun ? 'DRY RUN (미리보기)' : 'LIVE (실제 저장)'}\n`);

  const studentsRef = collection(db, 'students');

  // 1. 기존 학생 데이터 로드
  console.log('📝 1단계: 기존 학생 데이터 로드 중...');
  const existingSnapshot = await getDocs(studentsRef);
  const existingStudentsMap = new Map<string, UnifiedStudent>();

  existingSnapshot.forEach(doc => {
    const student = doc.data() as UnifiedStudent;
    existingStudentsMap.set(student.name, student);
  });

  console.log(`✅ 기존 학생 ${existingStudentsMap.size}명 로드 완료`);

  // 2. 데이터 변환
  console.log('\n📝 2단계: 데이터 변환 중...');
  const convertedStudents: UnifiedStudent[] = [];
  const errors: { index: number; name: string; error: string }[] = [];
  let newCount = 0;
  let updateCount = 0;

  excelData.forEach((data, index) => {
    try {
      const existingStudent = existingStudentsMap.get(data.이름);
      const student = convertToUnifiedStudent(data, existingStudent);

      if (existingStudent) {
        updateCount++;
      } else {
        newCount++;
      }

      convertedStudents.push(student);
    } catch (error: any) {
      errors.push({
        index,
        name: data.이름,
        error: error.message,
      });
    }
  });

  console.log(`✅ 변환 완료: 총 ${convertedStudents.length}명`);
  console.log(`   - 신규 학생: ${newCount}명`);
  console.log(`   - 기존 학생 업데이트: ${updateCount}명`);

  if (errors.length > 0) {
    console.log(`⚠️  변환 실패: ${errors.length}명`);
    errors.forEach(err => {
      console.log(`  - [${err.index}] ${err.name}: ${err.error}`);
    });
  }

  // 3. 샘플 데이터 미리보기
  console.log('\n📋 3단계: 샘플 데이터 미리보기');

  // 신규 학생 샘플
  const newStudents = convertedStudents.filter(s => s.source === 'excel_migration_new');
  if (newStudents.length > 0) {
    console.log('\n🆕 신규 학생 (첫 2명):');
    newStudents.slice(0, 2).forEach((student, idx) => {
      console.log(`\n학생 ${idx + 1}: ${student.name}`);
      console.log(JSON.stringify(student, null, 2));
    });
  }

  // 업데이트 학생 샘플
  const updatedStudents = convertedStudents.filter(s => s.source === 'excel_migration_update');
  if (updatedStudents.length > 0) {
    console.log('\n🔄 업데이트 학생 (첫 2명):');
    updatedStudents.slice(0, 2).forEach((student, idx) => {
      console.log(`\n학생 ${idx + 1}: ${student.name}`);
      console.log(JSON.stringify(student, null, 2));
    });
  }

  // 4. 통계
  console.log('\n📊 4단계: 마이그레이션 통계');
  const stats = {
    total: convertedStudents.length,
    new: newCount,
    update: updateCount,
    withPhone: convertedStudents.filter(s => s.studentPhone).length,
    withParentPhone: convertedStudents.filter(s => s.parentPhone).length,
    withSchool: convertedStudents.filter(s => s.school).length,
    withGrade: convertedStudents.filter(s => s.grade).length,
    mathStudents: convertedStudents.filter(s => s.subjects?.includes('math')).length,
    englishStudents: convertedStudents.filter(s => s.subjects?.includes('english')).length,
    bothSubjects: convertedStudents.filter(s =>
      s.subjects?.includes('math') && s.subjects?.includes('english')
    ).length,
    withEnglishClasses: convertedStudents.filter(s => (s as any)._excelEnglishClasses?.length > 0).length,
  };

  console.log(`  총 학생 수: ${stats.total}명`);
  console.log(`  신규 추가: ${stats.new}명`);
  console.log(`  기존 업데이트: ${stats.update}명`);
  console.log(`  학생 연락처 보유: ${stats.withPhone}명 (${(stats.withPhone/stats.total*100).toFixed(1)}%)`);
  console.log(`  보호자 연락처 보유: ${stats.withParentPhone}명 (${(stats.withParentPhone/stats.total*100).toFixed(1)}%)`);
  console.log(`  학교 정보 보유: ${stats.withSchool}명 (${(stats.withSchool/stats.total*100).toFixed(1)}%)`);
  console.log(`  학년 정보 보유: ${stats.withGrade}명 (${(stats.withGrade/stats.total*100).toFixed(1)}%)`);
  console.log(`  수학 수강생: ${stats.mathStudents}명`);
  console.log(`  영어 수강생: ${stats.englishStudents}명`);
  console.log(`  수학+영어 수강생: ${stats.bothSubjects}명`);
  console.log(`  영어 수업 정보 보유: ${stats.withEnglishClasses}명`);

  // 영어 수업 목록
  const allEnglishClasses = new Set<string>();
  convertedStudents.forEach(s => {
    const classes = (s as any)._excelEnglishClasses as string[] | undefined;
    if (classes) {
      classes.forEach(c => allEnglishClasses.add(c));
    }
  });
  console.log(`\n  📚 추출된 영어 수업 종류: ${allEnglishClasses.size}개`);
  if (allEnglishClasses.size > 0) {
    console.log(`     ${[...allEnglishClasses].sort().join(', ')}`);
  }

  if (dryRun) {
    console.log('\n⚠️  DRY RUN 모드: 실제 저장하지 않았습니다.');
    console.log('실제 마이그레이션을 실행하려면 dryRun: false로 설정하세요.');
    return;
  }

  // 5. Firebase에 저장
  console.log('\n💾 5단계: Firebase에 저장 중...');

  const batchSize = 500;
  const batches = Math.ceil(convertedStudents.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const batch = writeBatch(db);
    const start = i * batchSize;
    const end = Math.min(start + batchSize, convertedStudents.length);
    const batchStudents = convertedStudents.slice(start, end);

    console.log(`  배치 ${i + 1}/${batches}: ${batchStudents.length}명 저장 중...`);

    batchStudents.forEach(student => {
      const docRef = doc(studentsRef, student.id);
      batch.set(docRef, student, { merge: true }); // merge: true로 기존 데이터 보존
    });

    await batch.commit();
    console.log(`  ✅ 배치 ${i + 1} 완료`);
  }

  console.log('\n✅ 마이그레이션 완료!');
  console.log(`신규: ${newCount}명, 업데이트: ${updateCount}명`);
}

/**
 * 브라우저 콘솔에서 실행할 함수
 */
export async function migrateStudentsFromExcel(
  excelData: ExcelStudentData[],
  dryRun: boolean = true
): Promise<void> {
  await migrateStudentsToFirebase(excelData, dryRun);
}

export default migrateStudentsFromExcel;
