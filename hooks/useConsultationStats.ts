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
import { Consultation, ConsultationCategory, StaffMember, UnifiedStudent } from '../types';
import { COL_STUDENT_CONSULTATIONS } from './useStudentConsultations';
import { DailyConsultationStat } from '../components/Dashboard/CounselingOverview';
import { CategoryStat } from '../components/Dashboard/CategoryStats';
import { StaffPerformance } from '../components/Dashboard/PerformanceProgress';
import { COL_STUDENTS } from './useStudents';

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
 * 상담 미완료 학생 정보
 */
export interface StudentNeedingConsultation {
  studentId: string;
  studentName: string;
  enrolledSubjects: ('math' | 'english')[];  // 수강 중인 과목
  lastConsultationDate?: string;  // 가장 최근 상담일 (전체 기간)
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
  studentsNeedingConsultation: StudentNeedingConsultation[];
}

/**
 * 월간 상담 목표 (기본값)
 */
export const DEFAULT_MONTHLY_TARGET = 100;

/**
 * 상담 통계 조회 Hook
 * - 일별/카테고리별/상담자별 통계
 * - 대시보드용 집계 데이터
 * - 상담 미완료 학생 목록
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

      // 과목 필터링 (subject는 'math'/'english' 또는 '수학'/'영어' 둘 다 가능)
      if (filters?.subject && filters.subject !== 'all') {
        consultations = consultations.filter((c) => {
          if (filters.subject === 'math') {
            return c.subject === 'math' || c.subject === '수학';
          } else if (filters.subject === 'english') {
            return c.subject === 'english' || c.subject === '영어';
          }
          return true;
        });
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

      // 강사(teacher) ID 목록 생성
      const teacherIds = new Set(
        (staff || []).filter(s => s.role === 'teacher').map(s => s.id)
      );

      // 상담자별 통계 집계 (강사만)
      const staffMap = new Map<string, { name: string; count: number }>();
      consultations.forEach((c) => {
        // 강사 목록이 있으면 강사만, 없으면 모든 상담자 표시
        if (c.consultantId && (teacherIds.size === 0 || teacherIds.has(c.consultantId))) {
          const existing = staffMap.get(c.consultantId) || {
            name: c.consultantName || '알 수 없음',
            count: 0,
          };
          existing.count++;
          staffMap.set(c.consultantId, existing);
        }
      });

      const teacherCount = teacherIds.size || 5;
      const staffPerformances: StaffPerformance[] = Array.from(
        staffMap.entries()
      )
        .map(([id, data]) => ({
          id,
          name: data.name,
          consultationCount: data.count,
          targetCount: Math.ceil(DEFAULT_MONTHLY_TARGET / teacherCount),
          percentage: Math.min(
            100,
            Math.round(
              (data.count / Math.ceil(DEFAULT_MONTHLY_TARGET / teacherCount)) * 100
            )
          ),
        }))
        .sort((a, b) => b.consultationCount - a.consultationCount);

      // 선생님별 과목별 통계 집계 (강사만)
      const staffSubjectMap = new Map<string, { name: string; math: number; english: number }>();
      consultations.forEach((c) => {
        if (c.consultantId && (teacherIds.size === 0 || teacherIds.has(c.consultantId))) {
          const existing = staffSubjectMap.get(c.consultantId) || {
            name: c.consultantName || '알 수 없음',
            math: 0,
            english: 0,
          };
          // subject는 'math' | 'english' | '수학' | '영어' 둘 다 가능
          if (c.subject === 'math' || c.subject === '수학') {
            existing.math++;
          } else if (c.subject === 'english' || c.subject === '영어') {
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

      // ============ 상담 미완료 학생 목록 계산 ============
      // 의도: 선택한 기간 내에 1건 이상의 상담 기록이 없는 재원생 목록

      // 1. 재원생 조회 (status === 'active')
      const studentsQuery = query(
        collection(db, COL_STUDENTS),
        where('status', '==', 'active')
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const students = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UnifiedStudent));

      // 2. 수강과목이 있는 학생 필터링
      const eligibleStudents = students.filter(student => {
        const hasEnrollments = student.enrollments && student.enrollments.length > 0;
        if (!hasEnrollments) return false;

        // 수강과목에 math 또는 english가 있는지 확인
        const hasSubjects = student.enrollments.some(
          e => e.subject === 'math' || e.subject === 'english'
        );
        return hasSubjects;
      });

      // 3. 학생별로 선택 기간 내 상담 여부 체크 (과목 무관, 1건이라도 있으면 OK)
      const studentsNeedingConsultation: StudentNeedingConsultation[] = [];

      eligibleStudents.forEach(student => {
        // 이 학생의 수강과목 목록 (표시용)
        const enrolledSubjects: ('math' | 'english')[] = [];
        student.enrollments.forEach(e => {
          if (e.subject === 'math' || e.subject === 'english') {
            if (!enrolledSubjects.includes(e.subject)) {
              enrolledSubjects.push(e.subject);
            }
          }
        });

        // 이 학생의 선택 기간 내 상담 기록 (과목 무관)
        const studentConsultationsInPeriod = consultations.filter(c => c.studentId === student.id);

        // 기간 내 상담 기록이 0건이면 상담 필요 목록에 추가
        if (studentConsultationsInPeriod.length === 0) {
          // 전체 상담 기록에서 마지막 상담일 찾기 (기간 외 포함)
          // Note: consultations는 이미 기간 필터링이 된 상태이므로, 전체 기록을 다시 조회하지 않음
          // 대신 '해당 기간 내 상담 없음'으로 표시
          studentsNeedingConsultation.push({
            studentId: student.id,
            studentName: student.name,
            enrolledSubjects,
            lastConsultationDate: undefined,  // 기간 내 상담 없음
          });
        }
      });

      // 학생 이름순으로 정렬
      studentsNeedingConsultation.sort((a, b) => a.studentName.localeCompare(b.studentName));

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
        studentsNeedingConsultation,
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
      studentsNeedingConsultation: [],
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

/**
 * Date를 'YYYY-MM-DD' 형식으로 변환 (로컬 시간 기준)
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateRangeFromPreset(preset: DatePreset): {
  start: string;
  end: string;
} {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (preset) {
    case 'thisWeek':
      // 이번 주: 월요일 ~ 일요일
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일이면 -6, 아니면 월요일까지 거리
      start = new Date(now);
      start.setDate(now.getDate() + mondayOffset);
      end = new Date(start);
      end.setDate(start.getDate() + 6); // 일요일
      break;
    case 'thisMonth':
      // 이번 달: 1일 ~ 말일 (예: 1/1 ~ 1/31)
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // 말일
      break;
    case 'lastMonth':
      // 지난 달: 1일 ~ 말일
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0); // 지난달 말일
      break;
    case 'last3Months':
      // 3개월: 2달 전 1일 ~ 이번달 말일
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // 이번달 말일
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}
