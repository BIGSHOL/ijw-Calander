/**
 * useStudentEnrollmentValidation - 개별 학생의 enrollment 유효성 검사
 *
 * 해당 학생의 enrollment가 classes 컬렉션과 일치하는지 확인
 */

import { useMemo } from 'react';
import { useClasses } from '../../../hooks/useClasses';
import { UnifiedStudent } from '../../../types';

interface InvalidEnrollment {
  enrollmentId: string;
  className: string;
  subject: string;
  suggestedClasses: string[]; // 유사한 수업명 추천
}

export function useStudentEnrollmentValidation(student: UnifiedStudent) {
  const { data: classes } = useClasses();

  const invalidEnrollments = useMemo(() => {
    if (!classes || !student.enrollments) return [];

    const validClassNames = new Set(classes.map(c => c.className));
    const invalid: InvalidEnrollment[] = [];

    student.enrollments.forEach((enrollment: any) => {
      const className = enrollment.className;
      if (!className) return;

      // 정확히 일치하는 수업이 없는 경우
      if (!validClassNames.has(className)) {
        // 같은 과목의 유사한 수업명 찾기
        const subject = enrollment.subject || 'math';
        const suggestedClasses = classes
          .filter(c => c.subject === subject)
          .map(c => c.className)
          .filter(name =>
            name.includes(className) ||
            className.includes(name)
          )
          .slice(0, 3);

        invalid.push({
          enrollmentId: enrollment.id,
          className,
          subject,
          suggestedClasses,
        });
      }
    });

    return invalid;
  }, [classes, student.enrollments]);

  return {
    hasIssues: invalidEnrollments.length > 0,
    invalidEnrollments,
  };
}
