import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface KPIs {
  monthlyRevenue: number;
  collectionRate: number;
  activeStudents: number;
  newEnrollments: number;
  withdrawals: number;
  retentionRate: number;
  revenueTrend?: number;
  collectionTrend?: number;
  studentTrend?: number;
  enrollmentTrend?: number;
  withdrawalTrend?: number;
  retentionTrend?: number;
}

export function useAnalytics(month: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', month],
    queryFn: async (): Promise<{ kpis: KPIs; revenueData: any[]; studentTrend: any[] }> => {
      // Billing data for revenue
      const billingSnap = await getDocs(
        query(collection(db, 'billing'), where('month', '==', month))
      );
      const billingRecords = billingSnap.docs.map(d => d.data());

      const totalBilled = billingRecords.reduce((sum, r) => sum + (r.billedAmount || 0), 0);
      const totalPaid = billingRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
      const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;

      // Student data
      const studentsSnap = await getDocs(collection(db, 'students'));
      const students = studentsSnap.docs.map(d => d.data());
      const activeStudents = students.filter(s => s.status === 'active' || !s.status).length;
      const totalStudents = students.length;
      const retentionRate = totalStudents > 0 ? (activeStudents / totalStudents) * 100 : 0;

      return {
        kpis: {
          monthlyRevenue: totalPaid,
          collectionRate,
          activeStudents,
          newEnrollments: 0,
          withdrawals: 0,
          retentionRate,
        },
        revenueData: [],
        studentTrend: [],
      };
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!month,
  });

  return {
    kpis: data?.kpis ?? null,
    revenueData: data?.revenueData ?? [],
    studentTrend: data?.studentTrend ?? [],
    isLoading,
    error,
  };
}
