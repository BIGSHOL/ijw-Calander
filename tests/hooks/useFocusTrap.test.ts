import { renderHook } from '@testing-library/react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

describe('useFocusTrap Hook', () => {
  let onCloseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCloseMock = vi.fn();
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('기본 동작', () => {
    it('modalRef 객체를 반환한다', () => {
      // Given: useFocusTrap 훅이 호출되면
      const { result } = renderHook(() => useFocusTrap(false, onCloseMock));

      // Then: ref 객체가 반환된다
      expect(result.current).toBeDefined();
      expect(result.current.current).toBeNull(); // ref는 초기에 null
    });

    it('isOpen이 false일 때는 아무 동작도 하지 않는다', () => {
      // Given: isOpen이 false인 상태로 훅이 렌더링되고
      renderHook(() => useFocusTrap(false, onCloseMock));

      // When: ESC 키를 누르면
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escEvent);

      // Then: onClose가 호출되지 않는다
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('isOpen이 true일 때는 이벤트 리스너를 등록한다', () => {
      // Given: document.addEventListener 스파이를 설정하고
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      // When: isOpen이 true인 상태로 훅이 렌더링되면
      renderHook(() => useFocusTrap(true, onCloseMock));

      // Then: keydown 이벤트 리스너가 등록된다
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });
  });

  describe('ESC 키 처리', () => {
    it('ESC 키를 누르면 onClose가 호출된다', () => {
      // Given: 모달이 열린 상태이고
      renderHook(() => useFocusTrap(true, onCloseMock));

      // When: ESC 키를 누르면
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escEvent);

      // Then: onClose가 호출된다
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('ESC 키가 아닌 다른 키를 누르면 onClose가 호출되지 않는다', () => {
      // Given: 모달이 열린 상태이고
      renderHook(() => useFocusTrap(true, onCloseMock));

      // When: Enter 키를 누르면
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      document.dispatchEvent(enterEvent);

      // Then: onClose가 호출되지 않는다
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('isOpen이 false로 변경되면 ESC 키가 동작하지 않는다', () => {
      // Given: 모달이 열린 상태에서
      const { rerender } = renderHook(
        ({ isOpen }) => useFocusTrap(isOpen, onCloseMock),
        { initialProps: { isOpen: true } }
      );

      // When: 모달을 닫고
      rerender({ isOpen: false });

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

  describe('Tab 키 포커스 트랩', () => {
    it('Tab 키를 누르면 포커스가 모달 내에서 순환한다 - 마지막 요소에서 첫 요소로', () => {
      // Given: 3개의 버튼이 있는 모달이 열린 상태
      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      button1.textContent = 'Button 1';
      const button2 = document.createElement('button');
      button2.textContent = 'Button 2';
      const button3 = document.createElement('button');
      button3.textContent = 'Button 3';

      modal.appendChild(button1);
      modal.appendChild(button2);
      modal.appendChild(button3);
      document.body.appendChild(modal);

      const { result } = renderHook(() => useFocusTrap(true, onCloseMock));

      // modalRef에 modal 요소 할당
      if (result.current.current !== modal) {
        Object.defineProperty(result.current, 'current', {
          writable: true,
          value: modal,
        });
      }

      // 마지막 버튼에 포커스
      button3.focus();
      expect(document.activeElement).toBe(button3);

      // When: Tab 키를 누르면
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      });
      Object.defineProperty(tabEvent, 'preventDefault', {
        value: vi.fn(),
      });
      document.dispatchEvent(tabEvent);

      // Then: preventDefault가 호출되고 첫 번째 요소로 포커스가 이동한다
      expect(tabEvent.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(button1);
    });

    it('Shift+Tab 키를 누르면 포커스가 역순으로 순환한다 - 첫 요소에서 마지막 요소로', () => {
      // Given: 3개의 버튼이 있는 모달이 열린 상태
      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      button1.textContent = 'Button 1';
      const button2 = document.createElement('button');
      button2.textContent = 'Button 2';
      const button3 = document.createElement('button');
      button3.textContent = 'Button 3';

      modal.appendChild(button1);
      modal.appendChild(button2);
      modal.appendChild(button3);
      document.body.appendChild(modal);

      const { result } = renderHook(() => useFocusTrap(true, onCloseMock));

      // modalRef에 modal 요소 할당
      if (result.current.current !== modal) {
        Object.defineProperty(result.current, 'current', {
          writable: true,
          value: modal,
        });
      }

      // 첫 번째 버튼에 포커스
      button1.focus();
      expect(document.activeElement).toBe(button1);

      // When: Shift+Tab 키를 누르면
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      });
      Object.defineProperty(shiftTabEvent, 'preventDefault', {
        value: vi.fn(),
      });
      document.dispatchEvent(shiftTabEvent);

      // Then: preventDefault가 호출되고 마지막 요소로 포커스가 이동한다
      expect(shiftTabEvent.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(button3);
    });

    it('중간 요소에서 Tab을 누르면 자연스럽게 다음 요소로 이동한다', () => {
      // Given: 3개의 버튼이 있는 모달이 열린 상태
      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      const button3 = document.createElement('button');

      modal.appendChild(button1);
      modal.appendChild(button2);
      modal.appendChild(button3);
      document.body.appendChild(modal);

      const { result } = renderHook(() => useFocusTrap(true, onCloseMock));

      if (result.current.current !== modal) {
        Object.defineProperty(result.current, 'current', {
          writable: true,
          value: modal,
        });
      }

      // 두 번째 버튼에 포커스
      button2.focus();

      // When: Tab 키를 누르면
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      });
      Object.defineProperty(tabEvent, 'preventDefault', {
        value: vi.fn(),
      });
      document.dispatchEvent(tabEvent);

      // Then: preventDefault가 호출되지 않는다 (자연스러운 포커스 이동)
      expect(tabEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('disabled된 요소는 포커스 가능한 요소에서 제외된다', () => {
      // Given: disabled 버튼이 포함된 모달
      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      button2.disabled = true; // disabled
      const button3 = document.createElement('button');

      modal.appendChild(button1);
      modal.appendChild(button2);
      modal.appendChild(button3);
      document.body.appendChild(modal);

      const { result } = renderHook(() => useFocusTrap(true, onCloseMock));

      if (result.current.current !== modal) {
        Object.defineProperty(result.current, 'current', {
          writable: true,
          value: modal,
        });
      }

      // 마지막 활성 버튼에 포커스
      button3.focus();

      // When: Tab 키를 누르면
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      });
      Object.defineProperty(tabEvent, 'preventDefault', {
        value: vi.fn(),
      });
      document.dispatchEvent(tabEvent);

      // Then: disabled 버튼을 건너뛰고 첫 번째 버튼으로 이동
      expect(document.activeElement).toBe(button1);
    });

    it('포커스 가능한 요소가 없으면 아무 동작도 하지 않는다', () => {
      // Given: 포커스 가능한 요소가 없는 모달
      const modal = document.createElement('div');
      const text = document.createElement('p');
      text.textContent = 'No focusable elements';
      modal.appendChild(text);
      document.body.appendChild(modal);

      const { result } = renderHook(() => useFocusTrap(true, onCloseMock));

      if (result.current.current !== modal) {
        Object.defineProperty(result.current, 'current', {
          writable: true,
          value: modal,
        });
      }

      // When: Tab 키를 누르면
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      });
      Object.defineProperty(tabEvent, 'preventDefault', {
        value: vi.fn(),
      });
      document.dispatchEvent(tabEvent);

      // Then: 아무 동작도 하지 않는다
      expect(tabEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('포커스 관리', () => {
    it('모달이 열릴 때 이전에 포커스된 요소를 저장한다', () => {
      // Given: 버튼에 포커스가 있는 상태
      const outsideButton = document.createElement('button');
      outsideButton.textContent = 'Outside Button';
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      expect(document.activeElement).toBe(outsideButton);

      // When: 모달이 열리면
      renderHook(() => useFocusTrap(true, onCloseMock));

      // Then: 이전 포커스 요소가 저장된다 (document.activeElement가 저장됨)
      // 실제 포커스 복원은 cleanup 시 확인
      expect(document.activeElement).toBe(outsideButton);
    });

    it('모달이 열릴 때 첫 번째 포커스 가능한 요소의 focus()를 호출한다', () => {
      // Given: 버튼이 있는 모달
      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      button1.textContent = 'First Button';
      const button2 = document.createElement('button');
      button2.textContent = 'Second Button';

      modal.appendChild(button1);
      modal.appendChild(button2);
      document.body.appendChild(modal);

      const focusSpy = vi.spyOn(button1, 'focus');

      // Render with isOpen=false first so the ref can be set before effect runs
      const { result, rerender } = renderHook(
        ({ isOpen }) => useFocusTrap(isOpen, onCloseMock),
        { initialProps: { isOpen: false } }
      );

      // Set the ref to our modal element
      Object.defineProperty(result.current, 'current', {
        writable: true,
        value: modal,
      });

      // When: isOpen을 true로 변경하면 (이제 ref가 설정된 상태에서 effect가 실행됨)
      rerender({ isOpen: true });
      vi.advanceTimersByTime(100);

      // Then: 첫 번째 버튼의 focus()가 호출된다
      expect(focusSpy).toHaveBeenCalled();
    });

    it('다양한 포커스 가능한 요소 타입을 지원한다', () => {
      // Given: 다양한 포커스 가능한 요소가 있는 모달
      const modal = document.createElement('div');

      const link = document.createElement('a');
      link.href = '#';
      link.textContent = 'Link';

      const input = document.createElement('input');
      input.type = 'text';

      const select = document.createElement('select');
      const option = document.createElement('option');
      select.appendChild(option);

      const textarea = document.createElement('textarea');

      const button = document.createElement('button');
      button.textContent = 'Button';

      modal.appendChild(link);
      modal.appendChild(input);
      modal.appendChild(select);
      modal.appendChild(textarea);
      modal.appendChild(button);
      document.body.appendChild(modal);

      const focusSpy = vi.spyOn(link, 'focus');

      // Render with isOpen=false first so the ref can be set before effect runs
      const { result, rerender } = renderHook(
        ({ isOpen }) => useFocusTrap(isOpen, onCloseMock),
        { initialProps: { isOpen: false } }
      );

      // Set the ref to our modal element
      Object.defineProperty(result.current, 'current', {
        writable: true,
        value: modal,
      });

      // When: isOpen을 true로 변경하면
      rerender({ isOpen: true });
      vi.advanceTimersByTime(100);

      // Then: 첫 번째 요소(link)의 focus()가 호출된다
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('Cleanup 및 이벤트 리스너 제거', () => {
    it('컴포넌트가 언마운트되면 이벤트 리스너를 제거한다', () => {
      // Given: document.removeEventListener 스파이를 설정하고
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      // When: 모달이 열렸다가 언마운트되면
      const { unmount } = renderHook(() => useFocusTrap(true, onCloseMock));
      unmount();

      // Then: keydown 이벤트 리스너가 제거된다
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it('언마운트 후 ESC 키를 눌러도 onClose가 호출되지 않는다', () => {
      // Given: 모달이 열린 상태에서
      const { unmount } = renderHook(() => useFocusTrap(true, onCloseMock));

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

    it('isOpen이 false로 변경되면 이벤트 리스너를 제거한다', () => {
      // Given: 모달이 열린 상태에서
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { rerender } = renderHook(
        ({ isOpen }) => useFocusTrap(isOpen, onCloseMock),
        { initialProps: { isOpen: true } }
      );

      // When: isOpen을 false로 변경하면
      rerender({ isOpen: false });

      // Then: 이벤트 리스너가 제거된다
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it('모달이 닫힐 때 이전에 포커스된 요소로 포커스를 복원한다', () => {
      // Given: 버튼에 포커스가 있는 상태에서
      const outsideButton = document.createElement('button');
      outsideButton.textContent = 'Outside Button';
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      const previousElement = document.activeElement;

      // 모달을 열고
      const modal = document.createElement('div');
      const modalButton = document.createElement('button');
      modal.appendChild(modalButton);
      document.body.appendChild(modal);

      const { result, unmount } = renderHook(() =>
        useFocusTrap(true, onCloseMock)
      );

      if (result.current.current !== modal) {
        Object.defineProperty(result.current, 'current', {
          writable: true,
          value: modal,
        });
      }

      vi.advanceTimersByTime(100);
      modalButton.focus();

      // When: 모달을 닫으면
      unmount();
      vi.advanceTimersByTime(0); // setTimeout(0) 실행

      // Then: 이전 요소로 포커스가 복원된다
      expect(document.activeElement).toBe(previousElement);
    });

    it('포커스 타이머가 cleanup에서 제거된다', () => {
      // Given: 모달이 열린 상태에서
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = renderHook(() => useFocusTrap(true, onCloseMock));

      // When: 타이머가 실행되기 전에 언마운트하면
      unmount();

      // Then: clearTimeout이 호출된다
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });

  describe('onClose 콜백 변경', () => {
    it('onClose 콜백이 변경되면 새로운 콜백이 사용된다', () => {
      // Given: 첫 번째 onClose 콜백으로 렌더링
      const firstOnClose = vi.fn();
      const { rerender } = renderHook(
        ({ onClose }) => useFocusTrap(true, onClose),
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

      // Then: 새로운 콜백이 호출된다
      expect(firstOnClose).not.toHaveBeenCalled();
      expect(secondOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('modalRef.current가 null일 때 Tab 키를 눌러도 에러가 발생하지 않는다', () => {
      // Given: modalRef가 할당되지 않은 상태
      renderHook(() => useFocusTrap(true, onCloseMock));

      // When: Tab 키를 누르면
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      });

      // Then: 에러가 발생하지 않는다
      expect(() => document.dispatchEvent(tabEvent)).not.toThrow();
    });

    it('tabindex="-1"인 요소는 포커스 가능한 요소에서 제외된다', () => {
      // Given: tabindex="-1"인 요소가 포함된 모달
      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      button1.textContent = 'Button 1';

      const divWithNegativeTabIndex = document.createElement('div');
      divWithNegativeTabIndex.setAttribute('tabindex', '-1');
      divWithNegativeTabIndex.textContent = 'Not focusable';

      const button2 = document.createElement('button');
      button2.textContent = 'Button 2';

      modal.appendChild(button1);
      modal.appendChild(divWithNegativeTabIndex);
      modal.appendChild(button2);
      document.body.appendChild(modal);

      const { result } = renderHook(() => useFocusTrap(true, onCloseMock));

      if (result.current.current !== modal) {
        Object.defineProperty(result.current, 'current', {
          writable: true,
          value: modal,
        });
      }

      // 마지막 버튼에 포커스
      button2.focus();

      // When: Tab 키를 누르면
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      });
      Object.defineProperty(tabEvent, 'preventDefault', {
        value: vi.fn(),
      });
      document.dispatchEvent(tabEvent);

      // Then: tabindex="-1" 요소를 건너뛰고 첫 번째 버튼으로 이동
      expect(document.activeElement).toBe(button1);
    });

    it('빈 모달(포커스 가능한 요소 없음)에서 포커스 이동을 시도해도 에러가 발생하지 않는다', () => {
      // Given: 빈 모달
      const modal = document.createElement('div');
      document.body.appendChild(modal);

      const { result } = renderHook(() => useFocusTrap(true, onCloseMock));

      if (result.current.current !== modal) {
        Object.defineProperty(result.current, 'current', {
          writable: true,
          value: modal,
        });
      }

      // When: 타이머를 진행시켜도
      // Then: 에러가 발생하지 않는다
      expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    });

    it('여러 번 ESC 키를 눌러도 정상 동작한다', () => {
      // Given: 모달이 열린 상태
      renderHook(() => useFocusTrap(true, onCloseMock));

      // When: ESC 키를 여러 번 누르면
      const escEvent1 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      const escEvent2 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      const escEvent3 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });

      document.dispatchEvent(escEvent1);
      document.dispatchEvent(escEvent2);
      document.dispatchEvent(escEvent3);

      // Then: onClose가 각각 호출된다
      expect(onCloseMock).toHaveBeenCalledTimes(3);
    });
  });
});
