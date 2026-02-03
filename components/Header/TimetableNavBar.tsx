/**
 * TimetableNavBar - Timetable mode sub-navigation bar
 * Extracted from App.tsx Phase 5
 */

import React from 'react';
import { Settings, ClipboardList, User as UserIcon, Building, Calendar as CalendarIcon } from 'lucide-react';
import { SubjectType } from '../../types';

interface TimetableNavBarProps {
  timetableSubject: SubjectType;
  setTimetableSubject: (value: SubjectType) => void;
  timetableViewType: 'teacher' | 'room' | 'class';
  setTimetableViewType: React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class'>>;
  mathViewMode: 'day-based' | 'teacher-based';
  setMathViewMode: (value: 'day-based' | 'teacher-based') => void;
  hasPermission: (perm: string) => boolean;
  setIsTimetableSettingsOpen: (value: boolean) => void;
}

export const TimetableNavBar: React.FC<TimetableNavBarProps> = ({
  timetableSubject,
  setTimetableSubject,
  timetableViewType,
  setTimetableViewType,
  mathViewMode,
  setMathViewMode,
  hasPermission,
  setIsTimetableSettingsOpen,
}) => {
  return (
    <div className="bg-[#081429] h-10 flex items-center px-6 border-b border-gray-700 relative z-30 text-xs">
      {/* Main Filter Toggle - Only show for Math */
        /* Removed Global Option Settings Button */
      }

      {/* Current Settings Summary - Clickable Toggles */}
      <div className="flex items-center gap-2 px-4 overflow-hidden flex-1">
        {/* Subject Select Dropdown */}
        <select
          value={timetableSubject}
          onChange={(e) => setTimetableSubject(e.target.value as SubjectType)}
          className="px-2 py-0.5 rounded bg-[#fdb813] text-[#081429] font-bold text-xs hover:brightness-110 transition-all cursor-pointer border-none outline-none"
          title="과목 선택"
        >
          {hasPermission('timetable.math.view') && (
            <option value="math">수학</option>
          )}
          {hasPermission('timetable.english.view') && (
            <option value="english">영어</option>
          )}
          {hasPermission('timetable.science.view') && (
            <option value="science">과학</option>
          )}
          {hasPermission('timetable.korean.view') && (
            <option value="korean">국어</option>
          )}
        </select>

        {/* View Type Toggle Button - 영어: 통합 → 강사뷰 → 강의실뷰 */}
        {timetableSubject === 'english' && (
          <button
            onClick={() => {
              const canViewIntegrated = hasPermission('timetable.integrated.view') || hasPermission('timetable.english.view');
              setTimetableViewType(prev => {
                if (prev === 'class') return 'teacher';
                if (prev === 'teacher') return 'room';
                return canViewIntegrated ? 'class' : 'teacher';
              });
            }}
            className="px-2 py-0.5 rounded bg-[#081429] border border-gray-700 text-gray-300 font-bold text-xs hover:bg-gray-700 active:scale-95 transition-all cursor-pointer"
            title="클릭하여 보기방식 전환"
          >
            {timetableViewType === 'class'
              ? <><ClipboardList size={12} className="inline" /> 통합뷰</>
              : timetableViewType === 'teacher'
                ? <><UserIcon size={12} className="inline" /> 강사</>
                : <><Building size={12} className="inline" /> 강의실</>}
          </button>
        )}

        {/* Math View Mode Toggle Button - 수학: 통합 → 강사 → 날짜 */}
        {timetableSubject === 'math' && (
          <button
            onClick={() => {
              if (timetableViewType === 'class') {
                setTimetableViewType('teacher');
                setMathViewMode('teacher-based');
              } else if (mathViewMode === 'teacher-based') {
                setMathViewMode('day-based');
              } else {
                setTimetableViewType('class');
              }
            }}
            className="px-2 py-0.5 rounded bg-[#081429] border border-gray-700 text-gray-300 font-bold text-xs hover:bg-gray-700 active:scale-95 transition-all cursor-pointer"
            title="클릭하여 보기방식 전환"
          >
            {timetableViewType === 'class'
              ? <><ClipboardList size={12} className="inline" /> 통합뷰</>
              : mathViewMode === 'teacher-based'
                ? <><UserIcon size={12} className="inline" /> 강사</>
                : <><CalendarIcon size={12} className="inline" /> 날짜</>}
          </button>
        )}

        {/* Spacer to push settings button to the right */}
        <div className="flex-1"></div>

        {/* Timetable Settings Button - 수업 설정만 */}
        <button
          onClick={() => setIsTimetableSettingsOpen(true)}
          className="p-1 rounded bg-[#081429] border border-gray-700 text-white hover:bg-gray-700 active:scale-95 transition-all cursor-pointer"
          title="수업 설정"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Settings Button removed - TimetableHeader에 설정 버튼이 있음 */}
    </div>
  );
};
