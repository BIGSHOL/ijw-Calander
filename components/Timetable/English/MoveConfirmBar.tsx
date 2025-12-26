import React from 'react';

interface MoveConfirmBarProps {
    hasChanges: boolean;
    cancelMoveChanges: () => void;
    saveMoveChanges: () => void;
}

const MoveConfirmBar: React.FC<MoveConfirmBarProps> = ({ hasChanges, cancelMoveChanges, saveMoveChanges }) => {
    if (!hasChanges) return null;

    return (
        <div className="absolute top-[104px] left-0 right-0 h-12 bg-green-50 border-b border-green-500 px-6 z-[40] flex items-center justify-between animate-in slide-in-from-top duration-200">
            {/* Message */}
            <span className="text-green-800 font-bold text-sm flex items-center gap-2">
                ✨ 스케줄이 이동되었습니다. 저장하시겠습니까?
            </span>

            {/* Buttons */}
            <div className="flex gap-2">
                <button
                    onClick={cancelMoveChanges}
                    className="px-4 py-1 rounded bg-white border border-green-200 text-green-700 text-xs font-bold hover:bg-green-100 transition-colors"
                >
                    취소
                </button>

                <button
                    onClick={saveMoveChanges}
                    className="px-6 py-1 rounded bg-green-600 text-white text-xs font-bold hover:bg-green-700 shadow-md transition-colors"
                >
                    변경사항 저장
                </button>
            </div>
        </div>
    );
};

export default MoveConfirmBar;
