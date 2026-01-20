/**
 * Secure Logging Utility
 *
 * 민감한 정보(학생 이름, 개인정보 등)를 로그에 노출하지 않고 안전하게 로깅합니다.
 * 프로덕션 환경에서는 민감 정보를 마스킹하고, 개발 환경에서만 전체 정보를 표시합니다.
 */

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * 학생 ID를 마스킹합니다.
 * 개발 환경: 전체 ID 표시
 * 프로덕션: 앞 3자리만 표시 (예: "stu***")
 */
export function maskStudentId(studentId: string): string {
  if (IS_DEV) return studentId;
  if (!studentId || studentId.length < 3) return '***';
  return `${studentId.substring(0, 3)}***`;
}

/**
 * 학생 이름을 마스킹합니다.
 * 개발 환경: 전체 이름 표시
 * 프로덕션: 첫 글자만 표시 (예: "김*")
 */
export function maskStudentName(name: string): string {
  if (IS_DEV) return name;
  if (!name || name.length === 0) return '***';
  return `${name.charAt(0)}*`;
}

/**
 * 안전한 로그 출력 (info 레벨)
 * 학생 정보가 포함된 경우 마스킹 처리합니다.
 */
export function secureLog(message: string, data?: {
  studentId?: string;
  studentName?: string;
  [key: string]: any;
}): void {
  if (!data) {
    console.log(message);
    return;
  }

  const sanitized = { ...data };
  if (data.studentId) {
    sanitized.studentId = maskStudentId(data.studentId);
  }
  if (data.studentName) {
    sanitized.studentName = maskStudentName(data.studentName);
  }

  console.log(message, sanitized);
}

/**
 * 안전한 경고 로그 출력
 * 학생 정보가 포함된 경우 마스킹 처리합니다.
 */
export function secureWarn(message: string, data?: {
  studentId?: string;
  studentName?: string;
  [key: string]: any;
}): void {
  if (!data) {
    console.warn(message);
    return;
  }

  const sanitized = { ...data };
  if (data.studentId) {
    sanitized.studentId = maskStudentId(data.studentId);
  }
  if (data.studentName) {
    sanitized.studentName = maskStudentName(data.studentName);
  }

  console.warn(message, sanitized);
}

/**
 * 안전한 에러 로그 출력
 * 학생 정보가 포함된 경우 마스킹 처리합니다.
 */
export function secureError(message: string, error?: Error | any, data?: {
  studentId?: string;
  studentName?: string;
  [key: string]: any;
}): void {
  if (!data) {
    console.error(message, error);
    return;
  }

  const sanitized = { ...data };
  if (data.studentId) {
    sanitized.studentId = maskStudentId(data.studentId);
  }
  if (data.studentName) {
    sanitized.studentName = maskStudentName(data.studentName);
  }

  console.error(message, error, sanitized);
}
