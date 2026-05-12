import React, { useState, useEffect } from 'react';
import { X, Clock, Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface MakeEduBillingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  id: string;
  type: 'manual' | 'scheduled';
  success: boolean;
  fromYm?: string;
  toYm?: string;
  totalRows?: number;
  saved?: number;
  error?: string;
  triggeredBy?: string;
  executedAt?: any;
}

const LOG_COL = 'makeEduBillingSyncLogs';
const MAX_ROWS = 20;

const formatTime = (ts: any): string => {
  if (!ts) return '';
  let date: Date;
  if (ts instanceof Timestamp) date = ts.toDate();
  else if (typeof ts?.toDate === 'function') date = ts.toDate();
  else if (typeof ts === 'string') date = new Date(ts);
  else if (ts?.seconds) date = new Date(ts.seconds * 1000);
  else return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
};

const fmtYm = (s?: string) => {
  if (!s || s.length !== 6) return s || '';
  return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
};

export const MakeEduBillingHistoryModal: React.FC<MakeEduBillingHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEscapeClose(onClose);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, LOG_COL), orderBy('executedAt', 'desc'), limit(MAX_ROWS));
      const snap = await getDocs(q);
      const rows: LogEntry[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type === 'scheduled' ? 'scheduled' : 'manual',
          success: !!data.success,
          fromYm: data.fromYm,
          toYm: data.toYm,
          totalRows: typeof data.totalRows === 'number' ? data.totalRows : undefined,
          saved: typeof data.saved === 'number' ? data.saved : undefined,
          error: data.error,
          triggeredBy: data.triggeredBy,
          executedAt: data.executedAt,
        };
      });
      setLogs(rows);
    } catch (err: any) {
      setError(err?.message || '내역 불러오기 실패');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[10vh] z-[100]">
      <div className="bg-white rounded-sm w-full max-w-3xl max-h-[75vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Clock size={18} className="text-gray-600" />
            동기화 내역
            <span className="text-xxs text-gray-400 font-normal">(최근 {MAX_ROWS}건)</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={load}
              disabled={isLoading}
              className="px-2 py-1 text-xxs border border-gray-300 rounded-sm bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={11} className="animate-spin" /> : '새로고침'}
            </button>
            <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {error && (
            <div className="m-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-sm px-2 py-1.5 text-xs text-red-700">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-sm text-gray-400">
              <Clock size={28} className="mb-2 opacity-40" />
              <p>동기화 내역이 없습니다.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-1.5 text-left">실행 일시</th>
                  <th className="px-2 py-1.5 text-left">유형</th>
                  <th className="px-2 py-1.5 text-left">범위</th>
                  <th className="px-2 py-1.5 text-right">총 행</th>
                  <th className="px-2 py-1.5 text-right">저장</th>
                  <th className="px-2 py-1.5 text-center">결과</th>
                  <th className="px-2 py-1.5 text-left">메모</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1 text-gray-600 whitespace-nowrap">{formatTime(l.executedAt)}</td>
                    <td className="px-2 py-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded-sm text-xxs font-bold ${
                        l.type === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {l.type === 'scheduled' ? '자동' : '수동'}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-gray-600 whitespace-nowrap">
                      {l.fromYm === l.toYm ? fmtYm(l.fromYm) : `${fmtYm(l.fromYm)} ~ ${fmtYm(l.toYm)}`}
                    </td>
                    <td className="px-2 py-1 text-right">{typeof l.totalRows === 'number' ? l.totalRows.toLocaleString() : '-'}</td>
                    <td className="px-2 py-1 text-right">{typeof l.saved === 'number' ? l.saved.toLocaleString() : '-'}</td>
                    <td className="px-2 py-1 text-center">
                      {l.success ? (
                        <CheckCircle size={14} className="inline text-emerald-600" />
                      ) : (
                        <XCircle size={14} className="inline text-red-600" />
                      )}
                    </td>
                    <td className="px-2 py-1 text-gray-500 truncate max-w-[260px]" title={l.error || ''}>
                      {l.error || ''}
                    </td>
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

export default MakeEduBillingHistoryModal;
