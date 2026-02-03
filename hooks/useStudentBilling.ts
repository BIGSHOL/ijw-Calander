import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { BillingRecord, BillingSummaryStats } from '../types/billing';
import { useMemo } from 'react';

interface UseStudentBillingOptions {
  studentName: string;
  enabled?: boolean;
}

interface StudentBillingResult {
  records: BillingRecord[];
  stats: BillingSummaryStats;
  isLoading: boolean;
  error: Error | null;
}

/**
 * 특정 학생의 수납 기록만 조회하는 Hook
 * - Firebase 비용 최적화: studentName으로 필터링된 쿼리
 * - 클라이언트 캐싱: staleTime 5분
 */
export function useStudentBilling({
  studentName,
  enabled = true
}: UseStudentBillingOptions): StudentBillingResult {
  const { data, isLoading, error } = useQuery<BillingRecord[]>({
    queryKey: ['studentBilling', studentName],
    queryFn: async () => {
      const q = query(
        collection(db, 'billing'),
        where('studentName', '==', studentName)
      );

      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BillingRecord));

      // 클라이언트에서 정렬 (Firebase 복합 인덱스 불필요)
      return records.sort((a, b) => b.month.localeCompare(a.month));
    },
    staleTime: 1000 * 60 * 5,  // 5분 캐싱
    gcTime: 1000 * 60 * 15,    // 15분 GC
    enabled: enabled && !!studentName,
  });

  // 통계 계산 (클라이언트 사이드)
  const stats: BillingSummaryStats = useMemo(() => {
    const records = data || [];
    const totalBilled = records.reduce((sum, r) => sum + (r.billedAmount || 0), 0);
    const totalDiscount = records.reduce((sum, r) => sum + (r.discountAmount || 0), 0);
    const totalPaid = records.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
    const totalUnpaid = records.reduce((sum, r) => sum + (r.unpaidAmount || 0), 0);
    const pendingCount = records.filter(r => r.status === 'pending').length;
    const paidCount = records.filter(r => r.status === 'paid').length;
    const collectionRate = totalBilled > 0
      ? Math.min((totalPaid / (totalBilled - totalDiscount)) * 100, 100)
      : 0;

    return {
      totalBilled,
      totalDiscount,
      totalPaid,
      totalUnpaid,
      pendingCount,
      paidCount,
      collectionRate,
    };
  }, [data]);

  return {
    records: data || [],
    stats,
    isLoading,
    error: error as Error | null,
  };
}
