import React, { useState, useMemo } from 'react';
import { UnifiedStudent, StudentScore, Exam, GRADE_COLORS, EXAM_TYPE_LABELS, calculateGrade } from '../../../types';
import { useStudentScores, useAddScore, useDeleteScore, calculateScoreStats } from '../../../hooks/useStudentGrades';
import { useExams, useCreateExam } from '../../../hooks/useExams';
import { auth } from '../../../firebaseConfig';
import {
    GraduationCap, TrendingUp, TrendingDown, Minus, Plus, Trash2, ChevronDown,
    Award, BarChart3, Calendar, BookOpen, Loader2, AlertCircle, Check, X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface GradesTabProps {
    student: UnifiedStudent;
}

const GradesTab: React.FC<GradesTabProps> = ({ student }) => {
    const user = auth.currentUser;
    const [subjectFilter, setSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
    const [isAddingScore, setIsAddingScore] = useState(false);
    const [isCreatingExam, setIsCreatingExam] = useState(false);

    // Data fetching
    const { data: scores = [], isLoading: loadingScores } = useStudentScores(
        student.id,
        subjectFilter === 'all' ? undefined : subjectFilter
    );
    const { data: exams = [], isLoading: loadingExams } = useExams();

    // Mutations
    const addScore = useAddScore();
    const deleteScore = useDeleteScore();
    const createExam = useCreateExam();

    // 통계 계산
    const stats = useMemo(() => calculateScoreStats(scores), [scores]);

    // 차트 데이터 준비 (최근 10개, 시간순 정렬)
    const chartData = useMemo(() => {
        return [...scores]
            .slice(0, 10)
            .reverse()
            .map(score => ({
                name: score.examTitle || '시험',
                score: score.percentage || 0,
                subject: score.subject,
            }));
    }, [scores]);

    // 성적 입력 폼 상태
    const [newScore, setNewScore] = useState({
        examId: '',
        subject: 'math' as 'math' | 'english',
        score: '',
        maxScore: '100',
        average: '',
        rank: '',
        totalStudents: '',
        memo: '',
    });

    // 새 시험 폼 상태
    const [newExam, setNewExam] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        type: 'mock' as Exam['type'],
        subject: 'math' as Exam['subject'],
        maxScore: '100',
    });

    const handleAddScore = async () => {
        if (!newScore.examId || !newScore.score) return;

        const selectedExam = exams.find(e => e.id === newScore.examId);

        await addScore.mutateAsync({
            studentId: student.id,
            studentName: student.name,
            examId: newScore.examId,
            examTitle: selectedExam?.title,
            subject: newScore.subject,
            score: parseFloat(newScore.score),
            maxScore: parseFloat(newScore.maxScore) || 100,
            average: newScore.average ? parseFloat(newScore.average) : undefined,
            rank: newScore.rank ? parseInt(newScore.rank) : undefined,
            totalStudents: newScore.totalStudents ? parseInt(newScore.totalStudents) : undefined,
            memo: newScore.memo || undefined,
            createdBy: user?.uid || '',
            createdByName: user?.displayName || user?.email || '',
        });

        setNewScore({
            examId: '',
            subject: 'math',
            score: '',
            maxScore: '100',
            average: '',
            rank: '',
            totalStudents: '',
            memo: '',
        });
        setIsAddingScore(false);
    };

    const handleCreateExam = async () => {
        if (!newExam.title || !newExam.date) return;

        await createExam.mutateAsync({
            title: newExam.title,
            date: newExam.date,
            type: newExam.type,
            subject: newExam.subject,
            maxScore: parseFloat(newExam.maxScore) || 100,
            createdBy: user?.uid || '',
            createdByName: user?.displayName || user?.email || '',
        });

        setNewExam({
            title: '',
            date: new Date().toISOString().split('T')[0],
            type: 'mock',
            subject: 'math',
            maxScore: '100',
        });
        setIsCreatingExam(false);
    };

    const handleDeleteScore = async (scoreId: string) => {
        if (confirm('이 성적을 삭제하시겠습니까?')) {
            await deleteScore.mutateAsync(scoreId);
        }
    };

    // 트렌드 아이콘
    const TrendIcon = stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
    const trendColor = stats.trend === 'up' ? 'text-emerald-500' : stats.trend === 'down' ? 'text-red-500' : 'text-gray-400';

    if (loadingScores || loadingExams) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                        <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[#081429]">성적 현황</h3>
                        <p className="text-xs text-gray-500">총 {stats.totalExams}개 시험</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* 과목 필터 */}
                    <select
                        value={subjectFilter}
                        onChange={(e) => setSubjectFilter(e.target.value as any)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="all">전체 과목</option>
                        <option value="math">수학</option>
                        <option value="english">영어</option>
                    </select>

                    {/* 성적 추가 버튼 */}
                    <button
                        onClick={() => setIsAddingScore(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#081429] text-white rounded-lg text-sm font-medium hover:bg-[#0f2847] transition-colors"
                    >
                        <Plus size={14} />
                        성적 입력
                    </button>
                </div>
            </div>

            {/* 통계 카드 */}
            {stats.totalExams > 0 && (
                <div className="grid grid-cols-4 gap-4">
                    {/* 평균 점수 */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-blue-600">평균 점수</span>
                            <BarChart3 size={14} className="text-blue-400" />
                        </div>
                        <div className="text-2xl font-bold text-[#081429]">
                            {stats.averagePercentage.toFixed(1)}%
                        </div>
                        <div className={`flex items-center gap-1 text-xs mt-1 ${trendColor}`}>
                            <TrendIcon size={12} />
                            <span>{stats.trend === 'up' ? '상승 중' : stats.trend === 'down' ? '하락 중' : '유지'}</span>
                        </div>
                    </div>

                    {/* 최고 점수 */}
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-emerald-600">최고 점수</span>
                            <Award size={14} className="text-emerald-400" />
                        </div>
                        <div className="text-2xl font-bold text-[#081429]">
                            {stats.highestScore?.percentage?.toFixed(0) || '-'}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {stats.highestScore?.examTitle || '-'}
                        </div>
                    </div>

                    {/* 최근 성적 */}
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-amber-600">최근 성적</span>
                            <Calendar size={14} className="text-amber-400" />
                        </div>
                        <div className="text-2xl font-bold text-[#081429]">
                            {scores[0]?.percentage?.toFixed(0) || '-'}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {scores[0]?.examTitle || '-'}
                        </div>
                    </div>

                    {/* 등급 */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-purple-600">평균 등급</span>
                            <GraduationCap size={14} className="text-purple-400" />
                        </div>
                        <div className="text-2xl font-bold text-[#081429]">
                            {calculateGrade(stats.averagePercentage)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {stats.totalExams}개 시험 기준
                        </div>
                    </div>
                </div>
            )}

            {/* 성적 추이 차트 */}
            {chartData.length > 1 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h4 className="text-sm font-bold text-[#081429] mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-blue-500" />
                        성적 추이
                    </h4>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#e5e7eb' }}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#e5e7eb' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#081429',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '12px',
                                    }}
                                    formatter={(value: number) => [`${value.toFixed(1)}%`, '점수']}
                                />
                                <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="5 5" />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    dot={{ fill: '#6366f1', strokeWidth: 2 }}
                                    activeDot={{ r: 6, fill: '#4f46e5' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* 성적 목록 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#081429] flex items-center gap-2">
                        <BookOpen size={16} className="text-indigo-500" />
                        시험별 성적
                    </h4>
                    {scores.length > 0 && (
                        <span className="text-xs text-gray-400">최근 순</span>
                    )}
                </div>

                {scores.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">등록된 성적이 없습니다</p>
                        <button
                            onClick={() => setIsAddingScore(true)}
                            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            + 첫 성적 입력하기
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {scores.map((score) => {
                            const gradeColor = score.grade ? GRADE_COLORS[score.grade] : null;

                            return (
                                <div
                                    key={score.id}
                                    className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* 과목 아이콘 */}
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${score.subject === 'math' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                            }`}>
                                            <span className="text-sm font-bold">
                                                {score.subject === 'math' ? '수' : '영'}
                                            </span>
                                        </div>

                                        <div>
                                            <div className="font-medium text-[#081429]">
                                                {score.examTitle || '시험'}
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                                <span>{score.score}/{score.maxScore}점</span>
                                                {score.average && (
                                                    <>
                                                        <span className="text-gray-300">•</span>
                                                        <span>평균 {score.average}점</span>
                                                    </>
                                                )}
                                                {score.rank && score.totalStudents && (
                                                    <>
                                                        <span className="text-gray-300">•</span>
                                                        <span>{score.rank}/{score.totalStudents}등</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* 점수 */}
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-[#081429]">
                                                {score.percentage?.toFixed(0)}%
                                            </div>
                                            {gradeColor && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${gradeColor.bg} ${gradeColor.text} border ${gradeColor.border}`}>
                                                    {score.grade}
                                                </span>
                                            )}
                                        </div>

                                        {/* 삭제 버튼 */}
                                        <button
                                            onClick={() => handleDeleteScore(score.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 성적 입력 모달 */}
            {isAddingScore && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsAddingScore(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-[#081429]">성적 입력</h3>
                                <button onClick={() => setIsAddingScore(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* 시험 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">시험 선택</label>
                                <div className="flex gap-2">
                                    <select
                                        value={newScore.examId}
                                        onChange={(e) => setNewScore({ ...newScore, examId: e.target.value })}
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="">시험 선택...</option>
                                        {exams.map(exam => (
                                            <option key={exam.id} value={exam.id}>
                                                {exam.title} ({exam.date})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => setIsCreatingExam(true)}
                                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                                    >
                                        + 새 시험
                                    </button>
                                </div>
                            </div>

                            {/* 과목 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">과목</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewScore({ ...newScore, subject: 'math' })}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${newScore.subject === 'math'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        수학
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewScore({ ...newScore, subject: 'english' })}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${newScore.subject === 'english'
                                                ? 'bg-purple-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        영어
                                    </button>
                                </div>
                            </div>

                            {/* 점수 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">점수</label>
                                    <input
                                        type="number"
                                        value={newScore.score}
                                        onChange={(e) => setNewScore({ ...newScore, score: e.target.value })}
                                        placeholder="85"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">만점</label>
                                    <input
                                        type="number"
                                        value={newScore.maxScore}
                                        onChange={(e) => setNewScore({ ...newScore, maxScore: e.target.value })}
                                        placeholder="100"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* 선택적 정보 */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">평균 (선택)</label>
                                    <input
                                        type="number"
                                        value={newScore.average}
                                        onChange={(e) => setNewScore({ ...newScore, average: e.target.value })}
                                        placeholder="72"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">석차 (선택)</label>
                                    <input
                                        type="number"
                                        value={newScore.rank}
                                        onChange={(e) => setNewScore({ ...newScore, rank: e.target.value })}
                                        placeholder="5"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">전체 인원</label>
                                    <input
                                        type="number"
                                        value={newScore.totalStudents}
                                        onChange={(e) => setNewScore({ ...newScore, totalStudents: e.target.value })}
                                        placeholder="32"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* 메모 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">메모 (선택)</label>
                                <textarea
                                    value={newScore.memo}
                                    onChange={(e) => setNewScore({ ...newScore, memo: e.target.value })}
                                    placeholder="특이사항 메모..."
                                    rows={2}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
                            <button
                                onClick={() => setIsAddingScore(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAddScore}
                                disabled={!newScore.examId || !newScore.score || addScore.isPending}
                                className="px-4 py-2 text-sm bg-[#081429] text-white rounded-lg hover:bg-[#0f2847] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {addScore.isPending ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Check size={14} />
                                )}
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 새 시험 생성 모달 */}
            {isCreatingExam && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setIsCreatingExam(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-[#081429]">새 시험 등록</h3>
                                <button onClick={() => setIsCreatingExam(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">시험명</label>
                                <input
                                    type="text"
                                    value={newExam.title}
                                    onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                                    placeholder="1월 모의고사"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">날짜</label>
                                    <input
                                        type="date"
                                        value={newExam.date}
                                        onChange={(e) => setNewExam({ ...newExam, date: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">유형</label>
                                    <select
                                        value={newExam.type}
                                        onChange={(e) => setNewExam({ ...newExam, type: e.target.value as Exam['type'] })}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        {Object.entries(EXAM_TYPE_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">과목</label>
                                    <select
                                        value={newExam.subject}
                                        onChange={(e) => setNewExam({ ...newExam, subject: e.target.value as Exam['subject'] })}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="math">수학</option>
                                        <option value="english">영어</option>
                                        <option value="both">통합</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">만점</label>
                                    <input
                                        type="number"
                                        value={newExam.maxScore}
                                        onChange={(e) => setNewExam({ ...newExam, maxScore: e.target.value })}
                                        placeholder="100"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
                            <button
                                onClick={() => setIsCreatingExam(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleCreateExam}
                                disabled={!newExam.title || !newExam.date || createExam.isPending}
                                className="px-4 py-2 text-sm bg-[#081429] text-white rounded-lg hover:bg-[#0f2847] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {createExam.isPending ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Check size={14} />
                                )}
                                등록
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GradesTab;
