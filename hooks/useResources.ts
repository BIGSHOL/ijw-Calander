/**
 * useResources Hook
 * 자료실 리소스 관리 (Firestore CRUD)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Resource } from '../types';

const COL_RESOURCES = 'resources';

/**
 * 리소스 전체 조회
 */
export function useResources() {
  return useQuery<Resource[]>({
    queryKey: ['resources'],
    queryFn: async () => {
      // 복합 인덱스 없이 전체 조회 후 클라이언트에서 정렬
      const snapshot = await getDocs(collection(db, COL_RESOURCES));
      const resources = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Resource));

      // 클라이언트 정렬: 고정 → 순서 → 생성일
      return resources.sort((a, b) => {
        // 1. isPinned (true 먼저)
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        // 2. order (오름차순)
        if (a.order !== b.order) return a.order - b.order;
        // 3. createdAt (최신순)
        return b.createdAt.localeCompare(a.createdAt);
      });
    },
    staleTime: 1000 * 60 * 10, // 10분 캐싱
    gcTime: 1000 * 60 * 30,    // 30분 GC
    refetchOnWindowFocus: false,
  });
}

/**
 * 리소스 생성
 */
export function useCreateResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, COL_RESOURCES), {
        ...data,
        createdAt: now,
        updatedAt: now,
      });
      return { id: docRef.id, ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

/**
 * 리소스 수정
 */
export function useUpdateResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Resource> }) => {
      const docRef = doc(db, COL_RESOURCES, id);
      const cleanUpdates = Object.entries({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
        .filter(([_, value]) => value !== undefined)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      await updateDoc(docRef, cleanUpdates);
      return { id, ...updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

/**
 * 리소스 삭제
 */
export function useDeleteResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, COL_RESOURCES, id);
      await deleteDoc(docRef);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

/**
 * 카테고리별 리소스 조회
 */
export function useResourcesByCategory(category?: string) {
  return useQuery<Resource[]>({
    queryKey: ['resources', 'category', category],
    queryFn: async () => {
      // 복합 인덱스 없이 전체 조회 후 클라이언트에서 필터링/정렬
      const snapshot = await getDocs(collection(db, COL_RESOURCES));
      let resources = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Resource));

      // 카테고리 필터링
      if (category && category !== 'all') {
        resources = resources.filter(r => r.category === category);
      }

      // 클라이언트 정렬: 고정 → 순서
      return resources.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        return a.order - b.order;
      });
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    enabled: category !== undefined,
  });
}
