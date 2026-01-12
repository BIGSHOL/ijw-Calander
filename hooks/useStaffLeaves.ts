import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { StaffLeave } from '../types';
import { DocumentData } from 'firebase/firestore';

export const COL_STAFF_LEAVES = 'staff_leaves';

/**
 * 직원 휴가 관리 Hook
 * - React Query 기반
 * - 휴가 신청, 승인, 반려 기능
 */
export function useStaffLeaves(staffId?: string) {
  const queryClient = useQueryClient();
  const user = auth.currentUser;

  // Fetch leaves
  const {
    data: leaves = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery<StaffLeave[]>({
    queryKey: ['staff_leaves', staffId],
    queryFn: async () => {
      let q;
      if (staffId) {
        q = query(
          collection(db, COL_STAFF_LEAVES),
          where('staffId', '==', staffId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, COL_STAFF_LEAVES),
          orderBy('createdAt', 'desc')
        );
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as DocumentData;
        return {
          id: docSnap.id,
          staffId: data.staffId || '',
          staffName: data.staffName || '',
          type: data.type || 'other',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          reason: data.reason,
          status: data.status || 'pending',
          approvedBy: data.approvedBy,
          approvedAt: data.approvedAt,
          createdAt: data.createdAt || '',
        } as StaffLeave;
      });
    },
    staleTime: 1000 * 60 * 5, // 5분 캐싱
    gcTime: 1000 * 60 * 15, // 15분 GC
    refetchOnWindowFocus: false,
  });

  const error = queryError ? (queryError as Error).message : null;

  // Pending count
  const pendingCount = useMemo(
    () => leaves.filter((l) => l.status === 'pending').length,
    [leaves]
  );

  // Add leave mutation
  const addLeaveMutation = useMutation({
    mutationFn: async (
      leaveData: Omit<StaffLeave, 'id' | 'createdAt'>
    ) => {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, COL_STAFF_LEAVES), {
        ...leaveData,
        createdAt: now,
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_leaves'] });
    },
  });

  // Approve leave mutation
  const approveLeaveMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const docRef = doc(db, COL_STAFF_LEAVES, leaveId);
      const now = new Date().toISOString();
      await updateDoc(docRef, {
        status: 'approved',
        approvedBy: user?.displayName || user?.email || 'Unknown',
        approvedAt: now,
      });
      return leaveId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_leaves'] });
    },
  });

  // Reject leave mutation
  const rejectLeaveMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const docRef = doc(db, COL_STAFF_LEAVES, leaveId);
      const now = new Date().toISOString();
      await updateDoc(docRef, {
        status: 'rejected',
        approvedBy: user?.displayName || user?.email || 'Unknown',
        approvedAt: now,
      });
      return leaveId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_leaves'] });
    },
  });

  // Delete leave mutation
  const deleteLeaveMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const docRef = doc(db, COL_STAFF_LEAVES, leaveId);
      await deleteDoc(docRef);
      return leaveId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_leaves'] });
    },
  });

  // Wrapper functions
  const addLeave = useCallback(
    async (leaveData: Omit<StaffLeave, 'id' | 'createdAt'>) => {
      return addLeaveMutation.mutateAsync(leaveData);
    },
    [addLeaveMutation]
  );

  const approveLeave = useCallback(
    async (leaveId: string) => {
      return approveLeaveMutation.mutateAsync(leaveId);
    },
    [approveLeaveMutation]
  );

  const rejectLeave = useCallback(
    async (leaveId: string) => {
      return rejectLeaveMutation.mutateAsync(leaveId);
    },
    [rejectLeaveMutation]
  );

  const deleteLeave = useCallback(
    async (leaveId: string) => {
      return deleteLeaveMutation.mutateAsync(leaveId);
    },
    [deleteLeaveMutation]
  );

  const refreshLeaves = useCallback(() => {
    return refetch();
  }, [refetch]);

  return {
    leaves,
    loading,
    error,
    pendingCount,
    addLeave,
    approveLeave,
    rejectLeave,
    deleteLeave,
    refreshLeaves,
    // Mutation states
    isAdding: addLeaveMutation.isPending,
    isApproving: approveLeaveMutation.isPending,
    isRejecting: rejectLeaveMutation.isPending,
    isDeleting: deleteLeaveMutation.isPending,
  };
}

export default useStaffLeaves;
