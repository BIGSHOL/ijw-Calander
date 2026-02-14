import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface MarketingLead {
  id: string;
  source: string;
  count: number;
  conversionRate: number;
  period: string;
}

export interface TrialClass {
  id: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  subject: string;
  scheduledDate: string;
  status: 'scheduled' | 'completed' | 'no_show' | 'enrolled';
  assignedTeacher?: string;
  note?: string;
  createdAt: string;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: 'discount' | 'free_trial' | 'referral' | 'seasonal';
  startDate: string;
  endDate: string;
  isActive: boolean;
  conditions?: string;
  participantCount: number;
  createdAt: string;
}

export function useMarketing() {
  const queryClient = useQueryClient();

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['marketingLeads'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'marketing_leads'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketingLead));
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: trialClasses } = useQuery({
    queryKey: ['trialClasses'],
    queryFn: async () => {
      const q = query(collection(db, 'trial_classes'), orderBy('scheduledDate', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TrialClass));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: promotions } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'promotions'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion));
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    leads: leads ?? [],
    trialClasses: trialClasses ?? [],
    promotions: promotions ?? [],
    isLoading: leadsLoading,
  };
}
