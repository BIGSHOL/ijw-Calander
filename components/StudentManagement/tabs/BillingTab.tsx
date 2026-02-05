import React, { useMemo, useState } from 'react';
import { UnifiedStudent } from '../../../types';
import { BILLING_STATUS_LABELS } from '../../../types/billing';
import { useStudentBilling } from '../../../hooks/useStudentBilling';
import {
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

interface BillingTabProps {
  student: UnifiedStudent;
  readOnly?: boolean;
}

// 수납 상태 색상 설정
const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50 border-yellow-200', label: '미납' },
  paid: { icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200', label: '납부완료' },
};

const BillingTab: React.FC<BillingTabProps> = ({ student, readOnly = true }) => {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // 섹션 접기/펼치기 상태
  const [showStats, setShowStats] = useState(true);
  const [showRecords, setShowRecords] = useState(true);
  const [showOverallStats, setShowOverallStats] = useState(true);

  const { records, stats, isLoading, error } = useStudentBilling({
    studentName: student.name,
  });

  // 연도별 + 상태별 필터링
  const filteredRecords = useMemo(() => {
    let filtered = records.filter(r => r.month.startsWith(String(selectedYear)));
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    return filtered;
  }, [records, selectedYear, statusFilter]);

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);

  // 연도별 통계 재계산
  const yearStats = useMemo(() => {
    const filtered = filteredRecords;
    const totalBilled = filtered.reduce((sum, r) => sum + (r.billedAmount || 0), 0);
    const totalPaid = filtered.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
    const totalUnpaid = filtered.reduce((sum, r) => sum + (r.unpaidAmount || 0), 0);
    const pendingCount = filtered.filter(r => r.status === 'pending').length;

    return { totalBilled, totalPaid, totalUnpaid, pendingCount };
  }, [filteredRecords]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-sm"></div>
        <span className="ml-2 text-xs text-gray-500">수납 내역을 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
        <p className="text-xs text-red-600">수납 내역을 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 헤더 + 필터 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-[#081429]">수납 현황</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-2 py-1 text-xs border border-gray-300 rounded-sm"
          >
            <option value="all">전체</option>
            <option value="paid">완납</option>
            <option value="pending">미납</option>
          </select>
          {/* 연도 선택 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSelectedYear(y => y - 1);
                setCurrentPage(1);
              }}
              className="p-1 hover:bg-gray-100 rounded-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm font-medium">{selectedYear}년</span>
            <button
              onClick={() => {
                setSelectedYear(y => y + 1);
                setCurrentPage(1);
              }}
              className="p-1 hover:bg-gray-100 rounded-sm transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 수납 통계 섹션 */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setShowStats(!showStats)}
      >
        <h4 className="text-xs font-bold text-[#081429]">수납 통계</h4>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showStats ? '' : 'rotate-180'}`} />
      </div>

      {/* 통계 카드 */}
      {showStats && (
      <>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 border border-blue-200 rounded-sm p-2">
          <p className="text-xs text-gray-500 mb-0.5">총 청구</p>
          <p className="text-sm font-bold text-blue-700">{yearStats.totalBilled.toLocaleString()}원</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2">
          <p className="text-xs text-gray-500 mb-0.5">납부 완료</p>
          <p className="text-sm font-bold text-emerald-700">{yearStats.totalPaid.toLocaleString()}원</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-sm p-2">
          <p className="text-xs text-gray-500 mb-0.5">미납금</p>
          <p className="text-sm font-bold text-orange-700">{yearStats.totalUnpaid.toLocaleString()}원</p>
          {yearStats.pendingCount > 0 && (
            <p className="text-xxs text-orange-600 mt-0.5">{yearStats.pendingCount}건</p>
          )}
        </div>
      </div>

      {/* 미납 경고 */}
      {yearStats.pendingCount > 0 && (
        <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
          <span className="text-xs text-yellow-700">
            미납 건이 {yearStats.pendingCount}건 ({yearStats.totalUnpaid.toLocaleString()}원) 있습니다.
          </span>
        </div>
      )}
      </>
      )}

      {/* 수납 내역 섹션 */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setShowRecords(!showRecords)}
      >
        <h4 className="text-xs font-bold text-[#081429]">수납 내역</h4>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showRecords ? '' : 'rotate-180'}`} />
      </div>

      {/* 수납 기록 테이블 */}
      {showRecords && (
      <>
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-gray-600">
          <span className="w-16 shrink-0">청구월</span>
          <span className="flex-1 min-w-0">수납명</span>
          <span className="w-20 shrink-0 text-right">청구액</span>
          <span className="w-20 shrink-0 text-right">납부액</span>
          <span className="w-16 shrink-0 text-center">상태</span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-xs text-gray-500">{selectedYear}년 수납 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginatedRecords.map((record) => {
              const status = statusConfig[record.status];
              const StatusIcon = status.icon;

              return (
                <div
                  key={record.id}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  {/* 청구월 */}
                  <span className="w-16 shrink-0 text-xs text-gray-600">
                    {record.month}
                  </span>

                  {/* 수납명 */}
                  <span className="flex-1 min-w-0 text-xs text-[#081429] truncate" title={record.billingName}>
                    {record.billingName}
                  </span>

                  {/* 청구액 */}
                  <span className="w-20 shrink-0 text-xs text-right font-medium">
                    {record.billedAmount.toLocaleString()}
                  </span>

                  {/* 납부액 */}
                  <span className="w-20 shrink-0 text-xs text-right font-medium text-emerald-600">
                    {record.paidAmount > 0 ? record.paidAmount.toLocaleString() : '-'}
                  </span>

                  {/* 상태 */}
                  <span className={`w-16 shrink-0 flex items-center justify-center px-1.5 py-0.5 rounded-sm text-xxs font-medium border ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {filteredRecords.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">페이지당</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded-sm text-xs"
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
            <span className="text-gray-400">
              (총 {filteredRecords.length}건 중 {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredRecords.length)}건)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-2 py-0.5 text-xs rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
            >
              이전
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (safePage <= 3) {
                  pageNum = i + 1;
                } else if (safePage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = safePage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-5 h-5 rounded-full text-xxs font-bold transition-colors ${
                      safePage === pageNum
                        ? 'bg-[#fdb813] text-[#081429]'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-2 py-0.5 text-xs rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
            >
              다음
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {/* 전체 통계 섹션 */}
      {records.length > 0 && (
      <>
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setShowOverallStats(!showOverallStats)}
      >
        <h4 className="text-xs font-bold text-[#081429]">전체 통계</h4>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showOverallStats ? '' : 'rotate-180'}`} />
      </div>

      {/* 전체 통계 */}
      {showOverallStats && (
      {records.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-sm p-2">
          <p className="text-xxs text-gray-500 mb-1">전체 기간 통계</p>
          <div className="flex items-center gap-4 text-xs">
            <span>총 {records.length}건</span>
            <span className="text-emerald-600">납부 {stats.paidCount}건</span>
            <span className="text-orange-600">미납 {stats.pendingCount}건</span>
            <span className="text-blue-600">수납률 {stats.collectionRate.toFixed(1)}%</span>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default BillingTab;
