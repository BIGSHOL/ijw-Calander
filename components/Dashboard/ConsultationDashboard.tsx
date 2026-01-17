import React, { useState } from 'react';
import { Calendar, RefreshCw, FileText, Users, UserCheck, AlertTriangle } from 'lucide-react';
import { useConsultationStats, getDateRangeFromPreset, DatePreset, DEFAULT_MONTHLY_TARGET } from '../../hooks/useConsultationStats';
import { useStaff } from '../../hooks/useStaff';
import CounselingOverview from './CounselingOverview';
import PerformanceProgress from './PerformanceProgress';
import CategoryStats from './CategoryStats';
import StaffSubjectStats from './StaffSubjectStats';

/**
 * 상담 대시보드 메인 컴포넌트
 * - 통계 개요
 * - 일별 차트
 * - 카테고리별 분포
 */
const ConsultationDashboard: React.FC = () => {
  const [datePreset, setDatePreset] = useState<DatePreset>('thisMonth');

  const dateRange = getDateRangeFromPreset(datePreset);
  const { staff } = useStaff();
  const { stats, loading, refetch } = useConsultationStats(
    { dateRange },
    staff
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[#081429]">상담 대시보드</h2>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#fdb813]"
          >
            <option value="thisWeek">이번 주</option>
            <option value="thisMonth">이번 달</option>
            <option value="lastMonth">지난 달</option>
            <option value="last3Months">최근 3개월</option>
          </select>
        </div>

        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 기간 표시 */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Calendar className="w-4 h-4" />
        <span>{dateRange.start} ~ {dateRange.end}</span>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<FileText className="w-5 h-5" />}
          label="총 상담"
          value={stats.totalConsultations}
          suffix="건"
          loading={loading}
          color="#081429"
        />
        <SummaryCard
          icon={<Users className="w-5 h-5" />}
          label="학부모 상담"
          value={stats.parentConsultations}
          suffix="건"
          loading={loading}
          color="#3b82f6"
        />
        <SummaryCard
          icon={<UserCheck className="w-5 h-5" />}
          label="학생 상담"
          value={stats.studentConsultations}
          suffix="건"
          loading={loading}
          color="#22c55e"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="후속 조치 필요"
          value={stats.followUpNeeded}
          suffix="건"
          loading={loading}
          color={stats.followUpNeeded > 0 ? '#ef4444' : '#6b7280'}
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CounselingOverview data={stats.dailyStats} loading={loading} />
        </div>
        <StaffSubjectStats stats={stats.staffSubjectStats} loading={loading} />
      </div>

      {/* 하단 통계 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryStats
          stats={stats.categoryStats}
          totalCount={stats.totalConsultations}
          loading={loading}
        />
        <PerformanceProgress
          topPerformer={stats.topPerformer}
          totalConsultations={stats.totalConsultations}
          monthlyTarget={DEFAULT_MONTHLY_TARGET}
          loading={loading}
        />
      </div>
    </div>
  );
};

// 요약 카드 컴포넌트
interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  loading?: boolean;
  color?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  icon,
  label,
  value,
  suffix = '',
  loading,
  color = '#081429',
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded w-16 mb-2 animate-pulse" />
            <div className="h-6 bg-gray-100 rounded w-12 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-xl font-bold" style={{ color }}>
            {value.toLocaleString()}
            <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultationDashboard;
