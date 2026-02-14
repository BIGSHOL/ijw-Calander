import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface ParentLink {
  id: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  relationship: 'mother' | 'father' | 'guardian' | 'other';
  studentIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useParentLinks() {
  const queryClient = useQueryClient();

  const { data: parentLinks, isLoading, error } = useQuery({
    queryKey: ['parentLinks'],
    queryFn: async () => {
      const q = query(collection(db, 'parent_links'), orderBy('parentName'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ParentLink));
    },
    staleTime: 5 * 60 * 1000,
  });

  const createLink = useMutation({
    mutationFn: async (data: Omit<ParentLink, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'parent_links'), { ...data, createdAt: now, updatedAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parentLinks'] }),
  });

  const updateLink = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ParentLink> & { id: string }) => {
      await updateDoc(doc(db, 'parent_links', id), { ...data, updatedAt: new Date().toISOString() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parentLinks'] }),
  });

  return { parentLinks: parentLinks ?? [], isLoading, error, createLink, updateLink };
}
