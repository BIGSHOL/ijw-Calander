import React, { useState } from 'react';
import { Department, CalendarEvent, DAYS_OF_WEEK } from '../types';
import { format, isSameDay, parseISO, isToday, isWeekend, isWithinInterval, startOfDay } from 'date-fns';
import { getEventPositionInWeek } from '../utils/dateUtils';
import { EVENT_COLORS } from '../constants';
import { Clock, AlignLeft, Users } from 'lucide-react';

interface WeekBlockProps {
  weekDays: Date[];
  departments: Department[];
  events: CalendarEvent[];
  onCellClick: (date: string, deptId: string) => void;
  onRangeSelect: (startDate: string, endDate: string, deptId: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const WeekBlock: React.FC<WeekBlockProps> = ({
  weekDays,
  departments,
  events,
  onCellClick,
  onRangeSelect,
  onEventClick,
}) => {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  // Drag State
  const [dragStart, setDragStart] = useState<{ date: Date, deptId: string } | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);

  // Tooltip State
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number } | null>(null);

  const gridClass = "grid grid-cols-[120px_repeat(7,1fr)]";

  const handleMouseDown = (date: Date, deptId: string) => {
    setDragStart({ date, deptId });
    setDragEnd(date);
  };

  const handleMouseEnter = (date: Date, deptId: string) => {
    if (dragStart && dragStart.deptId === deptId) {
      setDragEnd(date);
    }
  };

  const handleMouseUp = () => {
    if (dragStart && dragEnd) {
      const start = dragStart.date < dragEnd ? dragStart.date : dragEnd;
      const end = dragStart.date < dragEnd ? dragEnd : dragStart.date;

      if (isSameDay(start, end)) {
        onCellClick(format(start, 'yyyy-MM-dd'), dragStart.deptId);
      } else {
        onRangeSelect(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'), dragStart.deptId);
      }
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const handleEventMouseEnter = (e: React.MouseEvent, event: CalendarEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredEvent(event);
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom + 5 });
  };

  const handleEventMouseLeave = () => {
    setHoveredEvent(null);
    setTooltipPos(null);
  };

  const isDraggingCell = (date: Date, deptId: string) => {
    if (!dragStart || !dragEnd || dragStart.deptId !== deptId) return false;
    const start = dragStart.date < dragEnd ? dragStart.date : dragEnd;
    const end = dragStart.date < dragEnd ? dragEnd : dragStart.date;
    return isWithinInterval(date, { start: startOfDay(start), end: startOfDay(end) });
  };

  return (
    <div
      className="mb-4 border-b border-gray-200 last:border-b-0 break-inside-avoid select-none relative"
      onMouseLeave={() => { setDragStart(null); setDragEnd(null); }}
      onMouseUp={handleMouseUp}
    >
      {/* Date Header Row - Using #373d41 */}
      <div className={`${gridClass} border-t border-l border-r border-[#373d41] bg-[#f8fafc]`}>
        <div className="border-r border-gray-300 p-1 flex items-center justify-center bg-[#f1f5f9] font-bold text-sm">
        </div>
        {weekDays.map((date, idx) => {
          const dayNum = date.getDate();
          const dayName = DAYS_OF_WEEK[idx];
          const isSun = idx === 0;
          const isSat = idx === 6;

          return (
            <div
              key={date.toISOString()}
              className={`border-r border-gray-300 last:border-r-0 p-1 text-center h-10 flex flex-col items-center justify-center
                ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-[#373d41]'}
                ${isToday(date) ? 'bg-[#fdb813]/20 font-bold' : ''}
              `}
            >
              <span className="text-[10px] font-bold uppercase opacity-60 tracking-wider">{dayName}</span>
              <span className="text-sm font-extrabold leading-none">{dayNum}</span>
            </div>
          );
        })}
      </div>

      {/* Department Rows */}
      {departments.map((dept) => {
        const weekEvents = events.filter(e => {
          // Compatibility: Match by ID or Name (for cases where old IDs like 'school' exist but new events use '학교일정')
          if (e.departmentId !== dept.id && e.departmentId !== dept.name) return false;
          const start = parseISO(e.startDate);
          const end = parseISO(e.endDate);
          return (start <= weekEnd && end >= weekStart);
        });

        return (
          <div
            key={dept.id}
            className={`${gridClass} border-t border-l border-r border-gray-200 bg-white min-h-[60px] relative group`}
          >
            {/* Sidebar Cell */}
            <div
              className="border-r border-gray-300 p-2 flex flex-col justify-center text-sm relative overflow-hidden"
              style={{
                borderLeft: dept.color.startsWith('#') ? `6px solid ${dept.color}` : 'none'
              }}
            >
              {/* Fallback for legacy tailwind class colors */}
              {!dept.color.startsWith('#') && (
                <div className={`absolute left-0 top-0 bottom-0 w-[6px] ${dept.color}`} />
              )}
              <div className="font-bold text-[#081429] text-center text-[11px] break-keep leading-tight pl-1">{dept.name}</div>
            </div>

            {/* Grid Cells */}
            {weekDays.map((date) => {
              const isDrag = isDraggingCell(date, dept.id);
              return (
                <div
                  key={date.toISOString()}
                  onMouseDown={() => handleMouseDown(date, dept.id)}
                  onMouseEnter={() => handleMouseEnter(date, dept.id)}
                  className={`border-r border-gray-300 last:border-r-0 cursor-pointer relative transition-colors
                    ${isDrag ? 'bg-[#fdb813]/30' : 'hover:bg-gray-50'}
                    ${!isDrag && isWeekend(date) ? 'bg-gray-[0.01]' : ''}
                  `}
                />
              );
            })}

            {/* Events Layer */}
            <div className="absolute inset-y-0 left-[120px] right-0 grid grid-cols-7 pointer-events-none p-1 gap-y-1 z-10">
              {weekEvents.map(event => {
                const pos = getEventPositionInWeek(event, weekStart, weekEnd);
                // Direct use of custom colors
                const bgColor = event.color;
                const borderColor = event.borderColor || event.color;
                const textColor = event.textColor || '#ffffff';

                const style = {
                  gridColumnStart: pos.colStart - 1,
                  gridColumnEnd: `span ${pos.colSpan}`,
                  borderColor: borderColor, // Apply border color to container
                };

                return (
                  <div
                    key={event.id}
                    style={style}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    onMouseEnter={(e) => handleEventMouseEnter(e, event)}
                    onMouseLeave={handleEventMouseLeave}
                    className={`
                      pointer-events-auto
                      rounded px-2 py-1 text-xs font-bold border shadow-sm
                      overflow-hidden whitespace-nowrap text-ellipsis
                      hover:brightness-95 cursor-pointer flex items-center
                      h-[90%] self-center relative
                      ${!pos.isStart ? 'rounded-l-none border-l-0 opacity-90' : ''}
                      ${!pos.isEnd ? 'rounded-r-none border-r-0' : ''}
                    `}
                    title=""
                  >
                    <div
                      className="absolute inset-0"
                      style={{ backgroundColor: bgColor }}
                    />
                    {/* Inner border div removed, applied to container instead */}
                    <span className="relative z-10 truncate" style={{ color: textColor }}>
                      {event.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Custom Tooltip Portal/Overlay - Header color #081429 */}
      {hoveredEvent && tooltipPos && (
        <div
          className="fixed z-[9999] w-72 bg-white rounded-lg shadow-2xl border border-gray-200 pointer-events-none text-left animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${Math.min(tooltipPos.x - 144, window.innerWidth - 300)}px`,
            top: `${Math.min(tooltipPos.y, window.innerHeight - 200)}px`
          }}
        >
          <div
            className="h-2 rounded-t-lg w-full bg-[#081429]"
          />
          <div className="p-4 space-y-3">
            <h3 className="text-lg font-bold text-[#081429] leading-tight">
              {hoveredEvent.title}
            </h3>

            <div className="flex items-start gap-2 text-sm text-gray-600">
              <Clock size={16} className="mt-0.5 shrink-0 text-[#fdb813]" />
              <div className="flex flex-col">
                <span className="font-bold text-[#373d41]">
                  {hoveredEvent.startDate} {hoveredEvent.startTime ? hoveredEvent.startTime : ''}
                </span>
                {(hoveredEvent.startDate !== hoveredEvent.endDate || hoveredEvent.startTime !== hoveredEvent.endTime) && (
                  <span className="text-gray-400 text-xs font-medium">
                    ~ {hoveredEvent.endDate} {hoveredEvent.endTime ? hoveredEvent.endTime : ''}
                  </span>
                )}
              </div>
            </div>

            {hoveredEvent.participants && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Users size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <span className="font-medium">{hoveredEvent.participants}</span>
              </div>
            )}

            {hoveredEvent.description && (
              <div className="flex items-start gap-2 text-sm text-gray-600 pt-2 border-t border-gray-100 mt-2">
                <AlignLeft size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <p className="whitespace-pre-wrap leading-relaxed max-h-40 overflow-hidden line-clamp-6 text-xs italic">
                  {hoveredEvent.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekBlock;