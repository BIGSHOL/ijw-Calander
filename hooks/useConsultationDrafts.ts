import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    collection,
    updateDoc,
    deleteDoc,
    addDoc,
    doc,
    query,
    where,
    orderBy,
    onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ConsultationDraft } from '../types/consultationDraft';
import { ConsultationRecord } from '../types';

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
 * 등록상담을 상담대기 목록으로 되돌리기.
 * - consultation_drafts 컬렉션에 신규 draft 생성 (status='pending')
 * - 원본 consultation 레코드 삭제 호출은 mutation 사용처에서 수행
 * - 연결된 학생 doc 은 건드리지 않음 (안전)
 */
export const useReturnConsultationToDraft = () => {
    return useMutation({
        mutationFn: async (record: ConsultationRecord) => {
            const draftData: Omit<ConsultationDraft, 'id'> = {
                tokenId: 'returned-from-consultation',
                status: 'pending',
                studentName: record.studentName,
                gender: (record.gender as any) || undefined,
                bloodType: record.bloodType || '',
                studentPhone: record.studentPhone || '',
                careerGoal: record.careerGoal || '',
                schoolName: record.schoolName,
                grade: String(record.grade || ''),
                subjects: record.subject ? [String(record.subject)] : [],
                siblings: record.siblings || '',
                parentName: record.parentName || '',
                parentRelation: record.parentRelation || '모',
                parentPhone: record.parentPhone || '',
                consultationPath: record.consultationPath || '',
                address: record.address || '',
                shuttleBusRequest: record.shuttleBusRequest ?? false,
                privacyAgreement: record.privacyAgreement ?? false,
                installmentAgreement: record.installmentAgreement ?? false,
                submittedAt: new Date().toISOString(),
                // 본문(메모/과목 detail/레벨테스트/후속 등) 원본 그대로 보존
                // JSON 라운드트립으로 nested undefined 제거 (Firestore 거부 방지)
                consultationSnapshot: JSON.parse(JSON.stringify(record)),
            };
            // 최상위 undefined 필드 제거 (Firestore 거부 방지)
            const cleaned = Object.fromEntries(
                Object.entries(draftData).filter(([, v]) => v !== undefined)
            );
            const ref = await addDoc(collection(db, COLLECTION_NAME), cleaned);
            return ref.id;
        },
        onError: (error: Error) => {
            console.error('[useReturnConsultationToDraft] mutation error:', error);
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
