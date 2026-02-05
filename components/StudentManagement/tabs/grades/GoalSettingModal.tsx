import React, { useState } from 'react';
import { GoalSetting } from '../../../../types';
import { Target, Loader2, X, Calendar, TrendingUp, BookOpen } from 'lucide-react';

interface GoalSettingModalProps {
    onClose: () => void;
    studentId: string;
    studentName: string;
    onAdd: (data: Omit<GoalSetting, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    exams: any[];
}

const GoalSettingModal: React.FC<GoalSettingModalProps> = ({ onClose, studentId, studentName, onAdd, exams }) => {
    const [subject, setSubject] = useState<'math' | 'english'>('math');
    const [examId, setExamId] = useState('');
    const [targetScore, setTargetScore] = useState('');
    const [maxScore, setMaxScore] = useState('100');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedExam = exams.find(e => e.id === examId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!examId || !targetScore || !maxScore) return;

        setIsSubmitting(true);
        try {
            const targetScoreNum = parseFloat(targetScore);
            const maxScoreNum = parseFloat(maxScore);
            const targetPercentage = (targetScoreNum / maxScoreNum) * 100;

            await onAdd({
                studentId,
                studentName,
                examId,
                examTitle: selectedExam?.title || '시험',
                examDate: selectedExam?.date || '',
                subject,
                targetScore: targetScoreNum,
                maxScore: maxScoreNum,
                targetPercentage,
                setBy: 'current-user',
                setByName: '관리자',
            });
            onClose();
        } catch (error) {
            console.error('Failed to add goal setting:', error);
            alert('목표 설정 추가에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <Target size={16} className="text-amber-600" />
                        시험 목표 설정
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-2">
                    {/* Section: 목표 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Target className="w-3 h-3 text-primary" />
                            <h3 className="text-primary font-bold text-xs">목표 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {/* Exam Selection Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="w-12 shrink-0 text-xs font-medium text-primary-700">시험 <span className="text-red-500">*</span></span>
                                <select
                                    value={examId}
                                    onChange={(e) => setExamId(e.target.value)}
                                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    required
                                >
                                    <option value="">시험을 선택하세요</option>
                                    {exams.map(exam => (
                                        <option key={exam.id} value={exam.id}>
                                            {exam.title} ({exam.date})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Subject Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <BookOpen className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="w-12 shrink-0 text-xs font-medium text-primary-700">과목</span>
                                <select
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value as any)}
                                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                >
                                    <option value="math">수학</option>
                                    <option value="english">영어</option>
                                </select>
                            </div>

                            {/* Target Score & Max Score Row */}
                            <div className="px-2 py-1.5">
                                <div className="flex items-center gap-2 mb-1">
                                    <TrendingUp className="w-3 h-3 text-gray-400 shrink-0" />
                                    <span className="text-xs font-medium text-primary-700">목표 점수 <span className="text-red-500">*</span></span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 ml-5">
                                    <div>
                                        <label className="block text-xxs text-gray-500 mb-1">목표 점수</label>
                                        <input
                                            type="number"
                                            value={targetScore}
                                            onChange={(e) => setTargetScore(e.target.value)}
                                            placeholder="예: 90"
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xxs text-gray-500 mb-1">만점</label>
                                        <input
                                            type="number"
                                            value={maxScore}
                                            onChange={(e) => setMaxScore(e.target.value)}
                                            placeholder="예: 100"
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Target Percentage Display */}
                            {targetScore && maxScore && (
                                <div className="px-2 py-1.5">
                                    <div className="bg-amber-50 p-2 rounded-sm border border-amber-100">
                                        <p className="text-xs text-amber-700">
                                            목표 달성률: <span className="font-bold">{((parseFloat(targetScore) / parseFloat(maxScore)) * 100).toFixed(1)}%</span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
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
                            disabled={isSubmitting || !examId || !targetScore || !maxScore}
                            className="flex-1 px-3 py-2 bg-amber-600 text-white rounded-sm text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={12} className="animate-spin" />
                                    저장 중...
                                </>
                            ) : (
                                '저장'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GoalSettingModal;
