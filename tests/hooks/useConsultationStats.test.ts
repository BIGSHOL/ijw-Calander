import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useConsultationStats,
  getDateRangeFromPreset,
  DEFAULT_MONTHLY_TARGET,
  ConsultationStatsFilters,
} from '../../hooks/useConsultationStats';
import type { StaffMember } from '../../types';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

vi.mock('../../hooks/useStudentConsultations', () => ({
  COL_STUDENT_CONSULTATIONS: 'student_consultations',
}));

vi.mock('../../hooks/useStudents', () => ({
  COL_STUDENTS: 'students',
}));

import { collection, collectionGroup, getDocs, query, where, orderBy } from 'firebase/firestore';

// Helper to create mock consultation data
const createMockConsultation = (overrides: any = {}) => ({
  id: `consult-${Math.random().toString(36).substr(2, 9)}`,
  studentId: 'student1',
  studentName: '학생1',
  consultantId: 'teacher1',
  consultantName: '선생님1',
  date: '2026-02-01',
  type: 'parent',
  category: 'academic',
  subject: 'math',
  content: '상담 내용',
  followUpNeeded: false,
  followUpDone: false,
  ...overrides,
});

// Helper to create mock document snapshot
const createMockDocSnap = (id: string, data: any) => ({
  id,
  data: () => data,
  exists: () => true,
  ref: { path: `students/${id}`, id },
});

// Helper to create mock enrollment document
const createMockEnrollmentDoc = (studentId: string, data: any) => ({
  id: `enroll-${studentId}-${Math.random().toString(36).substr(2, 5)}`,
  data: () => data,
  ref: { path: `students/${studentId}/enrollments/enroll-${studentId}` },
});

// Helper to create mock query snapshot
const createMockQuerySnapshot = (docs: any[]) => ({
  docs,
  empty: docs.length === 0,
  size: docs.length,
});

// Helper to create mock class document
const createMockClassDoc = (id: string, data: any) => ({
  id,
  data: () => data,
  ref: { path: `classes/${id}` },
});

describe('useConsultationStats Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(collection).mockReturnValue({} as any);
    vi.mocked(collectionGroup).mockReturnValue({} as any);
    vi.mocked(query).mockReturnValue({} as any);
    vi.mocked(where).mockReturnValue({} as any);
    vi.mocked(orderBy).mockReturnValue({} as any);
  });

  afterEach(() => {
    queryClient.clear();
  });

  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  describe('getDateRangeFromPreset - Pure Function Tests', () => {
    it('thisMonth: 이번 달 첫날부터 마지막날까지', () => {
      const result = getDateRangeFromPreset('thisMonth');
      const now = new Date();
      const expectedStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const expectedEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      expect(result.start).toBe(formatDate(expectedStart));
      expect(result.end).toBe(formatDate(expectedEnd));
      expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('lastMonth: 지난 달 첫날부터 마지막날까지', () => {
      const result = getDateRangeFromPreset('lastMonth');
      const now = new Date();
      const expectedStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const expectedEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      expect(result.start).toBe(formatDate(expectedStart));
      expect(result.end).toBe(formatDate(expectedEnd));
    });

    it('last3Months: 2개월 전 첫날부터 이번달 마지막날까지', () => {
      const result = getDateRangeFromPreset('last3Months');
      const now = new Date();
      const expectedStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const expectedEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      expect(result.start).toBe(formatDate(expectedStart));
      expect(result.end).toBe(formatDate(expectedEnd));
    });

    it('thisWeek: 이번 주 월요일부터 일요일까지', () => {
      const result = getDateRangeFromPreset('thisWeek');
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

      const expectedStart = new Date(now);
      expectedStart.setDate(now.getDate() + mondayOffset);

      const expectedEnd = new Date(expectedStart);
      expectedEnd.setDate(expectedStart.getDate() + 6);

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      expect(result.start).toBe(formatDate(expectedStart));
      expect(result.end).toBe(formatDate(expectedEnd));
    });

    it('잘못된 preset은 기본값(thisMonth)으로 처리', () => {
      const result = getDateRangeFromPreset('invalid' as any);
      const thisMonth = getDateRangeFromPreset('thisMonth');

      expect(result.start).toBe(thisMonth.start);
      expect(result.end).toBe(thisMonth.end);
    });

    it('반환값은 YYYY-MM-DD 형식', () => {
      const presets: Array<'thisWeek' | 'thisMonth' | 'lastMonth' | 'last3Months'> = [
        'thisWeek',
        'thisMonth',
        'lastMonth',
        'last3Months',
      ];

      presets.forEach((preset) => {
        const result = getDateRangeFromPreset(preset);
        expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  describe('DEFAULT_MONTHLY_TARGET', () => {
    it('기본 월간 상담 목표는 100', () => {
      expect(DEFAULT_MONTHLY_TARGET).toBe(100);
    });
  });

  describe('useConsultationStats - Basic Behavior', () => {
    it('초기 로딩 상태에서 빈 stats 반환', () => {
      vi.mocked(getDocs).mockReturnValue(new Promise(() => {})); // never resolves

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.stats.totalConsultations).toBe(0);
      expect(result.current.stats.dailyStats).toEqual([]);
      expect(result.current.stats.categoryStats).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('빈 상담 데이터 처리', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any) // consultations
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any) // students
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any) // enrollments
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any); // classes

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalConsultations).toBe(0);
      expect(result.current.stats.dailyStats).toEqual([]);
      expect(result.current.stats.categoryStats).toEqual([]);
      expect(result.current.stats.staffPerformances).toEqual([]);
      expect(result.current.stats.topPerformer).toBeNull();
    });

    it('getDocs가 올바른 쿼리 파라미터로 호출됨', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(collection).toHaveBeenCalledWith({}, 'student_consultations');
      });

      expect(where).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalled();
    });

    it('refetch 함수 호출 시 데이터 재조회', async () => {
      vi.mocked(getDocs)
        .mockResolvedValue(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = vi.mocked(getDocs).mock.calls.length;

      await result.current.refetch();

      expect(vi.mocked(getDocs).mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  describe('useConsultationStats - Consultation Aggregation', () => {
    it('dailyStats 집계가 올바르게 계산됨', async () => {
      const consultations = [
        createMockConsultation({ date: '2026-02-01', type: 'parent' }),
        createMockConsultation({ date: '2026-02-01', type: 'student' }),
        createMockConsultation({ date: '2026-02-02', type: 'parent' }),
        createMockConsultation({ date: '2026-02-02', type: 'parent' }),
        createMockConsultation({ date: '2026-02-03', type: 'student' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.dailyStats).toHaveLength(3);

      const day1 = result.current.stats.dailyStats.find((d) => d.date === '2026-02-01');
      expect(day1).toBeDefined();
      expect(day1?.parentCount).toBe(1);
      expect(day1?.studentCount).toBe(1);
      expect(day1?.total).toBe(2);

      const day2 = result.current.stats.dailyStats.find((d) => d.date === '2026-02-02');
      expect(day2?.parentCount).toBe(2);
      expect(day2?.studentCount).toBe(0);
      expect(day2?.total).toBe(2);

      const day3 = result.current.stats.dailyStats.find((d) => d.date === '2026-02-03');
      expect(day3?.parentCount).toBe(0);
      expect(day3?.studentCount).toBe(1);
      expect(day3?.total).toBe(1);
    });

    it('dailyStats는 날짜순으로 정렬됨', async () => {
      const consultations = [
        createMockConsultation({ date: '2026-02-05', type: 'parent' }),
        createMockConsultation({ date: '2026-02-01', type: 'parent' }),
        createMockConsultation({ date: '2026-02-03', type: 'parent' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const dates = result.current.stats.dailyStats.map((d) => d.date);
      expect(dates).toEqual(['2026-02-01', '2026-02-03', '2026-02-05']);
    });

    it('categoryStats 집계가 올바르게 계산됨', async () => {
      const consultations = [
        createMockConsultation({ category: 'academic' }),
        createMockConsultation({ category: 'academic' }),
        createMockConsultation({ category: 'behavioral' }),
        createMockConsultation({ category: 'career' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const academic = result.current.stats.categoryStats.find((c) => c.category === 'academic');
      expect(academic?.count).toBe(2);
      expect(academic?.percentage).toBe(50);

      const behavioral = result.current.stats.categoryStats.find((c) => c.category === 'behavioral');
      expect(behavioral?.count).toBe(1);
      expect(behavioral?.percentage).toBe(25);

      const career = result.current.stats.categoryStats.find((c) => c.category === 'career');
      expect(career?.count).toBe(1);
      expect(career?.percentage).toBe(25);
    });

    it('totalConsultations 카운트가 정확함', async () => {
      const consultations = [
        createMockConsultation(),
        createMockConsultation(),
        createMockConsultation(),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalConsultations).toBe(3);
    });

    it('parentConsultations와 studentConsultations 분리 집계', async () => {
      const consultations = [
        createMockConsultation({ type: 'parent' }),
        createMockConsultation({ type: 'parent' }),
        createMockConsultation({ type: 'student' }),
        createMockConsultation({ type: 'student' }),
        createMockConsultation({ type: 'student' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.parentConsultations).toBe(2);
      expect(result.current.stats.studentConsultations).toBe(3);
    });

    it('followUpNeeded와 followUpDone 카운트', async () => {
      const consultations = [
        createMockConsultation({ followUpNeeded: true, followUpDone: false }),
        createMockConsultation({ followUpNeeded: true, followUpDone: false }),
        createMockConsultation({ followUpNeeded: true, followUpDone: true }),
        createMockConsultation({ followUpNeeded: false, followUpDone: false }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.followUpNeeded).toBe(2);
      expect(result.current.stats.followUpDone).toBe(1);
    });
  });

  describe('useConsultationStats - Staff Performance', () => {
    it('staffPerformances 계산 (강사만)', async () => {
      const staff: StaffMember[] = [
        { id: 'teacher1', name: '선생님1', role: 'teacher' } as StaffMember,
        { id: 'teacher2', name: '선생님2', role: '강사' } as StaffMember,
        { id: 'admin1', name: '관리자1', role: 'admin' } as StaffMember,
      ];

      const consultations = [
        createMockConsultation({ consultantId: 'teacher1', consultantName: '선생님1' }),
        createMockConsultation({ consultantId: 'teacher1', consultantName: '선생님1' }),
        createMockConsultation({ consultantId: 'teacher2', consultantName: '선생님2' }),
        createMockConsultation({ consultantId: 'admin1', consultantName: '관리자1' }), // 제외됨
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(undefined, staff), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.staffPerformances).toHaveLength(2);

      const perf1 = result.current.stats.staffPerformances.find((s) => s.id === 'teacher1');
      expect(perf1?.consultationCount).toBe(2);
      expect(perf1?.targetCount).toBe(50); // 100 / 2 teachers

      const perf2 = result.current.stats.staffPerformances.find((s) => s.id === 'teacher2');
      expect(perf2?.consultationCount).toBe(1);
    });

    it('staffPerformances는 상담 건수 내림차순 정렬', async () => {
      const staff: StaffMember[] = [
        { id: 'teacher1', name: '선생님1', role: 'teacher' } as StaffMember,
        { id: 'teacher2', name: '선생님2', role: 'teacher' } as StaffMember,
        { id: 'teacher3', name: '선생님3', role: 'teacher' } as StaffMember,
      ];

      const consultations = [
        createMockConsultation({ consultantId: 'teacher1' }),
        createMockConsultation({ consultantId: 'teacher2' }),
        createMockConsultation({ consultantId: 'teacher2' }),
        createMockConsultation({ consultantId: 'teacher2' }),
        createMockConsultation({ consultantId: 'teacher3' }),
        createMockConsultation({ consultantId: 'teacher3' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(undefined, staff), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const ids = result.current.stats.staffPerformances.map((s) => s.id);
      expect(ids).toEqual(['teacher2', 'teacher3', 'teacher1']);
    });

    it('topPerformer는 가장 많은 상담을 한 강사', async () => {
      const staff: StaffMember[] = [
        { id: 'teacher1', name: '선생님1', role: 'teacher' } as StaffMember,
        { id: 'teacher2', name: '선생님2', role: 'teacher' } as StaffMember,
      ];

      const consultations = [
        createMockConsultation({ consultantId: 'teacher1' }),
        createMockConsultation({ consultantId: 'teacher2' }),
        createMockConsultation({ consultantId: 'teacher2' }),
        createMockConsultation({ consultantId: 'teacher2' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(undefined, staff), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.topPerformer?.id).toBe('teacher2');
      expect(result.current.stats.topPerformer?.consultationCount).toBe(3);
    });

    it('staff 목록이 없으면 모든 상담자를 포함', async () => {
      const consultations = [
        createMockConsultation({ consultantId: 'teacher1', consultantName: '선생님1' }),
        createMockConsultation({ consultantId: 'admin1', consultantName: '관리자1' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.staffPerformances).toHaveLength(2);
    });

    it('percentage는 목표 대비 비율로 계산되고 100% 초과 시 100으로 제한', async () => {
      const staff: StaffMember[] = [
        { id: 'teacher1', name: '선생님1', role: 'teacher' } as StaffMember,
      ];

      // 목표: 100, 실제: 150
      const consultations = Array(150).fill(null).map(() =>
        createMockConsultation({ consultantId: 'teacher1' })
      );

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(undefined, staff), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const perf = result.current.stats.staffPerformances[0];
      expect(perf.percentage).toBe(100);
      expect(perf.consultationCount).toBe(150);
    });
  });

  describe('useConsultationStats - Staff Subject Stats', () => {
    it('staffSubjectStats 과목별 집계 (math/수학, english/영어)', async () => {
      const staff: StaffMember[] = [
        { id: 'teacher1', name: '선생님1', role: 'teacher' } as StaffMember,
      ];

      const consultations = [
        createMockConsultation({ consultantId: 'teacher1', subject: 'math' }),
        createMockConsultation({ consultantId: 'teacher1', subject: '수학' }),
        createMockConsultation({ consultantId: 'teacher1', subject: 'english' }),
        createMockConsultation({ consultantId: 'teacher1', subject: '영어' }),
        createMockConsultation({ consultantId: 'teacher1', subject: '영어' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(undefined, staff), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const stat = result.current.stats.staffSubjectStats.find((s) => s.id === 'teacher1');
      expect(stat?.mathCount).toBe(2);
      expect(stat?.englishCount).toBe(3);
      expect(stat?.totalCount).toBe(5);
    });

    it('상담 기록이 없는 강사도 staffSubjectStats에 포함됨 (카운트 0)', async () => {
      const staff: StaffMember[] = [
        { id: 'teacher1', name: '선생님1', role: 'teacher' } as StaffMember,
        { id: 'teacher2', name: '선생님2', role: 'teacher' } as StaffMember,
      ];

      const consultations = [
        createMockConsultation({ consultantId: 'teacher1', subject: 'math' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(undefined, staff), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.staffSubjectStats).toHaveLength(2);

      const teacher2Stat = result.current.stats.staffSubjectStats.find((s) => s.id === 'teacher2');
      expect(teacher2Stat?.mathCount).toBe(0);
      expect(teacher2Stat?.englishCount).toBe(0);
      expect(teacher2Stat?.totalCount).toBe(0);
    });

    it('staffSubjectStats는 totalCount 내림차순 정렬', async () => {
      const staff: StaffMember[] = [
        { id: 'teacher1', name: '선생님1', role: 'teacher' } as StaffMember,
        { id: 'teacher2', name: '선생님2', role: 'teacher' } as StaffMember,
        { id: 'teacher3', name: '선생님3', role: 'teacher' } as StaffMember,
      ];

      const consultations = [
        createMockConsultation({ consultantId: 'teacher1', subject: 'math' }),
        createMockConsultation({ consultantId: 'teacher2', subject: 'math' }),
        createMockConsultation({ consultantId: 'teacher2', subject: 'english' }),
        createMockConsultation({ consultantId: 'teacher2', subject: 'english' }),
        createMockConsultation({ consultantId: 'teacher3', subject: 'math' }),
        createMockConsultation({ consultantId: 'teacher3', subject: 'math' }),
        createMockConsultation({ consultantId: 'teacher3', subject: 'math' }),
        createMockConsultation({ consultantId: 'teacher3', subject: 'english' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(undefined, staff), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const ids = result.current.stats.staffSubjectStats.map((s) => s.id);
      expect(ids).toEqual(['teacher3', 'teacher2', 'teacher1']); // 4, 3, 1
    });
  });

  describe('useConsultationStats - Subject Filtering', () => {
    it('filters.subject = "math"는 수학 상담만 필터링', async () => {
      const consultations = [
        createMockConsultation({ subject: 'math', id: 'c1' }),
        createMockConsultation({ subject: '수학', id: 'c2' }),
        createMockConsultation({ subject: 'english', id: 'c3' }),
        createMockConsultation({ subject: '영어', id: 'c4' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const filters: ConsultationStatsFilters = { subject: 'math' };

      const { result } = renderHook(() => useConsultationStats(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalConsultations).toBe(2);
    });

    it('filters.subject = "english"는 영어 상담만 필터링', async () => {
      const consultations = [
        createMockConsultation({ subject: 'math', id: 'c1' }),
        createMockConsultation({ subject: '수학', id: 'c2' }),
        createMockConsultation({ subject: 'english', id: 'c3' }),
        createMockConsultation({ subject: '영어', id: 'c4' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const filters: ConsultationStatsFilters = { subject: 'english' };

      const { result } = renderHook(() => useConsultationStats(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalConsultations).toBe(2);
    });

    it('filters.subject = "all"은 모든 상담 포함', async () => {
      const consultations = [
        createMockConsultation({ subject: 'math', id: 'c1' }),
        createMockConsultation({ subject: 'english', id: 'c2' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const filters: ConsultationStatsFilters = { subject: 'all' };

      const { result } = renderHook(() => useConsultationStats(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalConsultations).toBe(2);
    });

    it('subject 필터가 없으면 모든 상담 포함', async () => {
      const consultations = [
        createMockConsultation({ subject: 'math', id: 'c1' }),
        createMockConsultation({ subject: 'english', id: 'c2' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalConsultations).toBe(2);
    });
  });

  describe('useConsultationStats - Students Needing Consultation', () => {
    it('수강 중이지만 상담 기록이 없는 학생이 목록에 포함됨', async () => {
      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
      ];

      const enrollmentDocs = [
        createMockEnrollmentDoc('student1', {
          className: 'Class1',
          subject: 'math',
          withdrawalDate: null,
          onHold: false,
        }),
      ];

      const classDocs = [
        createMockClassDoc('class1', {
          className: 'Class1',
          teacher: '선생님1',
          subject: 'math',
          isActive: true,
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any) // consultations (empty)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollmentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(classDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any); // all consultations (empty)

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.studentsNeedingConsultation).toHaveLength(1);
      expect(result.current.stats.studentsNeedingConsultation[0].studentId).toBe('student1');
      expect(result.current.stats.studentsNeedingConsultation[0].studentName).toBe('학생1');
      expect(result.current.stats.studentsNeedingConsultation[0].subject).toBe('math');
    });

    it('선택 기간 내 상담이 있는 학생은 목록에서 제외됨', async () => {
      const consultations = [
        createMockConsultation({ studentId: 'student1', subject: 'math' }),
      ];

      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
      ];

      const enrollmentDocs = [
        createMockEnrollmentDoc('student1', {
          className: 'Class1',
          subject: 'math',
          withdrawalDate: null,
          onHold: false,
        }),
      ];

      const classDocs = [
        createMockClassDoc('class1', {
          className: 'Class1',
          teacher: '선생님1',
          subject: 'math',
          isActive: true,
        }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollmentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(classDocs) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.studentsNeedingConsultation).toHaveLength(0);
    });

    it('수학/영어 동시 수강 학생은 과목별로 2개 항목 생성', async () => {
      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
      ];

      const enrollmentDocs = [
        createMockEnrollmentDoc('student1', {
          className: 'MathClass',
          subject: 'math',
          withdrawalDate: null,
          onHold: false,
        }),
        createMockEnrollmentDoc('student1', {
          className: 'EnglishClass',
          subject: 'english',
          withdrawalDate: null,
          onHold: false,
        }),
      ];

      const classDocs = [
        createMockClassDoc('class1', {
          className: 'MathClass',
          teacher: '선생님1',
          subject: 'math',
          isActive: true,
        }),
        createMockClassDoc('class2', {
          className: 'EnglishClass',
          teacher: '선생님2',
          subject: 'english',
          isActive: true,
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollmentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(classDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.studentsNeedingConsultation).toHaveLength(2);

      const mathItem = result.current.stats.studentsNeedingConsultation.find(
        (s) => s.subject === 'math'
      );
      expect(mathItem?.studentId).toBe('student1');

      const englishItem = result.current.stats.studentsNeedingConsultation.find(
        (s) => s.subject === 'english'
      );
      expect(englishItem?.studentId).toBe('student1');
    });

    it('lastConsultationDate는 전체 기간에서 조회됨', async () => {
      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
      ];

      const enrollmentDocs = [
        createMockEnrollmentDoc('student1', {
          className: 'Class1',
          subject: 'math',
          withdrawalDate: null,
          onHold: false,
        }),
      ];

      const classDocs = [
        createMockClassDoc('class1', {
          className: 'Class1',
          teacher: '선생님1',
          subject: 'math',
          isActive: true,
        }),
      ];

      // 전체 기간 상담 기록 (선택 기간 외)
      const allConsultationDocs = [
        createMockDocSnap('c1', {
          studentId: 'student1',
          subject: 'math',
          date: '2025-01-15', // 과거 기록
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any) // period consultations (empty)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollmentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(classDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(allConsultationDocs) as any); // all consultations

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.studentsNeedingConsultation[0].lastConsultationDate).toBe(
        '2025-01-15'
      );
    });

    it('studentsNeedingConsultation은 lastConsultationDate 오름차순 정렬 (null 우선)', async () => {
      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
        createMockDocSnap('student2', { name: '학생2', status: 'active' }),
        createMockDocSnap('student3', { name: '학생3', status: 'active' }),
      ];

      const enrollmentDocs = [
        createMockEnrollmentDoc('student1', { className: 'C1', subject: 'math', withdrawalDate: null, onHold: false }),
        createMockEnrollmentDoc('student2', { className: 'C2', subject: 'math', withdrawalDate: null, onHold: false }),
        createMockEnrollmentDoc('student3', { className: 'C3', subject: 'math', withdrawalDate: null, onHold: false }),
      ];

      const classDocs = [
        createMockClassDoc('c1', { className: 'C1', teacher: 'T1', subject: 'math', isActive: true }),
        createMockClassDoc('c2', { className: 'C2', teacher: 'T1', subject: 'math', isActive: true }),
        createMockClassDoc('c3', { className: 'C3', teacher: 'T1', subject: 'math', isActive: true }),
      ];

      const allConsultationDocs = [
        createMockDocSnap('c1', { studentId: 'student2', subject: 'math', date: '2025-01-01' }),
        createMockDocSnap('c2', { studentId: 'student3', subject: 'math', date: '2025-02-01' }),
        // student1은 상담 기록 없음 (null)
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollmentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(classDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(allConsultationDocs) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const studentIds = result.current.stats.studentsNeedingConsultation.map((s) => s.studentId);
      expect(studentIds).toEqual(['student1', 'student2', 'student3']); // null, 01-01, 02-01
    });

    it('퇴원(withdrawalDate) 또는 보류(onHold) 학생은 제외됨', async () => {
      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
        createMockDocSnap('student2', { name: '학생2', status: 'active' }),
      ];

      const enrollmentDocs = [
        createMockEnrollmentDoc('student1', {
          className: 'C1',
          subject: 'math',
          withdrawalDate: '2026-01-01', // 퇴원
          onHold: false,
        }),
        createMockEnrollmentDoc('student2', {
          className: 'C2',
          subject: 'math',
          withdrawalDate: null,
          onHold: true, // 보류
        }),
      ];

      const classDocs = [
        createMockClassDoc('c1', { className: 'C1', teacher: 'T1', subject: 'math', isActive: true }),
        createMockClassDoc('c2', { className: 'C2', teacher: 'T1', subject: 'math', isActive: true }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollmentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(classDocs) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.studentsNeedingConsultation).toHaveLength(0);
    });

    it('totalActiveStudents는 status=active인 학생 수', async () => {
      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
        createMockDocSnap('student2', { name: '학생2', status: 'active' }),
        createMockDocSnap('student3', { name: '학생3', status: 'inactive' }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalActiveStudents).toBe(3); // query는 active만 조회하지만 실제로는 snapshot 크기
    });

    it('totalSubjectEnrollments는 과목별 수강 건수의 합', async () => {
      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
        createMockDocSnap('student2', { name: '학생2', status: 'active' }),
      ];

      const enrollmentDocs = [
        createMockEnrollmentDoc('student1', { className: 'C1', subject: 'math', withdrawalDate: null, onHold: false }),
        createMockEnrollmentDoc('student1', { className: 'C2', subject: 'english', withdrawalDate: null, onHold: false }),
        createMockEnrollmentDoc('student2', { className: 'C3', subject: 'math', withdrawalDate: null, onHold: false }),
      ];

      const classDocs = [
        createMockClassDoc('c1', { className: 'C1', teacher: 'T1', subject: 'math', isActive: true }),
        createMockClassDoc('c2', { className: 'C2', teacher: 'T2', subject: 'english', isActive: true }),
        createMockClassDoc('c3', { className: 'C3', teacher: 'T1', subject: 'math', isActive: true }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollmentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(classDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.totalSubjectEnrollments).toBe(3); // student1(2) + student2(1)
    });
  });

  describe('useConsultationStats - Error Handling', () => {
    it('getDocs 실패 시 error 반환', async () => {
      const errorMessage = 'Firestore error';
      vi.mocked(getDocs).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.stats.totalConsultations).toBe(0);
    });

    it('네트워크 에러 처리', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('useConsultationStats - Custom Date Range', () => {
    it('filters.dateRange를 사용하면 기본값 대신 사용됨', async () => {
      const customRange = { start: '2026-01-01', end: '2026-01-31' };

      vi.mocked(getDocs)
        .mockResolvedValue(createMockQuerySnapshot([]) as any);

      renderHook(
        () => useConsultationStats({ dateRange: customRange }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(where).toHaveBeenCalledWith('date', '>=', '2026-01-01');
        expect(where).toHaveBeenCalledWith('date', '<=', '2026-01-31');
      });
    });
  });

  describe('useConsultationStats - Edge Cases', () => {
    it('consultantId가 없는 상담은 staffPerformances에서 제외', async () => {
      const consultations = [
        createMockConsultation({ consultantId: null }),
        createMockConsultation({ consultantId: undefined }),
        createMockConsultation({ consultantId: 'teacher1' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.staffPerformances).toHaveLength(1);
      expect(result.current.stats.staffPerformances[0].id).toBe('teacher1');
    });

    it('category 통계에서 percentage는 정수로 반올림', async () => {
      const consultations = [
        createMockConsultation({ category: 'academic' }),
        createMockConsultation({ category: 'academic' }),
        createMockConsultation({ category: 'behavioral' }),
      ];

      const consultDocs = consultations.map((c) => createMockDocSnap(c.id, c));

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(consultDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const academic = result.current.stats.categoryStats.find((c) => c.category === 'academic');
      expect(academic?.percentage).toBe(67); // 2/3 = 66.666... → 67

      const behavioral = result.current.stats.categoryStats.find((c) => c.category === 'behavioral');
      expect(behavioral?.percentage).toBe(33); // 1/3 = 33.333... → 33
    });

    it('상담 기록이 0건일 때 categoryStats의 percentage는 0', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.categoryStats).toEqual([]);
    });

    it('className이 없는 enrollment는 무시됨', async () => {
      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
      ];

      const enrollmentDocs = [
        createMockEnrollmentDoc('student1', {
          className: null, // className 없음
          subject: 'math',
          withdrawalDate: null,
          onHold: false,
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollmentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.studentsNeedingConsultation).toHaveLength(0);
      expect(result.current.stats.totalSubjectEnrollments).toBe(0);
    });

    it('isActive=false인 클래스는 staffSubjectStats 계산에서 제외', async () => {
      const staff: StaffMember[] = [
        { id: 'teacher1', name: '선생님1', role: 'teacher' } as StaffMember,
      ];

      const studentDocs = [
        createMockDocSnap('student1', { name: '학생1', status: 'active' }),
      ];

      const enrollmentDocs = [
        createMockEnrollmentDoc('student1', {
          className: 'InactiveClass',
          subject: 'math',
          withdrawalDate: null,
          onHold: false,
        }),
      ];

      const classDocs = [
        createMockClassDoc('class1', {
          className: 'InactiveClass',
          teacher: '선생님1',
          subject: 'math',
          isActive: false, // 비활성 클래스
        }),
      ];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(studentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(enrollmentDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot(classDocs) as any)
        .mockResolvedValueOnce(createMockQuerySnapshot([]) as any);

      const { result } = renderHook(() => useConsultationStats(undefined, staff), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const stat = result.current.stats.staffSubjectStats.find((s) => s.id === 'teacher1');
      expect(stat?.mathTotal).toBe(0); // isActive=false라 카운트 안됨
    });
  });
});
