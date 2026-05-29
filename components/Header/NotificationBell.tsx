/**
 * NotificationBell — 헤더 우상단 알림 종 아이콘
 *
 * - useHeaderNotifications 구독으로 실시간 알림 수신
 * - 미읽음 > 0 이면 깜빡임(animate-pulse) + 빨간 배지
 * - 클릭 → 드롭다운으로 알림 표시 (5건 / 페이지, prev/next)
 * - 알림 항목 클릭 → readBy.{uid} 업데이트 + 상담 탭으로 이동
 * - X 버튼 → dismissedBy.{uid} 업데이트, 본인 리스트에서 제거
 * - 드롭다운은 fixed positioning — 부모 stacking context(overflow-auto 등)에 가려지지 않음
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { useHeaderNotifications, HeaderNotificationItem } from '../../hooks/useHeaderNotifications';

interface NotificationBellProps {
    currentUid: string | null | undefined;
    /** 알림 클릭 시 상담 탭으로 이동시키는 콜백 (선택, consultationId 전달) */
    onNavigateConsultation?: (consultationId?: string) => void;
}

const PAGE_SIZE = 5;

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
    const [page, setPage] = useState(0);
    const { items, unreadCount, markAsRead, markAllAsRead, dismissNotification } = useHeaderNotifications(currentUid);

    const hasUnread = unreadCount > 0;

    const sorted = useMemo(() => items.slice(0, 50), [items]);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageItems = useMemo(
        () => sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
        [sorted, safePage]
    );

    // 열릴 때 첫 페이지로
    useEffect(() => {
        if (isOpen) setPage(0);
    }, [isOpen]);

    // 알림 개수가 줄어서 현재 페이지가 비면 자동으로 한 페이지 앞으로
    useEffect(() => {
        if (safePage > 0 && pageItems.length === 0) {
            setPage(safePage - 1);
        }
    }, [pageItems.length, safePage]);

    const handleClickItem = async (n: HeaderNotificationItem) => {
        await markAsRead(n.id);
        if (onNavigateConsultation) {
            onNavigateConsultation(n.consultationId);
        }
        setIsOpen(false);
    };

    const handleDismiss = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        await dismissNotification(id);
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
                    <div className="fixed inset-0 z-[1199]" onClick={() => setIsOpen(false)} />
                    <div className="fixed top-12 right-4 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-sm shadow-2xl border border-gray-100 z-[1200] overflow-hidden">
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
                        <div>
                            {pageItems.length === 0 ? (
                                <div className="p-6 text-center text-gray-400 text-sm">알림이 없습니다</div>
                            ) : (
                                pageItems.map(n => {
                                    const isUnread = currentUid ? !n.readBy[currentUid] : false;
                                    return (
                                        <div
                                            key={n.id}
                                            className={`relative group border-b border-gray-100 transition-colors ${
                                                isUnread ? 'bg-blue-50/40' : ''
                                            } hover:bg-gray-50`}
                                        >
                                            <button
                                                onClick={() => handleClickItem(n)}
                                                className="w-full text-left px-4 py-2.5 pr-9"
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
                                            <button
                                                onClick={(e) => handleDismiss(e, n.id)}
                                                className="absolute top-1.5 right-1.5 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title="이 알림 제거"
                                                aria-label="알림 제거"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        {sorted.length > PAGE_SIZE && (
                            <div className="p-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                                <button
                                    onClick={() => setPage(Math.max(0, safePage - 1))}
                                    disabled={safePage === 0}
                                    className="text-xs px-2 py-1 bg-white border border-gray-200 rounded font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                                >
                                    ← 이전
                                </button>
                                <span className="text-xs text-gray-600 font-bold">
                                    {safePage + 1} / {totalPages} <span className="text-gray-400 font-normal">({sorted.length}건)</span>
                                </span>
                                <button
                                    onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                                    disabled={safePage >= totalPages - 1}
                                    className="text-xs px-2 py-1 bg-white border border-gray-200 rounded font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                                >
                                    다음 →
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
