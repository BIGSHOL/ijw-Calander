import React, { useState, useMemo } from 'react';
import { UnifiedStudent, Exam, StudentScore, ExamType, ExamScope, EXAM_TYPE_LABELS, EXAM_SCOPE_LABELS, GRADE_COLORS, calculateGrade } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import { useExams, useCreateExam, useUpdateExam, useDeleteExam } from '../../hooks/useExams';
import { useClasses, GRADE_OPTIONS } from '../../hooks/useClasses';
import { useExamSeries, useCreateExamSeries } from '../../hooks/useExamSeries';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import {
  GraduationCap, Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronRight,
  Users, Calendar, BookOpen, BarChart3, Search, Filter, RefreshCw, Loader2,
  TrendingUp, TrendingDown, Minus, AlertCircle, Check, Tag, Building2
} from 'lucide-react';

// 시험별 전체 성적 조회 Hook
const useExamScores = (examId: string) => {
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

// 전체 성적 조회 Hook
const useAllScores = () => {
  return useQuery<StudentScore[]>({
    queryKey: ['all_scores'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'student_scores'));
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StudentScore));
    },
    staleTime: 1000 * 60 * 5,
  });
};

type ViewMode = 'exams' | 'students' | 'input';

interface GradesManagerProps {
  subjectFilter: 'all' | 'math' | 'english';
  searchQuery: string;
}

const GradesManager: React.FC<GradesManagerProps> = ({ subjectFilter, searchQuery }) => {
  const user = auth.currentUser;
  const queryClient = useQueryClient();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('exams');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);

  // Data
  const { students } = useStudents();
  const { data: exams = [], isLoading: loadingExams, refetch: refetchExams } = useExams();
  const { data: allScores = [], isLoading: loadingScores } = useAllScores();
  const { data: examScores = [] } = useExamScores(expandedExamId || '');

  // Mutations
  const createExam = useCreateExam();
  const deleteExamMutation = useDeleteExam();

  // 성적 일괄 입력 mutation
  const batchAddScores = useMutation({
    mutationFn: async (scores: Omit<StudentScore, 'id' | 'createdAt' | 'updatedAt'>[]) => {
      const batch = writeBatch(db);
      const now = Date.now();

      scores.forEach(scoreData => {
        const percentage = (scoreData.score / scoreData.maxScore) * 100;
        const grade = calculateGrade(percentage);
        const docRef = doc(collection(db, 'student_scores'));
        batch.set(docRef, {
          ...scoreData,
          percentage,
          grade,
          createdAt: now,
          updatedAt: now,
        });
      });

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_scores'] });
      queryClient.invalidateQueries({ queryKey: ['exam_scores'] });
      queryClient.invalidateQueries({ queryKey: ['student_scores'] });
    },
  });

  // 개별 성적 삭제 mutation
  const deleteScore = useMutation({
    mutationFn: async (scoreId: string) => {
      await deleteDoc(doc(db, 'student_scores', scoreId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_scores'] });
      queryClient.invalidateQueries({ queryKey: ['exam_scores'] });
      queryClient.invalidateQueries({ queryKey: ['student_scores'] });
    },
  });

  // Filtered exams
  const filteredExams = useMemo(() => {
    let result = [...exams];

    if (subjectFilter !== 'all') {
      result = result.filter(e => e.subject === subjectFilter || e.subject === 'both');
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(q));
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [exams, subjectFilter, searchQuery]);

  // 시험별 통계
  const getExamStats = (examId: string) => {
    const scores = allScores.filter(s => s.examId === examId);
    if (scores.length === 0) return { count: 0, avg: 0, max: 0, min: 0 };

    const percentages = scores.map(s => s.percentage || 0);
    return {
      count: scores.length,
      avg: Math.round(percentages.reduce((a, b) => a + b, 0) / scores.length),
      max: Math.round(Math.max(...percentages)),
      min: Math.round(Math.min(...percentages)),
    };
  };

  // 새 시험 생성 핸들러
  const [newExam, setNewExam] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    type: 'weekly' as ExamType,
    subject: 'math' as 'math' | 'english' | 'both',
    maxScore: 100,
    scope: 'academy' as ExamScope,
    targetClassIds: [] as string[],
    targetGrades: [] as string[],
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');

  // 반/시리즈 데이터
  const { data: classes = [] } = useClasses(newExam.subject === 'both' ? undefined : newExam.subject);
  const { data: examSeries = [] } = useExamSeries();

  const handleCreateExam = async () => {
    if (!newExam.title || !user) return;

    await createExam.mutateAsync({
      ...newExam,
      createdBy: user.uid,
      createdByName: user.displayName || user.email || '',
    });

    setIsCreatingExam(false);
    setNewExam({
      title: '',
      date: new Date().toISOString().split('T')[0],
      type: 'weekly',
      subject: 'math',
      maxScore: 100,
      scope: 'academy',
      targetClassIds: [],
      targetGrades: [],
      tags: [],
    });
    setTagInput('');
  };

  // 성적 입력 상태
  const [scoreInputs, setScoreInputs] = useState<Record<string, { score: string; avg?: string; rank?: string }>>({});
  const [addedStudentIds, setAddedStudentIds] = useState<string[]>([]); // 추가된 학생 ID 목록
  const [studentSearchQuery, setStudentSearchQuery] = useState(''); // 학생 검색어

  const handleScoreInputChange = (studentId: string, field: 'score' | 'avg' | 'rank', value: string) => {
    setScoreInputs(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      }
    }));
  };

  // 학생 추가
  const handleAddStudent = (studentId: string) => {
    if (!addedStudentIds.includes(studentId)) {
      setAddedStudentIds(prev => [...prev, studentId]);
      setScoreInputs(prev => ({
        ...prev,
        [studentId]: { score: '' }
      }));
    }
    setStudentSearchQuery('');
  };

  // 학생 제거
  const handleRemoveStudent = (studentId: string) => {
    setAddedStudentIds(prev => prev.filter(id => id !== studentId));
    setScoreInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[studentId];
      return newInputs;
    });
  };

  // 검색된 학생 목록 (추가되지 않은 학생만)
  const searchedStudents = useMemo(() => {
    if (!studentSearchQuery.trim() || !selectedExam) return [];

    const query = studentSearchQuery.toLowerCase();
    return students.filter(s => {
      // 이미 추가된 학생 제외
      if (addedStudentIds.includes(s.id)) return false;
      // 검색어 매칭
      const matchesQuery = s.name.toLowerCase().includes(query) ||
        s.englishName?.toLowerCase().includes(query);
      if (!matchesQuery) return false;
      // 재원생만
      if (s.status !== 'active') return false;
      return true;
    }).slice(0, 10); // 최대 10명
  }, [students, studentSearchQuery, addedStudentIds, selectedExam]);

  // 추가된 학생 객체 목록
  const addedStudents = useMemo(() => {
    return addedStudentIds.map(id => students.find(s => s.id === id)).filter(Boolean) as typeof students;
  }, [addedStudentIds, students]);

  const handleBatchSaveScores = async () => {
    if (!selectedExam || !user) return;

    const scoresToSave: Omit<StudentScore, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    Object.entries(scoreInputs).forEach(([studentId, input]) => {
      if (input.score && !isNaN(Number(input.score))) {
        const student = students.find(s => s.id === studentId);
        scoresToSave.push({
          studentId,
          studentName: student?.name,
          examId: selectedExam.id,
          examTitle: selectedExam.title,
          subject: selectedExam.subject === 'both' ? 'math' : selectedExam.subject,
          score: Number(input.score),
          maxScore: selectedExam.maxScore,
          average: input.avg ? Number(input.avg) : undefined,
          rank: input.rank ? Number(input.rank) : undefined,
          totalStudents: Object.keys(scoreInputs).filter(k => scoreInputs[k].score).length,
          createdBy: user.uid,
          createdByName: user.displayName || user.email || '',
        });
      }
    });

    if (scoresToSave.length > 0) {
      await batchAddScores.mutateAsync(scoresToSave);
      setScoreInputs({});
      setSelectedExam(null);
      setViewMode('exams');
    }
  };

  // 성적 입력 화면으로 전환
  const startScoreInput = (exam: Exam) => {
    setSelectedExam(exam);
    setViewMode('input');
    setScoreInputs({});
    setAddedStudentIds([]);
    setStudentSearchQuery('');

    // 기존 성적 로드
    const existingScores = allScores.filter(s => s.examId === exam.id);
    const initialInputs: Record<string, { score: string; avg?: string; rank?: string }> = {};
    const existingStudentIds: string[] = [];
    existingScores.forEach(s => {
      initialInputs[s.studentId] = {
        score: s.score.toString(),
        avg: s.average?.toString(),
        rank: s.rank?.toString(),
      };
      existingStudentIds.push(s.studentId);
    });

    // 시험 범위에 따라 자동으로 학생 필터링
    let autoAddIds: string[] = [];
    if (exam.scope === 'academy' || !exam.scope) {
      // 학원 전체: 기존 성적이 있는 학생만 (전체는 너무 많을 수 있음)
      autoAddIds = existingStudentIds;
    } else if (exam.scope === 'grade' && exam.targetGrades && exam.targetGrades.length > 0) {
      // 학년별: 해당 학년 학생들 자동 추가
      autoAddIds = students
        .filter(s => s.status === 'active' && exam.targetGrades?.includes(s.grade || ''))
        .map(s => s.id);
    } else if (exam.scope === 'class' && exam.targetClassIds && exam.targetClassIds.length > 0) {
      // 반별: 해당 반 학생들 자동 추가 (enrollment 기반)
      autoAddIds = students
        .filter(s => {
          if (s.status !== 'active') return false;
          return s.enrollments?.some(e => exam.targetClassIds?.includes(e.classId));
        })
        .map(s => s.id);
    } else if (exam.scope === 'subject') {
      // 과목별: 해당 과목 수강 학생 자동 추가
      const targetSubject = exam.subject === 'both' ? undefined : exam.subject;
      if (targetSubject) {
        autoAddIds = students
          .filter(s => {
            if (s.status !== 'active') return false;
            return s.enrollments?.some(e => e.subject === targetSubject);
          })
          .map(s => s.id);
      }
    }

    // 기존 성적 학생 + 자동 추가 학생 병합 (중복 제거)
    const mergedIds = [...new Set([...existingStudentIds, ...autoAddIds])];

    setScoreInputs(initialInputs);
    setAddedStudentIds(mergedIds);
  };


  if (loadingExams || loadingScores) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Compact Header - 시험 등록 버튼만 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            총 <span className="font-bold text-[#081429]">{filteredExams.length}</span>개 시험
          </span>
          <button
            onClick={() => refetchExams()}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="새로고침"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => setIsCreatingExam(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#0a1a35] transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>시험 등록</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'input' && selectedExam ? (
          /* 성적 입력 화면 */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg text-[#081429]">{selectedExam.title}</h2>
                <p className="text-sm text-gray-500">
                  {selectedExam.date} | {selectedExam.subject === 'both' ? '통합' : selectedExam.subject === 'math' ? '수학' : '영어'} | 만점 {selectedExam.maxScore}점
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setViewMode('exams'); setSelectedExam(null); }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleBatchSaveScores}
                  disabled={batchAddScores.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {batchAddScores.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>저장</span>
                </button>
              </div>
            </div>

            {/* 학생 검색/추가 UI */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="학생 이름을 검색하여 추가..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* 검색 결과 드롭다운 */}
                {searchedStudents.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {searchedStudents.map(student => (
                      <button
                        key={student.id}
                        onClick={() => handleAddStudent(student.id)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium text-gray-900">{student.name}</span>
                          {student.englishName && (
                            <span className="ml-2 text-sm text-gray-500">{student.englishName}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{student.grade || '-'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {addedStudents.length > 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  추가된 학생: <span className="font-semibold text-[#081429]">{addedStudents.length}</span>명
                </p>
              )}
            </div>

            <div className="overflow-auto max-h-[calc(100vh-420px)]">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">학생</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">학년</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">점수</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">평균</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">석차</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">등급</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {addedStudents.map(student => {
                    const input = scoreInputs[student.id] || { score: '' };
                    const percentage = input.score ? (Number(input.score) / selectedExam.maxScore) * 100 : null;
                    const grade = percentage !== null ? calculateGrade(percentage) : null;

                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{student.name}</div>
                          {student.englishName && (
                            <div className="text-xs text-gray-500">{student.englishName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.grade || '-'}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={input.score || ''}
                            onChange={(e) => handleScoreInputChange(student.id, 'score', e.target.value)}
                            placeholder="점수"
                            min={0}
                            max={selectedExam.maxScore}
                            className="w-20 px-2 py-1 text-center border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={input.avg || ''}
                            onChange={(e) => handleScoreInputChange(student.id, 'avg', e.target.value)}
                            placeholder="평균"
                            className="w-20 px-2 py-1 text-center border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={input.rank || ''}
                            onChange={(e) => handleScoreInputChange(student.id, 'rank', e.target.value)}
                            placeholder="석차"
                            min={1}
                            className="w-20 px-2 py-1 text-center border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {grade && (
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${GRADE_COLORS[grade].bg} ${GRADE_COLORS[grade].text}`}>
                              {grade}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemoveStudent(student.id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="학생 제거"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* 시험 목록 화면 */
          <div className="space-y-3">
            {filteredExams.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>등록된 시험이 없습니다</p>
                <p className="text-sm mt-1">상단의 '시험 등록' 버튼으로 새 시험을 추가하세요</p>
              </div>
            ) : (
              filteredExams.map(exam => {
                const stats = getExamStats(exam.id);
                const isExpanded = expandedExamId === exam.id;

                return (
                  <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedExamId(isExpanded ? null : exam.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-12 rounded-full ${exam.subject === 'math' ? 'bg-blue-500' :
                          exam.subject === 'english' ? 'bg-purple-500' : 'bg-green-500'
                          }`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[#081429]">{exam.title}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${exam.subject === 'math' ? 'bg-blue-100 text-blue-700' :
                              exam.subject === 'english' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                              }`}>
                              {exam.subject === 'both' ? '통합' : exam.subject === 'math' ? '수학' : '영어'}
                            </span>
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                              {EXAM_TYPE_LABELS[exam.type]}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {exam.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {stats.count}명 응시
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {stats.count > 0 && (
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center">
                              <div className="text-gray-400 text-xs">평균</div>
                              <div className="font-semibold text-gray-900">{stats.avg}점</div>
                            </div>
                            <div className="text-center">
                              <div className="text-gray-400 text-xs">최고</div>
                              <div className="font-semibold text-green-600">{stats.max}점</div>
                            </div>
                            <div className="text-center">
                              <div className="text-gray-400 text-xs">최저</div>
                              <div className="font-semibold text-red-600">{stats.min}점</div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); startScoreInput(exam); }}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            성적 입력
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('이 시험을 삭제하시겠습니까?')) {
                                deleteExamMutation.mutate(exam.id);
                              }
                            }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 확장된 성적 목록 */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 p-4">
                        {examScores.length === 0 ? (
                          <p className="text-center text-gray-500 py-4">입력된 성적이 없습니다</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {examScores
                              .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
                              .map((score, idx) => {
                                const grade = score.grade || calculateGrade(score.percentage || 0);
                                return (
                                  <div
                                    key={score.id}
                                    className="bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between"
                                  >
                                    <div>
                                      <div className="font-medium text-sm text-gray-900">
                                        {idx + 1}. {score.studentName || '학생'}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {score.score}/{score.maxScore}점 ({Math.round(score.percentage || 0)}%)
                                      </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded ${GRADE_COLORS[grade].bg} ${GRADE_COLORS[grade].text}`}>
                                      {grade}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 시험 등록 모달 */}
      {isCreatingExam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold text-lg">새 시험 등록</h3>
              <button
                onClick={() => setIsCreatingExam(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시험명 *</label>
                <input
                  type="text"
                  value={newExam.title}
                  onChange={(e) => setNewExam(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="예: 1월 모의고사"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                  <input
                    type="date"
                    value={newExam.date}
                    onChange={(e) => setNewExam(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">만점</label>
                  <input
                    type="number"
                    value={newExam.maxScore}
                    onChange={(e) => setNewExam(prev => ({ ...prev, maxScore: Number(e.target.value) }))}
                    min={1}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                  <select
                    value={newExam.type}
                    onChange={(e) => setNewExam(prev => ({ ...prev, type: e.target.value as ExamType }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">과목</label>
                  <select
                    value={newExam.subject}
                    onChange={(e) => setNewExam(prev => ({ ...prev, subject: e.target.value as 'math' | 'english' | 'both', targetClassIds: [] }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="math">수학</option>
                    <option value="english">영어</option>
                    <option value="both">통합</option>
                  </select>
                </div>
              </div>

              {/* 시험 범위 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  시험 범위
                </label>
                <select
                  value={newExam.scope}
                  onChange={(e) => setNewExam(prev => ({
                    ...prev,
                    scope: e.target.value as ExamScope,
                    targetClassIds: [],
                    targetGrades: [],
                  }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(EXAM_SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* 대상 선택: 반별 */}
              {newExam.scope === 'class' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">대상 반 선택</label>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {classes.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">등록된 반이 없습니다</p>
                    ) : (
                      classes.map(cls => (
                        <label key={cls.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newExam.targetClassIds.includes(cls.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewExam(prev => ({ ...prev, targetClassIds: [...prev.targetClassIds, cls.id] }));
                              } else {
                                setNewExam(prev => ({ ...prev, targetClassIds: prev.targetClassIds.filter(id => id !== cls.id) }));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{cls.className}</span>
                          <span className="text-xs text-gray-400 ml-auto">{cls.teacher}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {newExam.targetClassIds.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">{newExam.targetClassIds.length}개 반 선택됨</p>
                  )}
                </div>
              )}

              {/* 대상 선택: 학년별 */}
              {newExam.scope === 'grade' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">대상 학년 선택</label>
                  <div className="flex flex-wrap gap-2">
                    {GRADE_OPTIONS.map(grade => (
                      <label key={grade} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newExam.targetGrades.includes(grade)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewExam(prev => ({ ...prev, targetGrades: [...prev.targetGrades, grade] }));
                            } else {
                              setNewExam(prev => ({ ...prev, targetGrades: prev.targetGrades.filter(g => g !== grade) }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{grade}</span>
                      </label>
                    ))}
                  </div>
                  {newExam.targetGrades.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">{newExam.targetGrades.join(', ')} 선택됨</p>
                  )}
                </div>
              )}

              {/* 태그 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Tag className="w-4 h-4 inline mr-1" />
                  태그
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        const tag = tagInput.trim().startsWith('#') ? tagInput.trim() : `#${tagInput.trim()}`;
                        if (!newExam.tags.includes(tag)) {
                          setNewExam(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                        }
                        setTagInput('');
                      }
                    }}
                    placeholder="태그 입력 후 Enter (예: 내신대비)"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                {newExam.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {newExam.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                      >
                        {tag}
                        <button
                          onClick={() => setNewExam(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                          className="hover:text-blue-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setIsCreatingExam(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateExam}
                disabled={!newExam.title || createExam.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createExam.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>등록</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradesManager;
