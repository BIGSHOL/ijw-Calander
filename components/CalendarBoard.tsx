
import React, { useMemo } from 'react';
import { format, setMonth, setYear, isToday, isPast, isFuture, parseISO, startOfDay, isSameDay, addDays, subDays, differenceInMinutes, setHours, setMinutes, getHours, getMinutes, getDaysInMonth, getDate, setDate } from 'date-fns';
import { Department, CalendarEvent, UserProfile } from '../types';
import { getMonthWeeks } from '../utils/dateUtils';
import WeekBlock from './WeekBlock';
import MyEventsModal from './MyEventsModal'; // Import
import CustomSelect from './CustomSelect'; // Import CustomSelect
import { Clock, Users, Edit3, ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from 'lucide-react';
import { EVENT_COLORS } from '../constants';
import YearlyView from './YearlyView'; // Import YearlyView

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
                    ${primaryDept?.color && !primaryDept.color.startsWith('#') ? primaryDept.color : 'bg-gray-100 border-gray-300'}
                  `}
                  style={{
                    backgroundColor: event.color?.startsWith('#') ? event.color : (primaryDept?.color?.startsWith('#') ? primaryDept.color : undefined),
                    borderLeftColor: event.borderColor?.startsWith('#') ? event.borderColor : (event.color?.startsWith('#') ? event.color : (primaryDept?.color?.startsWith('#') ? primaryDept.color : undefined)),
                    color: event.textColor || '#ffffff'
                  }}
                >
                  <span className="bg-white/50 px-1.5 rounded text-[10px] uppercase tracking-wider text-inherit mix-blend-multiply opacity-80">All Day</span>
                  {relatedDepts.length > 1 && (
                    <div className="flex gap-1">
                      {relatedDepts.map(d => (
                        <span key={d.id} className="text-[10px] bg-white/40 px-1 rounded text-inherit mix-blend-multiply border border-black/5">{d.name}</span>
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
                    ${primaryDept?.color && !primaryDept.color.startsWith('#') ? primaryDept.color : 'bg-white border-gray-200'}
                  `}
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
}) => {
  const [isMyEventsOpen, setIsMyEventsOpen] = React.useState(false);
  const weeks = getMonthWeeks(currentDate); // Restore weeks definition

  // Header Logic
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

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
    <div className="flex-1 bg-white shadow-xl print:shadow-none p-4 md:p-8 print:p-0 rounded-2xl border border-gray-200 print:border-none min-w-[350px] flex flex-col overflow-hidden">

      {/* Yearly View Content */}
      {viewMode === 'yearly' ? (
        <YearlyView
          currentDate={currentDate}
          events={events}
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
          <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6">

            {/* Navigation Group */}
            <div className="flex items-center gap-1 w-full md:w-auto p-1.5 bg-[#f8fafc] rounded-2xl border border-gray-200 shadow-sm">
              <button
                onClick={handlePrev}
                className="p-2 hover:bg-white hover:text-[#fdb813] hover:shadow-md rounded-xl transition-all text-gray-400 hover:text-[#081429]"
              >
                <ChevronLeft size={20} strokeWidth={3} />
              </button>

              <div className="flex items-center justify-center px-1">

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
                className="p-2 hover:bg-white hover:text-[#fdb813] hover:shadow-md rounded-xl transition-all text-gray-400 hover:text-[#081429]"
              >
                <ChevronRight size={20} strokeWidth={3} />
              </button>
            </div>

            {/* Right Action Group - Only show My Events on Primary View */}
            {isPrimaryView && (
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <div className="hidden md:flex text-sm font-bold text-[#081429] uppercase tracking-widest bg-[#fdb813]/10 px-4 py-2 rounded-xl border border-[#fdb813]/20">
                  {format(currentDate, 'yyyy. MM')}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setIsMyEventsOpen(true)}
                    className="flex items-center gap-2 bg-[#081429] hover:bg-[#081429]/90 text-white px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-sm transform hover:-translate-y-0.5"
                  >
                    <List size={16} className="text-[#fdb813]" />
                    내 일정
                  </button>
                  {/* Notification Badge */}
                  {(() => {
                    if (!currentUser) return null;
                    const pendingCount = events.filter(e => {
                      // Check if user is relevant to this event (participant)
                      const isRelevant = (e.attendance && e.attendance[currentUser.uid]) ||
                        (e.participants && e.participants.includes(currentUser.email.split('@')[0]));

                      if (!isRelevant) return false;

                      // Check status
                      const status = e.attendance ? e.attendance[currentUser.uid] : 'pending';
                      return status === 'pending' || !status;
                    }).length;

                    if (pendingCount === 0) return null;

                    return (
                      <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-extrabold px-1.5 h-4 min-w-[16px] flex items-center justify-center rounded-full shadow-sm ring-2 ring-white animate-pulse">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>

          {/* My Events Modal */}
          <MyEventsModal
            isOpen={isMyEventsOpen}
            onClose={() => setIsMyEventsOpen(false)}
            events={events}
            currentUser={currentUser}
            onEventClick={onEventClick}
          />

          {/* Conditional Rendering based on viewMode */}
          {viewMode === 'daily' ? (
            <DailyView
              date={currentDate}
              events={events}
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
                    events={events}
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
                      events={events}
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