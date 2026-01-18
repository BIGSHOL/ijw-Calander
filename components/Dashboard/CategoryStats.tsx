import React from 'react';
import { CATEGORY_CONFIG, ConsultationCategory } from '../../types';

export interface CategoryStat {
  category: ConsultationCategory;
  count: number;
  percentage: number;
}

interface CategoryStatsProps {
  stats: CategoryStat[];
  totalCount: number;
  loading?: boolean;
  minimal?: boolean;
}

/**
 * 카테고리별 상담 통계 컴포넌트
 * - 상담 유형별 분포 표시
 * - 막대 그래프 형태
 */
const CategoryStats: React.FC<CategoryStatsProps> = ({ stats, totalCount, loading, minimal }) => {
  if (loading) {
    return minimal ? (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <div className="h-3 bg-gray-100 rounded w-16 animate-pulse"></div>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full animate-pulse"></div>
            <div className="h-3 bg-gray-100 rounded w-8 animate-pulse"></div>
          </div>
        ))}
      </div>
    ) : (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-36 mb-4 animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div className="h-4 bg-gray-100 rounded w-16 animate-pulse"></div>
              <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-10 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const sortedStats = [...stats].sort((a, b) => b.count - a.count);

  if (minimal) {
    return totalCount === 0 ? (
      <div className="text-center text-gray-400 py-8 text-sm">
        상담 기록이 없습니다
      </div>
    ) : (
      <div className="space-y-4">
        {sortedStats.slice(0, 5).map((stat) => {
          const config = CATEGORY_CONFIG[stat.category] || CATEGORY_CONFIG['other'];
          return (
            <div key={stat.category} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {config.label}
                </span>
                <span className="text-sm text-gray-500">
                  {stat.count}건 ({stat.percentage}%)
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stat.percentage}%`,
                    backgroundColor: config.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-[#081429] mb-4">
        카테고리별 상담
      </h3>

      {totalCount === 0 ? (
        <div className="text-center text-gray-400 py-8">
          상담 기록이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {sortedStats.map((stat) => {
            const config = CATEGORY_CONFIG[stat.category] || CATEGORY_CONFIG['other'];
            return (
              <div key={stat.category} className="flex items-center gap-3">
                <span
                  className="text-xs font-medium w-16 truncate"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${stat.percentage}%`,
                      backgroundColor: config.color,
                    }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">
                  {stat.count}건
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 text-right">
        <span className="text-sm text-gray-500">
          총 <span className="font-semibold text-[#081429]">{totalCount}</span>건
        </span>
      </div>
    </div>
  );
};

export default CategoryStats;
