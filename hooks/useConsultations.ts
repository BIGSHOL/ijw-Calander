import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    getDocs,
    setDoc,
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
import { format } from 'date-fns';

/**
 * 상담 기록 Firestore Hook
 * Phase 13: EduCRM Integration
 */

// ============ QUERY HOOKS ============

interface UseConsultationsOptions {
    userId?: string;
    month?: string; // 'all' | '1' | '2' | ... | '12'
    year?: number;
    studentId?: string; // 특정 학생의 상담 이력 조회
}

/**
 * 상담 기록 목록 조회
 */
export const useConsultations = (options: UseConsultationsOptions = {}) => {
    const { month, year, studentId } = options;

    return useQuery<ConsultationRecord[]>({
        queryKey: ['consultations', month, year, studentId],
        queryFn: async () => {
            const consultationsRef = collection(db, 'consultations');

            // 특정 학생 ID로 필터링
            let q;
            if (studentId) {
                q = query(
                    consultationsRef,
                    where('registeredStudentId', '==', studentId),
                    orderBy('consultationDate', 'desc')
                );
            } else {
                q = query(consultationsRef, orderBy('consultationDate', 'desc'));
            }

            const snapshot = await getDocs(q);

            const records = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Record<string, any>),
            })) as ConsultationRecord[];

            // Helper to get valid date object
            const getDate = (r: ConsultationRecord) => {
                const dStr = r.consultationDate || r.createdAt || '';
                if (!dStr) return null;
                const d = new Date(dStr);
                return isNaN(d.getTime()) ? null : d;
            };

            // 연도가 undefined면 전체 데이터 반환 (연도 전체 선택)
            if (year === undefined) {
                return records;
            }

            // 월이 'all'이면 해당 연도의 전체 데이터 반환
            if (month === 'all') {
                return records.filter(r => {
                    const date = getDate(r);
                    if (!date) return false;
                    return date.getFullYear() === year;
                });
            }

            // 특정 월 필터링
            const monthNum = parseInt(month || '1', 10);
            return records.filter(r => {
                const date = getDate(r);
                if (!date) return false;
                return date.getMonth() + 1 === monthNum && date.getFullYear() === year;
            });
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

// ============ MUTATION HOOKS ============

/**
 * 문서 ID 생성: yy.mm.dd_학생명_학교학년
 */
const generateDocId = (record: Omit<ConsultationRecord, 'id'>): string => {
    const date = new Date(record.consultationDate);
    const dateStr = format(date, 'yyMMdd');
    // 특수문자 제거하고 공백을 언더스코어로 변환
    const studentName = record.studentName.replace(/[/\\.#$[\]]/g, '').trim();
    const school = record.schoolName.replace(/[/\\.#$[\]]/g, '').trim();
    const grade = record.grade.replace(/[/\\.#$[\]]/g, '').trim();

    // 고유성을 위해 타임스탬프 추가
    const timestamp = Date.now().toString(36);

    return `${dateStr}_${studentName}_${school}${grade}_${timestamp}`;
};

/**
 * 상담 기록 생성
 */
export const useCreateConsultation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (record: Omit<ConsultationRecord, 'id'>) => {
            const docId = generateDocId(record);
            const docRef = doc(db, 'consultations', docId);

            await setDoc(docRef, {
                ...record,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            return { id: docId, ...record };
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
