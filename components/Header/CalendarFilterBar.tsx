/**
 * CalendarFilterBar - Calendar mode filter bar (Row 2)
 * Extracted from App.tsx Phase 5
 */

import React from 'react';
import { Filter, ChevronUp, ChevronDown, CheckCircle2, Settings } from 'lucide-react';
import { Department } from '../../types';
import { ViewMode } from '../../hooks/useAppState';

interface CalendarFilterBarProps {
  isFilterOpen: boolean;
  setIsFilterOpen: (value: boolean) => void;
  hiddenDeptIds: string[];
  visibleDepartments: Department[];
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  viewColumns: 1 | 2 | 3;
  setViewColumns: (cols: 1 | 2 | 3) => void;
  setIsCalendarSettingsOpen: (value: boolean) => void;
}

export const CalendarFilterBar: React.FC<CalendarFilterBarProps> = ({
  isFilterOpen,
  setIsFilterOpen,
  hiddenDeptIds,
  visibleDepartments,
  viewMode,
  setViewMode,
  viewColumns,
  setViewColumns,
  setIsCalendarSettingsOpen,
}) => {
  return (
    <div className="bg-[#081429] h-10 flex items-center px-6 border-b border-gray-700 relative z-30 text-xs">

      {/* Main Filter Toggle */}
      <button
        onClick={() => setIsFilterOpen(!isFilterOpen)}
        className={`
          flex items-center gap-2 px-3 h-full border-r border-gray-700 hover:bg-white/5 transition-colors
          ${isFilterOpen ? 'text-[#fdb813] font-bold bg-white/5' : 'text-gray-300'}
        `}
      >
        <Filter size={14} />
        <span>부서 필터</span>
        {isFilterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Active Filters Summary */}
      <div className="flex items-center gap-2 px-4 overflow-hidden mask-linear-fade flex-1">
        {hiddenDeptIds.length === 0 ? (
          <span className="text-gray-400 flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-green-500" /> 모든 부서 표시중
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">표시됨:</span>
            {visibleDepartments.slice(0, 5).map(d => (
              <span key={d.id} className="px-1.5 py-0.5 rounded bg-[#081429] border border-gray-700 text-gray-300">
                {d.name}
              </span>
            ))}

            {visibleDepartments.length > 5 && (
              <span className="text-gray-500">+{visibleDepartments.length - 5} 더보기</span>
            )}
          </div>
        )}
      </div>

      {/* View Toggles - Moved from Top Header */}
      <div className="flex items-center gap-2 ml-auto pl-4 border-l border-gray-700 h-[24px] my-auto">
        {/* Daily/Weekly/Monthly */}
        <div className="flex bg-black/20 p-0.5 rounded-sm border border-white/5">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`
                px-2 py-0.5 rounded-sm text-xs font-bold transition-all
                ${viewMode === m
                  ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {m === 'daily' && '일간'}
              {m === 'weekly' && '주간'}
              {m === 'monthly' && '월별'}
              {m === 'yearly' && '연간'}
            </button>
          ))}
        </div>

        {/* Column View Toggle (1단/2단/3단) */}
        <div className="flex bg-black/20 p-0.5 rounded-sm border border-white/5">
          {([1, 2, 3] as const)
            .filter(cols => viewMode !== 'yearly' || cols !== 3)
            .map((cols) => (
              <button
                key={cols}
                onClick={() => setViewColumns(cols)}
                className={`
                  px-2 py-0.5 rounded-sm text-xs font-bold transition-all
                  ${viewColumns === cols
                    ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                {cols}단
              </button>
            ))}
        </div>

        {/* Settings Button - 우측 끝 */}
        <button
          onClick={() => setIsCalendarSettingsOpen(true)}
          className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-sm transition-colors ml-2"
          title="연간 일정 설정"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
};
