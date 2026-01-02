import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GanttProject } from '../types';

// 내 프로젝트 목록 조회
export const useGanttProjects = (userId?: string) => {
  return useQuery({
    queryKey: ['ganttProjects', userId],
    queryFn: async () => {
      if (!userId) return [];

      const q = query(
        collection(db, 'gantt_projects'),
        where('ownerId', '==', userId),
        orderBy('lastUpdated', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startedAt: doc.data().startedAt?.toMillis() || Date.now(),
        lastUpdated: doc.data().lastUpdated?.toMillis() || Date.now()
      } as GanttProject));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2분
    gcTime: 1000 * 60 * 10, // 10분
  });
};

// 프로젝트 생성 (템플릿에서 시작)
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (project: Omit<GanttProject, 'id' | 'startedAt' | 'lastUpdated'>) => {
      const docRef = await addDoc(collection(db, 'gantt_projects'), {
        ...project,
        startedAt: Timestamp.now(),
        lastUpdated: Timestamp.now(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttProjects'] });
    },
  });
};

// 프로젝트 업데이트 (작업 완료 토글 등)
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GanttProject> }) => {
      const docRef = doc(db, 'gantt_projects', id);
      const { id: _, startedAt, lastUpdated, ...updateData } = updates as any;
      await updateDoc(docRef, {
        ...updateData,
        lastUpdated: Timestamp.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttProjects'] });
    },
  });
};

// 프로젝트 삭제
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      await deleteDoc(doc(db, 'gantt_projects', projectId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttProjects'] });
    },
  });
};
