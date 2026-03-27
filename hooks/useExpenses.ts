import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Expense } from '../types/expense';

const COL = 'expenses';

// 전체 지출결의서 조회
export const useExpenses = () => {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async (): Promise<Expense[]> => {
      const q = query(collection(db, COL), orderBy('expenseDate', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
    },
    staleTime: 5 * 60 * 1000,
  });
};

// 지출결의서 생성/수정
export const useCreateExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Expense, 'id'> & { id?: string }) => {
      const id = data.id || `${data.author}_${data.expenseDate}_${Date.now()}`;
      const ref = doc(db, COL, id);
      await setDoc(ref, { ...data, id, updatedAt: new Date().toISOString() });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
};

// 지출결의서 삭제
export const useDeleteExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COL, id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
};
