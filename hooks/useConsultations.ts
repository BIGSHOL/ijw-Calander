import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    where,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ConsultationRecord } from '../types';

/**
 * 상담 기록 Firestore Hook
 * Phase 13: EduCRM Integration
 */

// ============ QUERY HOOKS ============

interface UseConsultationsOptions {
    userId?: string;
    month?: string; // 'all' | '1' | '2' | ... | '12'
    year?: number;
}

/**
 * 상담 기록 목록 조회
 */
export const useConsultations = (options: UseConsultationsOptions = {}) => {
    const { month, year } = options;

    return useQuery<ConsultationRecord[]>({
        queryKey: ['consultations', month, year],
        queryFn: async () => {
            const consultationsRef = collection(db, 'consultations');
            const q = query(consultationsRef, orderBy('consultationDate', 'desc'));
            const snapshot = await getDocs(q);

            const records = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as ConsultationRecord[];

            // 연도가 undefined면 전체 데이터 반환 (연도 전체 선택)
            if (year === undefined) {
                return records;
            }

            // 월이 'all'이면 해당 연도의 전체 데이터 반환
            if (month === 'all') {
                return records.filter(r => {
                    const date = new Date(r.consultationDate);
                    return date.getFullYear() === year;
                });
            }

            // 특정 월 필터링
            const monthNum = parseInt(month || '1', 10);
            return records.filter(r => {
                const date = new Date(r.consultationDate);
                return date.getMonth() + 1 === monthNum && date.getFullYear() === year;
            });
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

// ============ MUTATION HOOKS ============

/**
 * 상담 기록 생성
 */
export const useCreateConsultation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (record: Omit<ConsultationRecord, 'id'>) => {
            const consultationsRef = collection(db, 'consultations');
            const docRef = await addDoc(consultationsRef, {
                ...record,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            return { id: docRef.id, ...record };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consultations'] });
        },
    });
};

/**
 * 상담 기록 수정
 */
export const useUpdateConsultation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<ConsultationRecord> }) => {
            const docRef = doc(db, 'consultations', id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: new Date().toISOString(),
            });
            return { id, ...updates };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consultations'] });
        },
    });
};

/**
 * 상담 기록 삭제
 */
export const useDeleteConsultation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const docRef = doc(db, 'consultations', id);
            await deleteDoc(docRef);
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consultations'] });
        },
    });
};

// ============ HELPER FUNCTIONS ============

/**
 * 등록 상태 여부 확인
 */
export const isRegisteredStatus = (status: string): boolean => {
    return ['영수등록', '수학등록', '영어등록'].includes(status);
};

/**
 * 등록 예정 상태 여부 확인
 */
export const isPendingStatus = (status: string): boolean => {
    return ['이번달 등록예정', '추후 등록예정'].includes(status);
};
