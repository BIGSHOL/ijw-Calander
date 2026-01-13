import React from 'react';
import {
    ChevronLeft, ChevronRight, Search, X, Filter, ChevronUp, ChevronDown,
    Eye, EyeOff, Settings, Plus, Calendar
} from 'lucide-react';

const ALL_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

interface TimetableHeaderProps {
    weekLabel: string;
    goToPrevWeek: () => void;
    goToNextWeek: () => void;
    goToThisWeek: () => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    isOptionOpen: boolean;
    setIsOptionOpen: (isOpen: boolean) => void;
    showStudents: boolean;
    setShowStudents: (show: boolean) => void;
    selectedDays: string[];
    setSelectedDays: (days: string[]) => void;
    viewType: 'teacher' | 'room' | 'class';
    setIsTeacherOrderModalOpen: (isOpen: boolean) => void;
    setIsWeekdayOrderModalOpen: (isOpen: boolean) => void;
    setIsViewSettingsOpen: (isOpen: boolean) => void;
    pendingMovesCount: number;
    handleSavePendingMoves: () => void;
    handleCancelPendingMoves: () => void;
    isSaving: boolean;
    subjectTab: 'math' | 'english';
    canEditMath: boolean;
    canEditEnglish: boolean;
    onAddClass: () => void;
}

const TimetableHeader: React.FC<TimetableHeaderProps> = ({
    weekLabel,
    goToPrevWeek,
    goToNextWeek,
    goToThisWeek,
    searchQuery,
    setSearchQuery,
    isOptionOpen,
    setIsOptionOpen,
    showStudents,
    setShowStudents,
    selectedDays,
    setSelectedDays,
    viewType,
    setIsTeacherOrderModalOpen,
    setIsWeekdayOrderModalOpen,
    setIsViewSettingsOpen,
    pendingMovesCount,
    handleSavePendingMoves,
    handleCancelPendingMoves,
    isSaving,
    subjectTab,
    canEditMath,
    canEditEnglish,
    onAddClass
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

                {/* Option Settings Button */}
                <div className="relative">
                    <button
                        onClick={() => setIsOptionOpen(!isOptionOpen)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${isOptionOpen
                            ? 'bg-[#fdb813] border-[#fdb813] text-[#081429]'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Filter size={14} />
                        <span>보기 옵션</span>
                        {isOptionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {/* Options Dropdown */}
                    {isOptionOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                    <Filter size={16} className="text-[#fdb813]" />
                                    보기 옵션 설정
                                </h3>
                                <button
                                    onClick={() => setIsOptionOpen(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Student List Toggle */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 block">학생 목록 표시</label>
                                    <button
                                        onClick={() => setShowStudents(!showStudents)}
                                        className={`w-full px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between border ${showStudents
                                            ? 'bg-[#fdb813]/10 text-[#081429] border-[#fdb813] hover:bg-[#fdb813]/20'
                                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {showStudents ? <Eye size={14} /> : <EyeOff size={14} />}
                                            <span>{showStudents ? '학생 목록 보이기' : '학생 목록 숨기기'}</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${showStudents ? 'bg-[#fdb813]' : 'bg-gray-300'}`}>
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showStudents ? 'left-4.5' : 'left-0.5'}`} style={{ left: showStudents ? '18px' : '2px' }}></div>
                                        </div>
                                    </button>
                                </div>

                                <div className="w-full h-px bg-gray-100"></div>

                                {/* Days Selection */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <label className="text-xs font-bold text-gray-500 block">요일 선택</label>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setSelectedDays(['월', '화', '수', '목', '금'])}
                                                className="px-1.5 py-0.5 text-xxs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                                            >
                                                평일
                                            </button>
                                            <button
                                                onClick={() => setSelectedDays(ALL_WEEKDAYS)}
                                                className="px-1.5 py-0.5 text-xxs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                                            >
                                                전체
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 flex-wrap">
                                        {ALL_WEEKDAYS.map(day => {
                                            const isSelected = selectedDays.includes(day);
                                            return (
                                                <button
                                                    key={day}
                                                    onClick={() => {
                                                        const newDays = selectedDays.includes(day)
                                                            ? selectedDays.filter(d => d !== day)
                                                            : [...selectedDays, day];
                                                        setSelectedDays(newDays);
                                                    }}
                                                    className={`flex-1 min-w-[30px] py-2 rounded-md text-xs font-bold transition-all border ${isSelected
                                                        ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                                                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Order Settings (Math Tab Only) */}
                {viewType === 'teacher' && canEditMath && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsTeacherOrderModalOpen(true)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            title="강사 순서 설정"
                        >
                            ↕️ 강사 순서
                        </button>
                        <button
                            onClick={() => setIsWeekdayOrderModalOpen(true)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            title="요일 순서 설정"
                        >
                            <Calendar className="inline-block w-4 h-4 mr-1" />
                            요일 순서
                        </button>
                    </div>
                )}

                {/* View Settings */}
                <button
                    onClick={() => setIsViewSettingsOpen(true)}
                    className="p-1.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    title="보기 설정"
                >
                    <Settings size={14} />
                </button>

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

                {/* Add Class Button - Gated by subject-specific edit permission */}
                {((subjectTab === 'math' && canEditMath) ||
                    (subjectTab === 'english' && canEditEnglish)) && (
                        <button
                            onClick={onAddClass}
                            className="px-3 py-1.5 bg-[#fdb813] text-[#081429] rounded-md text-xs font-bold flex items-center gap-1 hover:brightness-110 transition-all active:scale-95 shadow-sm"
                        >
                            <Plus size={14} /> 수업추가
                        </button>
                    )}
            </div>
        </div>
    );
};

export default TimetableHeader;
