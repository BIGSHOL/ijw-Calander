import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface ParentMessage {
  id: string;
  type: 'sms' | 'kakao' | 'email' | 'app';
  templateId?: string;
  subject?: string;
  content: string;
  recipientIds: string[];
  recipientCount: number;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  channel: string;
  sentAt?: string;
  createdBy: string;
  createdAt: string;
}

export function useParentMessages() {
  const queryClient = useQueryClient();

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['parentMessages'],
    queryFn: async () => {
      const q = query(collection(db, 'parent_messages'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ParentMessage));
    },
    staleTime: 5 * 60 * 1000,
  });

  const sendMessage = useMutation({
    mutationFn: async (data: Omit<ParentMessage, 'id' | 'createdAt' | 'sentAt'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'parent_messages'), { ...data, createdAt: now, sentAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parentMessages'] }),
  });

  return { messages: messages ?? [], isLoading, error, sendMessage };
}
