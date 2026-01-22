/**
 * 출결번호 자동 생성 유틸리티
 *
 * 규칙:
 * 1. 학부모 전화번호 뒤 4자리 사용
 * 2. 중복 시 끝에 1, 2, 3... 붙임
 * 3. 전화번호 없으면 랜덤 4자리 생성
 */

/**
 * 출결번호 생성 함수
 * @param parentPhone 학부모 전화번호
 * @param existingNumbers 기존 출결번호 목록 (중복 체크용)
 * @returns 생성된 출결번호
 */
export function generateAttendanceNumber(
  parentPhone: string | undefined,
  existingNumbers: Set<string>
): string {
  let baseNumber: string;

  if (parentPhone && parentPhone.length >= 4) {
    // 전화번호에서 숫자만 추출
    const digitsOnly = parentPhone.replace(/\D/g, '');

    if (digitsOnly.length >= 4) {
      // 뒤 4자리 사용
      baseNumber = digitsOnly.slice(-4);
    } else {
      // 4자리 미만이면 랜덤 생성
      baseNumber = generateRandomNumber();
    }
  } else {
    // 전화번호 없으면 랜덤 4자리
    baseNumber = generateRandomNumber();
  }

  // 중복 체크 및 처리
  let attendanceNumber = baseNumber;
  let suffix = 1;

  while (existingNumbers.has(attendanceNumber)) {
    attendanceNumber = baseNumber + suffix;
    suffix++;
  }

  return attendanceNumber;
}

/**
 * 랜덤 4자리 숫자 생성
 */
function generateRandomNumber(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * 여러 학생의 출결번호 일괄 생성
 * @param students 학생 목록 (parentPhone 포함)
 * @returns 학생 ID -> 출결번호 매핑
 */
export function generateBulkAttendanceNumbers(
  students: Array<{ id: string; parentPhone?: string; attendanceNumber?: string }>
): Map<string, string> {
  const result = new Map<string, string>();
  const existingNumbers = new Set<string>();

  // 이미 출결번호가 있는 학생들 먼저 수집
  students.forEach(student => {
    if (student.attendanceNumber) {
      existingNumbers.add(student.attendanceNumber);
      result.set(student.id, student.attendanceNumber);
    }
  });

  // 출결번호 없는 학생들에게 생성
  students.forEach(student => {
    if (!student.attendanceNumber) {
      const newNumber = generateAttendanceNumber(student.parentPhone, existingNumbers);
      existingNumbers.add(newNumber);
      result.set(student.id, newNumber);
    }
  });

  return result;
}

/**
 * 출결번호로 학생 찾기 (문서 ID 반환)
 * @param attendanceNumber 출결번호
 * @param students 학생 목록
 * @returns 찾은 학생의 문서 ID (없으면 null)
 */
export function findStudentByAttendanceNumber(
  attendanceNumber: string,
  students: Array<{ id: string; attendanceNumber?: string }>
): string | null {
  const found = students.find(s => s.attendanceNumber === attendanceNumber);
  return found ? found.id : null;
}
