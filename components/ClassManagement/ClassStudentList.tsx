import React, { useState } from 'react';
import { Users, UserMinus, ExternalLink, AlertCircle } from 'lucide-react';
import { ClassStudent } from '../../hooks/useClassDetail';
import { useManageClassStudents } from '../../hooks/useClassMutations';
import { SubjectType } from '../../types';

interface ClassStudentListProps {
  students: ClassStudent[];
  className: string;
  teacher: string;
  subject: SubjectType;
  schedule?: string[];
  onStudentClick?: (studentId: string) => void;
}

const ClassStudentList: React.FC<ClassStudentListProps> = ({
  students,
  className,
  teacher,
  subject,
  schedule = [],
  onStudentClick,
}) => {
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const manageStudentsMutation = useManageClassStudents();

  // 학생 제거
  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`"${studentName}" 학생을 이 수업에서 제외하시겠습니까?`)) {
      return;
    }

    setRemovingStudentId(studentId);

    try {
      await manageStudentsMutation.mutateAsync({
        className,
        teacher,
        subject,
        schedule,
        removeStudentIds: [studentId],
      });
    } catch (err) {
      console.error('[ClassStudentList] Error removing student:', err);
      alert('학생 제외에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setRemovingStudentId(null);
    }
  };

  // 학생 클릭 (학생 관리 탭으로 이동)
  const handleStudentClick = (studentId: string) => {
    if (onStudentClick) {
      onStudentClick(studentId);
    }
  };

  // 상태별 색상
  const getStatusColor = (status: 'active' | 'on_hold' | 'withdrawn') => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'withdrawn':
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: 'active' | 'on_hold' | 'withdrawn') => {
    switch (status) {
      case 'active':
        return '재원';
      case 'on_hold':
        return '대기';
      case 'withdrawn':
        return '퇴원';
    }
  };

  if (students.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#373d41]" />
        <p className="text-[#373d41]">수강 중인 학생이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {students.map((student) => (
        <div
          key={student.id}
          className="bg-white border border-[#081429] border-opacity-10 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {/* 학생 이름 및 정보 */}
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => handleStudentClick(student.id)}
                  className="text-[#081429] font-bold text-lg hover:text-[#fdb813] transition-colors flex items-center gap-2"
                  title="학생 정보 보기"
                >
                  {student.name}
                  {onStudentClick && <ExternalLink className="w-4 h-4" />}
                </button>
                <span
                  className={`text-xs px-2 py-1 rounded border ${getStatusColor(student.status)}`}
                >
                  {getStatusLabel(student.status)}
                </span>
              </div>

              {/* 추가 정보 */}
              <div className="flex items-center gap-4 text-sm text-[#373d41]">
                <span>학년: {student.grade}</span>
                <span>등록일: {student.enrollmentDate || '미정'}</span>
              </div>
            </div>

            {/* 제거 버튼 */}
            <button
              onClick={() => handleRemoveStudent(student.id, student.name)}
              disabled={removingStudentId === student.id}
              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="수업에서 제외"
            >
              {removingStudentId === student.id ? (
                <AlertCircle className="w-5 h-5 animate-spin" />
              ) : (
                <UserMinus className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClassStudentList;
