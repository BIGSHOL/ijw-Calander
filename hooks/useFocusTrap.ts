import { useEffect, useRef } from 'react';

/**
 * Custom hook for implementing focus trap in modals
 * @description
 * Manages focus behavior for accessible modal dialogs:
 * - Moves focus to modal when opened
 * - Traps focus within modal (Tab cycling)
 * - Restores previous focus when closed
 * - Handles ESC key to close modal
 *
 * @param isOpen - Whether the modal is currently open
 * @param onClose - Callback to close the modal
 * @returns Ref to attach to the modal container element
 *
 * @example
 * ```tsx
 * const MyModal = ({ isOpen, onClose }) => {
 *   const modalRef = useFocusTrap(isOpen, onClose);
 *
 *   return (
 *     <div ref={modalRef} role="dialog" aria-modal="true">
 *       <h2 id="modal-title">Modal Title</h2>
 *       <button onClick={onClose}>Close</button>
 *     </div>
 *   );
 * };
 * ```
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */
export const useFocusTrap = (isOpen: boolean, onClose: () => void) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Save currently focused element (to restore later)
    previousActiveElement.current = document.activeElement as HTMLElement;

    // 2. Move focus to first focusable element in modal
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // Use setTimeout to ensure modal is rendered before focusing
    const focusTimer = setTimeout(() => {
      firstFocusable?.focus();
    }, 100);

    // 3. Handle keyboard events (ESC and Tab)
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC key closes modal
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Tab key implements focus trap
      if (e.key === 'Tab') {
        if (!modalRef.current) return;

        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift+Tab on first element -> focus last element
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
        // Tab on last element -> focus first element
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // 4. Cleanup: restore focus and remove listeners
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to element that was focused before modal opened
      // Use setTimeout to ensure modal is fully closed before restoring focus
      setTimeout(() => {
        previousActiveElement.current?.focus();
      }, 0);
    };
  }, [isOpen, onClose]);

  return modalRef;
};
