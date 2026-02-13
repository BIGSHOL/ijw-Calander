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
    // 등록차수 연동
    studentId: data.studentId,
    studentMatchStatus: data.studentMatchStatus,
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
      const q = month
        ? query(collection(db, COL_BILLING), where('month', '==', month))
        : query(collection(db, COL_BILLING));

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map((docSnap) =>
        docToBillingRecord(docSnap.id, docSnap.data())
      );
      // 클라이언트 정렬 (복합 인덱스 불필요)
      return results.sort((a, b) =>
        month
          ? a.studentName.localeCompare(b.studentName, 'ko')
          : b.month.localeCompare(a.month)
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
    onError: (error: Error) => {
      console.error('[useBilling.createRecord] mutation error:', error);
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      // 수납 완료(paid) 전환 시 등록차수 캐시도 무효화
      if (variables.updates.status === 'paid') {
        queryClient.invalidateQueries({ queryKey: ['enrollment_terms'] });
      }
    },
    onError: (error: Error) => {
      console.error('[useBilling.updateRecord] mutation error:', error);
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
    onError: (error: Error) => {
      console.error('[useBilling.deleteRecord] mutation error:', error);
    },
  });

  // xlsx 일괄 import (중복 제외, 신규만 추가)
  const importRecords = useMutation({
    mutationFn: async ({
      records: billingRecords,
      month,
    }: {
      records: Omit<BillingRecord, 'id'>[];
      month: string;
    }) => {
      // 1) 해당 월 기존 데이터 조회
      const q = query(
        collection(db, COL_BILLING),
        where('month', '==', month)
      );
      const snapshot = await getDocs(q);

      // 2) 중복 판별 키셋 생성 (학생ID + 청구월 + 수납명)
      const existingKeys = new Set(
        snapshot.docs.map((d) => {
          const data = d.data();
          return `${data.externalStudentId}__${data.month}__${data.billingName}`;
        })
      );

      // 3) 신규 레코드만 필터링
      const newRecords = billingRecords.filter(
        (r) => !existingKeys.has(`${r.externalStudentId}__${r.month}__${r.billingName}`)
      );

      if (newRecords.length === 0) {
        return { added: 0, skipped: billingRecords.length };
      }

      // 4) 신규 레코드만 batch insert
      const now = new Date().toISOString();
      let count = 0;
      let batch = writeBatch(db);
      for (const record of newRecords) {
        const docRef = doc(collection(db, COL_BILLING));
        batch.set(docRef, { ...record, createdAt: now, updatedAt: now });
        count++;
        if (count % 450 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      if (count % 450 !== 0) {
        await batch.commit();
      }
      return { added: count, skipped: billingRecords.length - count };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (error: Error) => {
      console.error('[useBilling.importRecords] mutation error:', error);
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
    importRecords,
  };
}

export default useBilling;
