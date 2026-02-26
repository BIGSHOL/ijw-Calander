/**
 * Generic Class Students Hook
 *
 * 통합 훅 useSubjectClassStudents의 범용 래퍼.
 * Firebase collectionGroup 쿼리 → studentMap useMemo 파생으로 전환.
 * - 중복 Firestore 쿼리 제거 (useStudents가 이미 모든 enrollment 포함)
 * - 반이동 감지, 상태 필터링 등 수학/영어와 동일한 로직 적용
 */

import type { SubjectKey } from '../types';
import { getSubjectConfig } from '../utils/subjectConfig';
import { useSubjectClassStudents } from '../../../../hooks/useSubjectClassStudents';

export type { ClassStudentData } from '../../../../hooks/useSubjectClassStudents';

export function useClassStudents(
  subject: SubjectKey,
  classNames: string[],
  studentMap: Record<string, any> = {}
) {
  const config = getSubjectConfig(subject);

  return useSubjectClassStudents({
    subject: config.firebaseSubjectKey,
    classNames,
    studentMap,
  });
}
