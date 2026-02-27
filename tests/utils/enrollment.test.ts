import { getEndedSubjects } from '../../utils/enrollment';
import { UnifiedStudent, Enrollment } from '../../types';

// 기본 UnifiedStudent 골격 생성 헬퍼
const createStudent = (enrollments: Enrollment[]): UnifiedStudent => ({
  id: 'student1',
  name: '홍길동',
  enrollments,
  status: 'active',
  startDate: '2026-01-01',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

// 기본 Enrollment 골격 생성 헬퍼
const createEnrollment = (overrides: Partial<Enrollment>): Enrollment => ({
  subject: 'math',
  classId: 'class1',
  className: '수학반',
  days: ['월', '수'],
  ...overrides,
});

describe('enrollment 유틸리티', () => {
  describe('getEndedSubjects', () => {
    it('모든 enrollment에 종료일이 있으면 해당 과목을 수강종료로 판정한다', () => {
      // Given: math 과목의 모든 enrollment에 withdrawalDate 존재
      const student = createStudent([
        createEnrollment({ subject: 'math', withdrawalDate: '2026-01-31' }),
      ]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.subjects).toContain('math');
      expect(result.enrollments).toHaveLength(1);
    });

    it('활성(종료일 없는) enrollment가 하나라도 있으면 수강종료로 판정하지 않는다', () => {
      // Given: math 과목에 종료된 enrollment와 활성 enrollment가 혼재
      const student = createStudent([
        createEnrollment({ subject: 'math', withdrawalDate: '2025-12-31' }),
        createEnrollment({ subject: 'math', classId: 'class2', className: '수학반2' }), // 종료일 없음
      ]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.subjects).not.toContain('math');
    });

    it('endDate를 기준으로도 수강종료를 판정한다', () => {
      // Given: withdrawalDate 대신 endDate 사용
      const student = createStudent([
        createEnrollment({ subject: 'english', endDate: '2026-01-31' }),
      ]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.subjects).toContain('english');
    });

    it('여러 과목이 있을 때 종료된 과목만 반환한다', () => {
      // Given: math는 종료, english는 활성
      const student = createStudent([
        createEnrollment({ subject: 'math', withdrawalDate: '2026-01-31' }),
        createEnrollment({ subject: 'english' }), // 종료일 없음 → 활성
      ]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.subjects).toContain('math');
      expect(result.subjects).not.toContain('english');
    });

    it('여러 과목 모두 종료된 경우 모두 반환한다', () => {
      // Given: math, english, science 모두 종료
      const student = createStudent([
        createEnrollment({ subject: 'math', withdrawalDate: '2026-01-31' }),
        createEnrollment({ subject: 'english', endDate: '2026-01-31' }),
        createEnrollment({ subject: 'science', withdrawalDate: '2026-01-15' }),
      ]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.subjects).toHaveLength(3);
      expect(result.subjects).toContain('math');
      expect(result.subjects).toContain('english');
      expect(result.subjects).toContain('science');
      expect(result.enrollments).toHaveLength(3);
    });

    it('같은 과목에 여러 enrollment가 모두 종료되면 해당 과목을 수강종료로 판정한다', () => {
      // Given: math 과목에 두 개의 enrollment 모두 종료일 있음
      const student = createStudent([
        createEnrollment({ subject: 'math', withdrawalDate: '2025-06-30' }),
        createEnrollment({ subject: 'math', classId: 'class2', className: '수학반2', endDate: '2026-01-31' }),
      ]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.subjects).toContain('math');
      expect(result.enrollments).toHaveLength(2);
    });

    it('enrollments가 빈 배열이면 빈 결과를 반환한다', () => {
      // Given: 수강 정보 없음
      const student = createStudent([]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.subjects).toHaveLength(0);
      expect(result.enrollments).toHaveLength(0);
    });

    it('enrollments가 undefined이면 빈 결과를 반환한다', () => {
      // Given: enrollments 필드 자체가 없는 경우
      const student = createStudent(undefined as unknown as Enrollment[]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.subjects).toHaveLength(0);
      expect(result.enrollments).toHaveLength(0);
    });

    it('활성 enrollment만 있으면 수강종료 과목이 없다', () => {
      // Given: 종료일 없는 enrollment만 존재
      const student = createStudent([
        createEnrollment({ subject: 'math' }),
        createEnrollment({ subject: 'english' }),
      ]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.subjects).toHaveLength(0);
      expect(result.enrollments).toHaveLength(0);
    });

    it('반환된 enrollments는 종료된 과목의 모든 enrollment를 포함한다', () => {
      // Given: math 과목에 종료된 enrollment 2개
      const e1 = createEnrollment({ subject: 'math', classId: 'c1', className: '수학반A', withdrawalDate: '2025-12-31' });
      const e2 = createEnrollment({ subject: 'math', classId: 'c2', className: '수학반B', endDate: '2026-01-15' });
      const student = createStudent([e1, e2]);

      // When
      const result = getEndedSubjects(student);

      // Then
      expect(result.enrollments).toHaveLength(2);
      expect(result.enrollments).toContainEqual(e1);
      expect(result.enrollments).toContainEqual(e2);
    });
  });
});
