/**
 * 수납률 KPI 근거 데이터 모달
 * - 청구 레코드 전체 + 미납 우선 정렬
 * - 합계 요약 (총 청구액 / 입금액 / 미납액 / 미납 건수)
 * - read-only (이 모달 자체는 데이터 변경 없음)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { BillingRecord } from '../../../types/billing';
import { useBilling } from '../../../hooks/useBilling';

interface BillingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 초기 표시 month (YYYY-MM). 모달 내부에서 변경 가능 */
  records: BillingRecord[];
  yearMonth: string;
}

/** YYYY-MM ± offset → YYYY-MM */
function shiftMonth(ym: string, offset: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** YYYY-MM → 'YYYY년 M월' 한글 라벨 */
function ymLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y}년 ${m}월`;
}

const fmt = (n: number) => n.toLocaleString();

/** 수납일 → "M/D" 짧은 표기. 비어있거나 파싱 실패 시 null */
const fmtPaidDate = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${Number(m[2])}/${Number(m[3])}`;
  return s;
};

const BillingDetailsModal: React.FC<BillingDetailsModalProps> = ({
  isOpen,
  onClose,
  records: initialRecords,
  yearMonth,
}) => {
  // 선택 month — 기본은 props.yearMonth (보통 이번 달)
  const [selectedMonth, setSelectedMonth] = useState(yearMonth);
  const [tableExpanded, setTableExpanded] = useState(false);
  const TABLE_PREVIEW = 15;

  useEffect(() => {
    if (isOpen) {
      setSelectedMonth(yearMonth);
      setTableExpanded(false);
    }
  }, [isOpen, yearMonth]);

  // selectedMonth 변경 시 fetch — 첫 렌더는 props.records 사용 (fetch 절약)
  const isInitialMonth = selectedMonth === yearMonth;
  const { records: fetchedRecords = [] } = useBilling(selectedMonth, isOpen && !isInitialMonth);
  const records = isInitialMonth ? initialRecords : fetchedRecords;

  // 오늘 기준 미래 month 차단용
  const currentYM = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const isFuture = selectedMonth > currentYM;

  const summary = useMemo(() => {
    let billed = 0, paid = 0, unpaid = 0, pendingCount = 0;
    for (const r of records) {
      billed += r.billedAmount || 0;
      paid += r.paidAmount || 0;
      unpaid += r.unpaidAmount || 0;
      if (r.status === 'pending') pendingCount++;
    }
    const rate = billed > 0 ? Math.round((paid / billed) * 100) : 0;
    return { billed, paid, unpaid, pendingCount, rate };
  }, [records]);

  // 미납 우선 + 미납액 큰 순 정렬, 그 다음 납부 완료
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1;
      }
      if (a.status === 'pending') {
        return (b.unpaidAmount || 0) - (a.unpaidAmount || 0);
      }
      return (b.billedAmount || 0) - (a.billedAmount || 0);
    });
  }, [records]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[8vh] bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[760px] max-w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-amber-50">
          <div className="flex items-center gap-2">
            <span className="text-amber-700 text-lg">💰</span>
            <h2 className="font-bold text-sm text-amber-900">수납률 — 근거 데이터</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-amber-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* 월 페이지 네비 (수납은 월 단위 데이터라 월 페이지만) */}
        <div className="flex items-center justify-between px-5 py-2 border-b bg-white">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonth(m => shiftMonth(m, -1))}
              className="p-1 hover:bg-gray-100 rounded text-black"
              title="지난 달"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-black mx-2 min-w-[100px] text-center">
              {ymLabel(selectedMonth)}
            </span>
            <button
              onClick={() => setSelectedMonth(m => shiftMonth(m, 1))}
              disabled={isFuture || selectedMonth >= currentYM}
              className="p-1 hover:bg-gray-100 rounded text-black disabled:opacity-30 disabled:cursor-not-allowed"
              title="다음 달"
            >
              <ChevronRight size={16} />
            </button>
            {selectedMonth !== yearMonth && (
              <button
                onClick={() => setSelectedMonth(yearMonth)}
                className="ml-2 px-2 py-0.5 text-xs font-bold border border-amber-300 text-amber-700 rounded hover:bg-amber-50"
              >
                이번 달로
              </button>
            )}
          </div>
          <span className="text-xs text-black">청구월 기준</span>
        </div>

        {/* 요약 */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <span className="text-black">
              수납률 <b className="text-amber-700 text-sm">{summary.rate}%</b>
            </span>
            <span className="text-black">
              총 청구 <b className="text-black">{fmt(summary.billed)}원</b>
            </span>
            <span className="text-emerald-600">
              입금 <b>{fmt(summary.paid)}원</b>
            </span>
            <span className="text-red-600">
              미납 <b>{fmt(summary.unpaid)}원</b> ({summary.pendingCount}건)
            </span>
            <span className="text-black ml-auto">전체 {records.length}건</span>
          </div>
          <div className="text-xs text-black mt-1.5">
            정렬: 미납 우선 (미납액 큰 순) → 납부 완료 (청구액 큰 순)
          </div>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-auto">
          {sortedRecords.length === 0 ? (
            <div className="text-center py-12 text-black text-sm">
              해당 월의 청구 기록이 없습니다.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <tr className="text-black">
                  <th className="px-3 py-2 text-left font-medium">학생</th>
                  <th className="px-3 py-2 text-left font-medium">학교/학년</th>
                  <th className="px-3 py-2 text-left font-medium">수납명</th>
                  <th className="px-3 py-2 text-right font-medium">청구</th>
                  <th className="px-3 py-2 text-right font-medium">입금</th>
                  <th className="px-3 py-2 text-right font-medium">미납</th>
                  <th className="px-3 py-2 text-center font-medium whitespace-nowrap w-14">상태</th>
                  <th className="px-3 py-2 text-center font-medium whitespace-nowrap w-16">납부일</th>
                  <th className="px-3 py-2 text-left font-medium">담임</th>
                </tr>
              </thead>
              <tbody>
                {(tableExpanded ? sortedRecords : sortedRecords.slice(0, TABLE_PREVIEW)).map((r) => {
                  const isPending = r.status === 'pending';
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        isPending ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-left font-bold text-black whitespace-nowrap">
                        {r.studentName}
                      </td>
                      <td className="px-3 py-2 text-black">
                        {r.school}
                        {r.grade ? ` / ${r.grade}` : ''}
                      </td>
                      <td className="px-3 py-2 text-black">{r.billingName || r.category}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.billedAmount || 0)}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700">
                        {fmt(r.paidAmount || 0)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-bold ${
                          isPending && (r.unpaidAmount || 0) > 0 ? 'text-red-600' : 'text-black'
                        }`}
                      >
                        {fmt(r.unpaidAmount || 0)}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold whitespace-nowrap">
                            미납
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold whitespace-nowrap">
                            완납
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap text-black font-mono">
                        {!isPending && fmtPaidDate(r.paidDate) ? fmtPaidDate(r.paidDate) : '-'}
                      </td>
                      <td className="px-3 py-2 text-black">{r.teacher || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {sortedRecords.length > TABLE_PREVIEW && (
            <button
              type="button"
              onClick={() => setTableExpanded(e => !e)}
              className="w-full px-3 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 border-t border-gray-200 flex items-center justify-center gap-1"
            >
              {tableExpanded ? (
                <>접기 <ChevronUp size={16} /></>
              ) : (
                <>+ {sortedRecords.length - TABLE_PREVIEW}건 더 보기 <ChevronDown size={16} /></>
              )}
            </button>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-2 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-600 text-white rounded text-xs font-bold hover:bg-amber-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillingDetailsModal;