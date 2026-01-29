import React, { useState, useMemo, useEffect } from 'react';
import { UnifiedStudent } from '../../types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface StudentListProps {
  students: UnifiedStudent[];
  selectedStudent: UnifiedStudent | null;
  onSelectStudent: (student: UnifiedStudent) => void;
}

const StudentList: React.FC<StudentListProps> = ({
  students,
  selectedStudent,
  onSelectStudent,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 학생 목록이 변경되면 첫 페이지로 리셋 (검색, 필터 변경 시)
  useEffect(() => {
    setCurrentPage(1);
  }, [students.length]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(students.length / pageSize);
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return students.slice(startIndex, endIndex);
  }, [students, currentPage, pageSize]);

  // 페이지 크기 변경 시 첫 페이지로 이동
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // 페이지 변경 시 스크롤 최상단으로
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };
  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'prospect':
      case 'prospective':  // 예비 상태 (두 가지 표기 지원)
        return <span className="text-micro bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-medium">예비</span>;
      case 'active':
        return <span className="text-micro bg-green-100 text-green-800 px-1 py-0.5 rounded font-medium">재원</span>;
      case 'on_hold':
        return <span className="text-micro bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-medium">휴원/대기</span>;
      case 'withdrawn':
        return <span className="text-micro bg-gray-200 text-gray-600 px-1 py-0.5 rounded font-medium">퇴원</span>;
      default:
        // status가 없거나 인식되지 않는 경우 기본값으로 "재원" 표시
        // (status 필드가 없는 기존 학생 데이터 호환)
        return <span className="text-micro bg-green-100 text-green-800 px-1 py-0.5 rounded font-medium">재원</span>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 상단: 총 학생 수 + 페이지 크기 선택 + 페이지네이션 */}
      <div className="px-2 py-1 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          {/* 왼쪽: 총 학생 수 + 페이지 크기 */}
          <div className="flex items-center gap-1">
            <span className="text-xxs text-[#081429] font-bold">
              <span className="text-[#fdb813]">{students.length}</span>명
            </span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="text-xxs border border-gray-300 rounded px-1 py-0.5 bg-white text-[#373d41] focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
            >
              <option value={20}>20개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
          </div>

          {/* 오른쪽: 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center gap-0">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-0.5 text-[#373d41] hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                title="첫 페이지"
              >
                <ChevronsLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-0.5 text-[#373d41] hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                title="이전 페이지"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-xxs text-[#373d41] px-1 font-medium">
                {currentPage}/{totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-0.5 text-[#373d41] hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                title="다음 페이지"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-0.5 text-[#373d41] hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                title="마지막 페이지"
              >
                <ChevronsRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 학생 목록 */}
      <div className="flex-1 overflow-y-auto">
        {students.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <p>조건에 맞는 학생이 없습니다</p>
            <p className="text-xs mt-1 text-gray-400">상단 필터를 조정해보세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {paginatedStudents.map((student) => (
              <li
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className={`px-2 py-1 cursor-pointer transition-colors ${selectedStudent?.id === student.id
                  ? 'bg-[#fdb813]/10 border-l-2 border-[#fdb813]'
                  : student.isOldWithdrawn
                    ? 'hover:bg-[#fdb813]/5 bg-[#fdb813]/5'
                    : 'hover:bg-[#081429]/5'
                  }`}
              >
                <div className="flex flex-col gap-0.5">
                  {/* 1번째 줄: 상태 + 이름 + 학교/학년 */}
                  <div className="flex items-center gap-1">
                    {getStatusBadge(student.status)}
                    <span className={`text-xs font-bold ${student.isOldWithdrawn ? 'text-[#fdb813]' : 'text-[#081429]'}`}>
                      {student.name}
                    </span>
                    {student.isOldWithdrawn && (
                      <span className="text-micro bg-[#fdb813]/20 text-[#fdb813] px-1 rounded font-medium">과거</span>
                    )}
                    {(student.school || student.grade) && (
                      <span className="text-xxs text-gray-400">
                        {student.school && <span className="truncate max-w-[50px]" title={student.school}>{student.school}</span>}
                        {student.school && student.grade && ' '}
                        {student.grade}
                      </span>
                    )}
                  </div>
                  {/* 2번째 줄: 과목 (현재 수강 중인 수업만 표시 - endDate가 없는 것) */}
                  {student.enrollments && student.enrollments.filter(e => !e.endDate).length > 0 && (
                    <div className="flex items-center gap-1 pl-0.5">
                      {Array.from(new Set(student.enrollments.filter(e => !e.endDate).map(e => e.subject)))
                        .sort((a, b) => {
                          // 과목 정렬 순서: math, english, korean, science, 기타
                          const order: Record<string, number> = {
                            math: 1,
                            english: 2,
                            korean: 3,
                            science: 4,
                          };
                          return (order[a] || 99) - (order[b] || 99);
                        })
                        .map((subject) => {
                          // 과목명 매핑
                          const subjectNames: Record<string, string> = {
                            math: '수학',
                            english: '영어',
                            korean: '국어',
                            science: '과학',
                          };
                          const subjectColors: Record<string, string> = {
                            math: 'bg-blue-100 text-blue-700',
                            english: 'bg-purple-100 text-purple-700',
                            korean: 'bg-green-100 text-green-700',
                            science: 'bg-orange-100 text-orange-700',
                          };
                          return (
                            <span
                              key={subject}
                              className={`text-micro px-1 rounded font-medium ${subjectColors[subject] || 'bg-gray-100 text-gray-700'}`}
                            >
                              {subjectNames[subject] || subject}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
};

export default StudentList;
