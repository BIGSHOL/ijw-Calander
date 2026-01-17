import React from 'react';
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
  const handleStudentClick = (studentId: string) => {
    if (onStudentClick) {
      onStudentClick(studentId);
    }
  };

  // 학생의 등원 요일이 수업 요일과 다른 경우에만 표시
  // (모든 수업 요일에 등원하면 표시하지 않음)
  const shouldShowAttendanceDays = (studentAttendanceDays?: string[]): boolean => {
    if (!studentAttendanceDays || studentAttendanceDays.length === 0) return false;
    if (classDays.length === 0) return true;  // 수업 요일 정보 없으면 그냥 표시

    // 수업 요일과 등원 요일이 동일하면 표시하지 않음
    if (studentAttendanceDays.length === classDays.length) {
      const sorted1 = [...studentAttendanceDays].sort();
      const sorted2 = [...classDays].sort();
      if (sorted1.every((day, i) => day === sorted2[i])) {
        return false;
      }
    }
    return true;
  };

  if (students.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#373d41]" />
        <p className="text-[#373d41] text-sm">수강 중인 학생이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {students.map((student) => (
        <div
          key={student.id}
          onClick={() => handleStudentClick(student.id)}
          className={`flex items-center gap-2 ${
            onStudentClick ? 'cursor-pointer hover:text-[#fdb813]' : ''
          }`}
        >
          <span className="font-medium text-[#081429]">
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
        </div>
      ))}
    </div>
  );
};

export default ClassStudentList;
