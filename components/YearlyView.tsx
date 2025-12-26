import React, { useMemo, useState } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfYear, setYear, addYears, subYears } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarEvent } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';

interface YearlyViewProps {
    currentDate: Date;
    events: CalendarEvent[];
    onDateChange: (date: Date) => void;
    onViewChange: (mode: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
    departments: { id: string; name: string; color: string }[];
    showSidePanel?: boolean;
}

const YearlyView: React.FC<YearlyViewProps> = ({
    currentDate,
    events,
    onDateChange,
    onViewChange,
    departments,
    showSidePanel = true
}) => {
    // Default selected month to current month if in the same year, otherwise Jan of that year
    const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
        const now = new Date();
        return isSameMonth(now, currentDate) ? now : startOfYear(currentDate);
    });

    const yearStart = startOfYear(currentDate);
    const months = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
    }, [yearStart]);

    // Calculate density map: { "yyyy-MM-dd": count }
    const densityMap = useMemo(() => {
        const map: Record<string, number> = {};
        events.forEach(event => {
            if (!event.startDate) return;
            const start = new Date(event.startDate);
            const end = event.endDate ? new Date(event.endDate) : start;

            // For simplicity in yearly view, just count the start date or range?
            // "Density" usually implies all occupied days.
            // Let's iterate days for each event (careful with performance for many long events)
            // Optimization: If event is < 2 days, just mark start. If long, mark range.
            try {
                const days = eachDayOfInterval({ start, end });
                days.forEach(day => {
                    const key = format(day, 'yyyy-MM-dd');
                    map[key] = (map[key] || 0) + 1;
                });
            } catch (e) {
                // Fallback for invalid intervals
                const key = format(start, 'yyyy-MM-dd');
                map[key] = (map[key] || 0) + 1;
            }
        });
        return map;
    }, [events]);

    const getDensityColor = (count: number) => {
        if (!count) return 'bg-gray-50'; // Empty
        if (count >= 10) return 'bg-indigo-900 text-white';
        if (count >= 6) return 'bg-indigo-700 text-white';
        if (count >= 3) return 'bg-indigo-500 text-white';
        if (count >= 1) return 'bg-indigo-200 text-indigo-900';
        return 'bg-gray-50';
    };

    const handleMonthClick = (month: Date) => {
        // Mobile: Maybe jump to monthly view?
        // PC: Select for side panel
        setSelectedMonth(month);
    };

    const handleMonthDoubleClick = (month: Date) => {
        onDateChange(month);
        onViewChange('monthly');
    };

    // Filter events for the selected month list (Right Pane)
    const selectedMonthEvents = useMemo(() => {
        if (!selectedMonth) return [];
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);

        return events.filter(e => {
            const eStart = new Date(e.startDate);
            const eEnd = e.endDate ? new Date(e.endDate) : eStart;
            return (eStart <= end && eEnd >= start);
        }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [events, selectedMonth]);

    const groupEventsByDate = (eventList: CalendarEvent[]) => {
        const groups: Record<string, CalendarEvent[]> = {};
        eventList.forEach(e => {
            const dateKey = format(new Date(e.startDate), 'yyyy-MM-dd');
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(e);
        });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    };

    // Calculate department event counts for selected month
    const departmentCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        selectedMonthEvents.forEach(e => {
            const deptId = e.departmentId;
            if (deptId) counts[deptId] = (counts[deptId] || 0) + 1;
        });
        return counts;
    }, [selectedMonthEvents]);

    const currentYear = currentDate.getFullYear();

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Year Navigation Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-1 p-1 bg-[#f8fafc] rounded-xl border border-gray-200 shadow-sm">
                    <button
                        onClick={() => onDateChange(subYears(currentDate, 1))}
                        className="p-1.5 hover:bg-white hover:shadow-md rounded-lg transition-all text-gray-400 hover:text-[#081429]"
                    >
                        <ChevronLeft size={16} strokeWidth={3} />
                    </button>
                    <span className="px-3 py-1 text-sm font-bold text-[#081429]">
                        {currentYear}년
                    </span>
                    <button
                        onClick={() => onDateChange(addYears(currentDate, 1))}
                        className="p-1.5 hover:bg-white hover:shadow-md rounded-lg transition-all text-gray-400 hover:text-[#081429]"
                    >
                        <ChevronRight size={16} strokeWidth={3} />
                    </button>
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    연간 일정
                </div>
            </div>

            {/* 12 Month Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-1 sm:gap-1.5 lg:gap-2">
                    {months.map(month => {
                        const mStart = startOfMonth(month);
                        const mEnd = endOfMonth(month);
                        const days = eachDayOfInterval({ start: mStart, end: mEnd });
                        const startDayOfWeek = mStart.getDay(); // 0(Sun) - 6(Sat)

                        // Fill empty slots for start alignment
                        const emptySlots = Array(startDayOfWeek).fill(null);
                        const isSelected = isSameMonth(month, selectedMonth);

                        return (
                            <div
                                key={month.toString()}
                                onClick={() => handleMonthClick(month)}
                                onDoubleClick={() => handleMonthDoubleClick(month)}
                                className={`
                                    bg-white rounded-md sm:rounded-lg shadow-sm border p-1.5 sm:p-2 transition-all cursor-pointer
                                    ${isSelected ? 'ring-2 ring-[#fdb813] border-transparent' : 'border-gray-100 hover:border-[#fdb813]/50'}
                                `}
                            >
                                <div className="flex justify-between items-center mb-1 sm:mb-1.5">
                                    <h3 className={`text-[10px] sm:text-xs lg:text-sm font-bold ${isSelected ? 'text-[#081429]' : 'text-gray-600'}`}>
                                        {format(month, 'M월')}
                                    </h3>
                                    {isSelected && <span className="text-[6px] sm:text-[8px] bg-[#fdb813] text-[#081429] px-1 py-0.5 rounded-full font-bold">선택됨</span>}
                                </div>

                                <div className="grid grid-cols-7 gap-[1px] text-center">
                                    {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                                        <div key={d} className="text-[5px] sm:text-[6px] lg:text-[8px] text-gray-400 font-medium">{d}</div>
                                    ))}

                                    {emptySlots.map((_, i) => <div key={`empty-${i}`} />)}

                                    {days.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const count = densityMap[dateKey] || 0;
                                        return (
                                            <div
                                                key={dateKey}
                                                className={`
                                                    aspect-square rounded-[1px] sm:rounded-[2px] flex items-center justify-center 
                                                    text-[5px] sm:text-[6px] lg:text-[8px] font-medium
                                                    ${getDensityColor(count)}
                                                `}
                                                title={`${format(day, 'yyyy-MM-dd')}: ${count}개 일정`}
                                            >
                                                {format(day, 'd')}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Pane: Hybrid (Option C) - Department Chips + Event Cards */}
            {showSidePanel && (
                <div className="flex-shrink-0 bg-white border-t border-gray-200">
                    {/* Header with Department Summary Chips */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50/80 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={14} className="text-[#fdb813]" />
                            <span className="text-sm font-bold text-[#081429]">
                                {format(selectedMonth, 'M월')}
                            </span>
                            <span className="text-xs text-gray-400">
                                {selectedMonthEvents.length}개
                            </span>
                        </div>
                        {/* Department Chips */}
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                            {departments.filter(d => departmentCounts[d.id] > 0).map(dept => (
                                <div
                                    key={dept.id}
                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                                    style={{
                                        backgroundColor: dept.color + '15',
                                        borderColor: dept.color + '40',
                                        color: dept.color
                                    }}
                                >
                                    {dept.name}
                                    <span
                                        className="text-[9px] bg-current/20 px-1 rounded-full"
                                        style={{ backgroundColor: dept.color, color: '#fff' }}
                                    >
                                        {departmentCounts[dept.id]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Compact Event Cards - Horizontal Scroll */}
                    <div className="overflow-x-auto custom-scrollbar">
                        <div className="flex gap-2 p-2 min-w-max">
                            {selectedMonthEvents.length > 0 ? (
                                selectedMonthEvents.map(evt => {
                                    const dept = departments.find(d => d.id === evt.departmentId);
                                    return (
                                        <div
                                            key={evt.id}
                                            className="flex-shrink-0 w-36 bg-white rounded-lg border border-gray-100 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                                        >
                                            {/* Color Bar Top */}
                                            <div
                                                className="h-1"
                                                style={{ backgroundColor: dept?.color || '#6b7280' }}
                                            />
                                            <div className="p-2">
                                                {/* Date + Dept */}
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-bold text-gray-500">
                                                        {format(new Date(evt.startDate), 'M/d')}
                                                    </span>
                                                    {dept && (
                                                        <span
                                                            className="text-[8px] px-1 py-0.5 rounded font-bold"
                                                            style={{
                                                                backgroundColor: dept.color + '20',
                                                                color: dept.color
                                                            }}
                                                        >
                                                            {dept.name}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Title */}
                                                <div className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">
                                                    {evt.title}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex items-center justify-center w-full py-3 text-gray-300 text-xs">
                                    <CalendarIcon size={14} className="mr-2 opacity-30" />
                                    이 달에는 일정이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default YearlyView;
