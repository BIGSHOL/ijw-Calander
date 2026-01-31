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
  writeBatch,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { BillingRecord } from '../types';

const COL_BILLING = 'billing';

/**
 * xlsx 청구월 포맷(202601) → 내부 포맷(2026-01) 변환
 */
export function normalizeMonth(raw: string | number): string {
  const s = String(raw);
  if (s.includes('-')) return s; // 이미 2026-01 형식
  if (s.length === 6) return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
  return s;
}

/**
 * Firestore 문서 → BillingRecord 매핑
 */
function docToBillingRecord(id: string, data: DocumentData): BillingRecord {
  return {
    id,
    externalStudentId: data.externalStudentId ?? '',
    studentName: data.studentName ?? '',
    grade: data.grade ?? '',
    school: data.school ?? '',
    parentPhone: data.parentPhone ?? '',
    studentPhone: data.studentPhone ?? '',
    category: data.category ?? '',
    month: data.month ?? '',
    billingDay: data.billingDay ?? 0,
    billingName: data.billingName ?? '',
    status: data.status ?? 'pending',
    billedAmount: data.billedAmount ?? 0,
    discountAmount: data.discountAmount ?? 0,
    pointsUsed: data.pointsUsed ?? 0,
    paidAmount: data.paidAmount ?? 0,
    unpaidAmount: data.unpaidAmount ?? 0,
    paymentMethod: data.paymentMethod ?? '',
    cardCompany: data.cardCompany ?? '',
    paidDate: data.paidDate ?? '',
    cashReceipt: data.cashReceipt ?? '',
    memo: data.memo ?? '',
    createdAt: data.createdAt ?? '',
    updatedAt: data.updatedAt ?? '',
  };
}

/**
 * 수납 관리 Hook
 * - 월별 수납 CRUD
 * - xlsx 일괄 import
 * - React Query 기반 캐싱
 */
export function useBilling(month?: string) {
  const queryClient = useQueryClient();

  // 수납 목록 조회
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
      return snapshot.docs.map((docSnap) =>
        docToBillingRecord(docSnap.id, docSnap.data())
      );
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  // 수납 생성
  const createRecord = useMutation({
    mutationFn: async (data: Omit<BillingRecord, 'id'>) => {
      const now = new Date().toISOString();
      const docData: Record<string, any> = { ...data, createdAt: now, updatedAt: now };
      delete (docData as any).id;
      const docRef = await addDoc(collection(db, COL_BILLING), docData);
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  // 수납 수정
  const updateRecord = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BillingRecord> }) => {
      const docRef = doc(db, COL_BILLING, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      return { id, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  // 수납 삭제
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

  // 월 단위 삭제 (import 전 기존 데이터 제거용)
  const deleteByMonth = useMutation({
    mutationFn: async (targetMonth: string) => {
      const q = query(
        collection(db, COL_BILLING),
        where('month', '==', targetMonth)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return 0;

      // Firestore batch는 500개 제한
      let count = 0;
      let batch = writeBatch(db);
      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;
        if (count % 450 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      if (count % 450 !== 0) {
        await batch.commit();
      }
      return count;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  // xlsx 일괄 import
  const importRecords = useMutation({
    mutationFn: async (billingRecords: Omit<BillingRecord, 'id'>[]) => {
      let count = 0;
      let batch = writeBatch(db);
      for (const record of billingRecords) {
        const docRef = doc(collection(db, COL_BILLING));
        batch.set(docRef, record);
        count++;
        if (count % 450 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      if (count % 450 !== 0) {
        await batch.commit();
      }
      return count;
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
    deleteByMonth,
    importRecords,
  };
}

export default useBilling;
