import { useEffect } from 'react';

/**
 * 저장 안 된 변경사항이 있을 때 페이지 이탈/새로고침 방지.
 *
 * - 브라우저 기본 "변경된 내용을 저장하지 않을 수 있습니다" 다이얼로그 표시
 * - `location.reload()`, `beforeunload`, 탭 닫기, 뒤로가기 모두 가드
 * - 새 배포 후 `vite:preloadError`로 인한 자동 reload 시도도 이 가드에 걸림
 *
 * @param enabled true면 가드 활성화 (예: 폼이 dirty할 때)
 * @param message 보조 메시지 (현대 브라우저는 무시하지만 일부 레거시 브라우저는 표시)
 *
 * @example
 * ```tsx
 * const [title, setTitle] = useState('');
 * const isDirty = title.length > 0;
 * useUnsavedChangesGuard(isDirty);
 * ```
 */
export function useUnsavedChangesGuard(enabled: boolean, message?: string) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 일부 브라우저(레거시)는 returnValue 필요
      e.returnValue = message || '저장하지 않은 변경사항이 있습니다.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, message]);
}
