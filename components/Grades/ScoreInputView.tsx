import React, { useMemo } from 'react';
import { UnifiedStudent, Exam } from '../../types';
import { formatSchoolGrade } from '../../utils/studentUtils';
import { Save, Search, X, Eye, Edit, Check, Trash2, Lock, Loader2 } from 'lucide-react';

interface ScoreInputViewProps {
  selectedExam: Exam;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  canEditGrades: boolean;
  scoreInputs: Record<string, { score: string; avg?: string; rank?: string }>;
  onScoreInputChange: (studentId: string, field: 'score' | 'avg' | 'rank', value: string) => void;
  addedStudents: UnifiedStudent[];
  studentSearchQuery: string;
  onStudentSearchChange: (value: string) => void;
  searchedStudents: UnifiedStudent[];
  onAddStudent: (studentId: string) => void;
  onRemoveStudent: (studentId: string) => void;
  editingStudentIds: string[];
  onToggleEdit: (studentId: string) => void;
  onViewStudentDetail: (student: UnifiedStudent) => void;
}

const ScoreInputView: React.FC<ScoreInputViewProps> = ({
  selectedExam,
  onCancel,
  onSave,
  isSaving,
  canEditGrades,
  scoreInputs,
  onScoreInputChange,
  addedStudents,
  studentSearchQuery,
  onStudentSearchChange,
  searchedStudents,
  onAddStudent,
  onRemoveStudent,
  editingStudentIds,
  onToggleEdit,
  onViewStudentDetail,
}) => {
  // 점수 입력된 학생들만 추출하여 평균/석차 계산
  const { avg, rankMap, studentsWithScores } = useMemo(() => {
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

    return { avg, rankMap, studentsWithScores };
  }, [addedStudents, scoreInputs]);

  return (
    <div className="bg-white border border-gray-200">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div>
          <h2 className="font-bold text-sm text-[#081429]">{selectedExam.title}</h2>
          <p className="text-xs text-gray-500">
            {selectedExam.date} | {selectedExam.subject === 'both' ? '통합' : selectedExam.subject === 'math' ? '수학' : '영어'} | 만점 {selectedExam.maxScore}점
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCancel}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            취소
          </button>
          {canEditGrades ? (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              <span>저장</span>
            </button>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400" title="성적 수정 권한이 필요합니다">
              <Lock className="w-3 h-3" />
              저장
            </span>
          )}
        </div>
      </div>

      {/* 학생 검색/추가 UI - 컴팩트 */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={(e) => onStudentSearchChange(e.target.value)}
              placeholder="학생 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {addedStudents.length > 0 && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                {addedStudents.length}명
              </span>
            )}
          </div>
          {/* 검색 결과 드롭다운 - 컴팩트 */}
          {searchedStudents.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-auto">
              {searchedStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => onAddStudent(student.id)}
                  className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-medium text-gray-900">{student.name}</span>
                    {student.englishName && (
                      <span className="ml-2 text-xs text-gray-500">{student.englishName}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{student.grade || '-'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-420px)]">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="border-b border-gray-200">
              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 w-32">이름</th>
              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-600 w-24">학교/학년</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold text-gray-600 w-16">점수</th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold text-gray-600 w-14">
                평균
                <span className="block text-micro font-normal text-gray-400">
                  {avg ? avg : '-'}
                </span>
              </th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold text-gray-600 w-14">
                석차
                <span className="block text-micro font-normal text-gray-400">
                  /{studentsWithScores.length || addedStudents.length}
                </span>
              </th>
              <th className="px-2 py-1.5 text-center text-xs font-semibold text-gray-600 w-12">등급</th>
              <th className="px-2 py-1.5 w-24 text-center text-xs font-semibold text-gray-600">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {addedStudents.map(student => {
              const input = scoreInputs[student.id] || { score: '' };
              const score = input.score ? Number(input.score) : null;
              const studentRank = score !== null ? rankMap[student.id] : null;
              const schoolGrade = formatSchoolGrade(student.school, student.grade);
              const isEditing = editingStudentIds.includes(student.id);

              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5">
                    <div className="font-medium text-gray-900 text-xs">{student.name}</div>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-gray-600">{schoolGrade}</td>
                  <td className="px-2 py-1.5 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        value={input.score || ''}
                        onChange={(e) => onScoreInputChange(student.id, 'score', e.target.value)}
                        placeholder="-"
                        min={0}
                        max={selectedExam.maxScore}
                        className="w-14 px-1.5 py-0.5 text-center text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className={`text-xs ${input.score ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                        {input.score || '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-gray-600">
                    {/* 평균은 자동 계산된 값(전체 평균)을 표시 */}
                    <span>{avg || '-'}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs font-medium text-gray-800">
                    {studentRank !== null ? studentRank : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-gray-400">
                    -
                  </td>
                  <td className="px-2 py-1.5 text-center flex items-center justify-center gap-0.5">
                    <button
                      onClick={() => onViewStudentDetail(student)}
                      className="p-0.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="학생 상세"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onToggleEdit(student.id)}
                      className={`p-0.5 rounded transition-colors ${isEditing ? 'text-green-600 hover:bg-green-50' : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}
                      title={isEditing ? "완료" : "수정"}
                    >
                      {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onRemoveStudent(student.id)}
                      className="p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="학생 제거"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScoreInputView;
