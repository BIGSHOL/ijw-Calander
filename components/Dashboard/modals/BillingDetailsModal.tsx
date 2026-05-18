/**
 * 수납률 KPI 근거 데이터 모달
 * - 청구 레코드 전체 + 미납 우선 정렬
 * - 합계 요약 (총 청구액 / 입금액 / 미납액 / 미납 건수)
 * - read-only (이 모달 자체는 데이터 변경 없음)
 */
import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { BillingRecord } from '../../../types/billing';

interface BillingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: BillingRecord[];
  yearMonth: string;
}

const fmt = (n: number) => n.toLocaleString();

const BillingDetailsModal: React.FC<BillingDetailsModalProps> = ({
  isOpen,
  onClose,
  records,
  yearMonth,
}) => {
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
            <span className="text-xs text-amber-600">{yearMonth}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-amber-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* 요약 */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <span className="text-gray-500">
              수납률 <b className="text-amber-700 text-sm">{summary.rate}%</b>
            </span>
            <span className="text-gray-500">
              총 청구 <b className="text-gray-800">{fmt(summary.billed)}원</b>
            </span>
            <span className="text-emerald-600">
              입금 <b>{fmt(summary.paid)}원</b>
            </span>
            <span className="text-red-600">
              미납 <b>{fmt(summary.unpaid)}원</b> ({summary.pendingCount}건)
            </span>
            <span className="text-gray-400 ml-auto">전체 {records.length}건</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5">
            정렬: 미납 우선 (미납액 큰 순) → 납부 완료 (청구액 큰 순)
          </div>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-auto">
          {sortedRecords.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              해당 월의 청구 기록이 없습니다.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <tr className="text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">학생</th>
                  <th className="px-3 py-2 text-left font-medium">학교/학년</th>
                  <th className="px-3 py-2 text-left font-medium">수납명</th>
                  <th className="px-3 py-2 text-right font-medium">청구</th>
                  <th className="px-3 py-2 text-right font-medium">입금</th>
                  <th className="px-3 py-2 text-right font-medium">미납</th>
                  <th className="px-3 py-2 text-center font-medium">상태</th>
                  <th className="px-3 py-2 text-left font-medium">담임</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r) => {
                  const isPending = r.status === 'pending';
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        isPending ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {r.studentName}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {r.school}
                        {r.grade ? ` / ${r.grade}` : ''}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">{r.billingName || r.category}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt(r.billedAmount || 0)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-700">
                        {fmt(r.paidAmount || 0)}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right font-mono font-bold ${
                          isPending && (r.unpaidAmount || 0) > 0 ? 'text-red-600' : 'text-gray-400'
                        }`}
                      >
                        {fmt(r.unpaidAmount || 0)}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {isPending ? (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                            미납
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">
                            완납
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">{r.teacher || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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