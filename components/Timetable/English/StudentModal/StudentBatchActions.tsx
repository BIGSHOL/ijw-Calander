import React, { useState, useRef, useEffect } from 'react';
import { Settings, Trash2 } from 'lucide-react';

interface StudentBatchActionsProps {
    studentCount: number;
    canEdit: boolean;
    onDeleteAll: () => void;
    onBatchDeleteEnglishName: () => void;
    onBatchGradePromotion: () => void;
}

const StudentBatchActions: React.FC<StudentBatchActionsProps> = ({
    studentCount,
    canEdit,
    onDeleteAll,
    onBatchDeleteEnglishName,
    onBatchGradePromotion
}) => {
    const [isManageMenuOpen, setIsManageMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsManageMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!canEdit) return null;

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onDeleteAll}
                disabled={studentCount === 0}
                className="text-red-500 hover:text-red-600 font-bold text-sm flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 hover:bg-red-50 rounded"
            >
                <Trash2 size={14} /> 삭제
            </button>

            {/* Batch Management Menu */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setIsManageMenuOpen(!isManageMenuOpen)}
                    disabled={studentCount === 0}
                    className="text-gray-600 hover:text-gray-800 font-bold text-sm flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 hover:bg-gray-200 rounded"
                >
                    <Settings size={14} /> 일괄 관리
                </button>
                {isManageMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-10">
                        <button
                            onClick={() => {
                                onBatchDeleteEnglishName();
                                setIsManageMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                            <div className="font-bold mb-0.5">영어 이름 일괄 삭제</div>
                            <div className="text-gray-400 text-xxs">모든 학생의 영어 이름을 지웁니다.</div>
                        </button>
                        <button
                            onClick={() => {
                                onBatchGradePromotion();
                                setIsManageMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-xs text-gray-700 hover:bg-gray-50"
                        >
                            <div className="font-bold mb-0.5">학년 일괄 승급 (+1)</div>
                            <div className="text-gray-400 text-xxs">모든 학생의 학년을 1씩 올립니다.</div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentBatchActions;
