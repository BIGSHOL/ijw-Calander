// hooks/useFirebaseQueries.ts - React Query hooks for Firebase data
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, orderBy, query, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Department, Teacher, Holiday, ClassKeywordColor, SystemConfig, StaffMember } from '../types';
import { departmentConverter } from '../converters';

// 부서목록 - 30분 캐시 (거의 변경 안됨)
export const useDepartments = (enabled: boolean = true) => {
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
        enabled,
    });
};

// 강사 (staff 컬렉션에서 role='teacher' 조회) - 30분 캐시
export const useTeachers = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['teachers'],
        queryFn: async () => {
            // Read from staff collection where role = 'teacher'
            const q = query(
                collection(db, 'staff'),
                where('role', '==', 'teacher')
            );
            const snapshot = await getDocs(q);

            // Map StaffMember back to Teacher format for backward compatibility
            return snapshot.docs
                .map(d => {
                    const staff = d.data() as StaffMember;
                    return {
                        id: d.id,
                        name: staff.name,
                        englishName: staff.englishName,
                        subjects: staff.subjects,
                        isHidden: staff.isHiddenInTimetable || false,
                        isNative: staff.isNative || false,
                        bgColor: staff.bgColor,
                        textColor: staff.textColor,
                        order: staff.timetableOrder,
                        defaultRoom: staff.defaultRoom,
                    } as Teacher;
                })
                .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        },
        staleTime: 1000 * 60 * 30, // 30분
        gcTime: 1000 * 60 * 60, // 1시간
        enabled,
    });
};

// 휴일 목록 - 1시간 캐시 (거의 변경 안됨)
export const useHolidays = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['holidays'],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, 'holidays'));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Holiday));
        },
        staleTime: 1000 * 60 * 60, // 1시간
        gcTime: 1000 * 60 * 120, // 2시간
        enabled,
    });
};

// 수업 키워드 색상 - 30분 캐시 (거의 변경 안됨)
export const useClassKeywords = (enabled: boolean = true) => {
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
        enabled,
    });
};

// 직원 목록 (시스템 계정 연동 포함) - 5분 캐시
// staff 컬렉션에서 계정 연동된 직원(uid가 있는) 조회
export const useStaffWithAccounts = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['staffWithAccounts'],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, 'staff'));
            return snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as StaffMember))
                .filter(s => s.uid); // uid가 있는 직원만 (계정 연동된)
        },
        staleTime: 1000 * 60 * 5, // 5분
        gcTime: 1000 * 60 * 15, // 15분
        enabled,
    });
};

// 전체 직원 목록 - 5분 캐시
export const useAllStaff = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['allStaff'],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, 'staff'));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember));
        },
        staleTime: 1000 * 60 * 5, // 5분
        gcTime: 1000 * 60 * 15, // 15분
        enabled,
    });
};

// 시스템 설정 (lookback years, categories) - 1시간 캐시
export const useSystemConfig = (enabled: boolean = true) => {
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
        enabled,
    });
};
