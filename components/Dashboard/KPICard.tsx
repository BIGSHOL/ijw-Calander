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
 * Performance: rerender-memo - 부모 리렌더 시 불필요한 재렌더 방지
 */
const KPICard: React.FC<KPICardProps> = ({ data, onClick }) => {
  const { label, value, subValue, trend, trendValue, icon, color = '#081429' } = data;

  // 트렌드 아이콘 및 색상
  const getTrendIcon = (trend?: KPITrend) => {
    if (!trend) return null;

    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-600" />;
      case 'stable':
        return <Minus className="w-3 h-3 text-gray-400" />;
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
      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-100 transition-all hover:shadow-md ${
        onClick ? 'cursor-pointer hover:border-gray-300' : ''
      }`}
      onClick={onClick}
    >
      {/* 아이콘과 라벨 */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>

      {/* 메인 값 */}
      <div className="mb-1">
        <span className="text-2xl font-bold" style={{ color }}>
          {value}
        </span>
      </div>

      {/* 서브 값 및 트렌드 */}
      <div className="flex items-center gap-1.5">
        {trend && (
          <div className="flex items-center gap-0.5">
            {getTrendIcon(trend)}
            {trendValue && (
              <span className={`text-xxs font-medium ${getTrendColor(trend)}`}>
                {trendValue}
              </span>
            )}
          </div>
        )}
        {subValue && (
          <span className="text-xxs text-gray-500">{subValue}</span>
        )}
      </div>
    </div>
  );
};

// Performance: rerender-memo - value와 trend만 변경될 때만 리렌더
export default React.memo(KPICard, (prevProps, nextProps) => {
  return (
    prevProps.data.value === nextProps.data.value &&
    prevProps.data.trend === nextProps.data.trend &&
    prevProps.data.trendValue === nextProps.data.trendValue &&
    prevProps.onClick === nextProps.onClick
  );
});
