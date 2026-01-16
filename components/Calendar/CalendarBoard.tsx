import React, { useMemo, useEffect } from 'react';
import { format, setMonth, setYear, isToday, isPast, isFuture, parseISO, startOfDay, endOfDay, isSameDay, addDays, subDays, differenceInMinutes, setHours, setMinutes, getHours, getMinutes, getDaysInMonth, getDate, setDate, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears } from 'date-fns';
import { ko } from 'date-fns/locale';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Department, CalendarEvent, UserProfile, DEFAULT_ROLE_PERMISSIONS, DEFAULT_EVENT_TAGS } from '../../types';
import { getMonthWeeks } from '../../utils/dateUtils';
import WeekBlock from './WeekBlock';
import MyEventsModal from './MyEventsModal'; // Import
import CustomSelect from './CustomSelect'; // Import CustomSelect
import CalendarSettingsModal from './CalendarSettingsModal'; // Import CalendarSettingsModal
import { Archive, Clock, Users, Edit3, ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Search, Filter, X, Check, Settings } from 'lucide-react';
import { EVENT_COLORS } from '../../constants';
import YearlyView from './YearlyView'; // Import YearlyView
import { useArchivedEvents } from '../../hooks/useArchivedEvents'; // Phase 9: Archiving Hook

interface CalendarBoardProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  departments: Department[];
  events: CalendarEvent[];
  onCellClick: (date: string, deptId: string) => void;
  onRangeSelect: (startDate: string, endDate: string, deptId: string) => void;
  onTimeSlotClick: (date: string, time: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  isPrintMode?: boolean;
  viewMode: 'daily' | 'weekly' | 'monthly' | 'yearly';
  onViewChange?: (mode: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
  holidays?: any[];
  currentUser: UserProfile | null;
  // Event Drag Props
  onEventMove?: (original: CalendarEvent, updated: CalendarEvent) => void;
  canEditDepartment?: (deptId: string) => boolean;
  pendingEventIds?: string[];
  isPrimaryView?: boolean; // Only show "My Events" button on primary view
  showSidePanel?: boolean; // Control side panel visibility
  onQuickAdd?: (date: Date) => void; // Quick Add: Click date in yearly view
  // Bucket List Props
  bucketItems?: { id: string; title: string; targetMonth: string; priority: 'high' | 'medium' | 'low'; createdAt: string; authorId?: string; authorName?: string }[];
  onAddBucket?: (title: string, targetMonth: string, priority: 'high' | 'medium' | 'low') => void;
  onEditBucket?: (id: string, title: string, priority: 'high' | 'medium' | 'low') => void;
  onDeleteBucket?: (id: string) => void;
  onConvertBucket?: (bucket: { id: string; title: string; targetMonth: string; priority: 'high' | 'medium' | 'low' }) => void;
  // Phase 9: Archiving Prop
  showArchived?: boolean;
}



const DailyView: React.FC<{
  date: Date,
  events: CalendarEvent[],
  departments: Department[],
  onEventClick: (event: CalendarEvent) => void,
  onTimeSlotClick: (date: string, time: string) => void // New Prop
}> = ({ date, events, departments, onEventClick, onTimeSlotClick }) => {
  // Filter events for this day
  const todaysEvents = events.filter(e => {
    const start = parseISO(e.startDate);
    const end = parseISO(e.endDate);
    const target = startOfDay(date);
    return target >= startOfDay(start) && target <= startOfDay(end);
  });

  // Separate All-Day vs Time-Based
  // Robustness: Treat valid AllDay flag OR empty times as All Day
  const allDayEvents = todaysEvents.filter(e => e.isAllDay || (!e.startTime && !e.endTime));
  const timeEvents = todaysEvents.filter(e => !allDayEvents.includes(e));

  // Time Grid settings
  const HOUR_HEIGHT = 80;
  const START_HOUR = 0; // 00:00
  const END_HOUR = 24;  // 24:00

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden bg-white rounded-xl border border-gray-200">

      {/* 1. All Day Section */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10 shrink-0">
          <div className="w-16 p-2 text-xs font-bold text-gray-500 border-r border-gray-100 flex items-center justify-center bg-gray-50">
            하루종일
          </div>
          <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[120px]">
            {allDayEvents.map(event => {
              const primaryDept = departments.find(d => d.id === event.departmentId);
              const relatedDepts = event.departmentIds
                ? departments.filter(d => event.departmentIds?.includes(d.id))
                : (primaryDept ? [primaryDept] : []);

              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border-l-4 shadow-sm cursor-pointer hover:brightness-95 flex items-center gap-2 
                    ${primaryDept?.color && !primaryDept.color.startsWith('#') ? primaryDept.color : 'bg-gray-100 border-gray-300'}`}
                  style={{
                    backgroundColor: event.color?.startsWith('#') ? event.color : (primaryDept?.color?.startsWith('#') ? primaryDept.color : undefined),
                    borderLeftColor: event.borderColor?.startsWith('#') ? event.borderColor : (event.color?.startsWith('#') ? event.color : (primaryDept?.color?.startsWith('#') ? primaryDept.color : undefined)),
                    color: event.textColor || '#ffffff'
                  }}
                >
                  <span className="bg-white/50 px-1.5 rounded text-xxs uppercase tracking-wider text-inherit mix-blend-multiply opacity-80">All Day</span>
                  {relatedDepts.length > 1 && (
                    <div className="flex gap-1">
                      {relatedDepts.map(d => (
                        <span key={d.id} className="text-xxs bg-white/40 px-1 rounded text-inherit mix-blend-multiply border border-black/5">{d.name}</span>
                      ))}
                    </div>
                  )}
                  <span className="truncate">{event.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Timeline Grid */}
      <div className="flex-1 overflow-y-auto relative no-scrollbar">
        <div className="relative min-h-[1920px]"> {/* 24 * 80px */}

          {/* Background Grid Lines */}
          {Array.from({ length: 24 }).map((_, hour) => (
            <div
              key={hour}
              className="absolute w-full border-t border-gray-100 flex hover:bg-gray-50 cursor-pointer" // Add hover and pointer
              style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              onClick={() => {
                // Click to create event at this hour
                const timeStr = `${String(hour).padStart(2, '0')}:00`;
                onTimeSlotClick(format(date, 'yyyy-MM-dd'), timeStr);
              }}
            >
              <div className="w-16 shrink-0 text-xs font-bold text-gray-400 text-center -mt-2.5 bg-white pr-2 pointer-events-none">
                {String(hour).padStart(2, '0')}:00
              </div>
              <div className="flex-1" />
            </div>
          ))}

          {/* Time Events */}
          <div className="absolute top-0 left-16 right-0 bottom-0 pointer-events-none">
            {timeEvents.map(event => {
              if (!event.startTime || !event.endTime) return null;

              const startParts = event.startTime.split(':').map(Number);
              const endParts = event.endTime.split(':').map(Number);

              const startMinutes = startParts[0] * 60 + startParts[1];
              let endMinutes = endParts[0] * 60 + endParts[1];

              // Handle overnight or end of day
              if (endMinutes <= startMinutes) endMinutes = 24 * 60; // Just safeguard

              const top = (startMinutes * HOUR_HEIGHT) / 60;
              const height = ((endMinutes - startMinutes) * HOUR_HEIGHT) / 60;

              const primaryDept = departments.find(d => d.id === event.departmentId);
              const relatedDepts = event.departmentIds
                ? departments.filter(d => event.departmentIds?.includes(d.id))
                : (primaryDept ? [primaryDept] : []);

              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`absolute left-2 right-2 rounded-lg border-l-4 p-2 shadow-sm cursor-pointer hover:shadow-md transition-all overflow-hidden group z-10 pointer-events-auto
                    ${primaryDept?.color && !primaryDept.color.startsWith('#') ? primaryDept.color : 'bg-white border-gray-200'}`}
                  style={{
                    top: `${top}px`,
                    height: `${Math.max(height, 30)}px`,
                    backgroundColor: event.color?.startsWith('#') ? event.color : (primaryDept?.color?.startsWith('#') ? primaryDept.color : undefined),
                    borderLeftColor: event.borderColor?.startsWith('#') ? event.borderColor : (event.color?.startsWith('#') ? event.color : (primaryDept?.color?.startsWith('#') ? primaryDept.color : undefined)),
                    color: event.textColor || '#ffffff'
                  }}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-inherit opacity-90 flex items-center gap-1">
                        <Clock size={10} /> {event.startTime} - {event.endTime}
                      </span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {relatedDepts.map(d => (
                          <span key={d.id} className="text-xs font-extrabold uppercase bg-white/40 px-1.5 rounded text-inherit mix-blend-multiply shadow-sm border border-black/5">
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="font-bold text-sm text-inherit truncate mt-0.5">{event.title}</div>
                    <div className="text-xs text-gray-600 truncate mt-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Users size={10} /> {event.participants || '참석자 없음'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current Time Indicator (if Today) */}
          {isToday(date) && (
            <div
              className="absolute left-16 right-0 border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
              style={{ top: (getHours(new Date()) * 60 + getMinutes(new Date())) * (HOUR_HEIGHT / 60) }}
            >
              <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CalendarBoard: React.FC<CalendarBoardProps> = ({
  currentDate,
  onDateChange,
  departments,
  events,
  onCellClick,
  onRangeSelect,
  onTimeSlotClick,
  onEventClick,
  isPrintMode = false,
  viewMode,
  onViewChange,
  holidays = [],
  currentUser,
  onEventMove,
  canEditDepartment,
  pendingEventIds = [],
  isPrimaryView = true, // Default to true for backwards compatibility
  showSidePanel = true, // Default to true
  onQuickAdd, // Quick Add callback
  bucketItems = [], // Bucket List
  onAddBucket,
  onEditBucket,
  onDeleteBucket,
  onConvertBucket,
  showArchived = false, // Default to false if not provided
}) => {
  const [isMyEventsOpen, setIsMyEventsOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const weeks = getMonthWeeks(currentDate); // Restore weeks definition

  // Header Logic
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Phase 9: Archiving Integration - Now using Prop
  // const [showArchived, setShowArchived] = React.useState(false); // Removed local state
  const { events: archivedEvents, error: archivedError } = useArchivedEvents(showArchived, currentYear);

  // 아카이브 로딩 오류 시 콘솔 경고 (UI 차단 없이)
  useEffect(() => {
    if (archivedError) {
      console.warn('아카이브 이벤트 로딩 실패:', archivedError.message);
    }
  }, [archivedError]);

  // Merge active and archived events
  const allEvents = useMemo(() => {
    return showArchived ? [...events, ...archivedEvents] : events;
  }, [events, archivedEvents, showArchived]);

  // --- Search & Filter Logic Start ---
  // A. Input State (Pending)
  const [searchQueryInput, setSearchQueryInput] = React.useState('');
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [selectedDeptsInput, setSelectedDeptsInput] = React.useState<string[]>([]);

  // Smart Date Range State (Defaults: Today, 1 Week, Before)
  // Ensure we have a stable initial date to avoid hydration mismatches
  const [filterBaseDateInput, setFilterBaseDateInput] = React.useState<Date | null>(() => new Date());
  const [filterDurationInput, setFilterDurationInput] = React.useState<'1w' | '1m' | '1y' | null>('1w');
  const [filterDirectionInput, setFilterDirectionInput] = React.useState<'before' | 'after'>('before');

  // B. Active State (Applied) - Used for filtering
  const [activeSearch, setActiveSearch] = React.useState({
    query: '',
    depts: [] as string[],
    baseDate: null,
    duration: null,
    direction: 'before' as 'before' | 'after'
  });

  // Apply filters handler
  const handleApplyFilter = () => {
    setActiveSearch({
      query: searchQueryInput,
      depts: selectedDeptsInput,
      baseDate: filterBaseDateInput,
      duration: filterDurationInput,
      direction: filterDirectionInput
    });
    setIsFilterOpen(false);
  };

  // Reset handler
  const handleResetFilter = () => {
    setSearchQueryInput('');
    setSelectedDeptsInput([]);
    setFilterBaseDateInput(new Date());
    setFilterDurationInput('1w');
    setFilterDirectionInput('before');
  };

  // Global ESC Handler for Search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Priority 1: If Results are visible, Clear Results & Return to Filter Input Mode
        if (activeSearch.query || activeSearch.depts.length > 0 || activeSearch.baseDate) {
          handleResetFilter(); // Reset Inputs to Defaults
          setActiveSearch({ query: '', depts: [], baseDate: null, duration: null, direction: 'before' }); // Clear Active Results
          setIsFilterOpen(true); // Open Filter Panel (Search Mode)
        }
        // Priority 2: If No Results but Filter is Open, Close Filter
        else if (isFilterOpen) {
          setIsFilterOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFilterOpen, activeSearch]);



  // Filter visible departments based on permissions
  const visibleDepartments = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'master' || currentUser.role === 'admin') return departments;

    const rolePerms = DEFAULT_ROLE_PERMISSIONS[currentUser.role as keyof typeof DEFAULT_ROLE_PERMISSIONS];
    const canViewAll = rolePerms?.['departments.view_all'];

    if (canViewAll) return departments;

    return departments.filter(d => {
      const perm = currentUser.departmentPermissions?.[d.id];
      return perm === 'view' || perm === 'edit';
    });
  }, [departments, currentUser]);

  const filteredEvents = useMemo(() => {
    // Determine which criteria to use
    const { query: q, depts, baseDate, duration, direction } = activeSearch;

    // Only filter if there is active criteria
    const hasSearch = !!q || depts.length > 0 || !!baseDate;

    if (!hasSearch) {
      return [];
    }

    // Calculate Date Range based on smart filter
    let startRange: Date | null = null;
    let endRange: Date | null = null;

    if (baseDate && duration) {
      const base = startOfDay(baseDate);
      if (direction === 'after') {
        startRange = base;
        if (duration === '1w') endRange = addWeeks(base, 1);
        else if (duration === '1m') endRange = addMonths(base, 1);
        else if (duration === '1y') endRange = addYears(base, 1);
      } else {
        endRange = endOfDay(base);
        if (duration === '1w') startRange = subWeeks(base, 1);
        else if (duration === '1m') startRange = subMonths(base, 1);
        else if (duration === '1y') startRange = subYears(base, 1);
      }
    }

    return allEvents.filter(e => {
      // 1. Text Search (including tags)
      const queryText = q.toLowerCase();
      // Check if query matches any tag (supports both #tag and tag format)
      const cleanQuery = queryText.startsWith('#') ? queryText.slice(1) : queryText;
      const matchesTags = e.tags && e.tags.some(tagId => {
        const tagDef = DEFAULT_EVENT_TAGS.find(t => t.id === tagId);
        return tagId.toLowerCase().includes(cleanQuery) ||
          (tagDef && tagDef.name.toLowerCase().includes(cleanQuery));
      });
      const matchesText = !q ||
        e.title.toLowerCase().includes(queryText) ||
        (e.description && e.description.toLowerCase().includes(queryText)) ||
        (e.participants && typeof e.participants === 'string' && e.participants.toLowerCase().includes(queryText)) ||
        matchesTags;

      // 2. Department Filter
      const matchesDept = depts.length === 0 ||
        (e.departmentId && depts.includes(e.departmentId));

      // 3. Date Range Filter
      let matchesDate = true;
      if (startRange && endRange) {
        const eventStart = parseISO(e.startDate);
        matchesDate = eventStart >= startRange && eventStart <= endRange;
      }

      return matchesText && matchesDept && matchesDate;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [allEvents, activeSearch]);
  // --- Search & Filter Logic End ---


  // Handle year navigation for Yearly View
  const handleYearPrev = () => onDateChange(setYear(currentDate, currentYear - 1));
  const handleYearNext = () => onDateChange(setYear(currentDate, currentYear + 1));

  const yearOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => ({
    label: `${currentYear - 5 + i} 년`,
    value: currentYear - 5 + i
  })), [currentYear]);

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1} 월`,
    value: i
  })), []);

  const weekOptions = useMemo(() => {
    const weeks = getMonthWeeks(currentDate);
    return weeks.map((_, idx) => ({
      label: `${idx + 1} 주차`,
      value: idx
    }));
  }, [currentDate]);

  const dayOptions = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentDate);
    return Array.from({ length: daysInMonth }, (_, i) => ({
      label: `${i + 1} 일`,
      value: i + 1
    }));
  }, [currentDate]);


  const handlePrev = () => {
    if (viewMode === 'daily') onDateChange(subDays(currentDate, 1));
    else if (viewMode === 'weekly') onDateChange(subDays(currentDate, 7));
    else onDateChange(setMonth(currentDate, currentMonth - 1));
  };

  const handleNext = () => {
    if (viewMode === 'daily') onDateChange(addDays(currentDate, 1));
    else if (viewMode === 'weekly') onDateChange(addDays(currentDate, 7));
    else onDateChange(setMonth(currentDate, currentMonth + 1));
  };


  return (
    <div className="@container flex-1 bg-white shadow-xl print:shadow-none p-2 @sm:p-4 @lg:p-8 print:p-0 rounded-2xl border border-gray-200 print:border-none min-w-[280px] flex flex-col overflow-hidden">

      {/* Yearly View Content */}
      {viewMode === 'yearly' ? (
        <YearlyView
          currentDate={currentDate}
          events={allEvents}
          onDateChange={onDateChange}
          onViewChange={onViewChange || (() => { })}
          departments={departments}
          onQuickAdd={onQuickAdd}
          bucketItems={bucketItems}
          onAddBucket={onAddBucket}
          onEditBucket={onEditBucket}
          onDeleteBucket={onDeleteBucket}
          onConvertBucket={onConvertBucket}
        />
      ) : (
        <>
          {/* Unified Header */}
          <div className="mb-1 @sm:mb-2 @lg:mb-4 flex flex-row justify-between items-center gap-1 @sm:gap-2 @lg:gap-4 sticky top-0 z-30 bg-white py-1 @sm:py-2 -mx-2 @sm:-mx-4 @lg:-mx-8 px-2 @sm:px-4 @lg:px-8 border-b border-gray-100">

            {/* Navigation Group (Left) */}
            <div className="flex items-center gap-0.5 p-0.5 @xs:p-1 @sm:p-1.5 bg-[#f8fafc] rounded-lg @sm:rounded-xl @lg:rounded-2xl border border-gray-200 shadow-sm flex-none">
              <button
                onClick={handlePrev}
                className="p-1 @xs:p-1.5 @sm:p-2 hover:bg-white hover:text-[#fdb813] hover:shadow-md rounded-md @sm:rounded-lg @lg:rounded-xl transition-all text-gray-400 hover:text-[#081429]"
              >
                <ChevronLeft size={14} className="@sm:w-4 @sm:h-4 @lg:w-5 @lg:h-5" strokeWidth={3} />
              </button>

              <div className="flex items-center justify-center px-0.5">
                {/* Year Selector */}
                <CustomSelect
                  value={currentYear}
                  options={yearOptions}
                  onChange={(y) => onDateChange(setYear(currentDate, y))}
                />
                {/* Month Selector */}
                <CustomSelect
                  value={currentMonth}
                  options={monthOptions}
                  onChange={(m) => onDateChange(setMonth(currentDate, m))}
                />
                {/* Weekly Selector */}
                {viewMode === 'weekly' && (
                  <CustomSelect
                    value={getMonthWeeks(currentDate).findIndex(w => w.some(d => isSameDay(d, currentDate)))}
                    options={weekOptions}
                    onChange={(weekIdx) => {
                      const weeks = getMonthWeeks(currentDate);
                      // Set to first day of selected week
                      if (weeks[weekIdx] && weeks[weekIdx][0]) {
                        onDateChange(weeks[weekIdx][0]);
                      }
                    }}
                  />
                )}
                {/* Daily Selector */}
                {viewMode === 'daily' && (
                  <CustomSelect
                    value={getDate(currentDate)}
                    options={dayOptions}
                    onChange={(d) => onDateChange(setDate(currentDate, d))}
                  />
                )}
              </div>

              <button
                onClick={handleNext}
                className="p-1 @xs:p-1.5 @sm:p-2 hover:bg-white hover:text-[#fdb813] hover:shadow-md rounded-md @sm:rounded-lg @lg:rounded-xl transition-all text-gray-400 hover:text-[#081429]"
              >
                <ChevronRight size={14} className="@sm:w-4 @sm:h-4 @lg:w-5 @lg:h-5" strokeWidth={3} />
              </button>
            </div>

            {isPrimaryView && (
              <div className="hidden @lg:block flex-1 w-full max-w-md relative z-30 mx-2">
                <div className="flex items-center gap-2 w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="일정 검색..."
                      value={searchQueryInput}
                      onChange={(e) => setSearchQueryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleApplyFilter();
                          setIsFilterOpen(false);
                        }
                      }}
                      onFocus={() => setIsFilterOpen(true)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#fdb813]/50 transition-all font-medium text-sm"
                    />



                    {searchQueryInput && (
                      <button
                        onClick={() => setSearchQueryInput('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`p-2 rounded-xl border transition-all flex items-center gap-2 font-bold whitespace-nowrap ${isFilterOpen || activeSearch.depts.length > 0 || activeSearch.baseDate ? 'bg-[#081429] text-white border-[#081429]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    <Filter size={18} />
                    <span className="hidden md:inline text-sm">필터</span>
                    {(activeSearch.depts.length > 0 || activeSearch.baseDate) && (
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </button>
                </div>

                {/* Filter Panel */}
                {isFilterOpen && (
                  <div className="absolute top-full left-0 right-0 mt-3 p-4 bg-white border border-gray-200 rounded-xl shadow-lg animate-in slide-in-from-top-2 z-40">

                    {/* 1. Category Filter (Departments) */}
                    <div className="mb-4">
                      <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider flex justify-between items-center">
                        <span>카테고리</span>

                        {selectedDeptsInput.length > 0 && (
                          <button onClick={() => setSelectedDeptsInput([])} className="text-xxs text-gray-400 hover:text-red-500">초기화</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {visibleDepartments.map(dept => (
                          <button
                            key={dept.id}
                            onClick={() => {
                              if (selectedDeptsInput.includes(dept.id)) setSelectedDeptsInput(selectedDeptsInput.filter(id => id !== dept.id));
                              else setSelectedDeptsInput([...selectedDeptsInput, dept.id]);
                            }}
                            className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${selectedDeptsInput.includes(dept.id)
                              ? 'bg-[#081429] text-white border-[#081429]'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {dept.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Smart Date Filter */}
                    <div>
                      <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider flex justify-between items-center">
                        <span>기간 설정</span>

                        {(filterBaseDateInput || filterDurationInput) && (
                          <button onClick={() => { setFilterBaseDateInput(null); setFilterDurationInput(null); }} className="text-xxs text-gray-400 hover:text-red-500">초기화</button>
                        )}
                      </div>
                      <div className="flex flex-col gap-3">
                        {/* Base Date */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600 w-12 shrink-0">기준일:</span>
                          <div className="bg-gray-100 rounded-lg px-2 py-1 flex items-center gap-2">
                            <CalendarIcon size={14} className="text-gray-400" />
                            <input
                              type="date"
                              value={filterBaseDateInput ? format(filterBaseDateInput, 'yyyy-MM-dd') : ''}
                              onChange={(e) => setFilterBaseDateInput(e.target.valueAsDate)}
                              className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Duration & Direction */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-gray-600 w-12 shrink-0">범위:</span>
                          <div className="flex bg-gray-100 p-0.5 rounded-lg">
                            {(['1w', '1m', '1y'] as const).map(d => (
                              <button
                                key={d}
                                onClick={() => setFilterDurationInput(d)}
                                className={`px-3 py-1 rounded text-xs font-bold transition-all ${filterDurationInput === d ? 'bg-white shadow text-[#081429]' : 'text-gray-500 hover:text-gray-700'}`}
                              >
                                {d === '1w' ? '1주일' : d === '1m' ? '1개월' : '1년'}
                              </button>
                            ))}
                          </div>
                          <div className="flex bg-gray-100 p-0.5 rounded-lg">
                            <button onClick={() => setFilterDirectionInput('before')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${filterDirectionInput === 'before' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>이전</button>
                            <button onClick={() => setFilterDirectionInput('after')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${filterDirectionInput === 'after' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>이후</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Search Button */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2">
                      <button
                        onClick={handleResetFilter}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        초기화
                      </button>
                      <button
                        onClick={handleApplyFilter}
                        className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-[#081429] hover:bg-[#081429]/90 shadow-lg shadow-[#081429]/20 transition-all flex items-center gap-2"
                      >
                        <Search size={14} />
                        조회하기
                      </button>
                    </div>

                  </div>
                )}

                {/* Search Results Panel - Option B */}
                {/* Search Results Panel - Option B */}
                {(filteredEvents.length > 0) && (activeSearch.query || activeSearch.depts.length > 0 || activeSearch.baseDate) && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-[400px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 p-2 z-50">
                    <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 backdrop-blur-sm rounded-t-lg">
                      <span className="text-xs font-bold text-gray-500">검색 결과 ({filteredEvents.length}건)</span>
                      <button onClick={() => {
                        // Reset Inputs to Defaults (User Request: "Default values")
                        handleResetFilter();
                        // Clear Active Search (So results disappear)
                        setActiveSearch({ query: '', depts: [], baseDate: null, duration: null, direction: 'before' });
                        // Re-open Filter Panel (Search Mode)
                        setIsFilterOpen(true);
                      }} className="text-xxs text-indigo-500 hover:underline">
                        모두 지우기
                      </button>
                    </div>
                    <div className="space-y-1 mt-2">
                      {filteredEvents.map(event => {
                        const primaryDept = departments.find(d => d.id === event.departmentId);
                        return (
                          <div
                            key={event.id}
                            onClick={() => {
                              onDateChange(parseISO(event.startDate));
                              setIsFilterOpen(false);
                            }}
                            className="p-2 hover:bg-indigo-50 cursor-pointer rounded-lg group transition-colors border border-transparent hover:border-indigo-100"
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xxs font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 group-hover:bg-white transition-colors">
                                {format(parseISO(event.startDate), 'yyyy. MM. dd (EEE)', { locale: ko })}
                              </span>
                              <span className="text-xxs text-gray-400">
                                {event.startTime ? `${event.startTime} - ${event.endTime} ` : '하루종일'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-1 h-6 rounded-full shrink-0"
                                style={{ backgroundColor: event.color || primaryDept?.color }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-xs text-gray-800 truncate group-hover:text-indigo-700 transition-colors">
                                  {event.title}
                                </div>
                                {event.description && event.description !== event.title && (
                                  <div className="text-xxs text-gray-500 truncate">{event.description}</div>
                                )}
                              </div>
                              {/* Tags Display */}
                              {event.tags && event.tags.length > 0 && (
                                <div className="flex gap-1 flex-shrink-0">
                                  {event.tags.slice(0, 2).map(tagId => {
                                    const tagDef = DEFAULT_EVENT_TAGS.find(t => t.id === tagId);
                                    return (
                                      <span
                                        key={tagId}
                                        className="text-micro px-1.5 py-0.5 rounded-full font-bold"
                                        style={{
                                          backgroundColor: tagDef?.color ? `${tagDef.color}20` : '#E5E7EB',
                                          color: tagDef?.color || '#6B7280',
                                        }}
                                      >
                                        #{tagDef?.name || tagId}
                                      </span>
                                    );
                                  })}
                                  {event.tags.length > 2 && (
                                    <span className="text-micro text-gray-400">+{event.tags.length - 2}</span>
                                  )}
                                </div>
                              )}
                              {primaryDept && (
                                <span className="text-xxs px-2 py-1 rounded bg-gray-50 font-medium text-gray-500 whitespace-nowrap">
                                  {primaryDept.name}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* No Results State */}
                {(filteredEvents.length === 0) && (activeSearch.query) && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-8 text-center animate-in fade-in zoom-in-95 z-50">
                    <Search size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 font-bold text-sm">검색 결과가 없습니다.</p>
                    <p className="text-xs text-gray-400 mt-1">다른 검색어나 필터를 사용해보세요.</p>
                  </div>
                )}
              </div>
            )}

            {/* Right Action Group (Right) - Only show My Events on Primary View */}
            {isPrimaryView && (
              <div className="flex items-center gap-1 @sm:gap-2 @lg:gap-3 w-auto justify-end flex-none">
                <div className="hidden @xl:flex text-xs @2xl:text-sm font-bold text-[#081429] uppercase tracking-widest bg-[#fdb813]/10 px-2 @2xl:px-4 py-1.5 @2xl:py-2 rounded-lg @2xl:rounded-xl border border-[#fdb813]/20">
                  {format(currentDate, 'yyyy. MM')}
                </div>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1 @sm:gap-1.5 @lg:gap-2 bg-gray-700 hover:bg-gray-600 text-white px-1.5 @xs:px-2 @sm:px-3 py-1.5 @sm:py-2 rounded-lg @sm:rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-[10px] @xs:text-xs @lg:text-sm"
                  title="연간 일정 설정"
                >
                  <Settings size={14} className="@sm:w-4 @sm:h-4" />
                  <span className="hidden @sm:inline">설정</span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsMyEventsOpen(true)}
                    className="flex items-center gap-1 @sm:gap-1.5 @lg:gap-2 bg-[#081429] hover:bg-[#081429]/90 text-white px-1.5 @xs:px-2 @sm:px-3 @lg:px-5 py-1.5 @sm:py-2 @lg:py-2.5 rounded-lg @sm:rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-[10px] @xs:text-xs @lg:text-sm transform hover:-translate-y-0.5"
                  >
                    <List size={14} className="text-[#fdb813] @sm:w-4 @sm:h-4" />
                    <span className="hidden @sm:inline">내 일정</span>
                  </button>
                  {/* Notification Badge */}
                  {(() => {
                    // ... existing badge logic ...
                    if (!currentUser) return null;
                    const pendingCount = events.filter(e => {
                      const isRelevant = (e.attendance && e.attendance[currentUser.uid]) ||
                        (e.participants && e.participants.includes(currentUser.email.split('@')[0]));
                      if (!isRelevant) return false;
                      const status = e.attendance ? e.attendance[currentUser.uid] : 'pending';
                      return status === 'pending' || !status;
                    }).length;
                    if (pendingCount === 0) return null;
                    return (
                      <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xxs font-extrabold px-1.5 h-4 min-w-[16px] flex items-center justify-center rounded-full shadow-sm ring-2 ring-white animate-pulse">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

          </div>

          {/* My Events Modal */}
          <MyEventsModal
            isOpen={isMyEventsOpen}
            onClose={() => setIsMyEventsOpen(false)}
            events={allEvents}
            currentUser={currentUser}
            onEventClick={onEventClick}
          />

          {/* Calendar Settings Modal */}
          <CalendarSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            currentUser={currentUser}
          />

          {/* Conditional Rendering based on viewMode */}
          {viewMode === 'daily' ? (
            <DailyView
              date={currentDate}
              events={allEvents}
              departments={departments}
              onEventClick={onEventClick}
              onTimeSlotClick={onTimeSlotClick}
            />
          ) : (
            <div className="space-y-4">
              {viewMode === 'weekly' ? (
                <div className="border-t-2 border-[#081429] pt-4">
                  <WeekBlock
                    weekDays={weeks.find(w => w.some(d => isSameDay(d, currentDate))) || weeks[0]}
                    departments={departments}
                    events={allEvents}
                    onCellClick={onCellClick}
                    onRangeSelect={onRangeSelect}
                    onEventClick={onEventClick}
                    holidays={holidays}
                    onEventMove={onEventMove}
                    canEditDepartment={canEditDepartment}
                    pendingEventIds={pendingEventIds}
                  />
                </div>
              ) : (
                <div className="border-t-2 border-[#081429] pt-4">
                  {weeks.map((week, idx) => (
                    <WeekBlock
                      key={`${format(currentDate, 'yyyy-MM')} -${idx} `}
                      weekDays={week}
                      departments={departments}
                      events={allEvents}
                      onCellClick={onCellClick}
                      onRangeSelect={onRangeSelect}
                      onEventClick={onEventClick}
                      currentMonthDate={currentDate}
                      limitToCurrentMonth={false}
                      holidays={holidays}
                      onEventMove={onEventMove}
                      canEditDepartment={canEditDepartment}
                      pendingEventIds={pendingEventIds}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CalendarBoard;