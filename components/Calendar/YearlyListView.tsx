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

const MAX_WEEKS = 6; // 최대 6주

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

    // 주간 분할
    const weeks: WeekData[] = [];
    let weekStart = startOfWeek(mStart, { weekStartsOn: 0 });

    while (isBefore(weekStart, mEnd) || isSameDay(weekStart, mStart)) {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

      const weekEvents = monthEvents.filter(e => {
        const eStart = new Date(e.startDate);
        const eEnd = e.endDate ? new Date(e.endDate) : eStart;
        return eStart <= weekEnd && eEnd >= weekStart;
      }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      const label = `${weeks.length + 1}주차`;
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
      <div className="flex-shrink-0 flex items-center justify-between bg-[#081429] text-white px-4 py-1.5">
        <span className="text-base font-bold">{currentYear}년</span>
        <span className="text-sm text-[#fdb813] font-bold">{totalEvents}개</span>
      </div>

      {/* 12열(월) × 6행(주차) 그리드 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 월 헤더 행 */}
        <div className="flex-shrink-0 flex border-b border-gray-200">
          {/* 주차 라벨 열 헤더 */}
          <div className="flex-shrink-0 w-12 bg-gray-50 border-r border-gray-200" />
          {/* 12개 월 헤더 */}
          {monthsData.map((md, mIdx) => {
            const isCurrent = currentMonthIdx === mIdx;
            return (
              <div
                key={mIdx}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 border-r border-gray-200 last:border-r-0 ${
                  isCurrent ? 'bg-[#fdb813] text-[#081429]' : 'bg-gray-50 text-gray-600'
                }`}
              >
                <span className="text-sm font-bold">{md.label}</span>
                {md.totalEvents > 0 && (
                  <span className={`text-xs font-medium mt-0.5 px-1.5 rounded-sm ${
                    isCurrent ? 'bg-[#081429] text-[#fdb813]' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {md.totalEvents}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 주차 행 (최대 6행) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {Array.from({ length: MAX_WEEKS }, (_, weekIdx) => (
            <div
              key={weekIdx}
              className="flex-1 min-h-0 flex border-b border-gray-200 last:border-b-0"
            >
              {/* 주차 라벨 */}
              <div className="flex-shrink-0 w-12 flex items-center justify-center bg-gray-50 border-r border-gray-200">
                <span className="text-xs text-gray-500 font-bold">{weekIdx + 1}주차</span>
              </div>

              {/* 12개 월의 해당 주차 셀 */}
              {monthsData.map((md, mIdx) => {
                const week = md.weeks[weekIdx];
                const isCurrent = currentMonthIdx === mIdx;

                if (!week) {
                  return (
                    <div
                      key={mIdx}
                      className="flex-1 min-w-0 border-r border-gray-100 last:border-r-0 bg-gray-50/30"
                    />
                  );
                }

                return (
                  <div
                    key={mIdx}
                    className={`flex-1 min-w-0 flex flex-col border-r border-gray-100 last:border-r-0 px-1 py-0.5 overflow-hidden ${
                      isCurrent ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    {/* 이벤트 목록 */}
                    <div className="flex-1 min-h-0 flex flex-col gap-0.5 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      {week.events.map(evt => {
                        const dept = departments.find(d => d.id === evt.departmentId);
                        const color = dept?.color || evt.color || '#6b7280';

                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => { e.stopPropagation(); onEventClick?.(evt); }}
                            className="flex items-center gap-1 min-h-[18px] cursor-pointer hover:bg-gray-100 rounded-sm px-0.5 overflow-hidden"
                            title={`${evt.title} (${format(new Date(evt.startDate), 'M/d')})`}
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs text-gray-700 truncate leading-tight">
                              {evt.title}
                            </span>
                          </div>
                        );
                      })}

                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default YearlyListView;
