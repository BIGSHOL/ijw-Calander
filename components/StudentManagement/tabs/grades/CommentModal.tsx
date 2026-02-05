import React, { useState } from 'react';
import { GradeComment, GradeCommentCategory, COMMENT_CATEGORY_LABELS } from '../../../../types';
import { getCurrentPeriod } from '../../../../hooks/useGradeProfile';
import { MessageSquare, Loader2, X, Tag, FileText } from 'lucide-react';
import { SUBJECT_COLORS, SubjectType } from '../../../../utils/styleUtils';

interface CommentModalProps {
    onClose: () => void;
    studentId: string;
    studentName: string;
    onAdd: (data: Omit<GradeComment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    onUpdate: (id: string, data: Partial<GradeComment>) => Promise<void>;
    editingComment: GradeComment | null;
}

const CommentModal: React.FC<CommentModalProps> = ({ onClose, studentId, studentName, onAdd, onUpdate, editingComment }) => {
    const [category, setCategory] = useState<GradeCommentCategory>(editingComment?.category || 'strength');
    const [subject, setSubject] = useState<'math' | 'english' | 'all'>(editingComment?.subject || 'all');
    const [content, setContent] = useState(editingComment?.content || '');
    const [isSharedWithParent, setIsSharedWithParent] = useState(editingComment?.isSharedWithParent ?? false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentPeriod = getCurrentPeriod();
    const categoryInfo = COMMENT_CATEGORY_LABELS[category];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);
        try {
            if (editingComment) {
                // 수정
                await onUpdate(editingComment.id, {
                    category,
                    subject,
                    content: content.trim(),
                    isSharedWithParent,
                    updatedAt: Date.now(),
                });
            } else {
                // 추가
                await onAdd({
                    studentId,
                    studentName,
                    category,
                    subject,
                    content: content.trim(),
                    period: currentPeriod,
                    isSharedWithParent,
                    authorId: 'current-user',
                    authorName: '관리자',
                });
            }
            onClose();
        } catch (error) {
            console.error('Failed to save comment:', error);
            alert('코멘트 저장에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <MessageSquare size={16} className="text-emerald-600" />
                        {editingComment ? '코멘트 수정' : '코멘트 추가'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Section: 코멘트 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <MessageSquare className="w-3 h-3 text-primary" />
                            <h3 className="text-primary font-bold text-xs">코멘트 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {/* Category & Subject Row */}
                            <div className="px-2 py-1.5">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Tag className="w-3 h-3 text-gray-400" />
                                            <label className="text-xs font-medium text-primary-700">카테고리</label>
                                        </div>
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value as GradeCommentCategory)}
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        >
                                            {Object.entries(COMMENT_CATEGORY_LABELS).map(([key, info]) => (
                                                <option key={key} value={key}>
                                                    {info.icon} {info.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <FileText className="w-3 h-3 text-gray-400" />
                                            <label className="text-xs font-medium text-primary-700">과목</label>
                                        </div>
                                        <select
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value as any)}
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        >
                                            <option value="all">전체</option>
                                            <option value="math">수학</option>
                                            <option value="english">영어</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Content Row */}
                            <div className="px-2 py-1.5">
                                <label className="block text-xs font-medium text-primary-700 mb-1">
                                    코멘트 내용
                                    <span className="text-gray-400 ml-1">({content.length}자)</span>
                                </label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder={`예: ${category === 'strength' ? '이해력이 뛰어나고 응용력이 우수함' : category === 'improvement' ? '계산 실수를 줄이기 위한 검산 습관 필요' : category === 'effort' ? '매일 오답노트 작성하며 꾸준히 노력함' : category === 'potential' ? '고난도 문제 해결 능력 향상 필요' : '전반적으로 학습 태도가 우수함'}`}
                                    className="w-full px-2 py-2 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[100px] resize-y"
                                    required
                                />
                            </div>

                            {/* Share with Parent Row */}
                            <div className="px-2 py-1.5">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="shareWithParent"
                                        checked={isSharedWithParent}
                                        onChange={(e) => setIsSharedWithParent(e.target.checked)}
                                        className="w-3.5 h-3.5 text-emerald-600 border-gray-300 rounded-sm focus:ring-emerald-500"
                                    />
                                    <label htmlFor="shareWithParent" className="text-xs text-gray-700 cursor-pointer">
                                        학부모와 공유
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {content.trim() && (
                        <div className={`p-2 rounded-sm border bg-${categoryInfo.color}-50 border-${categoryInfo.color}-200`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-micro">{categoryInfo.icon}</span>
                                <span className={`text-xxs font-bold text-${categoryInfo.color}-700`}>
                                    {categoryInfo.label}
                                </span>
                                {subject !== 'all' && (
                                    <span className={`px-1 py-0.5 rounded-sm text-micro font-medium ${
                                        SUBJECT_COLORS[subject as SubjectType]?.badge || SUBJECT_COLORS.other.badge
                                    }`}>
                                        {subject === 'math' ? '수학' : '영어'}
                                    </span>
                                )}
                                <span className="text-xxs text-gray-400">{editingComment?.period || currentPeriod}</span>
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {content}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-sm text-xs font-medium hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !content.trim()}
                            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-sm text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={12} className="animate-spin" />
                                    저장 중...
                                </>
                            ) : (
                                editingComment ? '수정' : '저장'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CommentModal;
