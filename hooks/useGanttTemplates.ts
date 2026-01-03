import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GanttTemplate } from '../types';

// 템플릿 목록 조회 (내 템플릿 + 공유된 템플릿)
export const useGanttTemplates = (userId?: string) => {
  return useQuery({
    queryKey: ['ganttTemplates', userId],
    queryFn: async () => {
      if (!userId) return [];

      // 모든 템플릿 조회 (createdAt 기준 내림차순)
      const q = query(
        collection(db, 'gantt_templates'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const templates = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toMillis() || Date.now()
      } as GanttTemplate));

      // 필터링: 내가 만든 것 또는 공유된 것만 반환
      return templates.filter(t =>
        t.createdBy === userId || t.isShared === true
      );
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5분
    gcTime: 1000 * 60 * 30, // 30분
  });
};

// 템플릿 생성
export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<GanttTemplate, 'id' | 'createdAt'>) => {
      // Remove 'id' from the data being saved to Firestore
      // (The template comes with a temporary ID from builder, but we want Firestore to generate one)
      const { id, ...dataToSave } = template as any;

      const docRef = await addDoc(collection(db, 'gantt_templates'), {
        ...dataToSave,
        createdAt: Timestamp.now(),
        isShared: template.isShared || false,
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttTemplates'] });
    },
  });
};

// 템플릿 수정
export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GanttTemplate> }) => {
      const docRef = doc(db, 'gantt_templates', id);
      const { id: _, createdAt, ...updateData } = updates as any;
      await updateDoc(docRef, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttTemplates'] });
    },
  });
};

// 템플릿 삭제
export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      await deleteDoc(doc(db, 'gantt_templates', templateId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttTemplates'] });
    },
  });
};
