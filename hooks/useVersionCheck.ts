import { useEffect, useRef, useState, useCallback } from 'react';

declare const __APP_VERSION__: string;

const CHECK_INTERVAL = 5 * 60 * 1000; // 5분마다 체크

/**
 * 서버의 version.json을 주기적으로 폴링하여
 * 새 배포가 감지되면 알려주는 훅.
 *
 * - 앱 로드 10초 후 첫 체크
 * - 이후 5분 간격 폴링
 * - 탭 전환(visibilitychange) 시에도 체크
 * - bfcache 복원(pageshow) 시에도 체크
 */
export function useVersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const currentVersion = useRef(__APP_VERSION__);

  const checkVersion = useCallback(async () => {
    if (currentVersion.current === 'dev') return;

    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== currentVersion.current) {
        setHasUpdate(true);
      }
    } catch {
      // 네트워크 오류 시 무시
    }
  }, []);

  useEffect(() => {
    // 10초 후 첫 체크, 이후 5분 간격
    const initialTimer = setTimeout(checkVersion, 10_000);
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    // 탭이 다시 보일 때 체크 (백그라운드에서 돌아올 때)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    // bfcache에서 복원될 때 체크
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [checkVersion]);

  const reload = useCallback(() => {
    // 캐시 무시 새로고침: URL에 버전 파라미터 추가
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.href = url.toString();
  }, []);

  return { hasUpdate, reload };
}
