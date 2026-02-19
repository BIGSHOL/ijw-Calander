import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';
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

export interface TextbookBilling {
  id: string;
  studentId: string;
  studentName: string;
  grade: string;
  school: string;
  textbookName: string;
  amount: number;
  month: string;
  matched: boolean;
  importedAt: string;
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

  // 교재 수납 내역 (xlsx import)
  const { data: billings, isLoading: billingsLoading } = useQuery({
    queryKey: ['textbookBillings'],
    queryFn: async () => {
      const q = query(collection(db, 'textbook_billings'), orderBy('month', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TextbookBilling));
    },
    staleTime: 5 * 60 * 1000,
  });

  const importBillings = useMutation({
    mutationFn: async (rows: Omit<TextbookBilling, 'id' | 'importedAt'>[]) => {
      const now = new Date().toISOString();
      const existing = billings ?? [];
      let added = 0;
      let skipped = 0;

      // 중복 체크 키: studentId + textbookName + month
      const existingKeys = new Set(
        existing.map(b => `${b.studentId}_${b.textbookName}_${b.month}`)
      );

      const toAdd = rows.filter(r => {
        const key = `${r.studentId}_${r.textbookName}_${r.month}`;
        if (existingKeys.has(key)) { skipped++; return false; }
        existingKeys.add(key);
        return true;
      });

      // writeBatch (최대 500개씩)
      for (let i = 0; i < toAdd.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = toAdd.slice(i, i + 500);
        for (const row of chunk) {
          const ref = doc(collection(db, 'textbook_billings'));
          batch.set(ref, { ...row, importedAt: now });
          added++;
        }
        await batch.commit();
      }

      return { added, skipped };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textbookBillings'] }),
  });

  return {
    textbooks: textbooks ?? [],
    distributions: distributions ?? [],
    billings: billings ?? [],
    isLoading: tbLoading,
    billingsLoading,
    createTextbook,
    updateTextbook,
    deleteTextbook,
    importBillings,
  };
}
