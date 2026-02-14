import React, { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useAnalytics } from '../../hooks/useAnalytics';
import { TrendingUp, TrendingDown, Users, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface AnalyticsTabProps {
  currentUser?: UserProfile | null;
}

export default function AnalyticsTab({ currentUser }: AnalyticsTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { kpis, revenueData, studentTrend, isLoading } = useAnalytics(selectedMonth);

  const kpiCards = useMemo(() => [
    { label: '월 매출', value: kpis?.monthlyRevenue ?? 0, format: 'currency', icon: DollarSign, trend: kpis?.revenueTrend },
    { label: '수금률', value: kpis?.collectionRate ?? 0, format: 'percent', icon: BarChart3, trend: kpis?.collectionTrend },
    { label: '재원생', value: kpis?.activeStudents ?? 0, format: 'number', icon: Users, trend: kpis?.studentTrend },
    { label: '신규 등록', value: kpis?.newEnrollments ?? 0, format: 'number', icon: ArrowUpRight, trend: kpis?.enrollmentTrend },
    { label: '퇴원', value: kpis?.withdrawals ?? 0, format: 'number', icon: ArrowDownRight, trend: kpis?.withdrawalTrend },
    { label: '재원율', value: kpis?.retentionRate ?? 0, format: 'percent', icon: TrendingUp, trend: kpis?.retentionTrend },
  ], [kpis]);

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') return `${(value / 10000).toFixed(0)}만원`;
    if (format === 'percent') return `${value.toFixed(1)}%`;
    return String(value);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">매출 분석</h1>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">로딩 중...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {kpiCards.map(card => (
                <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xxs text-gray-500">{card.label}</span>
                    <card.icon size={14} className="text-gray-400" />
                  </div>
                  <div className="text-lg font-bold text-gray-900">{formatValue(card.value, card.format)}</div>
                  {card.trend !== undefined && (
                    <div className={`flex items-center gap-0.5 text-xxs mt-1 ${
                      card.trend > 0 ? 'text-green-600' : card.trend < 0 ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {card.trend > 0 ? <TrendingUp size={10} /> : card.trend < 0 ? <TrendingDown size={10} /> : null}
                      {card.trend > 0 ? '+' : ''}{card.trend?.toFixed(1)}% 전월 대비
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Revenue Chart Placeholder */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3">월별 매출 추이</h2>
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-300 rounded">
                Recharts 매출 차트 영역
              </div>
            </div>

            {/* Student Trend & Revenue Breakdown */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-bold text-gray-900 mb-3">학생 수 변동</h2>
                <div className="h-40 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-300 rounded">
                  학생 추이 차트 영역
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-bold text-gray-900 mb-3">수납 현황</h2>
                <div className="h-40 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-300 rounded">
                  수납 파이차트 영역
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
