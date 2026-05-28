/**
 * 헤더 알림 실시간 구독 hook (직원용)
 *
 * - notifications 컬렉션 최근 50건 구독 (createdAt desc)
 * - 본인이 만든 알림(createdBy === currentUid)은 제외
 * - 본인이 읽은 알림(readBy[uid] 존재)도 미읽음 카운트에서 제외
 * - markAsRead(id): readBy.{uid} 만 업데이트 — 다른 사람의 readBy는 건드리지 않음
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface HeaderNotificationItem {
    id: string;
    type: string;                       // 'consultation_created' 등
    title: string;
    body: string;
    consultationId?: string;
    createdBy: string | null;
    createdByName?: string;
    createdAt: Timestamp | null;
    readBy: Record<string, Timestamp>;
}

interface UseHeaderNotificationsResult {
    items: HeaderNotificationItem[];          // 본인 알림 제외한 전체 (읽음/미읽음 모두)
    unreadItems: HeaderNotificationItem[];    // 미읽음 only
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

export const useHeaderNotifications = (currentUid: string | null | undefined): UseHeaderNotificationsResult => {
    const [items, setItems] = useState<HeaderNotificationItem[]>([]);

    useEffect(() => {
        const q = query(
            collection(db, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        const unsub = onSnapshot(q, (snap) => {
            const rows: HeaderNotificationItem[] = [];
            snap.forEach((d) => {
                const data = d.data() as any;
                rows.push({
                    id: d.id,
                    type: data.type || '',
                    title: data.title || '',
                    body: data.body || '',
                    consultationId: data.consultationId,
                    createdBy: data.createdBy || null,
                    createdByName: data.createdByName,
                    createdAt: data.createdAt || null,
                    readBy: data.readBy || {},
                });
            });
            setItems(rows);
        }, (err) => {
            console.warn('[useHeaderNotifications] snapshot error:', err);
        });
        return () => unsub();
    }, []);

    // 본인이 만든 알림은 제외
    const visible = useMemo(
        () => (currentUid ? items.filter(n => n.createdBy !== currentUid) : items),
        [items, currentUid]
    );

    const unreadItems = useMemo(
        () => (currentUid ? visible.filter(n => !n.readBy[currentUid]) : visible),
        [visible, currentUid]
    );

    const markAsRead = useCallback(async (id: string) => {
        if (!currentUid) return;
        try {
            const ref = doc(db, 'notifications', id);
            await updateDoc(ref, {
                [`readBy.${currentUid}`]: serverTimestamp(),
            });
        } catch (err) {
            console.warn('[useHeaderNotifications] markAsRead error:', err);
        }
    }, [currentUid]);

    const markAllAsRead = useCallback(async () => {
        if (!currentUid) return;
        const targets = unreadItems.slice(0, 20);
        await Promise.all(targets.map(n => markAsRead(n.id)));
    }, [unreadItems, markAsRead, currentUid]);

    return {
        items: visible,
        unreadItems,
        unreadCount: unreadItems.length,
        markAsRead,
        markAllAsRead,
    };
};