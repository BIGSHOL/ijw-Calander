/**
 * 학생 고유번호 자동 생성 유틸리티
 *
 * 규칙:
 * 1. 6자리 영문 대문자 + 숫자 조합
 * 2. 혼동 문자 제외: O, 0, I, 1, l
 * 3. 기존 코드와의 충돌 방지
 * 4. 생성 후 변경 불가 (읽기 전용)
 */

// 허용 문자 (31자: 혼동 문자 O, 0, I, 1, l 제외)
const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * 학생 고유번호 생성
 * @param existingCodes 기존 코드 집합 (충돌 방지)
 * @param maxAttempts 최대 시도 횟수
 * @returns 6자리 고유번호
 */
export function generateStudentCode(
  existingCodes: Set<string>,
  maxAttempts = 1000
): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += ALLOWED_CHARS[Math.floor(Math.random() * ALLOWED_CHARS.length)];
    }
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  throw new Error('학생 고유번호 생성 실패: 최대 시도 횟수를 초과했습니다.');
}

/**
 * 여러 학생의 고유번호 일괄 생성
 * @param students 학생 목록 (기존 코드 포함)
 * @returns 학생 ID -> 고유번호 매핑
 */
export function generateBulkStudentCodes(
  students: Array<{ id: string; studentCode?: string }>
): Map<string, string> {
  const result = new Map<string, string>();
  const existingCodes = new Set<string>();

  // 기존 코드 수집
  students.forEach(student => {
    if (student.studentCode) {
      existingCodes.add(student.studentCode);
      result.set(student.id, student.studentCode);
    }
  });

  // 코드 없는 학생들에게 생성
  students.forEach(student => {
    if (!student.studentCode) {
      const newCode = generateStudentCode(existingCodes);
      existingCodes.add(newCode);
      result.set(student.id, newCode);
    }
  });

  return result;
}
