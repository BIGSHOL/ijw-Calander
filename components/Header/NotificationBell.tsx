/**
 * NotificationBell — 헤더 우상단 알림 종 아이콘
 *
 * - useHeaderNotifications 구독으로 실시간 알림 수신
 * - 미읽음 > 0 이면 깜빡임(animate-pulse) + 빨간 배지
 * - 클릭 → 드롭다운으로 최근 50건 표시
 * - 알림 항목 클릭 → readBy.{uid} 업데이트 (per-user) + 상담 탭으로 이동 (선택)
 */

import React, { useMemo, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useHeaderNotifications, HeaderNotificationItem } from '../../hooks/useHeaderNotifications';

interface NotificationBellProps {
    currentUid: string | null | undefined;
    /** 알림 클릭 시 상담 탭으로 이동시키는 콜백 (선택, consultationId 전달) */
    onNavigateConsultation?: (consultationId?: string) => void;
}

function timeAgo(ts: HeaderNotificationItem['createdAt']): string {
    if (!ts) return '';
    try {
        const ms = (ts as any).toMillis ? (ts as any).toMillis() : new Date(ts as any).getTime();
        const diff = Date.now() - ms;
        const sec = Math.floor(diff / 1000);
        if (sec < 60) return '방금 전';
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}분 전`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}시간 전`;
        const day = Math.floor(hr / 24);
        if (day < 7) return `${day}일 전`;
        const d = new Date(ms);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
        return '';
    }
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
    currentUid,
    onNavigateConsultation,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const { items, unreadCount, markAsRead, markAllAsRead } = useHeaderNotifications(currentUid);

    const hasUnread = unreadCount > 0;

    const sorted = useMemo(() => items.slice(0, 50), [items]);

    const handleClickItem = async (n: HeaderNotificationItem) => {
        await markAsRead(n.id);
        if (n.consultationId && onNavigateConsultation) {
            onNavigateConsultation(n.consultationId);
        }
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative transition-colors mt-[5px] ${
                    isOpen ? 'text-accent' : 'text-gray-400 hover:text-white'
                } ${hasUnread ? 'animate-pulse' : ''}`}
                title="알림"
            >
                {hasUnread ? <BellRing size={20} className="text-yellow-300" /> : <Bell size={20} />}
                {hasUnread && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-sm flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[119]" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-sm shadow-2xl border border-gray-100 z-[120] overflow-hidden">
                        <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <span className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                <Bell size={14} /> 알림 {hasUnread && <span className="text-red-500">({unreadCount})</span>}
                            </span>
                            {hasUnread && (
                                <button
                                    onClick={() => markAllAsRead()}
                                    className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300"
                                >
                                    모두 읽음 처리
                                </button>
                            )}
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            {sorted.length === 0 ? (
                                <div className="p-6 text-center text-gray-400 text-sm">알림이 없습니다</div>
                            ) : (
                                sorted.map(n => {
                                    const isUnread = currentUid ? !n.readBy[currentUid] : false;
                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => handleClickItem(n)}
                                            className={`w-full text-left px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                                                isUnread ? 'bg-blue-50/40' : ''
                                            }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                {isUnread && (
                                                    <span className="mt-1.5 w-2 h-2 bg-red-500 rounded-full shrink-0" />
                                                )}
                                                <div className={`flex-1 min-w-0 ${isUnread ? '' : 'pl-4'}`}>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className={`text-xs ${isUnread ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                                                            {n.title}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 shrink-0">
                                                            {timeAgo(n.createdAt)}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-0.5 break-all">
                                                        {n.body}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
