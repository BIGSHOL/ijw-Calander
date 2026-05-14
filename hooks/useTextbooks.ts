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
      let added = 0;
      let updated = 0;

      // Firestore에서 직접 조회하여 중복 체크 (캐시 의존 제거)
      const existingSnap = await getDocs(
        query(collection(db, 'textbook_billings'))
      );
      const existingMap = new Map<string, string>();
      existingSnap.docs.forEach(d => {
        const data = d.data();
        const key = `${data.studentId}_${data.textbookName}_${data.month}`;
        existingMap.set(key, d.id);
      });

      // 신규 / 업데이트 분류
      const toAdd: Omit<TextbookBilling, 'id' | 'importedAt'>[] = [];
      const toUpdate: { docId: string; row: Omit<TextbookBilling, 'id' | 'importedAt'> }[] = [];
      const seenKeys = new Set<string>();
      for (const r of rows) {
        const key = `${r.studentId}_${r.textbookName}_${r.month}`;
        if (seenKeys.has(key)) continue; // 같은 배치 내 중복 방지
        seenKeys.add(key);
        const existingDocId = existingMap.get(key);
        if (existingDocId) {
          toUpdate.push({ docId: existingDocId, row: r });
        } else {
          toAdd.push(r);
        }
      }

      // writeBatch (최대 450개씩 - 추가 + 업데이트 혼합)
      let opCount = 0;
      let batch = writeBatch(db);

      for (const row of toAdd) {
        const ref = doc(collection(db, 'textbook_billings'));
        batch.set(ref, { ...row, importedAt: now });
        added++;
        opCount++;
        if (opCount % 450 === 0) { await batch.commit(); batch = writeBatch(db); }
      }

      for (const { docId, row } of toUpdate) {
        const ref = doc(db, 'textbook_billings', docId);
        batch.update(ref, { ...row, importedAt: now });
        updated++;
        opCount++;
        if (opCount % 450 === 0) { await batch.commit(); batch = writeBatch(db); }
      }

      if (opCount % 450 !== 0) {
        await batch.commit();
      }

      return { added, updated };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['textbookBillings'] });
    },
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
