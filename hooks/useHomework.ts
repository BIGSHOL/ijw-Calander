import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Homework {
  id: string;
  title: string;
  description?: string;
  classId: string;
  className: string;
  subject: 'math' | 'english' | 'science' | 'korean';
  assignedBy: string;
  assignedByName: string;
  assignedDate: string;
  dueDate: string;
  targetStudentIds: string[];
  attachments: { name: string; url: string }[];
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export function useHomework() {
  const queryClient = useQueryClient();

  const { data: homeworkList, isLoading, error } = useQuery({
    queryKey: ['homework'],
    queryFn: async () => {
      const q = query(collection(db, 'homework'), orderBy('assignedDate', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Homework));
    },
    staleTime: 5 * 60 * 1000,
  });

  const createHomework = useMutation({
    mutationFn: async (data: Omit<Homework, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'homework'), { ...data, createdAt: now, updatedAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['homework'] }),
    onError: (error: Error) => { console.error('createHomework failed:', error); },
  });

  const updateHomework = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Homework> & { id: string }) => {
      await updateDoc(doc(db, 'homework', id), { ...data, updatedAt: new Date().toISOString() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['homework'] }),
    onError: (error: Error) => { console.error('updateHomework failed:', error); },
  });

  const deleteHomework = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'homework', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['homework'] }),
    onError: (error: Error) => { console.error('deleteHomework failed:', error); },
  });

  return { homeworkList: homeworkList ?? [], isLoading, error, createHomework, updateHomework, deleteHomework };
}
