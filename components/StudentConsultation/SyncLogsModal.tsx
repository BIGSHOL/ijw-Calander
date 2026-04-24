// 메이크에듀 상담 동기화 내역 모달 (자동/수동 통합)
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { X, RefreshCw, CheckCircle2, AlertCircle, Clock, Cloud, Hand, Upload } from 'lucide-react';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface SyncLog {
    id: string;
    type?: 'scheduled' | 'manual_auto_fetch' | 'manual_excel';
    yearMonth?: string;
    fetched?: number;
    matched?: number;
    unmatched?: number;
    written?: number;
    success: boolean;
    error?: string;
    executedAt?: any; // Firestore Timestamp
}

interface Props {
    onClose: () => void;
}

const formatTimestamp = (ts: any): string => {
    if (!ts) return '-';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    scheduled: { label: '자동 (cron)', icon: <Clock size={12} />, color: 'bg-blue-100 text-blue-700' },
    manual_auto_fetch: { label: '수동 (크롤링)', icon: <Cloud size={12} />, color: 'bg-green-100 text-green-700' },
    manual_excel: { label: '수동 (엑셀)', icon: <Upload size={12} />, color: 'bg-purple-100 text-purple-700' },
};

const SyncLogsModal: React.FC<Props> = ({ onClose }) => {
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEscapeClose(onClose);

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const q = query(
                collection(db, 'makeEduConsultationSyncLogs'),
                orderBy('executedAt', 'desc'),
                limit(100),
            );
            const snap = await getDocs(q);
            const list: SyncLog[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as SyncLog));
            setLogs(list);
        } catch (err: any) {
            console.error('[SyncLogsModal] Error:', err);
            setError(err?.message || '로그 조회 실패');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-sm shadow-2xl w-[800px] max-h-[80vh] flex flex-col overflow-hidden">
                <div className="bg-primary text-white p-3 font-bold text-sm flex justify-between items-center">
                    <span className="flex items-center gap-2">
                        <RefreshCw size={16} />
                        메이크에듀 상담 동기화 내역
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchLogs}
                            disabled={loading}
                            className="p-1 rounded hover:bg-white/20"
                            title="새로고침"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={onClose} className="text-white hover:text-gray-200">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-gray-50 p-4">
                    {error && (
                        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
                            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="text-xs text-gray-500 mb-2">최근 100건 (자동 + 수동)</div>

                    <table className="w-full text-xs border-collapse bg-white">
                        <thead className="sticky top-0 bg-gray-100">
                            <tr>
                                <th className="border px-2 py-1.5 text-left font-bold text-gray-700">시간</th>
                                <th className="border px-2 py-1.5 text-left font-bold text-gray-700">타입</th>
                                <th className="border px-2 py-1.5 text-left font-bold text-gray-700">월</th>
                                <th className="border px-2 py-1.5 text-right font-bold text-gray-700">조회</th>
                                <th className="border px-2 py-1.5 text-right font-bold text-gray-700">매칭</th>
                                <th className="border px-2 py-1.5 text-right font-bold text-gray-700">실패</th>
                                <th className="border px-2 py-1.5 text-right font-bold text-gray-700">저장</th>
                                <th className="border px-2 py-1.5 text-left font-bold text-gray-700">결과</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => {
                                const cfg = TYPE_CONFIG[log.type || 'scheduled'] || TYPE_CONFIG.scheduled;
                                return (
                                    <tr key={log.id} className="border-b hover:bg-blue-50">
                                        <td className="border px-2 py-1 text-gray-700 font-mono text-[10px]">
                                            {formatTimestamp(log.executedAt)}
                                        </td>
                                        <td className="border px-2 py-1">
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg.color}`}>
                                                {cfg.icon}
                                                {cfg.label}
                                            </span>
                                        </td>
                                        <td className="border px-2 py-1 text-gray-700 font-mono">{log.yearMonth || '-'}</td>
                                        <td className="border px-2 py-1 text-right text-gray-700">{log.fetched ?? '-'}</td>
                                        <td className="border px-2 py-1 text-right text-blue-700 font-bold">{log.matched ?? '-'}</td>
                                        <td className="border px-2 py-1 text-right text-red-600">{log.unmatched ?? '-'}</td>
                                        <td className="border px-2 py-1 text-right text-green-700 font-bold">{log.written ?? '-'}</td>
                                        <td className="border px-2 py-1">
                                            {log.success ? (
                                                <span className="inline-flex items-center gap-1 text-green-600">
                                                    <CheckCircle2 size={12} /> 성공
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-600" title={log.error}>
                                                    <AlertCircle size={12} /> 실패
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {logs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-gray-400">
                                        동기화 내역이 없습니다
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-gray-50 border-t px-4 py-2 text-[10px] text-gray-500">
                    💡 자동 동기화: 매일 03:00 KST · 컬렉션: <code>makeEduConsultationSyncLogs</code>
                </div>
            </div>
        </div>
    );
};

export default SyncLogsModal;
