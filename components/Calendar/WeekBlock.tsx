import React, { useState, useRef } from 'react';
import { Department, CalendarEvent, DAYS_OF_WEEK, Holiday } from '../../types';
import { format, isSameDay, parseISO, isToday, isWeekend, isWithinInterval, startOfDay, differenceInDays, addDays } from 'date-fns';
import { getEventPositionInWeek } from '../../utils/dateUtils';
import { EVENT_COLORS } from '../../constants';
import { Clock, AlignLeft, Users } from 'lucide-react';

interface WeekBlockProps {
  weekDays: Date[];
  departments: Department[];
  events: CalendarEvent[];
  onCellClick: (date: string, deptId: string) => void;
  onRangeSelect: (startDate: string, endDate: string, deptId: string, deptIds?: string[]) => void;
  onEventClick: (event: CalendarEvent) => void;
  // New Props
  currentMonthDate?: Date;
  limitToCurrentMonth?: boolean;
  holidays?: Holiday[];
  // Event Drag Props
  onEventMove?: (original: CalendarEvent, updated: CalendarEvent) => void;
  canEditDepartment?: (deptId: string) => boolean;
  pendingEventIds?: string[];
}

const WeekBlock: React.FC<WeekBlockProps> = ({
  weekDays,
  departments,
  events,
  onCellClick,
  onRangeSelect,
  onEventClick,
  currentMonthDate,
  limitToCurrentMonth = false,
  holidays = [],
  onEventMove,
  canEditDepartment,
  pendingEventIds = [],
}) => {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  // Helper to check if date is in other month (for styling)
  const isOtherMonth = (date: Date) => {
    if (!currentMonthDate) return false;
    return date.getMonth() !== currentMonthDate.getMonth();
  };

  // Helper to check visibility (keep for backward compatibility, but now always visible)
  const isDateVisible = (date: Date) => {
    if (!limitToCurrentMonth || !currentMonthDate) return true;
    return date.getMonth() === currentMonthDate.getMonth();
  };

  // Drag State (Cell Selection)
  // Store Dept ID to find index later.
  const [dragStart, setDragStart] = useState<{ date: Date, deptId: string } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ date: Date, deptId: string } | null>(null);

  // Event Drag State
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<Date | null>(null);
  const [dropTargetDeptId, setDropTargetDeptId] = useState<string | null>(null);
  const hasDraggedRef = useRef(false);

  // Tooltip State
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number } | null>(null);

  const gridClass = "grid grid-cols-[120px_repeat(7,1fr)]";

  const handleMouseDown = (date: Date, deptId: string) => {
    setDragStart({ date, deptId });
    setDragEnd({ date, deptId });
  };

  const handleMouseEnter = (date: Date, deptId: string) => {
    // Enable Multi-Dept selection by updating end state regardless of Dept ID
    if (dragStart) {
      setDragEnd({ date, deptId });
    }
  };

  const handleMouseUp = () => {
    if (dragStart && dragEnd) {
      // Date Range
      const start = dragStart.date < dragEnd.date ? dragStart.date : dragEnd.date;
      const end = dragStart.date < dragEnd.date ? dragEnd.date : dragStart.date;

      // Dept Range
      const startIdx = departments.findIndex(d => d.id === dragStart.deptId);
      const endIdx = departments.findIndex(d => d.id === dragEnd.deptId);
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);

      const selectedDeptIds = departments
        .slice(minIdx, maxIdx + 1)
        .map(d => d.id);

      // Pass array if supported, else fallback? 
      // We will modify parent to support array.
      // For backward compatibility (if needed), we can pass selectedDeptIds as extra arg.

      // Note: We need to cast or update interface. 
      // Assumption: onRangeSelect is updated to: (startDate, endDate, primaryDeptId, allDeptIds?)
      // Or just cheat and pass it.

      if (isSameDay(start, end) && selectedDeptIds.length === 1) {
        onCellClick(format(start, 'yyyy-MM-dd'), selectedDeptIds[0]);
      } else {
        // Hack: Pass the array as part of the 'deptId' argument wrapper or updated callback?
        // Let's modify the interface in a separate step or strict type here.
        // Actually, parent App.tsx expects (s, e, d). 
        // I should invoke a NEW prop if I can, or Overload.
        // Let's just pass `selectedDeptIds[0]` as primary and `selectedDeptIds` as 4th arg?
        // Or better, just fix the interface first.
        // But I am editing this file.
        // I will assume `onRangeSelect` can take 4th arg `deptIds?: string[]`.

        // Use the primary (first clicked) as the main one, but pass full list.
        // Actually, dragStart is the anchor.
        console.log('DEBUG: WeekBlock handleMouseUp', { startIdx, endIdx, selectedDeptIds });
        onRangeSelect(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'), dragStart.deptId, selectedDeptIds);
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
    if (!dragStart || !dragEnd) return false;

    // Date Range
    const start = dragStart.date < dragEnd.date ? dragStart.date : dragEnd.date;
    const end = dragStart.date < dragEnd.date ? dragEnd.date : dragStart.date;
    const inDateRange = isWithinInterval(date, { start: startOfDay(start), end: startOfDay(end) });

    // Dept Range
    const startIdx = departments.findIndex(d => d.id === dragStart.deptId);
    const endIdx = departments.findIndex(d => d.id === dragEnd.deptId);
    const currentIdx = departments.findIndex(d => d.id === deptId);

    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const inDeptRange = currentIdx >= minIdx && currentIdx <= maxIdx;

    return inDateRange && inDeptRange;
  };

  // --- Event Drag Handlers ---
  const handleEventDragStart = (e: React.MouseEvent, event: CalendarEvent) => {
    // Check if user can edit the source department
    if (canEditDepartment && !canEditDepartment(event.departmentId)) return;
    e.stopPropagation();
    e.preventDefault();
    setDraggingEvent(event);
    setHoveredEvent(null); // Hide tooltip during drag
    setTooltipPos(null);
  };

  const handleCellMouseEnterForEventDrag = (date: Date, deptId: string) => {
    if (draggingEvent) {
      setDropTargetDate(date);
      setDropTargetDeptId(deptId);
      // Check if actually moved from original position
      const originalStart = parseISO(draggingEvent.startDate);
      if (!isSameDay(date, originalStart) || deptId !== draggingEvent.departmentId) {
        hasDraggedRef.current = true;
      }
    }
  };

  const handleEventDrop = () => {
    if (draggingEvent && dropTargetDate && dropTargetDeptId && onEventMove) {
      // Check if user can edit the target department
      if (canEditDepartment && !canEditDepartment(dropTargetDeptId)) {
        // Cannot drop here
        setDraggingEvent(null);
        setDropTargetDate(null);
        setDropTargetDeptId(null);
        return;
      }

      // Calculate duration
      const originalStart = parseISO(draggingEvent.startDate);
      const originalEnd = parseISO(draggingEvent.endDate);
      const duration = differenceInDays(originalEnd, originalStart);

      // Calculate new dates
      const newStartDate = format(dropTargetDate, 'yyyy-MM-dd');
      const newEndDate = format(addDays(dropTargetDate, duration), 'yyyy-MM-dd');

      // Logic to preserve Linked Group departments
      let newDeptIds = draggingEvent.departmentIds ? [...draggingEvent.departmentIds] : [draggingEvent.departmentId];

      if (draggingEvent.departmentId !== dropTargetDeptId) {
        // Swap the old department ID with the new one
        newDeptIds = newDeptIds.map(id => id === draggingEvent.departmentId ? dropTargetDeptId : id);
        // Ensure uniqueness
        newDeptIds = [...new Set(newDeptIds)];
      }

      const updatedEvent: CalendarEvent = {
        ...draggingEvent,
        startDate: newStartDate,
        endDate: newEndDate,
        departmentId: dropTargetDeptId,
        departmentIds: newDeptIds, // Pass the updated list
      };

      onEventMove(draggingEvent, updatedEvent);
    }

    setDraggingEvent(null);
    setDropTargetDate(null);
    setDropTargetDeptId(null);
    // Reset after event loop so onClick can still check it
    setTimeout(() => { hasDraggedRef.current = false; }, 0);
  };

  const canDropOnDept = (deptId: string) => {
    if (!canEditDepartment) return true;
    return canEditDepartment(deptId);
  };

  return (
    <div
      className="mb-4 border-b border-gray-200 break-inside-avoid select-none relative"
      onMouseLeave={() => {
        setDragStart(null);
        setDragEnd(null);
        if (draggingEvent) {
          setDraggingEvent(null);
          setDropTargetDate(null);
          setDropTargetDeptId(null);
          setTimeout(() => { hasDraggedRef.current = false; }, 0);
        }
      }}
      onMouseUp={() => {
        if (draggingEvent) {
          handleEventDrop();
        } else {
          handleMouseUp();
        }
      }}
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

          // Check Holiday
          const dateStr = format(date, 'yyyy-MM-dd');
          const holiday = holidays.find(h => h.date === dateStr);
          const isHoliday = !!holiday;

          return (
            <div
              key={date.toISOString()}
              className={`border-r border-gray-300 last:border-r-0 p-1 text-center flex flex-col items-center justify-center min-h-[52px]
                ${isOtherMonth(date) ? 'opacity-40 bg-gray-100' : ''}
                ${isHoliday && !isOtherMonth(date) ? 'text-red-600 bg-gradient-to-b from-red-50 to-red-100/50' : isHoliday ? 'text-red-400' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-[#373d41]'}
                ${isToday(date) && !isOtherMonth(date) ? 'bg-[#fdb813]/20 font-bold' : ''}
              `}
            >
              <>
                <div className="flex items-center gap-1 leading-none">
                  <span className="text-xxs font-bold uppercase opacity-60 tracking-wider">{dayName}</span>
                </div>
                <span className={`font-extrabold leading-none mt-0.5 ${isHoliday ? 'text-base' : 'text-sm'}`}>{dayNum}</span>
                {isHoliday && (
                  <span className="text-nano text-red-600 font-bold bg-red-100 px-1.5 py-0.5 rounded-full mt-0.5 whitespace-nowrap border border-red-200">
                    {holiday.name}
                  </span>
                )}
              </>
            </div>
          );
        })}
      </div>

      {/* Department Rows */}
      {departments.map((dept) => {
        const weekEvents = events.filter(e => {
          // Compatibility: Match by ID or Name (for cases where old IDs like 'school' exist but new events use '학교일정')
          // Linked Group Support: STRICTLY match departmentId. 
          // The departmentIds array is for knowing which other depts share this event, NOT for display in this column.
          // Exception: If departmentId is missing (legacy data) or it's a legacy multi-dept event without Linked Groups?
          // We should prioritize departmentId if it exists.

          let isMatch = false;
          if (e.departmentId) {
            isMatch = e.departmentId === dept.id || e.departmentId === dept.name;
          } else {
            // Legacy fallback (shouldn't happen with new events)
            isMatch = (e.departmentIds && e.departmentIds.includes(dept.id)) || false;
          }

          if (!isMatch) return false;
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
                borderLeft: dept.color.startsWith('#') ? `6px solid ${dept.color}` : 'none',
                gridRow: 1, // Ensure it stays in the first row
                gridColumn: 1
              }}
            >
              {/* Fallback for legacy tailwind class colors */}
              {!dept.color.startsWith('#') && (
                <div className={`absolute left-0 top-0 bottom-0 w-[6px] ${dept.color}`} />
              )}
              <div className="font-bold text-[#081429] text-center text-xs break-keep leading-tight pl-1">{dept.name}</div>
            </div>

            {/* Grid Cells */}
            {weekDays.map((date, idx) => {
              const isDrag = isDraggingCell(date, dept.id);
              const isDropTarget = draggingEvent && dropTargetDate && dropTargetDeptId === dept.id && isSameDay(date, dropTargetDate);
              const canDrop = draggingEvent ? canDropOnDept(dept.id) : true;

              return (
                <div
                  key={date.toISOString()}
                  onMouseDown={() => !draggingEvent && handleMouseDown(date, dept.id)}
                  onMouseEnter={() => {
                    handleMouseEnter(date, dept.id);
                    handleCellMouseEnterForEventDrag(date, dept.id);
                  }}
                  className={`border-r border-gray-300 last:border-r-0 cursor-pointer relative transition-colors
                    ${isOtherMonth(date) ? 'bg-gray-100/80' : ''}
                    ${isDrag ? 'bg-[#fdb813]/30' : !isOtherMonth(date) ? 'hover:bg-gray-50' : 'hover:bg-gray-200/60'}
                    ${!isDrag && isWeekend(date) && !isOtherMonth(date) ? 'bg-gray-[0.01]' : ''}
                    ${isDropTarget && canDrop ? 'bg-[#fdb813]/40 ring-2 ring-[#fdb813] ring-inset' : ''}
                    ${isDropTarget && !canDrop ? 'bg-red-100 cursor-not-allowed' : ''}
                    ${draggingEvent && !isDropTarget && canDrop ? 'hover:bg-[#fdb813]/20' : ''}
                  `}
                  style={{
                    gridRow: 1,
                    gridColumn: idx + 2
                  }}
                />
              );
            })}

            {/* Events Layer - z-20 ensures it's above cell containers for drag */}
            <div className="col-start-2 col-span-7 row-start-1 grid grid-cols-7 pointer-events-none p-1 gap-y-1 z-20 self-start">
              {weekEvents.map(event => {
                // Determine effective range for display
                let effectiveStart = parseISO(event.startDate);
                let effectiveEnd = parseISO(event.endDate);

                // Assuming range select behavior or single day
                // Clamp to Current Month logic:
                if (limitToCurrentMonth && currentMonthDate) {
                  const monthStart = startOfDay(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1));
                  const monthEnd = startOfDay(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 0)); // Fixed: day 0 is last day of prev month? No, day 0 of NEXT month is last day of this month. Wrapper usually handles this.
                  // Actually new Date(y, m+1, 0) is correct for last day. 
                  // But original code had logic. Let's keep original logic concept. 
                  // Wait, previous code: new Date(..., currentMonthDate.getMonth() + 1, 0)
                  const monthEndCorrect = startOfDay(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0));

                  if (startOfDay(effectiveStart) < monthStart) effectiveStart = monthStart;
                  if (startOfDay(effectiveEnd) > monthEndCorrect) effectiveEnd = monthEndCorrect;

                  // If invalid (starts after end), skip
                  if (startOfDay(effectiveStart) > startOfDay(effectiveEnd)) return null;
                }

                // Pass the CLAMPED event to position calculator
                // We create a temporary event object just for positioning
                const displayEvent = { ...event, startDate: format(effectiveStart, 'yyyy-MM-dd'), endDate: format(effectiveEnd, 'yyyy-MM-dd') };

                const pos = getEventPositionInWeek(displayEvent, weekStart, weekEnd);

                // If position is invalid (0 span), skip
                if (pos.colSpan <= 0) return null;

                // Direct use of custom colors
                const bgColor = event.color;
                const borderColor = event.borderColor || event.color;
                const textColor = event.textColor || '#ffffff';

                const style = {
                  gridColumnStart: pos.colStart - 1,
                  gridColumnEnd: `span ${pos.colSpan}`,
                  borderColor: borderColor, // Apply border color to container
                };

                const isDragging = draggingEvent?.id === event.id;
                const isPending = pendingEventIds.includes(event.id);
                const canDrag = !canEditDepartment || canEditDepartment(event.departmentId);

                return (
                  <div
                    key={event.id}
                    style={style}
                    onMouseDown={(e) => canDrag && handleEventDragStart(e, event)}
                    onClick={(e) => {
                      if (!hasDraggedRef.current) {
                        e.stopPropagation();
                        onEventClick(event);
                      }
                    }}
                    onMouseEnter={(e) => !draggingEvent && handleEventMouseEnter(e, event)}
                    onMouseLeave={handleEventMouseLeave}
                    className={`
                      pointer-events-auto
                      rounded px-2 py-1 text-xs font-bold border shadow-sm
                      overflow-hidden whitespace-nowrap text-ellipsis
                      flex items-center
                      h-6 relative
                      ${!pos.isStart ? 'rounded-l-none border-l-0 opacity-90' : ''}
                      ${!pos.isEnd ? 'rounded-r-none border-r-0' : ''}
                      ${canDrag ? 'cursor-grab hover:brightness-95' : 'cursor-pointer hover:brightness-95'}
                      ${isDragging ? 'opacity-50 ring-2 ring-[#fdb813] cursor-grabbing scale-105 z-50' : ''}
                      ${isPending ? 'ring-2 ring-dashed ring-orange-400' : ''}
                    `}
                    title={canDrag ? "드래그하여 이동" : ""}
                  >
                    <div
                      className="absolute inset-0"
                      style={{ backgroundColor: bgColor }}
                    />
                    {/* Pending indicator */}
                    {isPending && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white z-20" />
                    )}
                    {/* Recurrence indicator */}
                    {event.recurrenceGroupId && pos.isStart && (
                      <span className="relative z-10 mr-0.5 text-xxs" style={{ color: textColor }}>🔄</span>
                    )}
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