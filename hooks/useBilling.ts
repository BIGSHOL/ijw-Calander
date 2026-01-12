import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { BillingRecord } from '../types';

const COL_BILLING = 'billing';

/**
 * 수납 관리 Hook
 * - 월별 청구서 CRUD
 * - React Query 기반 캐싱
 */
export function useBilling(month?: string) {
  const queryClient = useQueryClient();

  // 청구서 목록 조회
  const {
    data: records = [],
    isLoading,
    error,
    refetch,
  } = useQuery<BillingRecord[]>({
    queryKey: ['billing', month],
    queryFn: async () => {
      let q;
      if (month) {
        q = query(
          collection(db, COL_BILLING),
          where('month', '==', month),
          orderBy('studentName', 'asc')
        );
      } else {
        q = query(collection(db, COL_BILLING), orderBy('month', 'desc'));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as DocumentData;
        return {
          id: docSnap.id,
          studentId: data.studentId,
          studentName: data.studentName,
          month: data.month,
          amount: data.amount,
          paidAmount: data.paidAmount,
          status: data.status,
          dueDate: data.dueDate,
          items: data.items,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
          ...(data.paidDate && { paidDate: data.paidDate }),
          ...(data.memo && { memo: data.memo }),
        } as BillingRecord;
      });
    },
    staleTime: 1000 * 60 * 5, // 5분 캐싱
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  // 청구서 생성
  const createRecord = useMutation({
    mutationFn: async (data: Omit<BillingRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newRecord: Record<string, any> = {
        studentId: data.studentId,
        studentName: data.studentName,
        month: data.month,
        amount: data.amount,
        paidAmount: data.paidAmount,
        status: data.status,
        dueDate: data.dueDate,
        items: data.items,
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
      };

      if (data.paymentMethod) newRecord.paymentMethod = data.paymentMethod;
      if (data.paidDate) newRecord.paidDate = data.paidDate;
      if (data.memo) newRecord.memo = data.memo;

      const docRef = await addDoc(collection(db, COL_BILLING), newRecord);
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  // 청구서 수정
  const updateRecord = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BillingRecord> }) => {
      const docRef = doc(db, COL_BILLING, id);
      const now = new Date().toISOString();
      await updateDoc(docRef, {
        ...updates,
        updatedAt: now,
      });
      return { id, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  // 청구서 삭제
  const deleteRecord = useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, COL_BILLING, id);
      await deleteDoc(docRef);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  // 납부 처리
  const processPayment = useMutation({
    mutationFn: async ({
      id,
      amount,
      method,
    }: {
      id: string;
      amount: number;
      method: 'card' | 'cash' | 'transfer';
    }) => {
      const record = records.find((r) => r.id === id);
      if (!record) throw new Error('청구서를 찾을 수 없습니다.');

      const newPaidAmount = record.paidAmount + amount;
      const newStatus =
        newPaidAmount >= record.amount ? 'paid' : newPaidAmount > 0 ? 'partial' : 'pending';

      const docRef = doc(db, COL_BILLING, id);
      await updateDoc(docRef, {
        paidAmount: newPaidAmount,
        status: newStatus,
        paymentMethod: method,
        paidDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
      });

      return { id, newPaidAmount, newStatus };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  return {
    records,
    isLoading,
    error,
    refetch,
    createRecord,
    updateRecord,
    deleteRecord,
    processPayment,
  };
}

export default useBilling;
