import { renderHook, act } from '@testing-library/react';
import { useDraggable } from '../../hooks/useDraggable';

// useDraggable은 Firebase를 사용하지 않으며 DOM 이벤트에만 의존한다

describe('useDraggable Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('초기 상태', () => {
    it('초기 dragOffset이 { x: 0, y: 0 }이다', () => {
      // When: 훅이 렌더링되면
      const { result } = renderHook(() => useDraggable());

      // Then: 초기 오프셋은 0이다
      expect(result.current.dragOffset).toEqual({ x: 0, y: 0 });
    });

    it('초기 isDragging이 false이다', () => {
      // When: 훅이 렌더링되면
      const { result } = renderHook(() => useDraggable());

      // Then: 드래그 중이 아니다
      expect(result.current.isDragging).toBe(false);
    });

    it('초기 dragStyle이 빈 객체이다', () => {
      // When: 훅이 렌더링되면
      const { result } = renderHook(() => useDraggable());

      // Then: 오프셋이 없으면 스타일도 없다
      expect(result.current.dragStyle).toEqual({});
    });

    it('필수 반환값(dragOffset, handleMouseDown, dragStyle, isDragging)을 모두 반환한다', () => {
      // When: 훅이 렌더링되면
      const { result } = renderHook(() => useDraggable());

      // Then: 모든 반환값이 존재한다
      expect(result.current.dragOffset).toBeDefined();
      expect(result.current.handleMouseDown).toBeInstanceOf(Function);
      expect(result.current.dragStyle).toBeDefined();
      expect(result.current.isDragging).toBeDefined();
    });
  });

  describe('드래그 이동', () => {
    it('handleMouseDown 후 mousemove 이벤트로 dragOffset이 업데이트된다', () => {
      // Given: 훅이 렌더링된 상태에서
      const { result } = renderHook(() => useDraggable());

      // When: 드래그를 시작하고 마우스를 이동하면
      act(() => {
        result.current.handleMouseDown({
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
          target: document.createElement('div'),
        } as any);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 130 }));
      });

      // Then: 오프셋이 이동량만큼 변경된다
      expect(result.current.dragOffset).toEqual({ x: 50, y: 30 });
    });

    it('드래그 시작 시 오프셋이 0이 아니면 dragStyle에 transform이 설정된다', () => {
      // Given: 드래그로 오프셋이 변경된 상태에서
      const { result } = renderHook(() => useDraggable());

      act(() => {
        result.current.handleMouseDown({
          clientX: 0,
          clientY: 0,
          preventDefault: vi.fn(),
          target: document.createElement('div'),
        } as any);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 20 }));
      });

      // Then: dragStyle에 transform이 적용된다
      expect(result.current.dragStyle).toHaveProperty('transform');
      expect(result.current.dragStyle.transform).toContain('50px');
      expect(result.current.dragStyle.transform).toContain('20px');
    });

    it('mouseup 이벤트 후 mousemove를 해도 오프셋이 변경되지 않는다', () => {
      // Given: 드래그 후 마우스를 뗀 상태에서
      const { result } = renderHook(() => useDraggable());

      act(() => {
        result.current.handleMouseDown({
          clientX: 0,
          clientY: 0,
          preventDefault: vi.fn(),
          target: document.createElement('div'),
        } as any);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      const offsetAfterUp = { ...result.current.dragOffset };

      // When: 마우스를 더 이동해도
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));
      });

      // Then: 오프셋은 변하지 않는다
      expect(result.current.dragOffset).toEqual(offsetAfterUp);
    });
  });

  describe('버튼 위 드래그 방지', () => {
    it('버튼 요소 위에서 mousedown 시 드래그가 시작되지 않는다', () => {
      // Given: 훅이 렌더링된 상태에서
      const { result } = renderHook(() => useDraggable());
      const button = document.createElement('button');

      // When: 버튼 위에서 mousedown 이벤트가 발생하면
      act(() => {
        result.current.handleMouseDown({
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
          target: button,
        } as any);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));
      });

      // Then: 오프셋이 변경되지 않는다
      expect(result.current.dragOffset).toEqual({ x: 0, y: 0 });
    });
  });
});
