import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  EnrollmentTerm,
  EnrollmentTermStatus,
  EnrollmentTermSource,
  StudentTermSummary,
} from '../types/enrollmentTerm';

const COL = 'enrollment_terms';

function docToEnrollmentTerm(id: string, data: DocumentData): EnrollmentTerm {
  return {
    id,
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    month: data.month ?? '',
    termNumber: data.termNumber ?? 0,
    billedAmount: data.billedAmount ?? 0,
    unitPrice: data.unitPrice ?? 0,
    salarySettingId: data.salarySettingId,
    salarySettingName: data.salarySettingName,
    billingRecordId: data.billingRecordId,
    billingName: data.billingName,
    source: data.source ?? 'manual',
    status: data.status ?? 'active',
    note: data.note,
    createdAt: data.createdAt ?? '',
    updatedAt: data.updatedAt ?? '',
  };
}

/**
 * 월별 전체 등록차수 조회 → Map<studentId, StudentTermSummary>
 */
export function useMonthlyEnrollmentTerms(month?: string) {
  return useQuery<Map<string, StudentTermSummary>>({
    queryKey: ['enrollment_terms', 'monthly', month],
    queryFn: async () => {
      if (!month) return new Map();

      const q = query(
        collection(db, COL),
        where('month', '==', month),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      const terms = snapshot.docs.map((d) =>
        docToEnrollmentTerm(d.id, d.data())
      );

      // studentId별로 그룹화
      const map = new Map<string, StudentTermSummary>();
      for (const term of terms) {
        if (!map.has(term.studentId)) {
          map.set(term.studentId, {
            studentId: term.studentId,
            month: term.month,
            currentTermNumber: 0,
            totalTerms: 0,
            terms: [],
          });
        }
        const summary = map.get(term.studentId)!;
        summary.terms.push(term);
      }

      // 각 학생의 요약 정보 계산
      for (const summary of map.values()) {
        summary.terms.sort((a, b) => a.termNumber - b.termNumber);
        summary.totalTerms = summary.terms.length;
        summary.currentTermNumber =
          summary.terms.length > 0
            ? summary.terms[summary.terms.length - 1].termNumber
            : 0;
      }

      return map;
    },
    enabled: !!month,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });
}

/**
 * 특정 학생의 전체 등록차수 이력 조회
 */
export function useStudentEnrollmentTerms(studentId?: string) {
  return useQuery<EnrollmentTerm[]>({
    queryKey: ['enrollment_terms', 'student', studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const q = query(
        collection(db, COL),
        where('studentId', '==', studentId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((d) => docToEnrollmentTerm(d.id, d.data()))
        .sort((a, b) => {
          // month DESC, termNumber DESC
          const monthCmp = b.month.localeCompare(a.month);
          if (monthCmp !== 0) return monthCmp;
          return b.termNumber - a.termNumber;
        });
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

/**
 * 등록차수 생성
 */
export function useCreateEnrollmentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<EnrollmentTerm, 'id' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();

      // 중복 방지: 동일 billingRecordId 체크
      if (data.billingRecordId) {
        const existingQuery = query(
          collection(db, COL),
          where('billingRecordId', '==', data.billingRecordId),
          where('status', '==', 'active')
        );
        const existing = await getDocs(existingQuery);
        if (!existing.empty) {
          throw new Error('이미 해당 수납 레코드에 대한 등록차수가 존재합니다.');
        }
      }

      const docRef = await addDoc(collection(db, COL), {
        ...data,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment_terms'] });
    },
    onError: (error: Error) => {
      console.error('[useCreateEnrollmentTerm] mutation error:', error);
    },
  });
}

/**
 * 등록차수 수정
 */
export function useUpdateEnrollmentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<EnrollmentTerm>;
    }) => {
      const docRef = doc(db, COL, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment_terms'] });
    },
    onError: (error: Error) => {
      console.error('[useUpdateEnrollmentTerm] mutation error:', error);
    },
  });
}

/**
 * 등록차수 취소 (soft delete)
 */
export function useCancelEnrollmentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, COL, id);
      await updateDoc(docRef, {
        status: 'cancelled' as EnrollmentTermStatus,
        updatedAt: new Date().toISOString(),
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment_terms'] });
    },
    onError: (error: Error) => {
      console.error('[useCancelEnrollmentTerm] mutation error:', error);
    },
  });
}

/**
 * 수납 완료 시 자동 등록차수 생성
 */
export async function createEnrollmentTermFromBilling(params: {
  studentId: string;
  studentName: string;
  month: string;
  billedAmount: number;
  unitPrice: number;
  salarySettingId?: string;
  salarySettingName?: string;
  billingRecordId: string;
  billingName?: string;
}): Promise<string> {
  const now = new Date().toISOString();

  // 중복 방지
  const existingQuery = query(
    collection(db, COL),
    where('billingRecordId', '==', params.billingRecordId),
    where('status', '==', 'active')
  );
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    return existing.docs[0].id;
  }

  // 기존 차수 번호 조회
  const termsQuery = query(
    collection(db, COL),
    where('studentId', '==', params.studentId),
    where('month', '==', params.month),
    where('status', '==', 'active')
  );
  const termsSnapshot = await getDocs(termsQuery);
  const maxTermNumber = termsSnapshot.docs.reduce((max, d) => {
    const num = d.data().termNumber || 0;
    return num > max ? num : max;
  }, 0);

  const docRef = await addDoc(collection(db, COL), {
    studentId: params.studentId,
    studentName: params.studentName,
    month: params.month,
    termNumber: maxTermNumber + 1,
    billedAmount: params.billedAmount,
    unitPrice: params.unitPrice,
    salarySettingId: params.salarySettingId || null,
    salarySettingName: params.salarySettingName || null,
    billingRecordId: params.billingRecordId,
    billingName: params.billingName || null,
    source: 'auto' as EnrollmentTermSource,
    status: 'active' as EnrollmentTermStatus,
    createdAt: now,
    updatedAt: now,
  });

  return docRef.id;
}
