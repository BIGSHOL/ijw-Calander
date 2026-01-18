import React from 'react';
import { X, Filter, Eye, EyeOff, Calendar, User } from 'lucide-react';

export type GridViewMode = 'teacher-day' | 'day-teacher';

const ALL_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

interface ViewSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    // 표시 설정
    columnWidth: 'compact' | 'narrow' | 'normal' | 'wide';
    setColumnWidth: (width: 'compact' | 'narrow' | 'normal' | 'wide') => void;
    rowHeight: 'compact' | 'short' | 'normal' | 'tall' | 'very-tall';
    setRowHeight: (height: 'compact' | 'short' | 'normal' | 'tall' | 'very-tall') => void;
    fontSize: 'small' | 'normal' | 'large' | 'very-large';
    setFontSize: (size: 'small' | 'normal' | 'large' | 'very-large') => void;
    showClassName: boolean;
    setShowClassName: (show: boolean) => void;
    showSchool: boolean;
    setShowSchool: (show: boolean) => void;
    showGrade: boolean;
    setShowGrade: (show: boolean) => void;
    showEmptyRooms: boolean;
    setShowEmptyRooms: (show: boolean) => void;
    // 보기 옵션 설정 (통합)
    showStudents: boolean;
    setShowStudents: (show: boolean) => void;
    showHoldStudents: boolean;
    setShowHoldStudents: (show: boolean) => void;
    showWithdrawnStudents: boolean;
    setShowWithdrawnStudents: (show: boolean) => void;
    selectedDays: string[];
    setSelectedDays: (days: string[]) => void;
    // 뷰 모드
    timetableViewMode: 'day-based' | 'teacher-based';
    setTimetableViewMode: (mode: 'day-based' | 'teacher-based') => void;
    viewType?: 'teacher' | 'room' | 'class';
}

const ViewSettingsModal: React.FC<ViewSettingsModalProps> = ({
    isOpen,
    onClose,
    columnWidth,
    setColumnWidth,
    rowHeight,
    setRowHeight,
    fontSize,
    setFontSize,
    showClassName,
    setShowClassName,
    showSchool,
    setShowSchool,
    showGrade,
    setShowGrade,
    showEmptyRooms,
    setShowEmptyRooms,
    showStudents,
    setShowStudents,
    showHoldStudents,
    setShowHoldStudents,
    showWithdrawnStudents,
    setShowWithdrawnStudents,
    selectedDays,
    setSelectedDays,
    timetableViewMode,
    setTimetableViewMode,
    viewType
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-[360px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                    <h3 className="font-bold text-sm text-[#081429] flex items-center gap-2">
                        <Filter size={16} className="text-[#fdb813]" />
                        보기 설정
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 space-y-5">
                    {/* === 보기 옵션 섹션 === */}
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-[#fdb813] flex items-center gap-1.5">
                            <Eye size={14} />
                            보기 옵션
                        </div>

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
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform`} style={{ left: showStudents ? '18px' : '2px' }}></div>
                                </div>
                            </button>

                            {/* 대기/퇴원 표시 토글 (학생 목록 보일 때만 활성화) */}
                            {showStudents && (
                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={() => setShowHoldStudents(!showHoldStudents)}
                                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showHoldStudents
                                            ? 'bg-violet-100 text-violet-700 border-violet-300'
                                            : 'bg-gray-50 text-gray-400 border-gray-200'
                                            }`}
                                    >
                                        {showHoldStudents ? <Eye size={12} className="inline mr-1" /> : <EyeOff size={12} className="inline mr-1" />}
                                        대기
                                    </button>
                                    <button
                                        onClick={() => setShowWithdrawnStudents(!showWithdrawnStudents)}
                                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showWithdrawnStudents
                                            ? 'bg-gray-200 text-gray-700 border-gray-300'
                                            : 'bg-gray-50 text-gray-400 border-gray-200'
                                            }`}
                                    >
                                        {showWithdrawnStudents ? <Eye size={12} className="inline mr-1" /> : <EyeOff size={12} className="inline mr-1" />}
                                        퇴원
                                    </button>
                                </div>
                            )}
                        </div>

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
                                            className={`flex-1 min-w-[36px] py-2 rounded-md text-xs font-bold transition-all border ${isSelected
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

                    <div className="w-full h-px bg-gray-200"></div>

                    {/* === 크기 설정 섹션 === */}
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-[#fdb813]">크기 설정</div>

                        {/* Column Width */}
                        <div>
                            <div className="text-xs font-bold text-gray-500 mb-2">가로 폭</div>
                            <div className="flex gap-1">
                                {(['compact', 'narrow', 'normal', 'wide'] as const).map(w => (
                                    <button
                                        key={w}
                                        onClick={() => setColumnWidth(w)}
                                        className={`flex-1 py-1.5 text-xs rounded border ${columnWidth === w ? 'bg-[#fdb813] text-[#081429] border-[#fdb813] font-bold' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        {w === 'compact' ? '컴팩트' : w === 'narrow' ? '좁게' : w === 'normal' ? '보통' : '넓게'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Row Height */}
                        <div>
                            <div className="text-xs font-bold text-gray-500 mb-2">세로 높이</div>
                            <div className="flex gap-1">
                                {(['compact', 'short', 'normal', 'tall', 'very-tall'] as const).map(h => (
                                    <button
                                        key={h}
                                        onClick={() => setRowHeight(h)}
                                        className={`flex-1 py-1.5 text-xxs rounded border ${rowHeight === h ? 'bg-[#fdb813] text-[#081429] border-[#fdb813] font-bold' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        {h === 'compact' ? '컴팩트' : h === 'short' ? '좁게' : h === 'normal' ? '보통' : h === 'tall' ? '넓게' : '아주넓게'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Font Size */}
                        <div>
                            <div className="text-xs font-bold text-gray-500 mb-2">글자 크기</div>
                            <div className="flex gap-1">
                                {(['small', 'normal', 'large', 'very-large'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFontSize(f)}
                                        className={`flex-1 py-1.5 text-xxs rounded border ${fontSize === f ? 'bg-[#fdb813] text-[#081429] border-[#fdb813] font-bold' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        {f === 'small' ? '작게' : f === 'normal' ? '보통' : f === 'large' ? '크게' : '매우크게'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-px bg-gray-200"></div>

                    {/* === 표시 항목 섹션 === */}
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-[#fdb813]">표시 항목</div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={showClassName} onChange={(e) => setShowClassName(e.target.checked)} className="w-4 h-4 accent-[#fdb813]" />
                                <span className="text-xs font-bold text-gray-700">수업명 보기</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={showSchool} onChange={(e) => setShowSchool(e.target.checked)} className="w-4 h-4 accent-[#fdb813]" />
                                <span className="text-xs font-bold text-gray-700">학교 보기</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={showGrade} onChange={(e) => setShowGrade(e.target.checked)} className="w-4 h-4 accent-[#fdb813]" />
                                <span className="text-xs font-bold text-gray-700">학년 보기</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={showEmptyRooms} onChange={(e) => setShowEmptyRooms(e.target.checked)} className="w-4 h-4 accent-[#fdb813]" />
                                <span className="text-xs font-bold text-gray-700">빈 강의실 표시</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewSettingsModal;
