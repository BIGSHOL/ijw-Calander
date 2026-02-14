import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface PayrollRecord {
  id: string;
  staffId: string;
  staffName: string;
  month: string;
  baseSalary: number;
  allowances: {
    overtime: number;
    meal: number;
    transport: number;
    bonus: number;
    classBonus: number;
    other: number;
  };
  deductions: {
    incomeTax: number;
    localTax: number;
    nationalPension: number;
    healthInsurance: number;
    employmentInsurance: number;
    other: number;
  };
  totalAllowance: number;
  totalDeduction: number;
  netPay: number;
  status: 'draft' | 'confirmed' | 'paid';
  paidDate?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function usePayroll(month: string) {
  const queryClient = useQueryClient();

  const { data: records, isLoading, error } = useQuery({
    queryKey: ['payroll', month],
    queryFn: async () => {
      const q = query(collection(db, 'payroll'), where('month', '==', month));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as PayrollRecord))
        .sort((a, b) => a.staffName.localeCompare(b.staffName, 'ko'));
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!month,
  });

  const createRecord = useMutation({
    mutationFn: async (data: Omit<PayrollRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'payroll'), { ...data, createdAt: now, updatedAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', month] }),
  });

  const updateRecord = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PayrollRecord> & { id: string }) => {
      await updateDoc(doc(db, 'payroll', id), { ...data, updatedAt: new Date().toISOString() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', month] }),
  });

  return { records: records ?? [], isLoading, error, createRecord, updateRecord };
}
