// HighMathDayView - 고등수학 요일별 시간표 (엑셀 테이블 형태)
// 월~금(+토,일) 컬럼, 수업 시간순 나열, 교시 그리드 없음

import React, { useMemo } from 'react';
import { TimetableClass, Teacher, UnifiedStudent } from '../../../types';
import { MATH_PERIOD_INFO, WEEKEND_PERIOD_INFO } from '../constants';

interface HighMathDayViewProps {
    classes: TimetableClass[];
    teachers: Teacher[];
    studentMap: Record<string, UnifiedStudent>;
    searchQuery?: string;
}

interface DayClassEntry {
    cls: TimetableClass;
    periods: string[];
    startPeriod: number;
    periodCount: number;
    timeLabel: string;
}

const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일'];

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
    const dayColumns = useMemo(() => {
        const dayMap = new Map<string, DayClassEntry[]>();

        for (const cls of classes) {
            if (!cls.schedule || cls.schedule.length === 0) continue;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchName = (cls.className || '').toLowerCase().includes(q);
                const matchTeacher = (cls.teacher || '').toLowerCase().includes(q);
                const matchRoom = (cls.room || '').toLowerCase().includes(q);
                const matchStudent = (cls.studentIds || []).some(id => {
                    const s = studentMap[id];
                    return s && s.name.toLowerCase().includes(q);
                });
                if (!matchName && !matchTeacher && !matchRoom && !matchStudent) continue;
            }

            const dayPeriods = new Map<string, string[]>();
            for (const slot of cls.schedule) {
                const parts = slot.split(' ');
                const day = parts[0];
                const periodId = parts[1] || '';
                if (!day || !periodId) continue;
                if (!dayPeriods.has(day)) dayPeriods.set(day, []);
                dayPeriods.get(day)!.push(periodId);
            }

            for (const [day, periods] of dayPeriods) {
                if (!dayMap.has(day)) dayMap.set(day, []);

                const isWeekend = day === '토' || day === '일';
                const periodInfo = isWeekend ? WEEKEND_PERIOD_INFO : MATH_PERIOD_INFO;
                const sortedPeriods = periods.sort((a, b) => Number(a) - Number(b));
                const startPeriodNum = Number(sortedPeriods[0]) || 0;

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

        for (const entries of dayMap.values()) {
            entries.sort((a, b) => a.startPeriod - b.startPeriod);
        }

        return DAY_ORDER
            .filter(day => dayMap.has(day) && dayMap.get(day)!.length > 0)
            .map(day => ({ day, entries: dayMap.get(day)! }));
    }, [classes, studentMap, searchQuery]);

    // Max number of classes in any single day (for table row count)
    const maxRows = useMemo(() => {
        return Math.max(1, ...dayColumns.map(d => d.entries.length));
    }, [dayColumns]);

    if (dayColumns.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                표시할 수업이 없습니다.
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto bg-white border-t border-gray-200">
            <table className="w-full border-collapse text-xs min-w-[600px]">
                {/* Day Headers */}
                <thead className="sticky top-0 z-10">
                    <tr>
                        {dayColumns.map(({ day, entries }) => (
                            <th
                                key={day}
                                className="bg-gray-800 text-white font-bold text-sm px-3 py-2 border border-gray-700 text-center"
                            >
                                {day}
                                <span className="ml-1 text-xs text-gray-400 font-normal">
                                    ({entries.length})
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: maxRows }, (_, rowIdx) => (
                        <tr key={rowIdx}>
                            {dayColumns.map(({ day, entries }) => {
                                const entry = entries[rowIdx];
                                if (!entry) {
                                    return (
                                        <td key={day} className="border border-gray-200 bg-gray-50 p-1 align-top" />
                                    );
                                }

                                const { cls, periodCount, timeLabel } = entry;
                                const teacherColor = getTeacherColor(cls.teacher, teachers);
                                const studentCount = cls.studentIds?.length || cls.studentList?.length || 0;
                                // Height proportional to period count (min 60px for 1 period)
                                const cellHeight = Math.max(periodCount * 50, 60);

                                return (
                                    <td
                                        key={`${day}_${cls.id}`}
                                        className="border border-gray-200 p-0 align-top"
                                        style={{ height: `${cellHeight}px` }}
                                    >
                                        <div className="h-full flex flex-col">
                                            {/* Teacher color bar */}
                                            <div
                                                className="px-2 py-1 text-xs font-bold flex items-center justify-between"
                                                style={{ backgroundColor: teacherColor.bg, color: teacherColor.text }}
                                            >
                                                <span>{cls.teacher}</span>
                                                <span className="opacity-80 font-normal">{timeLabel}</span>
                                            </div>
                                            {/* Class info */}
                                            <div className="px-2 py-1.5 flex-1 flex flex-col gap-0.5">
                                                <div className="font-bold text-gray-900 text-xs leading-tight">
                                                    {cls.className}
                                                </div>
                                                {cls.room && (
                                                    <div className="text-gray-400 text-[10px]">{cls.room}</div>
                                                )}
                                                <div className="text-gray-500 text-[10px] mt-auto">
                                                    {studentCount}명
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default HighMathDayView;
