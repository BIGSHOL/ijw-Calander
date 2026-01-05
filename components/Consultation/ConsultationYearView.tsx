import React, { useMemo, useState } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, startOfYear, addYears, subYears } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ConsultationRecord } from '../../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users } from 'lucide-react';

// 색상 테마
const COLORS = {
    navy: '#081429',
    yellow: '#fdb813',
    gray: '#373d41',
};

// 필터 타입
type DateFilterType = 'createdAt' | 'consultationDate' | 'paymentDate';

const FILTER_OPTIONS: { key: DateFilterType; label: string; color: string }[] = [
    { key: 'createdAt', label: '접수일', color: '#3b82f6' }, // blue
    { key: 'consultationDate', label: '상담일', color: '#fdb813' }, // yellow
    { key: 'paymentDate', label: '결제일', color: '#10b981' }, // emerald
];

interface ConsultationYearViewProps {
    data: ConsultationRecord[];
    currentYear: number;
    onYearChange: (year: number) => void;
}

export const ConsultationYearView: React.FC<ConsultationYearViewProps> = ({
    data,
    currentYear,
    onYearChange,
}) => {
    const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
        const now = new Date();
        return now.getFullYear() === currentYear ? now : new Date(currentYear, 0, 1);
    });
    const [activeFilters, setActiveFilters] = useState<Set<DateFilterType>>(
        new Set(['createdAt', 'consultationDate', 'paymentDate'])
    );

    const yearStart = new Date(currentYear, 0, 1);
    const months = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
    }, [currentYear]);

    // 날짜별 데이터 맵 생성
    const densityMap = useMemo(() => {
        const map: Record<string, { createdAt: number; consultationDate: number; paymentDate: number }> = {};

        data.forEach(record => {
            // 접수일
            if (record.createdAt) {
                const key = format(new Date(record.createdAt), 'yyyy-MM-dd');
                if (!map[key]) map[key] = { createdAt: 0, consultationDate: 0, paymentDate: 0 };
                map[key].createdAt += 1;
            }
            // 상담일
            if (record.consultationDate) {
                const key = format(new Date(record.consultationDate), 'yyyy-MM-dd');
                if (!map[key]) map[key] = { createdAt: 0, consultationDate: 0, paymentDate: 0 };
                map[key].consultationDate += 1;
            }
            // 결제일
            if (record.paymentDate) {
                const key = format(new Date(record.paymentDate), 'yyyy-MM-dd');
                if (!map[key]) map[key] = { createdAt: 0, consultationDate: 0, paymentDate: 0 };
                map[key].paymentDate += 1;
            }
        });

        return map;
    }, [data]);

    // 필터 토글
    const toggleFilter = (filter: DateFilterType) => {
        const newFilters = new Set(activeFilters);
        if (newFilters.has(filter)) {
            newFilters.delete(filter);
        } else {
            newFilters.add(filter);
        }
        setActiveFilters(newFilters);
    };

    // 날짜 셀 스타일 계산 - 건수에 따른 진하기 적용
    const getDayStyle = (dateKey: string) => {
        const dayData = densityMap[dateKey];
        if (!dayData) return { style: {}, totalCount: 0, colorCount: 0, activeColors: [] as string[] };

        let totalCount = 0;
        const activeColors: string[] = [];

        // 색상 순서: 접수일(파랑), 상담일(노랑), 결제일(초록)
        if (activeFilters.has('createdAt') && dayData.createdAt > 0) {
            totalCount += dayData.createdAt;
            activeColors.push('#3b82f6');
        }
        if (activeFilters.has('consultationDate') && dayData.consultationDate > 0) {
            totalCount += dayData.consultationDate;
            activeColors.push('#fdb813');
        }
        if (activeFilters.has('paymentDate') && dayData.paymentDate > 0) {
            totalCount += dayData.paymentDate;
            activeColors.push('#10b981');
        }

        if (totalCount === 0 || activeColors.length === 0) {
            return { style: {}, totalCount: 0, colorCount: 0, activeColors: [] as string[] };
        }

        // 건수에 따른 투명도 계산 (1건: 0.4, 2건: 0.55, 3건: 0.7, 4건: 0.85, 5건+: 1.0)
        const opacity = Math.min(0.4 + (totalCount - 1) * 0.15, 1.0);

        // 색상 개수에 따른 스타일
        if (activeColors.length === 1) {
            // 단일 색상 - 투명도 적용
            return {
                style: { backgroundColor: activeColors[0], opacity, color: 'white' },
                totalCount,
                colorCount: 1,
                activeColors
            };
        } else if (activeColors.length === 2) {
            // 2개 색상 - 대각선 그라디언트 + 투명도 적용
            return {
                style: {
                    background: `linear-gradient(135deg, ${activeColors[0]} 50%, ${activeColors[1]} 50%)`,
                    opacity,
                    color: 'white'
                },
                totalCount,
                colorCount: 2,
                activeColors
            };
        } else {
            // 3개 색상 - conic-gradient로 120도씩 3등분 + 투명도 적용
            return {
                style: {
                    background: `conic-gradient(from 0deg, ${activeColors[0]} 0deg 120deg, ${activeColors[1]} 120deg 240deg, ${activeColors[2]} 240deg 360deg)`,
                    opacity,
                    color: 'white'
                },
                totalCount,
                colorCount: 3,
                activeColors
            };
        }
    };

    // 선택된 월의 상담 데이터
    const selectedMonthData = useMemo(() => {
        if (!selectedMonth) return [];
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);

        return data.filter(record => {
            const checkDate = (dateStr: string | undefined) => {
                if (!dateStr) return false;
                const d = new Date(dateStr);
                return d >= start && d <= end;
            };

            return (
                (activeFilters.has('createdAt') && checkDate(record.createdAt)) ||
                (activeFilters.has('consultationDate') && checkDate(record.consultationDate)) ||
                (activeFilters.has('paymentDate') && checkDate(record.paymentDate))
            );
        });
    }, [data, selectedMonth, activeFilters]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Year Navigation Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-1 p-1 bg-[#f8fafc] rounded-xl border border-gray-200 shadow-sm">
                    <button
                        onClick={() => onYearChange(currentYear - 1)}
                        className="p-1.5 hover:bg-white hover:shadow-md rounded-lg transition-all text-gray-400 hover:text-[#081429]"
                    >
                        <ChevronLeft size={16} strokeWidth={3} />
                    </button>
                    <span className="px-3 py-1 text-sm font-bold text-[#081429]">
                        {currentYear}년
                    </span>
                    <button
                        onClick={() => onYearChange(currentYear + 1)}
                        className="p-1.5 hover:bg-white hover:shadow-md rounded-lg transition-all text-gray-400 hover:text-[#081429]"
                    >
                        <ChevronRight size={16} strokeWidth={3} />
                    </button>
                </div>

                {/* Filter Legend */}
                <div className="flex flex-wrap gap-2 items-center">
                    {FILTER_OPTIONS.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => toggleFilter(opt.key)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all border ${activeFilters.has(opt.key)
                                ? 'border-transparent shadow-sm'
                                : 'border-gray-200 bg-gray-50 text-gray-400'
                                }`}
                            style={activeFilters.has(opt.key) ? { backgroundColor: opt.color + '20', color: opt.color, borderColor: opt.color } : {}}
                        >
                            <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: activeFilters.has(opt.key) ? opt.color : '#d1d5db' }}
                            />
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 12 Month Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-1 sm:gap-1.5 lg:gap-2">
                    {months.map(month => {
                        const mStart = startOfMonth(month);
                        const mEnd = endOfMonth(month);
                        const days = eachDayOfInterval({ start: mStart, end: mEnd });
                        const startDayOfWeek = mStart.getDay();
                        const emptySlots = Array(startDayOfWeek).fill(null);
                        const isSelected = isSameMonth(month, selectedMonth);

                        // 월별 카운트
                        const monthKey = format(month, 'yyyy-MM');
                        let monthCount = 0;
                        days.forEach(day => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const dayData = densityMap[dateKey];
                            if (dayData) {
                                if (activeFilters.has('createdAt')) monthCount += dayData.createdAt;
                                if (activeFilters.has('consultationDate')) monthCount += dayData.consultationDate;
                                if (activeFilters.has('paymentDate')) monthCount += dayData.paymentDate;
                            }
                        });

                        return (
                            <div
                                key={month.toString()}
                                onClick={() => setSelectedMonth(month)}
                                className={`
                                    bg-white rounded-md sm:rounded-lg shadow-sm border p-1.5 sm:p-2 transition-all cursor-pointer
                                    ${isSelected ? 'ring-2 ring-[#fdb813] border-transparent' : 'border-gray-100 hover:border-[#fdb813]/50'}
                                `}
                            >
                                <div className="flex justify-between items-center mb-1 sm:mb-1.5">
                                    <h3 className={`text-[10px] sm:text-xs lg:text-sm font-bold ${isSelected ? 'text-[#081429]' : 'text-gray-600'}`}>
                                        {format(month, 'M월')}
                                    </h3>
                                    <div className="flex gap-1 items-center">
                                        {monthCount > 0 && (
                                            <span
                                                className="text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                                style={{ backgroundColor: COLORS.yellow, color: COLORS.navy }}
                                            >
                                                {monthCount}
                                            </span>
                                        )}
                                        {isSelected && (
                                            <span
                                                className="text-[6px] sm:text-[8px] px-1 py-0.5 rounded-full font-bold"
                                                style={{ backgroundColor: COLORS.yellow, color: COLORS.navy }}
                                            >
                                                선택됨
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-7 gap-[1px] text-center">
                                    {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                                        <div key={d} className="text-[5px] sm:text-[6px] lg:text-[8px] text-gray-400 font-medium">{d}</div>
                                    ))}

                                    {emptySlots.map((_, i) => <div key={`empty-${i}`} />)}

                                    {days.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const { style, totalCount } = getDayStyle(dateKey);

                                        return (
                                            <div
                                                key={dateKey}
                                                className="aspect-square flex items-center justify-center"
                                                title={`${format(day, 'yyyy-MM-dd')}: ${totalCount}건`}
                                            >
                                                <span
                                                    className={`
                                                        w-full h-full flex items-center justify-center
                                                        text-[6px] sm:text-[8px] lg:text-[10px] font-medium
                                                        rounded-[2px] sm:rounded-[3px]
                                                        ${totalCount === 0 ? 'text-gray-600' : ''}
                                                    `}
                                                    style={style}
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

            {/* Bottom Pane: Selected Month Details */}
            <div className="flex-shrink-0 bg-white border-t border-gray-200">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50/80 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <CalendarIcon size={14} style={{ color: COLORS.yellow }} />
                        <span className="text-sm font-bold" style={{ color: COLORS.navy }}>
                            {format(selectedMonth, 'M월')} 상담
                        </span>
                        <span className="text-xs text-gray-400">
                            {selectedMonthData.length}건
                        </span>
                    </div>
                </div>

                {/* Compact Cards - Horizontal Scroll */}
                <div className="overflow-x-auto custom-scrollbar">
                    <div className="flex gap-2 p-2 min-w-max">
                        {selectedMonthData.length > 0 ? (
                            selectedMonthData.slice(0, 20).map(record => (
                                <div
                                    key={record.id}
                                    className="flex-shrink-0 w-36 bg-white rounded-lg border border-gray-100 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                                >
                                    <div className="h-1" style={{ backgroundColor: COLORS.yellow }} />
                                    <div className="p-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-gray-500">
                                                {record.consultationDate ? format(new Date(record.consultationDate), 'M/d') : '-'}
                                            </span>
                                            <span
                                                className="text-[8px] px-1 py-0.5 rounded font-bold"
                                                style={{ backgroundColor: COLORS.yellow + '30', color: COLORS.navy }}
                                            >
                                                {record.status}
                                            </span>
                                        </div>
                                        <div className="text-xs font-medium text-gray-800 line-clamp-1">
                                            {record.studentName}
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                            {record.schoolName}{record.grade?.replace(/^[초중고]/, '')} · {record.subject}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center justify-center w-full py-3 text-gray-300 text-xs">
                                <Users size={14} className="mr-2 opacity-30" />
                                이 달에는 상담 기록이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
