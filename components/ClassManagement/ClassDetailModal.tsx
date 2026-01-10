import React, { useState } from 'react';
import { X, Edit, Trash2, Users, Clock, User, BookOpen, Calendar } from 'lucide-react';
import { ClassInfo } from '../../hooks/useClasses';
import { useClassDetail } from '../../hooks/useClassDetail';
import { useDeleteClass } from '../../hooks/useClassMutations';
import ClassStudentList from './ClassStudentList';
import EditClassModal from './EditClassModal';

interface ClassDetailModalProps {
  classInfo: ClassInfo;
  onClose: () => void;
  onStudentClick?: (studentId: string) => void;
}

const ClassDetailModal: React.FC<ClassDetailModalProps> = ({ classInfo, onClose, onStudentClick }) => {
  const { className, teacher, subject, schedule, studentCount } = classInfo;
  const [showEditModal, setShowEditModal] = useState(false);

  // 수업 상세 정보 조회 (학생 목록 포함)
  const { data: classDetail, isLoading: detailLoading } = useClassDetail(className, subject);
  const deleteClassMutation = useDeleteClass();

  // 스케줄 포맷팅
  const formattedSchedule = schedule && schedule.length > 0
    ? schedule.join(', ')
    : '시간 미정';

  // 수업 삭제
  const handleDelete = async () => {
    if (!window.confirm(`정말로 "${className}" 수업을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, ${studentCount || 0}명의 학생 등록 정보가 함께 삭제됩니다.`)) {
      return;
    }

    try {
      await deleteClassMutation.mutateAsync({ className, subject });
      onClose();
    } catch (err) {
      console.error('[ClassDetailModal] Error deleting class:', err);
      alert('수업 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="bg-[#081429] text-white p-6 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6" />
              <h2 className="text-xl font-bold">수업 상세</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                disabled={deleteClassMutation.isPending}
                className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Edit className="w-4 h-4" />
                편집
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteClassMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                {deleteClassMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
              <button
                onClick={onClose}
                disabled={deleteClassMutation.isPending}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

        {/* 수업 정보 섹션 */}
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-[#081429]" />
              <h3 className="text-[#081429] font-bold text-lg">수업 정보</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {/* 수업명 */}
              <div className="flex items-start gap-3">
                <span className="text-[#373d41] text-sm font-medium min-w-[80px]">수업명:</span>
                <span className="text-[#081429] font-bold text-base">{className}</span>
              </div>

              {/* 과목 */}
              <div className="flex items-start gap-3">
                <span className="text-[#373d41] text-sm font-medium min-w-[80px]">과목:</span>
                <span className="text-[#373d41]">
                  {subject === 'math' ? '수학' : '영어'}
                </span>
              </div>

              {/* 강사 */}
              <div className="flex items-start gap-3">
                <span className="text-[#373d41] text-sm font-medium min-w-[80px]">강사:</span>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#373d41]" />
                  <span className="text-[#373d41]">{teacher || '미정'}</span>
                </div>
              </div>

              {/* 스케줄 */}
              <div className="flex items-start gap-3">
                <span className="text-[#373d41] text-sm font-medium min-w-[80px]">스케줄:</span>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[#373d41] mt-0.5" />
                  <span className="text-[#373d41]">{formattedSchedule}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 수강 학생 섹션 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#081429]" />
                <h3 className="text-[#081429] font-bold text-lg">
                  수강 학생
                  <span className="text-[#fdb813] ml-2">
                    ({classDetail?.studentCount || studentCount || 0}명)
                  </span>
                </h3>
              </div>
            </div>

            {/* 학생 목록 */}
            {detailLoading ? (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <p className="text-[#373d41]">학생 목록을 불러오는 중...</p>
              </div>
            ) : classDetail ? (
              <ClassStudentList
                students={classDetail.students}
                className={className}
                teacher={teacher}
                subject={subject}
                schedule={schedule}
                onStudentClick={onStudentClick}
              />
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#373d41]" />
                <p className="text-[#373d41]">학생 정보를 불러올 수 없습니다.</p>
              </div>
            )}
          </div>

          {/* 통계 섹션 (Phase 3 예정) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-[#081429]" />
              <h3 className="text-[#081429] font-bold text-lg">통계</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-[#373d41] text-sm mb-1">평균 출석률</p>
                  <p className="text-[#fdb813] font-bold text-2xl">--%</p>
                  <p className="text-xs text-[#373d41] mt-1">Phase 3 예정</p>
                </div>
                <div className="text-center">
                  <p className="text-[#373d41] text-sm mb-1">이번 달 수업 횟수</p>
                  <p className="text-[#fdb813] font-bold text-2xl">--회</p>
                  <p className="text-xs text-[#373d41] mt-1">Phase 3 예정</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="bg-gray-50 p-4 flex items-center justify-end gap-3 border-t border-[#081429] border-opacity-10">
          <button
            onClick={onClose}
            disabled={deleteClassMutation.isPending}
            className="px-6 py-2 border border-[#081429] text-[#081429] rounded-lg font-semibold hover:bg-[#081429] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            닫기
          </button>
        </div>
      </div>
    </div>

    {/* 수업 편집 모달 */}
    {showEditModal && (
      <EditClassModal
        classInfo={classInfo}
        onClose={() => setShowEditModal(false)}
      />
    )}
    </>
  );
};

export default ClassDetailModal;
