import React, { Suspense, lazy, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserProfile, StaffMember, KPICardData } from '../../../types';
import DashboardHeader from '../DashboardHeader';
import KPICard from '../KPICard';
import QuickActions, { QuickAction } from '../QuickActions';
import { useStudents } from '../../../hooks/useStudents';
import { useDailyAttendanceByDate, useDailyAttendanceByRange } from '../../../hooks/useDailyAttendance';
import { useTodayAttendanceFromRecords } from '../../../hooks/useTodayAttendanceFromRecords';
import { useWeeklyAttendanceFromRecords } from '../../../hooks/useWeeklyAttendanceFromRecords';
import { useConsultationStats } from '../../../hooks/useConsultationStats';
import { useBilling } from '../../../hooks/useBilling';
import { useStaff } from '../../../hooks/useStaff';
import { useFollowUpConsultations, getFollowUpUrgency, getFollowUpDaysLeft } from '../../../hooks/useStudentConsultations';
import { useClasses } from '../../../hooks/useClasses';
import { useSubjectClassStudents } from '../../../hooks/useSubjectClassStudents';
import { useRecentExams } from '../../../hooks/useExams';
import { useConsultations, isRegisteredStatus } from '../../../hooks/useConsultations';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { UserPlus, MessageCircle, BookOpen, TrendingUp, TrendingDown } from 'lucide-react';
import { SUBJECT_COLORS } from '../../../utils/styleUtils';
import { getTodayKST } from '../../../utils/dateUtils';
import { isActiveEnrollment as isActiveEnrollmentShared } from '../../../utils/dashboardUtils';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceDot, Label, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, LabelList } from 'recharts';

const AddStudentModal = lazy(() => import('../../StudentManagement/AddStudentModal'));
const AddClassModal = lazy(() => import('../../ClassManagement/AddClassModal'));
const AddConsultationModal = lazy(() => import('../../StudentConsultation/AddConsultationModal'));
const BillingDetailsModal = lazy(() => import('../modals/BillingDetailsModal'));
const ConsultationDetailsModal = lazy(() => import('../modals/ConsultationDetailsModal'));
const NewStudentsModal = lazy(() => import('../modals/NewStudentsModal'));
const NetChangeDetailsModal = lazy(() => import('../modals/NetChangeDetailsModal'));
const WeeklyAttendanceDetailsModal = lazy(() => import('../modals/WeeklyAttendanceDetailsModal'));
const TodayAttendanceDetailsModal = lazy(() => import('../modals/TodayAttendanceDetailsModal'));

interface MasterDashboardProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 30일 KST 날짜 문자열 시퀀스 (yyyy-mm-dd, 오래된 것 → 최신)
 */
function buildDateStringSequence(endDateStr: string, days: number = 30): string[] {
  const result: string[] = [];
  const base = new Date(`${endDateStr}T00:00:00+09:00`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    result.push(`${y}-${m}-${day}`);
  }
  return result;
}

/**
 * 학생/enrollment startDate-withdrawalDate 윈도우 기반으로
 * 일자별 active 재원생 수 계산 (수학/영어/2과목).
 */
function buildActiveTrend(
  students: any[],
  subject: 'math' | 'english' | 'multi2',
  endDateStr: string,
  days: number = 30
): { day: number; value: number }[] {
  const dates = buildDateStringSequence(endDateStr, days);
  return dates.map((dStr, idx) => {
    let count = 0;
    students.forEach(s => {
      if (!s.startDate || s.startDate > dStr) return;
      const wd = s.withdrawalDate || s.endDate;
      if (wd && wd <= dStr) return;
      const enrollments = s.enrollments || [];
      const hasSub = (sub: string) => enrollments.some((e: any) => {
        if (e.subject !== sub) return false;
        const eStart = e.enrollmentDate || s.startDate;
        if (eStart > dStr) return false;
        if (e.withdrawalDate && e.withdrawalDate <= dStr) return false;
        return true;
      });
      const hasMath = hasSub('math');
      const hasEng = hasSub('english');
      if (subject === 'math' && hasMath) count++;
      else if (subject === 'english' && hasEng) count++;
      else if (subject === 'multi2' && hasMath && hasEng) count++;
    });
    return { day: idx, value: count };
  });
}

/**
 * 슬라이딩 30일 윈도우 누적 신입/퇴원 카운트.
 * 각 일자 d 에서 [d - windowDays + 1, d] 동안 startDate/withdrawalDate가 있는 학생 수.
 * 매일 윈도우가 한 칸씩 이동하므로 변동이 시각적으로 풍성.
 */
function buildSlidingWindowTrend(
  students: any[],
  type: 'newMath' | 'newEnglish' | 'withdrawnMath' | 'withdrawnEnglish',
  endDateStr: string,
  days: number = 30,
  windowDays: number = 30
): { day: number; value: number }[] {
  const dates = buildDateStringSequence(endDateStr, days);
  const subject = (type === 'newMath' || type === 'withdrawnMath') ? 'math' : 'english';
  const isNew = type === 'newMath' || type === 'newEnglish';
  return dates.map((dStr, idx) => {
    const dDate = new Date(`${dStr}T00:00:00+09:00`);
    const wStart = new Date(dDate);
    wStart.setDate(wStart.getDate() - windowDays + 1);
    const y = wStart.getFullYear();
    const m = String(wStart.getMonth() + 1).padStart(2, '0');
    const day = String(wStart.getDate()).padStart(2, '0');
    const wStartStr = `${y}-${m}-${day}`;
    let count = 0;
    students.forEach(s => {
      if (isNew) {
        if (!s.startDate || s.startDate < wStartStr || s.startDate > dStr) return;
        const hasSub = (s.enrollments || []).some((e: any) => e.subject === subject);
        if (hasSub) count++;
      } else {
        if (s.status !== 'withdrawn' || !s.withdrawalDate) return;
        if (s.withdrawalDate < wStartStr || s.withdrawalDate > dStr) return;
        const hasSub = (s.enrollments || []).some((e: any) => e.subject === subject);
        if (hasSub) count++;
      }
    });
    return { day: idx, value: count };
  });
}

const MasterDashboard: React.FC<MasterDashboardProps> = ({ userProfile, staffMember }) => {
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);

  // ── 기본 날짜 ──
  const currentMonth = useMemo(() => new Date(), []);
  const currentMonthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const currentMonthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const today = getTodayKST();
  const currentMonthFormatted = format(currentMonthStart, 'yyyy-MM');
  const currentYear = currentMonth.getFullYear();
  const currentMonthNum = String(currentMonth.getMonth() + 1);

  // ── 데이터 로딩 ──
  const { students = [], loading: studentsLoading } = useStudents(true); // 퇴원생 포함
  const { data: todayAttendance = [], isLoading: attendanceLoading } = useDailyAttendanceByDate(today);
  // Fallback: daily_attendance 가 비어있으면 출석부(attendance_records) 의 오늘 셀로 KPI 계산
  const { data: todayAttendanceFallback } = useTodayAttendanceFromRecords(today);
  const { records: billingRecords = [], isLoading: billingLoading } = useBilling(currentMonthFormatted);
  const { staff } = useStaff();
  const { data: allClasses = [] } = useClasses();
  const { consultations: followUpList = [] } = useFollowUpConsultations();
  const { data: recentExams = [] } = useRecentExams(5);
  const { data: regConsultations = [] } = useConsultations({ month: currentMonthNum, year: currentYear });

  // 주간 출석 — KST 기준 오늘부터 역산
  const last7Days = useMemo(() => {
    const days: string[] = [];
    const todayKst = getTodayKST();
    // YYYY-MM-DD → Date(UTC midnight) 안전 변환 후 일자 역산
    const baseDate = new Date(`${todayKst}T00:00:00+09:00`);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      // KST 자정 기준이므로 ISO 날짜 직접 추출 (toISOString은 UTC 변환 위험)
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${day}`);
    }
    return days;
  }, []);
  const { data: weeklyAttendanceRange = {}, isLoading: weeklyAttendanceLoading } = useDailyAttendanceByRange(last7Days[0], last7Days[6]);
  const weeklyAttendanceData = useMemo(() => last7Days.map(d => weeklyAttendanceRange[d] || []), [last7Days, weeklyAttendanceRange]);
  // daily_attendance fallback: attendance_records 셀 집계 (셀이 있는 날짜만 보충)
  const { data: weeklyFromRecords = {} } = useWeeklyAttendanceFromRecords(last7Days);

  // 상담 통계
  const consultationStatsResult = useConsultationStats(
    { dateRange: { start: format(currentMonthStart, 'yyyy-MM-dd'), end: format(currentMonthEnd, 'yyyy-MM-dd') }, subject: 'all' },
    staff
  );
  const stats = consultationStatsResult.stats;
  const consultationLoading = consultationStatsResult.loading;

  // ── studentMap (시간표 hook 호출용) ──
  const studentMap = useMemo(() => {
    const map: Record<string, any> = {};
    students.forEach(s => { map[s.id] = s; });
    return map;
  }, [students]);

  // ── 영어/수학 시간표 hook 직접 호출 — 시간표 헤더와 동일 카운트 보장 ──
  const englishClassNames = useMemo(() =>
    allClasses.filter((c: any) => c.subject === 'english').map((c: any) => c.className).filter(Boolean),
    [allClasses]);
  const mathClassNames = useMemo(() =>
    allClasses.filter((c: any) => c.subject === 'math').map((c: any) => c.className).filter(Boolean),
    [allClasses]);
  const englishClassData = useSubjectClassStudents({ subject: 'english', classNames: englishClassNames, studentMap, referenceDate: today });
  const mathClassData = useSubjectClassStudents({ subject: 'math', classNames: mathClassNames, studentMap, referenceDate: today });

  // useEnglishStats / TimetableHeader 와 동일 카운트 로직 — studentBestData dedup + active 체크
  const countActiveBySubject = (classDataMap: Record<string, any>): { active: number; activeIds: Set<string> } => {
    const studentBestData = new Map<string, any>();
    Object.values(classDataMap || {}).forEach((cd: any) => {
      cd.studentList?.forEach((student: any) => {
        const existing = studentBestData.get(student.id);
        if (!existing) { studentBestData.set(student.id, student); return; }
        const isActive = (s: any) => !s.withdrawalDate && !s.onHold;
        if (isActive(student) && !isActive(existing)) studentBestData.set(student.id, student);
      });
    });
    const activeIds = new Set<string>();
    studentBestData.forEach((student, studentId) => {
      if (student.withdrawalDate) return;
      if (student.onHold) return;
      const baseStatus = studentMap[studentId]?.status;
      if (baseStatus !== 'active') return;
      activeIds.add(studentId);
    });
    return { active: activeIds.size, activeIds };
  };

  const mathCountResult = useMemo(() => countActiveBySubject(mathClassData?.classDataMap || {}), [mathClassData, studentMap]);
  const englishCountResult = useMemo(() => countActiveBySubject(englishClassData?.classDataMap || {}), [englishClassData, studentMap]);
  const mathActiveCount = mathCountResult.active;
  const englishActiveCount = englishCountResult.active;
  // 2과목 수강 = 수학+영어 둘 다 active
  const multi2Count = useMemo(() => {
    let count = 0;
    mathCountResult.activeIds.forEach(id => { if (englishCountResult.activeIds.has(id)) count++; });
    return count;
  }, [mathCountResult, englishCountResult]);

  // ── 헬퍼 ──
  // 사용자 결정(2026-05-15): 시간표 헤더 기준과 동일하게 카운트.
  // 공통 유틸로 추출 (utils/dashboardUtils.ts) — 모달과 기준 통일.
  const isActiveEnrollment = (e: any) => isActiveEnrollmentShared(e, today);

  // ── 재원생 ──
  const activeStudents = useMemo(() =>
    students.filter(s => s.status === 'active' && s.enrollments?.some(isActiveEnrollment)).length
  , [students]);

  // ── 출석 통계 (옵션 B: daily_attendance 우선, 비어있으면 attendance_records fallback) ──
  const { presentCount, totalCount, attendanceRate, attendanceSource } = useMemo(() => {
    const dailyPresent = todayAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const dailyTotal = todayAttendance.length;
    if (dailyTotal > 0) {
      return {
        presentCount: dailyPresent,
        totalCount: dailyTotal,
        attendanceRate: Math.round((dailyPresent / dailyTotal) * 100),
        attendanceSource: 'daily_attendance' as const,
      };
    }
    // Fallback: 출석부 attendance_records 의 오늘 셀
    const fb = todayAttendanceFallback;
    if (fb && fb.totalCount > 0) {
      return {
        presentCount: fb.presentCount,
        totalCount: fb.totalCount,
        attendanceRate: fb.rate,
        attendanceSource: 'attendance_records' as const,
      };
    }
    return { presentCount: 0, totalCount: 0, attendanceRate: 0, attendanceSource: 'none' as const };
  }, [todayAttendance, todayAttendanceFallback]);

  // ── 상담 완료율 ──
  const { totalSubjectEnrollments, consultedSubjectCount, consultationRate } = useMemo(() => {
    const total = stats?.totalSubjectEnrollments || 0;
    const needing = stats?.studentsNeedingConsultation?.length || 0;
    const consulted = Math.max(0, total - needing);
    return { totalSubjectEnrollments: total, consultedSubjectCount: consulted, consultationRate: total > 0 ? Math.round((consulted / total) * 100) : 0 };
  }, [stats]);

  // ── 수납 통계 ──
  const { totalBilled, totalPaid, pendingCount, billingRate, unpaidRecords } = useMemo(() => {
    let billed = 0, paid = 0, pending = 0;
    const unpaid: typeof billingRecords = [];
    for (const r of billingRecords) {
      billed += r.billedAmount;
      paid += r.paidAmount;
      if (r.status === 'pending') { pending++; unpaid.push(r); }
    }
    unpaid.sort((a, b) => (b.unpaidAmount || 0) - (a.unpaidAmount || 0));
    return { totalBilled: billed, totalPaid: paid, pendingCount: pending, billingRate: billed > 0 ? Math.round((paid / billed) * 100) : 0, unpaidRecords: unpaid };
  }, [billingRecords]);

  // ── 신입생 (이번 달 등록 + 수강과목 1개 이상) ──
  const newStudentsThisMonth = useMemo(() =>
    students.filter(s => {
      if (!s.startDate) return false;
      const d = new Date(s.startDate);
      if (d < currentMonthStart || d > currentMonthEnd) return false;
      // 수강과목 유무: active enrollment 가 1개 이상 있어야 신입생으로 카운트
      const activeEnrolls = (s.enrollments || []).filter((e: any) => isActiveEnrollmentShared(e));
      return activeEnrolls.length > 0;
    }).length
  , [students, currentMonthStart, currentMonthEnd]);

  // ── 퇴원 현황 (이번 달) ──
  const withdrawalData = useMemo(() => {
    const withdrawn = students.filter(s => {
      if (s.status !== 'withdrawn' || !s.withdrawalDate) return false;
      const d = new Date(s.withdrawalDate);
      return d >= currentMonthStart && d <= currentMonthEnd;
    });
    const WITHDRAWAL_REASON_LABELS: Record<string, string> = {
      graduation: '졸업', relocation: '이사', competitor: '경쟁 학원 이동',
      financial: '경제적 사유', schedule: '시간 조절 어려움', dissatisfied: '불만족', other: '기타',
    };
    const reasons: Record<string, number> = {};
    withdrawn.forEach(s => {
      const raw = s.withdrawalReason || '사유 미기재';
      const reason = WITHDRAWAL_REASON_LABELS[raw] || raw;
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return {
      count: withdrawn.length,
      netChange: newStudentsThisMonth - withdrawn.length,
      reasons: Object.entries(reasons).sort(([, a], [, b]) => b - a),
    };
  }, [students, currentMonthStart, currentMonthEnd, newStudentsThisMonth]);

  // ── 과목별 분포 ──
  // 사용자 결정(2026-05-15): 수학 시간표 헤더와 동일하게 'math' subject 만 카운트
  // (highmath 는 별도 / '수학' = 수학 시간표 = math 만). 영어도 시간표 헤더와 동일.
  // 2과목 판정은 normalized (math+highmath = 1과목) — 수학·고등수학 동시 수강은 1과목.
  const subjectDistribution = useMemo(() => {
    const activeList = students.filter(s => s.status === 'active');
    const subjectCounts = { math: 0, english: 0, korean: 0, science: 0, other: 0 };
    const multiSubjectCounts: Record<number, number> = {};
    const normalizeSubject = (sub: string) => sub === 'highmath' ? 'math' : sub;
    activeList.forEach(s => {
      const active = s.enrollments?.filter(isActiveEnrollment) || [];
      // raw subject 카운트 (수학 라벨 = math 만)
      const rawUnique = new Set(active.map(e => e.subject));
      rawUnique.forEach(sub => { if (sub in subjectCounts) subjectCounts[sub as keyof typeof subjectCounts]++; });
      // 2과목 판정만 normalized
      const normalizedUnique = new Set(active.map(e => normalizeSubject(e.subject)));
      if (normalizedUnique.size >= 2) multiSubjectCounts[normalizedUnique.size] = (multiSubjectCounts[normalizedUnique.size] || 0) + 1;
    });
    const result = [
      { subject: '수학', count: subjectCounts.math, color: SUBJECT_COLORS.math.bg },
      { subject: '영어', count: subjectCounts.english, color: SUBJECT_COLORS.english.bg },
      { subject: '국어', count: subjectCounts.korean, color: SUBJECT_COLORS.korean.bg },
      { subject: '과학', count: subjectCounts.science, color: SUBJECT_COLORS.science.bg },
      { subject: '기타', count: subjectCounts.other, color: SUBJECT_COLORS.other.bg },
    ].filter(i => i.count > 0);
    const multiColors = ['#ec4899', '#f97316', '#14b8a6', '#a855f7'];
    Object.entries(multiSubjectCounts).sort(([a], [b]) => Number(a) - Number(b)).forEach(([sc, cnt], idx) => {
      result.push({ subject: `${sc}과목 수강`, count: cnt, color: multiColors[idx % multiColors.length] });
    });
    return result;
  }, [students]);

  // 1단계 디자인: 주식 차트 스타일 카드용 데이터.
  // 사용자 결정(2026-05-15): 색상 영어=빨강, 수학=초록, 2과목=노랑, 신입=파랑, 퇴원=주황.
  const COLOR_MAP: Record<string, string> = {
    '수학': '#22c55e',
    '영어': '#ef4444',
    '2과목 수강': '#eab308',
    '신입': '#3b82f6',
    '퇴원': '#f97316',
  };
  const trendCards = useMemo(() => {
    // 사용자 결정(2026-05-15): subjectDistribution 대신 시간표 hook 결과로 카운트
    // (시간표 헤더와 정확히 일치 — 수학 226, 영어 296 등).
    const cards: { key: string; label: string; count: number; color: string; trend: { day: number; value: number }[] }[] = [];
    cards.push({ key: 'math', label: '수학', count: mathActiveCount, color: COLOR_MAP['수학'], trend: buildActiveTrend(students, 'math', today) });
    cards.push({ key: 'english', label: '영어', count: englishActiveCount, color: COLOR_MAP['영어'], trend: buildActiveTrend(students, 'english', today) });
    cards.push({ key: 'multi2', label: '2과목 수강', count: multi2Count, color: COLOR_MAP['2과목 수강'], trend: buildActiveTrend(students, 'multi2', today) });
    return cards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mathActiveCount, englishActiveCount, multi2Count, students, today]);

  // 이번 달 신입생/퇴원 — 과목별 (수학 math 만 / 영어)
  // 신입생 = 이번 달 학원 등록 + active 수강과목 1개 이상 (status 무관)
  const enrollmentBySubject = useMemo(() => {
    let mathNew = 0, englishNew = 0, mathWithdrawn = 0, englishWithdrawn = 0;
    students.forEach(s => {
      const activeEnrolls = (s.enrollments || []).filter((e: any) => isActiveEnrollmentShared(e));
      const hasActiveSubject = (sub: string) => activeEnrolls.some((e: any) => e.subject === sub);
      const hasAnyActive = activeEnrolls.length > 0;
      // 신입생: 이번 달 startDate + active 수강과목 1개 이상
      if (hasAnyActive && s.startDate) {
        const sd = new Date(s.startDate);
        if (sd >= currentMonthStart && sd <= currentMonthEnd) {
          if (hasActiveSubject('math')) mathNew++;
          if (hasActiveSubject('english')) englishNew++;
        }
      }
      // 퇴원 = status='withdrawn' + 이번 달 퇴원 (기존 그대로)
      const hasSubject = (sub: string) => s.enrollments?.some((e: any) => e.subject === sub) ?? false;
      if (s.status === 'withdrawn' && s.withdrawalDate) {
        const wd = new Date(s.withdrawalDate);
        if (wd >= currentMonthStart && wd <= currentMonthEnd) {
          if (hasSubject('math')) mathWithdrawn++;
          if (hasSubject('english')) englishWithdrawn++;
        }
      }
    });
    return { mathNew, englishNew, mathWithdrawn, englishWithdrawn };
  }, [students, currentMonthStart, currentMonthEnd]);

  // 신입 박스 (수학/영어 2라인) — 영어는 점선으로 표시 (겹침 방지)
  // sparkline: 슬라이딩 30일 누적 (매일 윈도우가 한 칸씩 이동 → 시각적 변동 풍성)
  const newCards = useMemo(() => [
    { key: 'mathNew', label: '수학 신입', count: enrollmentBySubject.mathNew, color: COLOR_MAP['수학'], trend: buildSlidingWindowTrend(students, 'newMath', today) },
    { key: 'englishNew', label: '영어 신입', count: enrollmentBySubject.englishNew, color: COLOR_MAP['영어'], trend: buildSlidingWindowTrend(students, 'newEnglish', today), dashed: true },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [enrollmentBySubject.mathNew, enrollmentBySubject.englishNew, students, today]);

  // 퇴원 박스 (수학/영어 2라인) — 영어는 점선으로 표시 (겹침 방지)
  const withdrawnCards = useMemo(() => [
    { key: 'mathWithdrawn', label: '수학 퇴원', count: enrollmentBySubject.mathWithdrawn, color: COLOR_MAP['수학'], trend: buildSlidingWindowTrend(students, 'withdrawnMath', today) },
    { key: 'englishWithdrawn', label: '영어 퇴원', count: enrollmentBySubject.englishWithdrawn, color: COLOR_MAP['영어'], trend: buildSlidingWindowTrend(students, 'withdrawnEnglish', today), dashed: true },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [enrollmentBySubject.mathWithdrawn, enrollmentBySubject.englishWithdrawn, students, today]);

  // 통합 차트 데이터 헬퍼 — cards 배열을 받아 { day, [key1]: v1, [key2]: v2, ... } row 들로
  const makeCombined = (cards: typeof trendCards) => {
    if (cards.length === 0) return [];
    const days = cards[0].trend.length;
    return Array.from({ length: days }, (_, i) => {
      const point: Record<string, number> = { day: i };
      cards.forEach(c => { point[c.key] = c.trend[i]?.value ?? 0; });
      return point;
    });
  };
  const combinedTrend = useMemo(() => makeCombined(trendCards), [trendCards]);
  const newCombined = useMemo(() => makeCombined(newCards), [newCards]);
  const withdrawnCombined = useMemo(() => makeCombined(withdrawnCards), [withdrawnCards]);

  // 통합 추이 차트 카드 렌더러 — 재원생/과목 박스, 신입/퇴원 박스 동일 디자인.
  // - 꺾은선(linear), 최고/최저/오늘 마커 + 라벨
  // - 호버 시 최고/최저 텍스트 툴팁
  // - 범례 하단 중앙정렬
  const renderTrendCard = (opts: {
    title: string;
    totalUnit: string;
    total: number;
    totalDelta: number;
    cards: typeof trendCards;
    combined: Record<string, number>[];
  }) => {
    const { title, totalUnit, total, totalDelta, cards, combined } = opts;
    const totalIsUp = totalDelta >= 0;
    return (
      <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col h-full">
        {/* 헤더: 타이틀 + 총 카운트 + 변동 */}
        <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-gray-100 gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-semibold text-black">{title}</h3>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl sm:text-3xl font-bold text-black">{total}</span>
              <span className="text-sm text-black">{totalUnit}</span>
            </div>
            {totalDelta !== 0 && (
              <div className={`flex items-center gap-0.5 text-sm font-bold ${totalIsUp ? 'text-emerald-600' : 'text-red-500'}`}>
                <TrendingUp size={14} />
                <span>{totalIsUp ? '+' : ''}{totalDelta}</span>
              </div>
            )}
          </div>
        </div>

        {/* 차트 (꺾은선 + 마커) */}
        <div className="flex-1" style={{ minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={combined} margin={{ top: 18, right: 24, left: 4, bottom: 0 }}>
              <defs>
                {cards.map(c => (
                  <linearGradient key={`grad-${c.key}`} id={`grad-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              {/* 각 시리즈별 별도 Y축(hide) — 자체 스케일로 변동을 크게 시각화 */}
              {cards.map(c => (
                <YAxis key={`yaxis-${c.key}`} yAxisId={c.key} hide domain={['dataMin - 1', 'dataMax + 1']} />
              ))}
              <Tooltip
                cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="bg-white border border-gray-200 rounded shadow text-xs p-2 space-y-0.5">
                      <div className="font-bold text-black">D-{combined.length - 1 - (label as number)}</div>
                      {cards.map(c => {
                        const series = c.trend.map(p => p.value);
                        const max = Math.max(...series);
                        const min = Math.min(...series);
                        const val = payload.find((p: any) => p.dataKey === c.key)?.value;
                        return (
                          <div key={c.key} className="flex items-center gap-1.5 text-xxs">
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                            <span className="text-black">{c.label}:</span>
                            <span className="font-bold">{val}명</span>
                            <span className="text-black ml-1">↑{max}(최고) ↓{min}(최저)</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              {cards.map(card => {
                const series = card.trend.map(p => p.value);
                const max = Math.max(...series);
                const min = Math.min(...series);
                const maxIdx = series.indexOf(max);
                const minIdx = series.indexOf(min);
                const todayIdx = series.length - 1;
                const todayVal = series[todayIdx];
                return (
                  <React.Fragment key={card.key}>
                    <Area
                      yAxisId={card.key}
                      type="linear"
                      dataKey={card.key}
                      name={card.label}
                      stroke={card.color}
                      strokeWidth={1.5}
                      strokeDasharray={(card as any).dashed ? '4 4' : undefined}
                      fill={`url(#grad-${card.key})`}
                      dot={(props: any) => {
                        const i = props.index;
                        if (i === maxIdx || i === minIdx || i === todayIdx) {
                          return <circle key={`${card.key}-${i}`} cx={props.cx} cy={props.cy} r={3.5} fill={card.color} stroke="white" strokeWidth={2} />;
                        }
                        return <g key={`${card.key}-${i}`} />;
                      }}
                      activeDot={{ r: 5, fill: card.color, stroke: 'white', strokeWidth: 2 }}
                      isAnimationActive
                      animationDuration={700}
                      animationEasing="ease-in-out"
                    />
                    <ReferenceDot yAxisId={card.key} x={maxIdx} y={max} r={0} ifOverflow="extendDomain">
                      <Label value={`${max}↑`} position="top" fontSize={9} fill={card.color} />
                    </ReferenceDot>
                    <ReferenceDot yAxisId={card.key} x={minIdx} y={min} r={0} ifOverflow="extendDomain">
                      <Label value={`${min}↓`} position="bottom" fontSize={9} fill={card.color} />
                    </ReferenceDot>
                    {todayIdx !== maxIdx && todayIdx !== minIdx && (
                      <ReferenceDot yAxisId={card.key} x={todayIdx} y={todayVal} r={0} ifOverflow="extendDomain">
                        <Label value={`${todayVal}`} position="right" fontSize={9} fill={card.color} />
                      </ReferenceDot>
                    )}
                  </React.Fragment>
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 범례 (하단 중앙) — 라벨 + 카운트 + 지난달 최고 대비 변동 */}
        <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-gray-100 flex-wrap">
          {cards.map(card => {
            const series = card.trend.map(p => p.value);
            const max = Math.max(...series);
            const delta = card.count - max;
            const isUp = delta >= 0;
            return (
              <div key={card.key} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                <span className="text-xxs font-bold text-black">{card.label}</span>
                <span className="text-xxs font-bold" style={{ color: card.color }}>{card.count}</span>
                <span className={`text-micro font-bold ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>{isUp ? '+' : ''}{delta}</span>
              </div>
            );
          })}
        </div>
        <div className="text-micro text-black text-right mt-0.5">최근 30일 추이 (지난달 최고 대비)</div>
      </div>
    );
  };

  // ── 주간 출석 추이 ──
  // 옵션 B: daily_attendance 가 있으면 우선, 비어있는 날만 attendance_records 셀 집계로 보충
  const weeklyAttendance = useMemo(() => {
    return last7Days.map((dateStr, idx) => {
      // KST 날짜 문자열을 KST 자정 Date로 변환 (요일 라벨 추출용)
      const date = new Date(`${dateStr}T00:00:00+09:00`);
      const dayLabel = DAY_NAMES_KO[date.getDay()];
      const dailyData = weeklyAttendanceData[idx] || [];
      // 1순위: daily_attendance
      if (dailyData.length > 0) {
        const present = dailyData.filter(a => a.status === 'present' || a.status === 'late').length;
        const total = dailyData.length;
        return { day: dayLabel, rate: total > 0 ? Math.round((present / total) * 100) : 0, source: 'daily' as const };
      }
      // 2순위: attendance_records 셀 집계
      const recSummary = weeklyFromRecords[dateStr];
      if (recSummary && recSummary.totalCount > 0) {
        return { day: dayLabel, rate: recSummary.rate, source: 'records' as const };
      }
      return { day: dayLabel, rate: 0, source: 'empty' as const };
    });
  }, [last7Days, weeklyAttendanceData, weeklyFromRecords]);

  // ── 오늘의 수업 현황 ──
  const todayClasses = useMemo(() => {
    const todayDay = DAY_NAMES_KO[new Date().getDay()];
    const recordedClassIds = new Set(todayAttendance.map(a => a.classId));
    return allClasses
      .filter(c => c.schedule?.some(slot => slot.startsWith(todayDay)))
      .map(c => ({
        ...c,
        todaySlots: c.schedule?.filter(slot => slot.startsWith(todayDay)) || [],
        isRecorded: recordedClassIds.has(c.id),
      }))
      .sort((a, b) => {
        const slotA = a.todaySlots[0] || '';
        const slotB = b.todaySlots[0] || '';
        return slotA.localeCompare(slotB);
      });
  }, [allClasses, todayAttendance]);

  // ── 상담 후속조치 ──
  const followUpData = useMemo(() => {
    const urgent = followUpList.filter(c => getFollowUpUrgency(c) === 'urgent');
    const pending = followUpList.filter(c => getFollowUpUrgency(c) === 'pending');
    return { urgent, pending, total: followUpList.length };
  }, [followUpList]);

  // ── 등록 상담 전환율 ──
  const regConversionData = useMemo(() => {
    const total = regConsultations?.length || 0;
    const registered = regConsultations?.filter(c => isRegisteredStatus(c.status)).length || 0;
    const rate = total > 0 ? Math.round((registered / total) * 100) : 0;
    return { total, registered, rate };
  }, [regConsultations]);

  // ── 최근 시험 ──
  const recentExamList = useMemo(() => {
    return (recentExams || []).slice(0, 5).map(exam => ({
      title: exam.title,
      date: exam.date,
      subject: exam.subject === 'math' ? '수학' : exam.subject === 'english' ? '영어' : '공통',
      type: exam.type,
    }));
  }, [recentExams]);

  // ── KPI 카드 ──
  // 재원생 카드는 통합 추이 차트 헤더에 이미 표시되므로 중복 제거 (사용자 결정 2026-05-15).
  const kpiCards: KPICardData[] = [
    {
      id: 'attendance', label: '오늘 출석률', value: `${attendanceRate}%`,
      subValue: `${presentCount}/${totalCount}`,
      trend: attendanceRate >= 90 ? 'up' : attendanceRate >= 80 ? 'stable' : 'down',
      color: '#0f766e',
      description: '오늘 (출석+지각) / 오늘 전체 출결 기록 — daily_attendance 우선, 비어있으면 attendance_records 셀로 fallback. 클릭 시 날짜별 검증 가능.',
    },
    {
      id: 'consultation', label: '상담 완료율', value: `${consultationRate}%`,
      subValue: `${consultedSubjectCount}건 완료 / 총 ${totalSubjectEnrollments}건`,
      trend: consultationRate >= 85 ? 'up' : 'stable',
      color: '#1e40af',
      description: '이번 달 상담 완료 (학생×과목 단위) / 이번 달 활성 수강과목 전체. 클릭 시 강사별 상세 + 상담 필요 학생 명단.',
    },
    {
      id: 'billing', label: '수납률', value: `${billingRate}%`,
      subValue: `${totalPaid.toLocaleString()}/${totalBilled.toLocaleString()}원`,
      trend: billingRate >= 90 ? 'up' : billingRate >= 80 ? 'stable' : 'down',
      trendValue: pendingCount > 0 ? `미납 ${pendingCount}건` : undefined,
      color: '#0369a1',
      description: '이번 달 실제 수납액 / 청구액. 클릭 시 청구·미납 명단.',
    },
    {
      id: 'new-students', label: '신입생', value: newStudentsThisMonth,
      subValue: '이번 달', trend: newStudentsThisMonth > 0 ? 'up' : 'stable',
      color: '#0891b2',
      description: '이번 달 학원 등록(startDate) + 활성 수강과목 1개 이상인 학생. 클릭 시 주간/월간 페이지 + 학생 명단.',
    },
    {
      id: 'net-change', label: '순증감',
      value: `${withdrawalData.netChange >= 0 ? '+' : ''}${withdrawalData.netChange}`,
      subValue: `신입생 ${newStudentsThisMonth} / 퇴원 ${withdrawalData.count}`,
      trend: withdrawalData.netChange > 0 ? 'up' : withdrawalData.netChange < 0 ? 'down' : 'stable',
      color: '#475569',
      description: '학원 재원생 수의 순수 증감폭 = 신입생 - 퇴원.\n+면 학원이 커지는 중, -면 줄어드는 중, 0이면 변화 없음.\n클릭 시 주간/월간 페이지 + 신입생·퇴원 명단 한 화면에 표시.',
    },
  ];

  // ── 빠른 작업 ──
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddConsultationOpen, setIsAddConsultationOpen] = useState(false);
  // KPI 근거 데이터 모달
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false);
  const [isNewStudentsModalOpen, setIsNewStudentsModalOpen] = useState(false);
  const [isNetChangeModalOpen, setIsNetChangeModalOpen] = useState(false);
  const [isWeeklyAttendanceModalOpen, setIsWeeklyAttendanceModalOpen] = useState(false);
  const [isTodayAttendanceModalOpen, setIsTodayAttendanceModalOpen] = useState(false);

  const quickActions: QuickAction[] = [
    { id: 'add-student', label: '학생 추가', icon: UserPlus, onClick: () => setIsAddStudentOpen(true), color: 'rgb(8, 20, 41)' /* primary */ },
    { id: 'add-class', label: '수업 추가', icon: BookOpen, onClick: () => setIsAddClassOpen(true), color: '#10b981' },
    { id: 'add-consultation', label: '상담 기록', icon: MessageCircle, onClick: () => setIsAddConsultationOpen(true), color: '#6366f1' },
  ];

  const handleRefresh = () => {
    // 모든 React Query 캐시 invalidate → useStudents/useConsultations/useBilling 등 즉시 refetch
    queryClient.invalidateQueries();
    setRefreshKey(prev => prev + 1);
  };
  const isLoading = studentsLoading || attendanceLoading || weeklyAttendanceLoading || billingLoading || consultationLoading;

  // ── 과목 색상 ──
  const subjectColor = (sub: string) => {
    if (sub === '수학') return '#3b82f6';
    if (sub === '영어') return '#10b981';
    if (sub === '공통') return '#8b5cf6';
    return '#6b7280';
  };

  return (
    <div className="flex-1 min-w-0 w-full p-3 bg-gray-50 overflow-y-auto">
      <div className="max-w-[1800px] mx-auto min-w-0 [&_.grid>*]:min-w-0">
        <DashboardHeader userProfile={userProfile} staffMember={staffMember} onRefresh={handleRefresh} />

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-sm animate-spin" />
              <span className="text-sm text-black">데이터 로딩 중...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ── Row 1: 메인 KPI 3개 — 비대칭 4/5/3 (좁은 viewport는 1/3 col) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-12 gap-4 mb-5">
              <div className="lg:col-span-4 min-w-0">
                <KPICard data={kpiCards[0]} onClick={() => setIsTodayAttendanceModalOpen(true)} />
              </div>
              <div className="lg:col-span-5 min-w-0">
                <KPICard data={kpiCards[1]} onClick={() => setIsConsultationModalOpen(true)} />
              </div>
              <div className="lg:col-span-3 min-w-0">
                <KPICard data={kpiCards[2]} onClick={() => setIsBillingModalOpen(true)} />
              </div>
            </div>

            {/* ── 재원생(7) / 신입(3) / 퇴원(2) 추이 — 12-col 비대칭 ── */}
            {/* ── 재원생(크게) + 신입 + 퇴원 sparkline ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 mb-5">
              <div className="md:col-span-2 lg:col-span-7 min-w-0">
                {renderTrendCard({
                  title: '재원생',
                  totalUnit: '명',
                  total: activeStudents,
                  totalDelta: newStudentsThisMonth - withdrawalData.count,
                  cards: trendCards,
                  combined: combinedTrend,
                })}
              </div>
              <div className="lg:col-span-3 min-w-0">
                {renderTrendCard({
                  title: '신입생',
                  totalUnit: '명',
                  total: enrollmentBySubject.mathNew + enrollmentBySubject.englishNew,
                  totalDelta: enrollmentBySubject.mathNew + enrollmentBySubject.englishNew,
                  cards: newCards,
                  combined: newCombined,
                })}
              </div>
              <div className="lg:col-span-2 min-w-0">
                {renderTrendCard({
                  title: '퇴원',
                  totalUnit: '명',
                  total: enrollmentBySubject.mathWithdrawn + enrollmentBySubject.englishWithdrawn,
                  totalDelta: -(enrollmentBySubject.mathWithdrawn + enrollmentBySubject.englishWithdrawn),
                  cards: withdrawnCards,
                  combined: withdrawnCombined,
                })}
              </div>
            </div>

            {/* ── Row 3: 주간 출석(크게) + 주의 필요 — 비대칭 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5 [&>:first-child]:lg:col-span-2">
              {/* 주간 출석 추이 — 도넛만 (요일 라벨 없음) */}
              {(() => {
                const validDays = weeklyAttendance.filter(d => d.source !== 'empty');
                const avgRate = validDays.length === 0 ? 0 : Math.round(validDays.reduce((s, d) => s + d.rate, 0) / validDays.length);
                const colorByRate = (rate: number, isEmpty: boolean) => {
                  if (isEmpty) return '#e5e7eb';
                  if (rate >= 95) return '#0f766e';
                  if (rate >= 85) return '#14b8a6';
                  if (rate >= 70) return '#5eead4';
                  if (rate >= 50) return '#99f6e4';
                  return '#cbd5e1';
                };
                const slices = weeklyAttendance.map(d => ({
                  name: d.day,
                  value: 1,
                  rate: d.rate,
                  isEmpty: d.source === 'empty',
                  color: colorByRate(d.rate, d.source === 'empty'),
                }));
                return (
                  <div
                    className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md border border-gray-100 cursor-pointer hover:border-slate-300 transition-all"
                    onClick={() => setIsWeeklyAttendanceModalOpen(true)}
                  >
                    <h3 className="text-sm font-semibold text-black mb-3 flex items-center justify-between">
                      <span>주간 출석 추이</span>
                      <span className="text-[10px] text-black font-normal">클릭 시 요일별 상세 →</span>
                    </h3>
                    <div className="flex items-center justify-center" style={{ minHeight: 260 }}>
                      <div className="relative" style={{ width: 260, height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={slices}
                              dataKey="value"
                              nameKey="name"
                              innerRadius="58%"
                              outerRadius="82%"
                              startAngle={90}
                              endAngle={-270}
                              paddingAngle={2}
                              isAnimationActive
                              animationDuration={600}
                              labelLine={false}
                              label={(props: any) => {
                                const RADIAN = Math.PI / 180;
                                const radius = props.outerRadius + 12;
                                const x = props.cx + radius * Math.cos(-props.midAngle * RADIAN);
                                const y = props.cy + radius * Math.sin(-props.midAngle * RADIAN);
                                return (
                                  <text x={x} y={y} fill="#475569" fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="middle">
                                    {props.name}
                                  </text>
                                );
                              }}
                            >
                              {slices.map((s, i) => (
                                <Cell key={i} fill={s.color} stroke="none" />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }: any) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                return (
                                  <div className="bg-white border border-slate-200 rounded shadow text-xs p-2">
                                    <div className="font-semibold text-black">{d.name}요일</div>
                                    <div className={d.isEmpty ? 'text-black' : 'text-black font-bold'}>
                                      {d.isEmpty ? '데이터 없음' : `출석률 ${d.rate}%`}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-3xl font-bold text-black">{validDays.length === 0 ? '-' : `${avgRate}%`}</span>
                          <span className="text-[10px] text-black font-medium mt-0.5">주간 평균</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 주의 필요 */}
              <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <h3 className="text-sm font-semibold text-black mb-2">주의 필요</h3>
                <div className="space-y-1.5">
                  {pendingCount > 0 ? (
                    <div className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                      <span className="w-1 h-1 bg-red-600 rounded-sm flex-shrink-0" />
                      미납 {pendingCount}건 (총 {unpaidRecords.reduce((s, r) => s + (r.unpaidAmount || 0), 0).toLocaleString()}원)
                    </div>
                  ) : null}
                  {followUpData.urgent.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                      <span className="w-1 h-1 bg-red-600 rounded-sm flex-shrink-0" />
                      긴급 후속조치 {followUpData.urgent.length}건 (3일 이내)
                    </div>
                  ) : null}
                  {followUpData.pending.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-sm text-orange-600 font-medium">
                      <span className="w-1 h-1 bg-orange-600 rounded-sm flex-shrink-0" />
                      상담 후속조치 대기 {followUpData.pending.length}건
                    </div>
                  ) : null}
                  {stats?.studentsNeedingConsultation && stats.studentsNeedingConsultation.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-sm text-orange-600 font-medium">
                      <span className="w-1 h-1 bg-orange-600 rounded-sm flex-shrink-0" />
                      이번 달 미상담 {stats.studentsNeedingConsultation.length}건
                    </div>
                  ) : null}
                  {withdrawalData.count > 0 ? (
                    <div className="flex items-center gap-1.5 text-sm text-yellow-600 font-medium">
                      <span className="w-1 h-1 bg-yellow-600 rounded-sm flex-shrink-0" />
                      이번 달 퇴원 {withdrawalData.count}명
                    </div>
                  ) : null}
                  {totalCount === 0 ? (
                    <div className="flex items-center gap-1.5 text-sm text-black font-medium">
                      <span className="w-1 h-1 bg-gray-400 rounded-sm flex-shrink-0" />
                      오늘 출석 데이터 없음
                    </div>
                  ) : attendanceRate < 80 ? (
                    <div className="flex items-center gap-1.5 text-sm text-yellow-600 font-medium">
                      <span className="w-1 h-1 bg-yellow-600 rounded-sm flex-shrink-0" />
                      오늘 출석률 낮음 ({attendanceRate}%)
                    </div>
                  ) : null}
                  {pendingCount === 0 && followUpData.total === 0 && withdrawalData.count === 0
                    && (totalCount === 0 || attendanceRate >= 80)
                    && (!stats?.studentsNeedingConsultation || stats.studentsNeedingConsultation.length === 0) ? (
                    <div className="text-sm text-emerald-600 font-medium">모든 항목 정상입니다.</div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* ── Row 4: 미납 + 상담 후속조치 — 균등 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              {/* 미납 현황 — 가로 막대 (top 7) */}
              <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-black">미납 현황</h3>
                  {pendingCount > 0 ? (
                    <span className="text-sm font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                      {pendingCount}건 / {unpaidRecords.reduce((s, r) => s + (r.unpaidAmount || 0), 0).toLocaleString()}원
                    </span>
                  ) : null}
                </div>
                {unpaidRecords.length > 0 ? (
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={unpaidRecords.slice(0, 7).map(r => ({
                          name: r.studentName || r.externalStudentId,
                          amount: r.unpaidAmount || 0,
                        }))}
                        layout="vertical"
                        margin={{ top: 4, right: 50, left: 8, bottom: 4 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: '#f1f5f9' }}
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white border border-slate-200 rounded shadow text-xs p-2">
                                <div className="font-semibold text-black">{d.name}</div>
                                <div className="text-rose-600 font-bold">{d.amount.toLocaleString()}원</div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="amount" fill="#fb7185" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={600}>
                          <LabelList dataKey="amount" position="right" formatter={(v: number) => `${(v / 10000).toFixed(0)}만`} style={{ fontSize: 10, fill: '#64748b' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {unpaidRecords.length > 7 ? (
                      <div className="text-xs text-black text-center mt-1">외 {unpaidRecords.length - 7}건 더</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-sm text-emerald-600 font-medium py-8 text-center">미납 없음</div>
                )}
              </div>

              {/* 상담 후속조치 */}
              <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-black">상담 후속조치</h3>
                  {followUpData.total > 0 ? (
                    <span className="text-sm font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                      {followUpData.total}건 대기
                    </span>
                  ) : null}
                </div>
                {followUpData.total > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {[...followUpData.urgent, ...followUpData.pending].slice(0, 10).map((c, idx) => {
                      const urgency = getFollowUpUrgency(c);
                      const daysLeft = c.followUpDate ? getFollowUpDaysLeft(c.followUpDate) : null;
                      return (
                        <div key={idx} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-xxs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgency === 'urgent' ? 'bg-red-500' : 'bg-orange-400'}`} />
                            <span className="font-medium text-black truncate">{c.studentName}</span>
                            <span className="text-black truncate">{c.title}</span>
                          </div>
                          <span className={`flex-shrink-0 font-medium ${daysLeft !== null && daysLeft <= 0 ? 'text-red-600' : daysLeft !== null && daysLeft <= 3 ? 'text-orange-600' : 'text-black'}`}>
                            {daysLeft !== null ? (daysLeft <= 0 ? `${Math.abs(daysLeft)}일 지남` : `${daysLeft}일 남음`) : '기한 없음'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-emerald-600 font-medium py-4 text-center">대기 중인 후속조치 없음</div>
                )}
              </div>
            </div>

            {/* ── Row 4: 오늘 수업 + 퇴원 사유 + 등록 전환율 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
              {/* 오늘의 수업 — 세로 막대 (전체/완료/미기록) */}
              <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-black">오늘의 수업</h3>
                  <span className="text-[10px] text-black">{todayClasses.length}개 수업</span>
                </div>
                {todayClasses.length > 0 ? (
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: '전체', value: todayClasses.length, fill: '#10b981' },
                          { name: '출석 완료', value: todayClasses.filter(c => c.isRecorded).length, fill: '#059669' },
                          { name: '미기록', value: todayClasses.filter(c => !c.isRecorded).length, fill: '#fb7185' },
                        ].filter(d => d.value > 0)}
                        margin={{ top: 20, right: 8, left: 8, bottom: 4 }}
                        barCategoryGap="40%"
                      >
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip cursor={{ fill: '#f1f5f9' }}
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white border border-slate-200 rounded shadow text-xs p-2">
                                <div className="font-semibold text-black">{d.name}</div>
                                <div className="text-black font-bold">{d.value}개</div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="value" radius={[8, 8, 8, 8]} maxBarSize={36} isAnimationActive animationDuration={600}>
                          <LabelList dataKey="value" position="top" style={{ fontSize: 14, fill: '#1e293b', fontWeight: 'bold' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-xxs text-black py-8 text-center">오늘 예정된 수업 없음</div>
                )}
              </div>

              {/* 퇴원 현황 + 최근 시험 */}
              <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-black">이번 달 퇴원</h3>
                  {withdrawalData.count > 0 ? (
                    <span className="text-xxs font-bold text-black bg-gray-100 px-1.5 py-0.5 rounded">{withdrawalData.count}명</span>
                  ) : null}
                </div>
                {withdrawalData.count > 0 ? (
                  <div className="space-y-1 mb-3">
                    {withdrawalData.reasons.slice(0, 4).map(([reason, count], idx) => (
                      <div key={idx} className="flex items-center justify-between text-xxs py-0.5 px-2 bg-gray-50 rounded">
                        <span className="text-black">{reason}</span>
                        <span className="font-bold text-black">{count}명</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-emerald-600 font-medium py-1 text-center mb-2">퇴원 없음</div>
                )}

                <div className="border-t border-gray-100 pt-2">
                  <h3 className="text-sm font-semibold text-black mb-1.5">📝 최근 시험</h3>
                  {recentExamList.length > 0 ? (
                    <div className="space-y-1">
                      {recentExamList.map((exam, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xxs py-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium px-1 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: subjectColor(exam.subject), fontSize: '9px' }}>
                              {exam.subject}
                            </span>
                            <span className="text-black truncate">{exam.title}</span>
                          </div>
                          <span className="text-black flex-shrink-0 ml-1">{exam.date}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-black font-medium py-1 text-center">등록된 시험 없음</div>
                  )}
                </div>
              </div>

              {/* 등록 상담 전환율 — 반원 게이지 (속도계) */}
              <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-black mb-2">이번 달 등록 상담</h3>
                <div className="relative" style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '등록', value: regConversionData.rate, fill: regConversionData.rate >= 50 ? '#10b981' : regConversionData.rate >= 30 ? '#f59e0b' : '#ef4444' },
                          { name: '미등록', value: Math.max(0, 100 - regConversionData.rate), fill: '#e5e7eb' },
                        ]}
                        cx="50%"
                        cy="85%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="100%"
                        outerRadius="160%"
                        dataKey="value"
                        stroke="none"
                        isAnimationActive
                        animationDuration={700}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-x-0 bottom-2 flex flex-col items-center pointer-events-none">
                    <span className="text-4xl font-bold text-black leading-none">{regConversionData.rate}<span className="text-xl">%</span></span>
                    <span className="text-xs text-black mt-1">전환율</span>
                  </div>
                  <div className="absolute bottom-0 left-2 text-xs text-black font-medium">0%</div>
                  <div className="absolute bottom-0 right-2 text-xs text-black font-medium">100%</div>
                </div>
                <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-xl font-bold text-black">{regConversionData.total}</div>
                    <div className="text-xs text-black">전체 상담</div>
                  </div>
                  <div className="text-base text-black">→</div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-emerald-600">{regConversionData.registered}</div>
                    <div className="text-xs text-black">등록 완료</div>
                  </div>
                </div>
                {/* 상태별 분류 */}
                {regConsultations && regConsultations.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    {(() => {
                      const statusCounts: Record<string, number> = {};
                      regConsultations.forEach(c => {
                        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
                      });
                      return Object.entries(statusCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([status, count], idx) => (
                          <div key={idx} className="flex items-center justify-between text-xxs">
                            <span className={`font-medium ${isRegisteredStatus(status) ? 'text-green-600' : 'text-black'}`}>
                              {status}
                            </span>
                            <span className="text-black">{count}건</span>
                          </div>
                        ));
                    })()}
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Row 5: 빠른 작업 ── */}
            <QuickActions actions={quickActions} />
          </>
        )}
      </div>

      {/* 빠른 작업 모달 */}
      <Suspense fallback={null}>
        {isAddStudentOpen && (
          <AddStudentModal isOpen={isAddStudentOpen} onClose={() => setIsAddStudentOpen(false)} onSuccess={() => setIsAddStudentOpen(false)} />
        )}
        {isAddClassOpen && (
          <AddClassModal onClose={() => setIsAddClassOpen(false)} />
        )}
        {isAddConsultationOpen && (
          <AddConsultationModal onClose={() => setIsAddConsultationOpen(false)} onSuccess={() => setIsAddConsultationOpen(false)} userProfile={userProfile} />
        )}
        {/* 수납률 근거 데이터 모달 */}
        <BillingDetailsModal
          isOpen={isBillingModalOpen}
          onClose={() => setIsBillingModalOpen(false)}
          records={billingRecords}
          yearMonth={currentMonthFormatted}
        />
        {/* 상담 완료율 근거 데이터 모달 */}
        <ConsultationDetailsModal
          isOpen={isConsultationModalOpen}
          onClose={() => setIsConsultationModalOpen(false)}
          stats={stats}
          yearMonth={currentMonthFormatted}
        />
        {/* 신규 등록 근거 데이터 모달 */}
        <NewStudentsModal
          isOpen={isNewStudentsModalOpen}
          onClose={() => setIsNewStudentsModalOpen(false)}
          students={students}
          yearMonth={currentMonthFormatted}
          monthStart={currentMonthStart}
          monthEnd={currentMonthEnd}
        />
        {/* 순증감 근거 데이터 모달 (신규+퇴원 통합) */}
        <NetChangeDetailsModal
          isOpen={isNetChangeModalOpen}
          onClose={() => setIsNetChangeModalOpen(false)}
          students={students}
          yearMonth={currentMonthFormatted}
          monthStart={currentMonthStart}
          monthEnd={currentMonthEnd}
        />
        {/* 주간 출석 추이 근거 데이터 모달 (요일별 탭) */}
        <WeeklyAttendanceDetailsModal
          isOpen={isWeeklyAttendanceModalOpen}
          onClose={() => setIsWeeklyAttendanceModalOpen(false)}
          dates={last7Days}
          weeklyDaily={weeklyAttendanceData}
          weeklyFromRecords={weeklyFromRecords}
          students={students}
          weeklySummary={weeklyAttendance}
        />
        {/* 오늘 출석률 근거 데이터 모달 (날짜 선택 + 30일 추이) */}
        <TodayAttendanceDetailsModal
          isOpen={isTodayAttendanceModalOpen}
          onClose={() => setIsTodayAttendanceModalOpen(false)}
          defaultDate={today}
        />
      </Suspense>
    </div>
  );
};

export default MasterDashboard;
