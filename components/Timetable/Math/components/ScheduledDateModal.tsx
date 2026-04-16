import React, { useState, useRef, useCallback } from 'react';
import { formatDateKey, getTodayKST, getFirstClassDayOfWeek } from '../../../../utils/dateUtils';
import { addDays, format } from 'date-fns';
import { useEscapeClose } from '../../../../hooks/useEscapeClose';
import { useDraggable } from '../../../../hooks/useDraggable';

interface ScheduledDateModalProps {
    studentName: string;
    fromClassName: string;
    toClassName: string;
    onConfirm: (scheduledDate?: string) => void;
    onClose: () => void;
    // 미래 주차 자동 날짜 설정용
    weekStart?: Date;
    targetClassSchedule?: string[];
    // 일반화 props (퇴원/스케줄변경 등 다양한 모드 지원)
    title?: string;
    description?: React.ReactNode;
    customImmediateLabel?: string;
    actionVerb?: string; // 기본 '이동', '삽입' 등으로 변경 가능
    scheduledLabel?: string; // '예정일 지정' 대신 사용할 라벨
    allowPastDate?: boolean; // true면 과거 날짜도 선택 가능
}

const ScheduledDateModal: React.FC<ScheduledDateModalProps> = ({
    studentName,
    fromClassName,
    toClassName,
    onConfirm,
    onClose,
    weekStart,
    targetClassSchedule,
    title,
    description,
    customImmediateLabel,
    actionVerb,
    scheduledLabel,
    allowPastDate,
}) => {
    const [mode, setMode] = useState<'immediate' | 'scheduled'>('immediate');
    const [selectedDate, setSelectedDate] = useState('');
  const { handleMouseDown: handleDragMouseDown, dragStyle } = useDraggable();

    // Dragging state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    useEscapeClose(onClose);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return; // Don't drag when clicking close button
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
    }, [position]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;
        setPosition({ x: newX, y: newY });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const todayStr = getTodayKST();
    const tomorrow = formatDateKey(addDays(new Date(), 1));

    // 미래 주차 판별 및 첫 수업일 계산
    const isFutureWeek = weekStart ? formatDateKey(weekStart) > todayStr : false;
    const futureFirstClassDay = (isFutureWeek && weekStart && targetClassSchedule?.length)
        ? getFirstClassDayOfWeek(weekStart, targetClassSchedule)
        : null;

    // "즉시이동" 시 사용할 날짜
    const immediateDate = futureFirstClassDay || undefined;

    // "즉시이동/삽입" 라벨
    const verb = actionVerb || '이동';
    const defaultImmediateLabel = futureFirstClassDay
        ? `즉시 ${verb} (${format(new Date(futureFirstClassDay), 'M/d')})`
        : `즉시 ${verb} (오늘)`;
    const immediateLabel = customImmediateLabel || defaultImmediateLabel;

    const handleConfirm = () => {
        if (mode === 'scheduled' && selectedDate) {
            onConfirm(selectedDate);
        } else {
            onConfirm(immediateDate);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 z-[110] flex items-start justify-center pt-[8vh] p-4"
            style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
        >
            <div
                ref={modalRef}
                className="bg-white rounded-sm shadow-2xl w-[320px] flex flex-col overflow-hidden"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    cursor: isDragging ? 'grabbing' : 'default',
                    pointerEvents: 'auto',
                }}
            >
                {/* Header */}
                <div
                    className="bg-primary text-white p-3 font-bold text-sm flex justify-between items-center"
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    onMouseDown={handleMouseDown}
                >
                    <span>{title || '반 이동 날짜 설정'}</span>
                    <button onClick={onClose} className="text-white hover:text-gray-200">&times;</button>
                </div>

                {/* Content */}
                <div className="p-4 bg-gray-50">
                    {description ? (
                        <div className="text-xs text-gray-600 mb-3 text-center">{description}</div>
                    ) : (
                        <p className="text-xs text-gray-600 mb-3 text-center">
                            <span className="font-bold text-gray-800">{studentName}</span>
                            <br />
                            <span className="text-gray-400">{fromClassName}</span>
                            <span className="mx-1">&rarr;</span>
                            <span className="font-bold text-primary">{toClassName}</span>
                        </p>
                    )}

                    <div className="space-y-2">
                        {/* 즉시 이동 */}
                        <label
                            className={`flex items-center gap-2 p-2.5 rounded-sm border cursor-pointer transition-all ${
                                mode === 'immediate'
                                    ? 'border-primary bg-white shadow-sm'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                        >
                            <input
                                type="radio"
                                name="moveMode"
                                checked={mode === 'immediate'}
                                onChange={() => setMode('immediate')}
                                className="accent-primary"
                            />
                            <span className="text-sm font-bold text-gray-700">{immediateLabel}</span>
                        </label>

                        {/* 예정일 지정 */}
                        <label
                            className={`flex flex-col gap-2 p-2.5 rounded-sm border cursor-pointer transition-all ${
                                mode === 'scheduled'
                                    ? 'border-blue-400 bg-white shadow-sm'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="moveMode"
                                    checked={mode === 'scheduled'}
                                    onChange={() => setMode('scheduled')}
                                    className="accent-blue-500"
                                />
                                <span className="text-sm font-bold text-gray-700">{scheduledLabel || '예정일 지정'}</span>
                            </div>
                            {mode === 'scheduled' && (
                                <input
                                    type="date"
                                    min={allowPastDate ? undefined : tomorrow}
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="ml-5 px-2 py-1 border border-gray-300 rounded-sm text-sm focus:border-blue-400 focus:outline-none"
                                    autoFocus
                                />
                            )}
                        </label>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-sm border bg-white text-gray-500 text-xs font-bold hover:bg-gray-100 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={mode === 'scheduled' && !selectedDate}
                            className="px-4 py-1.5 rounded-sm bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-md transition-colors disabled:opacity-50"
                        >
                            확인
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduledDateModal;
