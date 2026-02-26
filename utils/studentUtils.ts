/**
 * 학생 관련 유틸리티 함수
 */

/**
 * 학년에서 숫자만 추출
 * "초3" -> "3", "중1" -> "1", "고2" -> "2", "3" -> "3"
 */
export const getGradeNumber = (grade: string | undefined | null): string => {
  if (!grade) return '';
  const match = grade.match(/\d+/);
  return match ? match[0] : grade;
};

/**
 * 학교명에서 학교 레벨(초등/중등/고등) 추출
 * "대명초" -> "초등", "경북중" -> "중등", "대구고" -> "고등"
 */
export const getSchoolLevel = (school: string | undefined | null): '초등' | '중등' | '고등' | null => {
  if (!school) return null;
  if (school.includes('초등') || school.includes('초')) return '초등';
  if (school.includes('중학') || school.includes('중')) return '중등';
  if (school.includes('고등') || school.includes('고')) return '고등';
  return null;
};

/**
 * 학년에서 레벨(초/중/고) 추출
 * "초3" -> "초", "중1" -> "중", "고2" -> "고", "3" -> ""
 */
export const getGradeLevel = (grade: string | undefined | null): string => {
  if (!grade) return '';
  if (grade.startsWith('초') || grade.includes('초등')) return '초';
  if (grade.startsWith('중') || grade.includes('중학')) return '중';
  if (grade.startsWith('고') || grade.includes('고등')) return '고';
  return '';
};

/**
 * 학교명 + 학년 포맷팅 (중복 레벨 방지)
 *
 * 예시:
 * - school: "대명초", grade: "초3" -> "대명초3"
 * - school: "대명초", grade: "3" -> "대명초3"
 * - school: "경북중", grade: "중2" -> "경북중2"
 * - school: "대구고", grade: "고1" -> "대구고1"
 * - school: "", grade: "초3" -> "초3"
 * - school: "칠성초", grade: "초5" -> "5칠성초"
 * - school: "대명", grade: "초3" -> "초3대명"
 */
export const formatSchoolGrade = (
  school: string | undefined | null,
  grade: string | undefined | null,
  options?: { numberLast?: boolean }
): string => {
  const schoolStr = school?.trim() || '';
  const gradeStr = grade?.trim() || '';

  if (!schoolStr && !gradeStr) return '-';
  if (!schoolStr) return gradeStr || '-';
  if (!gradeStr) return schoolStr;

  const gradeNum = getGradeNumber(gradeStr);
  const gradeLevel = getGradeLevel(gradeStr);

  // 출석부 등: 학교명 + 학년숫자 ("경명여고1")
  if (options?.numberLast) {
    return `${schoolStr}${gradeNum}`;
  }

  // 시간표용 기본: 학년숫자 + 학교명
  // 학교명이 이미 레벨(초/중/고)로 끝나는 경우
  const schoolEndsWithLevel =
    schoolStr.endsWith('초') ||
    schoolStr.endsWith('중') ||
    schoolStr.endsWith('고');

  if (schoolEndsWithLevel) {
    // 학년숫자 + 학교명: "칠성초" + "초5" -> "5칠성초"
    return `${gradeNum}${schoolStr}`;
  }

  // 학교명이 레벨로 끝나지 않으면 학년 + 학교명
  // "대명" + "초3" -> "초3대명"
  if (gradeLevel) {
    return `${gradeStr}${schoolStr}`;
  }

  // 학년에 레벨이 없으면 숫자 + 학교명
  // "대명초등학교" + "3" -> "3대명초등학교"
  return `${gradeNum}${schoolStr}`;
};

/**
 * 학생 객체에서 학교+학년 포맷팅
 */
export const formatStudentSchoolGrade = (student: {
  school?: string | null;
  grade?: string | null;
}): string => {
  return formatSchoolGrade(student.school, student.grade);
};
