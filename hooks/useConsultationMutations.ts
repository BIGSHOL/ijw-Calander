import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Consultation } from '../types';
import { COL_STUDENT_CONSULTATIONS } from './useStudentConsultations';

/**
 * 상담 기록 생성 Mutation
 */
export function useCreateConsultation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (consultationData: Omit<Consultation, 'id' | 'createdAt' | 'updatedAt'>) => {
            const now = Date.now();
            const docRef = await addDoc(collection(db, COL_STUDENT_CONSULTATIONS), {
                ...consultationData,
                createdAt: now,
                updatedAt: now,
            });
            return docRef.id;
        },
        onSuccess: async () => {
            // 캐시 무효화 완료까지 대기하여 확실한 동기화 보장
            await queryClient.invalidateQueries({
                queryKey: ['student_consultations'],
            });
        },
        onError: (error) => {
            console.error('상담 기록 생성 실패:', error);
        },
    });
}

/**
 * 상담 기록 수정 Mutation
 */
export function useUpdateConsultation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Consultation> }) => {
            const docRef = doc(db, COL_STUDENT_CONSULTATIONS, id);
            const now = Date.now();
            await updateDoc(docRef, {
                ...updates,
                updatedAt: now,
            });
            return { id, updates };
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ['student_consultations'],
            });
        },
        onError: (error) => {
            console.error('상담 기록 수정 실패:', error);
        },
    });
}

/**
 * 상담 기록 삭제 Mutation
 */
export function useDeleteConsultation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const docRef = doc(db, COL_STUDENT_CONSULTATIONS, id);
            await deleteDoc(docRef);
            return id;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ['student_consultations'],
            });
        },
        onError: (error) => {
            console.error('상담 기록 삭제 실패:', error);
        },
    });
}

/**
 * 후속 조치 완료 처리 Mutation
 */
export function useCompleteFollowUp() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
            const docRef = doc(db, COL_STUDENT_CONSULTATIONS, id);
            const now = Date.now();
            await updateDoc(docRef, {
                followUpDone: true,
                followUpNotes: notes || '',
                updatedAt: now,
            });
            return { id, notes };
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ['student_consultations'],
            });
        },
        onError: (error) => {
            console.error('후속 조치 완료 처리 실패:', error);
        },
    });
}
