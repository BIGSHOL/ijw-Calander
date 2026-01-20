import React, { useState, useMemo } from 'react';
import { UserProfile, StaffMember, KPICardData } from '../../../types';
import DashboardHeader from '../DashboardHeader';
import KPICard from '../KPICard';
import QuickActions, { QuickAction } from '../QuickActions';
import { useStudents } from '../../../hooks/useStudents';
import { useDailyAttendanceByDate } from '../../../hooks/useDailyAttendance';
import { useConsultationStats } from '../../../hooks/useConsultationStats';
import { useBilling } from '../../../hooks/useBilling';
import { format, startOfMonth, subDays } from 'date-fns';
import { UserPlus, ClipboardList, MessageCircle, DollarSign, BarChart3, Calendar } from 'lucide-react';

interface MasterDashboardProps {
  userProfile: UserProfile;
  staffMember?: StaffMember;
}

/**
 * 원장/마스터 대시보드
 * 전체 학원 현황을 한눈에 볼 수 있는 종합 대시보드
 */
const MasterDashboard: React.FC<MasterDashboardProps> = ({ userProfile, staffMember }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  // 데이터 로딩
  const { students = [], loading: studentsLoading } = useStudents();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayAttendance = [], isLoading: attendanceLoading } = useDailyAttendanceByDate(today);

  const thisMonth = format(startOfMonth(new Date()), 'yyyy-MM');
  const { records: billingRecords = [], isLoading: billingLoading } = useBilling(thisMonth);

  // 상담 통계 (이번 달)
  const consultationStatsResult = useConsultationStats(
    {
      dateRange: {
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd'),
      },
      subject: 'all',
    },
    []
  );
  const stats = consultationStatsResult.stats;
  const consultationLoading = consultationStatsResult.isLoading;

  // KPI 계산
  const activeStudents = students.filter((s) => s.status === 'active').length;

  // 출석률 계산
  const presentCount = todayAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const totalCount = todayAttendance.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // 상담 완료율
  const consultationRate = stats?.totalConsultations
    ? Math.round(((stats.totalConsultations - stats.followUpNeeded) / stats.totalConsultations) * 100)
    : 0;

  // 수납률 계산
  const totalBilled = billingRecords.reduce((sum, r) => sum + r.billedAmount, 0);
  const totalPaid = billingRecords.reduce((sum, r) => sum + r.paidAmount, 0);
  const billingRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
  const overdueCount = billingRecords.filter((r) => r.status === 'overdue').length;

  // 신규 등록 (이번 주)
  const newStudentsThisWeek = students.filter((s) => {
    const startDate = new Date(s.startDate);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return startDate >= weekAgo && startDate <= now;
  }).length;

  // 과목별 학생 분포 계산
  const subjectDistribution = useMemo(() => {
    const activeStudentsList = students.filter((s) => s.status === 'active');

    // 활성 수강 중인지 확인 (withdrawalDate 없고 onHold가 아닌 경우)
    const isActiveEnrollment = (e: any) => !e.withdrawalDate && !e.onHold;

    const mathCount = activeStudentsList.filter((s) =>
      s.enrollments?.some((e) => e.subject === 'math' && isActiveEnrollment(e))
    ).length;

    const englishCount = activeStudentsList.filter((s) =>
      s.enrollments?.some((e) => e.subject === 'english' && isActiveEnrollment(e))
    ).length;

    const koreanCount = activeStudentsList.filter((s) =>
      s.enrollments?.some((e) => e.subject === 'korean' && isActiveEnrollment(e))
    ).length;

    const scienceCount = activeStudentsList.filter((s) =>
      s.enrollments?.some((e) => e.subject === 'science' && isActiveEnrollment(e))
    ).length;

    const otherCount = activeStudentsList.filter((s) =>
      s.enrollments?.some((e) => e.subject === 'other' && isActiveEnrollment(e))
    ).length;

    // 아무 과목도 수강하지 않는 학생
    const noEnrollmentCount = activeStudentsList.filter((s) =>
      !s.enrollments || s.enrollments.length === 0 || !s.enrollments.some(isActiveEnrollment)
    ).length;

    return [
      { subject: '수학', count: mathCount, color: '#3b82f6' },
      { subject: '영어', count: englishCount, color: '#10b981' },
      { subject: '국어', count: koreanCount, color: '#f59e0b' },
      { subject: '과학', count: scienceCount, color: '#8b5cf6' },
      { subject: '기타', count: otherCount, color: '#6b7280' },
      { subject: '미등록', count: noEnrollmentCount, color: '#ef4444' }
    ].filter(item => item.count > 0); // 0명인 과목은 제외
  }, [students]);

  // 주간 출석 추이 (최근 7일)
  const weeklyAttendance = useMemo(() => {
    const days = [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      days.push({
        date: format(date, 'MM/dd'),
        day: dayNames[date.getDay()],
        rate: 0 // 실제 데이터는 별도 hook 필요
      });
    }
    return days;
  }, []);

  // KPI 카드 데이터
  const kpiCards: KPICardData[] = [
    {
      id: 'students',
      label: '재원생',
      value: activeStudents,
      subValue: '명',
      trend: newStudentsThisWeek > 0 ? 'up' : 'stable',
      trendValue: newStudentsThisWeek > 0 ? `+${newStudentsThisWeek}` : undefined,
      icon: '👥',
      color: '#081429',
    },
    {
      id: 'attendance',
      label: '오늘 출석률',
      value: `${attendanceRate}%`,
      subValue: `${todayAttendance.filter((a) => a.status === 'present' || a.status === 'late').length}/${todayAttendance.length}`,
      trend: attendanceRate >= 90 ? 'up' : attendanceRate >= 80 ? 'stable' : 'down',
      icon: '✅',
      color: '#10b981',
    },
    {
      id: 'consultation',
      label: '상담 완료율',
      value: `${consultationRate}%`,
      subValue: `${stats?.totalConsultations || 0}건 중 ${(stats?.totalConsultations || 0) - (stats?.followUpNeeded || 0)}건`,
      trend: consultationRate >= 85 ? 'up' : 'stable',
      icon: '💬',
      color: '#6366f1',
    },
    {
      id: 'billing',
      label: '수납률',
      value: `${billingRate}%`,
      subValue: `${totalPaid.toLocaleString()}/${totalBilled.toLocaleString()}원`,
      trend: billingRate >= 90 ? 'up' : billingRate >= 80 ? 'stable' : 'down',
      trendValue: overdueCount > 0 ? `연체 ${overdueCount}건` : undefined,
      icon: '💰',
      color: '#f59e0b',
    },
    {
      id: 'new-students',
      label: '신규 등록',
      value: newStudentsThisWeek,
      subValue: '이번 주',
      trend: newStudentsThisWeek > 0 ? 'up' : 'stable',
      icon: '🆕',
      color: '#ec4899',
    },
    {
      id: 'satisfaction',
      label: '학부모 만족도',
      value: '4.5',
      subValue: '/5.0',
      trend: 'up',
      icon: '⭐',
      color: '#fdb813',
    },
  ];

  // 빠른 작업
  // TODO: App.tsx에서 onTabChange 함수를 props로 전달받아 실제 탭 전환 구현
  const quickActions: QuickAction[] = [
    {
      id: 'new-student',
      label: '학생 등록',
      icon: UserPlus,
      onClick: () => {
        alert('학생 관리 탭으로 이동합니다.\n(학생 관리 > 학생 추가 버튼 클릭)');
        // TODO: onTabChange('students')
      },
      color: '#081429',
    },
    {
      id: 'attendance',
      label: '출석 관리',
      icon: ClipboardList,
      onClick: () => {
        alert('출석부 탭으로 이동합니다.');
        // TODO: onTabChange('attendance')
      },
      color: '#10b981',
    },
    {
      id: 'consultation',
      label: '상담 기록',
      icon: MessageCircle,
      onClick: () => {
        alert('상담 탭으로 이동합니다.');
        // TODO: onTabChange('consultation')
      },
      color: '#6366f1',
    },
    {
      id: 'billing',
      label: '수납 관리',
      icon: DollarSign,
      onClick: () => {
        alert('수납 관리 기능은 개발 예정입니다.');
        // TODO: Implement billing feature
      },
      color: '#f59e0b',
    },
    {
      id: 'reports',
      label: '통계 보기',
      icon: BarChart3,
      onClick: () => {
        alert('통계 리포트 기능은 개발 예정입니다.');
        // TODO: Implement analytics/reports feature
      },
      color: '#6b7280',
    },
    {
      id: 'schedule',
      label: '일정 관리',
      icon: Calendar,
      onClick: () => {
        alert('연간 일정 탭으로 이동합니다.');
        // TODO: onTabChange('calendar')
      },
      color: '#8b5cf6',
    },
  ];

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const isLoading = studentsLoading || attendanceLoading || billingLoading || consultationLoading;

  return (
    <div className="w-full h-full overflow-auto p-4 bg-gray-50">
      <div className="max-w-[1600px] mx-auto">
        {/* 헤더 */}
        <DashboardHeader
          userProfile={userProfile}
          staffMember={staffMember}
          onRefresh={handleRefresh}
        />

        {/* 로딩 상태 */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-[#fdb813] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500">데이터 로딩 중...</span>
            </div>
          </div>
        ) : (
          <>
            {/* KPI 카드 그리드 - 더 컴팩트하게 */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
              {kpiCards.map((card) => (
                <KPICard key={card.id} data={card} />
              ))}
            </div>

            {/* 차트 영역과 알림 센터 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* 과목별 학생 분포 */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-[#081429] mb-3">📊 과목별 학생 분포</h3>
                <div className="space-y-3">
                  {subjectDistribution.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{item.subject}</span>
                        <span className="text-xs font-bold" style={{ color: item.color }}>{item.count}명</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${activeStudents > 0 ? (item.count / activeStudents) * 100 : 0}%`,
                            backgroundColor: item.color
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 주간 출석 추이 */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-[#081429] mb-3">📈 주간 출석 추이</h3>
                <div className="flex items-end justify-between h-24 gap-1">
                  {weeklyAttendance.map((day, idx) => {
                    const height = attendanceRate > 0 ? attendanceRate : Math.random() * 60 + 40;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-gray-100 rounded-t flex items-end justify-center relative" style={{ height: '80px' }}>
                          <div
                            className="w-full bg-gradient-to-t from-[#10b981] to-[#34d399] rounded-t transition-all duration-500"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">{day.day}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-center mt-2 text-[10px] text-gray-400">
                  평균 출석률: {attendanceRate}%
                </div>
              </div>

              {/* 알림 센터 */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-[#081429] mb-3">⚠️ 주의 필요</h3>
                <div className="space-y-2">
                  {overdueCount > 0 && (
                    <div className="flex items-center gap-2 text-xs text-red-600">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                      연체 학부모 {overdueCount}명 (독촉 필요)
                    </div>
                  )}
                  {stats?.studentsNeedingConsultation && stats.studentsNeedingConsultation.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-orange-600">
                      <span className="w-1.5 h-1.5 bg-orange-600 rounded-full" />
                      상담 필요 학생 {stats.studentsNeedingConsultation.length}명
                    </div>
                  )}
                  {attendanceRate < 80 && (
                    <div className="flex items-center gap-2 text-xs text-yellow-600">
                      <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full" />
                      오늘 출석률 낮음 ({attendanceRate}%)
                    </div>
                  )}
                  {overdueCount === 0 && attendanceRate >= 80 && (!stats?.studentsNeedingConsultation || stats.studentsNeedingConsultation.length === 0) && (
                    <div className="text-xs text-gray-500">현재 주의가 필요한 항목이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>

            {/* 빠른 작업 */}
            <QuickActions actions={quickActions} />
          </>
        )}
      </div>
    </div>
  );
};

export default MasterDashboard;
