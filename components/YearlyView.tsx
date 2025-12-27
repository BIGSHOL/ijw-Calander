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
    departments: { id: string; name: string; color: string; category?: string }[];
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

    // 1. Build Lookup Maps
    const { deptCategoryMap, categoryColorMap } = useMemo(() => {
        const dMap: Record<string, string> = {};
        const cMap: Record<string, string> = {};

        departments.forEach(d => {
            if (d.category) {
                dMap[d.id] = d.category;
                // Assign first found color to category if not set
                if (!cMap[d.category] && d.color) {
                    cMap[d.category] = d.color;
                }
            }
        });
        return { deptCategoryMap: dMap, categoryColorMap: cMap };
    }, [departments]);

    // 2. Calculate density map with Category info
    const densityMap = useMemo(() => {
        const map: Record<string, { total: number; categories: Record<string, number> }> = {};

        events.forEach(event => {
            if (!event.startDate) return;
            const start = new Date(event.startDate);
            const end = event.endDate ? new Date(event.endDate) : start;

            // Get category
            const category = deptCategoryMap[event.departmentId] || 'Uncategorized';

            const processDay = (day: Date) => {
                const key = format(day, 'yyyy-MM-dd');
                if (!map[key]) map[key] = { total: 0, categories: {} as Record<string, number> };

                map[key].total += 1;
                map[key].categories[category] = (map[key].categories[category] || 0) + 1;
            };

            try {
                const days = eachDayOfInterval({ start, end });
                days.forEach(processDay);
            } catch (e) {
                processDay(start);
            }
        });
        return map;
    }, [events, deptCategoryMap]);

    // 3. Helper to determine cell style
    const getDayStyle = (dateKey: string) => {
        const data = densityMap[dateKey];
        if (!data || data.total === 0) return { className: 'bg-gray-50' };

        // Check for Conflict (Multiple categories with significant presence)
        const categories = Object.keys(data.categories).filter(c => c !== 'Uncategorized');
        const isConflict = categories.length > 1;

        // Find dominant category
        let dominantCategory = 'Uncategorized';
        let maxCount = 0;
        Object.entries(data.categories as Record<string, number>).forEach(([cat, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantCategory = cat;
            }
        });

        const baseColor = categoryColorMap[dominantCategory] || '#6366f1'; // Default Indigo

        // Calculate opacity based on total count (max out at 5 events)
        const opacity = Math.min(data.total * 0.15 + 0.1, 0.9);

        return {
            style: {
                backgroundColor: baseColor,
                opacity: opacity,
            },
            // Use a semi-transparent overlay approach
            className: `text-[9px] font-medium relative overflow-hidden ${isConflict ? 'ring-1 ring-red-500 z-10' : ''}`,
            customColor: baseColor,
            opacityValue: opacity,
            isConflict
        };
    };

    const handleMonthClick = (month: Date) => {
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

                {/* Legend */}
                <div className="flex flex-wrap gap-3 items-center mb-4 px-2">
                    {Object.entries(categoryColorMap).map(([cat, color]) => (
                        <div key={cat} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs text-gray-600 font-medium">{cat}</span>
                        </div>
                    ))}
                    {Object.keys(categoryColorMap).length === 0 && (
                        <span className="text-xs text-gray-400">카테고리 정보 없음</span>
                    )}
                </div>

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
                                        const { className, style, customColor, opacityValue, isConflict } = getDayStyle(dateKey);
                                        const data = densityMap[dateKey];

                                        return (
                                            <div
                                                key={dateKey}
                                                className={`
                                                    aspect-square rounded-[3px] flex items-center justify-center
                                                    ${className}
                                                `}
                                                style={{
                                                    backgroundColor: customColor ? `${customColor}` : undefined,
                                                    opacity: opacityValue ? 1 : undefined, // Check logic below
                                                }}
                                                title={`${format(day, 'yyyy-MM-dd')}: ${data?.total || 0}개 일정`}
                                            >
                                                {/* Overlay for opacity control to not affect text */}
                                                <div
                                                    className="absolute inset-0"
                                                    style={{
                                                        backgroundColor: customColor || 'transparent',
                                                        opacity: opacityValue || 0
                                                    }}
                                                />
                                                {/* Conflict Indicator */}
                                                {isConflict && <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-red-500 ring-1 ring-white" />}

                                                <span className="relative z-10 text-gray-700">
                                                    {format(day, 'd')}
                                                </span>
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
