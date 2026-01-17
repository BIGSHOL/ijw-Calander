import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Consultation, ConsultationCategory, StaffMember } from '../types';
import { COL_STUDENT_CONSULTATIONS } from './useStudentConsultations';
import { DailyConsultationStat } from '../components/Dashboard/CounselingOverview';
import { CategoryStat } from '../components/Dashboard/CategoryStats';
import { StaffPerformance } from '../components/Dashboard/PerformanceProgress';

/**
 * 상담 통계 필터 옵션
 */
export interface ConsultationStatsFilters {
  dateRange?: { start: string; end: string };
  subject?: 'math' | 'english' | 'all';
}

/**
 * 선생님별 과목별 상담 통계
 */
export interface StaffSubjectStat {
  id: string;
  name: string;
  mathCount: number;
  englishCount: number;
  totalCount: number;
}

/**
 * 통계 결과 타입
 */
export interface ConsultationStatsResult {
  dailyStats: DailyConsultationStat[];
  categoryStats: CategoryStat[];
  staffPerformances: StaffPerformance[];
  staffSubjectStats: StaffSubjectStat[];
  topPerformer: StaffPerformance | null;
  totalConsultations: number;
  parentConsultations: number;
  studentConsultations: number;
  followUpNeeded: number;
  followUpDone: number;
}

/**
 * 월간 상담 목표 (기본값)
 */
export const DEFAULT_MONTHLY_TARGET = 100;

/**
 * 상담 통계 조회 Hook
 * - 일별/카테고리별/상담자별 통계
 * - 대시보드용 집계 데이터
 */
export function useConsultationStats(
  filters?: ConsultationStatsFilters,
  staff?: StaffMember[]
) {
  // 기본 날짜 범위: 이번 달
  const defaultDateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, []);

  const dateRange = filters?.dateRange || defaultDateRange;

  const { data, isLoading, error: queryError, refetch } = useQuery<ConsultationStatsResult>({
    queryKey: ['consultation_stats', dateRange, filters?.subject],
    queryFn: async () => {
      const colRef = collection(db, COL_STUDENT_CONSULTATIONS);

      // 복합 인덱스 문제를 피하기 위해 orderBy만 사용하고 클라이언트에서 필터링
      const q = query(colRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);

      let consultations = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Consultation)
      );

      // 클라이언트 사이드 날짜 필터링
      consultations = consultations.filter(
        (c) => c.date >= dateRange.start && c.date <= dateRange.end
      );

      // 과목 필터링
      if (filters?.subject && filters.subject !== 'all') {
        const subjectValue = filters.subject === 'math' ? '수학' : '영어';
        consultations = consultations.filter((c) => c.subject === subjectValue);
      }

      // 일별 통계 집계
      const dailyMap = new Map<string, { parent: number; student: number }>();
      consultations.forEach((c) => {
        const existing = dailyMap.get(c.date) || { parent: 0, student: 0 };
        if (c.type === 'parent') {
          existing.parent++;
        } else {
          existing.student++;
        }
        dailyMap.set(c.date, existing);
      });

      const dailyStats: DailyConsultationStat[] = Array.from(dailyMap.entries())
        .map(([date, counts]) => ({
          date,
          parentCount: counts.parent,
          studentCount: counts.student,
          total: counts.parent + counts.student,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 카테고리별 통계 집계
      const categoryMap = new Map<ConsultationCategory, number>();
      consultations.forEach((c) => {
        const current = categoryMap.get(c.category) || 0;
        categoryMap.set(c.category, current + 1);
      });

      const totalConsultations = consultations.length;
      const categoryStats: CategoryStat[] = Array.from(categoryMap.entries()).map(
        ([category, count]) => ({
          category,
          count,
          percentage:
            totalConsultations > 0
              ? Math.round((count / totalConsultations) * 100)
              : 0,
        })
      );

      // 상담자별 통계 집계
      const staffMap = new Map<string, { name: string; count: number }>();
      consultations.forEach((c) => {
        if (c.consultantId) {
          const existing = staffMap.get(c.consultantId) || {
            name: c.consultantName || '알 수 없음',
            count: 0,
          };
          existing.count++;
          staffMap.set(c.consultantId, existing);
        }
      });

      const staffPerformances: StaffPerformance[] = Array.from(
        staffMap.entries()
      )
        .map(([id, data]) => ({
          id,
          name: data.name,
          consultationCount: data.count,
          targetCount: Math.ceil(DEFAULT_MONTHLY_TARGET / (staff?.length || 5)),
          percentage: Math.min(
            100,
            Math.round(
              (data.count /
                Math.ceil(DEFAULT_MONTHLY_TARGET / (staff?.length || 5))) *
                100
            )
          ),
        }))
        .sort((a, b) => b.consultationCount - a.consultationCount);

      // 선생님별 과목별 통계 집계
      const staffSubjectMap = new Map<string, { name: string; math: number; english: number }>();
      consultations.forEach((c) => {
        if (c.consultantId) {
          const existing = staffSubjectMap.get(c.consultantId) || {
            name: c.consultantName || '알 수 없음',
            math: 0,
            english: 0,
          };
          if (c.subject === '수학') {
            existing.math++;
          } else if (c.subject === '영어') {
            existing.english++;
          }
          staffSubjectMap.set(c.consultantId, existing);
        }
      });

      const staffSubjectStats: StaffSubjectStat[] = Array.from(
        staffSubjectMap.entries()
      )
        .map(([id, data]) => ({
          id,
          name: data.name,
          mathCount: data.math,
          englishCount: data.english,
          totalCount: data.math + data.english,
        }))
        .sort((a, b) => b.totalCount - a.totalCount);

      // 후속 조치 통계
      const followUpNeeded = consultations.filter(
        (c) => c.followUpNeeded && !c.followUpDone
      ).length;
      const followUpDone = consultations.filter(
        (c) => c.followUpNeeded && c.followUpDone
      ).length;

      return {
        dailyStats,
        categoryStats,
        staffPerformances,
        staffSubjectStats,
        topPerformer: staffPerformances[0] || null,
        totalConsultations,
        parentConsultations: consultations.filter((c) => c.type === 'parent')
          .length,
        studentConsultations: consultations.filter((c) => c.type === 'student')
          .length,
        followUpNeeded,
        followUpDone,
      };
    },
    staleTime: 1000 * 60 * 5, // 5분 캐싱
    gcTime: 1000 * 60 * 10, // 10분 GC
    refetchOnWindowFocus: false,
  });

  const error = queryError ? (queryError as Error).message : null;

  return {
    stats: data || {
      dailyStats: [],
      categoryStats: [],
      staffPerformances: [],
      staffSubjectStats: [],
      topPerformer: null,
      totalConsultations: 0,
      parentConsultations: 0,
      studentConsultations: 0,
      followUpNeeded: 0,
      followUpDone: 0,
    },
    loading: isLoading,
    error,
    refetch,
  };
}

/**
 * 기간 선택 프리셋
 */
export type DatePreset = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last3Months';

export function getDateRangeFromPreset(preset: DatePreset): {
  start: string;
  end: string;
} {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  switch (preset) {
    case 'thisWeek':
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      break;
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'last3Months':
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}
