import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  footer?: React.ReactNode;
  className?: string;
  /** 컴팩트 모드 - StudentDetailModal 스타일 (작은 패딩, 작은 폰트) */
  compact?: boolean;
  /** 고정 높이 - 모달 높이 고정 (예: h-[600px]) */
  fixedHeight?: string;
}

/**
 * 통일된 모달 디자인 시스템
 *
 * 기준: StudentDetailModal (컴팩트 모드)
 * - Overlay: bg-black/50 z-[100]
 * - Modal: bg-white rounded-sm shadow-xl (미세 라운드 2px)
 * - Header: px-3 py-2, text-sm font-bold text-[#081429]
 * - Close: p-1 rounded-sm, X size={18}
 * - Colors: Primary=#fdb813, Dark=#081429
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  footer,
  className = '',
  compact = false,
  fixedHeight,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 모달 크기 클래스 (StudentDetailModal 기준: max-w-lg)
  const sizeClasses = {
    sm: 'max-w-sm',      // 384px
    md: 'max-w-lg',      // 512px (기준)
    lg: 'max-w-2xl',     // 672px
    xl: 'max-w-4xl',     // 896px
    full: 'max-w-full mx-4',
  };

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTab);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose, closeOnEscape]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // 컴팩트 모드 스타일 (StudentDetailModal 기준)
  const headerPadding = compact ? 'px-3 py-2' : 'px-4 py-3';
  const titleSize = compact ? 'text-sm' : 'text-base';
  const contentPadding = compact ? 'p-3' : 'px-4 py-3';
  const footerPadding = compact ? 'px-3 py-2' : 'px-4 py-3';
  const closeIconSize = compact ? 18 : 20;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] p-2 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Overlay - StudentDetailModal 기준: bg-black/50 */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={() => closeOnBackdropClick && onClose()}
        aria-hidden="true"
      />

      {/* Modal Container - 미세 라운드 (rounded-sm = 2px) */}
      <div
        ref={modalRef}
        className={`
          relative bg-white rounded-sm shadow-xl w-full ${sizeClasses[size]}
          ${fixedHeight || 'max-h-[85vh]'} overflow-hidden flex flex-col
          ${className}
        `}
        tabIndex={-1}
      >
        {/* Header - StudentDetailModal 기준: px-3 py-2, text-sm font-bold text-[#081429] */}
        {(title || showCloseButton) && (
          <div className={`flex items-center justify-between ${headerPadding} border-b border-gray-200`}>
            {title && (
              <h2 id="modal-title" className={`${titleSize} font-bold text-[#081429]`}>
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-auto p-1 rounded-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#fdb813] focus:ring-offset-2"
                aria-label="닫기"
              >
                <X size={closeIconSize} />
              </button>
            )}
          </div>
        )}

        {/* Content - StudentDetailModal 기준: p-3, overflow-y-auto */}
        <div className={`flex-1 overflow-y-auto ${contentPadding}`}>
          {children}
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div className={`flex items-center justify-end gap-2 ${footerPadding} border-t border-gray-200 bg-gray-50`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
