import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalTooltipProps {
    children: React.ReactNode; // The content of the trigger (e.g. badge text)
    content: React.ReactNode; // The tooltip content
    position?: 'top' | 'bottom';
    offset?: number;
    triggerClassName?: string; // Classes for the trigger wrapper
    interactive?: boolean; // Allow clicking on tooltip content
}

const PortalTooltip: React.FC<PortalTooltipProps> = ({
    children,
    content,
    position = 'bottom',
    offset = 8,
    triggerClassName = '',
    interactive = false
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const clearHideTimeout = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
    };

    const scheduleHide = () => {
        if (interactive) {
            // Give time to move to tooltip (increased to 300ms)
            hideTimeoutRef.current = setTimeout(() => {
                setIsVisible(false);
            }, 300);
        } else {
            setIsVisible(false);
        }
    };

    const updatePosition = () => {
        if (!triggerRef.current || !isVisible) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        let top = 0;
        let left = 0;

        const centerX = triggerRect.left + triggerRect.width / 2;
        // For interactive mode, reduce offset to minimize gap
        const effectiveOffset = interactive ? 2 : offset;

        switch (position) {
            case 'top':
                top = triggerRect.top - effectiveOffset;
                left = centerX;
                break;
            case 'bottom':
                top = triggerRect.bottom + effectiveOffset;
                left = centerX;
                break;
            default:
                top = triggerRect.bottom + effectiveOffset;
                left = centerX;
        }

        setCoords({ top, left });
    };

    useEffect(() => {
        if (isVisible) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
            // Also update on scroll of any parent if possible (not easy efficiently),
            // but global scroll capture with 'true' (capture) on window usually helps.
        };
    }, [isVisible]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, []);

    return (
        <>
            <div
                ref={triggerRef}
                className={triggerClassName} // Applied here (e.g. absolute positioning)
                onMouseEnter={() => {
                    clearHideTimeout();
                    updatePosition();
                    setIsVisible(true);
                }}
                onMouseLeave={scheduleHide}
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        zIndex: 9999,
                        pointerEvents: interactive ? 'auto' : 'none',
                        // Add padding to create a "bridge" hover zone for interactive tooltips
                        ...(interactive && position === 'bottom' ? { paddingTop: 8 } : {}),
                        ...(interactive && position === 'top' ? { paddingBottom: 8 } : {})
                    }}
                    className={`transform -translate-x-1/2 ${position === 'top' ? '-translate-y-full' : ''}`}
                    onMouseEnter={interactive ? clearHideTimeout : undefined}
                    onMouseLeave={interactive ? () => setIsVisible(false) : undefined}
                >
                    <div>
                        {content}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default PortalTooltip;
