import React, { useState } from 'react';
import { UnifiedStudent } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import StudentList from './StudentList';
import StudentDetail from './StudentDetail';
import { Users, Loader2 } from 'lucide-react';

const StudentManagementTab: React.FC = () => {
  const { students, loading, error } = useStudents();
  const [selectedStudent, setSelectedStudent] = useState<UnifiedStudent | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">학생 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-600">
          <p className="font-semibold">오류 발생</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* 좌측 패널: 학생 목록 (40%) */}
      <div className="w-2/5 border-r border-gray-300 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800">학생 목록</h2>
            <span className="ml-auto text-sm text-gray-600">
              총 {students.length}명
            </span>
          </div>
        </div>
        <StudentList
          students={students}
          selectedStudent={selectedStudent}
          onSelectStudent={setSelectedStudent}
        />
      </div>

      {/* 우측 패널: 학생 상세 정보 (60%) */}
      <div className="w-3/5 bg-white">
        {selectedStudent ? (
          <StudentDetail student={selectedStudent} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">학생을 선택하세요</p>
              <p className="text-sm mt-2">좌측 목록에서 학생을 클릭하면 상세 정보가 표시됩니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentManagementTab;
