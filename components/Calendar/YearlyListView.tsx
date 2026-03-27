import React, { useMemo, useRef, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, isSameMonth, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarEvent, Department } from '../../types';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

type ListLayout = 'horizontal' | 'vertical';

interface YearlyListViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  departments: Department[];
  onEventClick?: (event: CalendarEvent) => void;
  layout?: ListLayout;
}

interface MonthGroup {
  month: Date;
  label: string;
  events: CalendarEvent[];
}

function groupEventsByMonth(year: number, events: CalendarEvent[]): MonthGroup[] {
  const groups: MonthGroup[] = [];

  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(year, m, 1);
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);

    const monthEvents = events.filter(e => {
      const eStart = new Date(e.startDate);
      const eEnd = e.endDate ? new Date(e.endDate) : eStart;
      return eStart <= mEnd && eEnd >= mStart;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    groups.push({
      month: monthDate,
      label: format(monthDate, 'M월', { locale: ko }),
      events: monthEvents,
    });
  }

  return groups;
}

// 단일 연도 컬럼
const YearColumn: React.FC<{
  year: number;
  events: CalendarEvent[];
  departments: Department[];
  onEventClick?: (event: CalendarEvent) => void;
  currentMonth?: number;
  isHorizontalLayout?: boolean;
}> = ({ year, events, departments, onEventClick, currentMonth, isHorizontalLayout }) => {
  const monthGroups = useMemo(() => groupEventsByMonth(year, events), [year, events]);
  const monthRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 현재 월로 자동 스크롤
  useEffect(() => {
    if (currentMonth !== undefined && currentMonth >= 0 && currentMonth < 12) {
      setTimeout(() => {
        const el = monthRefs.current[currentMonth];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [currentMonth]);

  return (
    <div className={`flex-1 min-w-0 overflow-y-auto custom-scrollbar ${
      isHorizontalLayout ? 'border-b border-gray-200 last:border-b-0' : 'border-r border-gray-200 last:border-r-0'
    }`}>
      {/* 연도 헤더 */}
      <div className="sticky top-0 z-10 bg-[#081429] text-white px-3 py-1.5 text-sm font-bold text-center">
        {year}년
      </div>

      {monthGroups.map((group, idx) => {
        const isCurrentMonth = currentMonth === idx && year === new Date().getFullYear();
        const hasEvents = group.events.length > 0;

        return (
          <div
            key={idx}
            ref={el => { monthRefs.current[idx] = el; }}
            className={`border-b border-gray-100 ${isCurrentMonth ? 'bg-amber-50/50' : ''}`}
          >
            {/* 월 헤더 */}
            <div className={`sticky top-[32px] z-[5] flex items-center justify-between px-3 py-1.5 ${
              isCurrentMonth ? 'bg-[#fdb813] text-[#081429]' : 'bg-gray-50 text-gray-700'
            }`}>
              <span className="text-xs font-bold">{group.label}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${
                hasEvents
                  ? isCurrentMonth ? 'bg-[#081429] text-[#fdb813]' : 'bg-gray-200 text-gray-600'
                  : 'text-gray-400'
              }`}>
                {group.events.length}
              </span>
            </div>

            {/* 이벤트 목록 */}
            {hasEvents ? (
              <div className="divide-y divide-gray-50">
                {group.events.map(evt => {
                  const dept = departments.find(d => d.id === evt.departmentId);
                  const startDate = new Date(evt.startDate);
                  const endDate = evt.endDate ? new Date(evt.endDate) : startDate;
                  const isMultiDay = differenceInDays(endDate, startDate) > 0;

                  return (
                    <div
                      key={evt.id}
                      onClick={() => onEventClick?.(evt)}
                      className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {/* 날짜 */}
                      <div className="flex-shrink-0 w-8 text-center">
                        <div className="text-sm font-bold text-gray-800 leading-tight">
                          {format(startDate, 'd')}
                        </div>
                        <div className="text-[9px] text-gray-400 font-medium">
                          {format(startDate, 'EEE', { locale: ko })}
                        </div>
                      </div>

                      {/* 색상 바 */}
                      <div
                        className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: dept?.color || evt.color || '#6b7280' }}
                      />

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {evt.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {dept && (
                            <span
                              className="text-[9px] px-1 py-0.5 rounded-sm font-bold"
                              style={{
                                backgroundColor: (dept.color || '#6b7280') + '20',
                                color: dept.color || '#6b7280',
                              }}
                            >
                              {dept.name}
                            </span>
                          )}
                          {isMultiDay && (
                            <span className="text-[9px] text-gray-400">
                              ~{format(endDate, 'M/d')}
                            </span>
                          )}
                          {evt.startTime && (
                            <span className="text-[9px] text-gray-400">
                              {evt.startTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-3 text-[10px] text-gray-300 text-center">
                일정 없음
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const YearlyListView: React.FC<YearlyListViewProps> = ({
  currentDate,
  events,
  departments,
  onEventClick,
  layout = 'vertical',
}) => {
  const currentYear = currentDate.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const now = new Date();
  const currentMonthIndex = now.getMonth();

  // 연도별 이벤트 분리
  const eventsByYear = useMemo(() => {
    const result: Record<number, CalendarEvent[]> = {};
    years.forEach(y => {
      result[y] = events.filter(e => {
        const ey = new Date(e.startDate).getFullYear();
        const eey = e.endDate ? new Date(e.endDate).getFullYear() : ey;
        return ey === y || eey === y;
      });
    });
    return result;
  }, [events, years[0]]);

  // 가로 분할: 세로로 3컬럼 나란히
  // 세로 분할: 가로로 3행 쌓기
  return (
    <div className={layout === 'vertical'
      ? 'flex flex-row h-full overflow-hidden'
      : 'flex flex-col h-full overflow-hidden'
    }>
      {years.map(year => (
        <YearColumn
          key={year}
          year={year}
          events={eventsByYear[year] || []}
          departments={departments}
          onEventClick={onEventClick}
          currentMonth={year === now.getFullYear() ? currentMonthIndex : undefined}
          isHorizontalLayout={layout === 'horizontal'}
        />
      ))}
    </div>
  );
};

export default YearlyListView;
