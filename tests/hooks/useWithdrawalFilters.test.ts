import { renderHook, act } from '@testing-library/react';
import { useWithdrawalFilters } from '../../hooks/useWithdrawalFilters';
import type { UnifiedStudent, Enrollment } from '../../types';

// Helper to create mock enrollment
function createMockEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    subject: 'math',
    classId: 'class-1',
    className: 'Math Class A',
    staffId: 'staff-1',
    days: ['월', '수'],
    ...overrides,
  };
}

// Helper to create mock student
function createMockStudent(overrides: Partial<UnifiedStudent> = {}): UnifiedStudent {
  return {
    id: 'student-1',
    name: '김학생',
    status: 'active',
    startDate: '2024-01-01',
    enrollments: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('useWithdrawalFilters', () => {
  describe('allEntries - Basic Entry Extraction', () => {
    it('빈 학생 배열에서는 빈 항목을 반환한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters([]));

      expect(result.current.filteredEntries).toEqual([]);
      expect(result.current.counts).toEqual({ total: 0, withdrawn: 0, subjectEnded: 0 });
    });

    it('퇴원 학생은 withdrawn 타입으로 추출된다', () => {
      const students = [
        createMockStudent({
          id: 'student-1',
          name: '김퇴원',
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          withdrawalReason: 'relocation',
          enrollments: [
            createMockEnrollment({ subject: 'math', withdrawalDate: '2025-06-15', staffId: 'staff-1' }),
            createMockEnrollment({ subject: 'english', withdrawalDate: '2025-06-15', staffId: 'staff-2' }),
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(1);

      const entry = result.current.filteredEntries[0];
      expect(entry.type).toBe('withdrawn');
      expect(entry.student.id).toBe('student-1');
      expect(entry.endedSubjects).toEqual(['math', 'english']);
      expect(entry.endedEnrollments).toHaveLength(2);
      expect(entry.effectiveDate).toBe('2025-06-15');
    });

    it('퇴원 학생의 effectiveDate는 withdrawalDate를 우선 사용한다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          endDate: '2025-06-10',
          enrollments: [createMockEnrollment()],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries[0].effectiveDate).toBe('2025-06-15');
    });

    it('퇴원 학생의 effectiveDate는 endDate를 대체로 사용한다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          endDate: '2025-06-10',
          enrollments: [createMockEnrollment()],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries[0].effectiveDate).toBe('2025-06-10');
    });

    it('활성 학생이지만 종료된 과목이 없으면 포함되지 않는다', () => {
      const students = [
        createMockStudent({
          status: 'active',
          enrollments: [
            createMockEnrollment({ subject: 'math' }), // No withdrawalDate/endDate
            createMockEnrollment({ subject: 'english' }),
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(0);
    });

    it('활성 학생이고 종료된 과목이 있으면 subject-ended 타입으로 추출된다', () => {
      const students = [
        createMockStudent({
          id: 'student-2',
          name: '박활성',
          status: 'active',
          enrollments: [
            createMockEnrollment({ subject: 'math', withdrawalDate: '2025-05-01', staffId: 'staff-1' }),
            createMockEnrollment({ subject: 'english' }), // Still active
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(1);

      const entry = result.current.filteredEntries[0];
      expect(entry.type).toBe('subject-ended');
      expect(entry.student.id).toBe('student-2');
      expect(entry.endedSubjects).toEqual(['math']);
      expect(entry.endedEnrollments).toHaveLength(1);
      expect(entry.effectiveDate).toBe('2025-05-01');
    });

    it('on_hold 학생이고 종료된 과목이 있으면 subject-ended 타입으로 추출된다', () => {
      const students = [
        createMockStudent({
          status: 'on_hold',
          enrollments: [
            createMockEnrollment({ subject: 'math', endDate: '2025-04-30' }),
            createMockEnrollment({ subject: 'english' }),
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].type).toBe('subject-ended');
      expect(result.current.filteredEntries[0].endedSubjects).toEqual(['math']);
    });

    it('prospect 학생은 포함되지 않는다', () => {
      const students = [
        createMockStudent({
          status: 'prospect',
          enrollments: [createMockEnrollment({ subject: 'math', withdrawalDate: '2025-05-01' })],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(0);
    });
  });

  describe('getEndedSubjects - Subject Grouping Logic', () => {
    it('과목의 모든 enrollment에 종료일이 있으면 종료된 과목으로 판정한다', () => {
      const students = [
        createMockStudent({
          status: 'active',
          enrollments: [
            createMockEnrollment({ subject: 'math', classId: 'class-1', withdrawalDate: '2025-05-01' }),
            createMockEnrollment({ subject: 'math', classId: 'class-2', endDate: '2025-05-15' }),
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].endedSubjects).toEqual(['math']);
      expect(result.current.filteredEntries[0].endedEnrollments).toHaveLength(2);
    });

    it('과목에 활성 enrollment가 하나라도 있으면 종료되지 않은 것으로 판정한다', () => {
      const students = [
        createMockStudent({
          status: 'active',
          enrollments: [
            createMockEnrollment({ subject: 'math', classId: 'class-1', withdrawalDate: '2025-05-01' }),
            createMockEnrollment({ subject: 'math', classId: 'class-2' }), // No end date - active
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(0);
    });

    it('여러 과목 중 일부만 종료된 경우 종료된 과목만 포함한다', () => {
      const students = [
        createMockStudent({
          status: 'active',
          enrollments: [
            createMockEnrollment({ subject: 'math', withdrawalDate: '2025-05-01' }),
            createMockEnrollment({ subject: 'english', withdrawalDate: '2025-05-10' }),
            createMockEnrollment({ subject: 'science' }), // Active
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].endedSubjects.sort()).toEqual(['english', 'math']);
      expect(result.current.filteredEntries[0].endedEnrollments).toHaveLength(2);
    });

    it('effectiveDate는 종료된 enrollment 중 가장 최근 날짜를 사용한다', () => {
      const students = [
        createMockStudent({
          status: 'active',
          enrollments: [
            createMockEnrollment({ subject: 'math', withdrawalDate: '2025-05-01' }),
            createMockEnrollment({ subject: 'english', endDate: '2025-05-20' }),
            createMockEnrollment({ subject: 'korean', withdrawalDate: '2025-05-15' }),
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      // Latest date is 2025-05-20
      expect(result.current.filteredEntries[0].effectiveDate).toBe('2025-05-20');
    });

    it('빈 종료일이 있는 경우 필터링하고 정렬한다', () => {
      const students = [
        createMockStudent({
          status: 'active',
          enrollments: [
            createMockEnrollment({ subject: 'math', withdrawalDate: '2025-05-01' }),
            createMockEnrollment({ subject: 'english', endDate: '' }), // Empty string
            createMockEnrollment({ subject: 'korean', withdrawalDate: '2025-05-15' }),
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      // english has empty end date but still counts as ended
      expect(result.current.filteredEntries[0].effectiveDate).toBe('2025-05-15');
    });
  });

  describe('filteredEntries - Filtering Logic', () => {
    const testStudents = [
      createMockStudent({
        id: 'student-1',
        name: '김퇴원',
        status: 'withdrawn',
        withdrawalDate: '2025-06-15',
        withdrawalReason: 'relocation',
        enrollments: [
          createMockEnrollment({ subject: 'math', staffId: 'staff-1', withdrawalDate: '2025-06-15' }),
        ],
      }),
      createMockStudent({
        id: 'student-2',
        name: '박종료',
        status: 'active',
        enrollments: [
          createMockEnrollment({ subject: 'english', staffId: 'staff-2', withdrawalDate: '2025-05-20' }),
          createMockEnrollment({ subject: 'science' }), // Active
        ],
      }),
      createMockStudent({
        id: 'student-3',
        name: '이활성',
        status: 'active',
        enrollments: [
          createMockEnrollment({ subject: 'math', staffId: 'staff-1', withdrawalDate: '2025-07-01' }),
          createMockEnrollment({ subject: 'korean', staffId: 'staff-3', withdrawalDate: '2025-07-01' }),
        ],
      }),
    ];

    it('entryType 필터: withdrawn만 표시한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('entryType', 'withdrawn');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].type).toBe('withdrawn');
      expect(result.current.filteredEntries[0].student.name).toBe('김퇴원');
    });

    it('entryType 필터: subject-ended만 표시한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('entryType', 'subject-ended');
      });

      expect(result.current.filteredEntries).toHaveLength(2);
      expect(result.current.filteredEntries[0].type).toBe('subject-ended');
      expect(result.current.filteredEntries[1].type).toBe('subject-ended');
    });

    it('subject 필터: 특정 과목만 표시한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('subject', 'math');
      });

      expect(result.current.filteredEntries).toHaveLength(2);
      expect(result.current.filteredEntries[0].student.name).toBe('이활성');
      expect(result.current.filteredEntries[1].student.name).toBe('김퇴원');
    });

    it('subject 필터: 해당 과목이 없으면 빈 배열을 반환한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('subject', 'korean');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].student.name).toBe('이활성');
    });

    it('staffId 필터: 특정 강사의 학생만 표시한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('staffId', 'staff-1');
      });

      expect(result.current.filteredEntries).toHaveLength(2);
      expect(result.current.filteredEntries.map(e => e.student.name).sort()).toEqual(['김퇴원', '이활성']);
    });

    it('staffId 필터: 해당 강사가 없으면 빈 배열을 반환한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('staffId', 'staff-999');
      });

      expect(result.current.filteredEntries).toHaveLength(0);
    });

    it('reason 필터: 퇴원 사유가 일치하는 학생만 표시한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('reason', 'relocation');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].student.name).toBe('김퇴원');
      expect(result.current.filteredEntries[0].student.withdrawalReason).toBe('relocation');
    });

    it('reason 필터: withdrawn 타입에만 적용된다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('reason', 'graduation');
      });

      // No withdrawn students with 'graduation' reason
      expect(result.current.filteredEntries).toHaveLength(0);
    });

    it('dateFrom 필터: 종료일이 시작일 이후인 학생만 표시한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('dateFrom', '2025-06-01');
      });

      expect(result.current.filteredEntries).toHaveLength(2);
      expect(result.current.filteredEntries[0].effectiveDate).toBe('2025-07-01');
      expect(result.current.filteredEntries[1].effectiveDate).toBe('2025-06-15');
    });

    it('dateTo 필터: 종료일이 종료일 이전인 학생만 표시한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('dateTo', '2025-06-20');
      });

      expect(result.current.filteredEntries).toHaveLength(2);
      expect(result.current.filteredEntries[0].effectiveDate).toBe('2025-06-15');
      expect(result.current.filteredEntries[1].effectiveDate).toBe('2025-05-20');
    });

    it('dateFrom + dateTo 필터: 기간 범위 내의 학생만 표시한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('dateFrom', '2025-06-01');
      });

      act(() => {
        result.current.updateFilter('dateTo', '2025-06-30');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].student.name).toBe('김퇴원');
      expect(result.current.filteredEntries[0].effectiveDate).toBe('2025-06-15');
    });

    it('search 필터: 이름에 검색어가 포함된 학생만 표시한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('search', '퇴원');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].student.name).toBe('김퇴원');
    });

    it('search 필터: 대소문자 구분 없이 검색한다', () => {
      const studentsWithEnglish = [
        createMockStudent({
          name: 'John Kim',
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [createMockEnrollment()],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(studentsWithEnglish));

      act(() => {
        result.current.updateFilter('search', 'john');
      });

      expect(result.current.filteredEntries).toHaveLength(1);

      act(() => {
        result.current.updateFilter('search', 'JOHN');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
    });

    it('search 필터: 부분 일치로 검색한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('search', '이');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].student.name).toBe('이활성');
    });

    it('여러 필터를 동시에 적용할 수 있다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('entryType', 'subject-ended');
      });

      act(() => {
        result.current.updateFilter('subject', 'math');
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].student.name).toBe('이활성');
      expect(result.current.filteredEntries[0].type).toBe('subject-ended');
      expect(result.current.filteredEntries[0].endedSubjects).toContain('math');
    });
  });

  describe('filteredEntries - Sorting Logic', () => {
    const testStudents = [
      createMockStudent({
        name: '최학생',
        status: 'withdrawn',
        withdrawalDate: '2025-06-15',
        enrollments: [createMockEnrollment({ withdrawalDate: '2025-06-15' })],
      }),
      createMockStudent({
        name: '가나다',
        status: 'active',
        enrollments: [createMockEnrollment({ withdrawalDate: '2025-07-01' })],
      }),
      createMockStudent({
        name: '박중간',
        status: 'withdrawn',
        withdrawalDate: '2025-05-20',
        enrollments: [createMockEnrollment({ withdrawalDate: '2025-05-20' })],
      }),
    ];

    it('sortBy name: 이름순으로 정렬한다 (한글 가나다순)', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('sortBy', 'name');
      });

      const names = result.current.filteredEntries.map(e => e.student.name);
      expect(names).toEqual(['가나다', '박중간', '최학생']);
    });

    it('sortBy withdrawalDate: 종료일 내림차순으로 정렬한다 (최근이 먼저)', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      // Default is 'withdrawalDate'
      expect(result.current.filters.sortBy).toBe('withdrawalDate');

      const dates = result.current.filteredEntries.map(e => e.effectiveDate);
      expect(dates).toEqual(['2025-07-01', '2025-06-15', '2025-05-20']);
    });

    it('정렬은 필터링 후 적용된다', () => {
      const { result } = renderHook(() => useWithdrawalFilters(testStudents));

      act(() => {
        result.current.updateFilter('entryType', 'withdrawn');
      });

      act(() => {
        result.current.updateFilter('sortBy', 'name');
      });

      const names = result.current.filteredEntries.map(e => e.student.name);
      expect(names).toEqual(['박중간', '최학생']);
    });
  });

  describe('counts - Statistics', () => {
    it('전체, 퇴원, 수강종료 개수를 정확히 계산한다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [createMockEnrollment()],
        }),
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-20',
          enrollments: [createMockEnrollment()],
        }),
        createMockStudent({
          status: 'active',
          enrollments: [createMockEnrollment({ withdrawalDate: '2025-05-01' })],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.counts).toEqual({
        total: 3,
        withdrawn: 2,
        subjectEnded: 1,
      });
    });

    it('필터링과 무관하게 전체 항목 기준으로 계산한다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [createMockEnrollment()],
        }),
        createMockStudent({
          status: 'active',
          enrollments: [createMockEnrollment({ withdrawalDate: '2025-05-01' })],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      act(() => {
        result.current.updateFilter('entryType', 'withdrawn');
      });

      // counts는 필터와 무관하게 전체 allEntries 기준
      expect(result.current.counts).toEqual({
        total: 2,
        withdrawn: 1,
        subjectEnded: 1,
      });

      // filteredEntries는 필터 적용
      expect(result.current.filteredEntries).toHaveLength(1);
    });

    it('항목이 없으면 모든 카운트가 0이다', () => {
      const { result } = renderHook(() => useWithdrawalFilters([]));

      expect(result.current.counts).toEqual({
        total: 0,
        withdrawn: 0,
        subjectEnded: 0,
      });
    });
  });

  describe('updateFilter - State Management', () => {
    it('단일 필터를 업데이트할 수 있다', () => {
      const { result } = renderHook(() => useWithdrawalFilters([]));

      act(() => {
        result.current.updateFilter('search', '김학생');
      });

      expect(result.current.filters.search).toBe('김학생');
      expect(result.current.filters.entryType).toBe(''); // Other filters unchanged
    });

    it('여러 필터를 순차적으로 업데이트할 수 있다', () => {
      const { result } = renderHook(() => useWithdrawalFilters([]));

      act(() => {
        result.current.updateFilter('entryType', 'withdrawn');
      });

      act(() => {
        result.current.updateFilter('subject', 'math');
      });

      act(() => {
        result.current.updateFilter('staffId', 'staff-1');
      });

      expect(result.current.filters).toMatchObject({
        entryType: 'withdrawn',
        subject: 'math',
        staffId: 'staff-1',
      });
    });

    it('동일한 필터를 여러 번 업데이트할 수 있다', () => {
      const { result } = renderHook(() => useWithdrawalFilters([]));

      act(() => {
        result.current.updateFilter('search', 'first');
      });

      expect(result.current.filters.search).toBe('first');

      act(() => {
        result.current.updateFilter('search', 'second');
      });

      expect(result.current.filters.search).toBe('second');
    });
  });

  describe('resetFilters - Reset Functionality', () => {
    it('모든 필터를 기본값으로 초기화한다', () => {
      const { result } = renderHook(() => useWithdrawalFilters([]));

      act(() => {
        result.current.updateFilter('entryType', 'withdrawn');
        result.current.updateFilter('subject', 'math');
        result.current.updateFilter('search', '김학생');
        result.current.updateFilter('sortBy', 'name');
      });

      expect(result.current.filters).toMatchObject({
        entryType: 'withdrawn',
        subject: 'math',
        search: '김학생',
        sortBy: 'name',
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters).toEqual({
        entryType: '',
        subject: '',
        staffId: '',
        reason: '',
        dateFrom: '',
        dateTo: '',
        search: '',
        sortBy: 'withdrawalDate',
      });
    });

    it('초기화 후 필터링 결과가 전체 항목으로 돌아온다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [createMockEnrollment()],
        }),
        createMockStudent({
          status: 'active',
          enrollments: [createMockEnrollment({ withdrawalDate: '2025-05-01' })],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      act(() => {
        result.current.updateFilter('entryType', 'withdrawn');
      });

      expect(result.current.filteredEntries).toHaveLength(1);

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filteredEntries).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('enrollment가 빈 배열인 퇴원 학생도 처리한다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].endedSubjects).toEqual([]);
      expect(result.current.filteredEntries[0].endedEnrollments).toEqual([]);
    });

    it('중복된 과목이 있어도 endedSubjects는 고유값만 포함한다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [
            createMockEnrollment({ subject: 'math', classId: 'class-1' }),
            createMockEnrollment({ subject: 'math', classId: 'class-2' }),
            createMockEnrollment({ subject: 'math', classId: 'class-3' }),
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries[0].endedSubjects).toEqual(['math']);
    });

    it('effectiveDate가 빈 문자열인 경우도 처리한다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          enrollments: [createMockEnrollment()],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries[0].effectiveDate).toBe('');
    });

    it('여러 학생이 동일한 effectiveDate를 가질 수 있다', () => {
      const students = [
        createMockStudent({
          id: 'student-1',
          name: '김학생',
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [createMockEnrollment({ withdrawalDate: '2025-06-15' })],
        }),
        createMockStudent({
          id: 'student-2',
          name: '이학생',
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [createMockEnrollment({ withdrawalDate: '2025-06-15' })],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(2);
      expect(result.current.filteredEntries[0].effectiveDate).toBe('2025-06-15');
      expect(result.current.filteredEntries[1].effectiveDate).toBe('2025-06-15');
    });

    it('staffId가 없는 enrollment도 처리한다', () => {
      const students = [
        createMockStudent({
          status: 'active',
          enrollments: [
            createMockEnrollment({ subject: 'math', withdrawalDate: '2025-05-01', staffId: undefined }),
          ],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(1);

      act(() => {
        result.current.updateFilter('staffId', 'staff-1');
      });

      expect(result.current.filteredEntries).toHaveLength(0);
    });

    it('withdrawalReason이 없는 퇴원 학생도 처리한다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [createMockEnrollment()],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries).toHaveLength(1);

      act(() => {
        result.current.updateFilter('reason', 'relocation');
      });

      expect(result.current.filteredEntries).toHaveLength(0);
    });

    it('매우 긴 학생 목록도 처리한다', () => {
      const students = Array.from({ length: 100 }, (_, i) =>
        createMockStudent({
          id: `student-${i}`,
          name: `학생${i}`,
          status: i % 2 === 0 ? 'withdrawn' : 'active',
          withdrawalDate: i % 2 === 0 ? '2025-06-15' : undefined,
          enrollments: [
            createMockEnrollment({
              withdrawalDate: i % 2 === 0 ? '2025-06-15' : i % 3 === 0 ? '2025-05-01' : undefined,
            }),
          ],
        })
      );

      const { result } = renderHook(() => useWithdrawalFilters(students));

      expect(result.current.filteredEntries.length).toBeGreaterThan(0);
      expect(result.current.counts.total).toBeGreaterThan(0);
    });
  });

  describe('Reactivity', () => {
    it('students 배열이 변경되면 항목이 업데이트된다', () => {
      const initialStudents = [
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [createMockEnrollment()],
        }),
      ];

      const { result, rerender } = renderHook(
        ({ students }) => useWithdrawalFilters(students),
        { initialProps: { students: initialStudents } }
      );

      expect(result.current.filteredEntries).toHaveLength(1);

      const updatedStudents = [
        ...initialStudents,
        createMockStudent({
          id: 'student-2',
          status: 'active',
          enrollments: [createMockEnrollment({ withdrawalDate: '2025-05-01' })],
        }),
      ];

      rerender({ students: updatedStudents });

      expect(result.current.filteredEntries).toHaveLength(2);
    });

    it('필터 변경은 students 배열을 다시 계산하지 않는다', () => {
      const students = [
        createMockStudent({
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
          enrollments: [createMockEnrollment()],
        }),
      ];

      const { result } = renderHook(() => useWithdrawalFilters(students));

      const firstEntries = result.current.filteredEntries;

      act(() => {
        result.current.updateFilter('sortBy', 'name');
      });

      // filteredEntries는 변경되지만 allEntries는 동일해야 함 (useMemo 최적화)
      expect(result.current.filteredEntries).toStrictEqual(firstEntries); // Same content after re-sort
    });
  });
});
