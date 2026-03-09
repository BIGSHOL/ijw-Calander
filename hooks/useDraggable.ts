import { useCallback, useRef, useState } from 'react';

/**
 * 모달 드래그 이동 훅
 * 모달 헤더를 잡고 드래그하여 위치를 이동할 수 있게 합니다.
 *
 * @returns {object}
 * - dragOffset: 현재 이동 오프셋 { x, y }
 * - handleMouseDown: 드래그 시작 핸들러 (헤더에 바인딩)
 * - dragStyle: 모달 컨테이너에 적용할 style 객체
 * - isDragging: 드래그 중 여부
 */
export function useDraggable() {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const startMouse = useRef({ x: 0, y: 0 });
    const startOffset = useRef({ x: 0, y: 0 });

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragging.current) return;
        const dx = e.clientX - startMouse.current.x;
        const dy = e.clientY - startMouse.current.y;
        setOffset({
            x: startOffset.current.x + dx,
            y: startOffset.current.y + dy,
        });
    }, []);

    const handleMouseUp = useCallback(() => {
        dragging.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // 버튼이나 입력요소 위에서는 드래그 시작하지 않음
        const target = e.target as HTMLElement;
        if (target.closest('button, input, select, textarea, a, [role="button"]')) return;

        e.preventDefault();
        dragging.current = true;
        startMouse.current = { x: e.clientX, y: e.clientY };
        startOffset.current = { x: offset.x, y: offset.y };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'move';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [offset, handleMouseMove, handleMouseUp]);

    const dragStyle: React.CSSProperties = offset.x !== 0 || offset.y !== 0
        ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
        : {};

    return {
        dragOffset: offset,
        handleMouseDown,
        dragStyle,
        isDragging: dragging.current,
    };
}
