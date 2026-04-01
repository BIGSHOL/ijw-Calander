/**
 * 셔틀 탑승 학생 이름 Set 반환 (경량 훅)
 * shuttle_students 컬렉션에서 isShuttle=true인 학생 이름만 조회
 */
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export function useShuttleNames(enabled = true) {
    return useQuery({
        queryKey: ['shuttleNames'],
        enabled,
        queryFn: async (): Promise<Set<string>> => {
            const snap = await getDocs(collection(db, 'shuttle_students'));
            const names = new Set<string>();
            snap.docs.forEach(doc => {
                const data = doc.data();
                if (data.isShuttle && data.name) {
                    names.add(data.name.trim());
                }
            });
            return names;
        },
        staleTime: 5 * 60 * 1000,
    });
}
