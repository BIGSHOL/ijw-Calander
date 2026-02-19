import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TextbookDistribution, TextbookBilling } from './useTextbooks';
import { useMemo } from 'react';

interface UseStudentTextbooksOptions {
  studentId: string;
  enabled?: boolean;
}

interface StudentTextbookStats {
  totalDistributed: number;
  totalBillingAmount: number;
  billingCount: number;
}

interface StudentTextbooksResult {
  distributions: TextbookDistribution[];
  billings: TextbookBilling[];
  stats: StudentTextbookStats;
  isLoading: boolean;
  error: Error | null;
}

export function useStudentTextbooks({
  studentId,
  enabled = true,
}: UseStudentTextbooksOptions): StudentTextbooksResult {
  const {
    data: distributions,
    isLoading: distLoading,
    error: distError,
  } = useQuery<TextbookDistribution[]>({
    queryKey: ['studentTextbookDistributions', studentId],
    queryFn: async () => {
      const q = query(
        collection(db, 'textbook_distributions'),
        where('studentId', '==', studentId)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as TextbookDistribution));
      return results.sort((a, b) => b.distributedAt.localeCompare(a.distributedAt));
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    enabled: enabled && !!studentId,
  });

  const {
    data: billings,
    isLoading: billLoading,
    error: billError,
  } = useQuery<TextbookBilling[]>({
    queryKey: ['studentTextbookBillings', studentId],
    queryFn: async () => {
      const q = query(
        collection(db, 'textbook_billings'),
        where('studentId', '==', studentId)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as TextbookBilling));
      return results.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    enabled: enabled && !!studentId,
  });

  const stats: StudentTextbookStats = useMemo(() => {
    const dist = distributions || [];
    const bill = billings || [];
    return {
      totalDistributed: dist.reduce((sum, d) => sum + d.quantity, 0),
      totalBillingAmount: bill.reduce((sum, b) => sum + b.amount, 0),
      billingCount: bill.length,
    };
  }, [distributions, billings]);

  return {
    distributions: distributions || [],
    billings: billings || [],
    stats,
    isLoading: distLoading || billLoading,
    error: (distError || billError) as Error | null,
  };
}
