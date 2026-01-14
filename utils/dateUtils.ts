import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  isSameDay, 
  addDays,
  parseISO,
  isWithinInterval,
  getWeeksInMonth
} from 'date-fns';

export const getMonthWeeks = (currentDate: Date) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  
  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }
  return weeks;
};

export const formatDateKey = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const getEventsForCell = (
  events: any[],
  date: Date,
  deptId: string
) => {
  return events.filter(e => {
    if (e.departmentId !== deptId) return false;

    // Null/undefined 체크
    if (!e.startDate || !e.endDate) return false;

    try {
      const start = parseISO(e.startDate);
      const end = parseISO(e.endDate);

      // Invalid Date 체크
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn('Invalid date format in event:', e);
        return false;
      }

      return isWithinInterval(date, { start, end });
    } catch (error) {
      console.warn('Error parsing event dates:', e, error);
      return false;
    }
  });
};

export const getEventPositionInWeek = (
  event: any,
  weekStart: Date,
  weekEnd: Date
) => {
  // Null/undefined 체크
  if (!event.startDate || !event.endDate) {
    console.warn('Event missing date fields:', event);
    return {
      colStart: 2,
      colSpan: 1,
      isStart: false,
      isEnd: false
    };
  }

  try {
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);

    // Invalid Date 체크
    if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
      console.warn('Invalid date format in event:', event);
      return {
        colStart: 2,
        colSpan: 1,
        isStart: false,
        isEnd: false
      };
    }

    // Clamp the event visual start/end to the current week
    const visualStart = eventStart < weekStart ? weekStart : eventStart;
    const visualEnd = eventEnd > weekEnd ? weekEnd : eventEnd;

    const startDayIndex = visualStart.getDay(); // 0 (Sun) - 6 (Sat)
    const durationDays = Math.ceil((visualEnd.getTime() - visualStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      colStart: startDayIndex + 2, // +2 because col 1 is sidebar
      colSpan: durationDays,
      isStart: isSameDay(visualStart, eventStart),
      isEnd: isSameDay(visualEnd, eventEnd)
    };
  } catch (error) {
    console.warn('Error calculating event position:', event, error);
    return {
      colStart: 2,
      colSpan: 1,
      isStart: false,
      isEnd: false
    };
  }
};