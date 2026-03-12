import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TuitionExtraItem } from '../types/tuition';
import { TUITION_SERVICE_EXTRAS } from '../constants/tuitionExtras';

const COLLECTION = 'tuition_extras';
const QUERY_KEY = 'tuitionExtras';

export const useTuitionExtras = () => {
  const queryClient = useQueryClient();

  const { data: extras = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const snap = await getDocs(collection(db, COLLECTION));
      if (snap.empty) return [];
      return snap.docs.map(d => ({ ...d.data(), id: d.id }) as TuitionExtraItem);
    },
    staleTime: 5 * 60 * 1000,
  });

  const effectiveExtras = extras.length > 0 ? extras : TUITION_SERVICE_EXTRAS;

  const updateMutation = useMutation({
    mutationFn: async (item: TuitionExtraItem) => {
      await setDoc(doc(db, COLLECTION, item.id), {
        category: item.category,
        name: item.name,
        defaultPrice: item.defaultPrice,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });

  const addMutation = useMutation({
    mutationFn: async (item: TuitionExtraItem) => {
      await setDoc(doc(db, COLLECTION, item.id), {
        category: item.category,
        name: item.name,
        defaultPrice: item.defaultPrice,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COLLECTION, id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const batch = writeBatch(db);
      for (const item of TUITION_SERVICE_EXTRAS) {
        batch.set(doc(db, COLLECTION, item.id), {
          category: item.category,
          name: item.name,
          defaultPrice: item.defaultPrice,
        });
      }
      await batch.commit();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });

  return {
    extras: effectiveExtras,
    isLoading,
    isEmpty: extras.length === 0,
    updateExtra: updateMutation.mutateAsync,
    addExtra: addMutation.mutateAsync,
    deleteExtra: deleteMutation.mutateAsync,
    seedExtras: seedMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isSeeding: seedMutation.isPending,
  };
};
