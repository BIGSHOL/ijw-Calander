/**
 * Generic Timetable Classes Hook
 *
 * Performance Optimizations Applied:
 * - React Query로 전환: 캐싱 및 중복 요청 제거
 * - getDocs 사용: 필요 시점에만 데이터 조회
 * - staleTime: 30초 (불필요한 재조회 방지)
 * - subject별 독립적인 쿼리 키로 병렬 캐싱
 */

import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { convertToLegacyPeriodId } from '../../constants';
import type { TimetableClass, SubjectKey } from '../types';
import { getSubjectConfig } from '../utils/subjectConfig';

const COL_CLASSES = 'classes';

/**
 * Hook to fetch timetable classes for a specific subject
 *
 * @param subject - Subject key (math, english, science, korean)
 * @returns Classes data and loading state
 *
 * Performance Notes:
 * - React Query로 캐싱 및 중복 요청 제거
 * - Subject별 독립적인 캐시 관리
 * - 30초 staleTime으로 불필요한 재조회 방지
 */
export function useTimetableClasses(subject: SubjectKey) {
  const { data: classes = [], isLoading: loading } = useQuery({
    queryKey: ['timetableClasses', subject],
    queryFn: async () => {
      // Performance Note (js-cache-property-access):
      // Cache config lookup
      const config = getSubjectConfig(subject);

      // Query classes filtered by subject at Firebase level
      // Performance Note (server-side-filter):
      // Filter at database level, not in-memory
      const q = query(
        collection(db, COL_CLASSES),
        where('isActive', '==', true),
        where('subject', '==', config.firebaseSubjectKey)
      );

      const snapshot = await getDocs(q);

      // Performance Note (js-cache-property-access):
      // Cache frequently accessed values
      const hasGrouping = config.hasGrouping;

      const loadedClasses: TimetableClass[] = snapshot.docs.map(doc => {
        const data = doc.data();

        // Convert schedule to legacy string format if needed
        // Performance Note (js-early-exit):
        // Check for existence before processing
        let scheduleStrings: string[] = [];
        if (data.schedule && Array.isArray(data.schedule)) {
          scheduleStrings = data.schedule.map((slot: any) => {
            // For grouped subjects (Math/Science/Korean), convert to legacy format
            const periodId = hasGrouping
              ? convertToLegacyPeriodId(slot.periodId)
              : slot.periodId;
            return `${slot.day} ${periodId}`;
          });
        } else if (data.legacySchedule) {
          scheduleStrings = data.legacySchedule;
        }

        return {
          id: doc.id,
          className: data.className || '',
          subject: config.subject,
          teacher: data.teacher || '',
          assistants: data.assistants,
          room: data.room,
          schedule: scheduleStrings,
          color: data.color,
          isActive: data.isActive ?? true,
          studentCount: data.studentCount,
          slotTeachers: data.slotTeachers,
          slotRooms: data.slotRooms,
          memo: data.memo,
        };
      });

      return loadedClasses;
    },
    staleTime: 1000 * 30, // 30초
    gcTime: 1000 * 60 * 5, // 5분
    refetchOnWindowFocus: false,
  });

  return { classes, loading };
}
