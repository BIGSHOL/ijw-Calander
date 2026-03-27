import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
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

// 결재 체크 토글
export const useToggleApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, checked }: { id: string; role: 'author' | 'executor' | 'director' | 'ceo'; checked: boolean }) => {
      const ref = doc(db, COL, id);
      await updateDoc(ref, {
        [`approvalChecks.${role}.checked`]: checked,
        [`approvalChecks.${role}.date`]: checked ? new Date().toISOString().split('T')[0] : null,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
};

// 증빙자료 업데이트
export const useUpdateReceipt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, receiptUrl }: { id: string; receiptUrl: string }) => {
      const ref = doc(db, COL, id);
      await updateDoc(ref, { receiptUrl });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
};

// 증빙 이미지 URL 업데이트
export const useUpdateReceiptUrls = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, receiptUrls }: { id: string; receiptUrls: string[] }) => {
      const ref = doc(db, COL, id);
      await updateDoc(ref, { receiptUrls });
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
