import { useQuery } from '@tanstack/react-query';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    Query,
    DocumentData,
    limit,
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

            // 필터 적용 - 복합 인덱스 문제를 피하기 위해 단순 where만 사용
            // studentId 필터가 있으면 단일 where만 사용 (인덱스 불필요)
            if (filters?.studentId) {
                constraints.push(where('studentId', '==', filters.studentId));
            } else {
                // studentId가 없는 경우에만 다른 필터 적용
                if (filters?.type) {
                    constraints.push(where('type', '==', filters.type));
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
            }

            // 복합 인덱스 문제 최소화를 위해 필터가 없을 때만 orderBy/limit 적용 권장
            // 하지만 리스트 뷰 최적화를 위해 가능한 경우 적용. 인덱스 에러 발생 시 콘솔 링크 통해 생성 필요.
            if (!filters?.studentId) {
                // 전체 목록 조회 시 최신 200개만 조회 (비용 절감)
                constraints.push(orderBy('date', 'desc'));
                constraints.push(limit(200));
            }

            if (constraints.length > 0) {
                q = query(collection(db, COL_STUDENT_CONSULTATIONS), ...constraints);
            }

            const snapshot = await getDocs(q);
            let consultationList = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as Consultation));

            // 클라이언트 사이드 필터링 (studentId 쿼리에서 제외된 필터들)
            if (filters?.studentId) {
                if (filters?.type) {
                    consultationList = consultationList.filter(c => c.type === filters.type);
                }
                if (filters?.category) {
                    consultationList = consultationList.filter(c => c.category === filters.category);
                }
                if (filters?.subject) {
                    consultationList = consultationList.filter(c => c.subject === filters.subject);
                }
            }

            // 클라이언트 사이드 정렬 (이미 서버 정렬했으면 불필요하지만 안전을 위해 유지 또는 studentId 검색 시 사용)
            consultationList.sort((a, b) => {
                const dateCompare = (b.date || '').localeCompare(a.date || '');
                if (dateCompare !== 0) return dateCompare;
                return (b.createdAt || 0) - (a.createdAt || 0);
            });

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
        staleTime: 1000 * 60 * 5,     // 5분 캐싱
        gcTime: 1000 * 60 * 10,       // 10분 GC
        refetchOnWindowFocus: false,  // 포커스 시 자동 갱신 비활성화 (비용 절감)
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
