import { useQuery } from '@tanstack/react-query';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    Query,
    DocumentData,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Consultation, ConsultationCategory } from '../types';

export const COL_STUDENT_CONSULTATIONS = 'student_consultations';

/**
 * 상담 필터 옵션
 */
export interface StudentConsultationFilters {
    type?: 'parent' | 'student';
    studentId?: string;
    consultantId?: string;
    category?: ConsultationCategory;
    dateRange?: { start: string; end: string };
    followUpStatus?: 'all' | 'needed' | 'done' | 'pending';
    subject?: 'math' | 'english' | 'all';
    searchQuery?: string;
}

/**
 * 상담 기록 목록 조회 Hook
 * - React Query 기반 캐싱
 * - 다양한 필터 옵션 지원
 * - 5분 캐싱으로 Firebase 비용 절감
 */
export function useStudentConsultations(filters?: StudentConsultationFilters) {
    const { data: consultations = [], isLoading, error: queryError, refetch } = useQuery<Consultation[]>({
        queryKey: ['student_consultations', filters],
        queryFn: async () => {
            let q: Query<DocumentData> = collection(db, COL_STUDENT_CONSULTATIONS);
            const constraints: any[] = [];

            // 필터 적용
            if (filters?.type) {
                constraints.push(where('type', '==', filters.type));
            }

            if (filters?.studentId) {
                constraints.push(where('studentId', '==', filters.studentId));
            }

            if (filters?.consultantId) {
                constraints.push(where('consultantId', '==', filters.consultantId));
            }

            if (filters?.category) {
                constraints.push(where('category', '==', filters.category));
            }

            if (filters?.subject) {
                constraints.push(where('subject', '==', filters.subject));
            }

            // 날짜 범위 필터 (클라이언트 사이드)
            // Firestore에서는 range query가 하나만 가능하므로 클라이언트에서 필터링

            // 정렬: 최신순
            constraints.push(orderBy('date', 'desc'));
            constraints.push(orderBy('createdAt', 'desc'));

            if (constraints.length > 0) {
                q = query(collection(db, COL_STUDENT_CONSULTATIONS), ...constraints);
            }

            const snapshot = await getDocs(q);
            let consultationList = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as Consultation));

            // 클라이언트 사이드 필터링
            if (filters?.dateRange) {
                const { start, end } = filters.dateRange;
                consultationList = consultationList.filter(c => {
                    return c.date >= start && c.date <= end;
                });
            }

            if (filters?.followUpStatus && filters.followUpStatus !== 'all') {
                if (filters.followUpStatus === 'needed') {
                    consultationList = consultationList.filter(c => c.followUpNeeded && !c.followUpDone);
                } else if (filters.followUpStatus === 'done') {
                    consultationList = consultationList.filter(c => c.followUpNeeded && c.followUpDone);
                } else if (filters.followUpStatus === 'pending') {
                    consultationList = consultationList.filter(c => {
                        if (!c.followUpNeeded || c.followUpDone) return false;
                        // 예정일이 없거나 지나지 않은 것들
                        if (!c.followUpDate) return true;
                        return c.followUpDate >= new Date().toISOString().split('T')[0];
                    });
                }
            }

            if (filters?.searchQuery) {
                const lowerQuery = filters.searchQuery.toLowerCase();
                consultationList = consultationList.filter(c =>
                    c.studentName.toLowerCase().includes(lowerQuery) ||
                    c.title.toLowerCase().includes(lowerQuery) ||
                    c.content.toLowerCase().includes(lowerQuery)
                );
            }

            return consultationList;
        },
        staleTime: 1000 * 60 * 5,    // 5분 캐싱
        gcTime: 1000 * 60 * 15,       // 15분 GC
        refetchOnWindowFocus: false,
    });

    const error = queryError ? (queryError as Error).message : null;

    return {
        consultations,
        loading: isLoading,
        error,
        refetch,
    };
}

/**
 * 특정 학생의 상담 이력 조회
 */
export function useStudentConsultationHistory(studentId: string) {
    return useStudentConsultations({ studentId });
}

/**
 * 후속 조치 필요 상담 목록 조회
 */
export function useFollowUpConsultations() {
    return useStudentConsultations({ followUpStatus: 'needed' });
}

/**
 * 후속 조치 긴급 상담 계산 (3일 이내)
 */
export function getFollowUpUrgency(consultation: Consultation): 'urgent' | 'pending' | 'done' | null {
    if (!consultation.followUpNeeded) return null;
    if (consultation.followUpDone) return 'done';
    if (!consultation.followUpDate) return 'pending';

    const today = new Date().toISOString().split('T')[0];
    const followUpDate = new Date(consultation.followUpDate);
    const todayDate = new Date(today);
    const diffTime = followUpDate.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3) return 'urgent';
    return 'pending';
}

/**
 * 후속 조치 남은 일수 계산
 */
export function getFollowUpDaysLeft(followUpDate: string): number {
    const today = new Date().toISOString().split('T')[0];
    const followUp = new Date(followUpDate);
    const todayDate = new Date(today);
    const diffTime = followUp.getTime() - todayDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
