import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  TuitionSavedInvoice, TuitionStudentInfo, TuitionSelectedCourse,
  TuitionSelectedExtra, TuitionSelectedDiscount,
} from '../types/tuition';

const COLLECTION = 'tuition_invoices';

const generateInvoiceId = (info: TuitionStudentInfo): string => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}_${info.name.trim()}_${info.school}${info.grade}`.trim();
};

export const useTuitionInvoices = (limitCount = 100) => {
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tuitionInvoices'],
    queryFn: async () => {
      const q = query(
        collection(db, COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as TuitionSavedInvoice);
    },
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (params: {
      studentInfo: TuitionStudentInfo;
      courses: TuitionSelectedCourse[];
      extras: TuitionSelectedExtra[];
      discounts: TuitionSelectedDiscount[];
      totalAmount: number;
    }) => {
      const now = new Date().toISOString();
      const docId = generateInvoiceId(params.studentInfo);
      await setDoc(doc(db, COLLECTION, docId), {
        studentInfo: params.studentInfo,
        courses: params.courses,
        extras: params.extras,
        discounts: params.discounts,
        totalAmount: params.totalAmount,
        createdAt: now,
        updatedAt: now,
      });
      return docId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tuitionInvoices'] }),
  });

  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      studentInfo: TuitionStudentInfo;
      courses: TuitionSelectedCourse[];
      extras: TuitionSelectedExtra[];
      discounts: TuitionSelectedDiscount[];
      totalAmount: number;
    }) => {
      await updateDoc(doc(db, COLLECTION, params.id), {
        studentInfo: params.studentInfo,
        courses: params.courses,
        extras: params.extras,
        discounts: params.discounts,
        totalAmount: params.totalAmount,
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tuitionInvoices'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COLLECTION, id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tuitionInvoices'] }),
  });

  const searchByName = (name: string) => {
    return invoices.filter(inv => inv.studentInfo.name.includes(name));
  };

  return {
    invoices,
    isLoading,
    error,
    refetch,
    saveInvoice: saveMutation.mutateAsync,
    updateInvoice: updateMutation.mutateAsync,
    deleteInvoice: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending || updateMutation.isPending,
    searchByName,
  };
};
