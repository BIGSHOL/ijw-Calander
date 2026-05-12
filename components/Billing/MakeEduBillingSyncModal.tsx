import React, { useState, useMemo, useEffect } from 'react';
import { X, Cloud, Loader2, CheckCircle, AlertCircle, RefreshCcw, Save, Trash2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { BillingRecord } from '../../types';
import { useBilling } from '../../hooks/useBilling';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface MakeEduBillingSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (result: { totalRows: number; saved: number; fromYm: string; toYm: string }) => void;
}

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
  syncMeta?: { fromYm: string; toYm: string; type: string };
}

const PENDING_COL = 'billing_makeedu_pending';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// "2026-04" → "202604"
const toYm6 = (ymd: string) => ymd.replace(/-/g, '');

// 수납명 카테고리 분류 / 학년 정렬 — utils/billingCategories.ts 재사용
import {
  BillingCategory as Category,
  BILLING_CATEGORIES as ALL_CATEGORIES,
  BILLING_CATEGORY_LABELS as CATEGORY_LABELS,
  classifyBillingCategory as classifyCategory,
  gradeSortKey as gradeOrder,
} from '../../utils/billingCategories';

export const MakeEduBillingSyncModal: React.FC<MakeEduBillingSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  useEscapeClose(onClose);
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);
  // 필터 (보기 전용 — 저장 시에는 전체 대상)
  const [enabledCategories, setEnabledCategories] = useState<Set<Category>>(
    () => new Set(ALL_CATEGORIES),
  );
  const [enabledGrades, setEnabledGrades] = useState<Set<string> | null>(null); // null = 전체

  // useBilling.importRecords mutation만 사용 (query 비활성)
  const { importRecords } = useBilling('', false);

  const isRangeValid = useMemo(() => {
    if (!fromMonth || !toMonth) return false;
    return fromMonth <= toMonth;
  }, [fromMonth, toMonth]);

  const loadPending = async () => {
    setIsLoadingPending(true);
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
          syncMeta: data.syncMeta,
        };
      });
      rows.sort((a, b) => {
        if (a.month !== b.month) return a.month.localeCompare(b.month);
        return a.studentName.localeCompare(b.studentName, 'ko');
      });
      setPending(rows);
    } catch (err: any) {
      setError(err?.message || '데이터 불러오기 실패');
    } finally {
      setIsLoadingPending(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      loadPending();
    }
  }, [isOpen]);

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

  const handleSync = async () => {
    if (!isRangeValid) {
      setError('청구월 범위가 잘못되었습니다. 시작 ≤ 끝 이어야 합니다.');
      return;
    }
    setIsSyncing(true);
    setError(null);
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'scrapeMakeEduBillings', { timeout: 540000 });
      const res = await fn({ fromYm: toYm6(fromMonth), toYm: toYm6(toMonth) });
      const data = res.data as { ok: boolean; totalRows: number; saved: number; fromYm: string; toYm: string };
      onSyncComplete?.(data);
      // 동기화 후 가져온 데이터 미리보기 로드
      await loadPending();
    } catch (err: any) {
      console.error('[MakeEduBillingSync] error:', err);
      setError(err?.message || '동기화 실패');
    } finally {
      setIsSyncing(false);
    }
  };

  const byMonth = useMemo(() => {
    const map = new Map<string, PendingRow[]>();
    pending.forEach(r => {
      if (!r.month) return;
      if (!map.has(r.month)) map.set(r.month, []);
      map.get(r.month)!.push(r);
    });
    return map;
  }, [pending]);

  // 카테고리별 행 카운트
  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = { textbook: 0, gangaSystem: 0, shuttle: 0, other: 0 };
    pending.forEach(r => { counts[classifyCategory(r.billingName)]++; });
    return counts;
  }, [pending]);

  // 학년 목록 + 카운트
  const grades = useMemo(() => {
    const map = new Map<string, number>();
    pending.forEach(r => {
      const g = r.grade || '(미지정)';
      map.set(g, (map.get(g) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => gradeOrder(a[0]) - gradeOrder(b[0]) || a[0].localeCompare(b[0], 'ko'));
  }, [pending]);

  // 학년 필터 상태가 null이면 전체 활성으로 초기화 (pending 변경 시마다 새 학년 자동 포함)
  useEffect(() => {
    if (pending.length === 0) return;
    if (enabledGrades === null) {
      setEnabledGrades(new Set(grades.map(([g]) => g)));
    } else {
      // 신규 학년이 생기면 자동 포함
      const current = new Set(enabledGrades);
      let changed = false;
      grades.forEach(([g]) => { if (!current.has(g)) { current.add(g); changed = true; } });
      if (changed) setEnabledGrades(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // 필터 적용 (보기 전용)
  const filteredPending = useMemo(() => {
    return pending.filter(r => {
      const cat = classifyCategory(r.billingName);
      if (!enabledCategories.has(cat)) return false;
      const g = r.grade || '(미지정)';
      if (enabledGrades && !enabledGrades.has(g)) return false;
      return true;
    });
  }, [pending, enabledCategories, enabledGrades]);

  const toggleCategory = (c: Category) => {
    const next = new Set(enabledCategories);
    if (next.has(c)) next.delete(c); else next.add(c);
    setEnabledCategories(next);
  };
  const setAllCategories = (on: boolean) => {
    setEnabledCategories(on ? new Set(ALL_CATEGORIES) : new Set());
  };

  const toggleGrade = (g: string) => {
    const next = new Set(enabledGrades || []);
    if (next.has(g)) next.delete(g); else next.add(g);
    setEnabledGrades(next);
  };
  const setAllGrades = (on: boolean) => {
    setEnabledGrades(on ? new Set(grades.map(([g]) => g)) : new Set());
  };

  const handleSave = async () => {
    if (pending.length === 0) return;
    if (!confirm(`${pending.length}건을 실 수납에 저장합니다.\n동일 키(학생·청구월·수납명)는 메이크에듀 데이터로 덮어쓰기 됩니다. 진행할까요?`)) return;
    setIsSaving(true);
    setError(null);
    try {
      let totalAdded = 0;
      let totalUpdated = 0;
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
      await clearPendingInternal();
      setPending([]);
      alert(`저장 완료: 신규 ${totalAdded}건, 업데이트 ${totalUpdated}건`);
      onClose();
    } catch (err: any) {
      setError(err?.message || '저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (pending.length === 0) return;
    if (!confirm(`현재 가져온 ${pending.length}건을 삭제합니다. (실 수납에는 영향 없음)`)) return;
    setIsSaving(true);
    setError(null);
    try {
      await clearPendingInternal();
      setPending([]);
    } catch (err: any) {
      setError(err?.message || '삭제 실패');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasPending = pending.length > 0;
  const busy = isSyncing || isSaving || isLoadingPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[6vh] z-[100]">
      <div className="bg-white rounded-sm w-full max-w-6xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Cloud size={18} className="text-blue-600" />
            MakeEdu 상세수납 동기화
            {hasPending && (
              <span className="text-xxs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm font-normal">
                미저장 {pending.length}건
              </span>
            )}
          </h2>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: 청구월 + 동기화 / 저장 / 취소 */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-600">청구월</label>
            <input
              type="month"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
              disabled={busy}
              className="px-2 py-1 border border-gray-300 rounded-sm text-xs"
            />
            <span className="text-gray-500 text-xs">~</span>
            <input
              type="month"
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
              disabled={busy}
              className="px-2 py-1 border border-gray-300 rounded-sm text-xs"
            />
            <button
              onClick={handleSync}
              disabled={busy || !isRangeValid}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50"
              title={hasPending ? '기존 데이터는 새 결과로 교체됩니다' : ''}
            >
              {isSyncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />}
              {hasPending ? '다시 동기화' : '동기화 시작'}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {hasPending && (
              <>
                <button
                  onClick={handleDiscard}
                  disabled={busy}
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded-sm bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <Trash2 size={11} />
                  취소(삭제)
                </button>
                <button
                  onClick={handleSave}
                  disabled={busy}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  저장 (덮어쓰기)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status */}
        {(error || isSyncing) && (
          <div className="px-4 py-2 border-b border-gray-200 space-y-1.5">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-sm px-2 py-1.5 text-xs text-red-700">
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {isSyncing && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-sm px-2 py-1.5 text-xs text-blue-700">
                <Loader2 size={12} className="animate-spin" />
                <span>크롤링 중... (수백~수천건은 최대 9분 소요될 수 있음)</span>
              </div>
            )}
          </div>
        )}

        {/* Filters (preview 전용 — 저장은 전체 대상) */}
        {hasPending && (
          <div className="border-b border-gray-200 bg-white px-4 py-2 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xxs font-bold text-gray-600 w-14 shrink-0">카테고리</span>
              {ALL_CATEGORIES.map(c => {
                const on = enabledCategories.has(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCategory(c)}
                    className={`px-2 py-0.5 text-xxs rounded-sm border transition-colors ${
                      on
                        ? 'bg-blue-100 border-blue-400 text-blue-800 font-bold'
                        : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}
                  >
                    {CATEGORY_LABELS[c]} ({categoryCounts[c]})
                  </button>
                );
              })}
              <button
                onClick={() => setAllCategories(true)}
                className="text-xxs text-gray-500 underline ml-1 hover:text-gray-700"
              >전체</button>
              <button
                onClick={() => setAllCategories(false)}
                className="text-xxs text-gray-500 underline hover:text-gray-700"
              >없음</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xxs font-bold text-gray-600 w-14 shrink-0">학년</span>
              {grades.map(([g, count]) => {
                const on = enabledGrades ? enabledGrades.has(g) : true;
                return (
                  <button
                    key={g}
                    onClick={() => toggleGrade(g)}
                    className={`px-2 py-0.5 text-xxs rounded-sm border transition-colors ${
                      on
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-bold'
                        : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}
                  >
                    {g} ({count})
                  </button>
                );
              })}
              <button
                onClick={() => setAllGrades(true)}
                className="text-xxs text-gray-500 underline ml-1 hover:text-gray-700"
              >전체</button>
              <button
                onClick={() => setAllGrades(false)}
                className="text-xxs text-gray-500 underline hover:text-gray-700"
              >없음</button>
            </div>
          </div>
        )}

        {/* Preview Table */}
        <div className="flex-1 overflow-auto">
          {isLoadingPending ? (
            <div className="flex items-center justify-center h-64 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : !hasPending ? (
            <div className="flex flex-col items-center justify-center h-64 text-sm text-gray-400">
              <Cloud size={32} className="mb-3 opacity-40" />
              <p>청구월 범위를 선택하고 "동기화 시작"을 눌러주세요.</p>
              <p className="text-xxs mt-2">가져온 데이터는 이 화면에서 확인 후 "저장"을 눌러야 실 수납에 반영됩니다.</p>
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-sm text-gray-400">
              <p>필터 조건에 맞는 행이 없습니다.</p>
              <p className="text-xxs mt-1">위 필터를 조정해 보세요.</p>
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
                {filteredPending.map(r => (
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

        {/* Footer summary */}
        {hasPending && (
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xxs text-gray-600 flex items-center gap-3 flex-wrap">
            <CheckCircle size={11} className="text-emerald-600" />
            <span>
              표시 {filteredPending.length}건 / 전체 {pending.length}건 · {byMonth.size}개월
            </span>
            <span className="text-gray-400">저장 시 전체 {pending.length}건이 반영됩니다 (필터는 보기 전용)</span>
            {pending[0]?.syncMeta && (
              <span className="text-gray-400 ml-auto">
                [{pending[0].syncMeta.fromYm} ~ {pending[0].syncMeta.toYm}, {pending[0].syncMeta.type === 'scheduled' ? '자동' : '수동'}]
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MakeEduBillingSyncModal;
