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
 * - school: "대명", grade: "초3" -> "대명 초3"
 */
export const formatSchoolGrade = (
  school: string | undefined | null,
  grade: string | undefined | null
): string => {
  const schoolStr = school?.trim() || '';
  const gradeStr = grade?.trim() || '';

  if (!schoolStr && !gradeStr) return '-';
  if (!schoolStr) return gradeStr || '-';
  if (!gradeStr) return schoolStr;

  const gradeNum = getGradeNumber(gradeStr);
  const gradeLevel = getGradeLevel(gradeStr);

  // 학교명이 이미 레벨(초/중/고)로 끝나는 경우
  const schoolEndsWithLevel =
    schoolStr.endsWith('초') ||
    schoolStr.endsWith('중') ||
    schoolStr.endsWith('고');

  if (schoolEndsWithLevel) {
    // 학교명이 레벨로 끝나면 숫자만 붙임
    // "대명초" + "초3" -> "대명초3"
    return `${schoolStr}${gradeNum}`;
  }

  // 학교명이 레벨로 끝나지 않으면 전체 학년 표시
  // "대명" + "초3" -> "대명 초3"
  if (gradeLevel) {
    return `${schoolStr} ${gradeStr}`;
  }

  // 학년에 레벨이 없으면 그냥 숫자만 붙임
  // "대명초등학교" + "3" -> "대명초등학교 3"
  return `${schoolStr} ${gradeNum}`;
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
