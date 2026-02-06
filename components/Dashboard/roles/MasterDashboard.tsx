import React, { Suspense, lazy, useState, useMemo } from 'react';
import { UserProfile, StaffMember, KPICardData } from '../../../types';
import DashboardHeader from '../DashboardHeader';
import KPICard from '../KPICard';
import QuickActions, { QuickAction } from '../QuickActions';
import { useStudents } from '../../../hooks/useStudents';
import { useDailyAttendanceByDate, useDailyAttendanceByRange } from '../../../hooks/useDailyAttendance';
import { useConsultationStats } from '../../../hooks/useConsultationStats';
import { useBilling } from '../../../hooks/useBilling';
import { useStaff } from '../../../hooks/useStaff';
import { useFollowUpConsultations, getFollowUpUrgency, getFollowUpDaysLeft } from '../../../hooks/useStudentConsultations';
import { useClasses } from '../../../hooks/useClasses';
import { useRecentExams } from '../../../hooks/useExams';
import { useConsultations, isRegisteredStatus } from '../../../hooks/useConsultations';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { UserPlus, MessageCircle, BookOpen } from 'lucide-react';
import { SUBJECT_COLORS } from '../../../utils/styleUtils';

const AddStudentModal = lazy(() => import('../../StudentManagement/AddStudentModal'));
const AddClassModal = lazy(() => import('../../ClassManagement/AddClassModal'));
const AddConsultationModal = lazy(() => import('../../StudentConsultation/AddConsultationModal'));

interface MasterDashboardProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

const MasterDashboard: React.FC<MasterDashboardProps> = ({ userProfile, staffMember }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  // ── 기본 날짜 ──
  const currentMonth = useMemo(() => new Date(), []);
  const currentMonthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const currentMonthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentMonthFormatted = format(currentMonthStart, 'yyyy-MM');
  const currentYear = currentMonth.getFullYear();
  const currentMonthNum = String(currentMonth.getMonth() + 1);

  // ── 데이터 로딩 ──
  const { students = [], loading: studentsLoading } = useStudents(true); // 퇴원생 포함
  const { data: todayAttendance = [], isLoading: attendanceLoading } = useDailyAttendanceByDate(today);
  const { records: billingRecords = [], isLoading: billingLoading } = useBilling(currentMonthFormatted);
  const { staff } = useStaff();
  const { data: allClasses = [] } = useClasses();
  const { consultations: followUpList = [] } = useFollowUpConsultations();
  const { data: recentExams = [] } = useRecentExams(5);
  const { data: regConsultations = [] } = useConsultations({ month: currentMonthNum, year: currentYear });

  // 주간 출석
  const last7Days = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) days.push(format(subDays(now, i), 'yyyy-MM-dd'));
    return days;
  }, []);
  const { data: weeklyAttendanceRange = {}, isLoading: weeklyAttendanceLoading } = useDailyAttendanceByRange(last7Days[0], last7Days[6]);
  const weeklyAttendanceData = useMemo(() => last7Days.map(d => weeklyAttendanceRange[d] || []), [last7Days, weeklyAttendanceRange]);

  // 상담 통계
  const consultationStatsResult = useConsultationStats(
    { dateRange: { start: format(currentMonthStart, 'yyyy-MM-dd'), end: format(currentMonthEnd, 'yyyy-MM-dd') }, subject: 'all' },
    staff
  );
  const stats = consultationStatsResult.stats;
  const consultationLoading = consultationStatsResult.loading;

  // ── 헬퍼 ──
  const isActiveEnrollment = (e: any) => !e.withdrawalDate && !e.onHold;

  // ── 재원생 ──
  const activeStudents = useMemo(() =>
    students.filter(s => s.status === 'active' && s.enrollments?.some(isActiveEnrollment)).length
  , [students]);

  // ── 출석 통계 ──
  const { presentCount, totalCount, attendanceRate } = useMemo(() => {
    const present = todayAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const total = todayAttendance.length;
    return { presentCount: present, totalCount: total, attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0 };
  }, [todayAttendance]);

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

  // ── 신규 등록 ──
  const newStudentsThisMonth = useMemo(() =>
    students.filter(s => {
      if (s.status !== 'active') return false;
      const d = new Date(s.startDate);
      return d >= currentMonthStart && d <= currentMonthEnd;
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
  const subjectDistribution = useMemo(() => {
    const activeList = students.filter(s => s.status === 'active');
    const subjectCounts = { math: 0, english: 0, korean: 0, science: 0, other: 0 };
    const multiSubjectCounts: Record<number, number> = {};
    activeList.forEach(s => {
      const active = s.enrollments?.filter(isActiveEnrollment) || [];
      const unique = new Set(active.map(e => e.subject));
      unique.forEach(sub => { if (sub in subjectCounts) subjectCounts[sub as keyof typeof subjectCounts]++; });
      if (unique.size >= 2) multiSubjectCounts[unique.size] = (multiSubjectCounts[unique.size] || 0) + 1;
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

  // ── 주간 출석 추이 ──
  const weeklyAttendance = useMemo(() => {
    const now = new Date();
    return weeklyAttendanceData.map((dayData, idx) => {
      const date = subDays(now, 6 - idx);
      const present = dayData.filter(a => a.status === 'present' || a.status === 'late').length;
      const total = dayData.length;
      return { day: DAY_NAMES_KO[date.getDay()], rate: total > 0 ? Math.round((present / total) * 100) : 0 };
    });
  }, [weeklyAttendanceData]);

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
  const kpiCards: KPICardData[] = [
    {
      id: 'students', label: '재원생', value: activeStudents, subValue: '명',
      trend: newStudentsThisMonth > 0 ? 'up' : 'stable',
      trendValue: newStudentsThisMonth > 0 ? `+${newStudentsThisMonth}` : undefined,
      icon: '👥', color: 'rgb(8, 20, 41)' /* primary */,
    },
    {
      id: 'attendance', label: '오늘 출석률', value: `${attendanceRate}%`,
      subValue: `${presentCount}/${totalCount}`,
      trend: attendanceRate >= 90 ? 'up' : attendanceRate >= 80 ? 'stable' : 'down',
      icon: '✅', color: '#10b981',
    },
    {
      id: 'consultation', label: '상담 완료율', value: `${consultationRate}%`,
      subValue: `${consultedSubjectCount}건 완료 / 총 ${totalSubjectEnrollments}건`,
      trend: consultationRate >= 85 ? 'up' : 'stable',
      icon: '💬', color: '#6366f1',
    },
    {
      id: 'billing', label: '수납률', value: `${billingRate}%`,
      subValue: `${totalPaid.toLocaleString()}/${totalBilled.toLocaleString()}원`,
      trend: billingRate >= 90 ? 'up' : billingRate >= 80 ? 'stable' : 'down',
      trendValue: pendingCount > 0 ? `미납 ${pendingCount}건` : undefined,
      icon: '💰', color: '#f59e0b',
    },
    {
      id: 'new-students', label: '신규 등록', value: newStudentsThisMonth,
      subValue: '이번 달', trend: newStudentsThisMonth > 0 ? 'up' : 'stable',
      icon: '🆕', color: '#ec4899',
    },
    {
      id: 'net-change', label: '순증감',
      value: `${withdrawalData.netChange >= 0 ? '+' : ''}${withdrawalData.netChange}`,
      subValue: `신규 ${newStudentsThisMonth} / 퇴원 ${withdrawalData.count}`,
      trend: withdrawalData.netChange > 0 ? 'up' : withdrawalData.netChange < 0 ? 'down' : 'stable',
      icon: '📊', color: '#6b7280',
    },
  ];

  // ── 빠른 작업 ──
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddConsultationOpen, setIsAddConsultationOpen] = useState(false);

  const quickActions: QuickAction[] = [
    { id: 'add-student', label: '학생 추가', icon: UserPlus, onClick: () => setIsAddStudentOpen(true), color: 'rgb(8, 20, 41)' /* primary */ },
    { id: 'add-class', label: '수업 추가', icon: BookOpen, onClick: () => setIsAddClassOpen(true), color: '#10b981' },
    { id: 'add-consultation', label: '상담 기록', icon: MessageCircle, onClick: () => setIsAddConsultationOpen(true), color: '#6366f1' },
  ];

  const handleRefresh = () => setRefreshKey(prev => prev + 1);
  const isLoading = studentsLoading || attendanceLoading || weeklyAttendanceLoading || billingLoading || consultationLoading;

  // ── 과목 색상 ──
  const subjectColor = (sub: string) => {
    if (sub === '수학') return '#3b82f6';
    if (sub === '영어') return '#10b981';
    if (sub === '공통') return '#8b5cf6';
    return '#6b7280';
  };

  return (
    <div className="w-full p-3 bg-gray-50 overflow-x-auto">
      <div className="max-w-[1800px] mx-auto min-w-[768px]">
        <DashboardHeader userProfile={userProfile} staffMember={staffMember} onRefresh={handleRefresh} />

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-sm animate-spin" />
              <span className="text-sm text-gray-500">데이터 로딩 중...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ── Row 1: KPI 카드 ── */}
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-3">
              {kpiCards.map(card => <KPICard key={card.id} data={card} />)}
            </div>

            {/* ── Row 2: 차트 + 알림 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
              {/* 과목별 학생 분포 */}
              <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-primary mb-2">📊 과목별 학생 분포</h3>
                <div className="space-y-2">
                  {subjectDistribution.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xxs font-medium text-gray-700">{item.subject}</span>
                        <span className="text-xxs font-bold" style={{ color: item.color }}>{item.count}명</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-sm h-1.5">
                        <div className="h-1.5 rounded-sm transition-all duration-500" style={{ width: `${activeStudents > 0 ? (item.count / activeStudents) * 100 : 0}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 주간 출석 추이 */}
              <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-primary mb-2">📈 주간 출석 추이</h3>
                <div className="flex items-end justify-between h-20 gap-1">
                  {weeklyAttendance.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full bg-gray-100 rounded-t flex items-end" style={{ height: '60px' }}>
                        <div className="w-full bg-gradient-to-t from-[#10b981] to-[#34d399] rounded-t transition-all duration-500" style={{ height: `${day.rate}%` }} />
                      </div>
                      <span className="text-micro text-gray-500 font-medium">{day.day}</span>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-1.5 text-micro text-gray-400">
                  평균 출석률: {Math.round(weeklyAttendance.reduce((s, d) => s + d.rate, 0) / weeklyAttendance.length) || 0}%
                </div>
              </div>

              {/* 주의 필요 */}
              <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-primary mb-2">⚠️ 주의 필요</h3>
                <div className="space-y-1.5">
                  {pendingCount > 0 ? (
                    <div className="flex items-center gap-1.5 text-xxs text-red-600">
                      <span className="w-1 h-1 bg-red-600 rounded-sm flex-shrink-0" />
                      미납 {pendingCount}건 (총 {unpaidRecords.reduce((s, r) => s + (r.unpaidAmount || 0), 0).toLocaleString()}원)
                    </div>
                  ) : null}
                  {followUpData.urgent.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xxs text-red-600">
                      <span className="w-1 h-1 bg-red-600 rounded-sm flex-shrink-0" />
                      긴급 후속조치 {followUpData.urgent.length}건 (3일 이내)
                    </div>
                  ) : null}
                  {followUpData.pending.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xxs text-orange-600">
                      <span className="w-1 h-1 bg-orange-600 rounded-sm flex-shrink-0" />
                      상담 후속조치 대기 {followUpData.pending.length}건
                    </div>
                  ) : null}
                  {stats?.studentsNeedingConsultation && stats.studentsNeedingConsultation.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xxs text-orange-600">
                      <span className="w-1 h-1 bg-orange-600 rounded-sm flex-shrink-0" />
                      이번 달 미상담 {stats.studentsNeedingConsultation.length}건
                    </div>
                  ) : null}
                  {withdrawalData.count > 0 ? (
                    <div className="flex items-center gap-1.5 text-xxs text-yellow-600">
                      <span className="w-1 h-1 bg-yellow-600 rounded-sm flex-shrink-0" />
                      이번 달 퇴원 {withdrawalData.count}명
                    </div>
                  ) : null}
                  {totalCount === 0 ? (
                    <div className="flex items-center gap-1.5 text-xxs text-gray-400">
                      <span className="w-1 h-1 bg-gray-400 rounded-sm flex-shrink-0" />
                      오늘 출석 데이터 없음
                    </div>
                  ) : attendanceRate < 80 ? (
                    <div className="flex items-center gap-1.5 text-xxs text-yellow-600">
                      <span className="w-1 h-1 bg-yellow-600 rounded-sm flex-shrink-0" />
                      오늘 출석률 낮음 ({attendanceRate}%)
                    </div>
                  ) : null}
                  {pendingCount === 0 && followUpData.total === 0 && withdrawalData.count === 0
                    && (totalCount === 0 || attendanceRate >= 80)
                    && (!stats?.studentsNeedingConsultation || stats.studentsNeedingConsultation.length === 0) ? (
                    <div className="text-xxs text-green-600 font-medium">모든 항목 정상입니다.</div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* ── Row 3: 미납 현황 + 상담 후속조치 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
              {/* 미납 현황 */}
              <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-primary">💰 미납 현황</h3>
                  {pendingCount > 0 ? (
                    <span className="text-xxs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                      {pendingCount}건 / {unpaidRecords.reduce((s, r) => s + (r.unpaidAmount || 0), 0).toLocaleString()}원
                    </span>
                  ) : null}
                </div>
                {unpaidRecords.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {unpaidRecords.slice(0, 10).map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-xxs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{r.studentName || r.externalStudentId}</span>
                          <span className="text-gray-400">{r.grade}</span>
                        </div>
                        <span className="font-bold text-red-600">{(r.unpaidAmount || 0).toLocaleString()}원</span>
                      </div>
                    ))}
                    {unpaidRecords.length > 10 ? (
                      <div className="text-xxs text-gray-400 text-center pt-1">외 {unpaidRecords.length - 10}건 더</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xxs text-green-600 py-4 text-center">미납 없음</div>
                )}
              </div>

              {/* 상담 후속조치 */}
              <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-primary">📋 상담 후속조치</h3>
                  {followUpData.total > 0 ? (
                    <span className="text-xxs font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
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
                            <span className="font-medium text-gray-800 truncate">{c.studentName}</span>
                            <span className="text-gray-400 truncate">{c.title}</span>
                          </div>
                          <span className={`flex-shrink-0 font-medium ${daysLeft !== null && daysLeft <= 0 ? 'text-red-600' : daysLeft !== null && daysLeft <= 3 ? 'text-orange-600' : 'text-gray-500'}`}>
                            {daysLeft !== null ? (daysLeft <= 0 ? `${Math.abs(daysLeft)}일 지남` : `${daysLeft}일 남음`) : '기한 없음'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xxs text-green-600 py-4 text-center">대기 중인 후속조치 없음</div>
                )}
              </div>
            </div>

            {/* ── Row 4: 오늘 수업 + 퇴원 사유 + 등록 전환율 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
              {/* 오늘의 수업 현황 - 요약 + 미기록만 표시 */}
              <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-primary">📚 오늘의 수업</h3>
                </div>
                {todayClasses.length > 0 ? (
                  <>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 bg-gray-50 rounded px-2 py-1.5 text-center">
                        <div className="text-sm font-bold text-primary">{todayClasses.length}</div>
                        <div className="text-micro text-gray-500">전체</div>
                      </div>
                      <div className="flex-1 bg-green-50 rounded px-2 py-1.5 text-center">
                        <div className="text-sm font-bold text-green-600">{todayClasses.filter(c => c.isRecorded).length}</div>
                        <div className="text-micro text-gray-500">출석 완료</div>
                      </div>
                      <div className="flex-1 bg-red-50 rounded px-2 py-1.5 text-center">
                        <div className="text-sm font-bold text-red-500">{todayClasses.filter(c => !c.isRecorded).length}</div>
                        <div className="text-micro text-gray-500">미기록</div>
                      </div>
                    </div>
                    {todayClasses.filter(c => !c.isRecorded).length > 0 ? (
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        <div className="text-xxs text-gray-400 mb-0.5">미기록 수업:</div>
                        {todayClasses.filter(c => !c.isRecorded).slice(0, 8).map((c, idx) => (
                          <div key={idx} className="flex items-center justify-between py-0.5 px-2 bg-gray-50 rounded text-xxs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: SUBJECT_COLORS[c.subject]?.bg || '#6b7280' }} />
                              <span className="font-medium text-gray-800 truncate">{c.className}</span>
                            </div>
                            <span className="text-gray-400 flex-shrink-0">{c.studentCount || 0}명</span>
                          </div>
                        ))}
                        {todayClasses.filter(c => !c.isRecorded).length > 8 ? (
                          <div className="text-xxs text-gray-400 text-center">외 {todayClasses.filter(c => !c.isRecorded).length - 8}개</div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-xxs text-green-600 text-center py-1">모든 수업 출석 기록 완료</div>
                    )}
                  </>
                ) : (
                  <div className="text-xxs text-gray-400 py-4 text-center">오늘 예정된 수업 없음</div>
                )}
              </div>

              {/* 퇴원 현황 + 최근 시험 */}
              <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-primary">🚪 이번 달 퇴원</h3>
                  {withdrawalData.count > 0 ? (
                    <span className="text-xxs font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{withdrawalData.count}명</span>
                  ) : null}
                </div>
                {withdrawalData.count > 0 ? (
                  <div className="space-y-1 mb-3">
                    {withdrawalData.reasons.slice(0, 4).map(([reason, count], idx) => (
                      <div key={idx} className="flex items-center justify-between text-xxs py-0.5 px-2 bg-gray-50 rounded">
                        <span className="text-gray-700">{reason}</span>
                        <span className="font-bold text-gray-600">{count}명</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xxs text-green-600 py-1 text-center mb-2">퇴원 없음</div>
                )}

                <div className="border-t border-gray-100 pt-2">
                  <h3 className="text-xs font-bold text-primary mb-1.5">📝 최근 시험</h3>
                  {recentExamList.length > 0 ? (
                    <div className="space-y-1">
                      {recentExamList.map((exam, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xxs py-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium px-1 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: subjectColor(exam.subject), fontSize: '9px' }}>
                              {exam.subject}
                            </span>
                            <span className="text-gray-700 truncate">{exam.title}</span>
                          </div>
                          <span className="text-gray-400 flex-shrink-0 ml-1">{exam.date}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xxs text-gray-400 py-1 text-center">등록된 시험 없음</div>
                  )}
                </div>
              </div>

              {/* 등록 상담 전환율 */}
              <div className="bg-white rounded-sm p-3 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-primary mb-2">📞 이번 달 등록 상담</h3>
                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{regConversionData.total}</div>
                    <div className="text-xxs text-gray-500">전체 상담</div>
                  </div>
                  <div className="text-lg text-gray-300">→</div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{regConversionData.registered}</div>
                    <div className="text-xxs text-gray-500">등록 완료</div>
                  </div>
                </div>
                {/* 전환율 바 */}
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xxs text-gray-500">전환율</span>
                    <span className="text-xxs font-bold text-primary">{regConversionData.rate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-sm h-2">
                    <div
                      className="h-2 rounded-sm transition-all duration-500"
                      style={{
                        width: `${regConversionData.rate}%`,
                        backgroundColor: regConversionData.rate >= 50 ? '#10b981' : regConversionData.rate >= 30 ? '#f59e0b' : '#ef4444',
                      }}
                    />
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
                            <span className={`font-medium ${isRegisteredStatus(status) ? 'text-green-600' : 'text-gray-600'}`}>
                              {status}
                            </span>
                            <span className="text-gray-500">{count}건</span>
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
      </Suspense>
    </div>
  );
};

export default MasterDashboard;
