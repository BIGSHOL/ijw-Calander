import React from 'react';
import {
    ChevronLeft, ChevronRight, Search, X, Settings, Eye, Edit
} from 'lucide-react';

interface TimetableHeaderProps {
    weekLabel: string;
    goToPrevWeek: () => void;
    goToNextWeek: () => void;
    goToThisWeek: () => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    viewType: 'teacher' | 'room' | 'class';
    setIsTeacherOrderModalOpen: (isOpen: boolean) => void;
    pendingMovesCount: number;
    handleSavePendingMoves: () => void;
    handleCancelPendingMoves: () => void;
    isSaving: boolean;
    // 조회/수정 모드
    mode: 'view' | 'edit';
    setMode: (mode: 'view' | 'edit') => void;
    canEdit: boolean;
}

const TimetableHeader: React.FC<TimetableHeaderProps> = ({
    weekLabel,
    goToPrevWeek,
    goToNextWeek,
    goToThisWeek,
    searchQuery,
    setSearchQuery,
    viewType,
    setIsTeacherOrderModalOpen,
    pendingMovesCount,
    handleSavePendingMoves,
    handleCancelPendingMoves,
    isSaving,
    mode,
    setMode,
    canEdit
}) => {
    return (
        <div className="bg-gray-50 h-10 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0 text-xs">
            {/* Left: Week Info */}
            <div className="flex items-center gap-3">
                <span className="text-gray-600 font-medium">{weekLabel}</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={goToPrevWeek}
                        className="p-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        onClick={goToThisWeek}
                        className="px-2 py-0.5 text-xxs font-bold border border-gray-300 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        이번주
                    </button>
                    <button
                        onClick={goToNextWeek}
                        className="p-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Right: Search and Actions */}
            <div className="flex items-center gap-2">
                {/* Mode Toggle - 조회/수정 모드 */}
                <div className="flex bg-gray-200 rounded-lg p-0.5">
                    <button
                        onClick={() => setMode('view')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${mode === 'view' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Eye size={12} />
                        조회
                    </button>
                    {canEdit && (
                        <button
                            onClick={() => setMode('edit')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${mode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <Edit size={12} />
                            수정
                        </button>
                    )}
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-gray-300 mx-1"></div>

                {/* Search */}
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="학생 검색..."
                        className="pl-7 pr-6 py-1 w-32 text-xs border border-gray-300 rounded-md bg-white text-gray-700 placeholder-gray-400 outline-none focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813]"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-gray-300 mx-1"></div>

                {/* Order Settings */}
                {viewType === 'teacher' && (
                    <button
                        onClick={() => setIsTeacherOrderModalOpen(true)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                        title="강사 순서 설정"
                    >
                        ↕️ 강사 순서
                    </button>
                )}

                {/* Pending Moves */}
                {pendingMovesCount > 0 && (
                    <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-md px-2 py-1">
                        <span className="text-xs font-bold text-orange-600">
                            {pendingMovesCount}건 변경
                        </span>
                        <button
                            onClick={handleSavePendingMoves}
                            disabled={isSaving}
                            className="px-2 py-0.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 disabled:opacity-50"
                        >
                            {isSaving ? '저장중...' : '💾 저장'}
                        </button>
                        <button
                            onClick={handleCancelPendingMoves}
                            disabled={isSaving}
                            className="px-2 py-0.5 bg-gray-500 text-white rounded text-xs font-bold hover:bg-gray-600 disabled:opacity-50"
                        >
                            ↩ 취소
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimetableHeader;
