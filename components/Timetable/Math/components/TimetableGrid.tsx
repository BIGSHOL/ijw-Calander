import React, { useMemo } from 'react';
import { TimetableClass, Teacher } from '../../../../types';
import { getClassesForCell, getConsecutiveSpan, shouldSkipCell } from '../utils/gridUtils';
import ClassCard from './ClassCard';
import { MATH_PERIOD_TIMES, WEEKEND_PERIOD_TIMES, ENGLISH_PERIODS, ALL_WEEKDAYS } from '../../constants';
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
    studentMap: Record<string, any>;
    // Timetable View Mode
    timetableViewMode: 'day-based' | 'teacher-based';
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
    studentMap,
    timetableViewMode
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

    // 교시당 기본 높이 계산 - 창 크기에 맞게 자동 조절
    const getRowHeight = () => {
        // 기본 높이 설정값
        const baseHeight = rowHeight === 'short' ? 50 : rowHeight === 'tall' ? 80 : rowHeight === 'very-tall' ? 100 : 65;

        // 창 높이에 따른 동적 조절 (8교시 기준으로 화면에 맞춤)
        if (typeof window !== 'undefined') {
            const availableHeight = window.innerHeight - 200; // 헤더 등 제외
            const periodsCount = currentPeriods.length || 8;
            const dynamicHeight = Math.floor(availableHeight / periodsCount * 0.65); // 2/3 크기로 조절
            // 기본 높이와 동적 높이 중 큰 값 사용 (최소 높이 보장)
            return Math.max(baseHeight, Math.min(dynamicHeight, 120));
        }
        return baseHeight;
    };

    // 수요일만
    const hasWednesday = orderedSelectedDays.includes('수');

    // 월/목 그룹 요일
    const monThuDays = useMemo(() => {
        return orderedSelectedDays.filter(day => day === '월' || day === '목');
    }, [orderedSelectedDays]);

    // 화/금 그룹 요일
    const tueFriDays = useMemo(() => {
        return orderedSelectedDays.filter(day => day === '화' || day === '금');
    }, [orderedSelectedDays]);

    // 토/일 그룹 요일
    const weekendDays = useMemo(() => {
        return orderedSelectedDays.filter(day => day === '토' || day === '일');
    }, [orderedSelectedDays]);

    // 월/목 그룹: 각 선생님이 어떤 요일에 수업이 있는지 계산
    const monThuResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();

        allResources.forEach(resource => {
            const daysForResource = monThuDays.filter(day =>
                filteredClasses.some(c =>
                    (viewType === 'teacher' ? c.teacher === resource : c.room === resource) &&
                    c.schedule?.some(s => s.includes(day))
                )
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });

        return map;
    }, [allResources, monThuDays, filteredClasses, viewType]);

    // 화/금 그룹: 각 선생님이 어떤 요일에 수업이 있는지 계산
    const tueFriResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();

        allResources.forEach(resource => {
            const daysForResource = tueFriDays.filter(day =>
                filteredClasses.some(c =>
                    (viewType === 'teacher' ? c.teacher === resource : c.room === resource) &&
                    c.schedule?.some(s => s.includes(day))
                )
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });

        return map;
    }, [allResources, tueFriDays, filteredClasses, viewType]);

    // 토/일 그룹: 각 선생님이 어떤 요일에 수업이 있는지 계산
    const weekendResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();

        allResources.forEach(resource => {
            const daysForResource = weekendDays.filter(day =>
                filteredClasses.some(c =>
                    (viewType === 'teacher' ? c.teacher === resource : c.room === resource) &&
                    c.schedule?.some(s => s.includes(day))
                )
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });

        return map;
    }, [allResources, weekendDays, filteredClasses, viewType]);

    // 수요일 수업이 있는 선생님 (수요일 전용)
    const wednesdayResources = useMemo(() => {
        if (!hasWednesday) return [];
        return allResources.filter(resource =>
            filteredClasses.some(c =>
                (viewType === 'teacher' ? c.teacher === resource : c.room === resource) &&
                c.schedule?.some(s => s.includes('수'))
            )
        );
    }, [allResources, filteredClasses, viewType, hasWednesday]);

    // 수요일 그룹: 각 선생님이 수요일 수업이 있으면 ['수'] 반환
    const wednesdayResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();
        wednesdayResources.forEach(resource => {
            map.set(resource, ['수']);
        });
        return map;
    }, [wednesdayResources]);

    // 월/목 그룹 활성 선생님
    const monThuActiveResources = useMemo(() => {
        return allResources.filter(r => monThuResourceDaysMap.has(r));
    }, [allResources, monThuResourceDaysMap]);

    // 화/금 그룹 활성 선생님
    const tueFriActiveResources = useMemo(() => {
        return allResources.filter(r => tueFriResourceDaysMap.has(r));
    }, [allResources, tueFriResourceDaysMap]);

    // 토/일 그룹 활성 선생님
    const weekendActiveResources = useMemo(() => {
        return allResources.filter(r => weekendResourceDaysMap.has(r));
    }, [allResources, weekendResourceDaysMap]);

    if (filteredClasses.length === 0 && allResources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                <BookOpen size={48} className="mb-4" />
                <p className="text-lg font-bold">등록된 {currentSubjectFilter} 수업이 없습니다</p>
                <p className="text-sm mt-1">수업 관리에서 수업을 추가하세요.</p>
            </div>
        );
    }

    // 테이블 렌더링 함수 (재사용)
    const renderTable = (
        resources: string[],
        daysMap: Map<string, string[]>,
        title?: string,
        isWednesdayTable?: boolean
    ) => {
        if (resources.length === 0) return null;

        // 그룹별 색상 설정
        const getGroupColors = () => {
            if (title === '월/목') return { bg: 'bg-blue-600', border: 'border-blue-600', light: 'bg-blue-50', text: 'text-blue-700' };
            if (title === '화/금') return { bg: 'bg-purple-600', border: 'border-purple-600', light: 'bg-purple-50', text: 'text-purple-700' };
            if (title === '토/일') return { bg: 'bg-orange-600', border: 'border-orange-600', light: 'bg-orange-50', text: 'text-orange-700' };
            return { bg: 'bg-green-600', border: 'border-green-600', light: 'bg-green-50', text: 'text-green-700' };
        };
        const groupColors = getGroupColors();

        return (
            <div className="flex-shrink-0">
                <div className="relative" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                    <table className="border-collapse bg-gray-300" style={{ tableLayout: 'fixed' }}>
                        <thead className="sticky top-0 z-20">
                            {/* Group Title Row */}
                            {title && (
                                <tr>
                                    <th
                                        className={`${groupColors.bg} text-white px-3 py-2 font-bold text-sm text-left sticky left-0 z-30`}
                                        colSpan={1}
                                        style={{ width: '90px', minWidth: '90px' }}
                                    >
                                        {title}
                                    </th>
                                    <th
                                        className={`${groupColors.bg} text-white px-3 py-2 font-bold text-sm`}
                                        colSpan={resources.reduce((acc, r) => acc + (isWednesdayTable ? 1 : (daysMap.get(r) || []).length), 0)}
                                    >
                                    </th>
                                </tr>
                            )}
                            {/* Teacher/Room Row */}
                            <tr>
                                <th
                                    className={`p-1.5 text-xxs font-bold ${groupColors.text} border-b border-gray-200 ${groupColors.light} sticky left-0 z-30`}
                                    rowSpan={2}
                                    style={{ width: '90px', minWidth: '90px' }}
                                >
                                    교시
                                </th>
                                {resources.map(resource => {
                                    const daysForResource = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);
                                    const colspan = daysForResource.length;
                                    const teacherData = teachers.find(t => t.name === resource);
                                    const bgColor = teacherData?.bgColor || '#3b82f6';
                                    const textColor = teacherData?.textColor || '#ffffff';

                                    return (
                                        <th
                                            key={resource}
                                            colSpan={colspan}
                                            className="p-1.5 text-xs font-bold border-b border-r-2 border-r-gray-300 truncate"
                                            style={{
                                                ...getColumnWidthStyle(colspan),
                                                backgroundColor: bgColor,
                                                color: textColor,
                                                borderBottomColor: bgColor
                                            }}
                                            title={resource}
                                        >
                                            {resource}
                                        </th>
                                    );
                                })}
                            </tr>
                            {/* Day Row with Date */}
                            <tr>
                                {resources.map(resource => {
                                    const daysForResource = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);

                                    return daysForResource.map((day, dayIndex) => {
                                        const isWeekend = day === '토' || day === '일';
                                        const isLastDayForResource = dayIndex === daysForResource.length - 1;
                                        const dateInfo = weekDates[day];
                                        // 강사 구분만 굵은선, 나머지는 테두리 없음
                                        const borderRightClass = isLastDayForResource ? 'border-r-2 border-r-gray-400' : '';

                                        return (
                                            <th
                                                key={`${resource}-${day}`}
                                                className={`p-1.5 text-xxs font-bold text-center ${borderRightClass} ${isWeekend ? 'bg-orange-50 text-orange-700' : day === '수' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                                                style={getCellWidthStyle()}
                                            >
                                                <div>{day}</div>
                                                {dateInfo && <div className="text-[10px] opacity-70">{dateInfo.formatted}</div>}
                                            </th>
                                        );
                                    });
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {currentPeriods.map(period => {
                                // 주말 테이블은 WEEKEND_PERIOD_TIMES 사용
                                const isWeekendTable = title === '토/일';
                                const periodTimeDisplay = isWeekendTable
                                    ? (WEEKEND_PERIOD_TIMES[period] || period)
                                    : (MATH_PERIOD_TIMES[period] || period);

                                return (
                                <tr key={period} className="hover:bg-gray-50/50">
                                    <td
                                        className={`p-1.5 text-xxs font-bold ${groupColors.text} text-center ${groupColors.light} sticky left-0 z-10`}
                                        style={{ width: '90px', minWidth: '90px' }}
                                    >
                                        {periodTimeDisplay}
                                    </td>
                                    {resources.map(resource => {
                                        const daysForResource = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);
                                        const periodIndex = currentPeriods.indexOf(period);

                                        const cells: React.ReactNode[] = [];
                                        let dayIndex = 0;

                                        while (dayIndex < daysForResource.length) {
                                            const day = daysForResource[dayIndex];
                                            const cellClasses = getClassesForCell(filteredClasses, day, period, resource, viewType);

                                            // 수직 병합 확인
                                            const shouldSkipThisCell = cellClasses.some((cls: TimetableClass) =>
                                                shouldSkipCell(cls, day, periodIndex, cellClasses, currentPeriods, filteredClasses, viewType)
                                            );

                                            if (shouldSkipThisCell) {
                                                dayIndex++;
                                                continue;
                                            }

                                            // 수직 병합 span 계산
                                            const maxRowSpan = Math.max(1, ...cellClasses.map((cls: TimetableClass) =>
                                                getConsecutiveSpan(cls, day, periodIndex, currentPeriods, filteredClasses, viewType)
                                            ));

                                            // 수평 병합 (수요일 테이블에서는 비활성화)
                                            let colSpan = 1;
                                            if (!isWednesdayTable && cellClasses.length === 1) {
                                                const cls = cellClasses[0];
                                                for (let nextIdx = dayIndex + 1; nextIdx < daysForResource.length; nextIdx++) {
                                                    const nextDay = daysForResource[nextIdx];
                                                    const nextDayClasses = getClassesForCell(filteredClasses, nextDay, period, resource, viewType);

                                                    if (nextDayClasses.length === 1 && nextDayClasses[0].className === cls.className) {
                                                        const nextRowSpan = getConsecutiveSpan(nextDayClasses[0], nextDay, periodIndex, currentPeriods, filteredClasses, viewType);
                                                        if (nextRowSpan === maxRowSpan) {
                                                            colSpan++;
                                                        } else {
                                                            break;
                                                        }
                                                    } else {
                                                        break;
                                                    }
                                                }
                                            }

                                            const baseWidthStyle = colSpan > 1 ? getColumnWidthStyle(colSpan) : getCellWidthStyle();
                                            const cellHeight = getRowHeight() * maxRowSpan;
                                            const cellStyle = { ...baseWidthStyle, height: `${cellHeight}px` };

                                            const isLastCell = dayIndex + colSpan >= daysForResource.length;
                                            // 강사별 구분만 굵은선, 나머지는 테두리 없음
                                            const borderRightStyle = isLastCell ? 'border-r-2 border-r-gray-400' : '';

                                            // 빈 셀 여부 확인 (수업이 없는 교시) - 진한 회색으로 표시
                                            const isEmpty = cellClasses.length === 0;
                                            const emptyCellBg = isEmpty ? 'bg-gray-300' : 'bg-white';

                                            cells.push(
                                                <td
                                                    key={`${resource}-${day}-${period}`}
                                                    className={`p-1 ${borderRightStyle} ${emptyCellBg}`}
                                                    style={cellStyle}
                                                    rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                    colSpan={colSpan > 1 ? colSpan : undefined}
                                                >
                                                    {isEmpty && showEmptyRooms ? (
                                                        <div className="text-xxs text-gray-400 text-center py-1">
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

                                            dayIndex += colSpan;
                                        }

                                        return cells;
                                    })}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // 날짜 기반 뷰: 요일별로 해당 요일에 수업이 있는 선생님 목록
    // 날짜 뷰에서는 기본 요일 순서(월화수목금토일)를 사용
    const dayBasedData = useMemo(() => {
        const data: { day: string; resources: string[] }[] = [];
        const naturalDayOrder = ALL_WEEKDAYS; // 월화수목금토일 순서

        // 선택된 요일 중 기본 순서로 정렬
        const selectedDaysInOrder = naturalDayOrder.filter(day => orderedSelectedDays.includes(day));

        selectedDaysInOrder.forEach(day => {
            const resourcesForDay = allResources.filter(resource =>
                filteredClasses.some(c =>
                    (viewType === 'teacher' ? c.teacher === resource : c.room === resource) &&
                    c.schedule?.some(s => s.includes(day))
                )
            );
            if (resourcesForDay.length > 0) {
                data.push({ day, resources: resourcesForDay });
            }
        });

        return data;
    }, [orderedSelectedDays, allResources, filteredClasses, viewType]);

    // 날짜 기반 뷰: 요일별 테이블 렌더링
    const renderDayBasedTable = (day: string, resources: string[]) => {
        if (resources.length === 0) return null;

        const isWeekend = day === '토' || day === '일';
        const isWednesday = day === '수';
        const dateInfo = weekDates[day];

        // 요일별 색상
        const getDayColors = () => {
            if (isWeekend) return { bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700' };
            if (isWednesday) return { bg: 'bg-green-500', light: 'bg-green-50', text: 'text-green-700' };
            if (day === '월') return { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700' };
            if (day === '화') return { bg: 'bg-pink-500', light: 'bg-pink-50', text: 'text-pink-700' };
            if (day === '목') return { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700' };
            if (day === '금') return { bg: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-700' };
            return { bg: 'bg-gray-500', light: 'bg-gray-50', text: 'text-gray-700' };
        };
        const dayColors = getDayColors();

        return (
            <div key={day} className="flex-shrink-0">
                <div className="relative">
                    <table className="border-collapse bg-gray-300" style={{ tableLayout: 'fixed' }}>
                        <thead className="sticky top-0 z-20">
                            {/* Day Header Row */}
                            <tr>
                                <th
                                    className={`${dayColors.bg} text-white px-3 py-2 font-bold text-sm text-left sticky left-0 z-30`}
                                    style={{ width: '90px', minWidth: '90px' }}
                                >
                                    {day}
                                    {dateInfo && <span className="ml-1 text-xs opacity-80">({dateInfo.formatted})</span>}
                                </th>
                                <th
                                    className={`${dayColors.bg} text-white px-3 py-2 font-bold text-sm`}
                                    colSpan={resources.length}
                                >
                                </th>
                            </tr>
                            {/* Teacher/Room Row */}
                            <tr>
                                <th
                                    className={`p-1.5 text-xxs font-bold ${dayColors.text} border-b border-gray-200 ${dayColors.light} sticky left-0 z-30`}
                                    style={{ width: '90px', minWidth: '90px' }}
                                >
                                    교시
                                </th>
                                {resources.map((resource, idx) => {
                                    const teacherData = teachers.find(t => t.name === resource);
                                    const bgColor = teacherData?.bgColor || '#3b82f6';
                                    const textColor = teacherData?.textColor || '#ffffff';
                                    const isLast = idx === resources.length - 1;
                                    // 강사별 구분만 굵은선
                                    const borderRightClass = isLast ? 'border-r-2 border-r-gray-400' : '';

                                    return (
                                        <th
                                            key={resource}
                                            className={`p-1.5 text-xs font-bold truncate ${borderRightClass}`}
                                            style={{
                                                ...getCellWidthStyle(),
                                                backgroundColor: bgColor,
                                                color: textColor
                                            }}
                                            title={resource}
                                        >
                                            {resource}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {currentPeriods.map(period => {
                                const periodIndex = currentPeriods.indexOf(period);
                                // 주말(토/일)은 WEEKEND_PERIOD_TIMES 사용
                                const periodTimeDisplay = isWeekend
                                    ? (WEEKEND_PERIOD_TIMES[period] || period)
                                    : (MATH_PERIOD_TIMES[period] || period);

                                return (
                                    <tr key={period} className="hover:bg-gray-50/50">
                                        <td
                                            className={`p-1.5 text-xxs font-bold ${dayColors.text} text-center ${dayColors.light} sticky left-0 z-10`}
                                            style={{ width: '90px', minWidth: '90px' }}
                                        >
                                            {periodTimeDisplay}
                                        </td>
                                        {resources.map((resource, idx) => {
                                            const cellClasses = getClassesForCell(filteredClasses, day, period, resource, viewType);
                                            const isLast = idx === resources.length - 1;

                                            // 수직 병합 확인
                                            const shouldSkipThisCell = cellClasses.some((cls: TimetableClass) =>
                                                shouldSkipCell(cls, day, periodIndex, cellClasses, currentPeriods, filteredClasses, viewType)
                                            );

                                            if (shouldSkipThisCell) {
                                                return null;
                                            }

                                            // 수직 병합 span 계산
                                            const maxRowSpan = Math.max(1, ...cellClasses.map((cls: TimetableClass) =>
                                                getConsecutiveSpan(cls, day, periodIndex, currentPeriods, filteredClasses, viewType)
                                            ));

                                            const cellHeight = getRowHeight() * maxRowSpan;
                                            const cellStyle = { ...getCellWidthStyle(), height: `${cellHeight}px` };
                                            // 강사별 구분만 굵은선, 나머지는 테두리 없음
                                            const borderRightStyle = isLast ? 'border-r-2 border-r-gray-400' : '';

                                            // 빈 셀 여부 확인 (수업이 없는 교시) - 진한 회색으로 표시
                                            const isEmpty = cellClasses.length === 0;
                                            const emptyCellBg = isEmpty ? 'bg-gray-300' : 'bg-white';

                                            return (
                                                <td
                                                    key={`${resource}-${period}`}
                                                    className={`p-1 ${borderRightStyle} ${emptyCellBg}`}
                                                    style={cellStyle}
                                                    rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                >
                                                    {isEmpty && showEmptyRooms ? (
                                                        <div className="text-xxs text-gray-400 text-center py-1">
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
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // 뷰 모드에 따라 다른 레이아웃 렌더링
    if (timetableViewMode === 'day-based') {
        return (
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                <div className="flex gap-4">
                    {dayBasedData.map(({ day, resources }) => renderDayBasedTable(day, resources))}
                </div>
            </div>
        );
    }

    // teacher-based 뷰 (기존)
    return (
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <div className="flex gap-4">
                {/* 월/목 테이블 */}
                {monThuActiveResources.length > 0 && renderTable(monThuActiveResources, monThuResourceDaysMap, '월/목')}

                {/* 화/금 테이블 */}
                {tueFriActiveResources.length > 0 && renderTable(tueFriActiveResources, tueFriResourceDaysMap, '화/금')}

                {/* 토/일 테이블 */}
                {weekendActiveResources.length > 0 && renderTable(weekendActiveResources, weekendResourceDaysMap, '토/일')}

                {/* 수요일 테이블 */}
                {hasWednesday && wednesdayResources.length > 0 && renderTable(wednesdayResources, wednesdayResourceDaysMap, '수요일', true)}
            </div>
        </div>
    );
};

export default TimetableGrid;
