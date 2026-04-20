/**
 * useStudentMemos — 학생별 공유 메모 React Query 훅 세트
 *
 * Firestore 경로: students/{studentId}/memos/{memoId}
 *
 * 실시간성: React Query 캐시 + refetchOnWindowFocus (Firebase onSnapshot 미사용 — 비용 ↓)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { MemoCategory, StudentMemo } from '../types/memo';

const COL_STUDENTS = 'students';

export const useStudentMemos = (studentId: string | undefined) => {
  return useQuery<StudentMemo[]>({
    queryKey: ['studentMemos', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      if (!studentId) return [];
      const q = query(
        collection(db, COL_STUDENTS, studentId, 'memos'),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as StudentMemo);
    },
    staleTime: 1000 * 30,     // 30초
    gcTime: 1000 * 60 * 5,    // 5분
    refetchOnWindowFocus: true,
  });
};

export interface CreateStudentMemoInput {
  studentId: string;
  content: string;
  category: MemoCategory;
  authorId: string;
  authorName: string;
  authorStaffId?: string;
  isPinned?: boolean;
}

export const useCreateStudentMemo = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateStudentMemoInput) => {
      const now = new Date().toISOString();
      const payload: Record<string, any> = {
        content: input.content,
        category: input.category,
        authorId: input.authorId,
        authorName: input.authorName,
        isPinned: !!input.isPinned,
        createdAt: now,
        updatedAt: now,
      };
      if (input.authorStaffId) payload.authorStaffId = input.authorStaffId;
      await addDoc(collection(db, COL_STUDENTS, input.studentId, 'memos'), payload);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['studentMemos', variables.studentId] });
    },
  });
};

export interface UpdateStudentMemoInput {
  studentId: string;
  memoId: string;
  content?: string;
  category?: MemoCategory;
  isPinned?: boolean;
}

export const useUpdateStudentMemo = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateStudentMemoInput) => {
      const payload: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (input.content !== undefined) payload.content = input.content;
      if (input.category !== undefined) payload.category = input.category;
      if (input.isPinned !== undefined) payload.isPinned = input.isPinned;
      await updateDoc(
        doc(db, COL_STUDENTS, input.studentId, 'memos', input.memoId),
        payload,
      );
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['studentMemos', variables.studentId] });
    },
  });
};

export const useDeleteStudentMemo = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { studentId: string; memoId: string }) => {
      await deleteDoc(doc(db, COL_STUDENTS, input.studentId, 'memos', input.memoId));
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['studentMemos', variables.studentId] });
    },
  });
};
