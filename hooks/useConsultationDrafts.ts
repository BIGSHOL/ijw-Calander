import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    collection,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ConsultationDraft } from '../types/consultationDraft';

const COLLECTION_NAME = 'consultation_drafts';

/**
 * 상담 접수 draft 실시간 구독 (직원용)
 */
export const useConsultationDrafts = () => {
    const [drafts, setDrafts] = useState<ConsultationDraft[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const ref = collection(db, COLLECTION_NAME);
        const q = query(ref, orderBy('submittedAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
            })) as ConsultationDraft[];
            setDrafts(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { data: drafts, isLoading };
};

/**
 * pending 상태 draft 개수 (실시간)
 */
export const usePendingDraftCount = () => {
    const [count, setCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const ref = collection(db, COLLECTION_NAME);
        const q = query(ref, where('status', '==', 'pending'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCount(snapshot.size);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { data: count, isLoading };
};

/**
 * draft 상태를 'converted'로 변경하고 consultation ID 연결
 */
export const useConvertDraft = () => {
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
        onError: (error: Error) => {
            console.error('[useConvertDraft] mutation error:', error);
        },
    });
};

/**
 * draft 삭제
 */
export const useDeleteDraft = () => {
    return useMutation({
        mutationFn: async (draftId: string) => {
            await deleteDoc(doc(db, COLLECTION_NAME, draftId));
        },
        onError: (error: Error) => {
            console.error('[useDeleteDraft] mutation error:', error);
        },
    });
};
