import React, { useMemo, useState } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, startOfYear, addYears, subYears } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarEvent, BucketItem, Department } from '../../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, Trash2, Flag, Pencil, ArrowRightCircle, Archive } from 'lucide-react';
import BucketModal from './BucketModal';

interface YearlyViewProps {
    currentDate: Date;
    events: CalendarEvent[];
    onDateChange: (date: Date) => void;
    onViewChange: (mode: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
    departments: Department[];
    showSidePanel?: boolean;
    onQuickAdd?: (date: Date) => void; // Quick Add: Click date to add event
    // Bucket List Props
    bucketItems?: BucketItem[];
    onAddBucket?: (title: string, targetMonth: string, priority: 'high' | 'medium' | 'low') => void;
    onEditBucket?: (id: string, title: string, priority: 'high' | 'medium' | 'low') => void;
    onDeleteBucket?: (id: string) => void;
    onConvertBucket?: (bucket: BucketItem) => void; // Convert bucket to main event
}

const YearlyView: React.FC<YearlyViewProps> = ({
    currentDate,
    events,
    onDateChange,
    onViewChange,
    departments,
    showSidePanel = true,
    onQuickAdd,
    bucketItems = [],
    onAddBucket,
    onEditBucket,
    onDeleteBucket,
    onConvertBucket
}) => {
    const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
        const now = new Date();
        return isSameMonth(now, currentDate) ? now : startOfYear(currentDate);
    });

    // Bucket Modal State
    const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
    const [editingBucketItem, setEditingBucketItem] = useState<BucketItem | null>(null);

    const yearStart = startOfYear(currentDate);
    const months = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
    }, [yearStart]);

    // 1. Build Lookup Maps for Category Heatmap
    const { deptCategoryMap, categoryColorMap } = useMemo(() => {
        const dMap: Record<string, string> = {};
        const cMap: Record<string, string> = {};

        departments.forEach(d => {
            if (d.category) {
                dMap[d.id] = d.category;
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

    // 3. Helper to determine cell style (Category Heatmap)
    const getDayStyle = (dateKey: string) => {
        const data = densityMap[dateKey];
        if (!data || data.total === 0) return { className: 'bg-gray-50' };

        const categories = Object.keys(data.categories).filter(c => c !== 'Uncategorized');
        const isConflict = categories.length > 1;

        let dominantCategory = 'Uncategorized';
        let maxCount = 0;
        Object.entries(data.categories as Record<string, number>).forEach(([cat, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantCategory = cat;
            }
        });

        const baseColor = categoryColorMap[dominantCategory] || '#6366f1';
        const opacity = Math.min(data.total * 0.15 + 0.1, 0.9);

        return {
            className: `text-[5px] sm:text-[6px] lg:text-nano font-medium relative overflow-hidden ${isConflict ? 'ring-1 ring-red-500 z-10' : ''}`,
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

    // Filter events for selected month (Bottom Pane)
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

    // Calculate department event counts for selected month
    const departmentCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        selectedMonthEvents.forEach(e => {
            const deptId = e.departmentId;
            if (deptId) counts[deptId] = (counts[deptId] || 0) + 1;
        });
        return counts;
    }, [selectedMonthEvents]);

    // 월별 버킷리스트 카운트 맵 (성능 최적화)
    const bucketCountByMonth = useMemo(() => {
        const countMap: Record<string, number> = {};
        bucketItems.forEach(bucket => {
            const month = bucket.targetMonth; // 'YYYY-MM' format
            countMap[month] = (countMap[month] || 0) + 1;
        });
        return countMap;
    }, [bucketItems]);

    const currentYear = currentDate.getFullYear();

    return (
        <>
            <div className="flex flex-col h-full overflow-hidden">
                {/* Year Navigation Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-1 p-1 bg-[#f8fafc] rounded-none border border-gray-200 shadow-sm">
                        <button
                            onClick={() => onDateChange(subYears(currentDate, 1))}
                            className="p-1.5 hover:bg-white hover:shadow-md rounded-none transition-all text-gray-400 hover:text-primary"
                        >
                            <ChevronLeft size={16} strokeWidth={3} />
                        </button>
                        <span className="px-3 py-1 text-sm font-bold text-primary">
                            {currentYear}년
                        </span>
                        <button
                            onClick={() => onDateChange(addYears(currentDate, 1))}
                            className="p-1.5 hover:bg-white hover:shadow-md rounded-none transition-all text-gray-400 hover:text-primary"
                        >
                            <ChevronRight size={16} strokeWidth={3} />
                        </button>
                    </div>

                    {/* Left Group: Controls */}
                    <div className="flex items-center gap-2">

                    </div>

                    {/* Category Legend */}
                    <div className="flex flex-wrap gap-2 items-center">
                        {Object.entries(categoryColorMap).map(([cat, color]) => (
                            <div key={cat} className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-none" style={{ backgroundColor: color }} />
                                <span className="text-xxs text-gray-500 font-medium">{cat}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 12 Month Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-1 sm:gap-1.5 lg:gap-2">
                        {months.map(month => {
                            const mStart = startOfMonth(month);
                            const mEnd = endOfMonth(month);
                            const days = eachDayOfInterval({ start: mStart, end: mEnd });
                            const startDayOfWeek = mStart.getDay();
                            const emptySlots = Array(startDayOfWeek).fill(null);
                            const isSelected = isSameMonth(month, selectedMonth);

                            return (
                                <div
                                    key={month.toString()}
                                    onClick={() => handleMonthClick(month)}
                                    onDoubleClick={() => handleMonthDoubleClick(month)}
                                    className={`
                                    bg-white rounded-none shadow-sm border p-1.5 sm:p-2 transition-all cursor-pointer
                                    ${isSelected ? 'ring-2 ring-[#fdb813] border-transparent' : 'border-gray-100 hover:border-accent/50'}
                                `}
                                >
                                    <div className="flex justify-between items-center mb-1 sm:mb-1.5">
                                        <h3 className={`text-xxs sm:text-xs lg:text-sm font-bold ${isSelected ? 'text-primary' : 'text-gray-600'}`}>
                                            {format(month, 'M월')}
                                        </h3>

                                        {/* 우측 배지 영역 */}
                                        <div className="flex gap-1 items-center">
                                            {/* 버킷 표시기 */}
                                            {(() => {
                                                const bucketCount = bucketCountByMonth[format(month, 'yyyy-MM')] || 0;
                                                if (bucketCount === 0) return null;

                                                const displayCount = bucketCount > 99 ? '99+' : bucketCount;

                                                return (
                                                    <div
                                                        className="flex items-center gap-0.5 text-nano sm:text-xxs lg:text-xs px-1 sm:px-1.5 lg:px-2 py-0.5 rounded-none font-bold transition-all"
                                                        style={{
                                                            backgroundColor: isSelected ? '#fdb813' : '#fdb81380',
                                                            color: 'rgb(8, 20, 41)' /* primary */
                                                        }}
                                                        role="status"
                                                        aria-label={`${format(month, 'M월')}에 ${bucketCount}개의 버킷리스트 항목`}
                                                        title={`${bucketCount}개의 버킷리스트`}
                                                    >
                                                        <Flag size={isSelected ? 10 : 8} strokeWidth={2.5} aria-hidden="true" />
                                                        <span>{displayCount}</span>
                                                    </div>
                                                );
                                            })()}

                                            {/* 기존 "선택됨" 배지 */}
                                            {isSelected && (
                                                <span
                                                    className="text-[6px] sm:text-nano px-1 py-0.5 rounded-none font-bold"
                                                    style={{ backgroundColor: 'rgb(253, 184, 19)' /* accent */, color: 'rgb(8, 20, 41)' /* primary */ }}
                                                >
                                                    선택됨
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-7 gap-[1px] text-center">
                                        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                                            <div key={d} className="text-[5px] sm:text-[6px] lg:text-nano text-gray-400 font-medium">{d}</div>
                                        ))}

                                        {emptySlots.map((_, i) => <div key={`empty-${i}`} />)}

                                        {days.map(day => {
                                            const dateKey = format(day, 'yyyy-MM-dd');
                                            const data = densityMap[dateKey];
                                            const count = data?.total || 0;

                                            // Brand colors: Navy #081429, Yellow #fdb813, Gray #373d41
                                            const getDensityStyle = () => {
                                                if (count === 0) return {};
                                                if (count >= 5) return { backgroundColor: 'rgb(8, 20, 41)' /* primary */, color: 'rgb(253, 184, 19)' /* accent */ }; // Navy bg, Yellow text
                                                if (count >= 3) return { backgroundColor: 'rgb(51, 78, 104)' /* primary-700 */, color: 'rgb(253, 184, 19)' /* accent */ }; // Gray bg, Yellow text
                                                if (count >= 2) return { backgroundColor: 'rgb(253, 184, 19)' /* accent */, color: 'rgb(8, 20, 41)' /* primary */ }; // Yellow bg, Navy text
                                                return { backgroundColor: 'rgba(253, 184, 19, 0.4)' /* accent with opacity */, color: 'rgb(8, 20, 41)' /* primary */ }; // Light Yellow bg, Navy text
                                            };

                                            return (
                                                <div
                                                    key={dateKey}
                                                    className={`aspect-square flex items-center justify-center ${onQuickAdd ? 'cursor-pointer hover:ring-2 hover:ring-[#fdb813] hover:ring-offset-1' : ''}`}
                                                    title={`${format(day, 'yyyy-MM-dd')}: ${count}개 일정`}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent month card click
                                                        if (onQuickAdd) onQuickAdd(day);
                                                    }}
                                                >
                                                    <span
                                                        className={`
                                                        w-full h-full flex items-center justify-center
                                                        text-[6px] sm:text-nano lg:text-xxs font-medium
                                                        rounded-none
                                                        ${count === 0 ? 'text-gray-600' : ''}
                                                    `}
                                                        style={getDensityStyle()}
                                                    >
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

                {/* Bottom Pane: Horizontal Scroll Event Cards */}
                {showSidePanel && (
                    <div className="flex-shrink-0 bg-white border-t border-gray-200">
                        {/* Header with Department Summary Chips */}
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50/80 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <CalendarIcon size={14} className="text-accent" />
                                <span className="text-sm font-bold text-primary">
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
                                        className="flex items-center gap-1 text-xxs font-bold px-2 py-0.5 rounded-none border"
                                        style={{
                                            backgroundColor: dept.color + '15',
                                            borderColor: dept.color + '40',
                                            color: dept.color
                                        }}
                                    >
                                        {dept.name}
                                        <span
                                            className="text-micro px-1 rounded-none"
                                            style={{ backgroundColor: dept.color, color: '#fff' }}
                                        >
                                            {departmentCounts[dept.id]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bucket List Section */}
                        {onAddBucket && (
                            <div className="px-3 py-2 bg-accent/10 border-b border-accent/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Flag size={12} className="text-accent" />
                                    <span className="text-xs font-bold text-primary">
                                        {format(selectedMonth, 'M월')} 버킷리스트
                                    </span>
                                    <span className="text-xxs text-gray-400">
                                        ({bucketItems.filter(b => b.targetMonth === format(selectedMonth, 'yyyy-MM')).length}개)
                                    </span>
                                </div>

                                {/* Bucket Cards */}
                                <div className="flex flex-row-reverse gap-2 overflow-x-auto custom-scrollbar pb-2">
                                    {bucketItems
                                        .filter(b => b.targetMonth === format(selectedMonth, 'yyyy-MM'))
                                        .sort((a, b) => {
                                            // 부서 색상이 지정된 항목을 우측으로 정렬
                                            const aDept = departments.find(d => d.id === a.departmentId);
                                            const bDept = departments.find(d => d.id === b.departmentId);
                                            const aHasColor = aDept?.color ? 1 : 0;
                                            const bHasColor = bDept?.color ? 1 : 0;

                                            // 색상 있는 항목이 뒤로 (우측으로)
                                            if (aHasColor !== bHasColor) {
                                                return aHasColor - bHasColor;
                                            }

                                            // 같은 그룹 내에서는 우선순위 순서 유지
                                            const priorityOrder = { high: 0, medium: 1, low: 2 };
                                            return priorityOrder[a.priority] - priorityOrder[b.priority];
                                        })
                                        .map(bucket => (
                                            <div
                                                key={bucket.id}
                                                onClick={() => {
                                                    setEditingBucketItem(bucket);
                                                    setIsBucketModalOpen(true);
                                                }}
                                                className={`
                                                flex-shrink-0 w-28 p-2 rounded-none border cursor-pointer group hover:shadow-md transition-all
                                                ${bucket.priority === 'high' ? 'bg-red-50 border-red-200' :
                                                        bucket.priority === 'medium' ? 'bg-accent/20 border-accent/40' :
                                                            'bg-gray-50 border-gray-200'}
                                            `}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className={`text-nano px-1 py-0.5 rounded-none font-bold
                                                    ${bucket.priority === 'high' ? 'bg-red-500 text-white' :
                                                            bucket.priority === 'medium' ? 'bg-primary text-accent' :
                                                                'bg-gray-400 text-white'}
                                                `}>
                                                        {bucket.priority === 'high' ? '높음' : bucket.priority === 'medium' ? '중간' : '낮음'}
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {onConvertBucket && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onConvertBucket(bucket);
                                                                }}
                                                                className="text-gray-400 hover:text-green-500"
                                                                title="일정으로 변환"
                                                            >
                                                                <ArrowRightCircle size={10} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingBucketItem(bucket);
                                                                setIsBucketModalOpen(true);
                                                            }}
                                                            className="text-gray-400 hover:text-blue-500"
                                                        >
                                                            <Pencil size={10} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDeleteBucket?.(bucket.id);
                                                            }}
                                                            className="text-gray-400 hover:text-red-500"
                                                        >
                                                            <Trash2 size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Department Display */}
                                                {bucket.departmentId && (() => {
                                                    const dept = departments.find(d => d.id === bucket.departmentId);
                                                    if (!dept) return null;
                                                    return (
                                                        <div
                                                            className="text-nano px-1.5 py-0.5 rounded-none font-bold mt-1 inline-block"
                                                            style={{
                                                                backgroundColor: dept.color || '#6b7280',
                                                                color: '#ffffff'
                                                            }}
                                                        >
                                                            {dept.name}
                                                        </div>
                                                    );
                                                })()}
                                                <div className="text-xxs font-medium text-gray-700 mt-1 line-clamp-2">
                                                    {bucket.title}
                                                </div>
                                                {/* Author Display */}
                                                {bucket.authorName && (
                                                    <div className="text-nano text-gray-400 mt-1 truncate">
                                                        by {bucket.authorName}
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                    {/* Add Bucket Button */}
                                    <button
                                        onClick={() => {
                                            setEditingBucketItem(null);
                                            setIsBucketModalOpen(true);
                                        }}
                                        className="flex-shrink-0 w-28 p-2 rounded-none border-2 border-dashed border-gray-300 hover:border-accent flex items-center justify-center gap-1 text-gray-400 hover:text-accent transition-colors"
                                    >
                                        <Plus size={12} />
                                        <span className="text-xxs font-bold">추가</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Compact Event Cards - Horizontal Scroll */}
                        <div className="overflow-x-auto custom-scrollbar">
                            <div className="flex gap-2 p-2 min-w-max">
                                {selectedMonthEvents.length > 0 ? (
                                    selectedMonthEvents.map(evt => {
                                        const dept = departments.find(d => d.id === evt.departmentId);
                                        return (
                                            <div
                                                key={evt.id}
                                                className="flex-shrink-0 w-36 bg-white rounded-none border border-gray-100 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                                            >
                                                {/* Color Bar Top */}
                                                <div
                                                    className="h-1"
                                                    style={{ backgroundColor: dept?.color || '#6b7280' }}
                                                />
                                                <div className="p-2">
                                                    {/* Date + Dept */}
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xxs font-bold text-gray-500">
                                                            {format(new Date(evt.startDate), 'M/d')}
                                                        </span>
                                                        {dept && (
                                                            <span
                                                                className="text-nano px-1 py-0.5 rounded-none font-bold"
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

            {/* Bucket Modal */}
            <BucketModal
                isOpen={isBucketModalOpen}
                onClose={() => {
                    setIsBucketModalOpen(false);
                    setEditingBucketItem(null);
                }}
                onSave={(title, priority) => {
                    if (editingBucketItem) {
                        // Edit mode
                        onEditBucket?.(editingBucketItem.id, title, priority);
                    } else {
                        // Add mode
                        onAddBucket?.(title, format(selectedMonth, 'yyyy-MM'), priority);
                    }
                }}
                onDelete={onDeleteBucket}
                editingBucket={editingBucketItem}
                targetMonth={format(selectedMonth, 'yyyy년 M월')}
            />
        </>
    );
};

export default YearlyView;
