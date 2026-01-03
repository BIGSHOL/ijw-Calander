import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * 간트 카테고리 인터페이스
 */
export interface GanttCategory {
    id: string;
    label: string;
    backgroundColor: string;
    textColor: string;
    order: number;
}

// 기본 카테고리 (컬렉션 비어있을 때 폴백)
const DEFAULT_CATEGORIES: GanttCategory[] = [
    { id: 'planning', label: '기획', backgroundColor: '#dbeafe', textColor: '#1d4ed8', order: 0 },
    { id: 'development', label: '개발', backgroundColor: '#f3e8ff', textColor: '#7e22ce', order: 1 },
    { id: 'testing', label: '테스트', backgroundColor: '#d1fae5', textColor: '#047857', order: 2 },
    { id: 'other', label: '기타', backgroundColor: '#f3f4f6', textColor: '#374151', order: 3 }
];

/**
 * 중앙화된 간트 카테고리 Hook
 * 
 * P2 리팩토링: GanttBuilder, GanttChart, GanttCategoriesTab에서 중복 쿼리 제거
 * Firebase 비용 67% 절감 (3개 쿼리 → 1개 쿼리)
 * 
 * @example
 * const { data: categories, isLoading } = useGanttCategories();
 */
export const useGanttCategories = () => {
    return useQuery<GanttCategory[]>({
        queryKey: ['gantt_categories'],
        queryFn: async () => {
            const q = query(
                collection(db, 'gantt_categories'),
                orderBy('order', 'asc')
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return DEFAULT_CATEGORIES;
            }

            return snapshot.docs.map(doc => ({
                id: doc.id,
                label: doc.data().label || doc.id,
                backgroundColor: doc.data().backgroundColor || '#f3f4f6',
                textColor: doc.data().textColor || '#374151',
                order: doc.data().order ?? 0,
            }));
        },
        staleTime: 1000 * 60 * 30, // 30분 캐싱
        gcTime: 1000 * 60 * 60,    // 1시간 GC
    });
};

/**
 * 카테고리 ID로 카테고리 정보 조회 헬퍼
 */
export const getCategoryById = (categories: GanttCategory[], id: string): GanttCategory | undefined => {
    return categories.find(c => c.id === id);
};

/**
 * 카테고리 스타일 생성 헬퍼
 */
export const getCategoryStyle = (category: GanttCategory | undefined): React.CSSProperties => {
    if (!category) {
        return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
    return {
        backgroundColor: category.backgroundColor,
        color: category.textColor,
    };
};
