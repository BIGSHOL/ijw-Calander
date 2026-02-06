import React, { useState, useMemo } from 'react';
import { UnifiedStudent, StudentScore, GRADE_COLORS, calculateGrade, UserProfile } from '../../../types';
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
    useStudentConsultationLevelTests,
    useGoalSettings, useAddGoalSetting, useUpdateGoalAchievement, useDeleteGoalSetting,
    useLatestComments, useAddGradeComment, useUpdateGradeComment, useDeleteGradeComment
} from '../../../hooks/useGradeProfile';
import LevelTestModal from './grades/LevelTestModal';
import GoalSettingModal from './grades/GoalSettingModal';
import CommentModal from './grades/CommentModal';

interface GradesTabProps {
    student: UnifiedStudent;
    readOnly?: boolean; // true일 때 모든 입력/수정/삭제 버튼 숨김
    currentUser?: UserProfile | null; // 시뮬레이션 지원
}

const GradesTab: React.FC<GradesTabProps> = ({ student, readOnly = false, currentUser }) => {
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
    const [editingComment, setEditingComment] = useState<any>(null);

    // Data fetching - 전체 성적을 가져온 후 클라이언트에서 필터링
    const { data: allScores = [], isLoading: loadingScores } = useStudentScores(student.id);
    const { data: exams = [] } = useExams();
    const { data: directLevelTests = [] } = useLevelTests(student.id);
    const { data: consultationLevelTests = [] } = useStudentConsultationLevelTests(student.id);

    // 상담 레벨테스트와 직접 등록 레벨테스트 합치기 (상담 것 먼저)
    const levelTests = useMemo(() => {
        return [...consultationLevelTests, ...directLevelTests];
    }, [consultationLevelTests, directLevelTests]);

    const { data: goalSettings = [] } = useGoalSettings(student.id);
    const latestCommentsObj = useLatestComments(student.id);

    // latestCommentsObj는 객체이므로 배열로 변환
    const latestComments = useMemo(() => {
        return Object.values(latestCommentsObj || {}).filter(Boolean) as any[];
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
            if (latestTest.percentage != null && latestTest.percentage < 60) {
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
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* 레벨테스트 섹션 */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div
                    className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
                    onClick={() => setShowLevelTests(!showLevelTests)}
                >
                    <div className="flex items-center gap-1.5">
                        <Zap size={12} className="text-primary" />
                        <h4 className="text-xs font-bold text-primary">레벨테스트</h4>
                        <span className="text-xxs text-gray-500">({levelTests.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddingLevelTest(true);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 bg-primary text-white rounded-sm text-xxs hover:bg-[#1a2845] transition-colors"
                            >
                                <Plus size={10} />
                                추가
                            </button>
                        )}
                        <ChevronDown
                            size={14}
                            className={`text-gray-400 transition-transform ${showLevelTests ? '' : 'rotate-180'}`}
                        />
                    </div>
                </div>

                {showLevelTests && (
                    <div className="p-2">
                        {levelTests.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-2">등록된 레벨테스트가 없습니다</p>
                        ) : (
                            <div className="space-y-1.5">
                                {levelTests.slice(0, 10).map((test) => {
                                    const isMath = test.subject === 'math';
                                    const hasMathDetail = isMath && (test.calculationScore || test.myTotalScore);
                                    const hasEngDetail = !isMath && test.englishTestType;
                                    const engTestLabel = test.englishTestType === 'ai' ? 'AI' : test.englishTestType === 'nelt' ? 'NELT' : test.englishTestType === 'eie' ? 'EiE' : '';
                                    const isFromConsultation = '_sourceConsultationId' in test;

                                    return (
                                        <div key={test.id} className="p-1.5 bg-gray-50 rounded-sm hover:bg-accent/10 transition-colors group">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded-sm text-micro font-medium ${isMath ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {isMath ? '수학' : '영어'}
                                                    </span>
                                                    {hasEngDetail && (
                                                        <span className="px-1 py-0.5 rounded-sm text-micro font-medium bg-indigo-100 text-indigo-700">{engTestLabel}</span>
                                                    )}
                                                    {isFromConsultation && (
                                                        <span className="px-1 py-0.5 rounded-sm text-micro font-medium bg-amber-100 text-amber-700">상담</span>
                                                    )}
                                                    <span className="text-xxs text-gray-500">{test.testDate}</span>
                                                </div>
                                                {!readOnly && !isFromConsultation && (
                                                    <button
                                                        onClick={() => { if (confirm('이 레벨테스트를 삭제하시겠습니까?')) deleteLevelTest.mutateAsync({ id: test.id, studentId: student.id }); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            {/* 수학 세분화 표시 */}
                                            {hasMathDetail && (
                                                <div className="mt-1 border border-emerald-100 rounded overflow-hidden text-xxs">
                                                    <div className="grid grid-cols-4 bg-emerald-50/50">
                                                        {[
                                                            { label: '계산', val: test.calculationScore },
                                                            { label: '이해', val: test.comprehensionScore },
                                                            { label: '추론', val: test.reasoningScore },
                                                            { label: '문제해결', val: test.problemSolvingScore },
                                                        ].map((item, i) => (
                                                            <div key={item.label} className={`px-1 py-0.5 text-center ${i < 3 ? 'border-r border-emerald-100' : ''}`}>
                                                                <div className="text-emerald-600 font-medium">{item.label}</div>
                                                                <div className="font-bold text-gray-800">{item.val || '-'}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-3 border-t border-emerald-100">
                                                        <div className="px-1 py-0.5 text-center"><span className="text-slate-500">내점수</span> <span className="font-bold">{test.myTotalScore || '-'}</span></div>
                                                        <div className="px-1 py-0.5 text-center border-x border-emerald-100"><span className="text-slate-500">평균</span> <span className="font-bold">{test.averageScore || '-'}</span></div>
                                                        <div className="px-1 py-0.5 text-center"><span className="text-slate-500">등급</span> <span className="font-bold">{test.scoreGrade || '-'}</span></div>
                                                    </div>
                                                </div>
                                            )}
                                            {/* 영어 세분화 표시 */}
                                            {hasEngDetail && (
                                                <div className="mt-1 text-xxs">
                                                    {test.engLevel && <span className="text-xs font-bold text-blue-700 mr-2">Lv {test.engLevel}</span>}
                                                    {test.englishTestType === 'ai' && (
                                                        <span className="text-gray-600">
                                                            {test.engAiGradeLevel && `${test.engAiGradeLevel}수준`}
                                                            {test.engAiArIndex && ` AR:${test.engAiArIndex}`}
                                                            {test.engAiTopPercent && ` 상위${test.engAiTopPercent}`}
                                                        </span>
                                                    )}
                                                    {test.englishTestType === 'nelt' && (
                                                        <span className="text-gray-600">
                                                            {test.engNeltOverallLevel && `${test.engNeltOverallLevel}`}
                                                            {test.engNeltRank && ` 석차:${test.engNeltRank}`}
                                                        </span>
                                                    )}
                                                    {test.englishTestType === 'eie' && (
                                                        <span className="text-gray-600">
                                                            {test.engEieGradeLevel && `${test.engEieGradeLevel}수준`}
                                                            {test.engEieRank && ` 순위:${test.engEieRank}`}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {/* 기존 호환 (percentage 기반) */}
                                            {!hasMathDetail && !hasEngDetail && test.percentage != null && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs font-bold text-primary">{test.percentage.toFixed(0)}%</span>
                                                    {test.recommendedLevel && <span className="text-xxs text-indigo-600 font-medium">추천: {test.recommendedLevel}</span>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 목표 설정 섹션 */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div
                    className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
                    onClick={() => setShowGoals(!showGoals)}
                >
                    <div className="flex items-center gap-1.5">
                        <Target size={12} className="text-primary" />
                        <h4 className="text-xs font-bold text-primary">시험 목표</h4>
                        <span className="text-xxs text-gray-500">({goalSettings.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddingGoal(true);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 bg-primary text-white rounded-sm text-xxs hover:bg-[#1a2845] transition-colors"
                            >
                                <Plus size={10} />
                                추가
                            </button>
                        )}
                        <ChevronDown
                            size={14}
                            className={`text-gray-400 transition-transform ${showGoals ? '' : 'rotate-180'}`}
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
                                            className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-sm hover:bg-accent/10 transition-colors group"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded-sm text-micro font-medium ${
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
                                                            deleteGoalSetting.mutateAsync({ id: goal.id, studentId: student.id });
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
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div
                    className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
                    onClick={() => setShowComments(!showComments)}
                >
                    <div className="flex items-center gap-1.5">
                        <MessageSquare size={12} className="text-primary" />
                        <h4 className="text-xs font-bold text-primary">학습 코멘트</h4>
                        <span className="text-xxs text-gray-500">({latestComments.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddingComment(true);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 bg-primary text-white rounded-sm text-xxs hover:bg-[#1a2845] transition-colors"
                            >
                                <Plus size={10} />
                                추가
                            </button>
                        )}
                        <ChevronDown
                            size={14}
                            className={`text-gray-400 transition-transform ${showComments ? '' : 'rotate-180'}`}
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
                                    const categoryInfo = comment.category ? {
                                        label: comment.category,
                                        icon: '📝',
                                        color: 'gray'
                                    } : { label: '기타', icon: '📝', color: 'gray' };

                                    const colorClass = `bg-${categoryInfo.color}-50 border-${categoryInfo.color}-200`;
                                    const textColorClass = `text-${categoryInfo.color}-700`;

                                    return (
                                        <div
                                            key={comment.id}
                                            className={`p-1.5 rounded-sm border hover:shadow-sm transition-all group ${colorClass}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-micro">{categoryInfo.icon}</span>
                                                        <span className={`text-xxs font-bold ${textColorClass}`}>
                                                            {categoryInfo.label}
                                                        </span>
                                                        {comment.subject && comment.subject !== 'all' && (
                                                            <span className={`px-1 py-0.5 rounded-sm text-micro font-medium ${
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
                                                            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-sm transition-all"
                                                        >
                                                            <Edit2 size={11} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('이 코멘트를 삭제하시겠습니까?')) {
                                                                    deleteGradeComment.mutateAsync({ id: comment.id, studentId: student.id });
                                                                }
                                                            }}
                                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-sm transition-all"
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
                        <div className="bg-blue-50 p-2 border border-blue-100 rounded-sm">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-micro font-medium text-blue-600">전체 평균</span>
                                <BarChart3 size={10} className="text-blue-400" />
                            </div>
                            <div className="text-sm font-bold text-primary">
                                {stats.averagePercentage.toFixed(1)}%
                            </div>
                            <div className="text-xxs text-blue-600 mt-0.5">
                                {calculateGrade(stats.averagePercentage)} 등급
                            </div>
                        </div>

                        {/* 최근 3개 평균 */}
                        <div className="bg-indigo-50 p-2 border border-indigo-100 rounded-sm">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-micro font-medium text-indigo-600">최근 평균</span>
                                <TrendingUp size={10} className="text-indigo-400" />
                            </div>
                            <div className="text-sm font-bold text-primary">
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
                        <div className="bg-amber-50 p-2 border border-amber-100 rounded-sm">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-micro font-medium text-amber-600">목표 달성</span>
                                <Target size={10} className="text-amber-400" />
                            </div>
                            <div className="text-sm font-bold text-primary">
                                {kpiStats.goalAchievementRate.toFixed(0)}%
                            </div>
                            <div className="text-xxs text-amber-600 mt-0.5">
                                {goalSettings.filter(g => g.achieved).length}/{goalSettings.length}
                            </div>
                        </div>

                        {/* 성적 안정성 */}
                        <div className="bg-emerald-50 p-2 border border-emerald-100 rounded-sm">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-micro font-medium text-emerald-600">안정성</span>
                                <Award size={10} className="text-emerald-400" />
                            </div>
                            <div className="text-sm font-bold text-primary">
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
                                <div className="bg-blue-50 p-2 border border-blue-100 rounded-sm">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-micro font-medium text-blue-600">수학 평균</span>
                                        <BookOpen size={10} className="text-blue-400" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-bold text-primary">
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
                                <div className="bg-purple-50 p-2 border border-purple-100 rounded-sm">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-micro font-medium text-purple-600">영어 평균</span>
                                        <BookOpen size={10} className="text-purple-400" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-bold text-primary">
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
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-sm p-2">
                            <h5 className="text-xs font-bold text-primary mb-1.5 flex items-center gap-1">
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
                                            className={`flex items-start gap-1.5 p-1.5 rounded-sm border ${colors[insight.type]}`}
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
                    <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
                        <TrendingUp size={12} className="text-blue-500" />
                        성적 추이
                    </h4>
                    <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%" minHeight={112}>
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
                                        backgroundColor: 'rgb(8, 20, 41)' /* primary */,
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
                        <h4 className="text-xs font-bold text-primary flex items-center gap-1">
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
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary text-white rounded-sm text-micro font-medium hover:bg-[#0f2847] transition-colors"
                                >
                                    <Plus size={10} />
                                    입력
                                </button>
                            )}
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-0.5 px-1 py-0.5 rounded-sm text-micro transition-colors ${
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
                                className="text-micro border border-gray-200 rounded-sm px-1 py-0.5 bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none flex-1"
                            >
                                <option value="all">전체</option>
                                <option value="math">수학</option>
                                <option value="english">영어</option>
                            </select>

                            <select
                                value={examTypeFilter}
                                onChange={(e) => setExamTypeFilter(e.target.value)}
                                className="text-micro border border-gray-200 rounded-sm px-1 py-0.5 bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none flex-1"
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
                                    className="text-micro text-red-500 hover:text-red-600 px-1 py-0.5 hover:bg-red-50 rounded-sm transition-colors shrink-0"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* 테이블 헤더 */}
                <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-primary-700">
                    <span className="w-16 shrink-0">날짜</span>
                    <span className="w-8 shrink-0">과목</span>
                    <span className="flex-1">시험명</span>
                    <span className="w-14 shrink-0 text-center">점수</span>
                    <span className="w-8 shrink-0 text-center">등급</span>
                    <span className="w-5 shrink-0"></span>
                </div>

                {scores.length === 0 ? (
                    <div className="p-4 text-center">
                        <div className="w-8 h-8 mx-auto mb-2 bg-gray-100 rounded-sm flex items-center justify-center">
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
                                    className="flex items-center gap-2 px-2 py-1 border-b border-gray-100 hover:bg-accent/5 transition-colors group"
                                >
                                    {/* 날짜 */}
                                    <span className="text-xxs text-primary-700 w-16 shrink-0">
                                        {examDate}
                                    </span>

                                    {/* 과목 */}
                                    <span className={`w-8 shrink-0 px-1 py-0.5 rounded-sm text-micro font-medium text-center ${
                                        score.subject === 'math'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-purple-100 text-purple-700'
                                    }`}>
                                        {score.subject === 'math' ? '수' : '영'}
                                    </span>

                                    {/* 시험명 */}
                                    <span className="flex-1 text-xs text-primary truncate">
                                        {score.examTitle || '시험'}
                                    </span>

                                    {/* 점수 */}
                                    <span className="w-14 shrink-0 text-center">
                                        <span className="text-xs font-bold text-primary">
                                            {score.percentage?.toFixed(0)}%
                                        </span>
                                    </span>

                                    {/* 등급 */}
                                    <span className="w-8 shrink-0 text-center">
                                        {gradeColor ? (
                                            <span className={`text-micro px-1 py-0.5 rounded-sm font-bold ${gradeColor.bg} ${gradeColor.text}`}>
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
                                            className="w-5 shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-sm transition-all"
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
                    onAdd={async (data: any) => { await addLevelTest.mutateAsync(data); }}
                    currentUser={currentUser}
                />
            )}

            {/* 목표 설정 추가 모달 */}
            {!readOnly && isAddingGoal && (
                <GoalSettingModal
                    onClose={() => setIsAddingGoal(false)}
                    studentId={student.id}
                    studentName={student.name}
                    onAdd={async (data: any) => { await addGoalSetting.mutateAsync(data); }}
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
                    onAdd={async (data: any) => { await addGradeComment.mutateAsync(data); }}
                    onUpdate={async (id: string, data: any) => { await updateGradeComment.mutateAsync({ id, updates: data }); }}
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
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

export default GradesTab;
