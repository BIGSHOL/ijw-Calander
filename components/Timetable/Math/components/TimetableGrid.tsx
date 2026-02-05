import React, { useMemo } from 'react';
import { TimetableClass, Teacher, ClassKeywordColor } from '../../../../types';
import { getClassesForCell, getConsecutiveSpan, shouldSkipCell } from '../utils/gridUtils';
import ClassCard from './ClassCard';
import { WEEKEND_PERIOD_TIMES, ALL_WEEKDAYS, LEGACY_TO_UNIFIED_PERIOD_MAP, MATH_GROUP_DISPLAY, MATH_GROUP_PERIOD_IDS, MATH_GROUPED_PERIODS, MATH_PERIOD_TIMES } from '../../constants';
import { BookOpen } from 'lucide-react';

// hasClassOnDay replaced by resourceDayLookup (precomputed Map) inside component

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
    // 조회/수정 모드
    mode: 'view' | 'edit';
    // View Settings
    columnWidth: 'compact' | 'narrow' | 'normal' | 'wide' | 'x-wide';
    rowHeight: 'compact' | 'short' | 'normal' | 'tall' | 'very-tall';
    fontSize: 'small' | 'normal' | 'large';
    showClassName: boolean;
    showSchool: boolean;
    showGrade: boolean;
    showEmptyRooms: boolean;
    showStudents: boolean;
    showHoldStudents: boolean;
    showWithdrawnStudents: boolean;
    // DnD
    dragOverClassId: string | null;
    onClassClick: (cls: TimetableClass) => void;
    onDragStart: (e: React.DragEvent, studentId: string, fromClassId: string, fromZone?: string) => void;
    onDragOver: (e: React.DragEvent, classId: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, toClassId: string, toZone?: string) => void;

    currentSubjectFilter: string;
    studentMap: Record<string, any>;
    // Timetable View Mode
    timetableViewMode: 'day-based' | 'teacher-based';
    // Keyword Colors
    classKeywords?: ClassKeywordColor[];
    // Student Click
    onStudentClick?: (studentId: string) => void;
    // Pending Moved Students (드래그 이동 대기 중)
    pendingMovedStudentIds?: Set<string>;
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
    mode,
    columnWidth,
    rowHeight,
    fontSize,
    showClassName,
    showSchool,
    showGrade,
    showEmptyRooms,
    showStudents,
    showHoldStudents,
    showWithdrawnStudents,
    dragOverClassId,
    onClassClick,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,

    currentSubjectFilter,
    studentMap,
    timetableViewMode,
    classKeywords = [],
    onStudentClick,
    pendingMovedStudentIds
}) => {
    // 수정 모드일 때만 실제 canEdit 적용
    const effectiveCanEdit = canEdit && mode === 'edit';
    // 표시 옵션에 따른 너비 보정 계수
    // 학교/학년을 숨기면 학생명만 표시되므로 셀 폭을 줄임
    const widthFactor = useMemo(() => {
        if (!showStudents) return 0.4; // 학생 목록 숨김 → 수업명만
        if (!showSchool && !showGrade) return 0.4; // 이름만
        if (!showSchool || !showGrade) return 0.45; // 하나만 표시
        return 1; // 전부 표시
    }, [showStudents, showSchool, showGrade]);

    // Pre-computed lookup: resource → Set<days> (O(1) 조회로 hasClassOnDay 대체)
    const resourceDayLookup = useMemo(() => {
        const lookup = new Map<string, Set<string>>();
        const addEntry = (resource: string | undefined, day: string) => {
            const trimmed = resource?.trim();
            if (!trimmed) return;
            if (!lookup.has(trimmed)) lookup.set(trimmed, new Set());
            lookup.get(trimmed)!.add(day);
        };
        filteredClasses.forEach(cls => {
            cls.schedule?.forEach(slot => {
                const parts = slot.trim().split(/\s+/);
                if (parts.length < 2) return;
                const day = parts[0];
                const periodPart = parts[1];
                const normalizedPeriod = LEGACY_TO_UNIFIED_PERIOD_MAP[periodPart] || periodPart;
                const slotKey = `${day}-${normalizedPeriod}`;
                if (viewType === 'teacher') {
                    addEntry(cls.slotTeachers?.[slotKey] || cls.teacher, day);
                } else {
                    addEntry(cls.slotRooms?.[slotKey] || cls.room, day);
                }
            });
        });
        return lookup;
    }, [filteredClasses, viewType]);

    // Memoized style calculations (매 렌더마다 새 객체 생성 방지)
    const perDayWidth = useMemo(() => {
        const base = columnWidth === 'compact' ? 35 :
            columnWidth === 'narrow' ? 50 :
                columnWidth === 'wide' ? 90 :
                    columnWidth === 'x-wide' ? 125 : 70;
        return Math.round(base * widthFactor);
    }, [columnWidth, widthFactor]);

    const mergedCellWidthCache = useMemo(() => {
        const cache: Record<number, { width: string; minWidth: string }> = {};
        for (let i = 1; i <= 7; i++) {
            cache[i] = { width: `${i * perDayWidth}px`, minWidth: `${i * perDayWidth}px` };
        }
        return cache;
    }, [perDayWidth]);

    const getMergedCellWidthStyle = (colspan: number) => {
        return mergedCellWidthCache[colspan] || { width: `${colspan * perDayWidth}px`, minWidth: `${colspan * perDayWidth}px` };
    };

    const singleCellWidthStyle = useMemo(() => {
        const base = columnWidth === 'compact' ? 70 :
            columnWidth === 'narrow' ? 90 :
                columnWidth === 'wide' ? 150 :
                    columnWidth === 'x-wide' ? 200 : 110;
        const baseWidth = Math.round(base * widthFactor);
        return { width: `${baseWidth}px`, minWidth: `${baseWidth}px` };
    }, [columnWidth, widthFactor]);

    // 교시당 높이 (memoized)
    const rowHeightValue = useMemo((): number | 'auto' => {
        if (!showStudents) return 'auto';
        if (rowHeight === 'compact') return 'auto';
        if (rowHeight === 'short') return 100;
        if (rowHeight === 'tall') return 320;
        if (rowHeight === 'very-tall') return 450;
        return 180;
    }, [showStudents, rowHeight]);

    const isCompactMode = rowHeight === 'compact' || !showStudents;

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

    // 월/목 그룹: 각 선생님이 어떤 요일에 수업이 있는지 계산 (slotTeachers 포함)
    const monThuResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();

        allResources.forEach(resource => {
            const daysForResource = monThuDays.filter(day =>
                resourceDayLookup.get(resource?.trim())?.has(day) ?? false
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });

        return map;
    }, [allResources, monThuDays, resourceDayLookup]);

    // 화/금 그룹: 각 선생님이 어떤 요일에 수업이 있는지 계산 (slotTeachers 포함)
    const tueFriResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();

        allResources.forEach(resource => {
            const daysForResource = tueFriDays.filter(day =>
                resourceDayLookup.get(resource?.trim())?.has(day) ?? false
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });

        return map;
    }, [allResources, tueFriDays, resourceDayLookup]);

    // 토/일 그룹: 각 선생님이 어떤 요일에 수업이 있는지 계산 (slotTeachers 포함)
    const weekendResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();

        allResources.forEach(resource => {
            const daysForResource = weekendDays.filter(day =>
                resourceDayLookup.get(resource?.trim())?.has(day) ?? false
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });

        return map;
    }, [allResources, weekendDays, resourceDayLookup]);

    // 수요일 수업이 있는 선생님 (수요일 전용, slotTeachers 포함)
    const wednesdayResources = useMemo(() => {
        if (!hasWednesday) return [];
        return allResources.filter(resource =>
            resourceDayLookup.get(resource?.trim())?.has('수') ?? false
        );
    }, [allResources, resourceDayLookup, hasWednesday]);

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
                <div className="relative">
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
                                    className={`p-1.5 text-xxs font-bold ${groupColors.text} border-b border-gray-200 border-r-2 border-r-gray-400 sticky left-0 z-30`}
                                    rowSpan={2}
                                    style={{
                                        width: '90px',
                                        minWidth: '90px',
                                        backgroundColor: groupColors.light === 'bg-blue-50' ? '#eff6ff' :
                                            groupColors.light === 'bg-amber-50' ? '#fffbeb' :
                                                groupColors.light === 'bg-orange-50' ? '#fff7ed' :
                                                    groupColors.light === 'bg-green-50' ? '#f0fdf4' : '#f3f4f6'
                                    }}
                                >
                                    교시
                                </th>
                                {resources.map(resource => {
                                    const daysForResource = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);
                                    const colspan = daysForResource.length;
                                    const teacherData = teachers.find(t => t.name === resource);
                                    const bgColor = teacherData?.bgColor || '#3b82f6';
                                    const textColor = teacherData?.textColor || '#ffffff';

                                    // 병합 요일(colspan > 1)이면 병합 너비, 아니면 단일 너비
                                    const headerWidthStyle = colspan > 1
                                        ? getMergedCellWidthStyle(colspan)
                                        : singleCellWidthStyle;

                                    return (
                                        <th
                                            key={resource}
                                            colSpan={colspan}
                                            className="p-1.5 text-xs font-bold border-b border-r-2 border-r-gray-300 truncate"
                                            style={{
                                                ...headerWidthStyle,
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
                                        // 병합 요일(월/목 등)은 좁게, 단독 요일(수)은 넓게
                                        const isMergedDay = daysForResource.length > 1;
                                        const dayHeaderWidth = isMergedDay
                                            ? getMergedCellWidthStyle(1)  // 병합 셀의 1요일 너비
                                            : singleCellWidthStyle;  // 단독 셀 너비

                                        return (
                                            <th
                                                key={`${resource}-${day}`}
                                                className={`p-1.5 text-xxs font-bold text-center ${borderRightClass} ${isWeekend ? 'bg-orange-50 text-orange-700' : day === '수' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                                                style={dayHeaderWidth}
                                            >
                                                <div>{day}</div>
                                                {dateInfo && <div className="text-xxs opacity-70">{dateInfo.formatted}</div>}
                                            </th>
                                        );
                                    });
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                // 주말 테이블은 그룹화하지 않고 시간만 표시
                                const isWeekendTable = title === '토/일';

                                // 평일: 교시 그룹화 (1-1+1-2 → 1교시, ...)
                                // 단, 같은 수업이 두 교시 모두에 있을 때만 병합
                                // 주말: 개별 교시 but 시간만 표시
                                if (!isWeekendTable) {
                                    // 배경색 hex 매핑
                                    const bgColorMap: Record<string, string> = {
                                        'bg-blue-50': '#eff6ff',
                                        'bg-amber-50': '#fffbeb',
                                        'bg-orange-50': '#fff7ed',
                                        'bg-green-50': '#f0fdf4'
                                    };
                                    const bgHex = bgColorMap[groupColors.light] || '#f3f4f6';

                                    // 각 교시별로 수업이 있는지 확인하고, 그룹화 가능 여부 판단
                                    // 그룹화 조건: 같은 수업이 1-1과 1-2 모두에 있어야 함
                                    const rows: React.ReactNode[] = [];
                                    const processedPeriods = new Set<string>();

                                    MATH_GROUPED_PERIODS.forEach(groupId => {
                                        const periodIds = MATH_GROUP_PERIOD_IDS[groupId];
                                        const [firstPeriod, secondPeriod] = periodIds;

                                        // 두 교시가 모두 currentPeriods에 있는지 확인
                                        const hasFirst = currentPeriods.includes(firstPeriod);
                                        const hasSecond = currentPeriods.includes(secondPeriod);

                                        if (!hasFirst && !hasSecond) return;

                                        const groupInfo = MATH_GROUP_DISPLAY[groupId];

                                        // 두 교시 모두 있으면 헤더만 병합 (rowSpan=2), 셀은 각각 표시
                                        if (hasFirst && hasSecond) {
                                            processedPeriods.add(firstPeriod);
                                            processedPeriods.add(secondPeriod);

                                            // 첫 번째 행: 교시 헤더(rowSpan=2) + 첫 번째 교시 셀들
                                            rows.push(
                                                <tr key={`group-${groupId}-first`}>
                                                    <td
                                                        rowSpan={2}
                                                        className={`p-1.5 text-xxs font-bold ${groupColors.text} text-center sticky left-0 z-10 border-b-2 border-b-gray-400 border-r-2 border-r-gray-400`}
                                                        style={{
                                                            width: '90px',
                                                            minWidth: '90px',
                                                            backgroundColor: bgHex
                                                        }}
                                                    >
                                                        <div className="font-bold text-xxs text-gray-500">{groupInfo.label}</div>
                                                        <div>{groupInfo.time}</div>
                                                    </td>
                                                    {resources.map(resource => {
                                                        const daysForResource = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);
                                                        const periodIndex = currentPeriods.indexOf(firstPeriod);

                                                        const cells: React.ReactNode[] = [];
                                                        let dayIndex = 0;

                                                        while (dayIndex < daysForResource.length) {
                                                            const day = daysForResource[dayIndex];
                                                            const cellClasses = getClassesForCell(filteredClasses, day, firstPeriod, resource, viewType);

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

                                                            // 수평 병합 확인
                                                            let shouldSkipHorizontalMerge = false;
                                                            if (!isWednesdayTable && cellClasses.length === 1 && dayIndex > 0) {
                                                                const cls = cellClasses[0];
                                                                for (let prevIdx = dayIndex - 1; prevIdx >= 0; prevIdx--) {
                                                                    const prevDay = daysForResource[prevIdx];
                                                                    const prevDayClasses = getClassesForCell(filteredClasses, prevDay, firstPeriod, resource, viewType);

                                                                    if (prevDayClasses.length === 1 && prevDayClasses[0].className === cls.className) {
                                                                        shouldSkipHorizontalMerge = true;
                                                                        break;
                                                                    } else {
                                                                        break;
                                                                    }
                                                                }
                                                            }

                                                            if (shouldSkipHorizontalMerge) {
                                                                dayIndex++;
                                                                continue;
                                                            }

                                                            // 수평 병합 span 계산
                                                            let colSpan = 1;
                                                            const mergedDaysForCell: string[] = [day];
                                                            if (!isWednesdayTable && cellClasses.length === 1) {
                                                                const cls = cellClasses[0];
                                                                for (let nextIdx = dayIndex + 1; nextIdx < daysForResource.length; nextIdx++) {
                                                                    const nextDay = daysForResource[nextIdx];
                                                                    const nextDayClasses = getClassesForCell(filteredClasses, nextDay, firstPeriod, resource, viewType);

                                                                    if (nextDayClasses.length === 1 && nextDayClasses[0].className === cls.className) {
                                                                        const nextRowSpan = getConsecutiveSpan(nextDayClasses[0], nextDay, periodIndex, currentPeriods, filteredClasses, viewType);
                                                                        if (nextRowSpan === maxRowSpan) {
                                                                            colSpan++;
                                                                            mergedDaysForCell.push(nextDay);
                                                                        } else {
                                                                            break;
                                                                        }
                                                                    } else {
                                                                        break;
                                                                    }
                                                                }
                                                            }

                                                            const baseWidthStyle = colSpan > 1
                                                                ? getMergedCellWidthStyle(colSpan)
                                                                : singleCellWidthStyle;
                                                            const heightValue = rowHeightValue;
                                                            const compactRowHeight = 45;
                                                            const hasClass = cellClasses.length > 0;
                                                            const cellStyle = isCompactMode
                                                                ? { ...baseWidthStyle, height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                                : { ...baseWidthStyle, height: `${(heightValue as number) * maxRowSpan}px` };

                                                            const isEmpty = cellClasses.length === 0;
                                                            const isLastDayForResource = (dayIndex + colSpan - 1) === daysForResource.length - 1;
                                                            const borderRightClass = isLastDayForResource ? 'border-r-2 border-r-gray-400' : '';

                                                            cells.push(
                                                                <td
                                                                    key={`${resource}-${day}-${firstPeriod}`}
                                                                    className={`p-0 border-b-2 border-b-gray-400 ${borderRightClass} ${isEmpty ? 'bg-gray-200' : ''}`}
                                                                    style={cellStyle}
                                                                    rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                                    colSpan={colSpan > 1 ? colSpan : undefined}
                                                                >
                                                                    {isEmpty && showEmptyRooms ? (
                                                                        <div className="text-xxs text-gray-500 text-center py-1">
                                                                            {viewType === 'room' ? resource : '빈 강의실'}
                                                                        </div>
                                                                    ) : (
                                                                        cellClasses.length > 1 ? (
                                                                            <ClassCard
                                                                                key={cellClasses[0].id}
                                                                                cls={cellClasses[0]}
                                                                                span={getConsecutiveSpan(cellClasses[0], day, periodIndex, currentPeriods, filteredClasses, viewType)}
                                                                                searchQuery={searchQuery}
                                                                                showStudents={showStudents}
                                                                                showClassName={showClassName}
                                                                                showSchool={showSchool}
                                                                                showGrade={showGrade}
                                                                                canEdit={effectiveCanEdit}
                                                                                isDragOver={cellClasses.some(c => dragOverClassId === c.id)}
                                                                                onClick={onClassClick}
                                                                                onDragStart={onDragStart}
                                                                                onDragOver={onDragOver}
                                                                                onDragLeave={onDragLeave}
                                                                                onDrop={onDrop}
                                                                                studentMap={studentMap}
                                                                                classKeywords={classKeywords}
                                                                                onStudentClick={onStudentClick}
                                                                                currentDay={colSpan === 1 ? day : undefined}
                                                                                mergedDays={colSpan > 1 ? mergedDaysForCell : undefined}
                                                                                fontSize={fontSize}
                                                                                rowHeight={rowHeight}
                                                                                showHoldStudents={showHoldStudents}
                                                                                showWithdrawnStudents={showWithdrawnStudents}
                                                                                pendingMovedStudentIds={pendingMovedStudentIds}
                                                                                mergedClasses={cellClasses}
                                                                            />
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
                                                                                    canEdit={effectiveCanEdit}
                                                                                    isDragOver={dragOverClassId === cls.id}
                                                                                    onClick={onClassClick}
                                                                                    onDragStart={onDragStart}
                                                                                    onDragOver={onDragOver}
                                                                                    onDragLeave={onDragLeave}
                                                                                    onDrop={onDrop}
                                                                                    studentMap={studentMap}
                                                                                    classKeywords={classKeywords}
                                                                                    onStudentClick={onStudentClick}
                                                                                    currentDay={colSpan === 1 ? day : undefined}
                                                                                    mergedDays={colSpan > 1 ? mergedDaysForCell : undefined}
                                                                                    fontSize={fontSize}
                                                                                    rowHeight={rowHeight}
                                                                                    showHoldStudents={showHoldStudents}
                                                                                    showWithdrawnStudents={showWithdrawnStudents}
                                                                                    pendingMovedStudentIds={pendingMovedStudentIds}
                                                                                />
                                                                            ))
                                                                        )
                                                                    )}
                                                                </td>
                                                            );

                                                            dayIndex += colSpan;
                                                        }

                                                        return cells;
                                                    })}
                                                </tr>
                                            );

                                            // 두 번째 행: 교시 헤더 없음 (rowSpan으로 병합됨) + 두 번째 교시 셀들
                                            rows.push(
                                                <tr key={`group-${groupId}-second`}>
                                                    {resources.map(resource => {
                                                        const daysForResource = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);
                                                        const periodIndex = currentPeriods.indexOf(secondPeriod);

                                                        const cells: React.ReactNode[] = [];
                                                        let dayIndex = 0;

                                                        while (dayIndex < daysForResource.length) {
                                                            const day = daysForResource[dayIndex];
                                                            const cellClasses = getClassesForCell(filteredClasses, day, secondPeriod, resource, viewType);

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

                                                            // 수평 병합 확인
                                                            let shouldSkipHorizontalMerge = false;
                                                            if (!isWednesdayTable && cellClasses.length === 1 && dayIndex > 0) {
                                                                const cls = cellClasses[0];
                                                                for (let prevIdx = dayIndex - 1; prevIdx >= 0; prevIdx--) {
                                                                    const prevDay = daysForResource[prevIdx];
                                                                    const prevDayClasses = getClassesForCell(filteredClasses, prevDay, secondPeriod, resource, viewType);

                                                                    if (prevDayClasses.length === 1 && prevDayClasses[0].className === cls.className) {
                                                                        shouldSkipHorizontalMerge = true;
                                                                        break;
                                                                    } else {
                                                                        break;
                                                                    }
                                                                }
                                                            }

                                                            if (shouldSkipHorizontalMerge) {
                                                                dayIndex++;
                                                                continue;
                                                            }

                                                            // 수평 병합 span 계산
                                                            let colSpan = 1;
                                                            const mergedDaysForCell: string[] = [day];
                                                            if (!isWednesdayTable && cellClasses.length === 1) {
                                                                const cls = cellClasses[0];
                                                                for (let nextIdx = dayIndex + 1; nextIdx < daysForResource.length; nextIdx++) {
                                                                    const nextDay = daysForResource[nextIdx];
                                                                    const nextDayClasses = getClassesForCell(filteredClasses, nextDay, secondPeriod, resource, viewType);

                                                                    if (nextDayClasses.length === 1 && nextDayClasses[0].className === cls.className) {
                                                                        const nextRowSpan = getConsecutiveSpan(nextDayClasses[0], nextDay, periodIndex, currentPeriods, filteredClasses, viewType);
                                                                        if (nextRowSpan === maxRowSpan) {
                                                                            colSpan++;
                                                                            mergedDaysForCell.push(nextDay);
                                                                        } else {
                                                                            break;
                                                                        }
                                                                    } else {
                                                                        break;
                                                                    }
                                                                }
                                                            }

                                                            const baseWidthStyle = colSpan > 1
                                                                ? getMergedCellWidthStyle(colSpan)
                                                                : singleCellWidthStyle;
                                                            const heightValue = rowHeightValue;
                                                            const compactRowHeight = 45;
                                                            const hasClass = cellClasses.length > 0;
                                                            const cellStyle = isCompactMode
                                                                ? { ...baseWidthStyle, height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                                : { ...baseWidthStyle, height: `${(heightValue as number) * maxRowSpan}px` };

                                                            const isEmpty = cellClasses.length === 0;
                                                            const isLastDayForResource = (dayIndex + colSpan - 1) === daysForResource.length - 1;
                                                            const borderRightClass = isLastDayForResource ? 'border-r-2 border-r-gray-400' : '';

                                                            cells.push(
                                                                <td
                                                                    key={`${resource}-${day}-${secondPeriod}`}
                                                                    className={`p-0 border-b-2 border-b-gray-400 ${borderRightClass} ${isEmpty ? 'bg-gray-200' : ''}`}
                                                                    style={cellStyle}
                                                                    rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                                    colSpan={colSpan > 1 ? colSpan : undefined}
                                                                >
                                                                    {isEmpty && showEmptyRooms ? (
                                                                        <div className="text-xxs text-gray-500 text-center py-1">
                                                                            {viewType === 'room' ? resource : '빈 강의실'}
                                                                        </div>
                                                                    ) : (
                                                                        cellClasses.length > 1 ? (
                                                                            <ClassCard
                                                                                key={cellClasses[0].id}
                                                                                cls={cellClasses[0]}
                                                                                span={getConsecutiveSpan(cellClasses[0], day, periodIndex, currentPeriods, filteredClasses, viewType)}
                                                                                searchQuery={searchQuery}
                                                                                showStudents={showStudents}
                                                                                showClassName={showClassName}
                                                                                showSchool={showSchool}
                                                                                showGrade={showGrade}
                                                                                canEdit={effectiveCanEdit}
                                                                                isDragOver={cellClasses.some(c => dragOverClassId === c.id)}
                                                                                onClick={onClassClick}
                                                                                onDragStart={onDragStart}
                                                                                onDragOver={onDragOver}
                                                                                onDragLeave={onDragLeave}
                                                                                onDrop={onDrop}
                                                                                studentMap={studentMap}
                                                                                classKeywords={classKeywords}
                                                                                onStudentClick={onStudentClick}
                                                                                currentDay={colSpan === 1 ? day : undefined}
                                                                                mergedDays={colSpan > 1 ? mergedDaysForCell : undefined}
                                                                                fontSize={fontSize}
                                                                                rowHeight={rowHeight}
                                                                                showHoldStudents={showHoldStudents}
                                                                                showWithdrawnStudents={showWithdrawnStudents}
                                                                                pendingMovedStudentIds={pendingMovedStudentIds}
                                                                                mergedClasses={cellClasses}
                                                                            />
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
                                                                                    canEdit={effectiveCanEdit}
                                                                                    isDragOver={dragOverClassId === cls.id}
                                                                                    onClick={onClassClick}
                                                                                    onDragStart={onDragStart}
                                                                                    onDragOver={onDragOver}
                                                                                    onDragLeave={onDragLeave}
                                                                                    onDrop={onDrop}
                                                                                    studentMap={studentMap}
                                                                                    classKeywords={classKeywords}
                                                                                    onStudentClick={onStudentClick}
                                                                                    currentDay={colSpan === 1 ? day : undefined}
                                                                                    mergedDays={colSpan > 1 ? mergedDaysForCell : undefined}
                                                                                    fontSize={fontSize}
                                                                                    rowHeight={rowHeight}
                                                                                    showHoldStudents={showHoldStudents}
                                                                                    showWithdrawnStudents={showWithdrawnStudents}
                                                                                    pendingMovedStudentIds={pendingMovedStudentIds}
                                                                                />
                                                                            ))
                                                                        )
                                                                    )}
                                                                </td>
                                                            );

                                                            dayIndex += colSpan;
                                                        }

                                                        return cells;
                                                    })}
                                                </tr>
                                            );
                                        } else {
                                            // 하나의 교시만 있으면 개별 표시
                                            periodIds.forEach(period => {
                                                if (!currentPeriods.includes(period) || processedPeriods.has(period)) return;
                                                processedPeriods.add(period);

                                                const periodTime = MATH_PERIOD_TIMES[period] || period;

                                                rows.push(
                                                    <tr key={`period-${period}`}>
                                                        <td
                                                            className={`p-1.5 text-xxs font-bold ${groupColors.text} text-center sticky left-0 z-10 border-b-2 border-b-gray-400 border-r-2 border-r-gray-400`}
                                                            style={{
                                                                width: '90px',
                                                                minWidth: '90px',
                                                                backgroundColor: bgHex
                                                            }}
                                                        >
                                                            <div className="font-bold text-xxs text-gray-500">{period}</div>
                                                            <div>{periodTime}</div>
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

                                                                // 수평 병합 확인
                                                                let shouldSkipHorizontalMerge = false;
                                                                if (!isWednesdayTable && cellClasses.length === 1 && dayIndex > 0) {
                                                                    const cls = cellClasses[0];
                                                                    for (let prevIdx = dayIndex - 1; prevIdx >= 0; prevIdx--) {
                                                                        const prevDay = daysForResource[prevIdx];
                                                                        const prevDayClasses = getClassesForCell(filteredClasses, prevDay, period, resource, viewType);

                                                                        if (prevDayClasses.length === 1 && prevDayClasses[0].className === cls.className) {
                                                                            shouldSkipHorizontalMerge = true;
                                                                            break;
                                                                        } else {
                                                                            break;
                                                                        }
                                                                    }
                                                                }

                                                                if (shouldSkipHorizontalMerge) {
                                                                    dayIndex++;
                                                                    continue;
                                                                }

                                                                // 수평 병합 span 계산
                                                                let colSpan = 1;
                                                                const mergedDaysForCell: string[] = [day];
                                                                if (!isWednesdayTable && cellClasses.length === 1) {
                                                                    const cls = cellClasses[0];
                                                                    for (let nextIdx = dayIndex + 1; nextIdx < daysForResource.length; nextIdx++) {
                                                                        const nextDay = daysForResource[nextIdx];
                                                                        const nextDayClasses = getClassesForCell(filteredClasses, nextDay, period, resource, viewType);

                                                                        if (nextDayClasses.length === 1 && nextDayClasses[0].className === cls.className) {
                                                                            const nextRowSpan = getConsecutiveSpan(nextDayClasses[0], nextDay, periodIndex, currentPeriods, filteredClasses, viewType);
                                                                            if (nextRowSpan === maxRowSpan) {
                                                                                colSpan++;
                                                                                mergedDaysForCell.push(nextDay);
                                                                            } else {
                                                                                break;
                                                                            }
                                                                        } else {
                                                                            break;
                                                                        }
                                                                    }
                                                                }

                                                                const baseWidthStyle = colSpan > 1
                                                                    ? getMergedCellWidthStyle(colSpan)
                                                                    : singleCellWidthStyle;
                                                                const heightValue = rowHeightValue;
                                                                const compactRowHeight = 45;
                                                                const hasClass = cellClasses.length > 0;
                                                                const cellStyle = isCompactMode
                                                                    ? { ...baseWidthStyle, height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                                    : { ...baseWidthStyle, height: `${(heightValue as number) * maxRowSpan}px` };

                                                                const isEmpty = cellClasses.length === 0;
                                                                const isLastDayForResource = (dayIndex + colSpan - 1) === daysForResource.length - 1;
                                                                const borderRightClass = isLastDayForResource ? 'border-r-2 border-r-gray-400' : '';

                                                                cells.push(
                                                                    <td
                                                                        key={`${resource}-${day}-${period}`}
                                                                        className={`p-0 border-b-2 border-b-gray-400 ${borderRightClass} ${isEmpty ? 'bg-gray-200' : ''}`}
                                                                        style={cellStyle}
                                                                        rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                                        colSpan={colSpan > 1 ? colSpan : undefined}
                                                                    >
                                                                        {isEmpty && showEmptyRooms ? (
                                                                            <div className="text-xxs text-gray-500 text-center py-1">
                                                                                {viewType === 'room' ? resource : '빈 강의실'}
                                                                            </div>
                                                                        ) : (
                                                                            cellClasses.length > 1 ? (
                                                                                <ClassCard
                                                                                    key={cellClasses[0].id}
                                                                                    cls={cellClasses[0]}
                                                                                    span={getConsecutiveSpan(cellClasses[0], day, periodIndex, currentPeriods, filteredClasses, viewType)}
                                                                                    searchQuery={searchQuery}
                                                                                    showStudents={showStudents}
                                                                                    showClassName={showClassName}
                                                                                    showSchool={showSchool}
                                                                                    showGrade={showGrade}
                                                                                    canEdit={effectiveCanEdit}
                                                                                    isDragOver={cellClasses.some(c => dragOverClassId === c.id)}
                                                                                    onClick={onClassClick}
                                                                                    onDragStart={onDragStart}
                                                                                    onDragOver={onDragOver}
                                                                                    onDragLeave={onDragLeave}
                                                                                    onDrop={onDrop}
                                                                                    studentMap={studentMap}
                                                                                    classKeywords={classKeywords}
                                                                                    onStudentClick={onStudentClick}
                                                                                    currentDay={colSpan === 1 ? day : undefined}
                                                                                    mergedDays={colSpan > 1 ? mergedDaysForCell : undefined}
                                                                                    fontSize={fontSize}
                                                                                    rowHeight={rowHeight}
                                                                                    showHoldStudents={showHoldStudents}
                                                                                    showWithdrawnStudents={showWithdrawnStudents}
                                                                                    pendingMovedStudentIds={pendingMovedStudentIds}
                                                                                    mergedClasses={cellClasses}
                                                                                />
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
                                                                                        canEdit={effectiveCanEdit}
                                                                                        isDragOver={dragOverClassId === cls.id}
                                                                                        onClick={onClassClick}
                                                                                        onDragStart={onDragStart}
                                                                                        onDragOver={onDragOver}
                                                                                        onDragLeave={onDragLeave}
                                                                                        onDrop={onDrop}
                                                                                        studentMap={studentMap}
                                                                                        classKeywords={classKeywords}
                                                                                        onStudentClick={onStudentClick}
                                                                                        currentDay={colSpan === 1 ? day : undefined}
                                                                                        mergedDays={colSpan > 1 ? mergedDaysForCell : undefined}
                                                                                        fontSize={fontSize}
                                                                                        rowHeight={rowHeight}
                                                                                        showHoldStudents={showHoldStudents}
                                                                                        showWithdrawnStudents={showWithdrawnStudents}
                                                                                        pendingMovedStudentIds={pendingMovedStudentIds}
                                                                                    />
                                                                                ))
                                                                            )
                                                                        )}
                                                                    </td>
                                                                );

                                                                dayIndex += colSpan;
                                                            }

                                                            return cells;
                                                        })}
                                                    </tr>
                                                );
                                            });
                                        }
                                    });

                                    return rows;
                                } else {
                                    // 주말: 시간만 표시 (교시 라벨 제거)
                                    return currentPeriods.map(period => {
                                        const periodTimeDisplay = WEEKEND_PERIOD_TIMES[period] || period;

                                        const bgColorMap: Record<string, string> = {
                                            'bg-blue-50': '#eff6ff',
                                            'bg-amber-50': '#fffbeb',
                                            'bg-orange-50': '#fff7ed',
                                            'bg-green-50': '#f0fdf4'
                                        };
                                        const bgHex = bgColorMap[groupColors.light] || '#f3f4f6';

                                        return (
                                            <tr key={period}>
                                                <td
                                                    className={`p-1.5 text-xxs font-bold ${groupColors.text} text-center sticky left-0 z-10 border-b-2 border-b-gray-400 border-r-2 border-r-gray-400`}
                                                    style={{
                                                        width: '90px',
                                                        minWidth: '90px',
                                                        backgroundColor: bgHex
                                                    }}
                                                >
                                                    <div>{periodTimeDisplay}</div>
                                                </td>
                                                {resources.map(resource => {
                                                    const daysForResource = daysMap.get(resource) || [];
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

                                                        // 수평 병합 계산
                                                        let colSpan = 1;
                                                        const mergedDaysForCell: string[] = [day];
                                                        if (cellClasses.length === 1) {
                                                            const cls = cellClasses[0];
                                                            for (let nextIdx = dayIndex + 1; nextIdx < daysForResource.length; nextIdx++) {
                                                                const nextDay = daysForResource[nextIdx];
                                                                const nextDayClasses = getClassesForCell(filteredClasses, nextDay, period, resource, viewType);

                                                                if (nextDayClasses.length === 1 && nextDayClasses[0].className === cls.className) {
                                                                    const nextRowSpan = getConsecutiveSpan(nextDayClasses[0], nextDay, periodIndex, currentPeriods, filteredClasses, viewType);
                                                                    if (nextRowSpan === maxRowSpan) {
                                                                        colSpan++;
                                                                        mergedDaysForCell.push(nextDay);
                                                                    } else {
                                                                        break;
                                                                    }
                                                                } else {
                                                                    break;
                                                                }
                                                            }
                                                        }

                                                        const baseWidthStyle = colSpan > 1
                                                            ? getMergedCellWidthStyle(colSpan)
                                                            : singleCellWidthStyle;
                                                        const heightValue = rowHeightValue;
                                                        const compactRowHeight = 45;
                                                        const hasClass = cellClasses.length > 0;
                                                        const cellStyle = isCompactMode
                                                            ? { ...baseWidthStyle, height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                            : { ...baseWidthStyle, height: `${(heightValue as number) * maxRowSpan}px` };

                                                        const isEmpty = cellClasses.length === 0;
                                                        const isLastDayForResource = (dayIndex + colSpan - 1) === daysForResource.length - 1;
                                                        const borderRightClass = isLastDayForResource ? 'border-r-2 border-r-gray-400' : '';

                                                        cells.push(
                                                            <td
                                                                key={`${resource}-${day}-${period}`}
                                                                className={`p-0 border-b-2 border-b-gray-400 ${borderRightClass} ${isEmpty ? 'bg-gray-200' : ''}`}
                                                                style={cellStyle}
                                                                rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                                colSpan={colSpan > 1 ? colSpan : undefined}
                                                            >
                                                                {isEmpty && showEmptyRooms ? (
                                                                    <div className="text-xxs text-gray-500 text-center py-1">
                                                                        {viewType === 'room' ? resource : '빈 강의실'}
                                                                    </div>
                                                                ) : (
                                                                    cellClasses.length > 1 ? (
                                                                        <ClassCard
                                                                            key={cellClasses[0].id}
                                                                            cls={cellClasses[0]}
                                                                            span={getConsecutiveSpan(cellClasses[0], day, periodIndex, currentPeriods, filteredClasses, viewType)}
                                                                            searchQuery={searchQuery}
                                                                            showStudents={showStudents}
                                                                            showClassName={showClassName}
                                                                            showSchool={showSchool}
                                                                            showGrade={showGrade}
                                                                            canEdit={effectiveCanEdit}
                                                                            isDragOver={cellClasses.some(c => dragOverClassId === c.id)}
                                                                            onClick={onClassClick}
                                                                            onDragStart={onDragStart}
                                                                            onDragOver={onDragOver}
                                                                            onDragLeave={onDragLeave}
                                                                            onDrop={onDrop}
                                                                            studentMap={studentMap}
                                                                            classKeywords={classKeywords}
                                                                            onStudentClick={onStudentClick}
                                                                            currentDay={colSpan === 1 ? day : undefined}
                                                                            mergedDays={colSpan > 1 ? mergedDaysForCell : undefined}
                                                                            fontSize={fontSize}
                                                                            rowHeight={rowHeight}
                                                                            showHoldStudents={showHoldStudents}
                                                                            showWithdrawnStudents={showWithdrawnStudents}
                                                                            pendingMovedStudentIds={pendingMovedStudentIds}
                                                                            mergedClasses={cellClasses}
                                                                        />
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
                                                                                canEdit={effectiveCanEdit}
                                                                                isDragOver={dragOverClassId === cls.id}
                                                                                onClick={onClassClick}
                                                                                onDragStart={onDragStart}
                                                                                onDragOver={onDragOver}
                                                                                onDragLeave={onDragLeave}
                                                                                onDrop={onDrop}
                                                                                studentMap={studentMap}
                                                                                classKeywords={classKeywords}
                                                                                onStudentClick={onStudentClick}
                                                                                currentDay={colSpan === 1 ? day : undefined}
                                                                                mergedDays={colSpan > 1 ? mergedDaysForCell : undefined}
                                                                                fontSize={fontSize}
                                                                                rowHeight={rowHeight}
                                                                                showHoldStudents={showHoldStudents}
                                                                                showWithdrawnStudents={showWithdrawnStudents}
                                                                                pendingMovedStudentIds={pendingMovedStudentIds}
                                                                            />
                                                                        ))
                                                                    )
                                                                )}
                                                            </td>
                                                        );

                                                        dayIndex += colSpan;
                                                    }

                                                    return cells;
                                                })}
                                            </tr>
                                        );
                                    });
                                }
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // 날짜 기반 뷰: 요일별로 해당 요일에 수업이 있는 선생님 목록 (slotTeachers 포함)
    // 날짜 뷰에서는 기본 요일 순서(월화수목금토일)를 사용
    const dayBasedData = useMemo(() => {
        const data: { day: string; resources: string[] }[] = [];
        const naturalDayOrder = ALL_WEEKDAYS; // 월화수목금토일 순서

        // 선택된 요일 중 기본 순서로 정렬
        const selectedDaysInOrder = naturalDayOrder.filter(day => orderedSelectedDays.includes(day));

        selectedDaysInOrder.forEach(day => {
            const resourcesForDay = allResources.filter(resource =>
                resourceDayLookup.get(resource?.trim())?.has(day) ?? false
            );
            if (resourcesForDay.length > 0) {
                data.push({ day, resources: resourcesForDay });
            }
        });

        return data;
    }, [orderedSelectedDays, allResources, resourceDayLookup]);

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
                                    className={`p-1.5 text-xxs font-bold ${dayColors.text} border-b border-gray-200 border-r-2 border-r-gray-400 sticky left-0 z-30`}
                                    style={{
                                        width: '90px',
                                        minWidth: '90px',
                                        backgroundColor: dayColors.light === 'bg-blue-50' ? '#eff6ff' :
                                            dayColors.light === 'bg-amber-50' ? '#fffbeb' :
                                                dayColors.light === 'bg-orange-50' ? '#fff7ed' :
                                                    dayColors.light === 'bg-green-50' ? '#f0fdf4' :
                                                        dayColors.light === 'bg-gray-50' ? '#f9fafb' : '#f3f4f6'
                                    }}
                                >
                                    교시
                                </th>
                                {resources.map((resource, idx) => {
                                    const teacherData = teachers.find(t => t.name === resource);
                                    const bgColor = teacherData?.bgColor || '#3b82f6';
                                    const textColor = teacherData?.textColor || '#ffffff';
                                    const isLast = idx === resources.length - 1;
                                    // 모든 선생님 사이에 세로 구분선 추가
                                    const borderRightClass = isLast ? 'border-r-2 border-r-gray-400' : 'border-r-2 border-r-gray-300';

                                    return (
                                        <th
                                            key={resource}
                                            className={`p-1.5 text-xs font-bold truncate ${borderRightClass}`}
                                            style={{
                                                ...singleCellWidthStyle,
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
                            {(() => {
                                // 주말: 시간만 표시 (교시 라벨 제거)
                                // 평일: 교시 그룹화 (1-1+1-2 → 1교시, ...)
                                // 단, 같은 수업이 두 교시 모두에 있을 때만 병합
                                if (!isWeekend) {
                                    const bgColorMap: Record<string, string> = {
                                        'bg-blue-50': '#eff6ff',
                                        'bg-amber-50': '#fffbeb',
                                        'bg-orange-50': '#fff7ed',
                                        'bg-green-50': '#f0fdf4',
                                        'bg-pink-50': '#fdf2f8',
                                        'bg-emerald-50': '#ecfdf5',
                                        'bg-indigo-50': '#eef2ff',
                                        'bg-gray-50': '#f9fafb'
                                    };
                                    const bgHex = bgColorMap[dayColors.light] || '#f3f4f6';

                                    // 그룹화 가능 여부 판단 후 행 생성
                                    const rows: React.ReactNode[] = [];
                                    const processedPeriods = new Set<string>();

                                    MATH_GROUPED_PERIODS.forEach(groupId => {
                                        const periodIds = MATH_GROUP_PERIOD_IDS[groupId];
                                        const [firstPeriod, secondPeriod] = periodIds;

                                        const hasFirst = currentPeriods.includes(firstPeriod);
                                        const hasSecond = currentPeriods.includes(secondPeriod);

                                        if (!hasFirst && !hasSecond) return;

                                        const groupInfo = MATH_GROUP_DISPLAY[groupId];

                                        // 두 교시 모두 있으면 헤더만 병합 (rowSpan=2), 셀은 각각 표시
                                        if (hasFirst && hasSecond) {
                                            processedPeriods.add(firstPeriod);
                                            processedPeriods.add(secondPeriod);

                                            // 첫 번째 행: 교시 헤더(rowSpan=2) + 첫 번째 교시 셀들
                                            rows.push(
                                                <tr key={`group-${groupId}-first`}>
                                                    <td
                                                        rowSpan={2}
                                                        className={`p-1.5 text-xxs font-bold ${dayColors.text} text-center sticky left-0 z-10 border-b-2 border-b-gray-400 border-r-2 border-r-gray-400`}
                                                        style={{
                                                            width: '90px',
                                                            minWidth: '90px',
                                                            backgroundColor: bgHex
                                                        }}
                                                    >
                                                        <div className="font-bold text-xxs text-gray-500">{groupInfo.label}</div>
                                                        <div>{groupInfo.time}</div>
                                                    </td>
                                                    {resources.map((resource, resourceIdx) => {
                                                        const periodIndex = currentPeriods.indexOf(firstPeriod);
                                                        const cellClasses = getClassesForCell(filteredClasses, day, firstPeriod, resource, viewType);

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

                                                        const heightValue = rowHeightValue;
                                                        const compactRowHeight = 45;
                                                        const hasClass = cellClasses.length > 0;
                                                        const cellStyle = isCompactMode
                                                            ? { ...singleCellWidthStyle, height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                            : { ...singleCellWidthStyle, height: `${(heightValue as number) * maxRowSpan}px` };

                                                        const isEmpty = cellClasses.length === 0;
                                                        const isLastResource = resourceIdx === resources.length - 1;
                                                        const borderRightClass = isLastResource ? 'border-r-2 border-r-gray-400' : 'border-r-2 border-r-gray-300';

                                                        return (
                                                            <td
                                                                key={`${resource}-${firstPeriod}`}
                                                                className={`p-0 border-b-2 border-b-gray-400 ${borderRightClass} ${isEmpty ? 'bg-gray-200' : ''}`}
                                                                style={cellStyle}
                                                                rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                            >
                                                                {isEmpty && showEmptyRooms ? (
                                                                    <div className="text-xxs text-gray-500 text-center py-1">
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
                                                                            canEdit={effectiveCanEdit}
                                                                            isDragOver={dragOverClassId === cls.id}
                                                                            onClick={onClassClick}
                                                                            onDragStart={onDragStart}
                                                                            onDragOver={onDragOver}
                                                                            onDragLeave={onDragLeave}
                                                                            onDrop={onDrop}
                                                                            studentMap={studentMap}
                                                                            classKeywords={classKeywords}
                                                                            onStudentClick={onStudentClick}
                                                                            currentDay={day}
                                                                            fontSize={fontSize}
                                                                            rowHeight={rowHeight}
                                                                            showHoldStudents={showHoldStudents}
                                                                            showWithdrawnStudents={showWithdrawnStudents}
                                                                            pendingMovedStudentIds={pendingMovedStudentIds}
                                                                        />
                                                                    ))
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );

                                            // 두 번째 행: 교시 헤더 없음 (rowSpan으로 병합됨) + 두 번째 교시 셀들
                                            rows.push(
                                                <tr key={`group-${groupId}-second`}>
                                                    {resources.map((resource, resourceIdx) => {
                                                        const periodIndex = currentPeriods.indexOf(secondPeriod);
                                                        const cellClasses = getClassesForCell(filteredClasses, day, secondPeriod, resource, viewType);

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

                                                        const heightValue = rowHeightValue;
                                                        const compactRowHeight = 45;
                                                        const hasClass = cellClasses.length > 0;
                                                        const cellStyle = isCompactMode
                                                            ? { ...singleCellWidthStyle, height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                            : { ...singleCellWidthStyle, height: `${(heightValue as number) * maxRowSpan}px` };

                                                        const isEmpty = cellClasses.length === 0;
                                                        const isLastResource = resourceIdx === resources.length - 1;
                                                        const borderRightClass = isLastResource ? 'border-r-2 border-r-gray-400' : 'border-r-2 border-r-gray-300';

                                                        return (
                                                            <td
                                                                key={`${resource}-${secondPeriod}`}
                                                                className={`p-0 border-b-2 border-b-gray-400 ${borderRightClass} ${isEmpty ? 'bg-gray-200' : ''}`}
                                                                style={cellStyle}
                                                                rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                            >
                                                                {isEmpty && showEmptyRooms ? (
                                                                    <div className="text-xxs text-gray-500 text-center py-1">
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
                                                                            canEdit={effectiveCanEdit}
                                                                            isDragOver={dragOverClassId === cls.id}
                                                                            onClick={onClassClick}
                                                                            onDragStart={onDragStart}
                                                                            onDragOver={onDragOver}
                                                                            onDragLeave={onDragLeave}
                                                                            onDrop={onDrop}
                                                                            studentMap={studentMap}
                                                                            classKeywords={classKeywords}
                                                                            onStudentClick={onStudentClick}
                                                                            currentDay={day}
                                                                            fontSize={fontSize}
                                                                            rowHeight={rowHeight}
                                                                            showHoldStudents={showHoldStudents}
                                                                            showWithdrawnStudents={showWithdrawnStudents}
                                                                            pendingMovedStudentIds={pendingMovedStudentIds}
                                                                        />
                                                                    ))
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        } else {
                                            // 하나의 교시만 있으면 개별 표시
                                            periodIds.forEach(period => {
                                                if (!currentPeriods.includes(period) || processedPeriods.has(period)) return;
                                                processedPeriods.add(period);

                                                const periodTime = MATH_PERIOD_TIMES[period] || period;
                                                const periodIndex = currentPeriods.indexOf(period);

                                                rows.push(
                                                    <tr key={`period-${period}`}>
                                                        <td
                                                            className={`p-1.5 text-xxs font-bold ${dayColors.text} text-center sticky left-0 z-10 border-b-2 border-b-gray-400 border-r-2 border-r-gray-400`}
                                                            style={{
                                                                width: '90px',
                                                                minWidth: '90px',
                                                                backgroundColor: bgHex
                                                            }}
                                                        >
                                                            <div className="font-bold text-xxs text-gray-500">{period}</div>
                                                            <div>{periodTime}</div>
                                                        </td>
                                                        {resources.map((resource, resourceIdx) => {
                                                            const cellClasses = getClassesForCell(filteredClasses, day, period, resource, viewType);

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

                                                            const heightValue = rowHeightValue;
                                                            const compactRowHeight = 45;
                                                            const hasClass = cellClasses.length > 0;
                                                            const cellStyle = isCompactMode
                                                                ? { ...singleCellWidthStyle, height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                                : { ...singleCellWidthStyle, height: `${(heightValue as number) * maxRowSpan}px` };

                                                            const isEmpty = cellClasses.length === 0;
                                                            const isLastResource = resourceIdx === resources.length - 1;
                                                            const borderRightClass = isLastResource ? 'border-r-2 border-r-gray-400' : 'border-r-2 border-r-gray-300';

                                                            return (
                                                                <td
                                                                    key={`${resource}-${period}`}
                                                                    className={`p-0 border-b-2 border-b-gray-400 ${borderRightClass} ${isEmpty ? 'bg-gray-200' : ''}`}
                                                                    style={cellStyle}
                                                                    rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                                >
                                                                    {isEmpty && showEmptyRooms ? (
                                                                        <div className="text-xxs text-gray-500 text-center py-1">
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
                                                                                canEdit={effectiveCanEdit}
                                                                                isDragOver={dragOverClassId === cls.id}
                                                                                onClick={onClassClick}
                                                                                onDragStart={onDragStart}
                                                                                onDragOver={onDragOver}
                                                                                onDragLeave={onDragLeave}
                                                                                onDrop={onDrop}
                                                                                studentMap={studentMap}
                                                                                classKeywords={classKeywords}
                                                                                onStudentClick={onStudentClick}
                                                                                currentDay={day}
                                                                                fontSize={fontSize}
                                                                                rowHeight={rowHeight}
                                                                                showHoldStudents={showHoldStudents}
                                                                                showWithdrawnStudents={showWithdrawnStudents}
                                                                                pendingMovedStudentIds={pendingMovedStudentIds}
                                                                            />
                                                                        ))
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            });
                                        }
                                    });

                                    return rows;
                                } else {
                                    // 주말: 시간만 표시 (교시 라벨 제거)
                                    return currentPeriods.map(period => {
                                        const periodIndex = currentPeriods.indexOf(period);
                                        const periodTimeDisplay = WEEKEND_PERIOD_TIMES[period] || period;

                                        const bgColorMap: Record<string, string> = {
                                            'bg-blue-50': '#eff6ff',
                                            'bg-amber-50': '#fffbeb',
                                            'bg-orange-50': '#fff7ed',
                                            'bg-green-50': '#f0fdf4',
                                            'bg-gray-50': '#f9fafb'
                                        };
                                        const bgHex = bgColorMap[dayColors.light] || '#f3f4f6';

                                        return (
                                            <tr key={period}>
                                                <td
                                                    className={`p-1.5 text-xxs font-bold ${dayColors.text} text-center sticky left-0 z-10 border-b-2 border-b-gray-400 border-r-2 border-r-gray-400`}
                                                    style={{
                                                        width: '90px',
                                                        minWidth: '90px',
                                                        backgroundColor: bgHex
                                                    }}
                                                >
                                                    <div>{periodTimeDisplay}</div>
                                                </td>
                                                {resources.map((resource, resourceIdx) => {
                                                    const cellClasses = getClassesForCell(filteredClasses, day, period, resource, viewType);

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

                                                    const heightValue = rowHeightValue;
                                                    const compactRowHeight = 45;
                                                    const hasClass = cellClasses.length > 0;
                                                    const cellStyle = isCompactMode
                                                        ? { ...singleCellWidthStyle, height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                        : { ...singleCellWidthStyle, height: `${(heightValue as number) * maxRowSpan}px` };

                                                    const isEmpty = cellClasses.length === 0;
                                                    const isLastResource = resourceIdx === resources.length - 1;
                                                    const borderRightClass = isLastResource ? 'border-r-2 border-r-gray-400' : 'border-r-2 border-r-gray-300';

                                                    return (
                                                        <td
                                                            key={`${resource}-${period}`}
                                                            className={`p-0 border-b-2 border-b-gray-400 ${borderRightClass} ${isEmpty ? 'bg-gray-200' : ''}`}
                                                            style={cellStyle}
                                                            rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                        >
                                                            {isEmpty && showEmptyRooms ? (
                                                                <div className="text-xxs text-gray-500 text-center py-1">
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
                                                                        canEdit={effectiveCanEdit}
                                                                        isDragOver={dragOverClassId === cls.id}
                                                                        onClick={onClassClick}
                                                                        onDragStart={onDragStart}
                                                                        onDragOver={onDragOver}
                                                                        onDragLeave={onDragLeave}
                                                                        onDrop={onDrop}
                                                                        studentMap={studentMap}
                                                                        classKeywords={classKeywords}
                                                                        onStudentClick={onStudentClick}
                                                                        currentDay={day}
                                                                        fontSize={fontSize}
                                                                        rowHeight={rowHeight}
                                                                        showHoldStudents={showHoldStudents}
                                                                        showWithdrawnStudents={showWithdrawnStudents}
                                                                        pendingMovedStudentIds={pendingMovedStudentIds}
                                                                    />
                                                                ))
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    });
                                }
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // 뷰 모드에 따라 다른 레이아웃 렌더링
    if (timetableViewMode === 'day-based') {
        return (
            <div className="overflow-auto h-full">
                <div className="flex gap-4">
                    {dayBasedData.map(({ day, resources }) => renderDayBasedTable(day, resources))}
                </div>
            </div>
        );
    }

    // teacher-based 뷰 (기존)
    return (
        <div className="overflow-auto h-full">
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

// React.memo로 불필요한 리렌더링 방지 (부모 리렌더 시 props 변경 없으면 스킵)
export default React.memo(TimetableGrid);
