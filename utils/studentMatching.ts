import { BillingRecord } from '../types/billing';
import { UnifiedStudent } from '../types';

/**
 * 학생 매칭 결과
 */
export interface MatchResult {
  studentId: string;
  studentName: string;
  matchType: 'externalId' | 'nameAndSchool' | 'nameOnly';
}

/**
 * 수납 레코드와 학생 DB를 매칭
 * 우선순위:
 *   1. externalStudentId === attendanceNumber
 *   2. studentName + school 동시 일치
 *   3. studentName만 일치 (동명이인 없을 때)
 */
export function matchBillingToStudent(
  record: BillingRecord,
  students: UnifiedStudent[]
): MatchResult | null {
  // 1. 외부 학생 ID(원생고유번호) === 출결번호
  if (record.externalStudentId) {
    const byExtId = students.find(
      (s) => s.attendanceNumber === record.externalStudentId
    );
    if (byExtId) {
      return {
        studentId: byExtId.id,
        studentName: byExtId.name,
        matchType: 'externalId',
      };
    }
  }

  // 2. 이름 + 학교 동시 일치
  if (record.studentName && record.school) {
    const byNameAndSchool = students.filter(
      (s) =>
        s.name === record.studentName &&
        s.school &&
        s.school.includes(record.school)
    );
    if (byNameAndSchool.length === 1) {
      return {
        studentId: byNameAndSchool[0].id,
        studentName: byNameAndSchool[0].name,
        matchType: 'nameAndSchool',
      };
    }
  }

  // 3. 이름만 일치 (동명이인 없을 때)
  if (record.studentName) {
    const byName = students.filter((s) => s.name === record.studentName);
    if (byName.length === 1) {
      return {
        studentId: byName[0].id,
        studentName: byName[0].name,
        matchType: 'nameOnly',
      };
    }
  }

  return null;
}

/**
 * 배치 학생 매칭 - 여러 수납 레코드를 한번에 매칭
 * @returns Map<billingRecordId, MatchResult>
 */
export function batchMatchBillingToStudents(
  records: BillingRecord[],
  students: UnifiedStudent[]
): Map<string, MatchResult> {
  const results = new Map<string, MatchResult>();

  for (const record of records) {
    const match = matchBillingToStudent(record, students);
    if (match) {
      results.set(record.id, match);
    }
  }

  return results;
}
