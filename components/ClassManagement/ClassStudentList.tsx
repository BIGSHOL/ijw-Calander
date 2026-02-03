import React, { useCallback, useMemo } from 'react';
import { Users } from 'lucide-react';
import { ClassStudent } from '../../hooks/useClassDetail';
import { formatSchoolGrade } from '../../utils/studentUtils';

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
  // 이벤트 핸들러 최적화: useCallback으로 안정화
  const handleStudentClick = useCallback((studentId: string) => {
    if (onStudentClick) {
      onStudentClick(studentId);
    }
  }, [onStudentClick]);

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
      <div className="bg-gray-50 p-6 text-center border border-gray-200">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#373d41]" />
        <p className="text-[#373d41] text-sm">수강 중인 학생이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
      {students.map((student) => (
        <div
          key={student.id}
          className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors"
        >
          <div
            onClick={() => handleStudentClick(student.id)}
            className={`flex items-center gap-2 flex-1 ${
              onStudentClick ? 'cursor-pointer hover:text-[#fdb813]' : ''
            }`}
          >
            <span className="text-xs font-medium text-[#081429]">
              {student.name}
            </span>
            <span className="text-xs text-[#373d41]">
              {formatSchoolGrade(student.school, student.grade)}
            </span>
            {/* 등원 요일이 수업 요일과 다른 경우에만 표시 */}
            {shouldShowAttendanceDays(student.attendanceDays) && (
              <span className="text-xxs bg-amber-100 text-amber-700 px-1.5 py-0.5 font-medium">
                {student.attendanceDays!.join(', ')}만
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClassStudentList;
