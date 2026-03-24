import React from 'react';
import { ScheduleCell } from './EnglishTeacherTab';
import { MergedClass } from './BatchInputBar';
import { useDraggable } from '../../../hooks/useDraggable';

interface MoveSelectionModalProps {
    pendingMove: { source: any, target: any, sourceData: ScheduleCell } | null;
    setPendingMove: (move: any) => void;
    performMove: (source: any, target: any, moveIndices: number[]) => void;
}

const MoveSelectionModal: React.FC<MoveSelectionModalProps> = ({
    pendingMove,
    setPendingMove,
    performMove,
}) => {
  const { handleMouseDown: handleDragMouseDown, dragStyle } = useDraggable();
    if (!pendingMove) return null;

    const { source, target, sourceData } = pendingMove;

    return (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-start justify-center pt-[8vh] p-4 animate-in fade-in duration-200" onClick={() => setPendingMove(null)}>
            <div style={dragStyle} className="bg-white rounded-sm shadow-2xl w-[350px] max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-primary text-white p-3 font-bold text-sm flex justify-between items-center">
                    <span>🚚 이동할 수업 선택</span>
                    <button
                        onClick={() => setPendingMove(null)}
                        className="text-white hover:text-gray-200"
                    >
                        &times;
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-3 text-center">
                        이동하려는 수업을 선택해주세요.
                    </p>

                    <div className="space-y-2">
                        {/* Main Class Button */}
                        <button
                            onClick={() => performMove(source, target, [-1])}
                            className="w-full bg-white border border-gray-200 p-3 rounded-sm shadow-sm hover:border-primary hover:bg-gray-50 flex justify-between items-center group transition-all"
                        >
                            <div className="flex flex-col items-start">
                                <span className="text-xxs text-gray-400 font-bold mb-0.5">
                                    메인 수업
                                </span>
                                <span className="font-bold text-gray-700 text-sm">
                                    {sourceData.className || '(비어있음)'}
                                </span>
                            </div>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded-sm text-gray-500 group-hover:bg-gray-200 group-hover:text-primary font-bold">
                                이동
                            </span>
                        </button>

                        {/* Merged Classes Buttons */}
                        {sourceData.merged && sourceData.merged.map((m: MergedClass, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => performMove(source, target, [idx])}
                                className="w-full bg-white border border-yellow-200 p-3 rounded-sm shadow-sm hover:border-yellow-500 hover:bg-yellow-50 flex justify-between items-center group transition-all"
                            >
                                <div className="flex flex-col items-start">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xxs font-bold text-yellow-600 bg-yellow-100 px-1.5 rounded-sm">
                                            합반 #{idx + 1}
                                        </span>
                                    </div>
                                    <span className="font-bold text-gray-700 text-sm">
                                        {m.className}
                                    </span>
                                </div>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded-sm text-gray-500 group-hover:bg-yellow-200 group-hover:text-yellow-800 font-bold">
                                    이동
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                        <button
                            onClick={() => setPendingMove(null)}
                            className="px-3 py-1.5 rounded-sm border bg-white text-gray-500 text-xs font-bold hover:bg-gray-100 transition-colors"
                        >
                            취소
                        </button>

                        <button
                            onClick={() => {
                                const allIndices = [-1, ...(sourceData.merged?.map((_, i) => i) ?? [])];
                                performMove(source, target, allIndices);
                            }}
                            className="px-4 py-1.5 rounded-sm bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-md transition-colors"
                        >
                            모두 이동
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MoveSelectionModal;
