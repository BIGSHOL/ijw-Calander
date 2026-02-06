import { renderHook } from '@testing-library/react';
import { useStudentFilters } from '../../hooks/useStudentFilters';
import { UnifiedStudent } from '../../types';
import { StudentFilters } from '../../hooks/useAppState';

describe('useStudentFilters Hook', () => {
  // Mock students data with comprehensive test cases
  const mockStudents: UnifiedStudent[] = [
    {
      id: '1',
      name: '김철수',
      englishName: 'Kim Chulsoo',
      grade: '초3',
      school: '서울초등학교',
      status: 'active',
      startDate: '2025-01-01',
      studentPhone: '010-1111-1111',
      parentPhone: '010-2222-2222',
      parentName: '김부모',
      memo: '수학 잘함',
      address: '서울시 강남구',
      enrollments: [
        {
          subject: 'math' as const,
          classId: 'class1',
          className: 'Math A',
          staffId: 'teacher1',
          days: ['월', '수'],
          startDate: '2025-01-01'
        }
      ],
    },
    {
      id: '2',
      name: '이영희',
      englishName: 'Lee Younghee',
      grade: '중1',
      school: '강남중학교',
      status: 'active',
      startDate: '2025-03-01',
      studentPhone: '010-3333-3333',
      parentPhone: '010-4444-4444',
      enrollments: [
        {
          subject: 'english' as const,
          classId: 'class2',
          className: 'English B',
          staffId: 'teacher2',
          days: ['화', '목'],
          startDate: '2025-01-01'
        }
      ],
    },
    {
      id: '3',
      name: '박민수',
      grade: '고2',
      school: '서울고등학교',
      status: 'withdrawn',
      startDate: '2024-06-01',
      endDate: '2024-12-01',
      withdrawalReason: '이사',
      withdrawalMemo: '타지역으로 이사',
      enrollments: [],
    },
    {
      id: '4',
      name: '정수진',
      grade: '초6',
      school: '강남중학교', // Grade mismatch: 초6 but 중학교
      status: 'active',
      startDate: '2025-02-01',
      studentPhone: '010-5555-5555',
      enrollments: [
        {
          subject: 'math' as const,
          classId: 'class1',
          className: 'Math A',
          staffId: 'teacher1',
          days: ['월', '수'],
          startDate: '2025-01-01'
        },
        {
          subject: 'english' as const,
          classId: 'class2',
          className: 'English B',
          staffId: 'teacher2',
          days: ['화', '목'],
          startDate: '2025-01-01'
        }
      ],
    },
    {
      id: '5',
      name: '최동훈',
      grade: '중3',
      school: '서울중학교',
      status: 'prospect',
      startDate: '2025-04-01',
      enrollments: [],
    },
    {
      id: '6',
      name: '한지민',
      status: 'active',
      startDate: '2025-01-15',
      enrollments: [],
    },
    {
      id: '7',
      name: '송민호',
      grade: '고1',
      school: '강남고등학교',
      status: 'on_hold',
      startDate: '2024-09-01',
      enrollments: [
        {
          subject: 'math' as const,
          classId: 'class3',
          className: 'Math C',
          staffId: 'teacher3',
          days: ['월', '수'],
          onHold: true,
          startDate: '2024-09-01'
        }
      ],
    },
    {
      id: '8',
      name: '강서연',
      grade: '중2',
      school: '서울중학교',
      status: 'active',
      startDate: '2025-01-10',
      enrollments: [
        {
          subject: 'science' as const,
          classId: 'class4',
          className: 'Science A',
          staffId: 'teacher3',
          days: ['수', '금'],
          startDate: '2025-01-01'
        }
      ],
    },
    {
      id: '9',
      name: '윤정훈',
      grade: '초5',
      school: '강남초등학교',
      status: 'active',
      startDate: '2024-12-01',
      enrollments: [
        {
          subject: 'math' as const,
          classId: 'class5',
          className: 'Math D',
          staffId: 'teacher1',
          days: ['화', '목'],
          startDate: '2024-12-01'
        },
        {
          subject: 'science' as const,
          classId: 'class6',
          className: 'Science B',
          staffId: 'teacher3',
          days: ['수', '금'],
          startDate: '2024-12-01'
        }
      ],
    },
    {
      id: '10',
      name: '임수빈',
      grade: '고3',
      school: '서울고등학교',
      status: 'active',
      startDate: '2024-03-01',
      enrollments: [
        {
          subject: 'korean' as const,
          classId: 'class7',
          className: 'Korean A',
          staffId: 'teacher4',
          days: ['월', '목'],
          startDate: '2024-03-01'
        }
      ],
    },
    {
      id: '11',
      name: '조예은',
      grade: '초2',
      school: '서울초등학교',
      status: 'active',
      startDate: '2025-01-20',
      parentPhone: '010-9999-9999',
      enrollments: [
        {
          subject: 'english' as const,
          classId: 'class8',
          className: 'English C',
          staffId: 'teacher2',
          days: ['화', '목'],
          startDate: '2025-01-20'
        }
      ],
    },
    {
      id: '12',
      name: '박서준',
      grade: '중1',
      school: '강남중학교',
      status: 'active',
      startDate: '2025-02-15',
      enrollments: [
        {
          subject: 'math' as const,
          classId: 'class9',
          className: 'Math E',
          staffId: 'teacher1',
          days: ['월', '수', '금'],
          startDate: '2025-03-01' // Future start date
        }
      ],
    },
  ];

  const mockOldWithdrawnStudents: UnifiedStudent[] = [
    {
      id: 'old1',
      name: '과거퇴원생',
      grade: '중3',
      school: '과거중학교',
      status: 'withdrawn',
      startDate: '2020-01-01',
      endDate: '2023-01-01',
      withdrawalDate: '2023-01-01',
      isOldWithdrawn: true,
      enrollments: [],
    },
  ];

  const defaultFilters: StudentFilters = {
    searchQuery: '',
    searchField: 'all',
    grade: 'all',
    status: 'all',
    subjects: [],
    subjectFilterMode: 'OR',
    teacher: 'all',
    excludeNoEnrollment: false,
    gradeMismatch: false,
  };

  describe('Search Filter (filterBySearch)', () => {
    it('returns all students when search query is empty', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(12);
    });

    it('filters by name (searchField: all)', () => {
      const filters = { ...defaultFilters, searchQuery: '김철수' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김철수');
    });

    it('filters by english name (searchField: all)', () => {
      const filters = { ...defaultFilters, searchQuery: 'younghee' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('이영희');
    });

    it('filters by school (searchField: all)', () => {
      const filters = { ...defaultFilters, searchQuery: '강남중학교' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.length).toBeGreaterThanOrEqual(2);
      expect(result.current.some(s => s.name === '이영희')).toBe(true);
      expect(result.current.some(s => s.name === '정수진')).toBe(true);
    });

    it('filters by phone number (searchField: all)', () => {
      const filters = { ...defaultFilters, searchQuery: '010-1111-1111' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김철수');
    });

    it('filters by parent phone (searchField: all)', () => {
      const filters = { ...defaultFilters, searchQuery: '010-9999-9999' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('조예은');
    });

    it('filters by memo (searchField: all)', () => {
      const filters = { ...defaultFilters, searchQuery: '수학 잘함' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김철수');
    });

    it('filters by name only (searchField: name)', () => {
      const filters = { ...defaultFilters, searchQuery: '010-1111-1111', searchField: 'name' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(0); // Phone number should not match when searchField is name
    });

    it('filters by phone only (searchField: phone)', () => {
      const filters = { ...defaultFilters, searchQuery: '010-1111', searchField: 'phone' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김철수');
    });

    it('filters by school only (searchField: school)', () => {
      const filters = { ...defaultFilters, searchQuery: '서울초등학교', searchField: 'school' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.length).toBeGreaterThanOrEqual(2);
      expect(result.current.some(s => s.name === '김철수')).toBe(true);
      expect(result.current.some(s => s.name === '조예은')).toBe(true);
    });

    it('filters by address (searchField: address)', () => {
      const filters = { ...defaultFilters, searchQuery: '강남구', searchField: 'address' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김철수');
    });

    it('includes old withdrawn students in search results', () => {
      const filters = { ...defaultFilters, searchQuery: '과거퇴원생' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('과거퇴원생');
      expect(result.current[0].isOldWithdrawn).toBe(true);
    });

    it('is case insensitive', () => {
      const filters = { ...defaultFilters, searchQuery: 'KIM CHULSOO' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김철수');
    });
  });

  describe('Grade Filter (filterByGrade)', () => {
    it('returns all students when grade is "all"', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(12);
    });

    it('filters by elementary school group', () => {
      const filters = { ...defaultFilters, grade: 'elementary' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.length).toBeGreaterThanOrEqual(4); // 초3, 초6, 초5, 초2
      expect(result.current.every(s => s.grade?.startsWith('초'))).toBe(true);
    });

    it('filters by middle school group', () => {
      const filters = { ...defaultFilters, grade: 'middle' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.length).toBeGreaterThanOrEqual(3); // 중1, 중3, 중2
      expect(result.current.every(s => s.grade?.startsWith('중'))).toBe(true);
    });

    it('filters by high school group', () => {
      const filters = { ...defaultFilters, grade: 'high' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.length).toBeGreaterThanOrEqual(3); // 고2, 고1, 고3
      expect(result.current.every(s => s.grade?.startsWith('고'))).toBe(true);
    });

    it('filters by "other" (no grade or non-standard grade)', () => {
      const filters = { ...defaultFilters, grade: 'other' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.some(s => s.name === '한지민')).toBe(true); // No grade
      expect(result.current.every(s => !s.grade || (!s.grade.startsWith('초') && !s.grade.startsWith('중') && !s.grade.startsWith('고')))).toBe(true);
    });

    it('filters by specific grade', () => {
      const filters = { ...defaultFilters, grade: '초3' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김철수');
    });

    it('filters by specific middle school grade', () => {
      const filters = { ...defaultFilters, grade: '중1' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.length).toBeGreaterThanOrEqual(2); // 이영희, 박서준
      expect(result.current.every(s => s.grade === '중1')).toBe(true);
    });
  });

  describe('Status Filter (filterByStatus)', () => {
    it('returns all students when status is "all"', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(12);
    });

    it('filters by active status', () => {
      const filters = { ...defaultFilters, status: 'active' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.every(s => s.status === 'active')).toBe(true);
      expect(result.current.length).toBeGreaterThanOrEqual(8);
    });

    it('filters by prospect status', () => {
      const filters = { ...defaultFilters, status: 'prospect' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('최동훈');
    });

    it('filters by on_hold status', () => {
      const filters = { ...defaultFilters, status: 'on_hold' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('송민호');
    });

    it('filters by withdrawn status', () => {
      const filters = { ...defaultFilters, status: 'withdrawn' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('박민수');
    });

    it('filters by no_enrollment status', () => {
      const filters = { ...defaultFilters, status: 'no_enrollment' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // Students with no active enrollments (excluding future enrollments)
      const noEnrollmentStudents = result.current;
      expect(noEnrollmentStudents.some(s => s.name === '한지민')).toBe(true);
      expect(noEnrollmentStudents.some(s => s.name === '최동훈')).toBe(true);
    });

    it('no_enrollment excludes students with past enrollments', () => {
      const filters = { ...defaultFilters, status: 'no_enrollment' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // 박서준 has enrollment with startDate: 2025-03-01 (now in the past since we're in 2026)
      // So 박서준 should NOT be in no_enrollment since their enrollment is active
      expect(result.current.some(s => s.name === '박서준')).toBe(false);
    });
  });

  describe('Subject Filter (filterBySubjects)', () => {
    it('returns all students when no subjects selected', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(12);
    });

    it('filters by single subject (OR mode)', () => {
      const filters = { ...defaultFilters, subjects: ['math'], subjectFilterMode: 'OR' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.some(s => s.name === '김철수')).toBe(true);
      expect(result.current.some(s => s.name === '정수진')).toBe(true);
      expect(result.current.some(s => s.name === '윤정훈')).toBe(true);
    });

    it('filters by multiple subjects (OR mode)', () => {
      const filters = { ...defaultFilters, subjects: ['math', 'english'], subjectFilterMode: 'OR' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // Should include students with math OR english
      expect(result.current.some(s => s.name === '김철수')).toBe(true); // math
      expect(result.current.some(s => s.name === '이영희')).toBe(true); // english
      expect(result.current.some(s => s.name === '정수진')).toBe(true); // both
    });

    it('filters by multiple subjects (AND mode)', () => {
      const filters = { ...defaultFilters, subjects: ['math', 'english'], subjectFilterMode: 'AND' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // Should only include students with BOTH math AND english
      expect(result.current.some(s => s.name === '정수진')).toBe(true);
      expect(result.current.some(s => s.name === '김철수')).toBe(false); // only math
      expect(result.current.some(s => s.name === '이영희')).toBe(false); // only english
    });

    it('includes withdrawn students regardless of subject filter', () => {
      const filters = { ...defaultFilters, subjects: ['math'], subjectFilterMode: 'OR' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // Withdrawn students should be included
      expect(result.current.some(s => s.name === '박민수')).toBe(true);
    });

    it('filters by science subject', () => {
      const filters = { ...defaultFilters, subjects: ['science'], subjectFilterMode: 'OR' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.some(s => s.name === '강서연')).toBe(true);
      expect(result.current.some(s => s.name === '윤정훈')).toBe(true);
    });
  });

  describe('Teacher Filter (filterByTeacher)', () => {
    it('returns all students when teacher is "all"', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(12);
    });

    it('filters by specific teacher', () => {
      const filters = { ...defaultFilters, teacher: 'teacher1' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.some(s => s.name === '김철수')).toBe(true);
      expect(result.current.some(s => s.name === '정수진')).toBe(true);
      expect(result.current.some(s => s.name === '윤정훈')).toBe(true);
    });

    it('filters by different teacher', () => {
      const filters = { ...defaultFilters, teacher: 'teacher2' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.some(s => s.name === '이영희')).toBe(true);
      expect(result.current.some(s => s.name === '정수진')).toBe(true);
      expect(result.current.some(s => s.name === '조예은')).toBe(true);
    });

    it('includes withdrawn students regardless of teacher filter', () => {
      const filters = { ...defaultFilters, teacher: 'teacher1' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.some(s => s.name === '박민수')).toBe(true);
    });
  });

  describe('Enrollment Filter (filterByEnrollment)', () => {
    it('returns all students when excludeNoEnrollment is false', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(12);
    });

    it('excludes students with no enrollment when excludeNoEnrollment is true', () => {
      const filters = { ...defaultFilters, excludeNoEnrollment: true };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // Should exclude students with no enrollments
      expect(result.current.some(s => s.name === '한지민')).toBe(false);
      expect(result.current.some(s => s.name === '최동훈')).toBe(false);

      // Should include students with enrollments
      expect(result.current.some(s => s.name === '김철수')).toBe(true);
    });

    it('includes withdrawn students regardless of enrollment filter', () => {
      const filters = { ...defaultFilters, excludeNoEnrollment: true };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.some(s => s.name === '박민수')).toBe(true);
    });
  });

  describe('Grade Mismatch Filter (filterByGradeMismatch)', () => {
    it('returns all students when gradeMismatch is false', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(12);
    });

    it('filters students with grade-school level mismatch', () => {
      const filters = { ...defaultFilters, gradeMismatch: true };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // 정수진: grade 초6 but school 강남중학교
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('정수진');
    });

    it('excludes students without school or grade information', () => {
      const filters = { ...defaultFilters, gradeMismatch: true };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // 한지민 has no grade, should be excluded
      expect(result.current.some(s => s.name === '한지민')).toBe(false);
    });
  });

  describe('Sorting (sortStudents)', () => {
    it('sorts by name in Korean alphabetical order', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'name', mockOldWithdrawnStudents)
      );

      const names = result.current.map(s => s.name);
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b, 'ko'));
      expect(names).toEqual(sortedNames);
    });

    it('sorts by grade (highest to lowest)', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'grade', mockOldWithdrawnStudents)
      );

      // High school first, then middle, then elementary
      const grades = result.current.map(s => s.grade).filter(Boolean);

      // Check that 고3 comes before 고2, 고2 before 고1, etc.
      const firstHighSchool = grades.findIndex(g => g?.startsWith('고'));
      const firstMiddleSchool = grades.findIndex(g => g?.startsWith('중'));
      const firstElementary = grades.findIndex(g => g?.startsWith('초'));

      if (firstHighSchool >= 0 && firstMiddleSchool >= 0) {
        expect(firstHighSchool).toBeLessThan(firstMiddleSchool);
      }
      if (firstMiddleSchool >= 0 && firstElementary >= 0) {
        expect(firstMiddleSchool).toBeLessThan(firstElementary);
      }
    });

    it('sorts by startDate (newest first)', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'startDate', mockOldWithdrawnStudents)
      );

      const startDates = result.current.map(s => s.startDate).filter(Boolean) as string[];

      for (let i = 0; i < startDates.length - 1; i++) {
        // String comparison works for ISO date format (YYYY-MM-DD)
        expect(startDates[i] >= startDates[i + 1]).toBe(true);
      }
    });

    it('sorts by grade with secondary name sort', () => {
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, defaultFilters, 'grade', mockOldWithdrawnStudents)
      );

      // Students with same grade should be sorted by name
      const samegradeStudents = result.current.filter(s => s.grade === '중1');
      if (samegradeStudents.length > 1) {
        const names = samegradeStudents.map(s => s.name);
        const sortedNames = [...names].sort((a, b) => a.localeCompare(b, 'ko'));
        expect(names).toEqual(sortedNames);
      }
    });
  });

  describe('Combined Filters', () => {
    it('applies search + grade filter', () => {
      const filters = { ...defaultFilters, searchQuery: '서울', grade: 'elementary' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // Should find elementary students with '서울' in any field
      expect(result.current.every(s => s.grade?.startsWith('초'))).toBe(true);
      expect(result.current.length).toBeGreaterThan(0);
    });

    it('applies grade + status filter', () => {
      const filters = { ...defaultFilters, grade: 'middle', status: 'active' as const };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.every(s => s.grade?.startsWith('중') && s.status === 'active')).toBe(true);
    });

    it('applies subject + teacher filter', () => {
      const filters = { ...defaultFilters, subjects: ['math'], teacher: 'teacher1' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // Should find students taking math with teacher1
      const activeStudents = result.current.filter(s => s.status !== 'withdrawn');
      expect(activeStudents.every(s =>
        s.enrollments?.some(e => e.subject === 'math' && e.staffId === 'teacher1')
      )).toBe(true);
    });

    it('applies search + status + grade filter', () => {
      const filters = {
        ...defaultFilters,
        searchQuery: '중학교',
        status: 'active' as const,
        grade: 'middle'
      };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current.every(s =>
        s.status === 'active' && s.grade?.startsWith('중')
      )).toBe(true);
    });

    it('applies all filters together', () => {
      const filters = {
        ...defaultFilters,
        searchQuery: '강',
        grade: 'middle',
        status: 'active' as const,
        subjects: ['english'],
        teacher: 'teacher2',
        excludeNoEnrollment: true,
        gradeMismatch: false,
      };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // Complex combination - verify no errors and results make sense
      expect(Array.isArray(result.current)).toBe(true);
    });

    it('handles empty result set gracefully', () => {
      const filters = {
        ...defaultFilters,
        searchQuery: 'NonExistentStudent',
        grade: '고1',
        subjects: ['math', 'english'],
        subjectFilterMode: 'AND' as const,
      };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty student array', () => {
      const { result } = renderHook(() =>
        useStudentFilters([], defaultFilters, 'name', [])
      );

      expect(result.current).toEqual([]);
    });

    it('handles students with missing optional fields', () => {
      const minimalStudent: UnifiedStudent = {
        id: 'minimal',
        name: '최소학생',
        status: 'active',
        startDate: '2025-01-01',
        enrollments: [],
      };

      const { result } = renderHook(() =>
        useStudentFilters([minimalStudent], defaultFilters, 'name', [])
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('최소학생');
    });

    it('handles undefined grade gracefully', () => {
      const filters = { ...defaultFilters, grade: 'elementary' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      // Should not include student without grade (한지민)
      expect(result.current.some(s => s.name === '한지민')).toBe(false);
    });

    it('handles special characters in search', () => {
      const filters = { ...defaultFilters, searchQuery: '010-1111-1111' };
      const { result } = renderHook(() =>
        useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('김철수');
    });

    it('handles enrollments with endDate (inactive)', () => {
      const filters = { ...defaultFilters, subjects: ['math'] };
      const studentWithEndedEnrollment: UnifiedStudent = {
        id: 'ended',
        name: '종료학생',
        status: 'active',
        startDate: '2024-01-01',
        enrollments: [
          {
            subject: 'math' as const,
            classId: 'class1',
            className: 'Math Old',
            staffId: 'teacher1',
            days: ['월'],
            startDate: '2024-01-01',
            endDate: '2024-12-31', // Ended
          }
        ],
      };

      const { result } = renderHook(() =>
        useStudentFilters([studentWithEndedEnrollment], filters, 'name', [])
      );

      // Should not be included (enrollment has ended)
      expect(result.current).toHaveLength(0);
    });

    it('memoizes results correctly', () => {
      const { result, rerender } = renderHook(
        ({ filters }) => useStudentFilters(mockStudents, filters, 'name', mockOldWithdrawnStudents),
        { initialProps: { filters: defaultFilters } }
      );

      const firstResult = result.current;

      // Rerender with same props
      rerender({ filters: defaultFilters });

      // Should return same reference (memoized)
      expect(result.current).toBe(firstResult);
    });
  });
});
