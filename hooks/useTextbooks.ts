import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Textbook {
  id: string;
  name: string;
  publisher: string;
  subject: 'math' | 'english' | 'science' | 'korean';
  grade?: string;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TextbookDistribution {
  id: string;
  textbookId: string;
  textbookName: string;
  studentId: string;
  studentName: string;
  classId?: string;
  className?: string;
  quantity: number;
  distributedAt: string;
  distributedBy: string;
  note?: string;
}

export function useTextbooks() {
  const queryClient = useQueryClient();

  const { data: textbooks, isLoading: tbLoading } = useQuery({
    queryKey: ['textbooks'],
    queryFn: async () => {
      const q = query(collection(db, 'textbooks'), orderBy('name'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Textbook));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: distributions } = useQuery({
    queryKey: ['textbookDistributions'],
    queryFn: async () => {
      const q = query(collection(db, 'textbook_distributions'), orderBy('distributedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TextbookDistribution));
    },
    staleTime: 5 * 60 * 1000,
  });

  const createTextbook = useMutation({
    mutationFn: async (data: Omit<Textbook, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'textbooks'), { ...data, createdAt: now, updatedAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textbooks'] }),
  });

  const updateTextbook = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Textbook> & { id: string }) => {
      await updateDoc(doc(db, 'textbooks', id), { ...data, updatedAt: new Date().toISOString() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textbooks'] }),
  });

  const deleteTextbook = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'textbooks', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textbooks'] }),
  });

  return { textbooks: textbooks ?? [], distributions: distributions ?? [], isLoading: tbLoading, createTextbook, updateTextbook, deleteTextbook };
}
