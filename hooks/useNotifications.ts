import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface NotificationTemplate {
  id: string;
  name: string;
  category: 'attendance' | 'billing' | 'notice' | 'schedule' | 'custom';
  channel: 'sms' | 'kakao' | 'both';
  content: string;
  variables: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLog {
  id: string;
  templateId?: string;
  channel: 'sms' | 'kakao';
  content: string;
  recipientCount: number;
  recipients: { name: string; phone: string; studentName?: string }[];
  status: 'pending' | 'sent' | 'partial' | 'failed';
  sentCount: number;
  failedCount: number;
  sentAt: string;
  sentBy: string;
  sentByName: string;
  cost?: number;
  trigger?: 'manual' | 'auto_attendance' | 'auto_billing';
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['notificationTemplates'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'notification_templates'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationTemplate));
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['notificationLogs'],
    queryFn: async () => {
      const q = query(collection(db, 'notification_logs'), orderBy('sentAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationLog));
    },
    staleTime: 5 * 60 * 1000,
  });

  const createTemplate = useMutation({
    mutationFn: async (data: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'notification_templates'), { ...data, createdAt: now, updatedAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificationTemplates'] }),
  });

  const sendNotification = useMutation({
    mutationFn: async (data: Omit<NotificationLog, 'id'>) => {
      await addDoc(collection(db, 'notification_logs'), data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificationLogs'] }),
  });

  return {
    templates: templates ?? [],
    logs: logs ?? [],
    isLoading: templatesLoading || logsLoading,
    createTemplate,
    sendNotification,
  };
}
