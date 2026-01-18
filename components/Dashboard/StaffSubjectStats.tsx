import React from 'react';
import { StaffSubjectStat } from '../../hooks/useConsultationStats';

interface StaffSubjectStatsProps {
  stats: StaffSubjectStat[];
  loading?: boolean;
  minimal?: boolean;
}

/**
 * 선생님별 과목별 상담 횟수 컴포넌트
 * - 컴팩트한 테이블 형태
 * - 수학/영어 구분 표시
 */
const StaffSubjectStats: React.FC<StaffSubjectStatsProps> = ({ stats = [], loading, minimal }) => {
  if (loading) {
    return minimal ? (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse"></div>
            <div className="flex-1">
              <div className="h-3 bg-gray-100 rounded w-16 mb-1 animate-pulse"></div>
              <div className="h-2 bg-gray-50 rounded w-12 animate-pulse"></div>
            </div>
            <div className="h-4 bg-gray-100 rounded w-8 animate-pulse"></div>
          </div>
        ))}
      </div>
    ) : (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="h-5 bg-gray-200 rounded w-32 mb-3 animate-pulse"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div className="h-4 bg-gray-100 rounded w-16 animate-pulse"></div>
              <div className="h-4 bg-blue-100 rounded w-10 animate-pulse"></div>
              <div className="h-4 bg-green-100 rounded w-10 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return minimal ? (
      <div className="text-center text-gray-400 py-8 text-sm">
        상담 기록 없음
      </div>
    ) : (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-[#081429] mb-2">선생님별 상담</h3>
        <p className="text-xs text-gray-400 text-center py-4">상담 기록 없음</p>
      </div>
    );
  }

  if (minimal) {
    return (
      <div className="space-y-3">
        {stats.slice(0, 5).map((staff, idx) => (
          <div
            key={staff.id}
            className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
              idx === 0 ? 'bg-amber-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              idx === 0 ? 'bg-amber-100 text-amber-700' :
              idx === 1 ? 'bg-gray-200 text-gray-600' :
              idx === 2 ? 'bg-orange-100 text-orange-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {staff.name}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="text-blue-600">수학 {staff.mathCount}</span>
                <span className="text-gray-300">|</span>
                <span className="text-emerald-600">영어 {staff.englishCount}</span>
              </div>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {staff.totalCount}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-[#081429] mb-3">선생님별 상담</h3>

      {/* 헤더 */}
      <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-2 px-1">
        <span className="w-16">이름</span>
        <span className="w-12 text-center">수학</span>
        <span className="w-12 text-center">영어</span>
        <span className="w-10 text-center">합계</span>
      </div>

      {/* 선생님 목록 */}
      <div className="space-y-1">
        {stats.map((staff, idx) => (
          <div
            key={staff.id}
            className={`flex items-center gap-2 px-1 py-1.5 rounded ${
              idx === 0 ? 'bg-[#fdb813]/10' : 'hover:bg-gray-50'
            }`}
          >
            <span className="w-16 text-xs font-medium text-[#081429] truncate">
              {idx === 0 && '🏆 '}{staff.name}
            </span>
            <span className="w-12 text-center">
              {staff.mathCount > 0 ? (
                <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">
                  {staff.mathCount}
                </span>
              ) : (
                <span className="text-[10px] text-gray-300">-</span>
              )}
            </span>
            <span className="w-12 text-center">
              {staff.englishCount > 0 ? (
                <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                  {staff.englishCount}
                </span>
              ) : (
                <span className="text-[10px] text-gray-300">-</span>
              )}
            </span>
            <span className="w-10 text-center text-xs font-bold text-[#081429]">
              {staff.totalCount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StaffSubjectStats;
