/**
 * Generic Timetable Classes Hook
 *
 * Performance Optimizations Applied:
 * - React Query로 전환: 캐싱 및 중복 요청 제거
 * - getDocs 사용: 필요 시점에만 데이터 조회
 * - staleTime: 30초 (불필요한 재조회 방지)
 * - subject별 독립적인 쿼리 키로 병렬 캐싱
 *
 * 학생 수 집계: enrollments collectionGroup 기반 (퇴원/미래배정 제외)
 * - Math 시간표와 동일한 기준 사용
 */

import { useQuery } from '@tanstack/react-query';
import { collection, collectionGroup, query, where, getDocs } from 'firebase/firestore';
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
 */
export function useTimetableClasses(subject: SubjectKey) {
  const { data: classes = [], isLoading: loading } = useQuery({
    queryKey: ['timetableClasses', subject],
    queryFn: async () => {
      const config = getSubjectConfig(subject);

      // classes + enrollments 병렬 조회
      const classesQuery = query(
        collection(db, COL_CLASSES),
        where('isActive', '==', true),
        where('subject', '==', config.firebaseSubjectKey)
      );
      const enrollmentsQuery = collectionGroup(db, 'enrollments');

      const [snapshot, enrollmentsSnapshot] = await Promise.all([
        getDocs(classesQuery),
        getDocs(enrollmentsQuery),
      ]);

      // enrollment 기반 수업별 학생 수 집계 (퇴원/미래배정 제외)
      const classStudentCounts = new Map<string, Set<string>>();
      const today = new Date().toISOString().split('T')[0];

      enrollmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const className = data.className as string;
        const studentId = doc.ref.parent.parent?.id;
        if (!className || !studentId) return;

        // 해당 과목의 수강만 필터
        if (data.subject !== config.firebaseSubjectKey) return;

        // 퇴원/종료 학생 제외
        const withdrawalDate = data.withdrawalDate?.toDate?.()
          ? data.withdrawalDate.toDate().toISOString().split('T')[0]
          : (typeof data.withdrawalDate === 'string' ? data.withdrawalDate : null);
        const endDate = data.endDate?.toDate?.()
          ? data.endDate.toDate().toISOString().split('T')[0]
          : (typeof data.endDate === 'string' ? data.endDate : null);
        if (withdrawalDate || endDate) return;

        // 미래 배정 학생 제외
        const startDate = data.enrollmentDate?.toDate?.()
          ? data.enrollmentDate.toDate().toISOString().split('T')[0]
          : (typeof data.enrollmentDate === 'string' ? data.enrollmentDate
            : data.startDate?.toDate?.()
              ? data.startDate.toDate().toISOString().split('T')[0]
              : (typeof data.startDate === 'string' ? data.startDate : null));
        if (startDate && startDate > today) return;

        if (!classStudentCounts.has(className)) {
          classStudentCounts.set(className, new Set());
        }
        classStudentCounts.get(className)!.add(studentId);
      });

      const hasGrouping = config.hasGrouping;

      const loadedClasses: TimetableClass[] = snapshot.docs.map(doc => {
        const data = doc.data();

        let scheduleStrings: string[] = [];
        if (data.schedule && Array.isArray(data.schedule)) {
          scheduleStrings = data.schedule.map((slot: any) => {
            const periodId = hasGrouping
              ? convertToLegacyPeriodId(slot.periodId)
              : slot.periodId;
            return `${slot.day} ${periodId}`;
          });
        } else if (data.legacySchedule) {
          scheduleStrings = data.legacySchedule;
        }

        // enrollment 기반 학생 수 (없으면 classes 문서의 studentCount 폴백)
        const enrollmentCount = classStudentCounts.get(data.className)?.size;
        const studentCount = enrollmentCount ?? data.studentCount ?? 0;

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
          studentCount,
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
