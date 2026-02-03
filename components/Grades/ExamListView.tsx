import React from 'react';
import { Exam, StudentScore, EXAM_TYPE_LABELS, GRADE_COLORS, calculateGrade } from '../../types';
import { GraduationCap, ChevronDown, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import { SUBJECT_COLORS, SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';

interface ExamListViewProps {
  filteredExams: Exam[];
  expandedExamId: string | null;
  onToggleExpand: (examId: string | null) => void;
  examScores: StudentScore[];
  loadingScores: boolean;
  onStartScoreInput: (exam: Exam) => void;
  onDeleteExam: (examId: string) => void;
  canEditGrades: boolean;
  canManageExams: boolean;
}

const ExamListView: React.FC<ExamListViewProps> = ({
  filteredExams,
  expandedExamId,
  onToggleExpand,
  examScores,
  loadingScores,
  onStartScoreInput,
  onDeleteExam,
  canEditGrades,
  canManageExams,
}) => {
  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      {/* 헤더 행 */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-[#373d41] whitespace-nowrap">
        <span className="w-20 shrink-0">날짜</span>
        <span className="flex-1 min-w-[200px]">시험명</span>
        <span className="w-14 shrink-0 text-center">과목</span>
        <span className="w-16 shrink-0 text-center">유형</span>
        <span className="w-14 shrink-0 text-center">응시</span>
        <span className="w-14 shrink-0 text-center">평균</span>
        <span className="w-14 shrink-0 text-center">최고</span>
        <span className="w-14 shrink-0 text-center">최저</span>
        <span className="w-24 shrink-0 text-right">액션</span>
      </div>

      {filteredExams.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>등록된 시험이 없습니다</p>
          <p className="text-sm mt-1">상단의 '시험 등록' 버튼으로 새 시험을 추가하세요</p>
        </div>
      ) : (
        filteredExams.map(exam => {
          const stats = exam.stats || { count: 0, avg: 0, max: 0, min: 0 };
          const isExpanded = expandedExamId === exam.id;

          return (
            <div key={exam.id}>
              {/* 시험 행 */}
              <div
                className="flex items-center gap-4 px-4 py-1.5 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group whitespace-nowrap"
                onClick={() => onToggleExpand(isExpanded ? null : exam.id)}
              >
                {/* 날짜 */}
                <span className="text-xs text-[#373d41] w-20 shrink-0">
                  {exam.date}
                </span>

                {/* 시험명 */}
                <span className="text-xs font-medium text-[#081429] flex-1 min-w-[200px] truncate">
                  {exam.title}
                </span>

                {/* 과목 뱃지 */}
                <span className="w-14 shrink-0 text-center">
                  <span className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${
                      exam.subject === 'both' ? SUBJECT_COLORS.other.badge :
                      SUBJECT_COLORS[exam.subject as SubjectType]?.badge || SUBJECT_COLORS.other.badge
                    }`}>
                    {exam.subject === 'both' ? '통합' : SUBJECT_LABELS[exam.subject as SubjectType] || exam.subject}
                  </span>
                </span>

                {/* 유형 */}
                <span className="w-16 shrink-0 text-center">
                  <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                    {EXAM_TYPE_LABELS[exam.type]}
                  </span>
                </span>

                {/* 응시 */}
                <span className="w-14 shrink-0 text-center text-xs text-gray-600">
                  {stats.count}명
                </span>

                {/* 평균 */}
                <span className="w-14 shrink-0 text-center text-xs font-medium text-gray-900">
                  {stats.count > 0 ? `${stats.avg}` : '-'}
                </span>

                {/* 최고 */}
                <span className="w-14 shrink-0 text-center text-xs font-medium text-green-600">
                  {stats.count > 0 ? stats.max : '-'}
                </span>

                {/* 최저 */}
                <span className="w-14 shrink-0 text-center text-xs font-medium text-red-600">
                  {stats.count > 0 ? stats.min : '-'}
                </span>

                {/* 액션 버튼들 - 권한 체크 */}
                <div className="flex items-center gap-1.5 w-24 shrink-0 justify-end">
                  {canEditGrades ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartScoreInput(exam); }}
                      className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                    >
                      입력
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartScoreInput(exam); }}
                      className="px-2 py-0.5 text-xs bg-gray-50 text-gray-400 rounded"
                      title="조회만 가능합니다"
                    >
                      조회
                    </button>
                  )}
                  {canManageExams && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('이 시험을 삭제하시겠습니까?')) {
                          onDeleteExam(exam.id);
                        }
                      }}
                      className="p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* 확장된 성적 목록 */}
              {isExpanded && (
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  {loadingScores ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : examScores.length === 0 ? (
                    <p className="text-center text-gray-500 py-4 text-sm">입력된 성적이 없습니다</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                      {examScores
                        .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
                        .map((score, idx) => {
                          const grade = score.grade || calculateGrade(score.percentage || 0);
                          return (
                            <div
                              key={score.id}
                              className="bg-white rounded px-2 py-1.5 border border-gray-200 flex items-center justify-between text-xs"
                            >
                              <div className="truncate">
                                <span className="text-gray-400 mr-1">{idx + 1}.</span>
                                <span className="font-medium text-gray-900">{score.studentName || '학생'}</span>
                              </div>
                              <span className={`ml-1 px-1.5 py-0.5 text-xs font-semibold rounded ${GRADE_COLORS[grade].bg} ${GRADE_COLORS[grade].text}`}>
                                {score.score}
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
  );
};

export default ExamListView;
