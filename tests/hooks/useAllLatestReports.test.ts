import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useAllLatestReports } from '../../hooks/useAllLatestReports';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';

// supabaseClient 모킹 (Firebase 없이 동작)
vi.mock('../../services/supabaseClient', () => ({
  fetchAllLatestReports: vi.fn(),
}));

import { fetchAllLatestReports } from '../../services/supabaseClient';

describe('useAllLatestReports Hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('초기 상태', () => {
    it('데이터 로드 전 isLoading이 true이다', () => {
      // Given: fetchAllLatestReports가 해결되지 않는 Promise를 반환하면
      (fetchAllLatestReports as any).mockReturnValue(new Promise(() => {}));

      // When: 훅이 렌더링되면
      const { result } = renderHook(() => useAllLatestReports(), {
        wrapper: createWrapper(),
      });

      // Then: 로딩 상태로 시작한다
      expect(result.current.isLoading).toBe(true);
    });

    it('필수 반환값(data, isLoading, isError, error)을 모두 반환한다', async () => {
      // Given: fetchAllLatestReports가 빈 Map을 반환하도록 설정하면
      (fetchAllLatestReports as any).mockResolvedValue(new Map());

      // When: 훅이 렌더링되면
      const { result } = renderHook(() => useAllLatestReports(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Then: 필수 반환값이 모두 존재한다
      expect(result.current.data).toBeDefined();
      expect(result.current.isLoading).toBeDefined();
      expect(result.current.isError).toBeDefined();
      expect(result.current.error).toBeDefined();
    });
  });

  describe('데이터 로드 성공', () => {
    it('보고서 Map을 정상적으로 반환한다', async () => {
      // Given: 학생 보고서 Map을 준비하고
      const mockMap = new Map([
        ['홍길동', { progress: '80%', date: '2026-03-01' }],
        ['김철수', { progress: '90%', date: '2026-03-02' }],
      ]);
      (fetchAllLatestReports as any).mockResolvedValue(mockMap);

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useAllLatestReports(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Then: 보고서 Map이 반환된다
      expect(result.current.data).toBeInstanceOf(Map);
      expect(result.current.data!.size).toBe(2);
      expect(result.current.data!.get('홍길동')).toEqual({ progress: '80%', date: '2026-03-01' });
    });

    it('빈 Map을 반환할 때도 정상 처리된다', async () => {
      // Given: 학생이 없을 때
      (fetchAllLatestReports as any).mockResolvedValue(new Map());

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useAllLatestReports(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Then: 빈 Map이 반환된다
      expect(result.current.data!.size).toBe(0);
      expect(result.current.isError).toBe(false);
    });
  });

  describe('에러 처리', () => {
    it('fetchAllLatestReports 실패 시 isError가 true가 된다', async () => {
      // Given: 서비스 호출이 실패하도록 설정하고
      (fetchAllLatestReports as any).mockRejectedValue(new Error('Supabase 연결 오류'));

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useAllLatestReports(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Then: 에러 상태가 된다
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeDefined();
    });
  });
});
