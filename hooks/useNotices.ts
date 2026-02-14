import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, increment } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UserRole } from '../types';

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'schedule' | 'policy' | 'event' | 'urgent';
  priority: 'normal' | 'important' | 'urgent';
  isPinned: boolean;
  isPublished: boolean;
  targetRoles: UserRole[];
  attachments: { name: string; url: string; size: number }[];
  viewCount: number;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export function useNotices() {
  const queryClient = useQueryClient();

  const { data: notices, isLoading, error } = useQuery({
    queryKey: ['notices'],
    queryFn: async () => {
      const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice));
    },
    staleTime: 5 * 60 * 1000,
  });

  const createNotice = useMutation({
    mutationFn: async (data: Omit<Notice, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'notices'), { ...data, viewCount: 0, createdAt: now, updatedAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
    onError: (error: Error) => {
      console.error('[useNotices.createNotice] mutation error:', error);
    },
  });

  const updateNotice = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Notice> & { id: string }) => {
      await updateDoc(doc(db, 'notices', id), { ...data, updatedAt: new Date().toISOString() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
    onError: (error: Error) => {
      console.error('[useNotices.updateNotice] mutation error:', error);
    },
  });

  const deleteNotice = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'notices', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
    onError: (error: Error) => {
      console.error('[useNotices.deleteNotice] mutation error:', error);
    },
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      await updateDoc(doc(db, 'notices', id), { isPinned: !isPinned, updatedAt: new Date().toISOString() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
    onError: (error: Error) => {
      console.error('[useNotices.togglePin] mutation error:', error);
    },
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const now = new Date().toISOString();
      const updates: Record<string, any> = { isPublished: !isPublished, updatedAt: now };
      if (!isPublished) updates.publishedAt = now;
      await updateDoc(doc(db, 'notices', id), updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
    onError: (error: Error) => {
      console.error('[useNotices.togglePublish] mutation error:', error);
    },
  });

  const incrementViewCount = useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, 'notices', id), { viewCount: increment(1) });
    },
    onError: (error: Error) => {
      console.error('[useNotices.incrementViewCount] mutation error:', error);
    },
  });

  return {
    notices: notices ?? [], isLoading, error,
    createNotice, updateNotice, deleteNotice,
    togglePin, togglePublish, incrementViewCount,
  };
}
