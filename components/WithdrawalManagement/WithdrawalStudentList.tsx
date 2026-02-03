import React, { useState, useMemo, useEffect } from 'react';
import { WithdrawalEntry } from '../../hooks/useWithdrawalFilters';
import { WITHDRAWAL_REASON_LABEL, SUBJECT_LABEL, SUBJECT_COLOR } from '../../constants/withdrawal';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface WithdrawalStudentListProps {
  entries: WithdrawalEntry[];
  selectedEntry: WithdrawalEntry | null;
  onSelectEntry: (entry: WithdrawalEntry) => void;
}

const WithdrawalStudentList: React.FC<WithdrawalStudentListProps> = ({
  entries,
  selectedEntry,
  onSelectEntry,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 목록 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [entries.length]);

  const totalPages = Math.ceil(entries.length / pageSize);
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return entries.slice(startIndex, startIndex + pageSize);
  }, [entries, currentPage, pageSize]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 상단: 총 학생 수 + 페이지 크기 + 페이지네이션 */}
      <div className="px-2 py-1.5 border-b flex items-center justify-between" style={{ borderColor: '#08142915', backgroundColor: '#fafafa' }}>
        <div className="flex items-center gap-1">
          <span className="text-xxs font-bold" style={{ color: '#081429' }}>
            <span style={{ color: '#e53e3e' }}>{entries.length}</span>명
          </span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="text-xxs border rounded-sm px-1 py-0.5 transition-all"
            style={{ borderColor: '#08142920', color: '#081429', backgroundColor: 'white' }}
          >
            <option value={10}>10개</option>
            <option value={20}>20개</option>
            <option value={50}>50개</option>
            <option value={100}>100개</option>
          </select>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-0.5">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
              <ChevronsLeft className="w-3 h-3" style={{ color: '#081429' }} />
            </button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-3 h-3" style={{ color: '#081429' }} />
            </button>
            <span className="text-xxs px-1" style={{ color: '#081429' }}>
              {currentPage}/{totalPages}
            </span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-3 h-3" style={{ color: '#081429' }} />
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
              <ChevronsRight className="w-3 h-3" style={{ color: '#081429' }} />
            </button>
          </div>
        )}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {paginatedEntries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-gray-400">
            해당하는 학생이 없습니다
          </div>
        ) : (
          paginatedEntries.map((entry) => {
            const { student, type, endedSubjects, effectiveDate } = entry;
            const isSelected = selectedEntry?.student.id === student.id && selectedEntry?.type === type;
            const reasonLabel = student.withdrawalReason
              ? WITHDRAWAL_REASON_LABEL[student.withdrawalReason] || student.withdrawalReason
              : '';

            return (
              <button
                key={`${student.id}-${type}`}
                onClick={() => onSelectEntry(entry)}
                className={`w-full text-left px-3 py-2 border-b transition-colors ${
                  isSelected
                    ? type === 'withdrawn'
                      ? 'bg-red-50 border-l-2 border-l-red-500'
                      : 'bg-amber-50 border-l-2 border-l-amber-500'
                    : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
                style={{ borderBottomColor: '#08142910' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium" style={{ color: '#081429' }}>
                      {student.name}
                    </span>
                    {student.grade && (
                      <span className="text-micro text-gray-400">{student.grade}</span>
                    )}
                    {/* 유형 뱃지 */}
                    {type === 'withdrawn' ? (
                      <span className="text-micro bg-red-100 text-red-700 px-1 py-0 rounded-sm font-medium">
                        퇴원
                      </span>
                    ) : (
                      <span className="text-micro bg-amber-100 text-amber-700 px-1 py-0 rounded-sm font-medium">
                        수강종료
                      </span>
                    )}
                  </div>
                  {effectiveDate && (
                    <span className="text-micro text-gray-400">
                      {effectiveDate}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {endedSubjects.map(sub => (
                    <span
                      key={sub}
                      className={`text-micro px-1 py-0 rounded-sm font-medium ${SUBJECT_COLOR[sub] || SUBJECT_COLOR.other}`}
                    >
                      {SUBJECT_LABEL[sub] || sub}
                    </span>
                  ))}
                  {type === 'withdrawn' && reasonLabel && (
                    <span className="text-micro text-gray-400 ml-auto">
                      {reasonLabel}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WithdrawalStudentList;
