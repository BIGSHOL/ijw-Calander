import React, { useMemo, useState } from 'react';
import { UnifiedStudent } from '../../../types';
import { useStudentTextbooks } from '../../../hooks/useStudentTextbooks';
import {
  BookOpen,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  DollarSign
} from 'lucide-react';

interface StudentTextbookTabProps {
  student: UnifiedStudent;
  readOnly?: boolean;
}

const StudentTextbookTab: React.FC<StudentTextbookTabProps> = ({ student }) => {
  const [showDistributions, setShowDistributions] = useState(true);
  const [showBillings, setShowBillings] = useState(true);
  const [distPage, setDistPage] = useState(1);
  const [billPage, setBillPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { distributions, billings, stats, isLoading, error } = useStudentTextbooks({
    studentId: student.id,
  });

  // 페이지네이션 계산 - 배부
  const distTotalPages = Math.max(1, Math.ceil(distributions.length / pageSize));
  const distSafePage = Math.min(distPage, distTotalPages);
  const paginatedDist = distributions.slice((distSafePage - 1) * pageSize, distSafePage * pageSize);

  // 페이지네이션 계산 - 수납
  const billTotalPages = Math.max(1, Math.ceil(billings.length / pageSize));
  const billSafePage = Math.min(billPage, billTotalPages);
  const paginatedBill = billings.slice((billSafePage - 1) * pageSize, billSafePage * pageSize);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-sm"></div>
        <span className="ml-2 text-xs text-gray-500">교재 내역을 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
        <p className="text-xs text-red-600">교재 내역을 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-primary">교재 현황</h3>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-2">
          <p className="text-xs text-gray-500 mb-0.5">배부 건수</p>
          <p className="text-sm font-bold text-blue-700">{stats.totalDistributed}권</p>
          <p className="text-xxs text-blue-500 mt-0.5">{distributions.length}건</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2">
          <p className="text-xs text-gray-500 mb-0.5">교재비 합계</p>
          <p className="text-sm font-bold text-emerald-700">{stats.totalBillingAmount.toLocaleString()}원</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-sm p-2">
          <p className="text-xs text-gray-500 mb-0.5">수납 건수</p>
          <p className="text-sm font-bold text-purple-700">{stats.billingCount}건</p>
        </div>
      </div>

      {/* 배부 이력 섹션 */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setShowDistributions(!showDistributions)}
      >
        <h4 className="text-xs font-bold text-primary">배부 이력</h4>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDistributions ? '' : 'rotate-180'}`} />
      </div>

      {showDistributions && (
      <>
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-gray-600">
          <span className="w-20 shrink-0">배부일</span>
          <span className="flex-1 min-w-0">교재명</span>
          <span className="w-20 shrink-0">수업</span>
          <span className="w-10 shrink-0 text-right">수량</span>
        </div>

        {distributions.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-xs text-gray-500">배부 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginatedDist.map((dist) => (
              <div
                key={dist.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <span className="w-20 shrink-0 text-xs text-gray-600">
                  {dist.distributedAt.slice(0, 10)}
                </span>
                <span className="flex-1 min-w-0 text-xs text-primary truncate" title={dist.textbookName}>
                  {dist.textbookName}
                </span>
                <span className="w-20 shrink-0 text-xs text-gray-500 truncate" title={dist.className || ''}>
                  {dist.className || '-'}
                </span>
                <span className="w-10 shrink-0 text-xs text-right font-medium">
                  {dist.quantity}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {distributions.length > pageSize && (
        <Pagination
          currentPage={distSafePage}
          totalPages={distTotalPages}
          totalItems={distributions.length}
          pageSize={pageSize}
          onPageChange={setDistPage}
        />
      )}
      </>
      )}

      {/* 수납 내역 섹션 */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setShowBillings(!showBillings)}
      >
        <h4 className="text-xs font-bold text-primary">교재 수납</h4>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showBillings ? '' : 'rotate-180'}`} />
      </div>

      {showBillings && (
      <>
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-gray-600">
          <span className="w-16 shrink-0">청구월</span>
          <span className="flex-1 min-w-0">교재명</span>
          <span className="w-20 shrink-0 text-right">청구액</span>
          <span className="w-14 shrink-0 text-center">매칭</span>
        </div>

        {billings.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-xs text-gray-500">교재 수납 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginatedBill.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <span className="w-16 shrink-0 text-xs text-gray-600">
                  {bill.month}
                </span>
                <span className="flex-1 min-w-0 text-xs text-primary truncate" title={bill.textbookName}>
                  {bill.textbookName}
                </span>
                <span className="w-20 shrink-0 text-xs text-right font-medium">
                  {bill.amount.toLocaleString()}원
                </span>
                <span className={`w-14 shrink-0 text-center text-xxs font-medium px-1.5 py-0.5 rounded-sm border ${
                  bill.matched
                    ? 'text-green-600 bg-green-50 border-green-200'
                    : 'text-orange-600 bg-orange-50 border-orange-200'
                }`}>
                  {bill.matched ? '완료' : '미매칭'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {billings.length > pageSize && (
        <Pagination
          currentPage={billSafePage}
          totalPages={billTotalPages}
          totalItems={billings.length}
          pageSize={pageSize}
          onPageChange={setBillPage}
        />
      )}
      </>
      )}
    </div>
  );
};

// 페이지네이션 컴포넌트 (BillingTab 패턴)
const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, totalItems, pageSize, onPageChange }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-gray-400">
      총 {totalItems}건 중 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)}건
    </span>
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
        className="px-2 py-0.5 text-xs rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
      >
        이전
      </button>
      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        let pageNum: number;
        if (totalPages <= 5) {
          pageNum = i + 1;
        } else if (currentPage <= 3) {
          pageNum = i + 1;
        } else if (currentPage >= totalPages - 2) {
          pageNum = totalPages - 4 + i;
        } else {
          pageNum = currentPage - 2 + i;
        }
        return (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={`w-5 h-5 rounded-full text-xxs font-bold transition-colors ${
              currentPage === pageNum
                ? 'bg-accent text-primary'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {pageNum}
          </button>
        );
      })}
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        className="px-2 py-0.5 text-xs rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
      >
        다음
      </button>
    </div>
  </div>
);

export default StudentTextbookTab;
