import { useEffect } from 'react';

/**
 * ESC 키로 모달을 닫는 훅.
 * Common/Modal.tsx를 사용하지 않는 커스텀 모달에서 사용.
 */
export function useEscapeClose(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
}
