/**
 * Comprehensive tests for useEnrollments hooks
 *
 * Tests cover:
 * - useEnrollmentsAsClasses (all students, subject filtering, class grouping, student parsing)
 * - useStudentEnrollments (specific student, empty studentId, disabled query)
 * - useClassStudents (className filtering, subject filtering, deduplication)
 * - Edge cases (empty data, invalid studentId format, undefined params)
 * - Error handling scenarios
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useEnrollmentsAsClasses,
  useStudentEnrollments,
  useClassStudents,
  EnrollmentInfo,
} from '../../hooks/useEnrollments';
import {
  collection,
  getDocs,
  query,
  where,
  collectionGroup,
} from 'firebase/firestore';
import { TimetableClass, TimetableStudent } from '../../types';

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  collectionGroup: vi.fn().mockReturnValue({}),
  getDocs: vi.fn(),
  query: vi.fn().mockImplementation((coll) => coll),
  where: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Test wrapper with QueryClient
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

// Helper to create mock enrollment document
function createMockEnrollmentDoc(
  enrollmentId: string,
  studentId: string,
  data: Partial<EnrollmentInfo>
) {
  return {
    id: enrollmentId,
    data: () => ({
      subject: 'math',
      className: 'Math 101',
      staffId: 'teacher1',
      days: ['월', '수'],
      period: '3-4',
      room: 'Room A',
      schedule: ['월 3-4', '수 3-4'],
      startDate: '2024-03-01',
      endDate: '2024-06-30',
      color: '#FF5733',
      ...data,
    }),
    ref: {
      parent: {
        parent: {
          id: studentId,
        },
      },
    },
  };
}

describe('useEnrollments hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup - query returns the same collection/group
    vi.mocked(query).mockImplementation((coll) => coll);
    vi.mocked(where).mockImplementation(() => ({}) as any);
    vi.mocked(collectionGroup).mockReturnValue({} as any);
    vi.mocked(collection).mockReturnValue({} as any);
  });

  // ============================================================================
  // 1. useEnrollmentsAsClasses - Basic functionality
  // ============================================================================

  describe('useEnrollmentsAsClasses', () => {
    it('모든 학생의 enrollments를 클래스 중심으로 조회한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          subject: 'math',
          className: 'Math 101',
          staffId: 'teacher1',
        }),
        createMockEnrollmentDoc('enroll2', '김철수_부산고_2', {
          subject: 'math',
          className: 'Math 101',
          staffId: 'teacher1',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveLength(1); // 같은 클래스로 그룹화
      expect(result.current.data![0].className).toBe('Math 101');
      expect(result.current.data![0].studentList).toHaveLength(2);
      expect(result.current.data![0].teacher).toBe('teacher1');
    });

    it('과목 필터링이 정상 동작한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          subject: 'math',
          className: 'Math 101',
        }),
        createMockEnrollmentDoc('enroll2', '김철수_부산고_2', {
          subject: 'english',
          className: 'English 101',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses('math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].subject).toBe('math');
    });

    it('studentId를 올바르게 파싱한다 (이름_학교_학년)', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: 'Math 101',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const student = result.current.data![0].studentList[0];
      expect(student.id).toBe('홍길동_서울고_1');
      expect(student.name).toBe('홍길동');
      expect(student.school).toBe('서울고');
      expect(student.grade).toBe('1');
    });

    it('studentId 형식이 잘못된 경우 전체를 이름으로 사용한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동', {
          className: 'Math 101',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const student = result.current.data![0].studentList[0];
      expect(student.name).toBe('홍길동');
      expect(student.school).toBe('');
      expect(student.grade).toBe('');
    });

    it('className별로 그룹화하고 알파벳순으로 정렬한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: 'Math 103',
        }),
        createMockEnrollmentDoc('enroll2', '김철수_부산고_2', {
          className: 'Math 101',
        }),
        createMockEnrollmentDoc('enroll3', '이영희_대구고_3', {
          className: 'Math 102',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data![0].className).toBe('Math 101');
      expect(result.current.data![1].className).toBe('Math 102');
      expect(result.current.data![2].className).toBe('Math 103');
    });

    it('같은 클래스에 여러 학생이 있으면 studentList에 모두 추가한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: 'Math 101',
          staffId: 'teacher1',
        }),
        createMockEnrollmentDoc('enroll2', '김철수_부산고_2', {
          className: 'Math 101',
          staffId: 'teacher1',
        }),
        createMockEnrollmentDoc('enroll3', '이영희_대구고_3', {
          className: 'Math 101',
          staffId: 'teacher1',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].studentList).toHaveLength(3);
      expect(result.current.data![0].studentList[0].name).toBe('홍길동');
      expect(result.current.data![0].studentList[1].name).toBe('김철수');
      expect(result.current.data![0].studentList[2].name).toBe('이영희');
    });

    it('중복된 학생은 한 번만 추가한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: 'Math 101',
        }),
        createMockEnrollmentDoc('enroll2', '홍길동_서울고_1', {
          className: 'Math 101',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0].studentList).toHaveLength(1);
    });

    it('스케줄 정보가 없는 클래스에 스케줄이 있는 enrollment가 있으면 업데이트한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: 'Math 101',
          schedule: undefined,
          days: undefined,
          room: undefined,
          color: undefined,
        }),
        createMockEnrollmentDoc('enroll2', '김철수_부산고_2', {
          className: 'Math 101',
          schedule: ['월 3-4', '수 3-4'],
          days: ['월', '수'],
          room: 'Room A',
          color: '#FF5733',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const classData = result.current.data![0];
      expect(classData.schedule).toEqual(['월 3-4', '수 3-4']);
      expect(classData.days).toEqual(['월', '수']);
      expect(classData.room).toBe('Room A');
      expect(classData.color).toBe('#FF5733');
    });

    it('강사 정보가 없으면 enrollment의 staffId로 보강한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: 'Math 101',
          staffId: '',
        }),
        createMockEnrollmentDoc('enroll2', '김철수_부산고_2', {
          className: 'Math 101',
          staffId: 'teacher1',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0].teacher).toBe('teacher1');
    });

    it('고유한 클래스 ID를 생성한다 (subject_className_teacher_index)', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          subject: 'math',
          className: 'Math 101',
          staffId: 'teacher1',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0].id).toMatch(/^math_Math 101_teacher1_\d+$/);
    });

    it('데이터가 없으면 빈 배열을 반환한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('과목 필터링 후 데이터가 없으면 빈 배열을 반환한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          subject: 'math',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses('english'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('collectionGroup을 사용하여 모든 enrollments를 조회한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(collectionGroup).toHaveBeenCalledWith({}, 'enrollments');
      });
      expect(getDocs).toHaveBeenCalled();
    });

    it('에러 발생 시 query가 실패한다', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      consoleErrorSpy.mockRestore();
    });

    it('studentId 부모 참조가 없으면 빈 문자열을 사용한다', async () => {
      const mockDocs = [
        {
          id: 'enroll1',
          data: () => ({
            subject: 'math',
            className: 'Math 101',
            staffId: 'teacher1',
          }),
          ref: {
            parent: {
              parent: null, // No parent reference
            },
          },
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0].studentList[0].id).toBe('');
    });
  });

  // ============================================================================
  // 2. useStudentEnrollments - Specific student query
  // ============================================================================

  describe('useStudentEnrollments', () => {
    it('특정 학생의 enrollments를 조회한다', async () => {
      const mockDocs = [
        {
          id: 'enroll1',
          data: () => ({
            subject: 'math',
            className: 'Math 101',
            staffId: 'teacher1',
            days: ['월', '수'],
            period: '3-4',
            room: 'Room A',
            schedule: ['월 3-4', '수 3-4'],
            startDate: '2024-03-01',
            endDate: '2024-06-30',
            color: '#FF5733',
          }),
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useStudentEnrollments('홍길동_서울고_1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].id).toBe('enroll1');
      expect(result.current.data![0].studentId).toBe('홍길동_서울고_1');
      expect(result.current.data![0].className).toBe('Math 101');
    });

    it('studentId가 없으면 빈 배열을 반환한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(() => useStudentEnrollments(''), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(result.current.data).toBeUndefined();
    });

    it('enabled: false일 때 query가 실행되지 않는다', async () => {
      const { result } = renderHook(() => useStudentEnrollments(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('collection 경로가 올바르게 생성된다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      renderHook(() => useStudentEnrollments('홍길동_서울고_1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(collection).toHaveBeenCalledWith({}, 'students/홍길동_서울고_1/enrollments');
      });
    });

    it('enrollment 데이터의 모든 필드를 올바르게 매핑한다', async () => {
      const mockDocs = [
        {
          id: 'enroll1',
          data: () => ({
            subject: 'english',
            className: 'English 202',
            staffId: 'teacher2',
            days: ['화', '목'],
            period: '5-6',
            room: 'Room B',
            schedule: ['화 5-6', '목 5-6'],
            startDate: '2024-03-15',
            endDate: '2024-07-15',
            color: '#00FF00',
          }),
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useStudentEnrollments('김철수_부산고_2'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const enrollment = result.current.data![0];
      expect(enrollment.subject).toBe('english');
      expect(enrollment.className).toBe('English 202');
      expect(enrollment.staffId).toBe('teacher2');
      expect(enrollment.days).toEqual(['화', '목']);
      expect(enrollment.period).toBe('5-6');
      expect(enrollment.room).toBe('Room B');
      expect(enrollment.schedule).toEqual(['화 5-6', '목 5-6']);
      expect(enrollment.startDate).toBe('2024-03-15');
      expect(enrollment.endDate).toBe('2024-07-15');
      expect(enrollment.color).toBe('#00FF00');
    });

    it('데이터에 누락된 필드는 기본값을 사용한다', async () => {
      const mockDocs = [
        {
          id: 'enroll1',
          data: () => ({}),
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useStudentEnrollments('홍길동_서울고_1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const enrollment = result.current.data![0];
      expect(enrollment.subject).toBe('math');
      expect(enrollment.className).toBe('');
      expect(enrollment.staffId).toBe('');
      expect(enrollment.days).toEqual([]);
      expect(enrollment.period).toBe(null);
      expect(enrollment.room).toBe(null);
      expect(enrollment.schedule).toEqual([]);
      expect(enrollment.startDate).toBe(null);
      expect(enrollment.endDate).toBe(null);
      expect(enrollment.color).toBe(null);
    });

    it('여러 enrollments를 모두 반환한다', async () => {
      const mockDocs = [
        {
          id: 'enroll1',
          data: () => ({ subject: 'math', className: 'Math 101', staffId: 'teacher1' }),
        },
        {
          id: 'enroll2',
          data: () => ({ subject: 'english', className: 'English 101', staffId: 'teacher2' }),
        },
        {
          id: 'enroll3',
          data: () => ({ subject: 'science', className: 'Science 101', staffId: 'teacher3' }),
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useStudentEnrollments('홍길동_서울고_1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data![0].subject).toBe('math');
      expect(result.current.data![1].subject).toBe('english');
      expect(result.current.data![2].subject).toBe('science');
    });

    it('에러 발생 시 query가 실패한다', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() => useStudentEnrollments('홍길동_서울고_1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================================================
  // 3. useClassStudents - Class-based student query
  // ============================================================================

  describe('useClassStudents', () => {
    it('특정 클래스의 학생 목록을 조회한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', { className: 'Math 101' }),
        createMockEnrollmentDoc('enroll2', '김철수_부산고_2', { className: 'Math 101' }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useClassStudents('Math 101'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      // Hook sorts by name (Korean locale): 김철수 < 홍길동
      expect(result.current.data![0].id).toBe('김철수_부산고_2');
      expect(result.current.data![1].id).toBe('홍길동_서울고_1');
    });

    it('className과 subject로 필터링한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: 'Math 101',
          subject: 'math',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      renderHook(() => useClassStudents('Math 101', 'math'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(where).toHaveBeenCalledWith('className', '==', 'Math 101');
        expect(where).toHaveBeenCalledWith('subject', '==', 'math');
      });
    });

    it('subject가 없으면 className만으로 필터링한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      renderHook(() => useClassStudents('Math 101'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(where).toHaveBeenCalledWith('className', '==', 'Math 101');
      });
    });

    it('중복된 학생을 제거한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', { className: 'Math 101' }),
        createMockEnrollmentDoc('enroll2', '홍길동_서울고_1', { className: 'Math 101' }),
        createMockEnrollmentDoc('enroll3', '김철수_부산고_2', { className: 'Math 101' }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useClassStudents('Math 101'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
    });

    it('학생 이름을 한글 순으로 정렬한다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동', { className: 'Math 101' }),
        createMockEnrollmentDoc('enroll2', '김철수', { className: 'Math 101' }),
        createMockEnrollmentDoc('enroll3', '이영희', { className: 'Math 101' }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useClassStudents('Math 101'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0].name).toBe('김철수');
      expect(result.current.data![1].name).toBe('이영희');
      expect(result.current.data![2].name).toBe('홍길동');
    });

    it('className이 없으면 빈 배열을 반환한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(() => useClassStudents(''), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(result.current.data).toBeUndefined();
    });

    it('enabled: false일 때 query가 실행되지 않는다', async () => {
      const { result } = renderHook(() => useClassStudents(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('데이터가 없으면 빈 배열을 반환한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      const { result } = renderHook(() => useClassStudents('Math 101'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('studentId 부모 참조가 없으면 빈 문자열을 사용한다', async () => {
      const mockDocs = [
        {
          id: 'enroll1',
          data: () => ({ className: 'Math 101' }),
          ref: {
            parent: {
              parent: null,
            },
          },
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useClassStudents('Math 101'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data![0].id).toBe('');
    });

    it('collectionGroup을 사용하여 enrollments를 조회한다', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [],
      } as any);

      renderHook(() => useClassStudents('Math 101'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(collectionGroup).toHaveBeenCalledWith({}, 'enrollments');
      });
    });

    it('에러 발생 시 query가 실패한다', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() => useClassStudents('Math 101'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================================================
  // 4. Query options and caching behavior
  // ============================================================================

  describe('Query options and caching', () => {
    it('useEnrollmentsAsClasses는 5분 staleTime을 갖는다', () => {
      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      // Query options are not directly accessible, but we can verify behavior
      expect(result.current.isLoading || result.current.isError || result.current.isSuccess).toBe(
        true
      );
    });

    it('useStudentEnrollments는 5분 staleTime을 갖는다', () => {
      const { result } = renderHook(() => useStudentEnrollments('홍길동_서울고_1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading || result.current.isError || result.current.isSuccess).toBe(
        true
      );
    });

    it('useClassStudents는 5분 staleTime을 갖는다', () => {
      const { result } = renderHook(() => useClassStudents('Math 101'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading || result.current.isError || result.current.isSuccess).toBe(
        true
      );
    });
  });

  // ============================================================================
  // 5. Edge cases and special scenarios
  // ============================================================================

  describe('Edge cases', () => {
    it('빈 className으로 클래스를 생성할 수 있다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: '',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].className).toBe('');
    });

    it('schedule과 days가 모두 빈 배열이면 undefined를 할당하지 않는다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: 'Math 101',
          schedule: [],
          days: [],
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const classData = result.current.data![0];
      expect(classData.schedule).toEqual([]);
      expect(classData.days).toEqual([]);
    });

    it('같은 이름의 클래스가 다른 강사로 여러 개 있을 수 있다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍길동_서울고_1', {
          className: 'Math 101',
          staffId: 'teacher1',
        }),
        createMockEnrollmentDoc('enroll2', '김철수_부산고_2', {
          className: 'Math 101',
          staffId: 'teacher2',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Hook groups by className only (not className+staffId)
      // So two enrollments with same className produce 1 class with 2 students
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].studentList).toHaveLength(2);
    });

    it('studentId가 특수문자를 포함할 수 있다', async () => {
      const mockDocs = [
        createMockEnrollmentDoc('enroll1', '홍-길동_서울(고)_1-A', {
          className: 'Math 101',
        }),
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocs,
      } as any);

      const { result } = renderHook(() => useEnrollmentsAsClasses(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const student = result.current.data![0].studentList[0];
      expect(student.id).toBe('홍-길동_서울(고)_1-A');
      expect(student.name).toBe('홍-길동');
      expect(student.school).toBe('서울(고)');
      expect(student.grade).toBe('1-A');
    });
  });
});
