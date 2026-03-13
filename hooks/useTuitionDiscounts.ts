import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TuitionDiscountItem } from '../types/tuition';
import { TUITION_DISCOUNTS } from '../constants/tuitionExtras';

const COLLECTION = 'tuition_discounts';
const QUERY_KEY = 'tuitionDiscounts';

export const useTuitionDiscounts = () => {
  const queryClient = useQueryClient();

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const snap = await getDocs(collection(db, COLLECTION));
      if (snap.empty) return [];
      return snap.docs.map(d => ({ ...d.data(), id: d.id }) as TuitionDiscountItem);
    },
    staleTime: 5 * 60 * 1000,
  });

  const effectiveDiscounts = discounts.length > 0 ? discounts : TUITION_DISCOUNTS;

  const updateMutation = useMutation({
    mutationFn: async (item: TuitionDiscountItem) => {
      await setDoc(doc(db, COLLECTION, item.id), {
        name: item.name,
        amount: item.amount,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionDiscounts]', error),
  });

  const addMutation = useMutation({
    mutationFn: async (item: TuitionDiscountItem) => {
      await setDoc(doc(db, COLLECTION, item.id), {
        name: item.name,
        amount: item.amount,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionDiscounts]', error),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COLLECTION, id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionDiscounts]', error),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const batch = writeBatch(db);
      for (const item of TUITION_DISCOUNTS) {
        batch.set(doc(db, COLLECTION, item.id), {
          name: item.name,
          amount: item.amount,
        });
      }
      await batch.commit();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionDiscounts]', error),
  });

  return {
    discounts: effectiveDiscounts,
    isLoading,
    isEmpty: discounts.length === 0,
    updateDiscount: updateMutation.mutateAsync,
    addDiscount: addMutation.mutateAsync,
    deleteDiscount: deleteMutation.mutateAsync,
    seedDiscounts: seedMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isSeeding: seedMutation.isPending,
  };
};
