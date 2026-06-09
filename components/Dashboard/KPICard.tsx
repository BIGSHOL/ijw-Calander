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
  const { label, value, subValue, trend, trendValue, icon, color = '#081429', description } = data;

  // 트렌드 아이콘 및 색상
  const getTrendIcon = (trend?: KPITrend) => {
    if (!trend) return null;

    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-600" />;
      case 'stable':
        return <Minus className="w-3 h-3 text-black" />;
      default:
        return null;
    }
  };

  const getTrendColor = (trend?: KPITrend) => {
    if (!trend) return 'text-black';

    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'stable':
        return 'text-black';
      default:
        return 'text-black';
    }
  };

  // trendValue가 '+0', '0', '-0' 같은 의미 없는 값이면 숨김
  const isZeroTrend = !trendValue || /^[+-]?0+$/.test(String(trendValue).trim());

  return (
    <div
      className={`bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-100 transition-all hover:shadow-md h-full flex flex-col justify-center ${
        onClick ? 'cursor-pointer hover:border-gray-300' : ''
      }`}
      onClick={onClick}
      title={description}
    >
      {/* 라벨 + 큰 값 + 서브 + 트렌드 — 카드 폭 끝까지 분산 */}
      <div className="flex items-baseline justify-between gap-2 w-full">
        <span className="text-base sm:text-lg font-semibold text-black shrink-0">{label}</span>
        <div className="flex items-baseline justify-end gap-2 min-w-0 flex-1">
          <span className="text-4xl sm:text-5xl font-bold leading-none truncate" style={{ color }}>
            {value}
          </span>
          {trend && !isZeroTrend && (
            <span className={`text-base font-bold shrink-0 ${getTrendColor(trend)}`}>
              {trendValue}
            </span>
          )}
        </div>
      </div>

      {/* 서브 값 — 카드 하단 가득 채워서 우측 끝까지 정보 분산 */}
      {subValue && (
        <div className="mt-1.5 text-sm sm:text-base text-black font-medium text-right truncate">
          {subValue}
        </div>
      )}
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
