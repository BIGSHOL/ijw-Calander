import React, { useMemo, useState } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarEvent } from '../types';
import { ChevronRight, Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react';

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

    const selectedEventGroups = groupEventsByDate(selectedMonthEvents);

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6 overflow-hidden">
            {/* Left Pane: 12 Month Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
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
                                    bg-white rounded-xl shadow-sm border p-4 transition-all cursor-pointer
                                    ${isSelected ? 'ring-2 ring-[#fdb813] border-transparent' : 'border-gray-200 hover:border-[#fdb813]/50'}
                                `}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className={`font-bold ${isSelected ? 'text-[#081429]' : 'text-gray-600'}`}>
                                        {format(month, 'M월')}
                                    </h3>
                                    {isSelected && <span className="text-[10px] bg-[#fdb813] text-[#081429] px-1.5 py-0.5 rounded-full font-bold">선택됨</span>}
                                </div>

                                <div className="grid grid-cols-7 gap-1 text-center">
                                    {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                                        <div key={d} className="text-[10px] text-gray-400 font-medium pb-1">{d}</div>
                                    ))}

                                    {emptySlots.map((_, i) => <div key={`empty-${i}`} />)}

                                    {days.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const count = densityMap[dateKey] || 0;
                                        return (
                                            <div
                                                key={dateKey}
                                                className={`
                                                    aspect-square rounded-[3px] flex items-center justify-center text-[9px] font-medium
                                                    ${getDensityColor(count)}
                                                `}
                                                title={`${format(day, 'yyyy-MM-dd')}: ${count}개 일정`}
                                            >
                                                {/* Optional: Show day number only if sparse, or always? Always is better for calendar context */}
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

            {/* Right Pane: Selected Month List (PC Only) */}
            {showSidePanel && (
                <div className="hidden lg:flex w-96 flex-col bg-white border-l border-gray-200">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-lg font-black text-[#081429] flex items-center gap-2">
                            <CalendarIcon size={18} className="text-[#fdb813]" />
                            {format(selectedMonth, 'yyyy년 M월')}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            총 {selectedMonthEvents.length}개의 일정이 있습니다.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        {selectedEventGroups.length > 0 ? (
                            selectedEventGroups.map(([dateKey, groupEvents]) => (
                                <div key={dateKey} className="flex gap-3">
                                    <div className="flex-shrink-0 w-12 pt-1 text-center">
                                        <div className="text-lg font-bold text-gray-800 leading-none">
                                            {format(new Date(dateKey), 'd')}
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">
                                            {format(new Date(dateKey), 'E', { locale: ko })}
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        {groupEvents.map(evt => {
                                            const dept = departments.find(d => d.id === evt.departmentId);
                                            return (
                                                <div
                                                    key={evt.id}
                                                    className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 hover:bg-white hover:shadow-md transition-all group"
                                                >
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <span className="text-xs font-bold text-gray-800 line-clamp-1 group-hover:text-[#081429]">
                                                            {evt.title}
                                                        </span>
                                                        {dept && (
                                                            <span
                                                                className="text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap"
                                                                style={{
                                                                    backgroundColor: dept.color + '20',
                                                                    color: dept.color
                                                                }}
                                                            >
                                                                {dept.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                                        <div className="flex items-center gap-0.5">
                                                            <Clock size={10} />
                                                            {evt.isAllDay ? '종일' : format(new Date(evt.startDate), 'a h:mm')}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 pb-20">
                                <CalendarIcon size={48} className="mb-4 opacity-20" />
                                <p className="text-xs">이 달에는 일정이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default YearlyView;
