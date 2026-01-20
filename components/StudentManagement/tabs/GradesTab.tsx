import React, { useState, useMemo } from 'react';
import { UnifiedStudent, StudentScore, GRADE_COLORS, calculateGrade, LevelTest, GoalSetting, GradeComment, COMMENT_CATEGORY_LABELS, GradeCommentCategory } from '../../../types';
import { useStudentScores, useDeleteScore, calculateScoreStats } from '../../../hooks/useStudentGrades';
import { useExams } from '../../../hooks/useExams';
import {
    GraduationCap, TrendingUp, TrendingDown, Minus, Plus, Trash2, ChevronDown,
    Award, BarChart3, Calendar, BookOpen, Loader2, AlertCircle, Search, X, Filter,
    Target, Zap, CheckCircle, XCircle, MessageSquare, Edit2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import AddScoreModal from '../../Grades/AddScoreModal';
import {
    useLevelTests, useAddLevelTest, useDeleteLevelTest,
    useGoalSettings, useAddGoalSetting, useUpdateGoalAchievement, useDeleteGoalSetting,
    useLatestComments, useAddGradeComment, useUpdateGradeComment, useDeleteGradeComment,
    determineLevel, getCurrentPeriod
} from '../../../hooks/useGradeProfile';

interface GradesTabProps {
    student: UnifiedStudent;
    readOnly?: boolean; // true일 때 모든 입력/수정/삭제 버튼 숨김
}

const GradesTab: React.FC<GradesTabProps> = ({ student, readOnly = false }) => {
    const [subjectFilter, setSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
    const [isAddingScore, setIsAddingScore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [examTypeFilter, setExamTypeFilter] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [isAddingLevelTest, setIsAddingLevelTest] = useState(false);
    const [isAddingGoal, setIsAddingGoal] = useState(false);
    const [showLevelTests, setShowLevelTests] = useState(true);
    const [showGoals, setShowGoals] = useState(true);
    const [showComments, setShowComments] = useState(true);
    const [isAddingComment, setIsAddingComment] = useState(false);
    const [editingComment, setEditingComment] = useState<GradeComment | null>(null);

    // Data fetching - 전체 성적을 가져온 후 클라이언트에서 필터링
    const { data: allScores = [], isLoading: loadingScores } = useStudentScores(student.id);
    const { data: exams = [] } = useExams();
    const { data: levelTests = [] } = useLevelTests(student.id);
    const { data: goalSettings = [] } = useGoalSettings(student.id);
    const latestCommentsObj = useLatestComments(student.id);

    // latestCommentsObj는 객체이므로 배열로 변환
    const latestComments = useMemo(() => {
        return Object.values(latestCommentsObj || {}).filter(Boolean) as GradeComment[];
    }, [latestCommentsObj]);

    // Mutations
    const deleteScore = useDeleteScore();
    const addLevelTest = useAddLevelTest();
    const deleteLevelTest = useDeleteLevelTest();
    const addGoalSetting = useAddGoalSetting();
    const updateGoalAchievement = useUpdateGoalAchievement();
    const deleteGoalSetting = useDeleteGoalSetting();
    const addGradeComment = useAddGradeComment();
    const updateGradeComment = useUpdateGradeComment();
    const deleteGradeComment = useDeleteGradeComment();

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

    // 추가 KPI 계산
    const kpiStats = useMemo(() => {
        if (scores.length === 0) return null;

        // 목표 달성률
        const achievedGoals = goalSettings.filter(g => g.achieved).length;
        const goalAchievementRate = goalSettings.length > 0 ? (achievedGoals / goalSettings.length) * 100 : 0;

        // 최근 3개 시험 평균
        const recent3 = scores.slice(0, 3);
        const recent3Avg = recent3.length > 0
            ? recent3.reduce((sum, s) => sum + (s.percentage || 0), 0) / recent3.length
            : 0;

        // 성적 향상도 (최근 3개 vs 이전 3개)
        const previous3 = scores.slice(3, 6);
        const previous3Avg = previous3.length > 0
            ? previous3.reduce((sum, s) => sum + (s.percentage || 0), 0) / previous3.length
            : recent3Avg;
        const improvement = recent3Avg - previous3Avg;

        // 과목별 평균
        const mathScores = scores.filter(s => s.subject === 'math');
        const englishScores = scores.filter(s => s.subject === 'english');
        const mathAvg = mathScores.length > 0
            ? mathScores.reduce((sum, s) => sum + (s.percentage || 0), 0) / mathScores.length
            : 0;
        const englishAvg = englishScores.length > 0
            ? englishScores.reduce((sum, s) => sum + (s.percentage || 0), 0) / englishScores.length
            : 0;

        // 안정성 (표준편차)
        const mean = stats.averagePercentage;
        const variance = scores.reduce((sum, s) => sum + Math.pow((s.percentage || 0) - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        const stability = 100 - Math.min(stdDev, 100); // 100에 가까울수록 안정적

        return {
            goalAchievementRate,
            recent3Avg,
            improvement,
            mathAvg,
            englishAvg,
            stability,
        };
    }, [scores, goalSettings, stats.averagePercentage]);

    // Phase 4: 자동 인사이트 생성
    const insights = useMemo(() => {
        if (!kpiStats || scores.length < 3) return [];

        const result: Array<{ type: 'success' | 'warning' | 'danger' | 'info'; message: string; icon: string }> = [];

        // 1. 성적 향상 인사이트
        if (kpiStats.improvement > 5) {
            result.push({
                type: 'success',
                message: `최근 성적이 ${kpiStats.improvement.toFixed(1)}%p 상승했습니다. 학습 노력이 결실을 맺고 있습니다! 🎉`,
                icon: '📈'
            });
        } else if (kpiStats.improvement < -5) {
            result.push({
                type: 'danger',
                message: `최근 성적이 ${Math.abs(kpiStats.improvement).toFixed(1)}%p 하락했습니다. 학습 방법 점검이 필요합니다.`,
                icon: '⚠️'
            });
        }

        // 2. 목표 달성률 인사이트
        if (goalSettings.length > 0) {
            if (kpiStats.goalAchievementRate >= 80) {
                result.push({
                    type: 'success',
                    message: `목표 달성률 ${kpiStats.goalAchievementRate.toFixed(0)}% - 목표를 잘 달성하고 있습니다!`,
                    icon: '🎯'
                });
            } else if (kpiStats.goalAchievementRate < 50) {
                result.push({
                    type: 'warning',
                    message: `목표 달성률이 ${kpiStats.goalAchievementRate.toFixed(0)}%로 낮습니다. 현실적인 목표 재설정을 고려하세요.`,
                    icon: '🔄'
                });
            }
        }

        // 3. 성적 안정성 인사이트
        if (kpiStats.stability < 60) {
            result.push({
                type: 'warning',
                message: '성적 편차가 큽니다. 일관된 학습 패턴 유지가 필요합니다.',
                icon: '📊'
            });
        } else if (kpiStats.stability >= 80) {
            result.push({
                type: 'info',
                message: '성적이 안정적으로 유지되고 있습니다.',
                icon: '✅'
            });
        }

        // 4. 과목별 격차 인사이트
        if (kpiStats.mathAvg > 0 && kpiStats.englishAvg > 0) {
            const gap = Math.abs(kpiStats.mathAvg - kpiStats.englishAvg);
            if (gap > 15) {
                const weaker = kpiStats.mathAvg > kpiStats.englishAvg ? '영어' : '수학';
                result.push({
                    type: 'info',
                    message: `${weaker} 과목에 더 집중이 필요합니다. (과목 간 점수 차이: ${gap.toFixed(1)}%p)`,
                    icon: '📚'
                });
            }
        }

        // 5. 레벨테스트 기반 인사이트
        if (levelTests.length > 0) {
            const latestTest = levelTests[0];
            if (latestTest.percentage < 60) {
                result.push({
                    type: 'warning',
                    message: `최근 레벨테스트 점수가 ${latestTest.percentage.toFixed(0)}%입니다. 기초 보강이 필요합니다.`,
                    icon: '📝'
                });
            }
        }

        // 6. 최근 성적 위험 신호
        const recent3Scores = scores.slice(0, 3);
        if (recent3Scores.length === 3) {
            const allBelow70 = recent3Scores.every(s => (s.percentage || 0) < 70);
            if (allBelow70) {
                result.push({
                    type: 'danger',
                    message: '최근 3회 시험이 모두 70% 미만입니다. 긴급 학습 대책이 필요합니다!',
                    icon: '🚨'
                });
            }
        }

        return result.slice(0, 3); // 최대 3개만 표시
    }, [kpiStats, scores, goalSettings, levelTests]);

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
            {/* 레벨테스트 섹션 */}
            <div className="bg-white border border-indigo-200">
                <div
                    className="flex items-center justify-between px-2 py-1.5 bg-indigo-50 cursor-pointer"
                    onClick={() => setShowLevelTests(!showLevelTests)}
                >
                    <div className="flex items-center gap-1.5">
                        <Zap size={12} className="text-indigo-600" />
                        <h4 className="text-xs font-bold text-[#081429]">레벨테스트</h4>
                        <span className="text-xxs text-gray-500">({levelTests.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddingLevelTest(true);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-600 text-white rounded text-xxs hover:bg-indigo-700 transition-colors"
                            >
                                <Plus size={10} />
                                추가
                            </button>
                        )}
                        <ChevronDown
                            size={14}
                            className={`text-gray-400 transition-transform ${showLevelTests ? '' : '-rotate-90'}`}
                        />
                    </div>
                </div>

                {showLevelTests && (
                    <div className="p-2">
                        {levelTests.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-2">등록된 레벨테스트가 없습니다</p>
                        ) : (
                            <div className="space-y-1.5">
                                {levelTests.slice(0, 3).map((test) => (
                                    <div
                                        key={test.id}
                                        className="flex items-center gap-2 p-1.5 bg-gray-50 rounded hover:bg-indigo-50 transition-colors group"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`px-1.5 py-0.5 rounded text-micro font-medium ${
                                                    test.subject === 'math'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {test.subject === 'math' ? '수학' : '영어'}
                                                </span>
                                                <span className="text-xxs text-gray-500">{test.testDate}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs font-bold text-[#081429]">
                                                    {test.percentage.toFixed(0)}%
                                                </span>
                                                <span className="text-xxs text-indigo-600 font-medium">
                                                    추천: {test.recommendedLevel}
                                                </span>
                                            </div>
                                        </div>
                                        {!readOnly && (
                                            <button
                                                onClick={() => {
                                                    if (confirm('이 레벨테스트를 삭제하시겠습니까?')) {
                                                        deleteLevelTest.mutateAsync(test.id);
                                                    }
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 목표 설정 섹션 */}
            <div className="bg-white border border-amber-200">
                <div
                    className="flex items-center justify-between px-2 py-1.5 bg-amber-50 cursor-pointer"
                    onClick={() => setShowGoals(!showGoals)}
                >
                    <div className="flex items-center gap-1.5">
                        <Target size={12} className="text-amber-600" />
                        <h4 className="text-xs font-bold text-[#081429]">시험 목표</h4>
                        <span className="text-xxs text-gray-500">({goalSettings.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddingGoal(true);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-600 text-white rounded text-xxs hover:bg-amber-700 transition-colors"
                            >
                                <Plus size={10} />
                                추가
                            </button>
                        )}
                        <ChevronDown
                            size={14}
                            className={`text-gray-400 transition-transform ${showGoals ? '' : '-rotate-90'}`}
                        />
                    </div>
                </div>

                {showGoals && (
                    <div className="p-2">
                        {goalSettings.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-2">설정된 목표가 없습니다</p>
                        ) : (
                            <div className="space-y-1.5">
                                {goalSettings.slice(0, 3).map((goal) => {
                                    const isAchieved = goal.achieved;
                                    const hasActual = goal.actualScore !== undefined;

                                    return (
                                        <div
                                            key={goal.id}
                                            className="flex items-center gap-2 p-1.5 bg-gray-50 rounded hover:bg-amber-50 transition-colors group"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-micro font-medium ${
                                                        goal.subject === 'math'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                        {goal.subject === 'math' ? '수학' : '영어'}
                                                    </span>
                                                    <span className="text-xxs text-gray-700 font-medium truncate">
                                                        {goal.examTitle}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xxs text-gray-500">
                                                        목표: {goal.targetPercentage.toFixed(0)}%
                                                    </span>
                                                    {hasActual && (
                                                        <>
                                                            <span className="text-xxs text-gray-400">→</span>
                                                            <span className={`text-xs font-bold ${
                                                                isAchieved ? 'text-emerald-600' : 'text-red-600'
                                                            }`}>
                                                                {goal.actualPercentage?.toFixed(0)}%
                                                            </span>
                                                            {isAchieved ? (
                                                                <CheckCircle size={12} className="text-emerald-500" />
                                                            ) : (
                                                                <XCircle size={12} className="text-red-500" />
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {!readOnly && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('이 목표를 삭제하시겠습니까?')) {
                                                            deleteGoalSetting.mutateAsync(goal.id);
                                                        }
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 학습 코멘트 섹션 */}
            <div className="bg-white border border-emerald-200">
                <div
                    className="flex items-center justify-between px-2 py-1.5 bg-emerald-50 cursor-pointer"
                    onClick={() => setShowComments(!showComments)}
                >
                    <div className="flex items-center gap-1.5">
                        <MessageSquare size={12} className="text-emerald-600" />
                        <h4 className="text-xs font-bold text-[#081429]">학습 코멘트</h4>
                        <span className="text-xxs text-gray-500">({latestComments.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddingComment(true);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-600 text-white rounded text-xxs hover:bg-emerald-700 transition-colors"
                            >
                                <Plus size={10} />
                                추가
                            </button>
                        )}
                        <ChevronDown
                            size={14}
                            className={`text-gray-400 transition-transform ${showComments ? '' : '-rotate-90'}`}
                        />
                    </div>
                </div>

                {showComments && (
                    <div className="p-2">
                        {latestComments.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-2">등록된 코멘트가 없습니다</p>
                        ) : (
                            <div className="space-y-1.5">
                                {latestComments.map((comment) => {
                                    const categoryInfo = COMMENT_CATEGORY_LABELS[comment.category];
                                    const colorClass = `bg-${categoryInfo.color}-50 border-${categoryInfo.color}-200`;
                                    const textColorClass = `text-${categoryInfo.color}-700`;

                                    return (
                                        <div
                                            key={comment.id}
                                            className={`p-1.5 rounded border hover:shadow-sm transition-all group ${colorClass}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-micro">{categoryInfo.icon}</span>
                                                        <span className={`text-xxs font-bold ${textColorClass}`}>
                                                            {categoryInfo.label}
                                                        </span>
                                                        {comment.subject && comment.subject !== 'all' && (
                                                            <span className={`px-1 py-0.5 rounded text-micro font-medium ${
                                                                comment.subject === 'math'
                                                                    ? 'bg-blue-100 text-blue-700'
                                                                    : 'bg-purple-100 text-purple-700'
                                                            }`}>
                                                                {comment.subject === 'math' ? '수' : '영'}
                                                            </span>
                                                        )}
                                                        <span className="text-xxs text-gray-400">{comment.period}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-700 leading-relaxed break-words whitespace-pre-wrap">
                                                        {comment.content}
                                                    </p>
                                                </div>
                                                {!readOnly && (
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                        <button
                                                            onClick={() => setEditingComment(comment)}
                                                            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                                                        >
                                                            <Edit2 size={11} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('이 코멘트를 삭제하시겠습니까?')) {
                                                                    deleteGradeComment.mutateAsync(comment.id);
                                                                }
                                                            }}
                                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                        >
                                                            <Trash2 size={11} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* KPI 대시보드 */}
            {/* 성적 추가 버튼을 KPI 대시보드 우측 상단에 배치 */}
            {stats.totalExams > 0 && kpiStats && (
                <div className="space-y-2">
                    {/* 주요 KPI 카드 (2행) */}
                    <div className="grid grid-cols-4 gap-2">
                        {/* 평균 점수 */}
                        <div className="bg-blue-50 p-2 border border-blue-100 rounded">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-micro font-medium text-blue-600">전체 평균</span>
                                <BarChart3 size={10} className="text-blue-400" />
                            </div>
                            <div className="text-sm font-bold text-[#081429]">
                                {stats.averagePercentage.toFixed(1)}%
                            </div>
                            <div className="text-xxs text-blue-600 mt-0.5">
                                {calculateGrade(stats.averagePercentage)} 등급
                            </div>
                        </div>

                        {/* 최근 3개 평균 */}
                        <div className="bg-indigo-50 p-2 border border-indigo-100 rounded">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-micro font-medium text-indigo-600">최근 평균</span>
                                <TrendingUp size={10} className="text-indigo-400" />
                            </div>
                            <div className="text-sm font-bold text-[#081429]">
                                {kpiStats.recent3Avg.toFixed(1)}%
                            </div>
                            <div className={`text-xxs mt-0.5 flex items-center gap-0.5 ${
                                kpiStats.improvement > 0 ? 'text-emerald-600' : kpiStats.improvement < 0 ? 'text-red-600' : 'text-gray-500'
                            }`}>
                                {kpiStats.improvement > 0 ? '↑' : kpiStats.improvement < 0 ? '↓' : '→'}
                                {Math.abs(kpiStats.improvement).toFixed(1)}%p
                            </div>
                        </div>

                        {/* 목표 달성률 */}
                        <div className="bg-amber-50 p-2 border border-amber-100 rounded">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-micro font-medium text-amber-600">목표 달성</span>
                                <Target size={10} className="text-amber-400" />
                            </div>
                            <div className="text-sm font-bold text-[#081429]">
                                {kpiStats.goalAchievementRate.toFixed(0)}%
                            </div>
                            <div className="text-xxs text-amber-600 mt-0.5">
                                {goalSettings.filter(g => g.achieved).length}/{goalSettings.length}
                            </div>
                        </div>

                        {/* 성적 안정성 */}
                        <div className="bg-emerald-50 p-2 border border-emerald-100 rounded">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-micro font-medium text-emerald-600">안정성</span>
                                <Award size={10} className="text-emerald-400" />
                            </div>
                            <div className="text-sm font-bold text-[#081429]">
                                {kpiStats.stability.toFixed(0)}%
                            </div>
                            <div className="text-xxs text-emerald-600 mt-0.5">
                                {kpiStats.stability >= 80 ? '매우 안정' : kpiStats.stability >= 60 ? '안정' : '변동'}
                            </div>
                        </div>
                    </div>

                    {/* 과목별 통계 */}
                    {(kpiStats.mathAvg > 0 || kpiStats.englishAvg > 0) && (
                        <div className="grid grid-cols-2 gap-2">
                            {/* 수학 평균 */}
                            {kpiStats.mathAvg > 0 && (
                                <div className="bg-blue-50 p-2 border border-blue-100 rounded">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-micro font-medium text-blue-600">수학 평균</span>
                                        <BookOpen size={10} className="text-blue-400" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-bold text-[#081429]">
                                            {kpiStats.mathAvg.toFixed(1)}%
                                        </div>
                                        <div className="text-xxs text-blue-600">
                                            {calculateGrade(kpiStats.mathAvg)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 영어 평균 */}
                            {kpiStats.englishAvg > 0 && (
                                <div className="bg-purple-50 p-2 border border-purple-100 rounded">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-micro font-medium text-purple-600">영어 평균</span>
                                        <BookOpen size={10} className="text-purple-400" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-bold text-[#081429]">
                                            {kpiStats.englishAvg.toFixed(1)}%
                                        </div>
                                        <div className="text-xxs text-purple-600">
                                            {calculateGrade(kpiStats.englishAvg)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Phase 4: 자동 인사이트 */}
                    {insights.length > 0 && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded p-2">
                            <h5 className="text-xs font-bold text-[#081429] mb-1.5 flex items-center gap-1">
                                <AlertCircle size={12} className="text-blue-600" />
                                AI 학습 인사이트
                            </h5>
                            <div className="space-y-1">
                                {insights.map((insight, idx) => {
                                    const colors = {
                                        success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                                        warning: 'bg-amber-50 border-amber-200 text-amber-700',
                                        danger: 'bg-red-50 border-red-200 text-red-700',
                                        info: 'bg-blue-50 border-blue-200 text-blue-700'
                                    };

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-start gap-1.5 p-1.5 rounded border ${colors[insight.type]}`}
                                        >
                                            <span className="text-sm shrink-0">{insight.icon}</span>
                                            <p className="text-xs leading-relaxed flex-1">{insight.message}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-[#081429] flex items-center gap-1">
                            <BookOpen size={12} className="text-indigo-500" />
                            시험별 성적
                            {allScores.length > 0 && scores.length !== allScores.length && (
                                <span className="text-xxs font-normal text-gray-400">
                                    ({scores.length}/{allScores.length})
                                </span>
                            )}
                        </h4>
                        <div className="flex items-center gap-1">
                            {!readOnly && (
                                <button
                                    onClick={() => setIsAddingScore(true)}
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#081429] text-white rounded text-micro font-medium hover:bg-[#0f2847] transition-colors"
                                >
                                    <Plus size={10} />
                                    입력
                                </button>
                            )}
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-micro transition-colors ${
                                    activeFilterCount > 0
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                <Filter size={9} />
                                {activeFilterCount > 0 && (
                                    <span className="font-bold">{activeFilterCount}</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* 필터 옵션 - 컴팩트 */}
                    {showFilters && (
                        <div className="flex items-center gap-1 pb-1">
                            <select
                                value={subjectFilter}
                                onChange={(e) => setSubjectFilter(e.target.value as any)}
                                className="text-micro border border-gray-200 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none flex-1"
                            >
                                <option value="all">전체</option>
                                <option value="math">수학</option>
                                <option value="english">영어</option>
                            </select>

                            <select
                                value={examTypeFilter}
                                onChange={(e) => setExamTypeFilter(e.target.value)}
                                className="text-micro border border-gray-200 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none flex-1"
                            >
                                <option value="all">전체 유형</option>
                                <option value="mock">모의고사</option>
                                <option value="weekly">주간테스트</option>
                                <option value="school">학교시험</option>
                            </select>

                            {activeFilterCount > 0 && (
                                <button
                                    onClick={() => {
                                        setSubjectFilter('all');
                                        setExamTypeFilter('all');
                                        setSearchQuery('');
                                    }}
                                    className="text-micro text-red-500 hover:text-red-600 px-1 py-0.5 hover:bg-red-50 rounded transition-colors shrink-0"
                                >
                                    <X size={10} />
                                </button>
                            )}
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
                                {!readOnly && (
                                    <button
                                        onClick={() => setIsAddingScore(true)}
                                        className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        + 첫 성적 입력하기
                                    </button>
                                )}
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
                                    {!readOnly && (
                                        <button
                                            onClick={() => handleDeleteScore(score.id)}
                                            className="w-5 shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 레벨테스트 추가 모달 */}
            {!readOnly && isAddingLevelTest && (
                <LevelTestModal
                    onClose={() => setIsAddingLevelTest(false)}
                    studentId={student.id}
                    studentName={student.name}
                    onAdd={addLevelTest.mutateAsync}
                />
            )}

            {/* 목표 설정 추가 모달 */}
            {!readOnly && isAddingGoal && (
                <GoalSettingModal
                    onClose={() => setIsAddingGoal(false)}
                    studentId={student.id}
                    studentName={student.name}
                    onAdd={addGoalSetting.mutateAsync}
                    exams={exams}
                />
            )}

            {/* 코멘트 추가/수정 모달 */}
            {!readOnly && (isAddingComment || editingComment) && (
                <CommentModal
                    onClose={() => {
                        setIsAddingComment(false);
                        setEditingComment(null);
                    }}
                    studentId={student.id}
                    studentName={student.name}
                    onAdd={addGradeComment.mutateAsync}
                    onUpdate={updateGradeComment.mutateAsync}
                    editingComment={editingComment}
                />
            )}

            {/* 성적 입력 모달 - 공통 컴포넌트 사용 */}
            {!readOnly && isAddingScore && (
                <AddScoreModal
                    onClose={() => setIsAddingScore(false)}
                    studentId={student.id}
                    studentName={student.name}
                    hideCreateExam={true}
                />
            )}
        </div>
    );
};

// 레벨테스트 추가 모달
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

// 목표 설정 모달
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

// 코멘트 추가/수정 모달
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg p-4 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-[#081429] mb-3 flex items-center gap-2">
                    <MessageSquare size={16} className="text-emerald-600" />
                    {editingComment ? '코멘트 수정' : '코멘트 추가'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">카테고리</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as GradeCommentCategory)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                                {Object.entries(COMMENT_CATEGORY_LABELS).map(([key, info]) => (
                                    <option key={key} value={key}>
                                        {info.icon} {info.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">과목</label>
                            <select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value as any)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                                <option value="all">전체</option>
                                <option value="math">수학</option>
                                <option value="english">영어</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            코멘트 내용
                            <span className="text-gray-400 ml-1">({content.length}자)</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={`예: ${category === 'strength' ? '이해력이 뛰어나고 응용력이 우수함' : category === 'improvement' ? '계산 실수를 줄이기 위한 검산 습관 필요' : category === 'effort' ? '매일 오답노트 작성하며 꾸준히 노력함' : category === 'potential' ? '고난도 문제 해결 능력 향상 필요' : '전반적으로 학습 태도가 우수함'}`}
                            className="w-full px-2 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[100px] resize-y"
                            required
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="shareWithParent"
                            checked={isSharedWithParent}
                            onChange={(e) => setIsSharedWithParent(e.target.checked)}
                            className="w-3.5 h-3.5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                        />
                        <label htmlFor="shareWithParent" className="text-xs text-gray-700 cursor-pointer">
                            학부모와 공유
                        </label>
                    </div>

                    {/* 미리보기 */}
                    {content.trim() && (
                        <div className={`p-2 rounded border bg-${categoryInfo.color}-50 border-${categoryInfo.color}-200`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-micro">{categoryInfo.icon}</span>
                                <span className={`text-xxs font-bold text-${categoryInfo.color}-700`}>
                                    {categoryInfo.label}
                                </span>
                                {subject !== 'all' && (
                                    <span className={`px-1 py-0.5 rounded text-micro font-medium ${
                                        subject === 'math' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
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
                            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !content.trim()}
                            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
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

export default GradesTab;
