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
        {stats.slice(0, 5).map((staff, idx) => {
          // 과목별 표시 여부 (담당하는 과목만 표시)
          const hasMath = staff.mathTotal > 0;
          const hasEnglish = staff.englishTotal > 0;
          const mathPercentage = hasMath ? Math.round((staff.mathCount / staff.mathTotal) * 100) : 0;
          const englishPercentage = hasEnglish ? Math.round((staff.englishCount / staff.englishTotal) * 100) : 0;
          const totalPercentage = staff.totalNeeded > 0 ? Math.round((staff.totalCount / staff.totalNeeded) * 100) : 0;

          return (
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
                  {hasMath && (
                    <>
                      <span className="text-blue-600">
                        수학 {staff.mathCount}/{staff.mathTotal} ({mathPercentage}%)
                      </span>
                      {hasEnglish && <span className="text-gray-300">|</span>}
                    </>
                  )}
                  {hasEnglish && (
                    <span className="text-emerald-600">
                      영어 {staff.englishCount}/{staff.englishTotal} ({englishPercentage}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {staff.totalCount}
                </div>
                <div className="text-xxs text-gray-500">
                  /{staff.totalNeeded} ({totalPercentage}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-[#081429] mb-5">선생님별 상담 통계</h3>

      {/* 선생님 목록 - 대시보드 스타일 */}
      <div className="space-y-3">
        {stats.map((staff, idx) => {
          const hasMath = staff.mathTotal > 0;
          const hasEnglish = staff.englishTotal > 0;
          const mathPercentage = hasMath ? Math.round((staff.mathCount / staff.mathTotal) * 100) : 0;
          const englishPercentage = hasEnglish ? Math.round((staff.englishCount / staff.englishTotal) * 100) : 0;
          const totalPercentage = staff.totalNeeded > 0 ? Math.round((staff.totalCount / staff.totalNeeded) * 100) : 0;

          return (
            <div
              key={staff.id}
              className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                idx === 0 ? 'bg-amber-50 border border-amber-200' :
                idx === 1 ? 'bg-gray-50 border border-gray-200' :
                idx === 2 ? 'bg-orange-50 border border-orange-200' :
                'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {/* 순위 뱃지 */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                idx === 0 ? 'bg-amber-100 text-amber-700' :
                idx === 1 ? 'bg-gray-200 text-gray-600' :
                idx === 2 ? 'bg-orange-100 text-orange-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {idx + 1}
              </div>

              {/* 선생님 정보 */}
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-gray-900 mb-1">
                  {staff.name}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {hasMath && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-600">수학</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-medium rounded">
                        {staff.mathCount}/{staff.mathTotal}
                      </span>
                      <span className="text-blue-600 font-medium">
                        ({mathPercentage}%)
                      </span>
                    </div>
                  )}
                  {hasMath && hasEnglish && (
                    <span className="text-gray-300">|</span>
                  )}
                  {hasEnglish && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-600">영어</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-medium rounded">
                        {staff.englishCount}/{staff.englishTotal}
                      </span>
                      <span className="text-emerald-600 font-medium">
                        ({englishPercentage}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 합계 */}
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {staff.totalCount}
                </div>
                <div className="text-xs text-gray-500">
                  /{staff.totalNeeded} ({totalPercentage}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StaffSubjectStats;
