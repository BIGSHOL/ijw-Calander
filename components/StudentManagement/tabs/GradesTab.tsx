import React, { useState, useMemo } from 'react';
import { UnifiedStudent, StudentScore, GRADE_COLORS, calculateGrade } from '../../../types';
import { useStudentScores, useDeleteScore, calculateScoreStats } from '../../../hooks/useStudentGrades';
import { useExams } from '../../../hooks/useExams';
import {
    GraduationCap, TrendingUp, TrendingDown, Minus, Plus, Trash2, ChevronDown,
    Award, BarChart3, Calendar, BookOpen, Loader2, AlertCircle, Search, X, Filter
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import AddScoreModal from '../../Grades/AddScoreModal';

interface GradesTabProps {
    student: UnifiedStudent;
}

const GradesTab: React.FC<GradesTabProps> = ({ student }) => {
    const [subjectFilter, setSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
    const [isAddingScore, setIsAddingScore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [examTypeFilter, setExamTypeFilter] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);

    // Data fetching - 전체 성적을 가져온 후 클라이언트에서 필터링
    const { data: allScores = [], isLoading: loadingScores } = useStudentScores(student.id);
    const { data: exams = [] } = useExams();

    // Mutations
    const deleteScore = useDeleteScore();

    // 필터링된 성적
    const scores = useMemo(() => {
        let filtered = [...allScores];

        // 과목 필터
        if (subjectFilter !== 'all') {
            filtered = filtered.filter(s => s.subject === subjectFilter);
        }

        // 시험 유형 필터
        if (examTypeFilter !== 'all') {
            filtered = filtered.filter(s => {
                const exam = exams.find(e => e.id === s.examId);
                return exam?.type === examTypeFilter;
            });
        }

        // 검색어 필터 (시험 이름)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(s => {
                const examTitle = s.examTitle?.toLowerCase() || '';
                const exam = exams.find(e => e.id === s.examId);
                const examDate = exam?.date || '';
                return examTitle.includes(query) || examDate.includes(query);
            });
        }

        return filtered;
    }, [allScores, subjectFilter, examTypeFilter, searchQuery, exams]);

    // 통계 계산 (필터링된 성적 기준)
    const stats = useMemo(() => calculateScoreStats(scores), [scores]);

    // 활성 필터 개수
    const activeFilterCount = [
        subjectFilter !== 'all',
        examTypeFilter !== 'all',
        searchQuery.trim() !== ''
    ].filter(Boolean).length;

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

    const handleDeleteScore = async (scoreId: string) => {
        if (confirm('이 성적을 삭제하시겠습니까?')) {
            await deleteScore.mutateAsync(scoreId);
        }
    };

    // 트렌드 아이콘
    const TrendIcon = stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
    const trendColor = stats.trend === 'up' ? 'text-emerald-500' : stats.trend === 'down' ? 'text-red-500' : 'text-gray-400';

    if (loadingScores) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-[#fdb813]" />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-[#081429]">성적 현황</h3>
                    <span className="text-xs text-gray-500">({stats.totalExams}개 시험)</span>
                </div>

                {/* 성적 추가 버튼 */}
                <button
                    onClick={() => setIsAddingScore(true)}
                    className="flex items-center gap-1 px-2 py-1 bg-[#081429] text-white rounded text-xs font-medium hover:bg-[#0f2847] transition-colors"
                >
                    <Plus size={12} />
                    입력
                </button>
            </div>

            {/* 통계 카드 */}
            {stats.totalExams > 0 && (
                <div className="grid grid-cols-4 gap-2">
                    {/* 평균 점수 */}
                    <div className="bg-blue-50 p-2 border border-blue-100">
                        <div className="flex items-center justify-between">
                            <span className="text-micro font-medium text-blue-600">평균</span>
                            <BarChart3 size={10} className="text-blue-400" />
                        </div>
                        <div className="text-sm font-bold text-[#081429]">
                            {stats.averagePercentage.toFixed(1)}%
                        </div>
                    </div>

                    {/* 최고 점수 */}
                    <div className="bg-emerald-50 p-2 border border-emerald-100">
                        <div className="flex items-center justify-between">
                            <span className="text-micro font-medium text-emerald-600">최고</span>
                            <Award size={10} className="text-emerald-400" />
                        </div>
                        <div className="text-sm font-bold text-[#081429]">
                            {stats.highestScore?.percentage?.toFixed(0) || '-'}%
                        </div>
                    </div>

                    {/* 최근 성적 */}
                    <div className="bg-amber-50 p-2 border border-amber-100">
                        <div className="flex items-center justify-between">
                            <span className="text-micro font-medium text-amber-600">최근</span>
                            <Calendar size={10} className="text-amber-400" />
                        </div>
                        <div className="text-sm font-bold text-[#081429]">
                            {scores[0]?.percentage?.toFixed(0) || '-'}%
                        </div>
                    </div>

                    {/* 등급 */}
                    <div className="bg-purple-50 p-2 border border-purple-100">
                        <div className="flex items-center justify-between">
                            <span className="text-micro font-medium text-purple-600">등급</span>
                            <GraduationCap size={10} className="text-purple-400" />
                        </div>
                        <div className="text-sm font-bold text-[#081429]">
                            {calculateGrade(stats.averagePercentage)}
                        </div>
                    </div>
                </div>
            )}

            {/* 성적 추이 차트 */}
            {chartData.length > 1 && (
                <div className="bg-white border border-gray-200 p-2">
                    <h4 className="text-xs font-bold text-[#081429] mb-2 flex items-center gap-1">
                        <TrendingUp size={12} className="text-blue-500" />
                        성적 추이
                    </h4>
                    <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 8 }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#e5e7eb' }}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={{ fontSize: 8 }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#e5e7eb' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#081429',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        fontSize: '10px',
                                    }}
                                    formatter={(value: number) => [`${value.toFixed(1)}%`, '점수']}
                                />
                                <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="5 5" />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#6366f1"
                                    strokeWidth={1.5}
                                    dot={{ fill: '#6366f1', strokeWidth: 1, r: 2 }}
                                    activeDot={{ r: 4, fill: '#4f46e5' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* 성적 목록 */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                {/* 헤더 */}
                <div className="px-2 py-1.5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#081429] flex items-center gap-1">
                            <BookOpen size={12} className="text-indigo-500" />
                            시험별 성적
                            {allScores.length > 0 && (
                                <span className="text-xxs font-normal text-gray-400">
                                    ({scores.length}/{allScores.length})
                                </span>
                            )}
                        </h4>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xxs transition-colors ${
                                showFilters || activeFilterCount > 0
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            <Filter size={10} />
                            필터
                            {activeFilterCount > 0 && (
                                <span className="bg-indigo-600 text-white px-1 rounded-full text-micro font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* 검색 및 필터 */}
                    {showFilters && (
                        <div className="space-y-1.5 pt-1.5">
                            {/* 필터 옵션 */}
                            <div className="flex flex-wrap gap-1">
                                {/* 과목 필터 */}
                                <select
                                    value={subjectFilter}
                                    onChange={(e) => setSubjectFilter(e.target.value as any)}
                                    className="text-xxs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                >
                                    <option value="all">전체 과목</option>
                                    <option value="math">수학</option>
                                    <option value="english">영어</option>
                                </select>

                                {/* 시험 유형 필터 */}
                                <select
                                    value={examTypeFilter}
                                    onChange={(e) => setExamTypeFilter(e.target.value)}
                                    className="text-xxs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                >
                                    <option value="all">전체 유형</option>
                                    <option value="mock">모의고사</option>
                                    <option value="weekly">주간테스트</option>
                                    <option value="school">학교시험</option>
                                </select>

                                {/* 필터 초기화 */}
                                {activeFilterCount > 0 && (
                                    <button
                                        onClick={() => {
                                            setSubjectFilter('all');
                                            setExamTypeFilter('all');
                                            setSearchQuery('');
                                        }}
                                        className="text-xxs text-red-500 hover:text-red-600 px-1.5 py-0.5 hover:bg-red-50 rounded transition-colors"
                                    >
                                        초기화
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 테이블 헤더 */}
                <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-[#373d41]">
                    <span className="w-16 shrink-0">날짜</span>
                    <span className="w-8 shrink-0">과목</span>
                    <span className="flex-1">시험명</span>
                    <span className="w-14 shrink-0 text-center">점수</span>
                    <span className="w-8 shrink-0 text-center">등급</span>
                    <span className="w-5 shrink-0"></span>
                </div>

                {scores.length === 0 ? (
                    <div className="p-4 text-center">
                        <div className="w-8 h-8 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                            {activeFilterCount > 0 ? (
                                <Search className="w-4 h-4 text-gray-400" />
                            ) : (
                                <GraduationCap className="w-4 h-4 text-gray-400" />
                            )}
                        </div>
                        {activeFilterCount > 0 ? (
                            <>
                                <p className="text-gray-500 text-xs">검색 결과가 없습니다</p>
                                <button
                                    onClick={() => {
                                        setSubjectFilter('all');
                                        setExamTypeFilter('all');
                                        setSearchQuery('');
                                    }}
                                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    필터 초기화
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-gray-500 text-xs">등록된 성적이 없습니다</p>
                                <button
                                    onClick={() => setIsAddingScore(true)}
                                    className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    + 첫 성적 입력하기
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div>
                        {scores.map((score) => {
                            const gradeColor = score.grade ? GRADE_COLORS[score.grade] : null;
                            const exam = exams.find(e => e.id === score.examId);
                            const examDate = exam?.date || '-';

                            return (
                                <div
                                    key={score.id}
                                    className="flex items-center gap-2 px-2 py-1 border-b border-gray-100 hover:bg-[#fdb813]/5 transition-colors group"
                                >
                                    {/* 날짜 */}
                                    <span className="text-xxs text-[#373d41] w-16 shrink-0">
                                        {examDate}
                                    </span>

                                    {/* 과목 */}
                                    <span className={`w-8 shrink-0 px-1 py-0.5 rounded text-micro font-medium text-center ${
                                        score.subject === 'math'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-purple-100 text-purple-700'
                                    }`}>
                                        {score.subject === 'math' ? '수' : '영'}
                                    </span>

                                    {/* 시험명 */}
                                    <span className="flex-1 text-xs text-[#081429] truncate">
                                        {score.examTitle || '시험'}
                                    </span>

                                    {/* 점수 */}
                                    <span className="w-14 shrink-0 text-center">
                                        <span className="text-xs font-bold text-[#081429]">
                                            {score.percentage?.toFixed(0)}%
                                        </span>
                                    </span>

                                    {/* 등급 */}
                                    <span className="w-8 shrink-0 text-center">
                                        {gradeColor ? (
                                            <span className={`text-micro px-1 py-0.5 rounded font-bold ${gradeColor.bg} ${gradeColor.text}`}>
                                                {score.grade}
                                            </span>
                                        ) : (
                                            <span className="text-micro text-gray-400">-</span>
                                        )}
                                    </span>

                                    {/* 삭제 버튼 */}
                                    <button
                                        onClick={() => handleDeleteScore(score.id)}
                                        className="w-5 shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 성적 입력 모달 - 공통 컴포넌트 사용 */}
            {isAddingScore && (
                <AddScoreModal
                    onClose={() => setIsAddingScore(false)}
                    studentId={student.id}
                    studentName={student.name}
                />
            )}
        </div>
    );
};

export default GradesTab;
