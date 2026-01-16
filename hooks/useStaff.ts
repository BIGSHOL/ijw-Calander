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
  writeBatch,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { StaffMember } from '../types';

export const COL_STAFF = 'staff';

/**
 * 직원 이름 변경 시 관련 데이터 자동 업데이트 (Cascade Update)
 * - unifiedClasses: teacher, assistants 필드 업데이트
 * - timetableClasses (math/english): teacher 필드 업데이트
 */
async function cascadeNameUpdate(
  oldName: string,
  oldEnglishName: string | undefined,
  newName: string,
  newEnglishName: string | undefined
): Promise<void> {
  const batch = writeBatch(db);
  let updateCount = 0;

  try {
    // 1. unifiedClasses 컬렉션 업데이트
    const unifiedClassesRef = collection(db, 'unifiedClasses');
    const unifiedSnapshot = await getDocs(unifiedClassesRef);

    unifiedSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let needsUpdate = false;
      const updates: any = {};

      // teacher 필드 확인 (name 또는 englishName 매칭)
      if (data.teacher === oldName || data.teacher === oldEnglishName) {
        updates.teacher = newName;
        needsUpdate = true;
      }

      // assistants 배열 확인
      if (data.assistants && Array.isArray(data.assistants)) {
        const updatedAssistants = data.assistants.map((assistant: string) => {
          if (assistant === oldName || assistant === oldEnglishName) {
            return newName;
          }
          return assistant;
        });

        if (JSON.stringify(updatedAssistants) !== JSON.stringify(data.assistants)) {
          updates.assistants = updatedAssistants;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        batch.update(docSnap.ref, { ...updates, updatedAt: new Date().toISOString() });
        updateCount++;
      }
    });

    // 2. math 시간표 클래스 업데이트
    const mathClassesRef = collection(db, 'math', 'timetable', 'classes');
    const mathSnapshot = await getDocs(mathClassesRef);

    mathSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.teacher === oldName || data.teacher === oldEnglishName) {
        batch.update(docSnap.ref, {
          teacher: newName,
          updatedAt: new Date().toISOString(),
        });
        updateCount++;
      }
    });

    // 3. english 시간표 클래스 업데이트
    const englishClassesRef = collection(db, 'english', 'timetable', 'classes');
    const englishSnapshot = await getDocs(englishClassesRef);

    englishSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.teacher === oldName || data.teacher === oldEnglishName) {
        batch.update(docSnap.ref, {
          teacher: newName,
          updatedAt: new Date().toISOString(),
        });
        updateCount++;
      }
    });

    // 배치 커밋
    if (updateCount > 0) {
      await batch.commit();
      console.log(`✅ 직원 이름 변경: ${oldName} → ${newName} (${updateCount}개 수업 자동 업데이트)`);
    }
  } catch (error) {
    console.error('❌ 직원 이름 변경 전파 실패:', error);
    throw error;
  }
}

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
      previousData,
    }: {
      id: string;
      updates: Partial<StaffMember>;
      previousData?: StaffMember;
    }) => {
      const docRef = doc(db, COL_STAFF, id);
      const now = new Date().toISOString();
      await updateDoc(docRef, {
        ...updates,
        updatedAt: now,
      });

      // 이름 변경 시 관련 데이터 자동 업데이트
      if (previousData && (updates.name || updates.englishName)) {
        const oldName = previousData.name;
        const oldEnglishName = previousData.englishName;
        const newName = updates.name || previousData.name;
        const newEnglishName = updates.englishName || previousData.englishName;

        await cascadeNameUpdate(oldName, oldEnglishName, newName, newEnglishName);
      }

      return { id, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['unifiedClasses'] });
      queryClient.invalidateQueries({ queryKey: ['timetableClasses'] });
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
    async (id: string, updates: Partial<StaffMember>, previousData?: StaffMember) => {
      await updateStaffMutation.mutateAsync({ id, updates, previousData });
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
