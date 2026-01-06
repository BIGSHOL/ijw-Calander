import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalTooltipProps {
    children: React.ReactNode; // The content of the trigger (e.g. badge text)
    content: React.ReactNode; // The tooltip content
    position?: 'top' | 'bottom';
    offset?: number;
    triggerClassName?: string; // Classes for the trigger wrapper
}

const PortalTooltip: React.FC<PortalTooltipProps> = ({
    children,
    content,
    position = 'bottom',
    offset = 8,
    triggerClassName = ''
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const updatePosition = () => {
        if (!triggerRef.current || !isVisible) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        let top = 0;
        let left = 0;

        const centerX = triggerRect.left + triggerRect.width / 2;

        switch (position) {
            case 'top':
                top = triggerRect.top - offset;
                left = centerX;
                break;
            case 'bottom':
                top = triggerRect.bottom + offset;
                left = centerX;
                break;
            default:
                top = triggerRect.bottom + offset;
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

    return (
        <>
            <div
                ref={triggerRef}
                className={triggerClassName} // Applied here (e.g. absolute positioning)
                onMouseEnter={() => {
                    updatePosition();
                    setIsVisible(true);
                }}
                onMouseLeave={() => setIsVisible(false)}
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
                        pointerEvents: 'none'
                    }}
                    className={`transform -translate-x-1/2 ${position === 'top' ? '-translate-y-full' : ''}`}
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
