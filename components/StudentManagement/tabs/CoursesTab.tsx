import React from 'react';
import { UnifiedStudent } from '../../../types';
import { BookOpen, User, Calendar, Clock } from 'lucide-react';

interface CoursesTabProps {
  student: UnifiedStudent;
}

const CoursesTab: React.FC<CoursesTabProps> = ({ student }) => {
  if (student.enrollments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">수강 중인 강좌가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          수강 중인 강좌 ({student.enrollments.length}개)
        </h3>
      </div>

      {student.enrollments.map((enrollment, index) => {
        const subjectInfo =
          enrollment.subject === 'math'
            ? { label: '수학', color: 'bg-blue-100 text-blue-800 border-blue-200' }
            : { label: '영어', color: 'bg-green-100 text-green-800 border-green-200' };

        return (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-gray-600" />
                  <h4 className="text-base font-semibold text-gray-800">
                    {enrollment.className}
                  </h4>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border ${subjectInfo.color}`}>
                  {subjectInfo.label}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* 강사 정보 */}
              <div className="flex items-start">
                <div className="flex items-center gap-2 w-1/3 text-gray-600">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">담당 강사</span>
                </div>
                <div className="w-2/3">
                  <span className="text-sm text-gray-800">{enrollment.teacherId}</span>
                </div>
              </div>

              {/* 수업 요일 */}
              <div className="flex items-start">
                <div className="flex items-center gap-2 w-1/3 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">수업 요일</span>
                </div>
                <div className="w-2/3">
                  <div className="flex flex-wrap gap-1">
                    {enrollment.days && enrollment.days.length > 0 ? (
                      enrollment.days.map((day, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                        >
                          {day}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400 italic">요일 정보 없음</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Class ID (참고용) */}
              <div className="flex items-start">
                <div className="flex items-center gap-2 w-1/3 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Class ID</span>
                </div>
                <div className="w-2/3">
                  <span className="text-xs text-gray-500 font-mono">
                    {enrollment.classId}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 추가 기능 안내 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>향후 추가 예정:</strong> 출석률, 수강 기간, 성적 정보 등이 표시됩니다.
        </p>
      </div>
    </div>
  );
};

export default CoursesTab;
