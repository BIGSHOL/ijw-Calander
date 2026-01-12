import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { StaffMember } from '../types';

export const COL_STAFF = 'staff';

/**
 * 직원 목록 조회 및 CRUD Hook
 * - React Query 기반
 * - 5분 캐싱
 */
export function useStaff() {
  const queryClient = useQueryClient();

  // Fetch staff list
  const {
    data: staff = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const q = query(collection(db, COL_STAFF), orderBy('name'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as StaffMember));
    },
    staleTime: 1000 * 60 * 5, // 5분 캐싱
    gcTime: 1000 * 60 * 15, // 15분 GC
    refetchOnWindowFocus: false,
  });

  const error = queryError ? (queryError as Error).message : null;

  // Get single staff member
  const getStaff = useCallback(async (id: string) => {
    try {
      const docRef = doc(db, COL_STAFF, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as StaffMember;
      }
      return null;
    } catch (err) {
      console.error('Error getting staff:', err);
      throw err;
    }
  }, []);

  // Add staff mutation
  const addStaffMutation = useMutation({
    mutationFn: async (
      staffData: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, COL_STAFF), {
        ...staffData,
        createdAt: now,
        updatedAt: now,
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  // Update staff mutation
  const updateStaffMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<StaffMember>;
    }) => {
      const docRef = doc(db, COL_STAFF, id);
      const now = new Date().toISOString();
      await updateDoc(docRef, {
        ...updates,
        updatedAt: now,
      });
      return { id, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  // Delete staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, COL_STAFF, id);
      await deleteDoc(docRef);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  // Wrapper functions for API compatibility
  const addStaff = useCallback(
    async (staffData: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>) => {
      return addStaffMutation.mutateAsync(staffData);
    },
    [addStaffMutation]
  );

  const updateStaff = useCallback(
    async (id: string, updates: Partial<StaffMember>) => {
      await updateStaffMutation.mutateAsync({ id, updates });
    },
    [updateStaffMutation]
  );

  const deleteStaff = useCallback(
    async (id: string) => {
      await deleteStaffMutation.mutateAsync(id);
    },
    [deleteStaffMutation]
  );

  const refreshStaff = useCallback(() => {
    return refetch();
  }, [refetch]);

  return {
    staff,
    loading,
    error,
    getStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    refreshStaff,
    // Mutation states
    isAdding: addStaffMutation.isPending,
    isUpdating: updateStaffMutation.isPending,
    isDeleting: deleteStaffMutation.isPending,
  };
}

export default useStaff;
