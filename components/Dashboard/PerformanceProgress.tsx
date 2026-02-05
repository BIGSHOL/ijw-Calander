import React from 'react';
import { TrendingUp, Award } from 'lucide-react';
import RadialProgress from './RadialProgress';

export interface StaffPerformance {
  id: string;
  name: string;
  consultationCount: number;
  targetCount: number;
  percentage: number;
}

interface PerformanceProgressProps {
  topPerformer: StaffPerformance | null;
  totalConsultations: number;
  monthlyTarget: number;
  loading?: boolean;
}

/**
 * 성과 진행도 컴포넌트
 * - 이달의 최고 상담자 표시
 * - 전체 상담 목표 달성률
 */
const PerformanceProgress: React.FC<PerformanceProgressProps> = ({
  topPerformer,
  totalConsultations,
  monthlyTarget,
  loading,
}) => {
  const overallPercentage = monthlyTarget > 0
    ? Math.min(100, Math.round((totalConsultations / monthlyTarget) * 100))
    : 0;

  if (loading) {
    return (
      <div className="bg-white rounded-sm border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse"></div>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-gray-100 rounded-sm animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 rounded w-24 animate-pulse"></div>
            <div className="h-4 bg-gray-100 rounded w-32 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-primary">
          이달의 상담 성과
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 전체 목표 달성률 */}
        <div className="flex flex-col items-center">
          <RadialProgress
            percentage={overallPercentage}
            color="#fdb813"
            size={100}
            strokeWidth={8}
          />
          <div className="mt-2 text-center">
            <div className="text-sm font-medium text-primary">전체 목표</div>
            <div className="text-xs text-gray-500">
              {totalConsultations} / {monthlyTarget}건
            </div>
          </div>
        </div>

        {/* 최고 상담자 */}
        <div className="flex flex-col items-center justify-center">
          {topPerformer ? (
            <>
              <div className="flex items-center gap-1 mb-2">
                <Award className="w-5 h-5 text-accent" />
                <span className="text-sm font-medium text-gray-600">Top 상담자</span>
              </div>
              <div className="text-xl font-bold text-primary">
                {topPerformer.name}
              </div>
              <div className="text-sm text-gray-500">
                {topPerformer.consultationCount}건 상담
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-sm h-2">
                <div
                  className="bg-accent h-2 rounded-sm transition-all duration-500"
                  style={{ width: `${topPerformer.percentage}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                목표 대비 {topPerformer.percentage}%
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400">
              <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm">상담 기록 없음</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceProgress;
