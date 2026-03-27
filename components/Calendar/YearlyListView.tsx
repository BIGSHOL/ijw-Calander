import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addWeeks, isBefore, isAfter, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarEvent, Department } from '../../types';

interface YearlyListViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  departments: Department[];
  onEventClick?: (event: CalendarEvent) => void;
}

interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  label: string;
  events: CalendarEvent[];
}

interface MonthData {
  month: Date;
  label: string;
  weeks: WeekData[];
  totalEvents: number;
}

// 월별 주간 데이터 생성
function buildMonthData(year: number, events: CalendarEvent[]): MonthData[] {
  const months: MonthData[] = [];

  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(year, m, 1);
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);

    // 해당 월의 이벤트
    const monthEvents = events.filter(e => {
      const eStart = new Date(e.startDate);
      const eEnd = e.endDate ? new Date(e.endDate) : eStart;
      return eStart <= mEnd && eEnd >= mStart;
    });

    // 주간 분할 (최대 5주, 보통 4~5주)
    const weeks: WeekData[] = [];
    let weekStart = startOfWeek(mStart, { weekStartsOn: 0 });

    while (isBefore(weekStart, mEnd) || isSameDay(weekStart, mStart)) {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

      // 이 주에 해당하는 이벤트
      const weekEvents = monthEvents.filter(e => {
        const eStart = new Date(e.startDate);
        const eEnd = e.endDate ? new Date(e.endDate) : eStart;
        return eStart <= weekEnd && eEnd >= weekStart;
      }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      // 주간 라벨: 해당 월에 속하는 날짜 범위
      const displayStart = isAfter(mStart, weekStart) ? mStart : weekStart;
      const displayEnd = isBefore(mEnd, weekEnd) ? mEnd : weekEnd;
      const label = `${format(displayStart, 'd')}~${format(displayEnd, 'd')}`;

      weeks.push({ weekStart, weekEnd, label, events: weekEvents });

      weekStart = addWeeks(weekStart, 1);
      if (isAfter(weekStart, mEnd)) break;
    }

    months.push({
      month: monthDate,
      label: `${m + 1}월`,
      weeks,
      totalEvents: monthEvents.length,
    });
  }

  return months;
}

const MAX_VISIBLE_EVENTS = 2; // 주간당 최대 표시 이벤트 수

const YearlyListView: React.FC<YearlyListViewProps> = ({
  currentDate,
  events,
  departments,
  onEventClick,
}) => {
  const currentYear = currentDate.getFullYear();
  const now = new Date();
  const currentMonthIdx = currentYear === now.getFullYear() ? now.getMonth() : -1;

  const yearEvents = useMemo(() =>
    events.filter(e => {
      const y = new Date(e.startDate).getFullYear();
      const ey = e.endDate ? new Date(e.endDate).getFullYear() : y;
      return y === currentYear || ey === currentYear;
    }), [events, currentYear]);

  const monthsData = useMemo(() => buildMonthData(currentYear, yearEvents), [currentYear, yearEvents]);
  const totalEvents = yearEvents.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 연도 헤더 */}
      <div className="flex-shrink-0 flex items-center justify-between bg-[#081429] text-white px-3 py-1">
        <span className="text-sm font-bold">{currentYear}년</span>
        <span className="text-[10px] text-[#fdb813] font-medium">{totalEvents}개</span>
      </div>

      {/* 12개월 그리드 - 균등 분할 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {monthsData.map((md, mIdx) => {
          const isCurrent = currentMonthIdx === mIdx;

          return (
            <div
              key={mIdx}
              className={`flex-1 min-h-0 flex border-b border-gray-200 last:border-b-0 overflow-hidden ${
                isCurrent ? 'bg-amber-50/40' : ''
              }`}
            >
              {/* 월 라벨 */}
              <div className={`flex-shrink-0 w-10 flex flex-col items-center justify-center border-r border-gray-200 ${
                isCurrent ? 'bg-[#fdb813] text-[#081429]' : 'bg-gray-50 text-gray-600'
              }`}>
                <span className="text-[11px] font-bold leading-tight">{md.label}</span>
                {md.totalEvents > 0 && (
                  <span className={`text-[8px] font-medium mt-0.5 px-1 rounded-sm ${
                    isCurrent ? 'bg-[#081429] text-[#fdb813]' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {md.totalEvents}
                  </span>
                )}
              </div>

              {/* 주간 영역 - 가로 균등 분할 */}
              <div className="flex-1 flex min-w-0 overflow-hidden">
                {md.weeks.map((week, wIdx) => (
                  <div
                    key={wIdx}
                    className="flex-1 min-w-0 flex flex-col border-r border-gray-100 last:border-r-0 px-1 py-0.5 overflow-hidden"
                  >
                    {/* 주간 라벨 */}
                    <div className="flex-shrink-0 text-[8px] text-gray-400 font-medium mb-0.5 truncate">
                      {week.label}일
                    </div>

                    {/* 이벤트 목록 */}
                    <div className="flex-1 min-h-0 flex flex-col gap-px overflow-hidden">
                      {week.events.slice(0, MAX_VISIBLE_EVENTS).map(evt => {
                        const dept = departments.find(d => d.id === evt.departmentId);
                        const color = dept?.color || evt.color || '#6b7280';

                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => { e.stopPropagation(); onEventClick?.(evt); }}
                            className="flex items-center gap-0.5 min-h-[14px] cursor-pointer hover:bg-gray-100 rounded-sm px-0.5 overflow-hidden"
                            title={`${evt.title} (${format(new Date(evt.startDate), 'M/d')})`}
                          >
                            <div
                              className="w-1 h-1 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-[9px] text-gray-700 truncate leading-tight">
                              {evt.title}
                            </span>
                          </div>
                        );
                      })}

                      {/* +N 더보기 */}
                      {week.events.length > MAX_VISIBLE_EVENTS && (
                        <div className="text-[8px] text-gray-400 font-medium px-0.5">
                          +{week.events.length - MAX_VISIBLE_EVENTS}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default YearlyListView;
