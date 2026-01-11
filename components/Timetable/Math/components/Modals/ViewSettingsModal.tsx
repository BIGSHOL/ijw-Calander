import React from 'react';
import { X } from 'lucide-react';

interface ViewSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    columnWidth: 'narrow' | 'normal' | 'wide';
    setColumnWidth: (width: 'narrow' | 'normal' | 'wide') => void;
    rowHeight: 'short' | 'normal' | 'tall' | 'very-tall';
    setRowHeight: (height: 'short' | 'normal' | 'tall' | 'very-tall') => void;
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
    setShowEmptyRooms
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-[300px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-bold text-sm text-[#081429]">보기 설정</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    {/* Column Width */}
                    <div>
                        <div className="text-xs font-bold text-gray-600 mb-2">가로 폭</div>
                        <div className="flex gap-1">
                            {(['narrow', 'normal', 'wide'] as const).map(w => (
                                <button
                                    key={w}
                                    onClick={() => setColumnWidth(w)}
                                    className={`flex-1 py-1.5 text-xs rounded border ${columnWidth === w ? 'bg-[#fdb813] text-[#081429] border-[#fdb813] font-bold' : 'border-gray-300 text-gray-500'}`}
                                >
                                    {w === 'narrow' ? '좁게' : w === 'normal' ? '보통' : '넓게'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Row Height */}
                    <div>
                        <div className="text-xs font-bold text-gray-600 mb-2">세로 높이</div>
                        <div className="flex gap-1">
                            {(['short', 'normal', 'tall', 'very-tall'] as const).map(h => (
                                <button
                                    key={h}
                                    onClick={() => setRowHeight(h)}
                                    className={`flex-1 py-1.5 text-xxs rounded border ${rowHeight === h ? 'bg-[#fdb813] text-[#081429] border-[#fdb813] font-bold' : 'border-gray-300 text-gray-500'}`}
                                >
                                    {h === 'short' ? '좁게' : h === 'normal' ? '보통' : h === 'tall' ? '넓게' : '아주넓게'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font Size */}
                    <div>
                        <div className="text-xs font-bold text-gray-600 mb-2">글자 크기</div>
                        <div className="flex gap-1">
                            {(['small', 'normal', 'large', 'very-large'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFontSize(f)}
                                    className={`flex-1 py-1.5 text-xxs rounded border ${fontSize === f ? 'bg-[#fdb813] text-[#081429] border-[#fdb813] font-bold' : 'border-gray-300 text-gray-500'}`}
                                >
                                    {f === 'small' ? '작게' : f === 'normal' ? '보통' : f === 'large' ? '크게' : '매우크게'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-2 pt-2 border-t">
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
    );
};

export default ViewSettingsModal;
