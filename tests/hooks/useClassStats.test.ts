import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useClassStats } from '../../hooks/useClassStats';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

import { collection, getDocs } from 'firebase/firestore';

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date: Date, fmt: string) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    if (fmt === 'yyyy-MM-dd') return `${y}-${m}-${d}`;
    if (fmt === 'yyyy-MM') return `${y}-${m}`;
    return `${y}-${m}-${d}`;
  }),
  startOfMonth: vi.fn((date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)),
  endOfMonth: vi.fn((date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)),
}));

import { getDocs, collection } from 'firebase/firestore';

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

describe('useClassStats Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-establish collection mock to return proper reference objects
    (collection as any).mockImplementation((...args: any[]) => {
      const path = args.slice(1).join('/');
      return { _path: path, _args: args };
    });
  });

  describe('Disabled States', () => {
    it('className이 빈 문자열일 때 쿼리가 비활성화되고 기본값을 반환한다', () => {
      const { result } = renderHook(
        () => useClassStats('', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      expect(result.current.attendanceRate).toBe(0);
      expect(result.current.consultationRate).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('subject가 빈 문자열일 때 쿼리가 비활성화되고 기본값을 반환한다', () => {
      const { result } = renderHook(
        () => useClassStats('중등 수학', '', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      expect(result.current.attendanceRate).toBe(0);
      expect(result.current.consultationRate).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('studentIds가 빈 배열일 때 쿼리가 비활성화되고 기본값을 반환한다', () => {
      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', []),
        { wrapper: createWrapper() }
      );

      expect(result.current.attendanceRate).toBe(0);
      expect(result.current.consultationRate).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('모든 매개변수가 비어있을 때 쿼리가 비활성화된다', () => {
      const { result } = renderHook(
        () => useClassStats('', '', []),
        { wrapper: createWrapper() }
      );

      expect(result.current.attendanceRate).toBe(0);
      expect(result.current.consultationRate).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(getDocs).not.toHaveBeenCalled();
    });
  });

  describe('Attendance Calculation', () => {
    it('출석 기록이 없을 때 attendanceRate는 0이다', async () => {
      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attendanceRate).toBe(0);
    });

    it('모든 학생이 출석(present)일 때 attendanceRate는 100%이다', async () => {
      const mockAttendanceDocs = [
        {
          data: () => ({
            studentId: 'student1',
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
        {
          data: () => ({
            studentId: 'student2',
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('daily_attendance')) {
          return { docs: mockAttendanceDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attendanceRate).toBe(100);
    });

    it('출석(present)과 지각(late)을 모두 출석으로 계산한다', async () => {
      const mockAttendanceDocs = [
        {
          data: () => ({
            studentId: 'student1',
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
        {
          data: () => ({
            studentId: 'student2',
            className: '중등 수학',
            subject: '수학',
            status: 'late',
          }),
        },
        {
          data: () => ({
            studentId: 'student3',
            className: '중등 수학',
            subject: '수학',
            status: 'absent',
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('daily_attendance')) {
          return { docs: mockAttendanceDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2', 'student3']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 2명 출석(present + late) / 3명 총원 = 67%
      expect(result.current.attendanceRate).toBe(67);
    });

    it('className이 일치하는 기록만 계산한다', async () => {
      const mockAttendanceDocs = [
        {
          data: () => ({
            studentId: 'student1',
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
        {
          data: () => ({
            studentId: 'student2',
            className: '고등 수학', // 다른 클래스
            subject: '수학',
            status: 'present',
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('daily_attendance')) {
          return { docs: mockAttendanceDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // student1만 카운트 (1/1 = 100%)
      expect(result.current.attendanceRate).toBe(100);
    });

    it('subject가 일치하는 기록만 계산한다', async () => {
      const mockAttendanceDocs = [
        {
          data: () => ({
            studentId: 'student1',
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
        {
          data: () => ({
            studentId: 'student2',
            className: '중등 수학',
            subject: '영어', // 다른 과목
            status: 'present',
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('daily_attendance')) {
          return { docs: mockAttendanceDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // student1만 카운트 (1/1 = 100%)
      expect(result.current.attendanceRate).toBe(100);
    });

    it('studentIds에 포함된 학생만 계산한다', async () => {
      const mockAttendanceDocs = [
        {
          data: () => ({
            studentId: 'student1',
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
        {
          data: () => ({
            studentId: 'student3', // studentIds에 없는 학생
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('daily_attendance')) {
          return { docs: mockAttendanceDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // student1만 카운트 (1/1 = 100%)
      expect(result.current.attendanceRate).toBe(100);
    });

    it('결석(absent) 기록은 출석 카운트에서 제외된다', async () => {
      const mockAttendanceDocs = [
        {
          data: () => ({
            studentId: 'student1',
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
        {
          data: () => ({
            studentId: 'student2',
            className: '중등 수학',
            subject: '수학',
            status: 'absent',
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('daily_attendance')) {
          return { docs: mockAttendanceDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 1명 출석 / 2명 총원 = 50%
      expect(result.current.attendanceRate).toBe(50);
    });

    it('출석률 계산 시 반올림을 적용한다', async () => {
      const mockAttendanceDocs = [
        {
          data: () => ({
            studentId: 'student1',
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
        {
          data: () => ({
            studentId: 'student2',
            className: '중등 수학',
            subject: '수학',
            status: 'absent',
          }),
        },
        {
          data: () => ({
            studentId: 'student3',
            className: '중등 수학',
            subject: '수학',
            status: 'absent',
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('daily_attendance')) {
          return { docs: mockAttendanceDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2', 'student3']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 1/3 = 33.333... -> 33%
      expect(result.current.attendanceRate).toBe(33);
    });
  });

  describe('Consultation Calculation', () => {
    it('상담 기록이 없을 때 consultationRate는 0이다', async () => {
      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.consultationRate).toBe(0);
    });

    it('모든 학생이 이번 달에 상담받았을 때 consultationRate는 100%이다', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const mockConsultationDocs = [
        {
          data: () => ({
            registeredStudentId: 'student1',
            consultationDate: `${thisMonth}-05`,
          }),
        },
        {
          data: () => ({
            registeredStudentId: 'student2',
            consultationDate: `${thisMonth}-10`,
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('consultations')) {
          return { docs: mockConsultationDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.consultationRate).toBe(100);
    });

    it('일부 학생만 상담받았을 때 올바른 비율을 계산한다', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const mockConsultationDocs = [
        {
          data: () => ({
            registeredStudentId: 'student1',
            consultationDate: `${thisMonth}-05`,
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('consultations')) {
          return { docs: mockConsultationDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2', 'student3']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 1명 상담 / 3명 총원 = 33%
      expect(result.current.consultationRate).toBe(33);
    });

    it('이번 달 상담만 카운트한다', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lastMonth = now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12`
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

      const mockConsultationDocs = [
        {
          data: () => ({
            registeredStudentId: 'student1',
            consultationDate: `${thisMonth}-05`,
          }),
        },
        {
          data: () => ({
            registeredStudentId: 'student2',
            consultationDate: `${lastMonth}-20`, // 지난 달
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('consultations')) {
          return { docs: mockConsultationDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // student1만 카운트 (1/2 = 50%)
      expect(result.current.consultationRate).toBe(50);
    });

    it('studentIds에 포함된 학생의 상담만 카운트한다', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const mockConsultationDocs = [
        {
          data: () => ({
            registeredStudentId: 'student1',
            consultationDate: `${thisMonth}-05`,
          }),
        },
        {
          data: () => ({
            registeredStudentId: 'student3', // studentIds에 없음
            consultationDate: `${thisMonth}-10`,
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('consultations')) {
          return { docs: mockConsultationDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // student1만 카운트 (1/2 = 50%)
      expect(result.current.consultationRate).toBe(50);
    });

    it('동일 학생의 중복 상담은 1회로 계산한다', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const mockConsultationDocs = [
        {
          data: () => ({
            registeredStudentId: 'student1',
            consultationDate: `${thisMonth}-05`,
          }),
        },
        {
          data: () => ({
            registeredStudentId: 'student1', // 동일 학생
            consultationDate: `${thisMonth}-10`,
          }),
        },
        {
          data: () => ({
            registeredStudentId: 'student1', // 동일 학생
            consultationDate: `${thisMonth}-15`,
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('consultations')) {
          return { docs: mockConsultationDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // student1만 카운트 (1/2 = 50%), 중복 제거
      expect(result.current.consultationRate).toBe(50);
    });

    it('consultationDate가 없는 기록은 무시한다', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const mockConsultationDocs = [
        {
          data: () => ({
            registeredStudentId: 'student1',
            consultationDate: `${thisMonth}-05`,
          }),
        },
        {
          data: () => ({
            registeredStudentId: 'student2',
            // consultationDate 없음
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('consultations')) {
          return { docs: mockConsultationDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // student1만 카운트 (1/2 = 50%)
      expect(result.current.consultationRate).toBe(50);
    });

    it('registeredStudentId가 없는 기록은 무시한다', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const mockConsultationDocs = [
        {
          data: () => ({
            registeredStudentId: 'student1',
            consultationDate: `${thisMonth}-05`,
          }),
        },
        {
          data: () => ({
            // registeredStudentId 없음
            consultationDate: `${thisMonth}-10`,
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('consultations')) {
          return { docs: mockConsultationDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // student1만 카운트 (1/2 = 50%)
      expect(result.current.consultationRate).toBe(50);
    });

    it('상담률 계산 시 반올림을 적용한다', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const mockConsultationDocs = [
        {
          data: () => ({
            registeredStudentId: 'student1',
            consultationDate: `${thisMonth}-05`,
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('consultations')) {
          return { docs: mockConsultationDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2', 'student3']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 1/3 = 33.333... -> 33%
      expect(result.current.consultationRate).toBe(33);
    });
  });

  describe('Loading States', () => {
    it('데이터 로딩 중일 때 isLoading은 true이다', () => {
      vi.mocked(getDocs).mockImplementation(
        () => new Promise(() => {}) // 영원히 대기
      );

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1']),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('데이터 로딩 완료 후 isLoading은 false이다', async () => {
      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Combined Scenarios', () => {
    it('출석률과 상담률을 동시에 올바르게 계산한다', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const mockAttendanceDocs = [
        {
          data: () => ({
            studentId: 'student1',
            className: '중등 수학',
            subject: '수학',
            status: 'present',
          }),
        },
        {
          data: () => ({
            studentId: 'student2',
            className: '중등 수학',
            subject: '수학',
            status: 'late',
          }),
        },
      ];

      const mockConsultationDocs = [
        {
          data: () => ({
            registeredStudentId: 'student1',
            consultationDate: `${thisMonth}-05`,
          }),
        },
      ];

      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        const path = ref._path || '';
        if (path.includes('daily_attendance')) {
          return { docs: mockAttendanceDocs, empty: false };
        }
        if (path.includes('consultations')) {
          return { docs: mockConsultationDocs, empty: false };
        }
        return { docs: [], empty: true };
      });

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1', 'student2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attendanceRate).toBe(100); // 2/2 = 100%
      expect(result.current.consultationRate).toBe(50); // 1/2 = 50%
    });

    it('매개변수 변경 시 쿼리를 다시 실행한다', async () => {
      vi.mocked(getDocs).mockImplementation(async (ref: any) => {
        return { docs: [], empty: true };
      });

      const { result, rerender } = renderHook(
        ({ className, subject, studentIds }) =>
          useClassStats(className, subject, studentIds),
        {
          wrapper: createWrapper(),
          initialProps: {
            className: '중등 수학',
            subject: '수학',
            studentIds: ['student1'],
          },
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = vi.mocked(getDocs).mock.calls.length;

      // 매개변수 변경
      rerender({
        className: '고등 수학',
        subject: '영어',
        studentIds: ['student2', 'student3'],
      });

      await waitFor(() => {
        expect(vi.mocked(getDocs).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Error Handling', () => {
    it('출석 데이터 조회 실패 시 0%를 반환한다', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attendanceRate).toBe(0);
    });

    it('상담 데이터 조회 실패 시 0%를 반환한다', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(
        () => useClassStats('중등 수학', '수학', ['student1']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.consultationRate).toBe(0);
    });
  });
});
