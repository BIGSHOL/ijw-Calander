import React, { useState, useEffect } from 'react';
import { X, Flag, Trash2 } from 'lucide-react';
import { BucketItem } from '../../types';

interface BucketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, priority: 'high' | 'medium' | 'low') => void;
    onDelete?: (id: string) => void; // Delete handler for edit mode
    editingBucket?: BucketItem | null; // For edit mode
    targetMonth: string; // Display purpose
}

const BucketModal: React.FC<BucketModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    editingBucket,
    targetMonth
}) => {
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

    // Populate fields when editing
    useEffect(() => {
        if (editingBucket) {
            setTitle(editingBucket.title);
            setPriority(editingBucket.priority);
        } else {
            setTitle('');
            setPriority('medium');
        }
    }, [editingBucket, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave(title.trim(), priority);
        setTitle('');
        setPriority('medium');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#fdb813]/20 border-b border-[#fdb813]/30">
                    <div className="flex items-center gap-2">
                        <Flag size={16} className="text-[#fdb813]" />
                        <span className="font-bold text-[#081429]">
                            {editingBucket ? '버킷 수정' : '버킷 추가'}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Month Display */}
                    <div className="text-xs text-gray-500">
                        대상 월: <span className="font-bold text-[#081429]">{targetMonth}</span>
                    </div>

                    {/* Title Input */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">제목</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="버킷 제목을 입력하세요"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent outline-none text-sm"
                            autoFocus
                        />
                    </div>

                    {/* Priority Selector */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-2">우선순위</label>
                        <div className="flex gap-2">
                            {(['high', 'medium', 'low'] as const).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPriority(p)}
                                    className={`
                                        flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all
                                        ${priority === p
                                            ? p === 'high' ? 'bg-red-500 text-white ring-2 ring-red-300'
                                                : p === 'medium' ? 'bg-[#fdb813] text-[#081429] ring-2 ring-[#fdb813]/50'
                                                    : 'bg-gray-400 text-white ring-2 ring-gray-300'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }
                                    `}
                                >
                                    {p === 'high' ? '높음' : p === 'medium' ? '중간' : '낮음'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 pt-2">
                        {editingBucket && onDelete && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm('정말 이 버킷을 삭제하시겠습니까?')) {
                                        onDelete(editingBucket.id);
                                        onClose();
                                    }
                                }}
                                className="py-2 px-4 bg-red-500 text-white rounded-lg font-bold text-sm hover:bg-red-600 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 px-4 bg-gray-100 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim()}
                            className="flex-1 py-2 px-4 bg-[#081429] text-[#fdb813] rounded-lg font-bold text-sm hover:bg-[#0a1a35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {editingBucket ? '수정' : '추가'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BucketModal;
