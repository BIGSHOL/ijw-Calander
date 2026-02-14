import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Contract {
  id: string;
  studentId: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  templateId?: string;
  type: 'enrollment' | 'renewal' | 'special';
  subjects: string[];
  startDate: string;
  endDate: string;
  monthlyFee: number;
  registrationFee: number;
  discountAmount: number;
  totalAmount: number;
  refundPolicy: string;
  status: 'draft' | 'signed' | 'active' | 'expired' | 'terminated';
  signedAt?: string;
  signedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function useContracts() {
  const queryClient = useQueryClient();

  const { data: contracts, isLoading, error } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const q = query(collection(db, 'contracts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Contract));
    },
    staleTime: 5 * 60 * 1000,
  });

  const createContract = useMutation({
    mutationFn: async (data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'contracts'), { ...data, createdAt: now, updatedAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  });

  const updateContract = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Contract> & { id: string }) => {
      await updateDoc(doc(db, 'contracts', id), { ...data, updatedAt: new Date().toISOString() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  });

  return { contracts: contracts ?? [], isLoading, error, createContract, updateContract };
}
