import React, { useState } from 'react';
import { LevelTest } from '../../../../types';
import { determineLevel } from '../../../../hooks/useGradeProfile';
import { Zap, Loader2, X, FileText, Calendar, Target } from 'lucide-react';

interface LevelTestModalProps {
    onClose: () => void;
    studentId: string;
    studentName: string;
    onAdd: (data: Omit<LevelTest, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

const LevelTestModal: React.FC<LevelTestModalProps> = ({ onClose, studentId, studentName, onAdd }) => {
    const [subject, setSubject] = useState<'math' | 'english'>('math');
    const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
    const [score, setScore] = useState('');
    const [maxScore, setMaxScore] = useState('100');
    const [testType, setTestType] = useState<'placement' | 'promotion' | 'diagnostic'>('placement');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!score || !maxScore) return;

        setIsSubmitting(true);
        try {
            const scoreNum = parseFloat(score);
            const maxScoreNum = parseFloat(maxScore);
            const percentage = (scoreNum / maxScoreNum) * 100;
            const level = determineLevel(subject, percentage);

            await onAdd({
                studentId,
                studentName,
                testDate,
                subject,
                testType,
                score: scoreNum,
                maxScore: maxScoreNum,
                percentage,
                recommendedLevel: level,
                evaluatorId: 'current-user',
                evaluatorName: '관리자',
            });
            onClose();
        } catch (error) {
            console.error('Failed to add level test:', error);
            alert('레벨테스트 추가에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-[#081429] flex items-center gap-2">
                        <Zap size={16} className="text-indigo-600" />
                        레벨테스트 추가
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Section: 테스트 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <FileText className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">테스트 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {/* Subject & Test Type Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-12 shrink-0 text-xs font-medium text-[#373d41]">과목</span>
                                <select
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value as any)}
                                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                    <option value="math">수학</option>
                                    <option value="english">영어</option>
                                </select>
                            </div>

                            {/* Test Type Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-12 shrink-0 text-xs font-medium text-[#373d41]">유형</span>
                                <select
                                    value={testType}
                                    onChange={(e) => setTestType(e.target.value as any)}
                                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                    <option value="placement">입학 배치</option>
                                    <option value="promotion">레벨업</option>
                                    <option value="diagnostic">진단 평가</option>
                                </select>
                            </div>

                            {/* Test Date Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="w-10 shrink-0 text-xs font-medium text-[#373d41]">날짜</span>
                                <input
                                    type="date"
                                    value={testDate}
                                    onChange={(e) => setTestDate(e.target.value)}
                                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            {/* Score Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <Target className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="w-10 shrink-0 text-xs font-medium text-[#373d41]">점수</span>
                                <input
                                    type="number"
                                    value={score}
                                    onChange={(e) => setScore(e.target.value)}
                                    placeholder="예: 85"
                                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    required
                                />
                                <span className="text-xs text-gray-400">/</span>
                                <input
                                    type="number"
                                    value={maxScore}
                                    onChange={(e) => setMaxScore(e.target.value)}
                                    placeholder="만점"
                                    className="w-20 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Score Calculation Display */}
                    {score && maxScore && (
                        <div className="bg-indigo-50 p-2 rounded-sm border border-indigo-100">
                            <p className="text-xs text-indigo-700">
                                정답률: <span className="font-bold">{((parseFloat(score) / parseFloat(maxScore)) * 100).toFixed(1)}%</span>
                                {' '} → 추천 레벨: <span className="font-bold">{determineLevel(subject, (parseFloat(score) / parseFloat(maxScore)) * 100)}</span>
                            </p>
                        </div>
                    )}

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
                            disabled={isSubmitting || !score || !maxScore}
                            className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-sm text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
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

export default LevelTestModal;
