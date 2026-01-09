import React from 'react';
import { TimetableClass, Teacher } from '../../../../types';
import { getClassesForCell, getConsecutiveSpan, shouldSkipCell } from '../utils/gridUtils';
import ClassCard from './ClassCard';
import { MATH_PERIOD_TIMES, ENGLISH_PERIODS, ALL_WEEKDAYS } from '../../constants';
import { BookOpen } from 'lucide-react';

interface TimetableGridProps {
    filteredClasses: TimetableClass[];
    allResources: string[];
    orderedSelectedDays: string[];
    weekDates: Record<string, { date: Date; formatted: string }>;
    viewType: 'teacher' | 'room' | 'class';
    currentPeriods: string[];
    teachers: Teacher[];
    searchQuery: string;
    canEdit: boolean;
    // View Settings
    columnWidth: 'narrow' | 'normal' | 'wide';
    rowHeight: 'short' | 'normal' | 'tall' | 'very-tall';
    fontSize: 'small' | 'normal' | 'large' | 'very-large';
    showClassName: boolean;
    showSchool: boolean;
    showGrade: boolean;
    showEmptyRooms: boolean;
    showStudents: boolean;
    // DnD
    dragOverClassId: string | null;
    onClassClick: (cls: TimetableClass) => void;
    onDragStart: (e: React.DragEvent, studentId: string, fromClassId: string) => void;
    onDragOver: (e: React.DragEvent, classId: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, toClassId: string) => void;

    currentSubjectFilter: string;
    studentMap: Record<string, any>; // Using any temporarily or import UnifiedStudent
}

const TimetableGrid: React.FC<TimetableGridProps> = ({
    filteredClasses,
    allResources,
    orderedSelectedDays,
    weekDates,
    viewType,
    currentPeriods,
    teachers,
    searchQuery,
    canEdit,
    columnWidth,
    rowHeight,
    fontSize,
    showClassName,
    showSchool,
    showGrade,
    showEmptyRooms,
    showStudents,
    dragOverClassId,
    onClassClick,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,

    currentSubjectFilter,
    studentMap
}) => {
    // Helper to get column width style
    const getColumnWidthStyle = (colspan: number) => {
        const baseWidth = columnWidth === 'narrow' ? 100 : columnWidth === 'wide' ? 160 : 130;
        return { width: `${colspan * baseWidth}px`, minWidth: `${colspan * baseWidth}px` };
    };

    const getCellWidthStyle = () => {
        const baseWidth = columnWidth === 'narrow' ? 100 : columnWidth === 'wide' ? 160 : 130;
        return { width: `${baseWidth}px`, minWidth: `${baseWidth}px` };
    };

    if (filteredClasses.length === 0 && allResources.length === 0) {
        console.log('[TimetableGrid] No classes and no resources!');
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                <BookOpen size={48} className="mb-4" />
                <p className="text-lg font-bold">등록된 {currentSubjectFilter} 수업이 없습니다</p>
                <p className="text-sm mt-1">위의 "수업추가" 버튼으로 시작하세요.</p>
            </div>
        );
    }

    return (
        <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-10 bg-gray-50">
                {/* Date + Day Row */}
                <tr>
                    <th className="p-1.5 text-[10px] font-bold text-gray-500 border-b border-r border-gray-200 bg-gray-100 sticky left-0 z-20" rowSpan={2} style={{ width: '60px', minWidth: '60px' }}>
                        교시
                    </th>
                    {orderedSelectedDays.map(day => {
                        const dateInfo = weekDates[day];
                        const teachersForDay = allResources.filter(r =>
                            filteredClasses.some(c =>
                                (viewType === 'teacher' ? c.teacher === r : c.room === r) &&
                                c.schedule?.some(s => s.includes(day))
                            )
                        );
                        // If no teachers for the day, but we are showing the day, show at least one column or handle differently?
                        // Original code: if teachersForDay empty, colspan is 1 (line 555)
                        const colspan = teachersForDay.length || 1;
                        const isWeekend = day === '토' || day === '일';

                        return (
                            <th
                                key={day}
                                colSpan={colspan}
                                className={`p-1.5 text-xs font-bold border-b border-r border-gray-200 text-center ${isWeekend ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-700'}`}
                                style={getColumnWidthStyle(colspan)}
                            >
                                {dateInfo.formatted}({day})
                            </th>
                        );
                    })}
                </tr>
                {/* Teacher/Room Row */}
                <tr>
                    {orderedSelectedDays.map(day => {
                        const teachersForDay = allResources.filter(r =>
                            filteredClasses.some(c =>
                                (viewType === 'teacher' ? c.teacher === r : c.room === r) &&
                                c.schedule?.some(s => s.includes(day))
                            )
                        );

                        if (teachersForDay.length === 0) {
                            return (
                                <th key={`${day}-empty`} className="p-1.5 text-[10px] text-blue-200 border-b border-r border-blue-400 bg-blue-500" style={getCellWidthStyle()}>
                                    -
                                </th>
                            );
                        }

                        return teachersForDay.map(resource => {
                            const teacherData = teachers.find(t => t.name === resource);
                            const bgColor = teacherData?.bgColor || '#3b82f6';
                            const textColor = teacherData?.textColor || '#ffffff';
                            return (
                                <th
                                    key={`${day}-${resource}`}
                                    className="p-1.5 text-[10px] font-bold border-b border-r truncate"
                                    style={{
                                        ...getCellWidthStyle(),
                                        backgroundColor: bgColor,
                                        color: textColor,
                                        borderColor: bgColor
                                    }}
                                    title={resource}
                                >
                                    {resource}
                                </th>
                            );
                        });
                    })}
                </tr>
            </thead>
            <tbody>
                {currentPeriods.map(period => (
                    <tr key={period} className="hover:bg-gray-50/50">
                        <td className="p-1.5 text-[10px] font-bold text-gray-600 border-b border-r border-gray-200 text-center bg-gray-50 sticky left-0 z-10" style={{ width: '90px', minWidth: '90px' }}>
                            {MATH_PERIOD_TIMES[period] || period}
                        </td>
                        {orderedSelectedDays.map(day => {
                            const teachersForDay = allResources.filter(r =>
                                filteredClasses.some(c =>
                                    (viewType === 'teacher' ? c.teacher === r : c.room === r) &&
                                    c.schedule?.some(s => s.includes(day))
                                )
                            );

                            if (teachersForDay.length === 0) {
                                return (
                                    <td key={`${day}-${period}-empty`} className="p-0.5 border-b border-r border-gray-100" style={{ ...getCellWidthStyle(), height: '50px' }} />
                                );
                            }

                            return teachersForDay.map(resource => {
                                const cellClasses = getClassesForCell(filteredClasses, day, period, resource, viewType);
                                const periodIndex = currentPeriods.indexOf(period);

                                // Check if ANY class in this cell is part of a merged span from above
                                const shouldSkipThisCell = cellClasses.some((cls: TimetableClass) => shouldSkipCell(cls, day, periodIndex, cellClasses, currentPeriods, filteredClasses, viewType));

                                if (shouldSkipThisCell) {
                                    return null;
                                }

                                // Calculate rowspan for this cell (if any class spans multiple periods)
                                const maxSpan = Math.max(...cellClasses.map((cls: TimetableClass) => getConsecutiveSpan(cls, day, periodIndex, currentPeriods, filteredClasses, viewType)));

                                return (
                                    <td
                                        key={`${day}-${period}-${resource}`}
                                        className="p-1 border-b border-r border-gray-200 align-top bg-white"
                                        style={getCellWidthStyle()}
                                        rowSpan={maxSpan > 1 ? maxSpan : undefined}
                                    >
                                        {cellClasses.length === 0 && showEmptyRooms ? (
                                            <div className="text-[10px] text-gray-400 text-center py-1">
                                                {viewType === 'room' ? resource : '빈 강의실'}
                                            </div>
                                        ) : (
                                            cellClasses.map((cls: TimetableClass) => (
                                                <ClassCard
                                                    key={cls.id}
                                                    cls={cls}
                                                    span={getConsecutiveSpan(cls, day, periodIndex, currentPeriods, filteredClasses, viewType)}
                                                    searchQuery={searchQuery}
                                                    showStudents={showStudents}
                                                    showClassName={showClassName}
                                                    showSchool={showSchool}
                                                    showGrade={showGrade}
                                                    canEdit={canEdit}
                                                    dragOverClassId={dragOverClassId}
                                                    onClick={onClassClick}
                                                    onDragStart={onDragStart}
                                                    onDragOver={onDragOver}
                                                    onDragLeave={onDragLeave}
                                                    onDrop={onDrop}
                                                    studentMap={studentMap}
                                                />
                                            ))
                                        )}
                                    </td>
                                );
                            });
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default TimetableGrid;
