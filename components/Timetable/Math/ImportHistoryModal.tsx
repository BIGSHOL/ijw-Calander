/**
 * 시간표 엑셀 가져오기 이력 + 되돌리기 모달
 *
 * 기능:
 *  - 최근 적용 이력 (20건) 목록 표시
 *  - 각 항목 1클릭 되돌리기 (스냅샷 복원)
 *  - 이미 복원된 항목은 회색 + "복원됨" 라벨
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    X, History, Undo2, AlertTriangle, CheckCircle2, Loader2, UserPlus, UserMinus, ArrowRight, PenLine, Palette,
    ChevronRight, ChevronDown,
} from 'lucide-react';
import { useEscapeClose } from '../../../hooks/useEscapeClose';
import { listImportLogs, markLogRestored, type ImportLog } from '../../../utils/timetableImportLog';
import { restoreSnapshot } from '../../../utils/timetableSnapshot';

interface ImportHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** 복원 성공 시 호출 — 캐시 invalidate 등 */
    onRestored?: () => void;
}

export const ImportHistoryModal: React.FC<ImportHistoryModalProps> = ({ isOpen, onClose, onRestored }) => {
    useEscapeClose(onClose);
    const [logs, setLogs] = useState<ImportLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const argbToCss = (argb?: string) => {
        if (!argb) return 'transparent';
        const s = argb.length === 8 ? argb.slice(2) : argb;
        return `#${s}`;
    };

    const loadLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const items = await listImportLogs(20);
            setLogs(items);
        } catch (err: any) {
            setError(err?.message || '이력 조회 실패');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) loadLogs();
    }, [isOpen, loadLogs]);

    const handleRestore = async (log: ImportLog) => {
        if (!log.snapshotId) {
            alert('이 항목은 스냅샷이 없어 복원할 수 없습니다 (구버전 로그).');
            return;
        }
        if (log.restoredAt) {
            alert('이미 복원된 항목입니다.');
            return;
        }
        const summary = log.result;
        const totalChanges = summary.additions + summary.removals + summary.moves + summary.renames + summary.colorChanges;
        if (!confirm(
            `이 적용을 되돌립니다.\n\n` +
            `· 추가 ${summary.additions}건 / 삭제 ${summary.removals}건 / 이동 ${summary.moves}건\n` +
            `· 반이름 변경 ${summary.renames}건 / 색상 변경 ${summary.colorChanges}건\n` +
            `(총 ${totalChanges}건의 변경을 되돌립니다)\n\n` +
            `진행하시겠습니까?`
        )) return;

        setRestoringId(log.id);
        setError(null);
        try {
            const result = await restoreSnapshot(log.snapshotId);
            await markLogRestored(log.id);
            await loadLogs();
            onRestored?.();
            const errText = result.errors.length > 0 ? `\n\n⚠ 오류 ${result.errors.length}건` : '';
            alert(
                `✅ 복원 완료\n\n` +
                `· enrollment 복원: ${result.restoredEnrollments}건\n` +
                `· enrollment 삭제 (새로 추가됐던 것): ${result.deletedEnrollments}건\n` +
                `· class 복원: ${result.restoredClasses}건` +
                errText
            );
        } catch (err: any) {
            console.error('[ImportHistory] 복원 실패', err);
            setError(err?.message || '복원 실패');
        } finally {
            setRestoringId(null);
        }
    };

    const formatTime = (ms: number) => {
        const d = new Date(ms);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${dd} ${h}:${min}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-sm w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                        <History size={18} className="text-amber-600" />
                        구글로 가져오기 이력
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-500">
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
                        <AlertTriangle size={14} />
                        {error}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                            <Loader2 size={24} className="animate-spin mb-2" />
                            <p className="text-xs">불러오는 중...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
                            <History size={32} className="mb-3 opacity-40" />
                            <p>가져오기 이력이 없습니다</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {logs.map(log => {
                                const isRestored = !!log.restoredAt;
                                const isRestoring = restoringId === log.id;
                                const total =
                                    log.result.additions + log.result.removals + log.result.moves +
                                    log.result.renames + log.result.colorChanges;
                                const isExpanded = expandedIds.has(log.id);
                                const hasDetails = !!(log.details && (
                                    (log.details.additions?.length || 0) +
                                    (log.details.removals?.length || 0) +
                                    (log.details.moves?.length || 0) +
                                    (log.details.renames?.length || 0) +
                                    (log.details.colorChanges?.length || 0) > 0
                                ));
                                return (
                                    <div
                                        key={log.id}
                                        className={`${isRestored ? 'bg-gray-50 opacity-60' : 'hover:bg-amber-50/30'}`}
                                    >
                                        <div className="px-4 py-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <button
                                                    onClick={() => hasDetails && toggleExpand(log.id)}
                                                    disabled={!hasDetails}
                                                    className="flex items-center gap-2 text-xs text-left flex-1 min-w-0"
                                                >
                                                    {hasDetails && (
                                                        isExpanded
                                                            ? <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
                                                            : <ChevronRight size={12} className="text-gray-500 flex-shrink-0" />
                                                    )}
                                                    {!hasDetails && <span className="w-3" />}
                                                    <span className="font-mono text-gray-500">{formatTime(log.createdAt)}</span>
                                                    {log.actorName && (
                                                        <span className="text-gray-600">· {log.actorName}</span>
                                                    )}
                                                    <span className="text-gray-400">·</span>
                                                    <span className="text-gray-600">{log.subjectFilter} {log.weekLabel}</span>
                                                    {isRestored && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-gray-200 text-gray-700 text-[10px] font-medium">
                                                            복원됨
                                                        </span>
                                                    )}
                                                </button>
                                                {!isRestored && (
                                                    <button
                                                        onClick={() => handleRestore(log)}
                                                        disabled={isRestoring}
                                                        className="flex items-center gap-1 px-2 py-1 text-xs border border-amber-300 bg-amber-50 text-amber-800 rounded-sm hover:bg-amber-100 disabled:opacity-50 font-medium flex-shrink-0"
                                                    >
                                                        {isRestoring ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
                                                        되돌리기
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-700 flex-wrap pl-5">
                                                <span className="text-gray-500">총 {total}건:</span>
                                                {log.result.additions > 0 && (
                                                    <span className="flex items-center gap-0.5 text-emerald-700">
                                                        <UserPlus size={11} /> {log.result.additions}
                                                    </span>
                                                )}
                                                {log.result.removals > 0 && (
                                                    <span className="flex items-center gap-0.5 text-red-700">
                                                        <UserMinus size={11} /> {log.result.removals}
                                                    </span>
                                                )}
                                                {log.result.moves > 0 && (
                                                    <span className="flex items-center gap-0.5 text-blue-700">
                                                        <ArrowRight size={11} /> {log.result.moves}
                                                    </span>
                                                )}
                                                {log.result.renames > 0 && (
                                                    <span className="flex items-center gap-0.5 text-purple-700">
                                                        <PenLine size={11} /> {log.result.renames}
                                                    </span>
                                                )}
                                                {log.result.colorChanges > 0 && (
                                                    <span className="flex items-center gap-0.5 text-pink-700">
                                                        <Palette size={11} /> {log.result.colorChanges}
                                                    </span>
                                                )}
                                                {log.result.errors && log.result.errors.length > 0 && (
                                                    <span className="text-orange-600 text-[10px]">
                                                        ⚠ 오류 {log.result.errors.length}건
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 펼침 디테일 */}
                                        {isExpanded && hasDetails && log.details && (
                                            <div className="px-4 pb-3 pl-9 space-y-2 bg-gray-50/50 border-t border-gray-100">
                                                {/* 추가 */}
                                                {!!log.details.additions?.length && (
                                                    <section className="pt-2">
                                                        <h4 className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1">
                                                            <UserPlus size={11} /> 학생 추가 ({log.details.additions.length})
                                                        </h4>
                                                        <div className="bg-white border border-emerald-100 rounded-sm divide-y divide-emerald-100">
                                                            {log.details.additions.map((a, i) => (
                                                                <div key={i} className="px-2 py-1 text-xs flex items-center gap-2">
                                                                    <span className={`px-1 py-0.5 rounded-sm font-mono text-[9px] ${a.matched ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                        {a.matched ? 'MATCH' : 'UNMATCHED'}
                                                                    </span>
                                                                    <span className="font-medium">{a.studentName}</span>
                                                                    <ArrowRight size={9} className="text-gray-400" />
                                                                    <span className="text-gray-700">{a.targetClassName}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}

                                                {/* 삭제 */}
                                                {!!log.details.removals?.length && (
                                                    <section>
                                                        <h4 className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
                                                            <UserMinus size={11} /> 학생 삭제 ({log.details.removals.length})
                                                        </h4>
                                                        <div className="bg-white border border-red-100 rounded-sm divide-y divide-red-100">
                                                            {log.details.removals.map((r, i) => (
                                                                <div key={i} className="px-2 py-1 text-xs flex items-center gap-2">
                                                                    <span className="px-1 py-0.5 rounded-sm font-mono text-[9px] bg-red-100 text-red-700">REMOVE</span>
                                                                    <span className="font-medium">{r.studentName}</span>
                                                                    <span className="text-gray-500">←</span>
                                                                    <span className="text-gray-700">{r.sourceClassName}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}

                                                {/* 이동 */}
                                                {!!log.details.moves?.length && (
                                                    <section>
                                                        <h4 className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                                                            <ArrowRight size={11} /> 학생 이동 ({log.details.moves.length})
                                                        </h4>
                                                        <div className="bg-white border border-blue-100 rounded-sm divide-y divide-blue-100">
                                                            {log.details.moves.map((m, i) => (
                                                                <div key={i} className="px-2 py-1 text-xs flex items-center gap-2 flex-wrap">
                                                                    <span className={`px-1 py-0.5 rounded-sm font-mono text-[9px] ${m.teacherChanged ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                        {m.teacherChanged ? '담임변경' : 'MOVE'}
                                                                    </span>
                                                                    <span className="font-medium">{m.studentName}</span>
                                                                    <span className="text-gray-700">
                                                                        {m.fromTeacher && <span className="text-gray-500">[{m.fromTeacher}·{m.fromDay || '?'}]</span>}{' '}
                                                                        {m.fromClassName}
                                                                    </span>
                                                                    <ArrowRight size={9} className="text-gray-400" />
                                                                    <span className="text-gray-700">
                                                                        {m.toTeacher && <span className={m.teacherChanged ? 'text-orange-600 font-bold' : 'text-gray-500'}>[{m.toTeacher}·{m.toDay || '?'}]</span>}{' '}
                                                                        {m.toClassName}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}

                                                {/* 반이름 변경 */}
                                                {!!log.details.renames?.length && (
                                                    <section>
                                                        <h4 className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
                                                            <PenLine size={11} /> 반이름 변경 ({log.details.renames.length})
                                                        </h4>
                                                        <div className="bg-white border border-purple-100 rounded-sm divide-y divide-purple-100">
                                                            {log.details.renames.map((r, i) => (
                                                                <div key={i} className="px-2 py-1 text-xs flex items-center gap-2">
                                                                    <span className="px-1 py-0.5 rounded-sm font-mono text-[9px] bg-purple-100 text-purple-700">RENAME</span>
                                                                    <span className="text-gray-700">{r.oldName}</span>
                                                                    <ArrowRight size={9} className="text-gray-400" />
                                                                    <span className="font-medium">{r.newName}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}

                                                {/* 색상 변경 */}
                                                {!!log.details.colorChanges?.length && (
                                                    <section>
                                                        <h4 className="text-xs font-bold text-pink-700 mb-1 flex items-center gap-1">
                                                            <Palette size={11} /> 수업 색상 변경 ({log.details.colorChanges.length})
                                                        </h4>
                                                        <div className="bg-white border border-pink-100 rounded-sm divide-y divide-pink-100">
                                                            {log.details.colorChanges.map((c, i) => (
                                                                <div key={i} className="px-2 py-1 text-xs flex items-center gap-2">
                                                                    <span className="px-1 py-0.5 rounded-sm font-mono text-[9px] bg-pink-100 text-pink-700">COLOR</span>
                                                                    <span className="font-medium">{c.className}</span>
                                                                    <span className="text-gray-400 ml-2">배경</span>
                                                                    <span className="inline-block w-3 h-3 border border-gray-300 rounded-sm" style={{ backgroundColor: argbToCss(c.oldBg) }} title={c.oldBg || '없음'} />
                                                                    {c.newBg && (
                                                                        <>
                                                                            <ArrowRight size={9} className="text-gray-400" />
                                                                            <span className="inline-block w-3 h-3 border border-gray-400 rounded-sm" style={{ backgroundColor: argbToCss(c.newBg) }} title={c.newBg} />
                                                                        </>
                                                                    )}
                                                                    <span className="text-gray-400 ml-1">글자</span>
                                                                    <span className="inline-block w-3 h-3 border border-gray-300 rounded-sm" style={{ backgroundColor: argbToCss(c.oldFg) }} title={c.oldFg || '없음'} />
                                                                    {c.newFg && (
                                                                        <>
                                                                            <ArrowRight size={9} className="text-gray-400" />
                                                                            <span className="inline-block w-3 h-3 border border-gray-400 rounded-sm" style={{ backgroundColor: argbToCss(c.newFg) }} title={c.newFg} />
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 text-xxs text-gray-500">
                    <span className="flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-600" />
                        스냅샷은 데이터 변경 직전에 자동 저장됩니다
                    </span>
                    <button onClick={loadLogs} disabled={loading} className="text-blue-600 hover:underline">
                        새로고침
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportHistoryModal;
