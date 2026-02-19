import { useEffect, useRef, useState, useCallback } from 'react';

declare const __APP_VERSION__: string;

const CHECK_INTERVAL = 5 * 60 * 1000; // 5분마다 체크

/**
 * 서버의 version.json을 주기적으로 폴링하여
 * 새 배포가 감지되면 알려주는 훅.
 */
export function useVersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const currentVersion = useRef(__APP_VERSION__);

  const checkVersion = useCallback(async () => {
    // 개발 모드에서는 체크하지 않음
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
    // 최초 30초 후 첫 체크, 이후 5분 간격
    const initialTimer = setTimeout(checkVersion, 30_000);
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [checkVersion]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  return { hasUpdate, reload };
}
