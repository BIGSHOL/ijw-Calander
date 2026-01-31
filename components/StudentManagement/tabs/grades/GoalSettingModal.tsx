import React, { useState } from 'react';
import { GoalSetting } from '../../../../types';
import { Target, Loader2 } from 'lucide-react';

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-[#081429] mb-3 flex items-center gap-2">
                    <Target size={16} className="text-amber-600" />
                    시험 목표 설정
                </h3>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">시험 선택</label>
                        <select
                            value={examId}
                            onChange={(e) => setExamId(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:outline-none"
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

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">과목</label>
                        <select
                            value={subject}
                            onChange={(e) => setSubject(e.target.value as any)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        >
                            <option value="math">수학</option>
                            <option value="english">영어</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">목표 점수</label>
                            <input
                                type="number"
                                value={targetScore}
                                onChange={(e) => setTargetScore(e.target.value)}
                                placeholder="예: 90"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">만점</label>
                            <input
                                type="number"
                                value={maxScore}
                                onChange={(e) => setMaxScore(e.target.value)}
                                placeholder="예: 100"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    {targetScore && maxScore && (
                        <div className="bg-amber-50 p-2 rounded">
                            <p className="text-xs text-amber-700">
                                목표 달성률: <span className="font-bold">{((parseFloat(targetScore) / parseFloat(maxScore)) * 100).toFixed(1)}%</span>
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !examId || !targetScore || !maxScore}
                            className="flex-1 px-3 py-2 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
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
