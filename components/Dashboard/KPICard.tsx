import React from 'react';
import { KPICardData, KPITrend } from '../../types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  data: KPICardData;
  onClick?: () => void;
}

/**
 * KPI 카드 컴포넌트
 * 핵심 지표를 카드 형태로 표시
 */
const KPICard: React.FC<KPICardProps> = ({ data, onClick }) => {
  const { label, value, subValue, trend, trendValue, icon, color = '#081429' } = data;

  // 트렌드 아이콘 및 색상
  const getTrendIcon = (trend?: KPITrend) => {
    if (!trend) return null;

    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'stable':
        return <Minus className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getTrendColor = (trend?: KPITrend) => {
    if (!trend) return 'text-gray-500';

    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-400';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div
      className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md ${
        onClick ? 'cursor-pointer hover:border-gray-300' : ''
      }`}
      onClick={onClick}
    >
      {/* 아이콘과 라벨 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>

      {/* 메인 값 */}
      <div className="mb-2">
        <span className="text-3xl font-bold" style={{ color }}>
          {value}
        </span>
      </div>

      {/* 서브 값 및 트렌드 */}
      <div className="flex items-center gap-2">
        {trend && (
          <div className="flex items-center gap-1">
            {getTrendIcon(trend)}
            {trendValue && (
              <span className={`text-sm font-medium ${getTrendColor(trend)}`}>
                {trendValue}
              </span>
            )}
          </div>
        )}
        {subValue && (
          <span className="text-sm text-gray-500">{subValue}</span>
        )}
      </div>
    </div>
  );
};

export default KPICard;
