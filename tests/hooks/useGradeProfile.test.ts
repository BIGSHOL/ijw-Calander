/**
 * useGradeProfile.ts 테스트
 * - 레벨테스트 관리 (Query/Mutation)
 * - 목표 점수 관리 (Query/Mutation)
 * - 강사 코멘트 관리 (Query/Mutation)
 * - 유틸리티 함수 (determineLevel, getCurrentPeriod)
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useAllLevelTests,
  useConsultationLevelTests,
  useStudentConsultationLevelTests,
  useLevelTests,
  useAddLevelTest,
  useUpdateLevelTest,
  useDeleteLevelTest,
  useGoalSettings,
  useGoalByExam,
  useAddGoalSetting,
  useUpdateGoalAchievement,
  useDeleteGoalSetting,
  useGradeComments,
  useLatestComments,
  useAddGradeComment,
  useUpdateGradeComment,
  useDeleteGradeComment,
  determineLevel,
  getCurrentPeriod,
} from '../../hooks/useGradeProfile';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

describe('useGradeProfile', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    // expect.anything()는 undefined를 매칭하지 않으므로 mock 반환값 설정
    (doc as any).mockReturnValue({});
    (collection as any).mockReturnValue({});
  });

  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  // ============ 유틸리티 함수 테스트 ============

  describe('determineLevel', () => {
    describe('Math levels', () => {
      it('90 이상이면 "최상급"을 반환한다', () => {
        expect(determineLevel('math', 90)).toBe('최상급');
        expect(determineLevel('math', 95)).toBe('최상급');
        expect(determineLevel('math', 100)).toBe('최상급');
      });

      it('80~89이면 "상급"을 반환한다', () => {
        expect(determineLevel('math', 80)).toBe('상급');
        expect(determineLevel('math', 85)).toBe('상급');
        expect(determineLevel('math', 89)).toBe('상급');
      });

      it('70~79이면 "중급"을 반환한다', () => {
        expect(determineLevel('math', 70)).toBe('중급');
        expect(determineLevel('math', 75)).toBe('중급');
        expect(determineLevel('math', 79)).toBe('중급');
      });

      it('60~69이면 "초급"을 반환한다', () => {
        expect(determineLevel('math', 60)).toBe('초급');
        expect(determineLevel('math', 65)).toBe('초급');
        expect(determineLevel('math', 69)).toBe('초급');
      });

      it('60 미만이면 "기초"를 반환한다', () => {
        expect(determineLevel('math', 59)).toBe('기초');
        expect(determineLevel('math', 50)).toBe('기초');
        expect(determineLevel('math', 0)).toBe('기초');
      });
    });

    describe('English levels', () => {
      it('90 이상이면 "LE"를 반환한다', () => {
        expect(determineLevel('english', 90)).toBe('LE');
        expect(determineLevel('english', 95)).toBe('LE');
        expect(determineLevel('english', 100)).toBe('LE');
      });

      it('80~89이면 "RTT"를 반환한다', () => {
        expect(determineLevel('english', 80)).toBe('RTT');
        expect(determineLevel('english', 85)).toBe('RTT');
        expect(determineLevel('english', 89)).toBe('RTT');
      });

      it('70~79이면 "PL"을 반환한다', () => {
        expect(determineLevel('english', 70)).toBe('PL');
        expect(determineLevel('english', 75)).toBe('PL');
        expect(determineLevel('english', 79)).toBe('PL');
      });

      it('60~69이면 "DP"를 반환한다', () => {
        expect(determineLevel('english', 60)).toBe('DP');
        expect(determineLevel('english', 65)).toBe('DP');
        expect(determineLevel('english', 69)).toBe('DP');
      });

      it('60 미만이면 "Starter"를 반환한다', () => {
        expect(determineLevel('english', 59)).toBe('Starter');
        expect(determineLevel('english', 50)).toBe('Starter');
        expect(determineLevel('english', 0)).toBe('Starter');
      });
    });

    describe('Boundary values', () => {
      it('경계값을 올바르게 처리한다 - Math', () => {
        expect(determineLevel('math', 90)).toBe('최상급');
        expect(determineLevel('math', 89.9)).toBe('상급');
        expect(determineLevel('math', 80)).toBe('상급');
        expect(determineLevel('math', 79.9)).toBe('중급');
        expect(determineLevel('math', 70)).toBe('중급');
        expect(determineLevel('math', 69.9)).toBe('초급');
        expect(determineLevel('math', 60)).toBe('초급');
        expect(determineLevel('math', 59.9)).toBe('기초');
      });

      it('경계값을 올바르게 처리한다 - English', () => {
        expect(determineLevel('english', 90)).toBe('LE');
        expect(determineLevel('english', 89.9)).toBe('RTT');
        expect(determineLevel('english', 80)).toBe('RTT');
        expect(determineLevel('english', 79.9)).toBe('PL');
        expect(determineLevel('english', 70)).toBe('PL');
        expect(determineLevel('english', 69.9)).toBe('DP');
        expect(determineLevel('english', 60)).toBe('DP');
        expect(determineLevel('english', 59.9)).toBe('Starter');
      });
    });
  });

  describe('getCurrentPeriod', () => {
    it('현재 월을 YYYY-MM 형식으로 반환한다', () => {
      const result = getCurrentPeriod();
      const pattern = /^\d{4}-\d{2}$/;
      expect(result).toMatch(pattern);
    });

    it('반환값이 현재 날짜와 일치한다', () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(getCurrentPeriod()).toBe(expected);
    });

    it('월이 한 자리수일 때 0을 앞에 붙인다', () => {
      const result = getCurrentPeriod();
      const month = result.split('-')[1];
      expect(month).toHaveLength(2);
    });
  });

  // ============ 레벨테스트 Query Hooks ============

  describe('useAllLevelTests', () => {
    it('전체 레벨테스트를 조회한다', async () => {
      const mockLevelTests = [
        { id: '1', studentId: 's1', subject: 'math', testDate: '2026-02-01' },
        { id: '2', studentId: 's2', subject: 'english', testDate: '2026-01-15' },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockLevelTests.map(data => ({
          id: data.id,
          data: () => ({ ...data, id: undefined }),
        })),
      });

      const { result } = renderHook(() => useAllLevelTests(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(collection).toHaveBeenCalledWith({}, 'level_tests');
      expect(orderBy).toHaveBeenCalledWith('testDate', 'desc');
    });

    it('과목 필터가 "math"일 때 수학만 조회한다', async () => {
      const mockLevelTests = [
        { id: '1', studentId: 's1', subject: 'math', testDate: '2026-02-01' },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockLevelTests.map(data => ({
          id: data.id,
          data: () => ({ ...data, id: undefined }),
        })),
      });

      const { result } = renderHook(() => useAllLevelTests('math'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(where).toHaveBeenCalledWith('subject', '==', 'math');
    });

    it('과목 필터가 "all"일 때 필터링하지 않는다', async () => {
      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({ docs: [] });

      renderHook(() => useAllLevelTests('all'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(where).not.toHaveBeenCalled();
      });
    });

    it('과목 필터가 없을 때 필터링하지 않는다', async () => {
      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({ docs: [] });

      renderHook(() => useAllLevelTests(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(where).not.toHaveBeenCalled();
      });
    });
  });

  describe('useLevelTests', () => {
    it('학생의 레벨테스트를 조회한다', async () => {
      const mockLevelTests = [
        { id: '1', studentId: 's1', subject: 'math', testDate: '2026-02-01' },
        { id: '2', studentId: 's1', subject: 'english', testDate: '2026-01-15' },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockLevelTests.map(data => ({
          id: data.id,
          data: () => data,
        })),
      });

      const { result } = renderHook(() => useLevelTests('s1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(where).toHaveBeenCalledWith('studentId', '==', 's1');
    });

    it('studentId가 undefined이면 쿼리가 비활성화된다', async () => {
      const { result } = renderHook(() => useLevelTests(undefined), { wrapper: createWrapper() });

      // enabled: !!studentId → false → 쿼리 비활성화
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useConsultationLevelTests', () => {
    it('상담 레코드에서 레벨테스트를 추출한다', async () => {
      const mockConsultations = [
        {
          id: 'c1',
          registeredStudentId: 's1',
          studentName: '홍길동',
          consultationDate: '2026-02-01',
          authorId: 'a1',
          counselor: '강사1',
          createdAt: 1000,
          updatedAt: 2000,
          mathConsultation: {
            levelTestScore: '85',
            calculationScore: '90',
          },
          englishConsultation: {
            levelTestScore: '75',
            engLevel: 'PL',
          },
        },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockConsultations.map(data => ({
          id: data.id,
          data: () => ({ ...data, id: undefined }),
        })),
      });

      const { result } = renderHook(() => useConsultationLevelTests(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // 상담 1개에서 수학, 영어 2개의 레벨테스트가 생성됨
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].subject).toBe('math');
      expect(result.current.data?.[1].subject).toBe('english');
    });

    it('수학 데이터만 있는 상담은 수학 레벨테스트만 생성한다', async () => {
      const mockConsultations = [
        {
          id: 'c1',
          registeredStudentId: 's1',
          studentName: '홍길동',
          consultationDate: '2026-02-01',
          authorId: 'a1',
          counselor: '강사1',
          createdAt: 1000,
          updatedAt: 2000,
          mathConsultation: {
            levelTestScore: '85',
          },
        },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockConsultations.map(data => ({
          id: data.id,
          data: () => ({ ...data, id: undefined }),
        })),
      });

      const { result } = renderHook(() => useConsultationLevelTests(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].subject).toBe('math');
    });

    it('과목 필터를 적용한다', async () => {
      const mockConsultations = [
        {
          id: 'c1',
          registeredStudentId: 's1',
          studentName: '홍길동',
          consultationDate: '2026-02-01',
          authorId: 'a1',
          counselor: '강사1',
          createdAt: 1000,
          updatedAt: 2000,
          mathConsultation: { levelTestScore: '85' },
          englishConsultation: { levelTestScore: '75' },
        },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockConsultations.map(data => ({
          id: data.id,
          data: () => ({ ...data, id: undefined }),
        })),
      });

      const { result } = renderHook(() => useConsultationLevelTests('math'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].subject).toBe('math');
    });
  });

  describe('useStudentConsultationLevelTests', () => {
    it('특정 학생의 상담 레벨테스트를 조회한다', async () => {
      const mockConsultations = [
        {
          id: 'c1',
          registeredStudentId: 's1',
          studentName: '홍길동',
          consultationDate: '2026-02-01',
          authorId: 'a1',
          counselor: '강사1',
          createdAt: 1000,
          updatedAt: 2000,
          mathConsultation: { levelTestScore: '85' },
        },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockConsultations.map(data => ({
          id: data.id,
          data: () => ({ ...data, id: undefined }),
        })),
      });

      const { result } = renderHook(() => useStudentConsultationLevelTests('s1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(where).toHaveBeenCalledWith('registeredStudentId', '==', 's1');
      expect(result.current.data).toHaveLength(1);
    });

    it('studentId가 undefined이면 쿼리가 비활성화된다', async () => {
      const { result } = renderHook(() => useStudentConsultationLevelTests(undefined), { wrapper: createWrapper() });

      // enabled: !!studentId → false → 쿼리 비활성화
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });
  });

  // ============ 레벨테스트 Mutation Hooks ============

  describe('useAddLevelTest', () => {
    it('레벨테스트를 추가한다', async () => {
      const mockLevelTest = {
        studentId: 's1',
        studentName: '홍길동',
        testDate: '2026-02-01',
        subject: 'math' as const,
        testType: 'placement' as const,
        evaluatorId: 'e1',
        evaluatorName: '강사1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (addDoc as any).mockResolvedValue({ id: 'new-test-id' });

      const { result } = renderHook(() => useAddLevelTest(), { wrapper: createWrapper() });

      await result.current.mutateAsync(mockLevelTest);

      await waitFor(() => {
        expect(addDoc).toHaveBeenCalledWith(
          expect.anything(),
          mockLevelTest
        );
      });
    });

    it('추가 성공 시 쿼리를 무효화한다', async () => {
      const mockLevelTest = {
        studentId: 's1',
        studentName: '홍길동',
        testDate: '2026-02-01',
        subject: 'math' as const,
        testType: 'placement' as const,
        evaluatorId: 'e1',
        evaluatorName: '강사1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (addDoc as any).mockResolvedValue({ id: 'new-test-id' });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useAddLevelTest(), { wrapper: createWrapper() });

      await result.current.mutateAsync(mockLevelTest);

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['level_tests', 's1'],
        });
      });
    });
  });

  describe('useUpdateLevelTest', () => {
    it('레벨테스트를 수정한다', async () => {
      const mockUpdate = {
        id: 'test-1',
        updates: { percentage: 85 },
      };

      (updateDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateLevelTest(), { wrapper: createWrapper() });

      await result.current.mutateAsync(mockUpdate);

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            percentage: 85,
            updatedAt: expect.any(Number),
          })
        );
      });
    });

    it('수정 시 updatedAt을 자동으로 추가한다', async () => {
      const mockUpdate = {
        id: 'test-1',
        updates: { percentage: 85 },
      };

      (updateDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateLevelTest(), { wrapper: createWrapper() });

      await result.current.mutateAsync(mockUpdate);

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            updatedAt: expect.any(Number),
          })
        );
      });
    });

    it('수정 성공 시 쿼리를 무효화한다', async () => {
      (updateDoc as any).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateLevelTest(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ id: 'test-1', updates: {} });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['level_tests'],
        });
      });
    });
  });

  describe('useDeleteLevelTest', () => {
    it('레벨테스트를 삭제한다', async () => {
      (deleteDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteLevelTest(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ id: 'test-1', studentId: 's1' });

      await waitFor(() => {
        expect(deleteDoc).toHaveBeenCalled();
      });
    });

    it('삭제 성공 시 쿼리를 무효화한다', async () => {
      (deleteDoc as any).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteLevelTest(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ id: 'test-1', studentId: 's1' });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['level_tests', 's1'],
        });
      });
    });
  });

  // ============ 목표 점수 Query Hooks ============

  describe('useGoalSettings', () => {
    it('학생의 목표 점수를 조회한다', async () => {
      const mockGoals = [
        { id: 'g1', studentId: 's1', examId: 'e1', targetScore: 90 },
        { id: 'g2', studentId: 's1', examId: 'e2', targetScore: 85 },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockGoals.map(data => ({
          id: data.id,
          data: () => data,
        })),
      });

      const { result } = renderHook(() => useGoalSettings('s1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(where).toHaveBeenCalledWith('studentId', '==', 's1');
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('studentId가 undefined이면 쿼리가 비활성화된다', async () => {
      const { result } = renderHook(() => useGoalSettings(undefined), { wrapper: createWrapper() });

      // enabled: !!studentId → false → 쿼리 비활성화
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useGoalByExam', () => {
    it('특정 시험의 목표를 조회한다', async () => {
      const mockGoal = { id: 'g1', studentId: 's1', examId: 'e1', targetScore: 90 };

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        empty: false,
        docs: [{
          id: mockGoal.id,
          data: () => mockGoal,
        }],
      });

      const { result } = renderHook(() => useGoalByExam('s1', 'e1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ id: 'g1', studentId: 's1', examId: 'e1', targetScore: 90 });
      expect(where).toHaveBeenCalledWith('studentId', '==', 's1');
      expect(where).toHaveBeenCalledWith('examId', '==', 'e1');
    });

    it('목표가 없으면 null을 반환한다', async () => {
      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        empty: true,
        docs: [],
      });

      const { result } = renderHook(() => useGoalByExam('s1', 'e1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it('studentId나 examId가 undefined이면 쿼리가 비활성화된다', async () => {
      const { result: result1 } = renderHook(() => useGoalByExam(undefined, 'e1'), { wrapper: createWrapper() });
      const { result: result2 } = renderHook(() => useGoalByExam('s1', undefined), { wrapper: createWrapper() });

      // enabled: !!studentId && !!examId → false → 쿼리 비활성화
      expect(result1.current.fetchStatus).toBe('idle');
      expect(result1.current.data).toBeUndefined();
      expect(result2.current.fetchStatus).toBe('idle');
      expect(result2.current.data).toBeUndefined();
    });
  });

  // ============ 목표 점수 Mutation Hooks ============

  describe('useAddGoalSetting', () => {
    it('목표 점수를 추가한다', async () => {
      const mockGoal = {
        studentId: 's1',
        studentName: '홍길동',
        examId: 'e1',
        examTitle: '중간고사',
        examDate: '2026-03-15',
        subject: 'math' as const,
        targetScore: 90,
        maxScore: 100,
        targetPercentage: 90,
        setBy: 'u1',
        setByName: '강사1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (addDoc as any).mockResolvedValue({ id: 'new-goal-id' });

      const { result } = renderHook(() => useAddGoalSetting(), { wrapper: createWrapper() });

      await result.current.mutateAsync(mockGoal);

      await waitFor(() => {
        expect(addDoc).toHaveBeenCalledWith(expect.anything(), mockGoal);
      });
    });

    it('추가 성공 시 쿼리를 무효화한다', async () => {
      const mockGoal = {
        studentId: 's1',
        studentName: '홍길동',
        examId: 'e1',
        examTitle: '중간고사',
        examDate: '2026-03-15',
        subject: 'math' as const,
        targetScore: 90,
        maxScore: 100,
        targetPercentage: 90,
        setBy: 'u1',
        setByName: '강사1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (addDoc as any).mockResolvedValue({ id: 'new-goal-id' });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useAddGoalSetting(), { wrapper: createWrapper() });

      await result.current.mutateAsync(mockGoal);

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['goal_settings', 's1'],
        });
      });
    });
  });

  describe('useUpdateGoalAchievement', () => {
    it('목표 점수 이상이면 achieved를 true로 설정한다', async () => {
      (updateDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateGoalAchievement(), { wrapper: createWrapper() });

      await result.current.mutateAsync({
        goalId: 'g1',
        actualScore: 90,
        actualPercentage: 90,
        targetScore: 85,
      });

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            actualScore: 90,
            actualPercentage: 90,
            achieved: true,
            updatedAt: expect.any(Number),
          })
        );
      });
    });

    it('목표 점수 미만이면 achieved를 false로 설정한다', async () => {
      (updateDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateGoalAchievement(), { wrapper: createWrapper() });

      await result.current.mutateAsync({
        goalId: 'g1',
        actualScore: 80,
        actualPercentage: 80,
        targetScore: 85,
      });

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            actualScore: 80,
            actualPercentage: 80,
            achieved: false,
            updatedAt: expect.any(Number),
          })
        );
      });
    });

    it('목표 점수와 동일하면 achieved를 true로 설정한다', async () => {
      (updateDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateGoalAchievement(), { wrapper: createWrapper() });

      await result.current.mutateAsync({
        goalId: 'g1',
        actualScore: 85,
        actualPercentage: 85,
        targetScore: 85,
      });

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            achieved: true,
          })
        );
      });
    });

    it('수정 성공 시 쿼리를 무효화한다', async () => {
      (updateDoc as any).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateGoalAchievement(), { wrapper: createWrapper() });

      await result.current.mutateAsync({
        goalId: 'g1',
        actualScore: 90,
        actualPercentage: 90,
        targetScore: 85,
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['goal_settings'],
        });
      });
    });
  });

  describe('useDeleteGoalSetting', () => {
    it('목표를 삭제한다', async () => {
      (deleteDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteGoalSetting(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ id: 'g1', studentId: 's1' });

      await waitFor(() => {
        expect(deleteDoc).toHaveBeenCalled();
      });
    });

    it('삭제 성공 시 쿼리를 무효화한다', async () => {
      (deleteDoc as any).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteGoalSetting(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ id: 'g1', studentId: 's1' });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['goal_settings', 's1'],
        });
      });
    });
  });

  // ============ 강사 코멘트 Query Hooks ============

  describe('useGradeComments', () => {
    it('학생의 코멘트를 조회한다', async () => {
      const mockComments = [
        { id: 'c1', studentId: 's1', category: 'strength', period: '2026-02', content: '좋음' },
        { id: 'c2', studentId: 's1', category: 'improvement', period: '2026-01', content: '개선 필요' },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockComments.map(data => ({
          id: data.id,
          data: () => data,
        })),
      });

      const { result } = renderHook(() => useGradeComments('s1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(where).toHaveBeenCalledWith('studentId', '==', 's1');
    });

    it('period 필터를 클라이언트 사이드에서 적용한다', async () => {
      const mockComments = [
        { id: 'c1', studentId: 's1', category: 'strength', period: '2026-02', content: '좋음' },
        { id: 'c2', studentId: 's1', category: 'improvement', period: '2026-01', content: '개선 필요' },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockComments.map(data => ({
          id: data.id,
          data: () => data,
        })),
      });

      const { result } = renderHook(() => useGradeComments('s1', '2026-02'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].period).toBe('2026-02');
    });

    it('studentId가 undefined이면 쿼리가 비활성화된다', async () => {
      const { result } = renderHook(() => useGradeComments(undefined), { wrapper: createWrapper() });

      // enabled: !!studentId → false → 쿼리 비활성화
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useLatestComments', () => {
    it('카테고리별 최신 코멘트를 반환한다', async () => {
      const mockComments = [
        { id: 'c1', studentId: 's1', category: 'strength' as const, period: '2026-02', content: '최신' },
        { id: 'c2', studentId: 's1', category: 'strength' as const, period: '2026-01', content: '이전' },
        { id: 'c3', studentId: 's1', category: 'improvement' as const, period: '2026-02', content: '개선' },
      ];

      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({
        docs: mockComments.map(data => ({
          id: data.id,
          data: () => data,
        })),
      });

      const { result } = renderHook(() => useLatestComments('s1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.strength).toBeDefined();
      });

      // strength 카테고리는 최신 것만 (c1)
      expect(result.current.strength?.id).toBe('c1');
      expect(result.current.improvement?.id).toBe('c3');
    });

    it('코멘트가 없으면 빈 객체를 반환한다', async () => {
      (query as any).mockReturnValue('mock-query');
      (getDocs as any).mockResolvedValue({ docs: [] });

      const { result } = renderHook(() => useLatestComments('s1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current).toEqual({});
      });
    });
  });

  // ============ 강사 코멘트 Mutation Hooks ============

  describe('useAddGradeComment', () => {
    it('코멘트를 추가한다', async () => {
      const mockComment = {
        studentId: 's1',
        studentName: '홍길동',
        category: 'strength' as const,
        subject: 'math' as const,
        content: '계산력이 우수함',
        period: '2026-02',
        isSharedWithParent: true,
        authorId: 'u1',
        authorName: '강사1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (addDoc as any).mockResolvedValue({ id: 'new-comment-id' });

      const { result } = renderHook(() => useAddGradeComment(), { wrapper: createWrapper() });

      await result.current.mutateAsync(mockComment);

      await waitFor(() => {
        expect(addDoc).toHaveBeenCalledWith(expect.anything(), mockComment);
      });
    });

    it('추가 성공 시 쿼리를 무효화한다', async () => {
      const mockComment = {
        studentId: 's1',
        studentName: '홍길동',
        category: 'strength' as const,
        content: '우수함',
        period: '2026-02',
        isSharedWithParent: true,
        authorId: 'u1',
        authorName: '강사1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (addDoc as any).mockResolvedValue({ id: 'new-comment-id' });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useAddGradeComment(), { wrapper: createWrapper() });

      await result.current.mutateAsync(mockComment);

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['grade_comments', 's1'],
        });
      });
    });
  });

  describe('useUpdateGradeComment', () => {
    it('코멘트를 수정한다', async () => {
      const mockUpdate = {
        id: 'c1',
        updates: { content: '수정된 내용' },
      };

      (updateDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateGradeComment(), { wrapper: createWrapper() });

      await result.current.mutateAsync(mockUpdate);

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            content: '수정된 내용',
            updatedAt: expect.any(Number),
          })
        );
      });
    });

    it('수정 시 updatedAt을 자동으로 추가한다', async () => {
      (updateDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateGradeComment(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ id: 'c1', updates: {} });

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            updatedAt: expect.any(Number),
          })
        );
      });
    });

    it('수정 성공 시 쿼리를 무효화한다', async () => {
      (updateDoc as any).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateGradeComment(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ id: 'c1', updates: {} });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['grade_comments'],
        });
      });
    });
  });

  describe('useDeleteGradeComment', () => {
    it('코멘트를 삭제한다', async () => {
      (deleteDoc as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteGradeComment(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ id: 'c1', studentId: 's1' });

      await waitFor(() => {
        expect(deleteDoc).toHaveBeenCalled();
      });
    });

    it('삭제 성공 시 쿼리를 무효화한다', async () => {
      (deleteDoc as any).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteGradeComment(), { wrapper: createWrapper() });

      await result.current.mutateAsync({ id: 'c1', studentId: 's1' });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['grade_comments', 's1'],
        });
      });
    });
  });
});
