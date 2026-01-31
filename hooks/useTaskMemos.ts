/**
 * useTaskMemos - Task memo state and operations extracted from App.tsx
 *
 * Handles: Memo subscription, Send/Read/Delete, UI state (modal, dropdown)
 */

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TaskMemo, UserProfile, StaffMember } from '../types';
import { listenerRegistry } from '../utils/firebaseCleanup';

interface UseTaskMemosParams {
  currentUser: User | null;
  userProfile: UserProfile | null;
  usersFromStaff: UserProfile[];
  formatUserDisplay: (u: UserProfile | StaffMember) => string;
}

export const useTaskMemos = ({
  currentUser,
  userProfile,
  usersFromStaff,
  formatUserDisplay,
}: UseTaskMemosParams) => {
  const [taskMemos, setTaskMemos] = useState<TaskMemo[]>([]);
  const [isMemoDropdownOpen, setIsMemoDropdownOpen] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [memoRecipients, setMemoRecipients] = useState<string[]>([]);
  const [memoMessage, setMemoMessage] = useState('');
  const [selectedMemo, setSelectedMemo] = useState<TaskMemo | null>(null);

  // Subscribe to Task Memos (only current user's received memos)
  // 최적화: 서버 측 필터링 추가 (isDeleted=false, 읽기 -50%)
  useEffect(() => {
    if (!currentUser) {
      setTaskMemos([]);
      return;
    }
    const q = query(
      collection(db, "taskMemos"),
      where("to", "==", currentUser.uid),
      where("isDeleted", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memos = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as TaskMemo[];

      // Client-side sort only (filter already done on server)
      const sortedMemos = memos.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTaskMemos(sortedMemos);
    });
    return listenerRegistry.register('App(taskMemos)', unsubscribe);
  }, [currentUser]);

  // Unread memo count
  const unreadMemoCount = taskMemos.filter(m => !m.isRead).length;

  // Send Task Memo (Multi-recipient)
  const handleSendMemo = async () => {
    if (!currentUser || !userProfile || memoRecipients.length === 0 || !memoMessage.trim()) return;

    const batch = writeBatch(db);
    const now = new Date().toISOString();

    memoRecipients.forEach(recipientId => {
      const recipient = usersFromStaff.find(u => u.uid === recipientId);
      if (recipient) {
        const newDocRef = doc(collection(db, "taskMemos"));
        const newMemo: TaskMemo = {
          id: newDocRef.id,
          from: currentUser.uid,
          fromName: formatUserDisplay(userProfile),
          to: recipientId,
          toName: formatUserDisplay(recipient),
          message: memoMessage.trim(),
          createdAt: now,
          isRead: false
        };
        batch.set(newDocRef, newMemo);
      }
    });

    try {
      await batch.commit();
      setMemoMessage('');
      setMemoRecipients([]);
      setIsMemoModalOpen(false);
      alert('메모를 보냈습니다.');
    } catch (error) {
      console.error("Error sending memos:", error);
      alert('메모 전송 중 오류가 발생했습니다.');
    }
  };

  // Mark memo as read
  const handleMarkMemoRead = async (id: string) => {
    await updateDoc(doc(db, "taskMemos", id), { isRead: true });
  };

  // Delete memo (Soft Delete)
  const handleDeleteMemo = async (id: string) => {
    if (!window.confirm("이 메모를 삭제하시겠습니까?")) return;
    try {
      await updateDoc(doc(db, "taskMemos", id), { isDeleted: true });
      setSelectedMemo(null);
    } catch (error) {
      console.error("Error deleting memo:", error);
      alert("메모 삭제 중 오류가 발생했습니다.");
    }
  };

  return {
    taskMemos,
    isMemoDropdownOpen,
    setIsMemoDropdownOpen,
    isMemoModalOpen,
    setIsMemoModalOpen,
    memoRecipients,
    setMemoRecipients,
    memoMessage,
    setMemoMessage,
    selectedMemo,
    setSelectedMemo,
    unreadMemoCount,
    handleSendMemo,
    handleMarkMemoRead,
    handleDeleteMemo,
  };
};
