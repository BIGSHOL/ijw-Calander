import React from 'react';
import { Users } from 'lucide-react';
import { ClassStudent } from '../../hooks/useClassDetail';

interface ClassStudentListProps {
  students: ClassStudent[];
  onStudentClick?: (studentId: string) => void;
}

const ClassStudentList: React.FC<ClassStudentListProps> = ({
  students,
  onStudentClick,
}) => {
  const handleStudentClick = (studentId: string) => {
    if (onStudentClick) {
      onStudentClick(studentId);
    }
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
          className={`flex items-center gap-3 ${
            onStudentClick ? 'cursor-pointer hover:text-[#fdb813]' : ''
          }`}
        >
          <span className="font-medium text-[#081429]">
            {student.name}
          </span>
          <span className="text-[#373d41]">
            {student.school}{student.grade}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ClassStudentList;
