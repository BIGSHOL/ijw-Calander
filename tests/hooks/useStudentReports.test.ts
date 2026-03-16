import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useStudentReports } from '../../hooks/useStudentReports';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';

// supabaseClient 모킹
vi.mock('../../services/supabaseClient', () => ({
  fetchStudentReports: vi.fn(),
}));

import { fetchStudentReports } from '../../services/supabaseClient';

describe('useStudentReports Hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  const mockReports = [
    { id: 1, studentName: '홍길동', progress: '80%', date: '2026-03-01' },
    { id: 2, studentName: '홍길동', progress: '85%', date: '2026-03-05' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('studentName이 없는 경우', () => {
    it('studentName이 null이면 쿼리가 실행되지 않는다', () => {
      // When: studentName이 null로 호출되면
      const { result } = renderHook(() => useStudentReports(null), {
        wrapper: createWrapper(),
      });

      // Then: fetchStudentReports가 호출되지 않는다
      expect(result.current.isLoading).toBe(false);
      expect(fetchStudentReports as any).not.toHaveBeenCalled();
    });

    it('studentName이 undefined이면 쿼리가 실행되지 않는다', () => {
      // When: studentName이 undefined로 호출되면
      const { result } = renderHook(() => useStudentReports(undefined), {
        wrapper: createWrapper(),
      });

      // Then: 쿼리가 비활성화된다
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('studentName이 빈 문자열이면 쿼리가 실행되지 않는다', () => {
      // When: studentName이 빈 문자열이면
      const { result } = renderHook(() => useStudentReports(''), {
        wrapper: createWrapper(),
      });

      // Then: 쿼리가 비활성화된다
      expect(result.current.isLoading).toBe(false);
      expect(fetchStudentReports as any).not.toHaveBeenCalled();
    });
  });

  describe('데이터 로드 성공', () => {
    it('학생 이름이 있을 때 보고서 목록을 반환한다', async () => {
      // Given: fetchStudentReports가 보고서 배열을 반환하도록 설정하면
      (fetchStudentReports as any).mockResolvedValue(mockReports);

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useStudentReports('홍길동'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Then: 보고서 배열이 반환된다
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data![0].progress).toBe('80%');
    });

    it('기본 limit=10으로 fetchStudentReports를 호출한다', async () => {
      // Given: fetchStudentReports가 설정되면
      (fetchStudentReports as any).mockResolvedValue([]);

      // When: limit을 지정하지 않고 호출하면
      const { result } = renderHook(() => useStudentReports('홍길동'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Then: 기본 limit=10으로 호출된다
      expect(fetchStudentReports).toHaveBeenCalledWith('홍길동', 10);
    });

    it('지정한 limit으로 fetchStudentReports를 호출한다', async () => {
      // Given: fetchStudentReports가 설정되면
      (fetchStudentReports as any).mockResolvedValue([]);

      // When: limit=5로 호출하면
      const { result } = renderHook(() => useStudentReports('홍길동', 5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Then: limit=5로 호출된다
      expect(fetchStudentReports).toHaveBeenCalledWith('홍길동', 5);
    });

    it('보고서가 없을 때 빈 배열을 반환한다', async () => {
      // Given: 보고서가 없을 때
      (fetchStudentReports as any).mockResolvedValue([]);

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useStudentReports('홍길동'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Then: 빈 배열이 반환된다
      expect(result.current.data).toEqual([]);
      expect(result.current.isError).toBe(false);
    });
  });

  describe('enabled 파라미터', () => {
    it('enabled=false이면 studentName이 있어도 쿼리가 실행되지 않는다', () => {
      // When: enabled=false로 호출되면
      const { result } = renderHook(
        () => useStudentReports('홍길동', 10, false),
        { wrapper: createWrapper() }
      );

      // Then: 쿼리가 실행되지 않는다
      expect(result.current.isLoading).toBe(false);
      expect(fetchStudentReports as any).not.toHaveBeenCalled();
    });
  });

  describe('에러 처리', () => {
    it('fetchStudentReports 실패 시 isError가 true가 된다', async () => {
      // Given: 서비스 호출이 실패하면
      (fetchStudentReports as any).mockRejectedValue(new Error('Supabase 조회 오류'));

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useStudentReports('홍길동'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Then: 에러 상태가 된다
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeDefined();
    });
  });
});
