import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GanttDepartment } from '../types';

/**
 * 기본 부서 (컬렉션 비어있을 때 폴백)
 */
const DEFAULT_DEPARTMENTS: GanttDepartment[] = [
    { id: 'math', label: '수학부', order: 0, color: '#3B82F6' },
    { id: 'english', label: '영어부', order: 1, color: '#8B5CF6' },
    { id: 'admin', label: '행정부', order: 2, color: '#10B981' },
];

/**
 * 중앙화된 간트 부서 Hook
 *
 * P2 리팩토링: GanttBuilder에서 중복 쿼리 제거
 *
 * @example
 * const { data: departments, isLoading } = useGanttDepartments();
 */
export const useGanttDepartments = () => {
    return useQuery<GanttDepartment[]>({
        queryKey: ['gantt_departments'],
        queryFn: async () => {
            const q = query(
                collection(db, 'gantt_departments'),
                orderBy('order', 'asc')
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return DEFAULT_DEPARTMENTS;
            }

            return snapshot.docs.map(doc => {
                const data = doc.data() as any;
                return {
                    id: doc.id,
                    label: data.label || doc.id,
                    order: data.order ?? 0,
                    color: data.color || '#6B7280',
                    createdAt: data.createdAt,
                };
            });
        },
        staleTime: 1000 * 60 * 30, // 30분 캐싱
        gcTime: 1000 * 60 * 60,    // 1시간 GC
    });
};

export default useGanttDepartments;
