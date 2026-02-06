import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ConsultationDraft } from '../types/consultationDraft';

const COLLECTION_NAME = 'consultation_drafts';

/**
 * 상담 접수 draft 조회 (직원용)
 * consultation_drafts 컬렉션에서 pending 상태 우선 조회
 */
export const useConsultationDrafts = () => {
    return useQuery<ConsultationDraft[]>({
        queryKey: ['consultation-drafts'],
        queryFn: async () => {
            const ref = collection(db, COLLECTION_NAME);
            const q = query(ref, orderBy('submittedAt', 'desc'));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
            })) as ConsultationDraft[];
        },
        staleTime: 30_000, // 30초
    });
};

/**
 * pending 상태 draft 개수
 */
export const usePendingDraftCount = () => {
    return useQuery<number>({
        queryKey: ['consultation-drafts', 'pending-count'],
        queryFn: async () => {
            const ref = collection(db, COLLECTION_NAME);
            const q = query(ref, where('status', '==', 'pending'));
            const snapshot = await getDocs(q);
            return snapshot.size;
        },
        staleTime: 30_000,
    });
};

/**
 * draft 상태를 'converted'로 변경하고 consultation ID 연결
 */
export const useConvertDraft = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ draftId, consultationId, reviewerUid }: {
            draftId: string;
            consultationId: string;
            reviewerUid: string;
        }) => {
            const draftRef = doc(db, COLLECTION_NAME, draftId);
            await updateDoc(draftRef, {
                status: 'converted',
                convertedToConsultationId: consultationId,
                reviewedAt: new Date().toISOString(),
                reviewedBy: reviewerUid,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consultation-drafts'] });
        },
    });
};

/**
 * draft 삭제
 */
export const useDeleteDraft = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (draftId: string) => {
            await deleteDoc(doc(db, COLLECTION_NAME, draftId));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consultation-drafts'] });
        },
    });
};
