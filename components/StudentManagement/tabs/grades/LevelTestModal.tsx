import React, { useState } from 'react';
import { LevelTest, UserProfile } from '../../../../types';
import { Zap, Loader2, X, FileText, Calendar } from 'lucide-react';

interface LevelTestModalProps {
    onClose: () => void;
    studentId: string;
    studentName: string;
    onAdd: (data: Omit<LevelTest, 'id'>) => Promise<void>;
    currentUser?: UserProfile | null;
}

const LevelTestModal: React.FC<LevelTestModalProps> = ({ onClose, studentId, studentName, onAdd, currentUser }) => {
    const [subject, setSubject] = useState<'math' | 'english'>('math');
    const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
    const [testType, setTestType] = useState<'placement' | 'promotion' | 'diagnostic'>('placement');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 수학 필드
    const [calculationScore, setCalculationScore] = useState('');
    const [comprehensionScore, setComprehensionScore] = useState('');
    const [reasoningScore, setReasoningScore] = useState('');
    const [problemSolvingScore, setProblemSolvingScore] = useState('');
    const [myTotalScore, setMyTotalScore] = useState('');
    const [averageScore, setAverageScore] = useState('');
    const [scoreGrade, setScoreGrade] = useState('');

    // 영어 공통
    const [englishTestType, setEnglishTestType] = useState<'ai' | 'nelt' | 'eie' | ''>('');
    const [engLevel, setEngLevel] = useState('');

    // AI 레벨테스트
    const [engAiGradeLevel, setEngAiGradeLevel] = useState('');
    const [engAiArIndex, setEngAiArIndex] = useState('');
    const [engAiTopPercent, setEngAiTopPercent] = useState('');
    const [engAiWordMy, setEngAiWordMy] = useState('');
    const [engAiWordAvg, setEngAiWordAvg] = useState('');
    const [engAiListenMy, setEngAiListenMy] = useState('');
    const [engAiListenAvg, setEngAiListenAvg] = useState('');
    const [engAiReadMy, setEngAiReadMy] = useState('');
    const [engAiReadAvg, setEngAiReadAvg] = useState('');
    const [engAiWriteMy, setEngAiWriteMy] = useState('');
    const [engAiWriteAvg, setEngAiWriteAvg] = useState('');

    // NELT
    const [engNeltOverallLevel, setEngNeltOverallLevel] = useState('');
    const [engNeltRank, setEngNeltRank] = useState('');
    const [engNeltVocab, setEngNeltVocab] = useState('');
    const [engNeltGrammar, setEngNeltGrammar] = useState('');
    const [engNeltListening, setEngNeltListening] = useState('');
    const [engNeltReading, setEngNeltReading] = useState('');

    // EiE
    const [engEieGradeLevel, setEngEieGradeLevel] = useState('');
    const [engEieVocabLevel, setEngEieVocabLevel] = useState('');
    const [engEieRank, setEngEieRank] = useState('');
    const [engEieCourse, setEngEieCourse] = useState('');
    const [engEieChartLevel, setEngEieChartLevel] = useState('');
    const [engEieTextbook, setEngEieTextbook] = useState('');
    const [engEieVocabMy, setEngEieVocabMy] = useState('');
    const [engEieVocabAvg, setEngEieVocabAvg] = useState('');
    const [engEieListenMy, setEngEieListenMy] = useState('');
    const [engEieListenAvg, setEngEieListenAvg] = useState('');
    const [engEieReadMy, setEngEieReadMy] = useState('');
    const [engEieReadAvg, setEngEieReadAvg] = useState('');
    const [engEieGrammarMy, setEngEieGrammarMy] = useState('');
    const [engEieGrammarAvg, setEngEieGrammarAvg] = useState('');

    const inputCls = "w-full px-1 py-1 text-sm text-center border border-slate-200 rounded-sm bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const data: any = {
                studentId,
                studentName,
                testDate,
                subject,
                testType,
                evaluatorId: currentUser?.uid || 'unknown',
                evaluatorName: currentUser?.name || '관리자',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            if (subject === 'math') {
                Object.assign(data, {
                    calculationScore: calculationScore || undefined,
                    comprehensionScore: comprehensionScore || undefined,
                    reasoningScore: reasoningScore || undefined,
                    problemSolvingScore: problemSolvingScore || undefined,
                    myTotalScore: myTotalScore || undefined,
                    averageScore: averageScore || undefined,
                    scoreGrade: scoreGrade || undefined,
                });
            } else {
                Object.assign(data, {
                    englishTestType: englishTestType || undefined,
                    engLevel: engLevel || undefined,
                });
                if (englishTestType === 'ai') {
                    Object.assign(data, {
                        engAiGradeLevel: engAiGradeLevel || undefined,
                        engAiArIndex: engAiArIndex || undefined,
                        engAiTopPercent: engAiTopPercent || undefined,
                        engAiWordMy: engAiWordMy || undefined, engAiWordAvg: engAiWordAvg || undefined,
                        engAiListenMy: engAiListenMy || undefined, engAiListenAvg: engAiListenAvg || undefined,
                        engAiReadMy: engAiReadMy || undefined, engAiReadAvg: engAiReadAvg || undefined,
                        engAiWriteMy: engAiWriteMy || undefined, engAiWriteAvg: engAiWriteAvg || undefined,
                    });
                } else if (englishTestType === 'nelt') {
                    Object.assign(data, {
                        engNeltOverallLevel: engNeltOverallLevel || undefined,
                        engNeltRank: engNeltRank || undefined,
                        engNeltVocab: engNeltVocab || undefined, engNeltGrammar: engNeltGrammar || undefined,
                        engNeltListening: engNeltListening || undefined, engNeltReading: engNeltReading || undefined,
                    });
                } else if (englishTestType === 'eie') {
                    Object.assign(data, {
                        engEieGradeLevel: engEieGradeLevel || undefined, engEieVocabLevel: engEieVocabLevel || undefined,
                        engEieRank: engEieRank || undefined,
                        engEieCourse: engEieCourse || undefined, engEieChartLevel: engEieChartLevel || undefined, engEieTextbook: engEieTextbook || undefined,
                        engEieVocabMy: engEieVocabMy || undefined, engEieVocabAvg: engEieVocabAvg || undefined,
                        engEieListenMy: engEieListenMy || undefined, engEieListenAvg: engEieListenAvg || undefined,
                        engEieReadMy: engEieReadMy || undefined, engEieReadAvg: engEieReadAvg || undefined,
                        engEieGrammarMy: engEieGrammarMy || undefined, engEieGrammarAvg: engEieGrammarAvg || undefined,
                    });
                }
            }

            // undefined 제거
            const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
            await onAdd(cleaned as any);
            onClose();
        } catch (error) {
            console.error('Failed to add level test:', error);
            alert('레벨테스트 추가에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[3vh] z-[100]" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[94vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <Zap size={16} className="text-indigo-600" />
                        레벨테스트 추가 - {studentName}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-3">
                    {/* 기본 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <FileText className="w-3 h-3 text-primary" />
                            <h3 className="text-primary font-bold text-xs">테스트 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-12 shrink-0 text-xs font-medium text-slate-700">과목</span>
                                <select value={subject} onChange={(e) => setSubject(e.target.value as any)}
                                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                                    <option value="math">수학</option>
                                    <option value="english">영어</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-12 shrink-0 text-xs font-medium text-slate-700">유형</span>
                                <select value={testType} onChange={(e) => setTestType(e.target.value as any)}
                                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                                    <option value="placement">입학 배치</option>
                                    <option value="promotion">레벨업</option>
                                    <option value="diagnostic">진단 평가</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="w-10 shrink-0 text-xs font-medium text-slate-700">날짜</span>
                                <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)}
                                    className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* 수학 세분화 점수 */}
                    {subject === 'math' && (
                        <div className="border border-emerald-200 rounded overflow-hidden">
                            <div className="px-2 py-1 bg-emerald-50 border-b border-emerald-200">
                                <span className="text-xs font-bold text-emerald-700">수학 레벨테스트</span>
                            </div>
                            <div className="grid grid-cols-4 bg-emerald-50/50">
                                {[
                                    { val: calculationScore, set: setCalculationScore, label: '계산력' },
                                    { val: comprehensionScore, set: setComprehensionScore, label: '이해력' },
                                    { val: reasoningScore, set: setReasoningScore, label: '추론력' },
                                    { val: problemSolvingScore, set: setProblemSolvingScore, label: '문제해결력' },
                                ].map((item, i) => (
                                    <div key={item.label} className={`px-1.5 py-1.5 ${i < 3 ? 'border-r border-emerald-200' : ''}`}>
                                        <div className="text-[10px] font-semibold text-emerald-700 text-center mb-1">{item.label}</div>
                                        <input type="text" value={item.val} onChange={e => item.set(e.target.value)} className={inputCls} placeholder="-" />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-3 border-t border-emerald-200">
                                {[
                                    { val: myTotalScore, set: setMyTotalScore, label: '내 점수' },
                                    { val: averageScore, set: setAverageScore, label: '평균 점수' },
                                    { val: scoreGrade, set: setScoreGrade, label: '등급' },
                                ].map((item, i) => (
                                    <div key={item.label} className={`px-1.5 py-1.5 ${i < 2 ? 'border-r border-emerald-200' : ''}`}>
                                        <div className="text-[10px] font-medium text-slate-500 text-center mb-1">{item.label}</div>
                                        <input type="text" value={item.val} onChange={e => item.set(e.target.value)} className={inputCls} placeholder="-" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 영어 레벨테스트 */}
                    {subject === 'english' && (
                        <div>
                            <select value={englishTestType} onChange={e => setEnglishTestType(e.target.value as any)}
                                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-2">
                                <option value="">시험 종류 선택</option>
                                <option value="ai">AI 레벨테스트</option>
                                <option value="nelt">NELT Report</option>
                                <option value="eie">EiE PTR</option>
                            </select>

                            {/* AI */}
                            {englishTestType === 'ai' && (
                                <div className="border border-blue-200 rounded overflow-hidden">
                                    <div className="px-2 py-1 bg-blue-50 border-b border-blue-200">
                                        <span className="text-xs font-bold text-blue-700">AI 레벨테스트</span>
                                    </div>
                                    <div className="grid grid-cols-4 bg-blue-50/50">
                                        {[
                                            { val: engLevel, set: setEngLevel, label: 'Lv' },
                                            { val: engAiGradeLevel, set: setEngAiGradeLevel, label: '학년 수준' },
                                            { val: engAiArIndex, set: setEngAiArIndex, label: 'AR 지수' },
                                            { val: engAiTopPercent, set: setEngAiTopPercent, label: '상위 %' },
                                        ].map((item, i) => (
                                            <div key={item.label} className={`px-1.5 py-1.5 ${i < 3 ? 'border-r border-blue-200' : ''}`}>
                                                <div className="text-[10px] font-semibold text-blue-700 text-center mb-1">{item.label}</div>
                                                <input type="text" value={item.val} onChange={e => item.set(e.target.value)} className={inputCls} placeholder="-" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-blue-200">
                                        <div className="grid grid-cols-[auto_1fr_1fr] text-[10px] font-semibold text-blue-700 bg-blue-50/50 border-b border-blue-100">
                                            <div className="px-2 py-1 w-14 text-center">영역</div>
                                            <div className="px-2 py-1 text-center border-l border-blue-100">나의 레벨</div>
                                            <div className="px-2 py-1 text-center border-l border-blue-100">회원평균</div>
                                        </div>
                                        {[
                                            { label: '단어', myVal: engAiWordMy, setMy: setEngAiWordMy, avgVal: engAiWordAvg, setAvg: setEngAiWordAvg },
                                            { label: '듣기', myVal: engAiListenMy, setMy: setEngAiListenMy, avgVal: engAiListenAvg, setAvg: setEngAiListenAvg },
                                            { label: '읽기', myVal: engAiReadMy, setMy: setEngAiReadMy, avgVal: engAiReadAvg, setAvg: setEngAiReadAvg },
                                            { label: '쓰기', myVal: engAiWriteMy, setMy: setEngAiWriteMy, avgVal: engAiWriteAvg, setAvg: setEngAiWriteAvg },
                                        ].map((row, i) => (
                                            <div key={row.label} className={`grid grid-cols-[auto_1fr_1fr] ${i < 3 ? 'border-b border-blue-100' : ''}`}>
                                                <div className="px-2 py-1.5 w-14 text-[11px] font-medium text-slate-600 text-center bg-blue-50/30">{row.label}</div>
                                                <div className="px-1 py-1 border-l border-blue-100">
                                                    <input type="text" value={row.myVal} onChange={e => row.setMy(e.target.value)} className={inputCls} placeholder="-" />
                                                </div>
                                                <div className="px-1 py-1 border-l border-blue-100">
                                                    <input type="text" value={row.avgVal} onChange={e => row.setAvg(e.target.value)} className={inputCls} placeholder="-" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* NELT */}
                            {englishTestType === 'nelt' && (
                                <div className="border border-violet-200 rounded overflow-hidden">
                                    <div className="px-2 py-1 bg-violet-50 border-b border-violet-200">
                                        <span className="text-xs font-bold text-violet-700">NELT Report</span>
                                    </div>
                                    <div className="grid grid-cols-3 bg-violet-50/50">
                                        {[
                                            { val: engLevel, set: setEngLevel, label: 'Lv' },
                                            { val: engNeltOverallLevel, set: setEngNeltOverallLevel, label: '종합 수준' },
                                            { val: engNeltRank, set: setEngNeltRank, label: '동학년 석차' },
                                        ].map((item, i) => (
                                            <div key={item.label} className={`px-1.5 py-1.5 ${i < 2 ? 'border-r border-violet-200' : ''}`}>
                                                <div className="text-[10px] font-semibold text-violet-700 text-center mb-1">{item.label}</div>
                                                <input type="text" value={item.val} onChange={e => item.set(e.target.value)} className={inputCls} placeholder="-" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-4 border-t border-violet-200">
                                        {[
                                            { val: engNeltVocab, set: setEngNeltVocab, label: '어휘' },
                                            { val: engNeltGrammar, set: setEngNeltGrammar, label: '문법' },
                                            { val: engNeltListening, set: setEngNeltListening, label: '듣기' },
                                            { val: engNeltReading, set: setEngNeltReading, label: '독해' },
                                        ].map((item, i) => (
                                            <div key={item.label} className={`px-1.5 py-1.5 ${i < 3 ? 'border-r border-violet-200' : ''}`}>
                                                <div className="text-[10px] font-medium text-slate-500 text-center mb-1">{item.label}</div>
                                                <input type="text" value={item.val} onChange={e => item.set(e.target.value)} className={inputCls} placeholder="수준" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* EiE */}
                            {englishTestType === 'eie' && (
                                <div className="border border-sky-200 rounded overflow-hidden">
                                    <div className="px-2 py-1 bg-sky-50 border-b border-sky-200">
                                        <span className="text-xs font-bold text-sky-700">EiE PTR</span>
                                    </div>
                                    <div className="grid grid-cols-4 bg-sky-50/50">
                                        {[
                                            { val: engLevel, set: setEngLevel, label: 'Lv' },
                                            { val: engEieGradeLevel, set: setEngEieGradeLevel, label: '학년 수준' },
                                            { val: engEieVocabLevel, set: setEngEieVocabLevel, label: '어휘 수준' },
                                            { val: engEieRank, set: setEngEieRank, label: '동학년순위' },
                                        ].map((item, i) => (
                                            <div key={item.label} className={`px-1.5 py-1.5 ${i < 3 ? 'border-r border-sky-200' : ''}`}>
                                                <div className="text-[10px] font-semibold text-sky-700 text-center mb-1">{item.label}</div>
                                                <input type="text" value={item.val} onChange={e => item.set(e.target.value)} className={inputCls} placeholder="-" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-3 border-t border-sky-200 bg-sky-50/40">
                                        {[
                                            { val: engEieCourse, set: setEngEieCourse, label: '과정' },
                                            { val: engEieChartLevel, set: setEngEieChartLevel, label: '레벨' },
                                            { val: engEieTextbook, set: setEngEieTextbook, label: '교재' },
                                        ].map((item, i) => (
                                            <div key={item.label} className={`px-1.5 py-1.5 ${i < 2 ? 'border-r border-sky-200' : ''}`}>
                                                <div className="text-[10px] font-medium text-sky-600 text-center mb-1">{item.label}</div>
                                                <input type="text" value={item.val} onChange={e => item.set(e.target.value)} className={inputCls} placeholder="-" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-sky-200">
                                        <div className="grid grid-cols-[auto_1fr_1fr] text-[10px] font-semibold text-sky-700 bg-sky-50/50 border-b border-sky-100">
                                            <div className="px-2 py-1 w-20 text-center">영역</div>
                                            <div className="px-2 py-1 text-center border-l border-sky-100">나의 레벨</div>
                                            <div className="px-2 py-1 text-center border-l border-sky-100">회원평균</div>
                                        </div>
                                        {[
                                            { label: 'Vocabulary', myVal: engEieVocabMy, setMy: setEngEieVocabMy, avgVal: engEieVocabAvg, setAvg: setEngEieVocabAvg },
                                            { label: 'Listening', myVal: engEieListenMy, setMy: setEngEieListenMy, avgVal: engEieListenAvg, setAvg: setEngEieListenAvg },
                                            { label: 'Reading', myVal: engEieReadMy, setMy: setEngEieReadMy, avgVal: engEieReadAvg, setAvg: setEngEieReadAvg },
                                            { label: 'Grammar', myVal: engEieGrammarMy, setMy: setEngEieGrammarMy, avgVal: engEieGrammarAvg, setAvg: setEngEieGrammarAvg },
                                        ].map((row, i) => (
                                            <div key={row.label} className={`grid grid-cols-[auto_1fr_1fr] ${i < 3 ? 'border-b border-sky-100' : ''}`}>
                                                <div className="px-2 py-1.5 w-20 text-[11px] font-medium text-slate-600 text-center bg-sky-50/30">{row.label}</div>
                                                <div className="px-1 py-1 border-l border-sky-100">
                                                    <input type="text" value={row.myVal} onChange={e => row.setMy(e.target.value)} className={inputCls} placeholder="-" />
                                                </div>
                                                <div className="px-1 py-1 border-l border-sky-100">
                                                    <input type="text" value={row.avgVal} onChange={e => row.setAvg(e.target.value)} className={inputCls} placeholder="-" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 버튼 */}
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-sm text-xs font-medium hover:bg-gray-200 transition-colors">
                            취소
                        </button>
                        <button type="submit" disabled={isSubmitting}
                            className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-sm text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                            {isSubmitting ? <><Loader2 size={12} className="animate-spin" />저장 중...</> : '저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LevelTestModal;
