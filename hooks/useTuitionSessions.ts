import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TuitionSessionPeriod } from '../types/tuition';

// 출석부와 동일한 컬렉션 사용 (동기화)
const COLLECTION = 'session_periods';
const QUERY_KEY = 'sessionPeriods';

export const useTuitionSessions = () => {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const snap = await getDocs(collection(db, COLLECTION));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as TuitionSessionPeriod);
    },
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (session: TuitionSessionPeriod) => {
      await setDoc(doc(db, COLLECTION, session.id), {
        year: session.year,
        category: session.category,
        month: session.month,
        ranges: session.ranges,
        sessions: session.sessions,
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

  return {
    sessions,
    isLoading,
    saveSession: saveMutation.mutateAsync,
    deleteSession: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
};
