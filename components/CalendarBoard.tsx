import React from 'react';
import { format, setMonth, setYear, isToday, isPast, isFuture, parseISO, startOfDay, isSameDay, addDays, subDays, differenceInMinutes, setHours, setMinutes, getHours, getMinutes } from 'date-fns';
import { Department, CalendarEvent } from '../types';
import { getMonthWeeks } from '../utils/dateUtils';
import WeekBlock from './WeekBlock';
import { Clock, Users, Edit3, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { EVENT_COLORS } from '../constants';

interface CalendarBoardProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  departments: Department[];
  events: CalendarEvent[];
  onCellClick: (date: string, deptId: string) => void;
  onRangeSelect: (startDate: string, endDate: string, deptId: string) => void;
  onTimeSlotClick: (date: string, time: string) => void; // New Prop
  onEventClick: (event: CalendarEvent) => void;
  isPrintMode?: boolean;
  viewMode: 'daily' | 'weekly' | 'monthly';
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
              const dept = departments.find(d => d.id === event.departmentId);
              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border-l-4 shadow-sm cursor-pointer hover:brightness-95 flex items-center gap-2 
                    ${dept?.color && !dept.color.startsWith('#') ? dept.color : 'bg-gray-100 border-gray-300'}
                  `}
                  style={{
                    backgroundColor: dept?.color?.startsWith('#') ? dept.color : undefined,
                    borderLeftColor: dept?.color?.startsWith('#') ? dept.color : undefined // Or darker? simple is fine
                  }}
                >
                  <span className="bg-white/50 px-1.5 rounded text-[10px] uppercase tracking-wider text-gray-700">All Day</span>
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

              const dept = departments.find(d => d.id === event.departmentId);

              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`absolute left-2 right-2 rounded-lg border-l-4 p-2 shadow-sm cursor-pointer hover:shadow-md transition-all overflow-hidden group z-10 pointer-events-auto
                    ${dept?.color && !dept.color.startsWith('#') ? dept.color : 'bg-white border-gray-200'}
                  `}
                  style={{
                    top: `${top}px`,
                    height: `${Math.max(height, 30)}px`,
                    backgroundColor: dept?.color?.startsWith('#') ? dept.color : undefined,
                    borderLeftColor: dept?.color?.startsWith('#') ? dept.color : undefined
                  }}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-black/70 flex items-center gap-1">
                        <Clock size={10} /> {event.startTime} - {event.endTime}
                      </span>
                      {dept && (
                        <span className="text-xs font-extrabold uppercase bg-white/40 px-1.5 rounded text-black/60 shadow-sm border border-black/5">
                          {dept.name}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-[#081429] truncate mt-0.5">{event.title}</div>
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
  onTimeSlotClick, // Destructure this
  onEventClick,
  isPrintMode = false,
  viewMode
}) => {
  const weeks = getMonthWeeks(currentDate);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="flex-1 bg-white shadow-xl print:shadow-none p-4 md:p-8 print:p-0 rounded-2xl border border-gray-200 print:border-none min-w-[350px]">
      {/* Header Selector */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        {viewMode === 'daily' ? (
          <div className="flex items-center gap-4 bg-[#f8fafc] px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <button onClick={() => onDateChange(subDays(currentDate, 1))} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <ChevronLeft size={20} className="text-[#081429]" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-[#081429] tracking-tight">{format(currentDate, 'yyyy. MM. dd.')}</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{format(currentDate, 'EEEE')}</span>
            </div>
            <button onClick={() => onDateChange(addDays(currentDate, 1))} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <ChevronRight size={20} className="text-[#081429]" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-[#f8fafc] px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
            <select
              value={currentYear}
              onChange={(e) => onDateChange(setYear(currentDate, parseInt(e.target.value)))}
              className="text-lg font-bold text-[#081429] bg-transparent border-none outline-none cursor-pointer"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-gray-300 font-light">/</span>
            <select
              value={currentMonth}
              onChange={(e) => onDateChange(setMonth(currentDate, parseInt(e.target.value)))}
              className="text-lg font-bold text-[#081429] bg-transparent border-none outline-none cursor-pointer"
            >
              {months.map(m => <option key={m} value={m}>{m + 1}월</option>)}
            </select>
          </div>
        )}

        <div className="text-sm font-bold text-[#081429] uppercase tracking-widest bg-[#fdb813]/20 px-4 py-1.5 rounded-full border border-[#fdb813]/30">
          {format(currentDate, 'yyyy년 M월')}
        </div>
      </div>

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
              />
            </div>
          ) : (
            <div className="border-t-2 border-[#081429] pt-4">
              {weeks.map((week, idx) => (
                <WeekBlock
                  key={`${format(currentDate, 'yyyy-MM')}-${idx}`}
                  weekDays={week}
                  departments={departments}
                  events={events}
                  onCellClick={onCellClick}
                  onRangeSelect={onRangeSelect}
                  onEventClick={onEventClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarBoard;