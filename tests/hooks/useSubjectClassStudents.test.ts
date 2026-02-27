/**
 * useSubjectClassStudents 훅 테스트
 *
 * 테스트 대상:
 * - studentMap에서 과목별 수업 학생 데이터 파생 (useMemo 기반, Firestore 쿼리 없음)
 * - 반이동(isTransferred / isTransferredIn) 감지 로직
 * - prospect 상태 학생 제외, active/withdrawn/on_hold 포함
 * - 미래 시작일 학생 isScheduled 처리
 * - 학생 이름 가나다 정렬
 * - 빈 classNames 또는 빈 studentMap 처리
 * - isLoading 플래그 계산
 * - refetch 함수 export 확인
 */

import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';
import {
  useSubjectClassStudents,
  SubjectClassStudentOptions,
  ClassStudentData,
} from '../../hooks/useSubjectClassStudents';

// formatDateKey는 단순 날짜 문자열 반환으로 모킹
vi.mock('../../utils/dateUtils', () => ({
  formatDateKey: vi.fn((_date: Date) => '2026-02-27'),
}));

// convertTimestampToDate: 문자열이면 그대로, null/undefined면 undefined 반환
vi.mock('../../utils/firestoreConverters', () => ({
  convertTimestampToDate: vi.fn((v: any) => {
    if (!v) return undefined;
    if (typeof v === 'string') return v;
    return undefined;
  }),
}));

// formatScheduleCompact: 간단한 문자열 반환으로 모킹
vi.mock('../../components/Timetable/constants', () => ({
  formatScheduleCompact: vi.fn((schedule: string[]) => schedule.join(', ')),
}));

// QueryClient 헬퍼
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ──────────────────────────── 테스트용 데이터 ────────────────────────────

const makeStudentMap = (overrides: Record<string, any> = {}) => ({
  s1: {
    name: '김철수',
    status: 'active',
    startDate: '2025-01-01',
    enrollments: [
      { subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' },
    ],
    ...overrides,
  },
  s2: {
    name: '이영희',
    status: 'active',
    startDate: '2025-02-01',
    enrollments: [
      { subject: 'math', className: 'A반', enrollmentDate: '2025-02-01' },
    ],
  },
  s3: {
    name: '박민수',
    status: 'active',
    startDate: '2025-03-01',
    enrollments: [
      { subject: 'english', className: 'B반', enrollmentDate: '2025-03-01' },
    ],
  },
});

// ─────────────────────────────── 테스트 ───────────────────────────────

describe('useSubjectClassStudents 훅', () => {
  describe('기본 데이터 파생', () => {
    it('classNames와 studentMap이 있을 때 classDataMap을 올바르게 반환한다', () => {
      const studentMap = makeStudentMap();
      const options: SubjectClassStudentOptions = {
        subject: 'math',
        classNames: ['A반'],
        studentMap,
      };

      const { result } = renderHook(() => useSubjectClassStudents(options), {
        wrapper: createWrapper(),
      });

      const { classDataMap } = result.current;
      expect(classDataMap).toBeDefined();
      expect(classDataMap['A반']).toBeDefined();
      expect(classDataMap['A반'].studentList).toHaveLength(2);
    });

    it('과목이 다른 학생은 포함하지 않는다', () => {
      const studentMap = makeStudentMap();
      const options: SubjectClassStudentOptions = {
        subject: 'math',
        classNames: ['A반'],
        studentMap,
      };

      const { result } = renderHook(() => useSubjectClassStudents(options), {
        wrapper: createWrapper(),
      });

      // s3는 english 과목이므로 math A반에 포함되지 않아야 함
      const ids = result.current.classDataMap['A반'].studentIds;
      expect(ids).not.toContain('s3');
    });

    it('studentIds 배열이 studentList와 일치한다', () => {
      const studentMap = makeStudentMap();
      const options: SubjectClassStudentOptions = {
        subject: 'math',
        classNames: ['A반'],
        studentMap,
      };

      const { result } = renderHook(() => useSubjectClassStudents(options), {
        wrapper: createWrapper(),
      });

      const { studentList, studentIds } = result.current.classDataMap['A반'];
      expect(studentIds).toHaveLength(studentList.length);
    });

    it('여러 수업을 동시에 처리한다', () => {
      const studentMap = {
        s1: {
          name: '가나다',
          status: 'active',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
        s2: {
          name: '라마바',
          status: 'active',
          enrollments: [{ subject: 'math', className: 'B반', enrollmentDate: '2025-01-01' }],
        },
      };

      const options: SubjectClassStudentOptions = {
        subject: 'math',
        classNames: ['A반', 'B반'],
        studentMap,
      };

      const { result } = renderHook(() => useSubjectClassStudents(options), {
        wrapper: createWrapper(),
      });

      expect(result.current.classDataMap['A반']).toBeDefined();
      expect(result.current.classDataMap['B반']).toBeDefined();
      expect(result.current.classDataMap['A반'].studentList).toHaveLength(1);
      expect(result.current.classDataMap['B반'].studentList).toHaveLength(1);
    });
  });

  describe('학생 상태 필터링', () => {
    it('active, withdrawn, on_hold 학생은 포함한다', () => {
      const studentMap = {
        s_active: {
          name: '활성학생',
          status: 'active',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
        s_withdrawn: {
          name: '퇴원학생',
          status: 'withdrawn',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01', withdrawalDate: '2025-06-01' }],
        },
        s_on_hold: {
          name: '대기학생',
          status: 'on_hold',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
      };

      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap }),
        { wrapper: createWrapper() }
      );

      const names = result.current.classDataMap['A반'].studentList.map(s => s.name);
      expect(names).toContain('활성학생');
      expect(names).toContain('퇴원학생');
      expect(names).toContain('대기학생');
    });

    it('prospect 학생은 제외한다', () => {
      const studentMap = {
        s_prospect: {
          name: '예비학생',
          status: 'prospect',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
        s_active: {
          name: '활성학생',
          status: 'active',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
      };

      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap }),
        { wrapper: createWrapper() }
      );

      const names = result.current.classDataMap['A반'].studentList.map(s => s.name);
      expect(names).not.toContain('예비학생');
      expect(names).toContain('활성학생');
    });

    it('enrollments가 없는 학생은 결과에 포함하지 않는다', () => {
      const studentMap = {
        s_no_enrollment: {
          name: '수업없는학생',
          status: 'active',
          enrollments: [],
        },
        s_active: {
          name: '수업있는학생',
          status: 'active',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
      };

      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap }),
        { wrapper: createWrapper() }
      );

      const names = result.current.classDataMap['A반'].studentList.map(s => s.name);
      expect(names).not.toContain('수업없는학생');
    });
  });

  describe('학생 정렬', () => {
    it('학생 이름을 가나다 순으로 정렬한다', () => {
      const studentMap = {
        s1: {
          name: '홍길동',
          status: 'active',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
        s2: {
          name: '강민준',
          status: 'active',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
        s3: {
          name: '나도완',
          status: 'active',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
      };

      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap }),
        { wrapper: createWrapper() }
      );

      const names = result.current.classDataMap['A반'].studentList.map(s => s.name);
      expect(names).toEqual(['강민준', '나도완', '홍길동']);
    });
  });

  describe('반이동 감지', () => {
    it('이 수업에서 종료되고 다른 수업에 활성 등록이 있으면 isTransferred=true이다', () => {
      const studentMap = {
        transfer_student: {
          name: '반이동학생',
          status: 'active',
          enrollments: [
            // A반에서는 퇴원(withdrawalDate 있음)
            { subject: 'math', className: 'A반', enrollmentDate: '2025-01-01', withdrawalDate: '2025-06-01' },
            // B반에는 활성 등록 (endDate 없음)
            { subject: 'math', className: 'B반', enrollmentDate: '2025-06-01' },
          ],
        },
      };

      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반', 'B반'], studentMap }),
        { wrapper: createWrapper() }
      );

      const aList = result.current.classDataMap['A반'].studentList;
      const student = aList.find(s => s.name === '반이동학생');
      expect(student).toBeDefined();
      expect(student?.isTransferred).toBe(true);
    });

    it('다른 수업에서 종료된 기록이 있고 현재 수업에 활성 등록이 있으면 isTransferredIn=true이다', () => {
      const studentMap = {
        transfer_in_student: {
          name: '반이동유입학생',
          status: 'active',
          enrollments: [
            // A반에서는 퇴원(이미 종료)
            { subject: 'math', className: 'A반', enrollmentDate: '2025-01-01', endDate: '2025-05-31' },
            // B반에는 활성 등록
            { subject: 'math', className: 'B반', enrollmentDate: '2025-06-01' },
          ],
        },
      };

      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반', 'B반'], studentMap }),
        { wrapper: createWrapper() }
      );

      const bList = result.current.classDataMap['B반'].studentList;
      const student = bList.find(s => s.name === '반이동유입학생');
      expect(student).toBeDefined();
      expect(student?.isTransferredIn).toBe(true);
    });
  });

  describe('isScheduled (미래 시작일)', () => {
    it('enrollmentDate가 referenceDate보다 미래이면 isScheduled=true이다', () => {
      const studentMap = {
        future_student: {
          name: '예정학생',
          status: 'active',
          enrollments: [
            // referenceDate=2026-02-27 기준, 미래 날짜
            { subject: 'math', className: 'A반', enrollmentDate: '2026-12-01' },
          ],
        },
      };

      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: ['A반'],
          studentMap,
          referenceDate: '2026-02-27',
        }),
        { wrapper: createWrapper() }
      );

      const student = result.current.classDataMap['A반'].studentList.find(
        s => s.name === '예정학생'
      );
      expect(student?.isScheduled).toBe(true);
    });

    it('enrollmentDate가 referenceDate 이전이면 isScheduled=false이다', () => {
      const studentMap = {
        past_student: {
          name: '기존학생',
          status: 'active',
          enrollments: [
            { subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' },
          ],
        },
      };

      const { result } = renderHook(
        () => useSubjectClassStudents({
          subject: 'math',
          classNames: ['A반'],
          studentMap,
          referenceDate: '2026-02-27',
        }),
        { wrapper: createWrapper() }
      );

      const student = result.current.classDataMap['A반'].studentList.find(
        s => s.name === '기존학생'
      );
      expect(student?.isScheduled).toBe(false);
    });
  });

  describe('className 공백 정규화', () => {
    it('enrollment.className에 공백이 있어도 정규화하여 매칭한다', () => {
      const studentMap = {
        s1: {
          name: '공백학생',
          status: 'active',
          enrollments: [
            // className에 앞뒤 공백
            { subject: 'math', className: ' A반 ', enrollmentDate: '2025-01-01' },
          ],
        },
      };

      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap }),
        { wrapper: createWrapper() }
      );

      const names = result.current.classDataMap['A반'].studentList.map(s => s.name);
      expect(names).toContain('공백학생');
    });
  });

  describe('빈 값 처리', () => {
    it('classNames가 빈 배열이면 빈 객체를 반환한다', () => {
      const studentMap = makeStudentMap();
      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: [], studentMap }),
        { wrapper: createWrapper() }
      );

      expect(result.current.classDataMap).toEqual({});
    });

    it('studentMap이 빈 객체이면 빈 classDataMap을 반환한다', () => {
      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap: {} }),
        { wrapper: createWrapper() }
      );

      expect(result.current.classDataMap).toEqual({});
    });

    it('요청한 수업에 등록된 학생이 없으면 studentList가 빈 배열이다', () => {
      const studentMap = makeStudentMap(); // s1, s2는 A반, s3는 영어 B반
      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['C반'], studentMap }),
        { wrapper: createWrapper() }
      );

      expect(result.current.classDataMap['C반'].studentList).toHaveLength(0);
    });
  });

  describe('isLoading 플래그', () => {
    it('classNames가 있고 studentMap이 비어있으면 isLoading=true이다', () => {
      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap: {} }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('classNames가 비어있으면 isLoading=false이다', () => {
      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: [], studentMap: {} }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
    });

    it('classNames와 studentMap 모두 있으면 isLoading=false이다', () => {
      const studentMap = makeStudentMap();
      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('반환 값 구조', () => {
    it('classDataMap, isLoading, refetch를 반환한다', () => {
      const studentMap = makeStudentMap();
      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap }),
        { wrapper: createWrapper() }
      );

      expect(result.current).toHaveProperty('classDataMap');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('refetch');
      expect(typeof result.current.refetch).toBe('function');
    });

    it('studentList 각 항목이 TimetableStudent 필수 필드를 포함한다', () => {
      const studentMap = makeStudentMap();
      const { result } = renderHook(
        () => useSubjectClassStudents({ subject: 'math', classNames: ['A반'], studentMap }),
        { wrapper: createWrapper() }
      );

      const student = result.current.classDataMap['A반'].studentList[0];
      expect(student).toHaveProperty('id');
      expect(student).toHaveProperty('name');
      expect(student).toHaveProperty('isTransferred');
      expect(student).toHaveProperty('isTransferredIn');
      expect(student).toHaveProperty('isScheduled');
      expect(student).toHaveProperty('attendanceDays');
    });
  });

  describe('subject 필드 변경 시 재파생', () => {
    it('subject가 바뀌면 해당 과목 학생만 반환한다', () => {
      const studentMap = {
        s_math: {
          name: '수학학생',
          status: 'active',
          enrollments: [{ subject: 'math', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
        s_eng: {
          name: '영어학생',
          status: 'active',
          enrollments: [{ subject: 'english', className: 'A반', enrollmentDate: '2025-01-01' }],
        },
      };

      const { result, rerender } = renderHook(
        ({ subject }: { subject: string }) =>
          useSubjectClassStudents({ subject, classNames: ['A반'], studentMap }),
        { initialProps: { subject: 'math' }, wrapper: createWrapper() }
      );

      expect(result.current.classDataMap['A반'].studentList.map(s => s.name)).toContain('수학학생');
      expect(result.current.classDataMap['A반'].studentList.map(s => s.name)).not.toContain('영어학생');

      rerender({ subject: 'english' });

      expect(result.current.classDataMap['A반'].studentList.map(s => s.name)).toContain('영어학생');
      expect(result.current.classDataMap['A반'].studentList.map(s => s.name)).not.toContain('수학학생');
    });
  });
});
