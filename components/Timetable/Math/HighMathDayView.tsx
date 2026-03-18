// HighMathDayView - 고등수학 요일별 시간표 뷰
// 월~금(+토,일) 컬럼으로 수업을 시간순 나열, 교시 그리드 없음

import React, { useMemo } from 'react';
import { TimetableClass, Teacher, UnifiedStudent } from '../../../types';
import { MATH_PERIOD_INFO, WEEKEND_PERIOD_INFO, formatScheduleCompact } from '../constants';

interface HighMathDayViewProps {
    classes: TimetableClass[];
    teachers: Teacher[];
    studentMap: Record<string, UnifiedStudent>;
    searchQuery?: string;
}

interface DayClassEntry {
    cls: TimetableClass;
    periods: string[];       // periods on this specific day
    startPeriod: number;     // earliest period number
    periodCount: number;     // how many periods on this day
    timeLabel: string;       // e.g. "20:10~22:00"
}

const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일'];
const DAY_LABELS: Record<string, string> = {
    '월': '월요일', '화': '화요일', '수': '수요일',
    '목': '목요일', '금': '금요일', '토': '토요일', '일': '일요일',
};

const getTeacherColor = (teacherName: string, teachers: Teacher[]): { bg: string; text: string } => {
    const teacher = teachers.find(t => t.name === teacherName || t.englishName === teacherName);
    if (teacher?.bgColor) {
        return { bg: teacher.bgColor, text: teacher.textColor || '#fff' };
    }
    return { bg: '#a855f7', text: '#ffffff' };
};

const HighMathDayView: React.FC<HighMathDayViewProps> = ({
    classes,
    teachers,
    studentMap,
    searchQuery = '',
}) => {
    // Parse classes into day-based structure
    const dayColumns = useMemo(() => {
        const dayMap = new Map<string, DayClassEntry[]>();

        for (const cls of classes) {
            if (!cls.schedule || cls.schedule.length === 0) continue;

            // Search filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchName = (cls.className || '').toLowerCase().includes(q);
                const matchTeacher = (cls.teacher || '').toLowerCase().includes(q);
                const matchRoom = (cls.room || '').toLowerCase().includes(q);
                // Check student names
                const matchStudent = (cls.studentIds || []).some(id => {
                    const s = studentMap[id];
                    return s && s.name.toLowerCase().includes(q);
                });
                if (!matchName && !matchTeacher && !matchRoom && !matchStudent) continue;
            }

            // Group schedule entries by day
            const dayPeriods = new Map<string, string[]>();
            for (const slot of cls.schedule) {
                const parts = slot.split(' ');
                const day = parts[0];
                const periodId = parts[1] || '';
                if (!day || !periodId) continue;
                if (!dayPeriods.has(day)) dayPeriods.set(day, []);
                dayPeriods.get(day)!.push(periodId);
            }

            // Create an entry for each day this class appears on
            for (const [day, periods] of dayPeriods) {
                if (!dayMap.has(day)) dayMap.set(day, []);

                const isWeekend = day === '토' || day === '일';
                const periodInfo = isWeekend ? WEEKEND_PERIOD_INFO : MATH_PERIOD_INFO;
                const sortedPeriods = periods.sort((a, b) => Number(a) - Number(b));
                const startPeriodNum = Number(sortedPeriods[0]) || 0;

                // Build time label
                const firstPeriod = periodInfo[sortedPeriods[0]];
                const lastPeriod = periodInfo[sortedPeriods[sortedPeriods.length - 1]];
                const timeLabel = firstPeriod && lastPeriod
                    ? `${firstPeriod.startTime}~${lastPeriod.endTime}`
                    : '';

                dayMap.get(day)!.push({
                    cls,
                    periods: sortedPeriods,
                    startPeriod: startPeriodNum,
                    periodCount: sortedPeriods.length,
                    timeLabel,
                });
            }
        }

        // Sort classes within each day by start period
        for (const entries of dayMap.values()) {
            entries.sort((a, b) => a.startPeriod - b.startPeriod);
        }

        // Return only days that have classes, in order
        return DAY_ORDER
            .filter(day => dayMap.has(day) && dayMap.get(day)!.length > 0)
            .map(day => ({ day, entries: dayMap.get(day)! }));
    }, [classes, teachers, studentMap, searchQuery]);

    if (dayColumns.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                표시할 수업이 없습니다.
            </div>
        );
    }

    // Calculate the base height per period slot (for proportional sizing)
    const PERIOD_HEIGHT = 80; // px per period

    return (
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
            <div className="flex gap-3 min-w-max">
                {dayColumns.map(({ day, entries }) => (
                    <div key={day} className="flex flex-col min-w-[200px] max-w-[280px] flex-1">
                        {/* Day Header */}
                        <div className="bg-gray-800 text-white text-center py-2 px-3 font-bold text-sm rounded-t-md">
                            {DAY_LABELS[day] || day}
                            <span className="ml-2 text-xs text-gray-400 font-normal">
                                ({entries.length}개)
                            </span>
                        </div>

                        {/* Class Cards */}
                        <div className="flex flex-col bg-white border border-gray-200 border-t-0 rounded-b-md overflow-hidden">
                            {entries.map((entry, idx) => {
                                const { cls, periodCount, timeLabel } = entry;
                                const teacherColor = getTeacherColor(cls.teacher, teachers);
                                const studentCount = cls.studentIds?.length || cls.studentList?.length || 0;
                                const minHeight = Math.max(periodCount * PERIOD_HEIGHT, 70);

                                return (
                                    <div
                                        key={`${cls.id}_${day}_${idx}`}
                                        className="border-b border-gray-100 last:border-b-0 p-3 hover:bg-gray-50 transition-colors"
                                        style={{ minHeight: `${minHeight}px` }}
                                    >
                                        {/* Teacher Badge + Time */}
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span
                                                className="px-2 py-0.5 rounded text-xs font-bold shadow-sm"
                                                style={{ backgroundColor: teacherColor.bg, color: teacherColor.text }}
                                            >
                                                {cls.teacher}
                                            </span>
                                            {timeLabel && (
                                                <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                                                    {timeLabel}
                                                </span>
                                            )}
                                        </div>

                                        {/* Class Name */}
                                        <div className="text-sm font-bold text-gray-800 mb-1 leading-tight">
                                            {cls.className}
                                        </div>

                                        {/* Room */}
                                        {cls.room && (
                                            <div className="text-xs text-gray-500 mb-1.5">
                                                {cls.room}
                                            </div>
                                        )}

                                        {/* Schedule (compact format) */}
                                        <div className="text-xs text-purple-600 font-medium mb-1.5">
                                            {formatScheduleCompact(cls.schedule, 'highmath')}
                                        </div>

                                        {/* Student Count */}
                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span>{studentCount}명</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HighMathDayView;
