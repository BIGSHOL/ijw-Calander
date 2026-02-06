import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent, Enrollment, StaffMember } from '../types';
import { COL_STUDENTS } from './useStudents';
import { WITHDRAWAL_REASON_LABEL, SUBJECT_LABEL } from '../constants/withdrawal';

/**
 * 퇴원 통계 필터 옵션
 */
export interface WithdrawalStatsFilters {
  dateRange?: { start: string; end: string };
  entryType?: 'all' | 'withdrawn' | 'subject-ended';
}

/**
 * 월별 퇴원 통계
 */
export interface MonthlyWithdrawalStat {
  month: string;           // YYYY-MM
  monthLabel: string;      // 1월, 2월, ...
  withdrawnCount: number;  // 완전 퇴원
  subjectEndedCount: number; // 수강종료
  total: number;
}

/**
 * 퇴원 사유별 통계
 */
export interface WithdrawalReasonStat {
  reason: string;
  label: string;
  count: number;
  percentage: number;
}

/**
 * 과목별 퇴원 통계
 */
export interface SubjectWithdrawalStat {
  subject: string;
  label: string;
  count: number;
  percentage: number;
}

/**
 * 강사별 퇴원 통계
 */
export interface StaffWithdrawalStat {
  staffId: string;
  staffName: string;
  mathCount: number;
  englishCount: number;
  totalCount: number;
}

/**
 * 상담 미완료 항목
 */
export interface IncompleteConsultation {
  studentId: string;
  studentName: string;
  type: 'withdrawn' | 'subject-ended';
  withdrawalDate: string;
  pendingItems: ('adminCalled' | 'teacherCalled' | 'studentTalked')[];
}

/**
 * 퇴원 통계 결과
 */
export interface WithdrawalStatsResult {
  // 요약 카드용
  totalWithdrawals: number;
  thisMonthWithdrawals: number;
  withdrawnCount: number;
  subjectEndedCount: number;
  consultationCompleteRate: number;
  incompleteConsultations: IncompleteConsultation[];

  // 차트용
  monthlyStats: MonthlyWithdrawalStat[];
  reasonStats: WithdrawalReasonStat[];
  subjectStats: SubjectWithdrawalStat[];
  staffStats: StaffWithdrawalStat[];
}

/**
 * 과목별 수강종료 여부 판정
 */
function getEndedSubjects(student: UnifiedStudent): { subjects: string[]; enrollments: Enrollment[] } {
  const bySubject = new Map<string, Enrollment[]>();
  for (const e of student.enrollments || []) {
    const list = bySubject.get(e.subject) || [];
    list.push(e);
    bySubject.set(e.subject, list);
  }

  const endedSubjects: string[] = [];
  const endedEnrollments: Enrollment[] = [];

  for (const [subject, enrollments] of bySubject) {
    const hasActive = enrollments.some(e => !e.withdrawalDate && !e.endDate);
    if (!hasActive && enrollments.length > 0) {
      endedSubjects.push(subject);
      endedEnrollments.push(...enrollments);
    }
  }

  return { subjects: endedSubjects, enrollments: endedEnrollments };
}

/**
 * Date를 'YYYY-MM-DD' 형식으로 변환 (로컬 시간 기준)
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 퇴원 통계 조회 Hook
 */
export function useWithdrawalStats(
  filters?: WithdrawalStatsFilters,
  staff?: StaffMember[]
) {
  // 기본 날짜 범위: 최근 12개월
  const defaultDateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: formatLocalDate(start),
      end: formatLocalDate(end),
    };
  }, []);

  const dateRange = filters?.dateRange || defaultDateRange;

  // 이번 달 범위
  const thisMonthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: formatLocalDate(start),
      end: formatLocalDate(end),
    };
  }, []);

  const { data, isLoading, error: queryError, refetch } = useQuery<WithdrawalStatsResult>({
    queryKey: ['withdrawal_stats', dateRange, filters?.entryType],
    queryFn: async () => {
      // 1. 모든 학생 조회
      const studentsSnap = await getDocs(collection(db, COL_STUDENTS));
      const allStudents = studentsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as UnifiedStudent[];

      // 2. 모든 enrollments 조회
      const allEnrollmentsSnap = await getDocs(collectionGroup(db, 'enrollments'));
      const enrollmentsByStudent = new Map<string, Enrollment[]>();

      allEnrollmentsSnap.docs.forEach(enrollDoc => {
        const pathParts = enrollDoc.ref.path.split('/');
        const studentId = pathParts[1];
        const enrollData = enrollDoc.data() as Enrollment;

        if (!enrollmentsByStudent.has(studentId)) {
          enrollmentsByStudent.set(studentId, []);
        }
        enrollmentsByStudent.get(studentId)!.push(enrollData);
      });

      // 학생에 enrollments 병합
      allStudents.forEach(student => {
        student.enrollments = enrollmentsByStudent.get(student.id) || [];
      });

      // 3. 퇴원/수강종료 항목 추출
      interface WithdrawalEntry {
        student: UnifiedStudent;
        type: 'withdrawn' | 'subject-ended';
        endedSubjects: string[];
        endedEnrollments: Enrollment[];
        effectiveDate: string;
      }

      const entries: WithdrawalEntry[] = [];

      for (const student of allStudents) {
        if (student.status === 'withdrawn') {
          // 완전 퇴원
          const effectiveDate = student.withdrawalDate || student.endDate || '';
          if (effectiveDate >= dateRange.start && effectiveDate <= dateRange.end) {
            entries.push({
              student,
              type: 'withdrawn',
              endedSubjects: [...new Set((student.enrollments || []).map(e => e.subject))],
              endedEnrollments: student.enrollments || [],
              effectiveDate,
            });
          }
        } else if (student.status === 'active' || student.status === 'on_hold') {
          const { subjects, enrollments } = getEndedSubjects(student);
          if (subjects.length > 0) {
            const latestDate = enrollments
              .map(e => e.withdrawalDate || e.endDate || '')
              .filter(Boolean)
              .sort()
              .pop() || '';

            if (latestDate >= dateRange.start && latestDate <= dateRange.end) {
              entries.push({
                student,
                type: 'subject-ended',
                endedSubjects: subjects,
                endedEnrollments: enrollments,
                effectiveDate: latestDate,
              });
            }
          }
        }
      }

      // 4. 기본 통계 계산
      const withdrawnEntries = entries.filter(e => e.type === 'withdrawn');
      const subjectEndedEntries = entries.filter(e => e.type === 'subject-ended');

      // 이번 달 퇴원 수
      const thisMonthWithdrawals = entries.filter(e =>
        e.effectiveDate >= thisMonthRange.start && e.effectiveDate <= thisMonthRange.end
      ).length;

      // 5. 상담 완료율 계산
      let totalConsultationItems = 0;
      let completedConsultationItems = 0;
      const incompleteConsultations: IncompleteConsultation[] = [];

      withdrawnEntries.forEach(entry => {
        const consultation = entry.student.withdrawalConsultation;
        const pendingItems: ('adminCalled' | 'teacherCalled' | 'studentTalked')[] = [];

        // 3개 항목 체크
        totalConsultationItems += 3;

        if (consultation?.adminCalledParent) {
          completedConsultationItems++;
        } else {
          pendingItems.push('adminCalled');
        }

        if (consultation?.teacherCalledParent) {
          completedConsultationItems++;
        } else {
          pendingItems.push('teacherCalled');
        }

        if (consultation?.talkedWithStudent) {
          completedConsultationItems++;
        } else {
          pendingItems.push('studentTalked');
        }

        if (pendingItems.length > 0) {
          incompleteConsultations.push({
            studentId: entry.student.id,
            studentName: entry.student.name,
            type: 'withdrawn',
            withdrawalDate: entry.effectiveDate,
            pendingItems,
          });
        }
      });

      const consultationCompleteRate = totalConsultationItems > 0
        ? Math.round((completedConsultationItems / totalConsultationItems) * 100)
        : 100;

      // 6. 월별 통계
      const monthlyMap = new Map<string, { withdrawn: number; subjectEnded: number }>();

      // 최근 12개월 초기화
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(monthKey, { withdrawn: 0, subjectEnded: 0 });
      }

      entries.forEach(entry => {
        const monthKey = entry.effectiveDate.substring(0, 7);
        const existing = monthlyMap.get(monthKey);
        if (existing) {
          if (entry.type === 'withdrawn') {
            existing.withdrawn++;
          } else {
            existing.subjectEnded++;
          }
        }
      });

      const monthlyStats: MonthlyWithdrawalStat[] = Array.from(monthlyMap.entries())
        .map(([month, counts]) => ({
          month,
          monthLabel: `${parseInt(month.split('-')[1])}월`,
          withdrawnCount: counts.withdrawn,
          subjectEndedCount: counts.subjectEnded,
          total: counts.withdrawn + counts.subjectEnded,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // 7. 퇴원 사유별 통계
      const reasonMap = new Map<string, number>();
      withdrawnEntries.forEach(entry => {
        const reason = entry.student.withdrawalReason || 'other';
        reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
      });

      const totalWithdrawn = withdrawnEntries.length;
      const reasonStats: WithdrawalReasonStat[] = Array.from(reasonMap.entries())
        .map(([reason, count]) => ({
          reason,
          label: WITHDRAWAL_REASON_LABEL[reason] || reason,
          count,
          percentage: totalWithdrawn > 0 ? Math.round((count / totalWithdrawn) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // 8. 과목별 통계
      const subjectMap = new Map<string, number>();
      entries.forEach(entry => {
        entry.endedSubjects.forEach(subject => {
          subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
        });
      });

      const totalSubjectEntries = Array.from(subjectMap.values()).reduce((a, b) => a + b, 0);
      const subjectStats: SubjectWithdrawalStat[] = Array.from(subjectMap.entries())
        .map(([subject, count]) => ({
          subject,
          label: SUBJECT_LABEL[subject] || subject,
          count,
          percentage: totalSubjectEntries > 0 ? Math.round((count / totalSubjectEntries) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // 9. 강사별 통계
      const staffMap = new Map<string, { name: string; math: number; english: number }>();

      // staff 목록으로 초기화
      (staff || []).filter(s => s.role === 'teacher' || s.role === '강사').forEach(member => {
        staffMap.set(member.id, { name: member.name, math: 0, english: 0 });
      });

      entries.forEach(entry => {
        entry.endedEnrollments.forEach(enrollment => {
          if (enrollment.staffId) {
            const existing = staffMap.get(enrollment.staffId);
            if (existing) {
              const subj = enrollment.subject as string;
              if (subj === 'math' || subj === '수학') {
                existing.math++;
              } else if (subj === 'english' || subj === '영어') {
                existing.english++;
              }
            }
          }
        });
      });

      const staffStats: StaffWithdrawalStat[] = Array.from(staffMap.entries())
        .map(([staffId, data]) => ({
          staffId,
          staffName: data.name,
          mathCount: data.math,
          englishCount: data.english,
          totalCount: data.math + data.english,
        }))
        .filter(s => s.totalCount > 0)
        .sort((a, b) => b.totalCount - a.totalCount);

      return {
        totalWithdrawals: entries.length,
        thisMonthWithdrawals,
        withdrawnCount: withdrawnEntries.length,
        subjectEndedCount: subjectEndedEntries.length,
        consultationCompleteRate,
        incompleteConsultations,
        monthlyStats,
        reasonStats,
        subjectStats,
        staffStats,
      };
    },
    staleTime: 1000 * 60 * 5, // 5분 캐싱
    gcTime: 1000 * 60 * 10, // 10분 GC
    refetchOnWindowFocus: false,
  });

  const error = queryError ? (queryError as Error).message : null;

  return {
    stats: data || {
      totalWithdrawals: 0,
      thisMonthWithdrawals: 0,
      withdrawnCount: 0,
      subjectEndedCount: 0,
      consultationCompleteRate: 100,
      incompleteConsultations: [],
      monthlyStats: [],
      reasonStats: [],
      subjectStats: [],
      staffStats: [],
    },
    loading: isLoading,
    error,
    refetch,
  };
}
