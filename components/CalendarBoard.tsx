import React from 'react';
import { format, setMonth, setYear, isToday, isPast, isFuture, parseISO, startOfDay, isSameDay } from 'date-fns';
import { Department, CalendarEvent } from '../types';
import { getMonthWeeks } from '../utils/dateUtils';
import WeekBlock from './WeekBlock';
import { Clock, Users, Edit3 } from 'lucide-react';
import { EVENT_COLORS } from '../constants';

interface CalendarBoardProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  departments: Department[];
  events: CalendarEvent[];
  onCellClick: (date: string, deptId: string) => void;
  onRangeSelect: (startDate: string, endDate: string, deptId: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  isPrintMode?: boolean;
  viewMode: 'daily' | 'weekly' | 'monthly';
}

const DailyView: React.FC<{
  date: Date,
  events: CalendarEvent[],
  departments: Department[],
  onEventClick: (event: CalendarEvent) => void
}> = ({ date, events, departments, onEventClick }) => {
  const dayEvents = events.filter(e => {
    const start = parseISO(e.startDate);
    const end = parseISO(e.endDate);
    const target = startOfDay(date);
    return target >= startOfDay(start) && target <= startOfDay(end);
  });

  const sortedEvents = [...dayEvents].sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

  const categories = [
    { title: '지난 일정', filter: (e: CalendarEvent) => isPast(parseISO(`${e.startDate}T${e.startTime || '00:00'}`)) && !isToday(parseISO(e.startDate)) },
    { title: '오늘', filter: (e: CalendarEvent) => isToday(parseISO(e.startDate)) },
    { title: '예정된 일정', filter: (e: CalendarEvent) => isFuture(parseISO(e.startDate)) && !isToday(parseISO(e.startDate)) },
  ];

  return (
    <div className="space-y-8 mt-4">
      {categories.map(cat => {
        const catEvents = sortedEvents.filter(cat.filter);
        if (catEvents.length === 0 && cat.title !== 'Today') return null;

        return (
          <div key={cat.title}>
            <h3 className="text-lg font-bold text-[#081429] mb-4 flex items-center gap-2">
              {cat.title} <span className="text-gray-400 font-normal">({catEvents.length})</span>
            </h3>
            <div className="space-y-3">
              {catEvents.length > 0 ? catEvents.map(event => {
                const dept = departments.find(d => d.id === event.departmentId);

                return (
                  <div
                    key={event.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow group border-l-4 border-l-[#fdb813]"
                  >
                    <div className="flex items-center gap-6">
                      {/* Date Indicator */}
                      <div className="text-center min-w-[60px] border-r pr-6">
                        <div className="text-xs text-gray-500 font-medium uppercase">{format(parseISO(event.startDate), 'EEE')}</div>
                        <div className="text-2xl font-bold text-[#081429] leading-none">{format(parseISO(event.startDate), 'd')}</div>
                      </div>

                      {/* Time & Participants */}
                      <div className="flex flex-col gap-1 text-sm text-gray-600 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-[#fdb813]" />
                          <span className="font-semibold text-[#373d41]">{event.startTime || '00:00'} - {event.endTime || '23:59'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-gray-400" />
                          <span>{event.participants || '참석자 없음'}</span>
                        </div>
                      </div>

                      {/* Title & Dept */}
                      <div className="flex flex-col gap-1">
                        <h4 className="text-base font-bold text-[#081429]">{event.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${dept?.color || 'bg-gray-100'} border border-black/5 text-[#081429]`}>
                            {dept?.name || '일반'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onEventClick(event)}
                      className="px-6 py-2 bg-gray-50 text-[#081429] rounded-lg text-sm font-bold hover:bg-[#081429] hover:text-[#fdb813] transition-all shadow-sm flex items-center gap-2 border border-gray-100"
                    >
                      <Edit3 size={14} /> 수정
                    </button>
                  </div>
                );
              }) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
                  오늘 예정된 일정이 없습니다
                </div>
              )}
            </div>
          </div>
        );
      })}
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
      {/* Header Selector - Refined with #081429 and #fdb813 */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
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