// hooks/useFirebaseQueries.ts - React Query hooks for Firebase data
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, orderBy, query, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Department, Teacher, Holiday, ClassKeywordColor, SystemConfig } from '../types';
import { departmentConverter } from '../converters';

// 부서목록 - 30분 캐시 (거의 변경 안됨)
export const useDepartments = () => {
    return useQuery({
        queryKey: ['departments'],
        queryFn: async () => {
            const q = query(
                collection(db, '부서목록').withConverter(departmentConverter),
                orderBy('순서')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data());
        },
        staleTime: 1000 * 60 * 30, // 30분
        gcTime: 1000 * 60 * 60, // 1시간
    });
};

// 강사목록 - 30분 캐시 (거의 변경 안됨)
export const useTeachers = () => {
    return useQuery({
        queryKey: ['teachers'],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, '강사목록'));
            return snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as Teacher))
                .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        },
        staleTime: 1000 * 60 * 30, // 30분
        gcTime: 1000 * 60 * 60, // 1시간
    });
};

// 휴일 목록 - 1시간 캐시 (거의 변경 안됨)
export const useHolidays = () => {
    return useQuery({
        queryKey: ['holidays'],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, 'holidays'));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Holiday));
        },
        staleTime: 1000 * 60 * 60, // 1시간
        gcTime: 1000 * 60 * 120, // 2시간
    });
};

// 수업 키워드 색상 - 30분 캐시 (거의 변경 안됨)
export const useClassKeywords = () => {
    return useQuery({
        queryKey: ['classKeywords'],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, 'classKeywords'));
            return snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as ClassKeywordColor))
                .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        },
        staleTime: 1000 * 60 * 30, // 30분
        gcTime: 1000 * 60 * 60, // 1시간
    });
};

// 시스템 설정 (lookback years, categories) - 1시간 캐시
export const useSystemConfig = () => {
    return useQuery({
        queryKey: ['systemConfig'],
        queryFn: async () => {
            const docSnap = await getDoc(doc(db, 'system', 'config'));
            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    eventLookbackYears: data.eventLookbackYears || 2,
                    categories: data.categories || [],
                    tabPermissions: data.tabPermissions || undefined
                } as SystemConfig;
            }
            return { eventLookbackYears: 2, categories: [], tabPermissions: undefined } as SystemConfig;
        },
        staleTime: 1000 * 60 * 60, // 1시간
        gcTime: 1000 * 60 * 120, // 2시간
    });
};
