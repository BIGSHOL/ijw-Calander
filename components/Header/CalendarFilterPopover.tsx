/**
 * CalendarFilterPopover - Department filter popover panel
 * Extracted from App.tsx Phase 5
 */

import React from 'react';
import { Filter, Star, Eye, EyeOff, ChevronUp } from 'lucide-react';
import { Department, UserProfile } from '../../types';

interface CalendarFilterPopoverProps {
  isFilterOpen: boolean;
  setIsFilterOpen: (value: boolean) => void;
  departments: Department[];
  hiddenDeptIds: string[];
  effectiveProfile: UserProfile | undefined;
  isMaster: boolean;
  selectedCategory: string | null;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string | null>>;
  uniqueCategories: string[];
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (value: boolean) => void;
  toggleDeptVisibility: (deptId: string) => void;
  setAllVisibility: (visible: boolean) => void;
  toggleFavorite: (deptId: string) => void;
}

export const CalendarFilterPopover: React.FC<CalendarFilterPopoverProps> = ({
  isFilterOpen,
  setIsFilterOpen,
  departments,
  hiddenDeptIds,
  effectiveProfile,
  isMaster,
  selectedCategory,
  setSelectedCategory,
  uniqueCategories,
  showFavoritesOnly,
  setShowFavoritesOnly,
  toggleDeptVisibility,
  setAllVisibility,
  toggleFavorite,
}) => {
  if (!isFilterOpen) return null;

  return (
    <div className="absolute top-[104px] left-0 w-full bg-[#1e293b]/95 backdrop-blur-xl border-b border-gray-700 shadow-2xl p-6 z-10 animate-in slide-in-from-top-2 duration-200">
      <div className="w-full h-full">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Filter size={16} className="text-[#fdb813]" /> 부서 선택
            </h3>

            {/* Category Filter Chips */}
            {uniqueCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 animate-in fade-in duration-300">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1 rounded-sm text-xs font-bold transition-all border ${selectedCategory === null
                    ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                    : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                    }`}
                >
                  전체
                </button>
                {uniqueCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(prev => prev === cat ? null : cat)}
                    className={`px-3 py-1 rounded-sm text-xs font-bold transition-all border ${selectedCategory === cat
                      ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                      : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 items-center">
            {/* Favorites Only Toggle */}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-bold border transition-all ${showFavoritesOnly
                ? 'bg-[#fdb813] text-[#081429] border-[#fdb813]'
                : 'bg-transparent text-gray-400 border-gray-700 hover:border-[#fdb813]/50'
                }`}
            >
              <Star size={12} className={showFavoritesOnly ? 'fill-current' : ''} />
              즐겨찾기만
            </button>
            <button onClick={() => setAllVisibility(true)} className="px-3 py-1.5 rounded bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20 hover:bg-green-500/20">
              모두 켜기
            </button>
            <button onClick={() => setAllVisibility(false)} className="px-3 py-1.5 rounded bg-red-500/10 text-red-500 text-xs font-bold border border-red-500/20 hover:bg-red-500/20">
              모두 끄기
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {departments
            .filter(d => !selectedCategory || d.category === selectedCategory)
            .map(dept => {
              const isHidden = hiddenDeptIds.includes(dept.id);
              const isAllowed = effectiveProfile?.departmentPermissions?.[dept.id] || effectiveProfile?.allowedDepartments?.includes(dept.id) || isMaster;
              const isFavorite = effectiveProfile?.favoriteDepartments?.includes(dept.id);

              if (!isAllowed) return null;

              return (
                <div
                  key={dept.id}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-sm border text-xs font-bold transition-all
                    ${isHidden
                      ? 'bg-transparent border-gray-700 text-gray-500'
                      : 'bg-[#081429] border-[#fdb813]/30 text-white shadow-sm ring-1 ring-[#fdb813]/20'
                    }
                  `}
                >
                  {/* Favorite Star */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(dept.id);
                    }}
                    className="hover:scale-110 transition-transform"
                  >
                    <Star
                      size={14}
                      className={isFavorite ? 'text-[#fdb813] fill-[#fdb813]' : 'text-gray-600 hover:text-[#fdb813]'}
                    />
                  </button>

                  {/* Toggle Visibility */}
                  <button
                    onClick={() => toggleDeptVisibility(dept.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <span className={`w-2 h-2 rounded-sm ${isHidden ? 'bg-gray-700' : ''}`} style={{ backgroundColor: !isHidden ? (dept.color?.startsWith('#') ? dept.color : 'white') : undefined }} />
                    <span className="truncate flex-1">{dept.name}</span>
                    {isHidden ? <EyeOff size={12} /> : <Eye size={12} className="text-[#fdb813]" />}
                  </button>
                </div>
              )
            })}
        </div>
      </div>

      {/* Close Handle */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full bg-[#1e293b] px-6 py-0.5 rounded-b-xl border-b border-x border-gray-700 cursor-pointer hover:bg-[#081429] transition-colors"
        onClick={() => setIsFilterOpen(false)}
      >
        <ChevronUp size={16} className="text-gray-400" />
      </div>
    </div>
  );
};
