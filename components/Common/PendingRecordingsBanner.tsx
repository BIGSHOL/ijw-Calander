import React, { useEffect, useState, useMemo } from 'react';
import { AlertCircle, X, ArrowRight } from 'lucide-react';
import {
    listPending,
    removePending,
    RECORDING_TYPE_LABELS,
    RECORDING_TYPE_TAB,
    type PendingRecording,
} from '../../utils/pendingRecordings';
import type { AppTab } from '../../types';

interface PendingRecordingsBannerProps {
    onNavigate: (tab: AppTab) => void;
}

/**
 * 메인 진입 시 처리 안 된 녹음(다운로드만 되고 분석 미실시)이 있으면 배너로 안내.
 * 시나리오: 사용자가 녹음 시작 → 메인 새로고침/배포 → 팝업은 살아있어 파일 자동 다운로드
 *   → 다음에 메인 들어왔을 때 "○○ 녹음이 있습니다. 다운로드된 파일을 끌어놓으면 분석합니다"
 */
export const PendingRecordingsBanner: React.FC<PendingRecordingsBannerProps> = ({ onNavigate }) => {
    const [items, setItems] = useState<PendingRecording[]>([]);
    const [dismissedSession, setDismissedSession] = useState(false);

    useEffect(() => {
        // 마운트 시 한 번 스캔 (cleanupExpired 자동 실행)
        setItems(listPending());
    }, []);

    // 시간순(오래된 것부터) 메시지 그룹화
    const groups = useMemo(() => {
        const byType = new Map<PendingRecording['type'], PendingRecording[]>();
        items.forEach(it => {
            const arr = byType.get(it.type) || [];
            arr.push(it);
            byType.set(it.type, arr);
        });
        return Array.from(byType.entries());
    }, [items]);

    if (items.length === 0 || dismissedSession) return null;

    const handleGoTab = (type: PendingRecording['type']) => {
        const tab = RECORDING_TYPE_TAB[type] as AppTab;
        if (tab) onNavigate(tab);
    };

    const handleDismissAll = () => {
        // 세션 내에서만 숨김 (다시 새로고침하면 또 보임 — 의도적)
        setDismissedSession(true);
    };

    const handleRemoveOne = (id: string) => {
        removePending(id);
        setItems(prev => prev.filter(it => it.id !== id));
    };

    const formatTime = (ms: number) => {
        const d = new Date(ms);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${m}/${dd} ${h}:${min}`;
    };

    return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-amber-900 mb-1">
                        분석되지 않은 녹음 {items.length}건이 있습니다
                    </div>
                    <div className="text-xs text-amber-800 mb-2">
                        다운로드된 녹음 파일을 해당 탭에 끌어놓으면 컨텍스트가 자동 복원되어 분석이 시작됩니다.
                    </div>
                    <div className="space-y-1">
                        {groups.map(([type, list]) => (
                            <div key={type} className="flex items-center gap-2 text-xs">
                                <button
                                    onClick={() => handleGoTab(type)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium transition-colors"
                                >
                                    {RECORDING_TYPE_LABELS[type]} ({list.length})
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                                <span className="text-amber-700 truncate">
                                    {list.map(it => {
                                        const ctx = it.context || {};
                                        const label =
                                            ctx.title ||
                                            ctx.studentName ||
                                            (Array.isArray(ctx.selectedStudents) && ctx.selectedStudents[0]?.name) ||
                                            '제목 없음';
                                        return `${label} (${formatTime(it.startedAt)})`;
                                    }).join(' · ')}
                                </span>
                                <div className="flex gap-1 ml-auto">
                                    {list.map(it => (
                                        <button
                                            key={it.id}
                                            onClick={() => handleRemoveOne(it.id)}
                                            className="text-amber-600 hover:text-red-600 text-xxs px-1"
                                            title={`${formatTime(it.startedAt)} 항목 무시`}
                                        >
                                            ×
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <button
                    onClick={handleDismissAll}
                    className="p-1 text-amber-600 hover:text-amber-800 flex-shrink-0"
                    title="이 세션에서 숨기기"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default PendingRecordingsBanner;
