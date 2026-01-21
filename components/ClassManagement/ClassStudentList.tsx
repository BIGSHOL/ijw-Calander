import React, { useState, useCallback, useMemo } from 'react';
import { Users, Pause, Play } from 'lucide-react';
import { ClassStudent } from '../../hooks/useClassDetail';
import { formatSchoolGrade } from '../../utils/studentUtils';
import { updateEnrollmentHoldWithSync } from '../../utils/studentStatusSync';

interface ClassStudentListProps {
  students: ClassStudent[];
  onStudentClick?: (studentId: string) => void;
  classDays?: string[];  // 수업 요일 목록 (등원 요일 표시 여부 결정에 사용)
}

const ClassStudentList: React.FC<ClassStudentListProps> = ({
  students,
  onStudentClick,
  classDays = [],
}) => {
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);

  // 이벤트 핸들러 최적화: useCallback으로 안정화
  const handleStudentClick = useCallback((studentId: string) => {
    if (onStudentClick) {
      onStudentClick(studentId);
    }
  }, [onStudentClick]);

  const handleToggleOnHold = async (student: ClassStudent, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!student.enrollmentId) {
      alert('enrollment ID를 찾을 수 없습니다.');
      return;
    }

    const newOnHold = !student.onHold;
    const confirmMsg = newOnHold
      ? `${student.name} 학생을 대기 상태로 변경하시겠습니까?`
      : `${student.name} 학생을 활성 상태로 변경하시겠습니까?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setUpdatingStudentId(student.id);

    try {
      const result = await updateEnrollmentHoldWithSync(
        student.id,
        student.enrollmentId,
        newOnHold,
        student.status
      );

      if (result.success) {
        // 성공 시 페이지 새로고침하여 최신 데이터 반영
        window.location.reload();
      } else {
        alert(`상태 변경 실패: ${result.reason}`);
      }
    } catch (error) {
      console.error('onHold 토글 실패:', error);
      alert('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setUpdatingStudentId(null);
    }
  };

  // classDays를 Set으로 변환하여 O(1) 조회 최적화 (400명+ 규모)
  const classDaysSet = useMemo(() => new Set(classDays), [classDays]);

  // 학생의 등원 요일이 수업 요일과 다른 경우에만 표시
  // (모든 수업 요일에 등원하면 표시하지 않음)
  const shouldShowAttendanceDays = useCallback((studentAttendanceDays?: string[]): boolean => {
    if (!studentAttendanceDays || studentAttendanceDays.length === 0) return false;
    if (classDays.length === 0) return true;  // 수업 요일 정보 없으면 그냥 표시

    // 수업 요일과 등원 요일이 동일하면 표시하지 않음 (Set 사용으로 O(n) 최적화)
    if (studentAttendanceDays.length === classDaysSet.size) {
      const allMatch = studentAttendanceDays.every(day => classDaysSet.has(day));
      if (allMatch) {
        return false;
      }
    }
    return true;
  }, [classDays, classDaysSet]);

  if (students.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#373d41]" />
        <p className="text-[#373d41] text-sm">수강 중인 학생이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[360px] overflow-y-auto">
      {students.map((student) => {
        const isUpdating = updatingStudentId === student.id;
        return (
          <div
            key={student.id}
            className={`flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors ${
              student.onHold ? 'bg-amber-50' : ''
            }`}
          >
            <div
              onClick={() => handleStudentClick(student.id)}
              className={`flex items-center gap-2 flex-1 ${
                onStudentClick ? 'cursor-pointer hover:text-[#fdb813]' : ''
              }`}
            >
              <span className={`font-medium ${student.onHold ? 'text-amber-700' : 'text-[#081429]'}`}>
                {student.name}
              </span>
              <span className="text-[#373d41] text-sm">
                {formatSchoolGrade(student.school, student.grade)}
              </span>
              {/* 등원 요일이 수업 요일과 다른 경우에만 표시 */}
              {shouldShowAttendanceDays(student.attendanceDays) && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  {student.attendanceDays!.join(', ')}만
                </span>
              )}
              {/* onHold 상태 배지 */}
              {student.onHold && (
                <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">
                  대기
                </span>
              )}
            </div>

            {/* 대기 토글 버튼 */}
            <button
              onClick={(e) => handleToggleOnHold(student, e)}
              disabled={isUpdating}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                student.onHold
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
              title={student.onHold ? '활성화' : '대기 처리'}
            >
              {isUpdating ? (
                <span>처리중...</span>
              ) : student.onHold ? (
                <>
                  <Play size={12} />
                  <span>활성</span>
                </>
              ) : (
                <>
                  <Pause size={12} />
                  <span>대기</span>
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ClassStudentList;
