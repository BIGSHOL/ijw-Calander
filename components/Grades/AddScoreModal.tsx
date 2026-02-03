import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Info, BookOpen, Calendar, FileText, TrendingUp, AlignLeft } from 'lucide-react';
import { Exam, StudentScore, calculateGrade, UserProfile } from '../../types';
import { useExams, useCreateExam } from '../../hooks/useExams';
import { useAddScore } from '../../hooks/useStudentGrades';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AddScoreModalProps {
    onClose: () => void;
    onSuccess?: () => void;
    // 학생 정보 (학생 관리에서 호출 시)
    studentId?: string;
    studentName?: string;
    // 시험 정보 (성적 관리에서 호출 시)
    preSelectedExamId?: string;
    preSelectedSubject?: 'math' | 'english';
    // 새 시험 생성 버튼 숨김 여부 (학생 상세에서는 true)
    hideCreateExam?: boolean;
    // 현재 사용자 (시뮬레이션 지원)
    currentUser?: UserProfile | null;
}

// 시험별 성적 조회 Hook
const useExamScoresForModal = (examId: string) => {
    return useQuery<StudentScore[]>({
        queryKey: ['exam_scores', examId],
        queryFn: async () => {
            if (!examId) return [];
            const q = query(
                collection(db, 'student_scores'),
                where('examId', '==', examId)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as StudentScore));
        },
        enabled: !!examId,
        staleTime: 1000 * 60 * 5,
    });
};

/**
 * 성적 입력 공통 모달
 * - 학생 관리 > 성적 탭에서 사용 (studentId 필수)
 * - 평균, 석차, 전체 인원은 기존 성적 기반으로 자동 계산
 */
const AddScoreModal: React.FC<AddScoreModalProps> = ({
    onClose,
    onSuccess,
    studentId,
    studentName,
    preSelectedExamId,
    preSelectedSubject,
    hideCreateExam = false,
    currentUser,
}) => {
    const queryClient = useQueryClient();
    const { data: exams = [], isLoading: loadingExams } = useExams();
    const addScore = useAddScore();
    const createExam = useCreateExam();

    const [isCreatingExam, setIsCreatingExam] = useState(false);

    // 성적 입력 폼 상태 (평균, 석차, 전체인원 제거)
    const [formData, setFormData] = useState({
        examId: preSelectedExamId || '',
        subject: preSelectedSubject || 'math' as 'math' | 'english' | 'science' | 'korean',
        score: '',
        maxScore: '100',
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

    // 선택된 시험의 기존 성적 조회
    const { data: existingScores = [], isLoading: loadingScores } = useExamScoresForModal(formData.examId);

    // preSelectedExamId가 변경되면 폼 업데이트
    useEffect(() => {
        if (preSelectedExamId) {
            setFormData(prev => ({ ...prev, examId: preSelectedExamId }));
        }
    }, [preSelectedExamId]);

    // 선택된 시험의 만점으로 자동 설정
    useEffect(() => {
        if (formData.examId) {
            const selectedExam = exams.find(e => e.id === formData.examId);
            if (selectedExam) {
                setFormData(prev => ({
                    ...prev,
                    maxScore: String(selectedExam.maxScore || 100),
                    subject: selectedExam.subject === 'both' ? prev.subject : selectedExam.subject,
                }));
            }
        }
    }, [formData.examId, exams]);

    // 자동 계산: 평균, 석차, 전체 인원 (내 점수 포함)
    const calculatedStats = useMemo(() => {
        const myScore = formData.score ? parseFloat(formData.score) : null;
        if (myScore === null) {
            return { average: null, rank: null, totalStudents: existingScores.length };
        }

        // 기존 점수들 + 내 점수 (같은 학생의 기존 점수가 있으면 대체)
        const otherScores = existingScores
            .filter(s => s.studentId !== studentId)
            .map(s => s.score);
        const allScores = [...otherScores, myScore];

        // 전체 인원
        const totalStudents = allScores.length;

        // 평균
        const average = totalStudents > 0
            ? allScores.reduce((sum, s) => sum + s, 0) / totalStudents
            : 0;

        // 석차 (동점자 처리: 같은 점수면 같은 등수)
        const sortedScores = [...allScores].sort((a, b) => b - a);
        let rank = 1;
        for (let i = 0; i < sortedScores.length; i++) {
            if (sortedScores[i] === myScore) {
                rank = i + 1;
                break;
            }
        }

        return { average: Math.round(average * 10) / 10, rank, totalStudents };
    }, [existingScores, formData.score, studentId]);

    const handleSubmit = async () => {
        if (!formData.examId || !formData.score || !studentId) return;

        const selectedExam = exams.find(e => e.id === formData.examId);

        // Firebase는 undefined 값을 허용하지 않으므로, 값이 있는 필드만 포함
        const scoreData: Record<string, any> = {
            studentId,
            studentName: studentName || '',
            examId: formData.examId,
            subject: formData.subject,
            score: parseFloat(formData.score),
            maxScore: parseFloat(formData.maxScore) || 100,
            createdBy: currentUser?.uid || '',
            createdByName: currentUser?.displayName || currentUser?.email || '',
        };

        // 선택적 필드는 값이 있을 때만 추가
        if (selectedExam?.title) scoreData.examTitle = selectedExam.title;
        if (calculatedStats.average !== null) scoreData.average = calculatedStats.average;
        if (calculatedStats.rank !== null) scoreData.rank = calculatedStats.rank;
        if (calculatedStats.totalStudents) scoreData.totalStudents = calculatedStats.totalStudents;
        if (formData.memo?.trim()) scoreData.memo = formData.memo.trim();

        await addScore.mutateAsync(scoreData as any);

        // 시험 통계 업데이트를 위해 캐시 무효화
        queryClient.invalidateQueries({ queryKey: ['exam_scores', formData.examId] });

        onSuccess?.();
        onClose();
    };

    const handleCreateExam = async () => {
        if (!newExam.title || !newExam.date) return;

        const result = await createExam.mutateAsync({
            title: newExam.title,
            date: newExam.date,
            type: newExam.type,
            subject: newExam.subject,
            maxScore: parseFloat(newExam.maxScore) || 100,
            scope: 'academy',
            createdBy: currentUser?.uid || '',
            createdByName: currentUser?.displayName || currentUser?.email || '',
        });

        // 새로 만든 시험 선택
        if (result?.id) {
            setFormData(prev => ({ ...prev, examId: result.id }));
        }

        setNewExam({
            title: '',
            date: new Date().toISOString().split('T')[0],
            type: 'mock',
            subject: 'math',
            maxScore: '100',
        });
        setIsCreatingExam(false);
    };

    // 백분율 계산
    const percentage = formData.score && formData.maxScore
        ? ((parseFloat(formData.score) / parseFloat(formData.maxScore)) * 100).toFixed(1)
        : null;
    const grade = percentage ? calculateGrade(parseFloat(percentage)) : null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
            <div className="bg-white rounded-sm w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-[#081429] flex items-center gap-2">
                        <BookOpen size={18} className="text-indigo-600" />
                        성적 입력{studentName && <span className="text-xs font-normal text-gray-500"> - {studentName}</span>}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* 폼 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* 1. 시험 선택 섹션 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b">
                            <Calendar className="w-3 h-3 text-[#081429]" />
                            <span className="text-[#081429] font-bold text-xs">시험 선택</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <label className="w-14 shrink-0 text-xs font-medium text-[#373d41]">시험</label>
                                <select
                                    value={formData.examId}
                                    onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
                                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                                    disabled={loadingExams}
                                >
                                    <option value="">시험 선택...</option>
                                    {exams.map(exam => (
                                        <option key={exam.id} value={exam.id}>
                                            {exam.title} ({exam.date})
                                        </option>
                                    ))}
                                </select>
                                {!hideCreateExam && (
                                    <button
                                        onClick={() => setIsCreatingExam(true)}
                                        className="px-2 py-1 border border-gray-300 rounded-sm text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                                    >
                                        + 새 시험
                                    </button>
                                )}
                            </div>
                            {/* 시험 선택 시 기존 응시 인원 표시 */}
                            {formData.examId && !loadingScores && existingScores.length > 0 && (
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-50">
                                    <Info size={12} className="text-blue-600" />
                                    <span className="text-xs text-blue-700">현재 {existingScores.length}명 응시</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 새 시험 생성 폼 */}
                    {isCreatingExam && (
                        <div className="bg-gray-50 rounded-sm p-2 space-y-2 border border-gray-200">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-700">새 시험 등록</span>
                                <button onClick={() => setIsCreatingExam(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={14} />
                                </button>
                            </div>
                            <input
                                type="text"
                                value={newExam.title}
                                onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                                placeholder="시험 이름 (예: 1월 모의고사)"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    value={newExam.date}
                                    onChange={(e) => setNewExam({ ...newExam, date: e.target.value })}
                                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                                />
                                <select
                                    value={newExam.type}
                                    onChange={(e) => setNewExam({ ...newExam, type: e.target.value as Exam['type'] })}
                                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                                >
                                    <option value="mock">모의고사</option>
                                    <option value="weekly">주간테스트</option>
                                    <option value="school">학교시험</option>
                                    <option value="diagnostic">진단평가</option>
                                    <option value="other">기타</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={newExam.subject}
                                    onChange={(e) => setNewExam({ ...newExam, subject: e.target.value as Exam['subject'] })}
                                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                                >
                                    <option value="math">수학</option>
                                    <option value="english">영어</option>
                                    <option value="both">수학+영어</option>
                                </select>
                                <input
                                    type="number"
                                    value={newExam.maxScore}
                                    onChange={(e) => setNewExam({ ...newExam, maxScore: e.target.value })}
                                    placeholder="만점"
                                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                                />
                            </div>
                            <button
                                onClick={handleCreateExam}
                                disabled={!newExam.title || createExam.isPending}
                                className="w-full px-3 py-2 bg-[#081429] text-white rounded-sm text-xs font-medium hover:bg-[#0f2847] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            >
                                {createExam.isPending && <Loader2 size={12} className="animate-spin" />}
                                시험 등록
                            </button>
                        </div>
                    )}

                    {/* 2. 성적 입력 섹션 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b">
                            <FileText className="w-3 h-3 text-[#081429]" />
                            <span className="text-[#081429] font-bold text-xs">성적 입력</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {/* 과목 선택 */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <label className="w-14 shrink-0 text-xs font-medium text-[#373d41]">과목</label>
                                <div className="flex-1 grid grid-cols-4 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, subject: 'math' })}
                                        className={`py-1.5 rounded-sm text-xs font-medium transition-colors ${
                                            formData.subject === 'math'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        수학
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, subject: 'english' })}
                                        className={`py-1.5 rounded-sm text-xs font-medium transition-colors ${
                                            formData.subject === 'english'
                                                ? 'bg-purple-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        영어
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, subject: 'science' })}
                                        className={`py-1.5 rounded-sm text-xs font-medium transition-colors ${
                                            formData.subject === 'science'
                                                ? 'bg-green-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        과학
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, subject: 'korean' })}
                                        className={`py-1.5 rounded-sm text-xs font-medium transition-colors ${
                                            formData.subject === 'korean'
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        국어
                                    </button>
                                </div>
                            </div>

                            {/* 점수 */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <label className="w-14 shrink-0 text-xs font-medium text-[#373d41]">점수</label>
                                <input
                                    type="number"
                                    value={formData.score}
                                    onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                                    placeholder="85"
                                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                                />
                            </div>

                            {/* 만점 */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <label className="w-14 shrink-0 text-xs font-medium text-[#373d41]">만점</label>
                                <input
                                    type="number"
                                    value={formData.maxScore}
                                    onChange={(e) => setFormData({ ...formData, maxScore: e.target.value })}
                                    placeholder="100"
                                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:outline-none"
                                />
                            </div>

                            {/* 백분율/등급 미리보기 */}
                            {percentage && (
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50">
                                    <label className="w-14 shrink-0 text-xs font-medium text-[#373d41]">환산 점수</label>
                                    <div className="flex-1 flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-[#081429]">{percentage}%</span>
                                        <span className={`px-1.5 py-0.5 rounded-sm text-xs font-bold ${
                                            grade === 'A' ? 'bg-green-100 text-green-700' :
                                            grade === 'B' ? 'bg-blue-100 text-blue-700' :
                                            grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                                            grade === 'D' ? 'bg-orange-100 text-orange-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {grade}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. 자동 계산 섹션 */}
                    {formData.examId && formData.score && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b">
                                <TrendingUp className="w-3 h-3 text-[#081429]" />
                                <span className="text-[#081429] font-bold text-xs">자동 계산</span>
                                <span className="ml-auto text-xs text-gray-500">(저장 시 반영)</span>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {/* 평균 */}
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <label className="w-14 shrink-0 text-xs font-medium text-[#373d41]">평균</label>
                                    <div className="flex-1 px-2 py-1 text-xs text-[#081429] font-bold">
                                        {loadingScores ? '...' : calculatedStats.average ?? '-'}
                                    </div>
                                </div>

                                {/* 석차 */}
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <label className="w-14 shrink-0 text-xs font-medium text-[#373d41]">석차</label>
                                    <div className="flex-1 px-2 py-1 text-xs text-[#081429] font-bold">
                                        {loadingScores ? '...' : calculatedStats.rank ?? '-'}
                                    </div>
                                </div>

                                {/* 전체 인원 */}
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <label className="w-14 shrink-0 text-xs font-medium text-[#373d41]">전체 인원</label>
                                    <div className="flex-1 px-2 py-1 text-xs text-[#081429] font-bold">
                                        {loadingScores ? '...' : calculatedStats.totalStudents ?? '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. 메모 섹션 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b">
                            <AlignLeft className="w-3 h-3 text-[#081429]" />
                            <span className="text-[#081429] font-bold text-xs">메모</span>
                        </div>
                        <div className="p-2">
                            <textarea
                                value={formData.memo}
                                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                                placeholder="특이사항 메모..."
                                rows={2}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:outline-none resize-none"
                            />
                        </div>
                    </div>

                    {/* 버튼 */}
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-sm text-xs font-medium hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!formData.examId || !formData.score || addScore.isPending || loadingScores}
                            className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-sm text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                            {addScore.isPending ? (
                                <>
                                    <Loader2 size={12} className="animate-spin" />
                                    저장 중...
                                </>
                            ) : (
                                '저장'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddScoreModal;
