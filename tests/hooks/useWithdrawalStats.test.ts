import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWithdrawalStats } from '../../hooks/useWithdrawalStats';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import type { UnifiedStudent, StaffMember, Enrollment } from '../../types';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));
vi.mock('../../hooks/useStudents', () => ({ COL_STUDENTS: 'students' }));
vi.mock('../../constants/withdrawal', () => ({
  WITHDRAWAL_REASON_LABEL: {
    financial: '경제적 사유',
    relocation: '이사',
    other: '기타',
    academic: '학업',
    graduation: '졸업',
    competitor: '경쟁 학원 이동',
    schedule: '시간 조절 어려움',
    dissatisfied: '불만족',
  },
  SUBJECT_LABEL: {
    math: '수학',
    english: '영어',
    korean: '국어',
    science: '과학',
    other: '기타',
  },
}));

// Helper to create mock Firestore query snapshot
const createMockQuerySnapshot = (docs: any[]) => ({
  docs,
  empty: docs.length === 0,
  size: docs.length,
});

// Helper to create mock student document
const createMockStudent = (id: string, data: Partial<UnifiedStudent>): any => ({
  id,
  data: () => ({
    name: `학생${id}`,
    status: 'active',
    startDate: '2025-01-01',
    enrollments: [],
    ...data,
  }),
  exists: () => true,
});

// Helper to create mock enrollment document
const createMockEnrollment = (studentId: string, data: Partial<Enrollment>): any => ({
  id: `enroll-${studentId}-${data.subject || 'math'}`,
  data: () => ({
    subject: 'math',
    classId: 'class1',
    className: 'Test Class',
    days: ['월', '수'],
    ...data,
  }),
  ref: {
    path: `students/${studentId}/enrollments/enroll-${studentId}-${data.subject || 'math'}`,
  },
});

// Helper to create React Query wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useWithdrawalStats Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Default behavior', () => {
    it('returns empty stats when loading', () => {
      vi.mocked(getDocs).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useWithdrawalStats(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.stats.totalWithdrawals).toBe(0);
      expect(result.current.stats.monthlyStats).toEqual([]);
    });

    it('returns default stats with no data', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useWithdrawalStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats).toEqual({
        totalWithdrawals: 0,
        thisMonthWithdrawals: 0,
        withdrawnCount: 0,
        subjectEndedCount: 0,
        consultationCompleteRate: 100,
        incompleteConsultations: [],
        monthlyStats: expect.any(Array),
        reasonStats: [],
        subjectStats: [],
        staffStats: [],
      });
    });

    it('uses default 12-month date range when no filters provided', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useWithdrawalStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Should have 12 months initialized
      expect(result.current.stats.monthlyStats).toHaveLength(12);
    });

    it('initializes all 12 months in monthly stats', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useWithdrawalStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const monthlyStats = result.current.stats.monthlyStats;
      expect(monthlyStats).toHaveLength(12);

      // Check each month has required structure
      monthlyStats.forEach(stat => {
        expect(stat).toHaveProperty('month');
        expect(stat).toHaveProperty('monthLabel');
        expect(stat).toHaveProperty('withdrawnCount');
        expect(stat).toHaveProperty('subjectEndedCount');
        expect(stat).toHaveProperty('total');
      });
    });
  });

  describe('2. Withdrawal counting', () => {
    it('counts fully withdrawn students within date range', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
        createMockStudent('2', {
          status: 'withdrawn',
          withdrawalDate: '2025-02-10',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.withdrawnCount).toBe(2);
      expect(result.current.stats.totalWithdrawals).toBe(2);
    });

    it('counts subject-ended students (active with all enrollments ended)', async () => {
      const students = [
        createMockStudent('1', {
          status: 'active',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          withdrawalDate: '2025-01-20',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.subjectEndedCount).toBe(1);
      expect(result.current.stats.totalWithdrawals).toBe(1);
    });

    it('excludes students outside date range', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2024-12-15',
        }),
        createMockStudent('2', {
          status: 'withdrawn',
          withdrawalDate: '2026-03-10',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalWithdrawals).toBe(0);
    });

    it('thisMonthWithdrawals counts only current month', async () => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const thisMonthDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-15`;
      const lastMonthDate = `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}-15`;

      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: thisMonthDate,
        }),
        createMockStudent('2', {
          status: 'withdrawn',
          withdrawalDate: lastMonthDate,
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useWithdrawalStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.thisMonthWithdrawals).toBe(1);
    });

    it('counts both withdrawn and subject-ended separately', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
        createMockStudent('2', {
          status: 'active',
        }),
      ];

      const enrollments = [
        createMockEnrollment('2', {
          subject: 'math',
          endDate: '2025-01-20',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.withdrawnCount).toBe(1);
      expect(result.current.stats.subjectEndedCount).toBe(1);
      expect(result.current.stats.totalWithdrawals).toBe(2);
    });
  });

  describe('3. Monthly stats', () => {
    it('aggregates by month correctly', async () => {
      // 월별 통계는 현재 기준 최근 12개월만 초기화 (2025-03 ~ 2026-02)
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
        }),
        createMockStudent('2', {
          status: 'withdrawn',
          withdrawalDate: '2025-06-20',
        }),
        createMockStudent('3', {
          status: 'withdrawn',
          withdrawalDate: '2025-07-10',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const monthlyStats = result.current.stats.monthlyStats;
      const jun = monthlyStats.find(m => m.month === '2025-06');
      const jul = monthlyStats.find(m => m.month === '2025-07');

      expect(jun?.total).toBe(2);
      expect(jul?.total).toBe(1);
    });

    it('sorts months chronologically', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useWithdrawalStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const months = result.current.stats.monthlyStats.map(s => s.month);

      // Check if sorted
      const sortedMonths = [...months].sort();
      expect(months).toEqual(sortedMonths);
    });

    it('separates withdrawn and subject-ended in monthly stats', async () => {
      // 월별 통계는 현재 기준 최근 12개월만 초기화 (2025-03 ~ 2026-02)
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
        }),
        createMockStudent('2', {
          status: 'active',
        }),
      ];

      const enrollments = [
        createMockEnrollment('2', {
          subject: 'math',
          withdrawalDate: '2025-06-20',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const jun = result.current.stats.monthlyStats.find(m => m.month === '2025-06');
      expect(jun?.withdrawnCount).toBe(1);
      expect(jun?.subjectEndedCount).toBe(1);
      expect(jun?.total).toBe(2);
    });
  });

  describe('4. Reason stats', () => {
    it('groups by withdrawalReason', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
          withdrawalReason: 'financial',
        }),
        createMockStudent('2', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-20',
          withdrawalReason: 'financial',
        }),
        createMockStudent('3', {
          status: 'withdrawn',
          withdrawalDate: '2025-02-10',
          withdrawalReason: 'relocation',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const reasonStats = result.current.stats.reasonStats;
      const financial = reasonStats.find(r => r.reason === 'financial');
      const relocation = reasonStats.find(r => r.reason === 'relocation');

      expect(financial?.count).toBe(2);
      expect(relocation?.count).toBe(1);
    });

    it('uses WITHDRAWAL_REASON_LABEL for labels', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
          withdrawalReason: 'financial',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const financial = result.current.stats.reasonStats.find(r => r.reason === 'financial');
      expect(financial?.label).toBe('경제적 사유');
    });

    it('calculates percentage correctly', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
          withdrawalReason: 'financial',
        }),
        createMockStudent('2', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-20',
          withdrawalReason: 'financial',
        }),
        createMockStudent('3', {
          status: 'withdrawn',
          withdrawalDate: '2025-02-10',
          withdrawalReason: 'relocation',
        }),
        createMockStudent('4', {
          status: 'withdrawn',
          withdrawalDate: '2025-02-15',
          withdrawalReason: 'academic',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const financial = result.current.stats.reasonStats.find(r => r.reason === 'financial');
      expect(financial?.percentage).toBe(50); // 2/4 = 50%
    });

    it('sorts by count descending', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
          withdrawalReason: 'financial',
        }),
        createMockStudent('2', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-20',
          withdrawalReason: 'relocation',
        }),
        createMockStudent('3', {
          status: 'withdrawn',
          withdrawalDate: '2025-02-10',
          withdrawalReason: 'relocation',
        }),
        createMockStudent('4', {
          status: 'withdrawn',
          withdrawalDate: '2025-02-15',
          withdrawalReason: 'relocation',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const reasonStats = result.current.stats.reasonStats;
      expect(reasonStats[0].reason).toBe('relocation');
      expect(reasonStats[0].count).toBe(3);
      expect(reasonStats[1].reason).toBe('financial');
      expect(reasonStats[1].count).toBe(1);
    });

    it('uses "other" as default reason when withdrawalReason missing', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const other = result.current.stats.reasonStats.find(r => r.reason === 'other');
      expect(other?.count).toBe(1);
    });
  });

  describe('5. Subject stats', () => {
    it('counts subjects from endedEnrollments', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
        }),
        createMockEnrollment('1', {
          subject: 'english',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const subjectStats = result.current.stats.subjectStats;
      expect(subjectStats).toHaveLength(2);
      expect(subjectStats.find(s => s.subject === 'math')?.count).toBe(1);
      expect(subjectStats.find(s => s.subject === 'english')?.count).toBe(1);
    });

    it('uses SUBJECT_LABEL for labels', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const math = result.current.stats.subjectStats.find(s => s.subject === 'math');
      expect(math?.label).toBe('수학');
    });

    it('calculates percentage correctly', async () => {
      // endedSubjects는 학생별 new Set으로 중복 제거됨
      // 2명의 학생이 각각 korean을 수강 → korean count=2, total=4 → 50%
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-06-15',
        }),
        createMockStudent('2', {
          status: 'withdrawn',
          withdrawalDate: '2025-06-20',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', { subject: 'math' }),
        createMockEnrollment('1', { subject: 'korean' }),
        createMockEnrollment('2', { subject: 'english' }),
        createMockEnrollment('2', { subject: 'korean' }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const korean = result.current.stats.subjectStats.find(s => s.subject === 'korean');
      expect(korean?.percentage).toBe(50); // 2/4 = 50%
    });
  });

  describe('6. Staff stats', () => {
    it('groups by staffId from enrollments', async () => {
      const staff: StaffMember[] = [
        {
          id: 'teacher1',
          name: '김선생',
          role: 'teacher',
          loginId: 'teacher1',
          phone: '010-1111-1111',
          status: 'active',
        } as StaffMember,
        {
          id: 'teacher2',
          name: '이선생',
          role: 'teacher',
          loginId: 'teacher2',
          phone: '010-2222-2222',
          status: 'active',
        } as StaffMember,
      ];

      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          staffId: 'teacher1',
        }),
        createMockEnrollment('1', {
          subject: 'english',
          staffId: 'teacher2',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats(
            {
              dateRange: { start: '2025-01-01', end: '2025-12-31' },
            },
            staff
          ),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const staffStats = result.current.stats.staffStats;
      expect(staffStats).toHaveLength(2);
      expect(staffStats.find(s => s.staffId === 'teacher1')).toBeDefined();
      expect(staffStats.find(s => s.staffId === 'teacher2')).toBeDefined();
    });

    it('separates math and english counts', async () => {
      const staff: StaffMember[] = [
        {
          id: 'teacher1',
          name: '김선생',
          role: 'teacher',
          loginId: 'teacher1',
          phone: '010-1111-1111',
          status: 'active',
        } as StaffMember,
      ];

      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          staffId: 'teacher1',
        }),
        createMockEnrollment('1', {
          subject: 'math',
          staffId: 'teacher1',
        }),
        createMockEnrollment('1', {
          subject: 'english',
          staffId: 'teacher1',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats(
            {
              dateRange: { start: '2025-01-01', end: '2025-12-31' },
            },
            staff
          ),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const teacher1 = result.current.stats.staffStats.find(s => s.staffId === 'teacher1');
      expect(teacher1?.mathCount).toBe(2);
      expect(teacher1?.englishCount).toBe(1);
      expect(teacher1?.totalCount).toBe(3);
    });

    it('only includes staff with role "teacher" or "강사"', async () => {
      const staff: StaffMember[] = [
        {
          id: 'teacher1',
          name: '김선생',
          role: 'teacher',
          loginId: 'teacher1',
          phone: '010-1111-1111',
          status: 'active',
        } as StaffMember,
        {
          id: 'admin1',
          name: '박관리',
          role: 'admin',
          loginId: 'admin1',
          phone: '010-3333-3333',
          status: 'active',
        } as StaffMember,
      ];

      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          staffId: 'admin1',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats(
            {
              dateRange: { start: '2025-01-01', end: '2025-12-31' },
            },
            staff
          ),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Admin should not be in stats (not a teacher)
      expect(result.current.stats.staffStats).toHaveLength(0);
    });

    it('filters out staff with 0 total count', async () => {
      const staff: StaffMember[] = [
        {
          id: 'teacher1',
          name: '김선생',
          role: 'teacher',
          loginId: 'teacher1',
          phone: '010-1111-1111',
          status: 'active',
        } as StaffMember,
        {
          id: 'teacher2',
          name: '이선생',
          role: 'teacher',
          loginId: 'teacher2',
          phone: '010-2222-2222',
          status: 'active',
        } as StaffMember,
      ];

      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          staffId: 'teacher1',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats(
            {
              dateRange: { start: '2025-01-01', end: '2025-12-31' },
            },
            staff
          ),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Only teacher1 should appear (teacher2 has 0 count)
      expect(result.current.stats.staffStats).toHaveLength(1);
      expect(result.current.stats.staffStats[0].staffId).toBe('teacher1');
    });

    it('sorts by totalCount descending', async () => {
      const staff: StaffMember[] = [
        {
          id: 'teacher1',
          name: '김선생',
          role: 'teacher',
          loginId: 'teacher1',
          phone: '010-1111-1111',
          status: 'active',
        } as StaffMember,
        {
          id: 'teacher2',
          name: '이선생',
          role: 'teacher',
          loginId: 'teacher2',
          phone: '010-2222-2222',
          status: 'active',
        } as StaffMember,
      ];

      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          staffId: 'teacher1',
        }),
        createMockEnrollment('1', {
          subject: 'math',
          staffId: 'teacher2',
        }),
        createMockEnrollment('1', {
          subject: 'english',
          staffId: 'teacher2',
        }),
        createMockEnrollment('1', {
          subject: 'english',
          staffId: 'teacher2',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats(
            {
              dateRange: { start: '2025-01-01', end: '2025-12-31' },
            },
            staff
          ),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const staffStats = result.current.stats.staffStats;
      expect(staffStats[0].staffId).toBe('teacher2');
      expect(staffStats[0].totalCount).toBe(3);
      expect(staffStats[1].staffId).toBe('teacher1');
      expect(staffStats[1].totalCount).toBe(1);
    });
  });

  describe('7. Consultation completion rate', () => {
    it('checks all three consultation items', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
          withdrawalConsultation: {
            adminCalledParent: true,
            teacherCalledParent: true,
            talkedWithStudent: true,
          },
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.consultationCompleteRate).toBe(100);
    });

    it('calculates rate correctly with partial completion', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
          withdrawalConsultation: {
            adminCalledParent: true,
            teacherCalledParent: false,
            talkedWithStudent: true,
          },
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      // 2 out of 3 completed = 67% (rounded)
      expect(result.current.stats.consultationCompleteRate).toBe(67);
    });

    it('returns 100% when no withdrawn students', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.consultationCompleteRate).toBe(100);
    });

    it('includes students with pending items in incompleteConsultations', async () => {
      const students = [
        createMockStudent('1', {
          name: '김학생',
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
          withdrawalConsultation: {
            adminCalledParent: true,
            teacherCalledParent: false,
            talkedWithStudent: false,
          },
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.incompleteConsultations).toHaveLength(1);
      expect(result.current.stats.incompleteConsultations[0]).toEqual({
        studentId: '1',
        studentName: '김학생',
        type: 'withdrawn',
        withdrawalDate: '2025-01-15',
        pendingItems: ['teacherCalled', 'studentTalked'],
      });
    });

    it('handles missing consultation object', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      // All 3 items should be pending
      expect(result.current.stats.consultationCompleteRate).toBe(0);
      expect(result.current.stats.incompleteConsultations[0].pendingItems).toHaveLength(3);
    });
  });

  describe('8. Subject-ended detection', () => {
    it('detects active student with all enrollments ended in a subject', async () => {
      const students = [
        createMockStudent('1', {
          status: 'active',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          withdrawalDate: '2025-01-15',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.subjectEndedCount).toBe(1);
    });

    it('ignores subjects with at least one active enrollment', async () => {
      const students = [
        createMockStudent('1', {
          status: 'active',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          withdrawalDate: '2025-01-15',
        }),
        createMockEnrollment('1', {
          subject: 'math',
          // No withdrawalDate - still active
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Math still has active enrollment, so not counted as ended
      expect(result.current.stats.subjectEndedCount).toBe(0);
    });

    it('uses latest date among ended enrollments as effectiveDate', async () => {
      // 월별 통계는 현재 기준 최근 12개월만 초기화 (2025-03 ~ 2026-02)
      const students = [
        createMockStudent('1', {
          status: 'active',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          withdrawalDate: '2025-06-10',
        }),
        createMockEnrollment('1', {
          subject: 'math',
          endDate: '2025-06-20',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Should use the latest date (2025-06-20) for monthly stats
      const jun = result.current.stats.monthlyStats.find(m => m.month === '2025-06');
      expect(jun?.subjectEndedCount).toBe(1);
    });

    it('handles on_hold status similar to active for subject-ended', async () => {
      const students = [
        createMockStudent('1', {
          status: 'on_hold',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          withdrawalDate: '2025-01-15',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.subjectEndedCount).toBe(1);
    });
  });

  describe('9. Error handling', () => {
    it('returns error message when getDocs fails', async () => {
      vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firebase error'));

      const { result } = renderHook(() => useWithdrawalStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe('Firebase error');
    });

    it('handles enrollment query failure', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockRejectedValueOnce(new Error('Enrollment fetch failed'));

      const { result } = renderHook(() => useWithdrawalStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe('Enrollment fetch failed');
    });
  });

  describe('10. Filter handling', () => {
    it('uses filters.dateRange to override default range', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2024-06-15',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2024-01-01', end: '2024-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalWithdrawals).toBe(1);
    });

    it('includes entryType in queryKey for cache invalidation', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { rerender } = renderHook(
        (props) => useWithdrawalStats(props.filters),
        {
          wrapper: createWrapper(),
          initialProps: { filters: { entryType: 'all' as const } },
        }
      );

      await waitFor(() => expect(vi.mocked(getDocs)).toHaveBeenCalled());

      vi.clearAllMocks();

      // Change entryType - should trigger refetch
      rerender({ filters: { entryType: 'withdrawn' as const } });

      await waitFor(() => expect(vi.mocked(getDocs)).toHaveBeenCalled());
    });
  });

  describe('11. Integration scenarios', () => {
    it('handles mixed withdrawal types correctly', async () => {
      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
          withdrawalReason: 'financial',
        }),
        createMockStudent('2', {
          status: 'active',
        }),
        createMockStudent('3', {
          status: 'active',
        }),
      ];

      const enrollments = [
        createMockEnrollment('2', {
          subject: 'math',
          endDate: '2025-01-20',
        }),
        createMockEnrollment('3', {
          subject: 'english',
          // Active enrollment
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats({
            dateRange: { start: '2025-01-01', end: '2025-12-31' },
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.withdrawnCount).toBe(1);
      expect(result.current.stats.subjectEndedCount).toBe(1);
      expect(result.current.stats.totalWithdrawals).toBe(2);
    });

    it('handles complex staff statistics with multiple subjects', async () => {
      const staff: StaffMember[] = [
        {
          id: 'teacher1',
          name: '김선생',
          role: 'teacher',
          loginId: 'teacher1',
          phone: '010-1111-1111',
          status: 'active',
        } as StaffMember,
      ];

      const students = [
        createMockStudent('1', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-15',
        }),
        createMockStudent('2', {
          status: 'withdrawn',
          withdrawalDate: '2025-01-20',
        }),
      ];

      const enrollments = [
        createMockEnrollment('1', {
          subject: 'math',
          staffId: 'teacher1',
        }),
        createMockEnrollment('1', {
          subject: 'english',
          staffId: 'teacher1',
        }),
        createMockEnrollment('2', {
          subject: 'math',
          staffId: 'teacher1',
        }),
        createMockEnrollment('2', {
          subject: 'korean',
          staffId: 'teacher1',
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(students) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollments) as any);

      const { result } = renderHook(
        () =>
          useWithdrawalStats(
            {
              dateRange: { start: '2025-01-01', end: '2025-12-31' },
            },
            staff
          ),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const teacher1 = result.current.stats.staffStats.find(s => s.staffId === 'teacher1');
      expect(teacher1?.mathCount).toBe(2);
      expect(teacher1?.englishCount).toBe(1);
      // korean is not counted (not math or english)
      expect(teacher1?.totalCount).toBe(3);
    });
  });
});
