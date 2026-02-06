import { useEffect, useRef, useCallback } from 'react';
import { AppTab, TAB_META } from '../types';

/**
 * 브라우저 히스토리와 탭 네비게이션을 연동하는 훅
 * - 탭 전환 시 브라우저 히스토리에 push
 * - 뒤로/앞으로 버튼으로 탭 간 이동
 * - 백스페이스 키로 페이지 이탈 방지
 * - URL 해시로 탭 상태 유지 (e.g. #calendar)
 */
export const useTabHistory = (
  appMode: AppTab | null,
  setAppMode: (tab: AppTab) => void
) => {
  const isPopstateRef = useRef(false);
  const isInitializedRef = useRef(false);
  const prevAppModeRef = useRef<AppTab | null>(null);

  // URL 해시에서 초기 탭 읽기
  const getTabFromHash = useCallback((): AppTab | null => {
    const hash = window.location.hash.slice(1);
    if (hash && TAB_META[hash as AppTab]) {
      return hash as AppTab;
    }
    return null;
  }, []);

  // 탭 변경 → 히스토리 동기화
  useEffect(() => {
    if (!appMode) return;

    // popstate에 의한 변경이면 히스토리 조작 스킵
    if (isPopstateRef.current) {
      isPopstateRef.current = false;
      prevAppModeRef.current = appMode;
      return;
    }

    // 같은 탭이면 스킵
    if (appMode === prevAppModeRef.current) return;

    if (!isInitializedRef.current) {
      // 최초 탭 설정 → replaceState (히스토리 쌓지 않음)
      window.history.replaceState({ tab: appMode }, '', `#${appMode}`);
      isInitializedRef.current = true;
    } else {
      // 이후 탭 전환 → pushState (히스토리에 추가)
      window.history.pushState({ tab: appMode }, '', `#${appMode}`);
    }

    prevAppModeRef.current = appMode;
  }, [appMode]);

  // popstate 리스너 (뒤로/앞으로 버튼)
  useEffect(() => {
    const handlePopstate = (event: PopStateEvent) => {
      const tab = event.state?.tab as AppTab | undefined;
      if (tab && TAB_META[tab]) {
        isPopstateRef.current = true;
        setAppMode(tab);
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [setAppMode]);

  // 백스페이스 키 → 입력 필드 외에서는 페이지 이탈 방지
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        const isEditable =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable;

        if (!isEditable) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  return { getTabFromHash };
};
