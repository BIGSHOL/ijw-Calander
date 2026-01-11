import React, { useState, useMemo, useEffect } from 'react';
import { UnifiedStudent, Exam, StudentScore, ExamType, ExamScope, EXAM_TYPE_LABELS, EXAM_SCOPE_LABELS, GRADE_COLORS, calculateGrade } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import { useExams, useCreateExam, useUpdateExam, useDeleteExam } from '../../hooks/useExams';
import { useClasses, GRADE_OPTIONS } from '../../hooks/useClasses';
import { useExamSeries, useCreateExamSeries } from '../../hooks/useExamSeries';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import {
  GraduationCap, Plus, Trash2, Edit, Save, X, ChevronDown, ChevronRight,
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
  onSearchChange: (query: string) => void;
}

const GradesManager: React.FC<GradesManagerProps> = ({ subjectFilter, searchQuery, onSearchChange }) => {
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
  // useAllScores 더 이상 사용하지 않음 (비용 최적화)
  // const { data: allScores = [], isLoading: loadingScores } = useAllScores();
  const { data: examScores = [], isLoading: loadingScores } = useExamScores(selectedExam?.id || expandedExamId || '');

  // Mutations
  const createExam = useCreateExam();
  const updateExam = useUpdateExam(); // 시험 정보 업데이트용 (통계 저장)
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
      queryClient.invalidateQueries({ queryKey: ['all_scores'] }); // This query key is no longer used, but kept for safety if other parts still reference it
      queryClient.invalidateQueries({ queryKey: ['exam_scores'] });
      queryClient.invalidateQueries({ queryKey: ['student_scores'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] }); // Invalidate exams to refetch updated stats
    },
  });

  // 개별 성적 삭제 mutation
  const deleteScore = useMutation({
    mutationFn: async (scoreId: string) => {
      await deleteDoc(doc(db, 'student_scores', scoreId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_scores'] }); // This query key is no longer used, but kept for safety if other parts still reference it
      queryClient.invalidateQueries({ queryKey: ['exam_scores'] });
      queryClient.invalidateQueries({ queryKey: ['student_scores'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] }); // Invalidate exams to refetch updated stats
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

  // 시험별 통계 - REMOVED, now stored directly on exam object
  // const getExamStats = (examId: string) => {
  //   const scores = allScores.filter(s => s.examId === examId);
  //   if (scores.length === 0) return { count: 0, avg: 0, max: 0, min: 0 };

  //   const percentages = scores.map(s => s.percentage || 0);
  //   return {
  //     count: scores.length,
  //     avg: Math.round(percentages.reduce((a, b) => a + b, 0) / scores.length),
  //     max: Math.round(Math.max(...percentages)),
  //     min: Math.round(Math.min(...percentages)),
  //   };
  // };

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
    targetSchools: [] as string[],
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [classSearchQuery, setClassSearchQuery] = useState(''); // 반 검색어
  const [schoolSearchQuery, setSchoolSearchQuery] = useState(''); // 학교 검색어

  // 성적 데이터 로딩 및 초기화 (Async)
  useEffect(() => {
    if (viewMode !== 'input' || !selectedExam) return;

    // 이미 입력값이 있으면 덮어쓰기 방지 (단, 초기 로딩 시점 체크 필요)
    // startScoreInput에서 scoreInputs를 초기화하므로, 여기서는 데이터가 로드되면 채워넣음.
    // 하지만 examScores가 빈 배열일 수도 있음 (새 시험).
    // 따라서 scoreInputs가 비어있을 때만 실행하는 조건은 유효함.
    if (Object.keys(scoreInputs).length > 0 && examScores.length > 0) return;

    const initialInputs: Record<string, { score: string; avg?: string; rank?: string }> = {};
    const existingStudentIds: string[] = [];

    // examScores가 아직 로딩 중이거나 비어있어도, 
    // examScores가 업데이트되면 이 effect가 다시 실행됨.
    examScores.forEach(s => {
      initialInputs[s.studentId] = {
        score: s.score.toString(),
        avg: s.average?.toString(),
        rank: s.rank?.toString(),
      };
      existingStudentIds.push(s.studentId);
    });

    // 자동 추가 로직
    let autoAddIds: string[] = [];
    const exam = selectedExam;

    if (exam.scope === 'academy' || !exam.scope) {
      autoAddIds = existingStudentIds;
    } else if (exam.scope === 'grade' && exam.targetGrades && exam.targetGrades.length > 0) {
      autoAddIds = students
        .filter(s => s.status === 'active' && exam.targetGrades?.includes(s.grade || ''))
        .map(s => s.id);
    } else if (exam.scope === 'class' && exam.targetClassIds && exam.targetClassIds.length > 0) {
      autoAddIds = students
        .filter(s => {
          if (s.status !== 'active') return false;
          return s.enrollments?.some(e => exam.targetClassIds?.includes(e.classId));
        })
        .map(s => s.id);
    } else if (exam.scope === 'school' && exam.targetSchools && exam.targetSchools.length > 0) {
      autoAddIds = students
        .filter(s => s.status === 'active' && exam.targetSchools?.includes(s.school || ''))
        .map(s => s.id);
    } else if (exam.scope === 'subject') {
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

    const mergedIds = [...new Set([...existingStudentIds, ...autoAddIds])];

    // 상태 업데이트
    setScoreInputs(prev => Object.keys(prev).length === 0 ? initialInputs : prev);
    setAddedStudentIds(mergedIds);

  }, [viewMode, selectedExam, examScores, students]);

  // 반/시리즈 데이터
  const { data: classes = [] } = useClasses(newExam.subject === 'both' ? undefined : newExam.subject);
  const { data: examSeries = [] } = useExamSeries();

  // 학교 목록 추출 (학생 데이터에서)
  const availableSchools = useMemo(() => {
    const schools = new Set<string>();
    students.filter(s => s.status === 'active').forEach(s => {
      if (s.school) schools.add(s.school);
    });
    return Array.from(schools).sort();
  }, [students]);

  // 필터링된 반 목록
  const filteredClasses = useMemo(() => {
    if (!classSearchQuery.trim()) return classes;
    const query = classSearchQuery.toLowerCase();
    return classes.filter(cls =>
      cls.className.toLowerCase().includes(query) ||
      cls.teacher?.toLowerCase().includes(query)
    );
  }, [classes, classSearchQuery]);

  // 필터링된 학교 목록
  const filteredSchools = useMemo(() => {
    if (!schoolSearchQuery.trim()) return availableSchools;
    const query = schoolSearchQuery.toLowerCase();
    return availableSchools.filter(school => school.toLowerCase().includes(query));
  }, [availableSchools, schoolSearchQuery]);

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
      targetSchools: [],
      tags: [],
    });
    setTagInput('');
    setClassSearchQuery('');
    setSchoolSearchQuery('');
  };

  // 성적 입력 상태
  const [scoreInputs, setScoreInputs] = useState<Record<string, { score: string; avg?: string; rank?: string }>>({});
  const [addedStudentIds, setAddedStudentIds] = useState<string[]>([]); // 추가된 학생 ID 목록
  const [editingStudentIds, setEditingStudentIds] = useState<string[]>([]); // 수정 중인 학생 목록
  const [studentSearchQuery, setStudentSearchQuery] = useState(''); // 학생 검색어

  // 편집 모드 토글
  const handleToggleEdit = (studentId: string) => {
    if (editingStudentIds.includes(studentId)) {
      setEditingStudentIds(prev => prev.filter(id => id !== studentId));
    } else {
      setEditingStudentIds(prev => [...prev, studentId]);
    }
  };

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

    const validEntries = Object.entries(scoreInputs)
      .filter(([_, input]) => input.score && !isNaN(Number(input.score)))
      .map(([studentId, input]) => ({
        studentId,
        score: Number(input.score)
      }));

    if (validEntries.length === 0) return;

    // 통계 계산
    const totalScore = validEntries.reduce((sum, e) => sum + e.score, 0);
    const avgScore = Number((totalScore / validEntries.length).toFixed(1));
    const scoresArray = validEntries.map(e => e.score);
    const maxScore = Math.max(...scoresArray);
    const minScore = Math.min(...scoresArray);

    // 석차 계산
    validEntries.sort((a, b) => b.score - a.score);
    const rankMap: Record<string, number> = {};
    validEntries.forEach((entry, idx) => {
      const prevEntry = validEntries[idx - 1];
      if (prevEntry && prevEntry.score === entry.score) {
        rankMap[entry.studentId] = rankMap[prevEntry.studentId];
      } else {
        rankMap[entry.studentId] = idx + 1;
      }
    });

    const scoresToSave = validEntries.map(entry => {
      const student = students.find(s => s.id === entry.studentId);
      return {
        studentId: entry.studentId,
        studentName: student?.name,
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        subject: selectedExam.subject === 'both' ? 'math' : selectedExam.subject,
        score: entry.score,
        maxScore: selectedExam.maxScore,
        average: avgScore,
        rank: rankMap[entry.studentId],
        totalStudents: validEntries.length,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || '',
      };
    });

    if (scoresToSave.length > 0) {
      await batchAddScores.mutateAsync(scoresToSave);

      // 시험 통계 정보 업데이트 (비정규화)
      await updateExam.mutateAsync({
        id: selectedExam.id,
        updates: {
          stats: {
            count: validEntries.length,
            avg: Math.round(avgScore), // 소수점 반올림 (UI 표시용)
            max: maxScore,
            min: minScore
          }
        }
      });

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
  };

  // 마이그레이션 (통계 초기화)
  const [isMigrating, setIsMigrating] = useState(false);
  const handleMigrateStats = async () => {
    if (!confirm('모든 시험의 통계(평균, 등수 등)를 재계산하여 DB에 저장합니다.\n이 작업은 데이터 양에 따라 시간이 걸릴 수 있습니다.\n계속하시겠습니까?')) return;

    setIsMigrating(true);
    try {
      // 1. 모든 성적 가져오기 (비용 발생하지만 1회성)
      const scoresSnapshot = await getDocs(collection(db, 'student_scores'));
      const scores = scoresSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudentScore));

      // 2. 각 시험별로 통계 계산 및 업데이트
      const updatePromises = exams.map(async (exam) => {
        const examScores = scores.filter(s => s.examId === exam.id);
        if (examScores.length === 0) return;

        const scoresVal = examScores.map(s => s.score);
        const avg = scoresVal.reduce((a, b) => a + b, 0) / scoresVal.length;

        await updateExam.mutateAsync({
          id: exam.id,
          updates: {
            stats: {
              count: examScores.length,
              avg: Math.round(avg),
              max: Math.max(...scoresVal),
              min: Math.min(...scoresVal),
            }
          }
        });
      });

      await Promise.all(updatePromises);
      alert('통계 업데이트가 완료되었습니다.');
      refetchExams();
    } catch (error) {
      console.error('Migration failed:', error);
      alert('통계 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsMigrating(false);
    }
  };

  if (loadingExams) {
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

          {/* 마이그레이션 버튼 (임시) */}
          <button
            onClick={handleMigrateStats}
            disabled={isMigrating}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            title="DB 최적화: 통계 재계산"
          >
            {isMigrating ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
            <span>통계 갱신</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* 검색 기능 이동 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="시험명 검색..."
              className="w-64 pl-9 pr-3 py-2 text-sm border border-[#081429]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] focus:border-transparent transition-all"
            />
          </div>

          <button
            onClick={() => setIsCreatingExam(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#0a1a35] transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>시험 등록</span>
          </button>
        </div>
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
              {/* 계산된 평균과 석차 (addedStudents 기준) */}
              {(() => {
                // 점수 입력된 학생들만 추출하여 평균/석차 계산
                const studentsWithScores = addedStudents
                  .map(s => ({
                    id: s.id,
                    score: scoreInputs[s.id]?.score ? Number(scoreInputs[s.id].score) : null
                  }))
                  .filter(s => s.score !== null) as { id: string; score: number }[];

                // 평균 계산 (소숫점 1자리)
                const avg = studentsWithScores.length > 0
                  ? (studentsWithScores.reduce((sum, s) => sum + s.score, 0) / studentsWithScores.length).toFixed(1)
                  : null;

                // 석차 계산 (같은 점수면 같은 등수)
                const sortedScores = [...studentsWithScores].sort((a, b) => b.score - a.score);
                const rankMap: Record<string, number> = {};
                sortedScores.forEach((s, idx) => {
                  // 같은 점수면 같은 등수
                  const sameScoreBefore = sortedScores.findIndex(x => x.score === s.score);
                  rankMap[s.id] = sameScoreBefore + 1;
                });

                return (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase w-36">이름</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase w-28">학교/학년</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-20">점수</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-16">
                          평균
                          <span className="block text-xxs font-normal text-gray-400">
                            {avg ? avg : '-'}
                          </span>
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-16">
                          석차
                          <span className="block text-xxs font-normal text-gray-400">
                            /{studentsWithScores.length || addedStudents.length}명
                          </span>
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-16">
                          등급
                          <span className="block text-xxs font-normal text-gray-400">(추후)</span>
                        </th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {addedStudents.map(student => {
                        const input = scoreInputs[student.id] || { score: '' };
                        const score = input.score ? Number(input.score) : null;
                        const studentRank = score !== null ? rankMap[student.id] : null;
                        const schoolGrade = `${student.school || '-'}${student.grade || ''}`;
                        const isEditing = editingStudentIds.includes(student.id);

                        return (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900 text-sm">{student.name}</div>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">{schoolGrade}</td>
                            <td className="px-3 py-2 text-center">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={input.score || ''}
                                  onChange={(e) => handleScoreInputChange(student.id, 'score', e.target.value)}
                                  placeholder="-"
                                  min={0}
                                  max={selectedExam.maxScore}
                                  className="w-16 px-2 py-1 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                <span className={`text-sm ${input.score ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                                  {input.score || '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center text-sm text-gray-600">
                              {/* 평균은 자동 계산된 값(전체 평균)을 표시 */}
                              <span>{avg || '-'}</span>
                            </td>
                            <td className="px-3 py-2 text-center text-sm font-medium text-gray-800">
                              {studentRank !== null ? studentRank : '-'}
                            </td>
                            <td className="px-3 py-2 text-center text-xs text-gray-400">
                              -
                            </td>
                            <td className="px-3 py-2 text-center flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleToggleEdit(student.id)}
                                className={`p-1 rounded transition-colors ${isEditing ? 'text-green-600 hover:bg-green-50' : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                title={isEditing ? "완료" : "수정"}
                              >
                                {isEditing ? <Check className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                              </button>
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
                );
              })()}
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
                // 기존 getExamStats 제거하고 exam.stats 사용
                const stats = exam.stats || { count: 0, avg: 0, max: 0, min: 0 };
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
                  {/* 검색 필드 */}
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={classSearchQuery}
                      onChange={(e) => setClassSearchQuery(e.target.value)}
                      placeholder="반 검색..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {filteredClasses.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">
                        {classes.length === 0 ? '등록된 반이 없습니다' : '검색 결과 없음'}
                      </p>
                    ) : (
                      filteredClasses.map(cls => (
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

              {/* 대상 선택: 학교별 */}
              {newExam.scope === 'school' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">대상 학교 선택</label>
                  {/* 검색 필드 */}
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={schoolSearchQuery}
                      onChange={(e) => setSchoolSearchQuery(e.target.value)}
                      placeholder="학교 검색..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {filteredSchools.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">
                        {availableSchools.length === 0 ? '등록된 학교가 없습니다' : '검색 결과 없음'}
                      </p>
                    ) : (
                      filteredSchools.map(school => (
                        <label key={school} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newExam.targetSchools.includes(school)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewExam(prev => ({ ...prev, targetSchools: [...prev.targetSchools, school] }));
                              } else {
                                setNewExam(prev => ({ ...prev, targetSchools: prev.targetSchools.filter(s => s !== school) }));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{school}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {newExam.targetSchools.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">{newExam.targetSchools.length}개 학교 선택됨</p>
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
