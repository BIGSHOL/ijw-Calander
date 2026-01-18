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
  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'prospect':
      case 'prospective':  // 예비 상태 (두 가지 표기 지원)
        return <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">예비</span>;
      case 'active':
        return <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">재원</span>;
      case 'on_hold':
        return <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">휴원</span>;
      case 'waitlisted':
      case 'waiting':  // 대기 상태 (두 가지 표기 지원)
        return <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-medium">대기</span>;
      case 'withdrawn':
        return <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-medium">퇴원</span>;
      default:
        // status가 없거나 인식되지 않는 경우 기본값으로 "재원" 표시
        // (status 필드가 없는 기존 학생 데이터 호환)
        return <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">재원</span>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 상단: 총 학생 수 + 페이지 크기 선택 + 페이지네이션 */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          {/* 왼쪽: 총 학생 수 + 페이지 크기 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#081429] font-bold">
              총 <span className="text-[#fdb813]">{students.length}</span>명
            </span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-[#373d41] focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
            >
              <option value={10}>10개씩 보기</option>
              <option value={20}>20개씩 보기</option>
              <option value={50}>50개씩 보기</option>
              <option value={100}>100개씩 보기</option>
            </select>
          </div>

          {/* 오른쪽: 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-1 text-[#373d41] hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                title="첫 페이지"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 text-[#373d41] hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                title="이전 페이지"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-[#373d41] px-2 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1 text-[#373d41] hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                title="다음 페이지"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 text-[#373d41] hover:text-[#081429] disabled:opacity-30 disabled:cursor-not-allowed"
                title="마지막 페이지"
              >
                <ChevronsRight className="w-4 h-4" />
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
          <ul className="divide-y divide-gray-200">
            {paginatedStudents.map((student) => (
              <li
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className={`p-3 cursor-pointer transition-colors ${selectedStudent?.id === student.id
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
                        <span className="text-xxs bg-[#fdb813]/20 text-[#fdb813] px-1.5 py-0.5 rounded font-medium border border-[#fdb813]/30">
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
                      {student.enrollments && student.enrollments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {/* 과목별로 중복 제거하여 표시 */}
                          {Array.from(new Set(student.enrollments.map(e => e.subject))).map((subject) => (
                            <span
                              key={subject}
                              className={`text-xxs px-1.5 py-0.5 rounded font-medium ${subject === 'math'
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

    </div>
  );
};

export default StudentList;
