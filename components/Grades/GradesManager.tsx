import React, { useState, useMemo, useEffect } from 'react';
import { UnifiedStudent, Exam, StudentScore, ExamType, ExamScope, UserProfile } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import { useExams, useCreateExam, useUpdateExam, useDeleteExam } from '../../hooks/useExams';
import { useClasses, GRADE_OPTIONS } from '../../hooks/useClasses';
import { useExamSeries, useCreateExamSeries } from '../../hooks/useExamSeries';
import { usePermissions } from '../../hooks/usePermissions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
  Plus, Trash2, X, BookOpen, BarChart3, Search, Loader2, Lock, Zap, ClipboardList
} from 'lucide-react';
import GradesTab from '../StudentManagement/tabs/GradesTab';
import { TabSubNavigation } from '../Common/TabSubNavigation';
import { TabButton } from '../Common/TabButton';
import { useExamScores } from './hooks/useExamScores';
import { useConsultationLevelTests, ConsultationLevelTest } from '../../hooks/useGradeProfile';
import { LevelTest } from '../../types';
import ConsultationLevelTestDetail from './ConsultationLevelTestDetail';
import ExamCreateModal from './ExamCreateModal';
import ScoreInputView from './ScoreInputView';
import ExamListView from './ExamListView';
import { calculateGrade } from '../../types';

type ViewMode = 'exams' | 'students' | 'input' | 'levelTests';

interface GradesManagerProps {
  subjectFilter: 'all' | 'math' | 'english';
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSubjectFilterChange?: (filter: 'all' | 'math' | 'english') => void;
  currentUser?: UserProfile | null;
}

const GradesManager: React.FC<GradesManagerProps> = ({ subjectFilter, searchQuery, onSearchChange, onSubjectFilterChange, currentUser }) => {
  const queryClient = useQueryClient();

  // 권한 체크
  const { hasPermission } = usePermissions(currentUser || null);
  const isMaster = currentUser?.role === 'master';
  const canViewGrades = isMaster || hasPermission('grades.view');
  const canEditGrades = isMaster || hasPermission('grades.edit');
  const canManageExams = isMaster || hasPermission('grades.manage_exams');

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('exams');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<UnifiedStudent | null>(null);
  const [selectedLevelTestDetail, setSelectedLevelTestDetail] = useState<ConsultationLevelTest | null>(null);

  // Data
  const { students } = useStudents();
  const { data: exams = [], isLoading: loadingExams, refetch: refetchExams } = useExams();
  const { data: examScores = [], isLoading: loadingScores } = useExamScores(selectedExam?.id || expandedExamId || '');
  const { data: allLevelTests = [], isLoading: loadingLevelTests } = useConsultationLevelTests(subjectFilter);

  // Mutations
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const deleteExamMutation = useDeleteExam();

  // 성적 일괄 입력/수정 mutation
  const batchAddScores = useMutation({
    mutationFn: async (scores: Omit<StudentScore, 'id' | 'createdAt' | 'updatedAt'>[]) => {
      const batch = writeBatch(db);
      const now = Date.now();

      const examId = scores[0]?.examId;
      if (!examId) return;

      const existingScoresQuery = query(
        collection(db, 'student_scores'),
        where('examId', '==', examId)
      );
      const existingSnapshot = await getDocs(existingScoresQuery);
      const existingScoresMap: Record<string, string> = {};
      existingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        existingScoresMap[data.studentId] = doc.id;
      });

      scores.forEach(scoreData => {
        const percentage = (scoreData.score / scoreData.maxScore) * 100;
        const grade = calculateGrade(percentage);
        const existingDocId = existingScoresMap[scoreData.studentId];

        if (existingDocId) {
          const docRef = doc(db, 'student_scores', existingDocId);
          batch.update(docRef, {
            ...scoreData,
            percentage,
            grade,
            updatedAt: now,
          });
        } else {
          const docRef = doc(collection(db, 'student_scores'));
          batch.set(docRef, {
            ...scoreData,
            percentage,
            grade,
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_scores'] });
      queryClient.invalidateQueries({ queryKey: ['exam_scores'] });
      queryClient.invalidateQueries({ queryKey: ['student_scores'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
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

  // 레벨테스트 검색 필터
  const filteredLevelTests = useMemo(() => {
    if (!searchQuery) return allLevelTests;
    const q = searchQuery.toLowerCase();
    return allLevelTests.filter(t =>
      (t.studentName || '').toLowerCase().includes(q)
    );
  }, [allLevelTests, searchQuery]);

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
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');

  // 성적 입력 상태
  const [scoreInputs, setScoreInputs] = useState<Record<string, { score: string; avg?: string; rank?: string }>>({});
  const [addedStudentIds, setAddedStudentIds] = useState<string[]>([]);
  const [editingStudentIds, setEditingStudentIds] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // 성적 데이터 로딩 및 초기화
  useEffect(() => {
    if (viewMode !== 'input' || !selectedExam) return;

    if (Object.keys(scoreInputs).length > 0 && examScores.length > 0) return;

    const initialInputs: Record<string, { score: string; avg?: string; rank?: string }> = {};
    const existingStudentIds: string[] = [];

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

    setScoreInputs(prev => Object.keys(prev).length === 0 ? initialInputs : prev);
    setAddedStudentIds(mergedIds);

  }, [viewMode, selectedExam, examScores, students]);

  // 반/시리즈 데이터
  const { data: classes = [] } = useClasses(newExam.subject === 'both' ? undefined : newExam.subject);

  // 학교 목록 추출
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
    if (!newExam.title || !currentUser) return;

    await createExam.mutateAsync({
      ...newExam,
      createdBy: currentUser.uid,
      createdByName: currentUser.displayName || currentUser.email || '',
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

  // 검색된 학생 목록
  const searchedStudents = useMemo(() => {
    if (!studentSearchQuery.trim() || !selectedExam) return [];

    const query = studentSearchQuery.toLowerCase();
    return students.filter(s => {
      if (addedStudentIds.includes(s.id)) return false;
      const matchesQuery = (s.name || '').toLowerCase().includes(query) ||
        s.englishName?.toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (s.status !== 'active') return false;
      return true;
    }).slice(0, 10);
  }, [students, studentSearchQuery, addedStudentIds, selectedExam]);

  // 추가된 학생 객체 목록
  const addedStudents = useMemo(() => {
    return addedStudentIds.map(id => students.find(s => s.id === id)).filter(Boolean) as typeof students;
  }, [addedStudentIds, students]);

  const handleBatchSaveScores = async () => {
    if (!selectedExam || !currentUser) return;

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
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.displayName || currentUser?.email || '',
      };
    });

    if (scoresToSave.length > 0) {
      await batchAddScores.mutateAsync(scoresToSave);

      await updateExam.mutateAsync({
        id: selectedExam.id,
        updates: {
          stats: {
            count: validEntries.length,
            avg: Math.round(avgScore),
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
      const scoresSnapshot = await getDocs(collection(db, 'student_scores'));
      const scores = scoresSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudentScore));

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
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-2" />
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 상단 네비게이션 바 */}
      <TabSubNavigation variant="compact" className="px-6 py-2 border-b border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex flex-wrap items-center gap-3">
            {/* 뷰 토글: 시험 / 레벨테스트 */}
            <div className="flex bg-white/10 rounded-sm p-0.5 border border-white/10 shadow-sm">
              <TabButton
                active={viewMode !== 'levelTests'}
                onClick={() => setViewMode('exams')}
                icon={<ClipboardList className="w-4 h-4" />}
                className="px-3 py-1"
              >
                시험
              </TabButton>
              <TabButton
                active={viewMode === 'levelTests'}
                onClick={() => setViewMode('levelTests')}
                icon={<Zap className="w-4 h-4" />}
                className="px-3 py-1"
              >
                레벨테스트
              </TabButton>
            </div>

            {/* 구분선 */}
            <div className="w-px h-4 bg-white/20"></div>

            {/* 과목 토글 */}
            <div className="flex bg-white/10 rounded-sm p-0.5 border border-white/10 shadow-sm">
              <TabButton
                active={subjectFilter === 'all'}
                onClick={() => onSubjectFilterChange?.('all')}
                icon={<BookOpen className="w-4 h-4" />}
                className="px-3 py-1"
              >
                전체
              </TabButton>
              <TabButton
                active={subjectFilter === 'math'}
                onClick={() => onSubjectFilterChange?.('math')}
                className="px-3 py-1"
              >
                수학
              </TabButton>
              <TabButton
                active={subjectFilter === 'english'}
                onClick={() => onSubjectFilterChange?.('english')}
                className="px-3 py-1"
              >
                영어
              </TabButton>
            </div>

            {/* 구분선 */}
            <div className="w-px h-4 bg-white/20"></div>

            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={viewMode === 'levelTests' ? '학생명 검색...' : '시험명 검색...'}
                className="bg-[#1e293b] border border-gray-700 rounded-sm pl-8 pr-3 py-1 text-xs text-white placeholder-gray-500 focus:border-accent focus:ring-1 focus:ring-accent outline-none w-48"
              />
            </div>
          </div>

          {/* 우측: 결과 카운트, 버튼들 */}
          <div className="flex items-center gap-2">
            {viewMode === 'levelTests' ? (
              <span className="text-gray-400 text-xs">
                총 <span className="text-accent font-bold">{filteredLevelTests.length}</span>개 레벨테스트
              </span>
            ) : (
              <span className="text-gray-400 text-xs">
                총 <span className="text-accent font-bold">{filteredExams.length}</span>개 시험
              </span>
            )}

            {viewMode !== 'levelTests' && (
              <>
                {/* 통계 갱신 버튼 */}
                <button
                  onClick={handleMigrateStats}
                  disabled={isMigrating}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-white/10 text-gray-300 rounded hover:bg-white/20 transition-colors border border-white/20 font-bold"
                  title="DB 최적화: 통계 재계산"
                >
                  {isMigrating ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
                  <span>통계 갱신</span>
                </button>

                {/* 새 시험 등록 버튼 */}
                {canManageExams ? (
                  <button
                    onClick={() => setIsCreatingExam(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-sm bg-accent text-primary hover:bg-[#e5a60f] transition-colors shadow-sm font-bold"
                  >
                    <Plus size={14} />
                    <span>시험 등록</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1 text-xs text-gray-400" title="시험 관리 권한이 필요합니다">
                    <Lock size={12} />
                    시험 등록
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </TabSubNavigation>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'levelTests' ? (
          /* 레벨테스트 모아보기 */
          <LevelTestListView
            levelTests={filteredLevelTests}
            loading={loadingLevelTests}
            students={students}
            onRowClick={(test) => {
              const clt = test as ConsultationLevelTest;
              if (clt._sourceDetail) {
                setSelectedLevelTestDetail(clt);
              }
            }}
          />
        ) : viewMode === 'input' && selectedExam ? (
          <ScoreInputView
            selectedExam={selectedExam}
            onCancel={() => { setViewMode('exams'); setSelectedExam(null); }}
            onSave={handleBatchSaveScores}
            isSaving={batchAddScores.isPending}
            canEditGrades={canEditGrades}
            scoreInputs={scoreInputs}
            onScoreInputChange={handleScoreInputChange}
            addedStudents={addedStudents}
            studentSearchQuery={studentSearchQuery}
            onStudentSearchChange={setStudentSearchQuery}
            searchedStudents={searchedStudents}
            onAddStudent={handleAddStudent}
            onRemoveStudent={handleRemoveStudent}
            editingStudentIds={editingStudentIds}
            onToggleEdit={handleToggleEdit}
            onViewStudentDetail={setSelectedStudentForDetail}
          />
        ) : (
          <ExamListView
            filteredExams={filteredExams}
            expandedExamId={expandedExamId}
            onToggleExpand={setExpandedExamId}
            examScores={examScores}
            loadingScores={loadingScores}
            onStartScoreInput={startScoreInput}
            onDeleteExam={(examId) => deleteExamMutation.mutate(examId)}
            canEditGrades={canEditGrades}
            canManageExams={canManageExams}
          />
        )}
      </div>

      {/* 시험 등록 모달 */}
      <ExamCreateModal
        isOpen={isCreatingExam}
        onClose={() => setIsCreatingExam(false)}
        onSubmit={handleCreateExam}
        isSubmitting={createExam.isPending}
        newExam={newExam}
        setNewExam={setNewExam}
        tagInput={tagInput}
        setTagInput={setTagInput}
        classSearchQuery={classSearchQuery}
        setClassSearchQuery={setClassSearchQuery}
        schoolSearchQuery={schoolSearchQuery}
        setSchoolSearchQuery={setSchoolSearchQuery}
        filteredClasses={filteredClasses}
        filteredSchools={filteredSchools}
        classes={classes}
        availableSchools={availableSchools}
      />

      {/* 학생 상세 슬라이드 패널 */}
      {selectedStudentForDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end" onClick={() => setSelectedStudentForDetail(null)}>
          <div
            className="bg-white h-full w-full max-w-2xl overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 패널 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between z-10">
              <div>
                <h3 className="text-sm font-bold text-primary">{selectedStudentForDetail.name} 성적 프로필</h3>
                <p className="text-xs text-gray-500">조회 전용</p>
              </div>
              <button
                onClick={() => setSelectedStudentForDetail(null)}
                className="p-1.5 hover:bg-gray-100 rounded-sm transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* GradesTab 컴포넌트 재사용 */}
            <div className="p-3">
              <GradesTab student={selectedStudentForDetail} readOnly={true} />
            </div>
          </div>
        </div>
      )}

      {/* 레벨테스트 상세 슬라이드 패널 */}
      {selectedLevelTestDetail && (
        <ConsultationLevelTestDetail
          test={selectedLevelTestDetail}
          onClose={() => setSelectedLevelTestDetail(null)}
        />
      )}
    </div>
  );
};

// ============ 레벨테스트 모아보기 컴포넌트 ============

interface LevelTestListViewProps {
  levelTests: LevelTest[];
  loading: boolean;
  students: UnifiedStudent[];
  onRowClick: (test: LevelTest) => void;
}

const LevelTestListView: React.FC<LevelTestListViewProps> = ({ levelTests, loading, students, onRowClick }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-accent mr-2" />
        <span className="text-gray-500 text-sm">레벨테스트 로딩 중...</span>
      </div>
    );
  }

  if (levelTests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Zap size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">등록된 레벨테스트가 없습니다</p>
        <p className="text-xs mt-1">등록 상담에서 레벨테스트 데이터가 있는 항목만 표시됩니다</p>
      </div>
    );
  }

  // 날짜별 그룹핑
  const groupedByDate = levelTests.reduce<Record<string, LevelTest[]>>((acc, test) => {
    const date = test.testDate || '날짜 없음';
    if (!acc[date]) acc[date] = [];
    acc[date].push(test);
    return acc;
  }, {});

  const handleClickRow = (test: LevelTest) => {
    onRowClick(test);
  };

  return (
    <div className="space-y-4">
      {Object.entries(groupedByDate).map(([date, tests]) => (
        <div key={date} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          {/* 날짜 헤더 */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-primary">{date}</span>
              <span className="text-xs text-gray-400">({tests.length}건)</span>
            </div>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-3 py-2 font-medium text-gray-500 w-24">학생</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-500 w-16">과목</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-500 w-16">유형</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-500">세부 결과</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-500 w-20">레벨</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-500 w-16">평가자</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => {
                  const isMath = test.subject === 'math';
                  const hasMathDetail = isMath && (test.calculationScore || test.myTotalScore);
                  const hasEngDetail = !isMath && test.englishTestType;
                  const engTestLabel = test.englishTestType === 'ai' ? 'AI' : test.englishTestType === 'nelt' ? 'NELT' : test.englishTestType === 'eie' ? 'EiE' : '';
                  const testTypeLabel = test.testType === 'placement' ? '배치' : test.testType === 'promotion' ? '승급' : '진단';

                  return (
                    <tr
                      key={test.id}
                      className="border-b border-gray-50 hover:bg-accent/5 transition-colors cursor-pointer"
                      onClick={() => handleClickRow(test)}
                    >
                      {/* 학생명 */}
                      <td className="px-3 py-2">
                        <span className="font-medium text-primary hover:text-accent transition-colors">
                          {test.studentName}
                        </span>
                      </td>

                      {/* 과목 */}
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded-sm text-micro font-medium ${isMath ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isMath ? '수학' : '영어'}
                        </span>
                        {hasEngDetail && (
                          <span className="ml-1 inline-block px-1 py-0.5 rounded-sm text-micro font-medium bg-indigo-100 text-indigo-700">
                            {engTestLabel}
                          </span>
                        )}
                      </td>

                      {/* 유형 */}
                      <td className="px-2 py-2 text-center">
                        <span className="text-gray-600">{testTypeLabel}</span>
                      </td>

                      {/* 세부 결과 */}
                      <td className="px-2 py-2">
                        {hasMathDetail ? (
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {[
                                { label: '계산', val: test.calculationScore },
                                { label: '이해', val: test.comprehensionScore },
                                { label: '추론', val: test.reasoningScore },
                                { label: '문해', val: test.problemSolvingScore },
                              ].filter(i => i.val).map(item => (
                                <span key={item.label} className="px-1 py-0.5 bg-emerald-50 text-emerald-700 rounded text-micro">
                                  {item.label}:{item.val}
                                </span>
                              ))}
                            </div>
                            {test.myTotalScore && (
                              <span className="text-gray-600">
                                내점수:<b>{test.myTotalScore}</b>
                                {test.averageScore && <> 평균:{test.averageScore}</>}
                                {test.scoreGrade && <> 등급:{test.scoreGrade}</>}
                              </span>
                            )}
                          </div>
                        ) : hasEngDetail ? (
                          <div className="flex items-center gap-2">
                            {test.englishTestType === 'ai' && (
                              <span className="text-gray-600">
                                {test.engAiGradeLevel && `${test.engAiGradeLevel}수준`}
                                {test.engAiArIndex && ` AR:${test.engAiArIndex}`}
                                {test.engAiTopPercent && ` 상위${test.engAiTopPercent}`}
                              </span>
                            )}
                            {test.englishTestType === 'nelt' && (
                              <span className="text-gray-600">
                                {test.engNeltOverallLevel && `레벨:${test.engNeltOverallLevel}`}
                                {test.engNeltRank && ` 석차:${test.engNeltRank}`}
                                {test.engNeltVocab && ` 어휘:${test.engNeltVocab}`}
                              </span>
                            )}
                            {test.englishTestType === 'eie' && (
                              <span className="text-gray-600">
                                {test.engEieGradeLevel && `${test.engEieGradeLevel}수준`}
                                {test.engEieRank && ` 순위:${test.engEieRank}`}
                                {test.engEieCourse && ` 과정:${test.engEieCourse}`}
                              </span>
                            )}
                          </div>
                        ) : test.percentage != null ? (
                          <span className="font-bold text-primary">{test.percentage.toFixed(0)}%</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* 레벨 */}
                      <td className="px-2 py-2 text-center">
                        {test.engLevel ? (
                          <span className="font-bold text-blue-700">Lv {test.engLevel}</span>
                        ) : test.recommendedLevel ? (
                          <span className="font-bold text-indigo-600">{test.recommendedLevel}</span>
                        ) : test.scoreGrade ? (
                          <span className="font-bold text-emerald-700">{test.scoreGrade}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* 평가자 */}
                      <td className="px-2 py-2 text-center text-gray-500">
                        {test.evaluatorName || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GradesManager;
