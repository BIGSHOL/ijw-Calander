import React, { useState } from 'react';
import { LevelTest } from '../../../../types';
import { determineLevel } from '../../../../hooks/useGradeProfile';
import { Zap, Loader2 } from 'lucide-react';

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-[#081429] mb-3 flex items-center gap-2">
                    <Zap size={16} className="text-indigo-600" />
                    레벨테스트 추가
                </h3>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">과목</label>
                            <select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value as any)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            >
                                <option value="math">수학</option>
                                <option value="english">영어</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">테스트 유형</label>
                            <select
                                value={testType}
                                onChange={(e) => setTestType(e.target.value as any)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            >
                                <option value="placement">입학 배치</option>
                                <option value="promotion">레벨업</option>
                                <option value="diagnostic">진단 평가</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">테스트 날짜</label>
                        <input
                            type="date"
                            value={testDate}
                            onChange={(e) => setTestDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">취득 점수</label>
                            <input
                                type="number"
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                                placeholder="예: 85"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    {score && maxScore && (
                        <div className="bg-indigo-50 p-2 rounded">
                            <p className="text-xs text-indigo-700">
                                정답률: <span className="font-bold">{((parseFloat(score) / parseFloat(maxScore)) * 100).toFixed(1)}%</span>
                                {' '} → 추천 레벨: <span className="font-bold">{determineLevel(subject, (parseFloat(score) / parseFloat(maxScore)) * 100)}</span>
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
                            disabled={isSubmitting || !score || !maxScore}
                            className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
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
