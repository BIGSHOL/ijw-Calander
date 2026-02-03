import React from 'react';

interface MoveConfirmBarProps {
    hasChanges: boolean;
    cancelMoveChanges: () => void;
    saveMoveChanges: () => void;
}

const MoveConfirmBar: React.FC<MoveConfirmBarProps> = ({ hasChanges, cancelMoveChanges, saveMoveChanges }) => {
    if (!hasChanges) return null;

    return (
        <div className="absolute top-0 left-0 right-0 h-8 bg-green-100 border-b border-green-400 px-6 z-[50] flex items-center justify-between shadow-md">
            {/* Message */}
            <span className="text-green-700 font-medium text-xs flex items-center gap-2">
                <span className="text-green-600">&#10003;</span> 스케줄이 이동되었습니다 (자동 저장됨)
            </span>

            {/* Buttons */}
            <div className="flex gap-2">
                <button
                    onClick={cancelMoveChanges}
                    className="px-3 py-0.5 rounded-sm bg-white border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                    되돌리기
                </button>

                <button
                    onClick={saveMoveChanges}
                    className="px-4 py-0.5 rounded-sm bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                >
                    확인
                </button>
            </div>
        </div>
    );
};

export default MoveConfirmBar;
