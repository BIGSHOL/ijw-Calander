import { renderHook } from '@testing-library/react';
import { useEscapeClose } from '../../hooks/useEscapeClose';

describe('useEscapeClose Hook', () => {
  let onCloseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCloseMock = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('기본 동작', () => {
    it('훅이 정상적으로 마운트된다', () => {
      // Given: useEscapeClose 훅이 호출되면
      // Then: 에러 없이 마운트된다
      expect(() => {
        renderHook(() => useEscapeClose(onCloseMock));
      }).not.toThrow();
    });

    it('마운트 시 keydown 이벤트 리스너가 document에 등록된다', () => {
      // Given: document.addEventListener 스파이를 설정하고
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      // When: 훅이 마운트되면
      renderHook(() => useEscapeClose(onCloseMock));

      // Then: keydown 이벤트 리스너가 등록된다
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it('반환값이 없다 (void)', () => {
      // Given: useEscapeClose 훅이 호출되면
      const { result } = renderHook(() => useEscapeClose(onCloseMock));

      // Then: 반환값이 undefined이다
      expect(result.current).toBeUndefined();
    });
  });

  describe('ESC 키 처리', () => {
    it('ESC 키를 누르면 onClose가 호출된다', () => {
      // Given: 훅이 마운트된 상태이고
      renderHook(() => useEscapeClose(onCloseMock));

      // When: ESC 키를 누르면
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escEvent);

      // Then: onClose가 1회 호출된다
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('Enter 키를 누르면 onClose가 호출되지 않는다', () => {
      // Given: 훅이 마운트된 상태이고
      renderHook(() => useEscapeClose(onCloseMock));

      // When: Enter 키를 누르면
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      document.dispatchEvent(enterEvent);

      // Then: onClose가 호출되지 않는다
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('Space 키를 누르면 onClose가 호출되지 않는다', () => {
      // Given: 훅이 마운트된 상태이고
      renderHook(() => useEscapeClose(onCloseMock));

      // When: Space 키를 누르면
      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
      });
      document.dispatchEvent(spaceEvent);

      // Then: onClose가 호출되지 않는다
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('Tab 키를 누르면 onClose가 호출되지 않는다', () => {
      // Given: 훅이 마운트된 상태이고
      renderHook(() => useEscapeClose(onCloseMock));

      // When: Tab 키를 누르면
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      });
      document.dispatchEvent(tabEvent);

      // Then: onClose가 호출되지 않는다
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('ESC 키를 여러 번 누르면 onClose가 그만큼 호출된다', () => {
      // Given: 훅이 마운트된 상태이고
      renderHook(() => useEscapeClose(onCloseMock));

      // When: ESC 키를 3번 누르면
      for (let i = 0; i < 3; i++) {
        const escEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
        });
        document.dispatchEvent(escEvent);
      }

      // Then: onClose가 3번 호출된다
      expect(onCloseMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cleanup 및 이벤트 리스너 제거', () => {
    it('컴포넌트 언마운트 시 keydown 이벤트 리스너가 제거된다', () => {
      // Given: document.removeEventListener 스파이를 설정하고
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      // When: 훅이 마운트됐다가 언마운트되면
      const { unmount } = renderHook(() => useEscapeClose(onCloseMock));
      unmount();

      // Then: keydown 이벤트 리스너가 제거된다
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it('언마운트 후 ESC 키를 눌러도 onClose가 호출되지 않는다', () => {
      // Given: 훅이 마운트된 상태에서
      const { unmount } = renderHook(() => useEscapeClose(onCloseMock));

      // When: 언마운트하고
      unmount();

      // And: ESC 키를 누르면
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escEvent);

      // Then: onClose가 호출되지 않는다
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('onClose 콜백 변경', () => {
    it('onClose 콜백이 변경되면 새로운 콜백이 사용된다', () => {
      // Given: 첫 번째 onClose 콜백으로 훅이 마운트되고
      const firstOnClose = vi.fn();
      const { rerender } = renderHook(
        ({ onClose }) => useEscapeClose(onClose),
        { initialProps: { onClose: firstOnClose } }
      );

      // When: onClose 콜백을 변경하고
      const secondOnClose = vi.fn();
      rerender({ onClose: secondOnClose });

      // And: ESC 키를 누르면
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escEvent);

      // Then: 새로운 콜백이 호출되고 이전 콜백은 호출되지 않는다
      expect(firstOnClose).not.toHaveBeenCalled();
      expect(secondOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('다중 인스턴스', () => {
    it('여러 훅 인스턴스가 동시에 마운트되면 각 onClose가 모두 호출된다', () => {
      // Given: 두 개의 훅 인스턴스가 마운트된 상태이고
      const firstOnClose = vi.fn();
      const secondOnClose = vi.fn();

      renderHook(() => useEscapeClose(firstOnClose));
      renderHook(() => useEscapeClose(secondOnClose));

      // When: ESC 키를 누르면
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escEvent);

      // Then: 두 콜백 모두 호출된다
      expect(firstOnClose).toHaveBeenCalledTimes(1);
      expect(secondOnClose).toHaveBeenCalledTimes(1);
    });

    it('하나의 인스턴스가 언마운트되면 해당 콜백만 제거된다', () => {
      // Given: 두 개의 훅 인스턴스가 마운트된 상태에서
      const firstOnClose = vi.fn();
      const secondOnClose = vi.fn();

      const { unmount: unmountFirst } = renderHook(() =>
        useEscapeClose(firstOnClose)
      );
      renderHook(() => useEscapeClose(secondOnClose));

      // When: 첫 번째 인스턴스를 언마운트하고
      unmountFirst();

      // And: ESC 키를 누르면
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escEvent);

      // Then: 두 번째 콜백만 호출된다
      expect(firstOnClose).not.toHaveBeenCalled();
      expect(secondOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('onClose가 여러 번 변경되어도 마지막 콜백이 사용된다', () => {
      // Given: 훅이 마운트된 상태에서
      const firstOnClose = vi.fn();
      const secondOnClose = vi.fn();
      const thirdOnClose = vi.fn();

      const { rerender } = renderHook(
        ({ onClose }) => useEscapeClose(onClose),
        { initialProps: { onClose: firstOnClose } }
      );

      // When: 콜백을 두 번 변경하고
      rerender({ onClose: secondOnClose });
      rerender({ onClose: thirdOnClose });

      // And: ESC 키를 누르면
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escEvent);

      // Then: 마지막 콜백만 호출된다
      expect(firstOnClose).not.toHaveBeenCalled();
      expect(secondOnClose).not.toHaveBeenCalled();
      expect(thirdOnClose).toHaveBeenCalledTimes(1);
    });

    it('keyup 이벤트는 무시된다 (keydown만 처리)', () => {
      // Given: 훅이 마운트된 상태이고
      renderHook(() => useEscapeClose(onCloseMock));

      // When: keyup 이벤트로 ESC를 발생시키면
      const escKeyupEvent = new KeyboardEvent('keyup', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escKeyupEvent);

      // Then: onClose가 호출되지 않는다
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });
});
