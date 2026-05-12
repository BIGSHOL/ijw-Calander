import React, { useState, useMemo } from 'react';
import { X, Cloud, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface MakeEduBillingSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: (result: { totalRows: number; saved: number; fromYm: string; toYm: string }) => void;
}

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// "2026-04" → "202604"
const toYm6 = (ymd: string) => ymd.replace(/-/g, '');

export const MakeEduBillingSyncModal: React.FC<MakeEduBillingSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  useEscapeClose(onClose);
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ totalRows: number; saved: number; fromYm: string; toYm: string } | null>(null);

  const isRangeValid = useMemo(() => {
    if (!fromMonth || !toMonth) return false;
    return fromMonth <= toMonth;
  }, [fromMonth, toMonth]);

  const handleSync = async () => {
    if (!isRangeValid) {
      setError('청구월 범위가 잘못되었습니다. 시작 ≤ 끝 이어야 합니다.');
      return;
    }
    setIsSyncing(true);
    setError(null);
    setResult(null);
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'scrapeMakeEduBillings', { timeout: 540000 });
      const res = await fn({ fromYm: toYm6(fromMonth), toYm: toYm6(toMonth) });
      const data = res.data as { ok: boolean; totalRows: number; saved: number; fromYm: string; toYm: string };
      setResult({ totalRows: data.totalRows, saved: data.saved, fromYm: data.fromYm, toYm: data.toYm });
      onSyncComplete(data);
    } catch (err: any) {
      console.error('[MakeEduBillingSync] error:', err);
      setError(err?.message || '동기화 실패');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[12vh] z-[100]">
      <div className="bg-white rounded-sm w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Cloud size={18} className="text-blue-600" />
            MakeEdu 상세수납 동기화
          </h2>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-sm px-3 py-2 text-xs text-blue-900">
            메이크에듀의 상세수납(payUnionDeList.do) 페이지에서 지정한 청구월 범위의 데이터를 가져와
            <strong> 임시 영역(검토용)</strong>에 저장합니다. 실 수납 데이터는 검토 후 반영해야 합니다.
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">청구월 범위</label>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                disabled={isSyncing}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-sm text-sm"
              />
              <span className="text-gray-500">~</span>
              <input
                type="month"
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                disabled={isSyncing}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-sm text-sm"
              />
            </div>
            <p className="text-xxs text-gray-500">
              시작·끝 양쪽 모두 설정해야 합니다. 동일 월 선택 가능 (예: 2026-05 ~ 2026-05).
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-sm px-3 py-2 text-xs text-red-700">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && !isSyncing && (
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-sm px-3 py-2 text-xs text-emerald-800">
              <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold">완료: {result.saved}건 가져옴 ({result.fromYm} ~ {result.toYm})</div>
                <div className="mt-1">화면을 닫고 "검토 후 반영"으로 이동해 실제 수납에 반영하세요.</div>
              </div>
            </div>
          )}

          {isSyncing && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 text-xs text-gray-700">
              <Loader2 size={14} className="animate-spin" />
              <span>크롤링 중... (최대 9분 소요될 수 있음)</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSyncing}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            닫기
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing || !isRangeValid}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
            동기화 시작
          </button>
        </div>
      </div>
    </div>
  );
};

export default MakeEduBillingSyncModal;