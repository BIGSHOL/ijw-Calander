// queryClient.ts - React Query 클라이언트 설정
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5분 기본 캐싱
            gcTime: 1000 * 60 * 30, // 30분 캐시 보관 (v5에서 cacheTime -> gcTime)
            refetchOnWindowFocus: false, // 윈도우 포커스 시 재조회 안 함
            retry: 1, // 실패 시 1회 재시도
        },
    },
});
