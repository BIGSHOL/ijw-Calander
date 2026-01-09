import React, { useState, useMemo } from 'react';
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
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">재원</span>;
      case 'on_hold':
        return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium">대기</span>;
      case 'withdrawn':
        return <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-medium">퇴원</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 페이지 크기 선택 */}
      <div className="px-3 py-2 border-b border-[#373d41]/20 bg-[#081429]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300 font-medium">페이지당</span>
          <div className="flex gap-1">
            {[10, 20, 50, 100].map((size) => (
              <button
                key={size}
                onClick={() => handlePageSizeChange(size)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  pageSize === size
                    ? 'bg-[#fdb813] text-[#081429] font-bold shadow-sm'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-white/10'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
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
          <ul className="divide-y divide-gray-200">
            {paginatedStudents.map((student) => (
              <li
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className={`p-3 cursor-pointer transition-colors ${
                  selectedStudent?.id === student.id
                    ? 'bg-[#fdb813]/10 border-l-4 border-[#fdb813]'
                    : student.isOldWithdrawn
                    ? 'hover:bg-[#fdb813]/5 bg-[#fdb813]/5'
                    : 'hover:bg-[#081429]/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold truncate ${student.isOldWithdrawn ? 'text-[#fdb813]' : 'text-[#081429]'}`}>
                        {student.name}
                      </span>
                      {student.englishName && (
                        <span className="text-xs text-[#373d41]/60 truncate">({student.englishName})</span>
                      )}
                      {getStatusBadge(student.status)}
                      {student.isOldWithdrawn && (
                        <span className="text-[10px] bg-[#fdb813]/20 text-[#fdb813] px-1.5 py-0.5 rounded font-medium border border-[#fdb813]/30">
                          과거
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#373d41]/70 mt-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {student.school && (
                          <span className="truncate max-w-[80px]" title={student.school}>{student.school}</span>
                        )}
                        {student.school && student.grade && <span className="text-[#373d41]/30">·</span>}
                        {student.grade && <span>{student.grade}</span>}
                      </div>
                      {student.enrollments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {/* 과목별로 중복 제거하여 표시 */}
                          {Array.from(new Set(student.enrollments.map(e => e.subject))).map((subject) => (
                            <span
                              key={subject}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                subject === 'math'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {subject === 'math' ? '수학' : '영어'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 페이지네이션 컨트롤 */}
      {students.length > 0 && totalPages > 1 && (
        <div className="px-3 py-2 border-t border-[#373d41]/20 bg-[#081429]">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-300 font-medium">
              {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, students.length)} / {students.length}명
            </div>
            <div className="flex items-center gap-1">
              {/* 첫 페이지 */}
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                title="첫 페이지"
              >
                <ChevronsLeft className="w-4 h-4 text-gray-300" />
              </button>

              {/* 이전 페이지 */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                title="이전 페이지"
              >
                <ChevronLeft className="w-4 h-4 text-gray-300" />
              </button>

              {/* 페이지 번호 */}
              <div className="flex items-center gap-1 mx-1">
                {/* 첫 페이지 근처 */}
                {currentPage > 3 && (
                  <>
                    <button
                      onClick={() => handlePageChange(1)}
                      className="px-2 py-0.5 text-xs rounded hover:bg-white/10 text-gray-300"
                    >
                      1
                    </button>
                    {currentPage > 4 && <span className="text-xs text-gray-400">...</span>}
                  </>
                )}

                {/* 현재 페이지 근처 3개 */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return Math.abs(page - currentPage) <= 1;
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        currentPage === page
                          ? 'bg-[#fdb813] text-[#081429] font-bold shadow-sm'
                          : 'hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                {/* 마지막 페이지 근처 */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="text-xs text-gray-400">...</span>}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      className="px-2 py-0.5 text-xs rounded hover:bg-white/10 text-gray-300"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              {/* 다음 페이지 */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                title="다음 페이지"
              >
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>

              {/* 마지막 페이지 */}
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                title="마지막 페이지"
              >
                <ChevronsRight className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentList;
