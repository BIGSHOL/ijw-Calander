import React, { useState, useMemo, useEffect } from 'react';
import { X, CheckSquare, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { BillingRecord } from '../../types';
import { useBilling } from '../../hooks/useBilling';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface PendingRow {
  id: string;
  studentName: string;
  externalStudentId: string;
  grade: string;
  billingMonth: string;
  month: string;
  billingDay: number;
  category: string;
  billingName: string;
  status: 'pending' | 'paid';
  billedAmount: number;
  discountAmount: number;
  pointsUsed: number;
  paidAmount: number;
  unpaidAmount: number;
  paymentMethod: string;
  paidDate: string;
  memo: string;
  fetchedAt?: string;
  syncMeta?: { fromYm: string; toYm: string; type: string };
}

interface MakeEduBillingReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PENDING_COL = 'billing_makeedu_pending';

export const MakeEduBillingReviewModal: React.FC<MakeEduBillingReviewModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEscapeClose(onClose);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  // useBilling은 월별로 다르므로 importRecords mutation만 사용. query는 비활성.
  const { importRecords } = useBilling('', false);

  const loadPending = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, PENDING_COL));
      const rows: PendingRow[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          studentName: data.studentName || '',
          externalStudentId: data.externalStudentId || '',
          grade: data.grade || '',
          billingMonth: data.billingMonth || '',
          month: data.month || '',
          billingDay: Number(data.billingDay) || 0,
          category: data.category || '',
          billingName: data.billingName || '',
          status: data.status === 'paid' ? 'paid' : 'pending',
          billedAmount: Number(data.billedAmount) || 0,
          discountAmount: Number(data.discountAmount) || 0,
          pointsUsed: Number(data.pointsUsed) || 0,
          paidAmount: Number(data.paidAmount) || 0,
          unpaidAmount: Number(data.unpaidAmount) || 0,
          paymentMethod: data.paymentMethod || '',
          paidDate: data.paidDate || '',
          memo: data.memo || '',
          fetchedAt: data.fetchedAt,
          syncMeta: data.syncMeta,
        };
      });
      // 청구월 → 학생명 정렬
      rows.sort((a, b) => {
        if (a.month !== b.month) return a.month.localeCompare(b.month);
        return a.studentName.localeCompare(b.studentName, 'ko');
      });
      setPending(rows);
    } catch (err: any) {
      setError(err?.message || '불러오기 실패');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setResultMsg(null);
      loadPending();
    }
  }, [isOpen]);

  // 월별 그룹화 (importRecords가 월별로 받는 구조이므로)
  const byMonth = useMemo(() => {
    const map = new Map<string, PendingRow[]>();
    pending.forEach(r => {
      if (!r.month) return;
      if (!map.has(r.month)) map.set(r.month, []);
      map.get(r.month)!.push(r);
    });
    return map;
  }, [pending]);

  const handleApplyAll = async () => {
    if (pending.length === 0) return;
    if (!confirm(`${pending.length}건을 실제 수납에 반영합니다.\n동일 키(학생·청구월·수납명)는 메이크에듀 데이터로 덮어쓰기 됩니다. 진행할까요?`)) return;
    setIsApplying(true);
    setError(null);
    setResultMsg(null);
    try {
      let totalAdded = 0;
      let totalUpdated = 0;
      // 월별로 importRecords 호출 (upsert: 동일 키는 덮어씀)
      for (const [month, rows] of byMonth.entries()) {
        const records: Omit<BillingRecord, 'id'>[] = rows.map(r => ({
          externalStudentId: r.externalStudentId,
          studentName: r.studentName,
          grade: r.grade,
          school: '',
          parentPhone: '',
          studentPhone: '',
          category: r.category,
          month: r.month,
          billingDay: r.billingDay,
          billingName: r.billingName,
          status: r.status,
          billedAmount: r.billedAmount,
          discountAmount: r.discountAmount,
          pointsUsed: r.pointsUsed,
          paidAmount: r.paidAmount,
          unpaidAmount: r.unpaidAmount,
          paymentMethod: r.paymentMethod,
          cardCompany: '',
          paidDate: r.paidDate,
          cashReceipt: '',
          memo: r.memo,
          createdAt: '',
          updatedAt: '',
        }));
        const res = await importRecords.mutateAsync({ records, month });
        totalAdded += res.added;
        totalUpdated += res.updated;
      }

      // pending 비우기
      await clearPendingInternal();

      setPending([]);
      setResultMsg(`반영 완료: 신규 ${totalAdded}건, 업데이트 ${totalUpdated}건`);
    } catch (err: any) {
      setError(err?.message || '반영 실패');
    } finally {
      setIsApplying(false);
    }
  };

  const clearPendingInternal = async () => {
    const snap = await getDocs(collection(db, PENDING_COL));
    const docs = snap.docs;
    if (docs.length === 0) return;
    const bs = 450;
    for (let i = 0; i < docs.length; i += bs) {
      const batch = writeBatch(db);
      docs.slice(i, i + bs).forEach(d => batch.delete(doc(db, PENDING_COL, d.id)));
      await batch.commit();
    }
  };

  const handleClearAll = async () => {
    if (pending.length === 0) return;
    if (!confirm(`${pending.length}건의 검토 데이터를 모두 삭제합니다. (실 수납에는 영향 없음)`)) return;
    setIsClearing(true);
    setError(null);
    try {
      await clearPendingInternal();
      setPending([]);
      setResultMsg('검토 데이터를 모두 삭제했습니다.');
    } catch (err: any) {
      setError(err?.message || '삭제 실패');
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[6vh] z-[100]">
      <div className="bg-white rounded-sm w-full max-w-6xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <CheckSquare size={18} className="text-emerald-600" />
            MakeEdu 동기화 검토 / 반영
          </h2>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-xs text-gray-600">
            {isLoading ? '불러오는 중...' : (
              <>
                총 <strong className="text-primary">{pending.length}건</strong>
                {byMonth.size > 1 && ` (${byMonth.size}개월)`}
                {pending[0]?.syncMeta && (
                  <span className="ml-2 text-gray-400">
                    [{pending[0].syncMeta.fromYm} ~ {pending[0].syncMeta.toYm}, {pending[0].syncMeta.type}]
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadPending}
              disabled={isLoading || isApplying || isClearing}
              className="px-2 py-1 text-xs border border-gray-300 rounded-sm bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              새로고침
            </button>
            <button
              onClick={handleClearAll}
              disabled={pending.length === 0 || isApplying || isClearing}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded-sm bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {isClearing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              전체 무시
            </button>
            <button
              onClick={handleApplyAll}
              disabled={pending.length === 0 || isApplying || isClearing}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {isApplying ? <Loader2 size={11} className="animate-spin" /> : <CheckSquare size={11} />}
              전체 반영 (덮어쓰기)
            </button>
          </div>
        </div>

        {/* Result / Error */}
        {(error || resultMsg) && (
          <div className="px-3 py-2 border-b border-gray-200">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-sm px-2 py-1.5 text-xs text-red-700">
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {resultMsg && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-sm px-2 py-1.5 text-xs text-emerald-800">
                {resultMsg}
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {pending.length === 0 && !isLoading ? (
            <div className="flex items-center justify-center h-64 text-sm text-gray-400">
              검토할 데이터가 없습니다. MakeEdu 동기화를 먼저 실행하세요.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-1.5 text-left">청구월</th>
                  <th className="px-2 py-1.5 text-left">이름</th>
                  <th className="px-2 py-1.5 text-left">학년</th>
                  <th className="px-2 py-1.5 text-left">구분</th>
                  <th className="px-2 py-1.5 text-left">수납명</th>
                  <th className="px-2 py-1.5 text-right">청구액</th>
                  <th className="px-2 py-1.5 text-right">할인</th>
                  <th className="px-2 py-1.5 text-right">실납</th>
                  <th className="px-2 py-1.5 text-right">미납</th>
                  <th className="px-2 py-1.5 text-center">수납</th>
                  <th className="px-2 py-1.5 text-left">결제수단</th>
                  <th className="px-2 py-1.5 text-left">수납일</th>
                  <th className="px-2 py-1.5 text-left">메모</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1 text-gray-600">{r.month || r.billingMonth}</td>
                    <td className="px-2 py-1 font-medium">{r.studentName}</td>
                    <td className="px-2 py-1 text-gray-500">{r.grade}</td>
                    <td className="px-2 py-1">{r.category}</td>
                    <td className="px-2 py-1 truncate max-w-[280px]" title={r.billingName}>{r.billingName}</td>
                    <td className="px-2 py-1 text-right">{r.billedAmount.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right text-gray-500">{r.discountAmount.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">{r.paidAmount.toLocaleString()}</td>
                    <td className={`px-2 py-1 text-right ${r.unpaidAmount > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                      {r.unpaidAmount.toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded-sm text-xxs font-bold ${
                        r.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {r.status === 'paid' ? '완납' : '미납'}
                      </span>
                    </td>
                    <td className="px-2 py-1">{r.paymentMethod}</td>
                    <td className="px-2 py-1 text-gray-500">{r.paidDate}</td>
                    <td className="px-2 py-1 text-gray-500 truncate max-w-[120px]" title={r.memo}>{r.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default MakeEduBillingReviewModal;
