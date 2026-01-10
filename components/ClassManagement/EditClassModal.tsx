import React, { useState } from 'react';
import { X, Edit, BookOpen, User, Calendar } from 'lucide-react';
import { useUpdateClass, UpdateClassData } from '../../hooks/useClassMutations';
import { ClassInfo } from '../../hooks/useClasses';

interface EditClassModalProps {
  classInfo: ClassInfo;
  onClose: () => void;
}

const EditClassModal: React.FC<EditClassModalProps> = ({ classInfo, onClose }) => {
  const [className, setClassName] = useState(classInfo.className);
  const [teacher, setTeacher] = useState(classInfo.teacher);
  const [scheduleInput, setScheduleInput] = useState(classInfo.schedule?.join(', ') || '');
  const [error, setError] = useState('');

  const updateClassMutation = useUpdateClass();

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

    setError('');

    // 스케줄 파싱 (쉼표로 구분)
    const schedule = scheduleInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const updateData: UpdateClassData = {
      originalClassName: classInfo.className,
      originalSubject: classInfo.subject,
      newClassName: className.trim(),
      newTeacher: teacher.trim(),
      newSchedule: schedule,
    };

    try {
      await updateClassMutation.mutateAsync(updateData);
      onClose();
    } catch (err) {
      console.error('[EditClassModal] Error updating class:', err);
      setError('수업 수정에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="bg-[#081429] text-white p-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Edit className="w-6 h-6" />
            <h2 className="text-xl font-bold">수업 편집</h2>
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

              {/* 과목 (읽기 전용) */}
              <div>
                <label className="block text-[#373d41] text-sm font-medium mb-2">
                  과목
                </label>
                <input
                  type="text"
                  value={classInfo.subject === 'math' ? '수학' : '영어'}
                  disabled
                  className="w-full px-4 py-2 border border-[#081429] rounded-lg bg-gray-100 text-[#373d41] cursor-not-allowed"
                />
                <p className="text-xs text-[#373d41] mt-1">
                  과목은 수정할 수 없습니다.
                </p>
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

          {/* 정보 박스 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>안내:</strong> 수업 정보를 수정하면 해당 수업에 등록된 모든 학생의 정보가 함께 업데이트됩니다.
            </p>
            <p className="text-blue-700 text-xs mt-2">
              현재 {classInfo.studentCount || 0}명의 학생이 이 수업에 등록되어 있습니다.
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="bg-gray-50 p-4 flex items-center justify-end gap-3 border-t border-[#081429] border-opacity-10 sticky bottom-0">
          <button
            onClick={onClose}
            disabled={updateClassMutation.isPending}
            className="px-6 py-2 border border-[#081429] text-[#081429] rounded-lg font-semibold hover:bg-[#081429] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={updateClassMutation.isPending}
            className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateClassMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditClassModal;
