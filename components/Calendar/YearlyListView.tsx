import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarEvent, Department } from '../../types';

interface YearlyListViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  departments: Department[];
  onEventClick?: (event: CalendarEvent) => void;
}

interface MonthGroup {
  month: Date;
  monthIndex: number;
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
    groups.push({ month: monthDate, monthIndex: m, label: `${m + 1}월`, events: monthEvents });
  }
  return groups;
}

const MONTH_CHIP_H = 28; // 월 칩 높이(px)

const YearlyListView: React.FC<YearlyListViewProps> = ({
  currentDate,
  events,
  departments,
  onEventClick,
}) => {
  const currentYear = currentDate.getFullYear();
  const now = new Date();
  const isCurrentYear = currentYear === now.getFullYear();
  const currentMonthIndex = isCurrentYear ? now.getMonth() : -1;

  const yearEvents = useMemo(() =>
    events.filter(e => {
      const y = new Date(e.startDate).getFullYear();
      const ey = e.endDate ? new Date(e.endDate).getFullYear() : y;
      return y === currentYear || ey === currentYear;
    }), [events, currentYear]);

  const monthGroups = useMemo(() => groupEventsByMonth(currentYear, yearEvents), [currentYear, yearEvents]);

  // 각 월 섹션의 ref
  const monthSectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 현재 스크롤 위치에서 지나간 월 추적
  const [passedMonths, setPassedMonths] = useState<number[]>([]);
  // 현재 보이는 월
  const [activeMonth, setActiveMonth] = useState(currentMonthIndex >= 0 ? currentMonthIndex : 0);

  // 스크롤 이벤트 핸들러
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const chipBarHeight = MONTH_CHIP_H; // 칩바 영역 높이
    const passed: number[] = [];
    let active = 0;

    for (let i = 0; i < 12; i++) {
      const section = monthSectionRefs.current[i];
      if (!section) continue;
      const sectionTop = section.offsetTop - container.offsetTop;
      if (sectionTop <= scrollTop + chipBarHeight + 4) {
        passed.push(i);
        active = i;
      }
    }

    setPassedMonths(passed);
    setActiveMonth(active);
  }, []);

  // 스크롤 리스너
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // 현재 월로 초기 스크롤
  useEffect(() => {
    if (currentMonthIndex >= 0) {
      setTimeout(() => scrollToMonth(currentMonthIndex), 150);
    }
  }, [currentMonthIndex]);

  // 월 클릭 시 스크롤
  const scrollToMonth = (idx: number) => {
    const section = monthSectionRefs.current[idx];
    const container = scrollContainerRef.current;
    if (!section || !container) return;
    const sectionTop = section.offsetTop - container.offsetTop;
    container.scrollTo({ top: sectionTop - MONTH_CHIP_H, behavior: 'smooth' });
  };

  const totalEvents = yearEvents.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 연도 헤더 */}
      <div className="flex-shrink-0 flex items-center justify-between bg-[#081429] text-white px-4 py-1.5">
        <span className="text-sm font-bold">{currentYear}년</span>
        <span className="text-xs text-[#fdb813] font-medium">{totalEvents}개 일정</span>
      </div>

      {/* 스티키 월 칩 바 */}
      <div className="flex-shrink-0 flex items-center gap-0.5 px-2 py-1 bg-white border-b border-gray-200 overflow-x-auto" style={{ minHeight: MONTH_CHIP_H }}>
        {monthGroups.map((g, idx) => {
          const isActive = activeMonth === idx;
          const isPassed = passedMonths.includes(idx);
          const isCurrent = currentMonthIndex === idx;
          return (
            <button
              key={idx}
              onClick={() => scrollToMonth(idx)}
              className={`flex-shrink-0 px-2 py-0.5 rounded-sm text-[11px] font-bold transition-all ${
                isActive
                  ? 'bg-[#081429] text-[#fdb813]'
                  : isCurrent
                    ? 'bg-[#fdb813] text-[#081429]'
                    : isPassed
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
              }`}
            >
              {g.label}
              {g.events.length > 0 && (
                <span className={`ml-0.5 text-[9px] ${isActive ? 'text-[#fdb813]/70' : 'opacity-60'}`}>
                  {g.events.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 월별 이벤트 목록 (스크롤) */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {monthGroups.map((group, idx) => {
          const isCurrent = currentMonthIndex === idx;
          const hasEvents = group.events.length > 0;

          return (
            <div
              key={idx}
              ref={el => { monthSectionRefs.current[idx] = el; }}
              className={`border-b border-gray-100 ${isCurrent ? 'bg-amber-50/30' : ''}`}
            >
              {/* 월 구분 헤더 */}
              <div className={`flex items-center justify-between px-4 py-1.5 ${
                isCurrent ? 'bg-[#fdb813] text-[#081429]' : 'bg-gray-50 text-gray-700'
              }`}>
                <span className="text-xs font-bold">{group.label}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${
                  hasEvents
                    ? isCurrent ? 'bg-[#081429] text-[#fdb813]' : 'bg-gray-200 text-gray-600'
                    : 'text-gray-400'
                }`}>
                  {group.events.length}개
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
                        className="flex items-start gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex-shrink-0 w-9 text-center">
                          <div className="text-base font-bold text-gray-800 leading-tight">
                            {format(startDate, 'd')}
                          </div>
                          <div className="text-[9px] text-gray-400 font-medium">
                            {format(startDate, 'EEE', { locale: ko })}
                          </div>
                        </div>
                        <div
                          className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: dept?.color || evt.color || '#6b7280' }}
                        />
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
                              <span className="text-[9px] text-gray-400">~{format(endDate, 'M/d')}</span>
                            )}
                            {evt.startTime && (
                              <span className="text-[9px] text-gray-400">{evt.startTime}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-3 text-[10px] text-gray-300 text-center">일정 없음</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default YearlyListView;
