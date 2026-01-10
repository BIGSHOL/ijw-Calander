import React, { useState } from 'react';
import { X, Plus, BookOpen, User, Calendar, Users } from 'lucide-react';
import { useCreateClass, CreateClassData } from '../../hooks/useClassMutations';
import { useStudents } from '../../hooks/useStudents';

interface AddClassModalProps {
  onClose: () => void;
  defaultSubject?: 'math' | 'english';
}

const AddClassModal: React.FC<AddClassModalProps> = ({ onClose, defaultSubject = 'math' }) => {
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState<'math' | 'english'>(defaultSubject);
  const [teacher, setTeacher] = useState('');
  const [scheduleInput, setScheduleInput] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Hooks
  const { students, loading: studentsLoading } = useStudents(false);
  const createClassMutation = useCreateClass();

  // 학생 선택/해제
  const toggleStudent = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds(selectedStudentIds.filter(id => id !== studentId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, studentId]);
    }
  };

  // 모든 학생 선택/해제
  const toggleAllStudents = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map(s => s.id));
    }
  };

  // 저장
  const handleSave = async () => {
    // 유효성 검사
    if (!className.trim()) {
      setError('수업명을 입력해주세요.');
      return;
    }
    if (!teacher.trim()) {
      setError('강사명을 입력해주세요.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      setError('최소 1명 이상의 학생을 선택해주세요.');
      return;
    }

    setError('');

    // 스케줄 파싱 (쉼표로 구분)
    const schedule = scheduleInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const classData: CreateClassData = {
      className: className.trim(),
      teacher: teacher.trim(),
      subject,
      schedule,
      studentIds: selectedStudentIds,
    };

    try {
      await createClassMutation.mutateAsync(classData);
      onClose();
    } catch (err) {
      console.error('[AddClassModal] Error creating class:', err);
      setError('수업 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="bg-[#081429] text-white p-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Plus className="w-6 h-6" />
            <h2 className="text-xl font-bold">새 수업 추가</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* 수업 정보 입력 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-[#081429]" />
              <h3 className="text-[#081429] font-bold text-lg">수업 정보</h3>
            </div>

            <div className="space-y-4">
              {/* 수업명 */}
              <div>
                <label className="block text-[#373d41] text-sm font-medium mb-2">
                  수업명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="예: 중등수학1-1"
                  className="w-full px-4 py-2 border border-[#081429] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] text-[#081429]"
                />
              </div>

              {/* 과목 */}
              <div>
                <label className="block text-[#373d41] text-sm font-medium mb-2">
                  과목 <span className="text-red-500">*</span>
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value as 'math' | 'english')}
                  className="w-full px-4 py-2 border border-[#081429] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] text-[#081429]"
                >
                  <option value="math">수학</option>
                  <option value="english">영어</option>
                </select>
              </div>

              {/* 강사명 */}
              <div>
                <label className="block text-[#373d41] text-sm font-medium mb-2">
                  강사명 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#373d41]" />
                  <input
                    type="text"
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value)}
                    placeholder="예: 김선생님"
                    className="w-full pl-10 pr-4 py-2 border border-[#081429] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] text-[#081429]"
                  />
                </div>
              </div>

              {/* 스케줄 */}
              <div>
                <label className="block text-[#373d41] text-sm font-medium mb-2">
                  스케줄 (선택)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#373d41]" />
                  <input
                    type="text"
                    value={scheduleInput}
                    onChange={(e) => setScheduleInput(e.target.value)}
                    placeholder="예: 월 1교시, 수 3교시 (쉼표로 구분)"
                    className="w-full pl-10 pr-4 py-2 border border-[#081429] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] text-[#081429]"
                  />
                </div>
                <p className="text-xs text-[#373d41] mt-1">
                  쉼표(,)로 구분하여 입력하세요.
                </p>
              </div>
            </div>
          </div>

          {/* 학생 선택 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#081429]" />
                <h3 className="text-[#081429] font-bold text-lg">
                  학생 선택 <span className="text-red-500">*</span>
                </h3>
              </div>
              <button
                onClick={toggleAllStudents}
                className="text-[#fdb813] hover:text-[#e5a60f] text-sm font-semibold"
              >
                {selectedStudentIds.length === students.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>

            {studentsLoading ? (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <p className="text-[#373d41]">학생 목록을 불러오는 중...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#373d41]" />
                <p className="text-[#373d41]">등록된 학생이 없습니다.</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto border border-[#081429] border-opacity-10">
                <div className="space-y-2">
                  {students.map(student => (
                    <label
                      key={student.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedStudentIds.includes(student.id)
                          ? 'bg-[#fdb813] bg-opacity-20 border border-[#fdb813]'
                          : 'bg-white border border-[#081429] border-opacity-10 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="w-5 h-5 text-[#fdb813] rounded focus:ring-[#fdb813]"
                      />
                      <div className="flex-1">
                        <p className="text-[#081429] font-semibold">{student.name}</p>
                        <p className="text-[#373d41] text-xs">
                          {student.grade || '학년 미정'} | {student.status === 'active' ? '재원생' : student.status === 'on_hold' ? '대기' : '퇴원'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sm text-[#373d41] mt-2">
              선택된 학생: <span className="text-[#fdb813] font-semibold">{selectedStudentIds.length}명</span>
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="bg-gray-50 p-4 flex items-center justify-end gap-3 border-t border-[#081429] border-opacity-10 sticky bottom-0">
          <button
            onClick={onClose}
            disabled={createClassMutation.isPending}
            className="px-6 py-2 border border-[#081429] text-[#081429] rounded-lg font-semibold hover:bg-[#081429] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={createClassMutation.isPending}
            className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createClassMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddClassModal;
