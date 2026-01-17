import React, { useMemo } from 'react';
import { TimetableClass, Teacher, ClassKeywordColor } from '../../../../types';
import { getClassesForCell, getConsecutiveSpan, shouldSkipCell } from '../utils/gridUtils';
import ClassCard from './ClassCard';
import { MATH_PERIOD_TIMES, WEEKEND_PERIOD_TIMES, ENGLISH_PERIODS, ALL_WEEKDAYS } from '../../constants';

// Helper: 특정 요일에 강사가 수업이 있는지 확인 (메인 teacher 또는 slotTeachers)
const hasClassOnDay = (
    cls: TimetableClass,
    day: string,
    resource: string,
    viewType: 'teacher' | 'room' | 'class'
): boolean => {
    // 해당 요일에 스케줄이 있는지 먼저 확인
    const hasScheduleOnDay = cls.schedule?.some(s => s.includes(day));
    if (!hasScheduleOnDay) return false;

    if (viewType === 'teacher') {
        // 메인 teacher인 경우
        if (cls.teacher?.trim() === resource?.trim()) {
            // slotTeachers에서 다른 사람이 모든 슬롯을 담당하는지 확인
            // 해당 요일의 모든 슬롯에 slotTeacher가 지정되어 있으면 메인 teacher는 해당 요일 수업 없음
            const daySlots = cls.schedule?.filter(s => s.includes(day)) || [];
            const allSlotsOverridden = daySlots.every(slot => {
                // slot 형식: "월 1-2" -> slotTeachers 키: "월-2"
                const parts = slot.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const slotDay = parts[0];
                    const periodPart = parts[1];
                    // 레거시 periodId를 새 periodId로 변환 (1-2 -> 2)
                    const periodMap: Record<string, string> = {
                        '1-1': '1', '1-2': '2', '2-1': '3', '2-2': '4',
                        '3-1': '5', '3-2': '6', '4-1': '7', '4-2': '8',
                        '1': '1', '2': '2', '3': '3', '4': '4',
                        '5': '5', '6': '6', '7': '7', '8': '8'
                    };
                    const normalizedPeriod = periodMap[periodPart] || periodPart;
                    const slotKey = `${slotDay}-${normalizedPeriod}`;
                    const slotTeacher = cls.slotTeachers?.[slotKey];
                    // slotTeacher가 있고 메인 teacher와 다르면 override
                    return slotTeacher && slotTeacher.trim() !== resource?.trim();
                }
                return false;
            });
            // 모든 슬롯이 다른 강사로 override되지 않았으면 해당 요일 수업 있음
            return !allSlotsOverridden;
        }

        // slotTeachers에 해당 강사가 있는지 확인
        if (cls.slotTeachers) {
            return Object.entries(cls.slotTeachers).some(([key, teacher]) => {
                // key 형식: "월-2" (요일-periodId)
                const keyDay = key.split('-')[0];
                return keyDay === day && teacher?.trim() === resource?.trim();
            });
        }

        return false;
    } else {
        // Room 뷰
        if (cls.room?.trim() === resource?.trim()) {
            const daySlots = cls.schedule?.filter(s => s.includes(day)) || [];
            const allSlotsOverridden = daySlots.every(slot => {
                const parts = slot.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const slotDay = parts[0];
                    const periodPart = parts[1];
                    const periodMap: Record<string, string> = {
                        '1-1': '1', '1-2': '2', '2-1': '3', '2-2': '4',
                        '3-1': '5', '3-2': '6', '4-1': '7', '4-2': '8',
                        '1': '1', '2': '2', '3': '3', '4': '4',
                        '5': '5', '6': '6', '7': '7', '8': '8'
                    };
                    const normalizedPeriod = periodMap[periodPart] || periodPart;
                    const slotKey = `${slotDay}-${normalizedPeriod}`;
                    const slotRoom = cls.slotRooms?.[slotKey];
                    return slotRoom && slotRoom.trim() !== resource?.trim();
                }
                return false;
            });
            return !allSlotsOverridden;
        }

        if (cls.slotRooms) {
            return Object.entries(cls.slotRooms).some(([key, room]) => {
                const keyDay = key.split('-')[0];
                return keyDay === day && room?.trim() === resource?.trim();
            });
        }

        return false;
    }
};
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
    rowHeight: 'compact' | 'short' | 'normal' | 'tall' | 'very-tall';
    fontSize: 'small' | 'normal' | 'large' | 'very-large';
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
    onDragStart: (e: React.DragEvent, studentId: string, fromClassId: string) => void;
    onDragOver: (e: React.DragEvent, classId: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, toClassId: string) => void;

    currentSubjectFilter: string;
    studentMap: Record<string, any>;
    // Timetable View Mode
    timetableViewMode: 'day-based' | 'teacher-based';
    // Keyword Colors
    classKeywords?: ClassKeywordColor[];
    // Student Click
    onStudentClick?: (studentId: string) => void;
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
    onStudentClick
}) => {
    // Helper to get column width style
    // 병합 셀용 (월/목 같이 여러 요일 병합) - 각 요일당 좁은 너비
    const getMergedCellWidthStyle = (colspan: number) => {
        const perDayWidth = columnWidth === 'narrow' ? 80 : columnWidth === 'wide' ? 120 : 100;
        return { width: `${colspan * perDayWidth}px`, minWidth: `${colspan * perDayWidth}px` };
    };

    // 단일 셀용 (수, 토, 일 등 병합 안 된 셀) - 수업명이 한 줄에 보이도록 넓게
    const getSingleCellWidthStyle = () => {
        const baseWidth = columnWidth === 'narrow' ? 140 : columnWidth === 'wide' ? 200 : 170;
        return { width: `${baseWidth}px`, minWidth: `${baseWidth}px` };
    };

    // 날짜별 뷰용 - 더 넓은 너비로 강의명이 한줄에 표시되도록
    const getDayBasedCellWidthStyle = () => {
        const baseWidth = columnWidth === 'narrow' ? 140 : columnWidth === 'wide' ? 200 : 170;
        return { width: `${baseWidth}px`, minWidth: `${baseWidth}px` };
    };

    // 교시당 기본 높이 계산
    const getRowHeight = (): number | 'auto' => {
        // 학생 목록 숨기면 항상 auto (콘텐츠에 맞게 압축)
        if (!showStudents) return 'auto';
        // rowHeight 설정에 따라 조절 - 더 극적인 차이로 변경
        if (rowHeight === 'compact') return 'auto'; // 컴팩트: 콘텐츠에 맞게 자동 축소
        if (rowHeight === 'short') return 120;      // 좁게 (수업명 + 학생 2~3명)
        if (rowHeight === 'tall') return 280;       // 큰 높이
        if (rowHeight === 'very-tall') return 340;  // 아주 큰 높이
        return 200; // normal - 기본값
    };

    // 학생 목록 숨기기도 컴팩트 모드처럼 동작
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
                filteredClasses.some(c => hasClassOnDay(c, day, resource, viewType))
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });

        return map;
    }, [allResources, monThuDays, filteredClasses, viewType]);

    // 화/금 그룹: 각 선생님이 어떤 요일에 수업이 있는지 계산 (slotTeachers 포함)
    const tueFriResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();

        allResources.forEach(resource => {
            const daysForResource = tueFriDays.filter(day =>
                filteredClasses.some(c => hasClassOnDay(c, day, resource, viewType))
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });

        return map;
    }, [allResources, tueFriDays, filteredClasses, viewType]);

    // 토/일 그룹: 각 선생님이 어떤 요일에 수업이 있는지 계산 (slotTeachers 포함)
    const weekendResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();

        allResources.forEach(resource => {
            const daysForResource = weekendDays.filter(day =>
                filteredClasses.some(c => hasClassOnDay(c, day, resource, viewType))
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });

        return map;
    }, [allResources, weekendDays, filteredClasses, viewType]);

    // 수요일 수업이 있는 선생님 (수요일 전용, slotTeachers 포함)
    const wednesdayResources = useMemo(() => {
        if (!hasWednesday) return [];
        return allResources.filter(resource =>
            filteredClasses.some(c => hasClassOnDay(c, '수', resource, viewType))
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
                                        : getSingleCellWidthStyle();

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
                                            : getSingleCellWidthStyle();  // 단독 셀 너비

                                        return (
                                            <th
                                                key={`${resource}-${day}`}
                                                className={`p-1.5 text-xxs font-bold text-center ${borderRightClass} ${isWeekend ? 'bg-orange-50 text-orange-700' : day === '수' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                                                style={dayHeaderWidth}
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

                                // 배경색 hex 매핑 (sticky 요소에서 border가 보이도록)
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
                                            <div className="font-bold text-[10px] text-gray-500">{period}</div>
                                            <div>{periodTimeDisplay}</div>
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

                                                // 수평 병합 확인: 이전 요일에서 이미 이 수업이 병합되어 렌더링되었는지 체크
                                                let shouldSkipHorizontalMerge = false;
                                                if (!isWednesdayTable && cellClasses.length === 1 && dayIndex > 0) {
                                                    const cls = cellClasses[0];
                                                    // 이전 요일들을 역순으로 확인
                                                    for (let prevIdx = dayIndex - 1; prevIdx >= 0; prevIdx--) {
                                                        const prevDay = daysForResource[prevIdx];
                                                        const prevDayClasses = getClassesForCell(filteredClasses, prevDay, period, resource, viewType);

                                                        // 이전 요일에 같은 수업이 있고, 단일 수업이면 (병합 가능한 조건)
                                                        if (prevDayClasses.length === 1 && prevDayClasses[0].className === cls.className) {
                                                            // 이전 요일과 현재 요일의 rowSpan이 같은지 확인
                                                            const prevRowSpan = getConsecutiveSpan(prevDayClasses[0], prevDay, periodIndex, currentPeriods, filteredClasses, viewType);
                                                            const currentRowSpan = getConsecutiveSpan(cls, day, periodIndex, currentPeriods, filteredClasses, viewType);

                                                            if (prevRowSpan === currentRowSpan) {
                                                                // 연속된 병합이므로 현재 셀은 스킵
                                                                shouldSkipHorizontalMerge = true;
                                                                break;
                                                            } else {
                                                                // rowSpan이 다르면 병합 불가, 체크 중단
                                                                break;
                                                            }
                                                        } else {
                                                            // 다른 수업이거나 복수 수업이면 병합 불가, 체크 중단
                                                            break;
                                                        }
                                                    }
                                                }

                                                if (shouldSkipHorizontalMerge) {
                                                    dayIndex++;
                                                    continue;
                                                }

                                                // 수직 병합 span 계산
                                                const maxRowSpan = Math.max(1, ...cellClasses.map((cls: TimetableClass) =>
                                                    getConsecutiveSpan(cls, day, periodIndex, currentPeriods, filteredClasses, viewType)
                                                ));

                                                // 수평 병합 (수요일 테이블에서는 비활성화)
                                                let colSpan = 1;
                                                const mergedDaysForCell: string[] = [day];  // 병합된 요일 목록
                                                if (!isWednesdayTable && cellClasses.length === 1) {
                                                    const cls = cellClasses[0];
                                                    for (let nextIdx = dayIndex + 1; nextIdx < daysForResource.length; nextIdx++) {
                                                        const nextDay = daysForResource[nextIdx];
                                                        const nextDayClasses = getClassesForCell(filteredClasses, nextDay, period, resource, viewType);

                                                        if (nextDayClasses.length === 1 && nextDayClasses[0].className === cls.className) {
                                                            const nextRowSpan = getConsecutiveSpan(nextDayClasses[0], nextDay, periodIndex, currentPeriods, filteredClasses, viewType);
                                                            if (nextRowSpan === maxRowSpan) {
                                                                colSpan++;
                                                                mergedDaysForCell.push(nextDay);  // 병합된 요일 추가
                                                            } else {
                                                                break;
                                                            }
                                                        } else {
                                                            break;
                                                        }
                                                    }
                                                }

                                                // 병합 셀(월/목)은 좁게, 단일 셀(수)은 넓게
                                                const baseWidthStyle = colSpan > 1
                                                    ? getMergedCellWidthStyle(colSpan)
                                                    : getSingleCellWidthStyle();
                                                const heightValue = getRowHeight();
                                                // 컴팩트 모드: 수업이 있으면 최소 높이 적용 (빈 셀은 auto)
                                                const compactRowHeight = 45; // 수업명 + 강의실만 표시할 때의 높이
                                                const hasClass = cellClasses.length > 0;
                                                const cellStyle = isCompactMode
                                                    ? { ...baseWidthStyle, height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                    : { ...baseWidthStyle, height: `${(heightValue as number) * maxRowSpan}px` };

                                                // 빈 셀 여부 확인 (수업이 없는 교시)
                                                const isEmpty = cellClasses.length === 0;

                                                // 마지막 요일인지 확인 (강사 간 세로 구분선용)
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
                                                                    classKeywords={classKeywords}
                                                                    onStudentClick={onStudentClick}
                                                                    currentDay={colSpan === 1 ? day : undefined}
                                                                    mergedDays={colSpan > 1 ? mergedDaysForCell : undefined}
                                                                    fontSize={fontSize}
                                                                    rowHeight={rowHeight}
                                                                    showHoldStudents={showHoldStudents}
                                                                    showWithdrawnStudents={showWithdrawnStudents}
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

    // 날짜 기반 뷰: 요일별로 해당 요일에 수업이 있는 선생님 목록 (slotTeachers 포함)
    // 날짜 뷰에서는 기본 요일 순서(월화수목금토일)를 사용
    const dayBasedData = useMemo(() => {
        const data: { day: string; resources: string[] }[] = [];
        const naturalDayOrder = ALL_WEEKDAYS; // 월화수목금토일 순서

        // 선택된 요일 중 기본 순서로 정렬
        const selectedDaysInOrder = naturalDayOrder.filter(day => orderedSelectedDays.includes(day));

        selectedDaysInOrder.forEach(day => {
            const resourcesForDay = allResources.filter(resource =>
                filteredClasses.some(c => hasClassOnDay(c, day, resource, viewType))
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
                                                ...getDayBasedCellWidthStyle(),
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

                                // 배경색 hex 매핑 (sticky 요소에서 border가 보이도록)
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
                                            <div className="font-bold text-[10px] text-gray-500">{period}</div>
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

                                            const heightValue = getRowHeight();
                                            // 컴팩트 모드: 수업이 있으면 최소 높이 적용 (빈 셀은 auto)
                                            const compactRowHeight = 45;
                                            const hasClass = cellClasses.length > 0;
                                            const cellStyle = isCompactMode
                                                ? { ...getDayBasedCellWidthStyle(), height: hasClass ? `${compactRowHeight * maxRowSpan}px` : undefined }
                                                : { ...getDayBasedCellWidthStyle(), height: `${(heightValue as number) * maxRowSpan}px` };

                                            // 빈 셀 여부 확인 (수업이 없는 교시)
                                            const isEmpty = cellClasses.length === 0;

                                            // 모든 선생님 사이에 세로 구분선 추가
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
                                                                canEdit={canEdit}
                                                                dragOverClassId={dragOverClassId}
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
            <div className="overflow-x-auto overflow-y-auto" style={{ height: 'calc(100vh - 240px)' }}>
                <div className="flex gap-4">
                    {dayBasedData.map(({ day, resources }) => renderDayBasedTable(day, resources))}
                </div>
            </div>
        );
    }

    // teacher-based 뷰 (기존)
    return (
        <div className="overflow-x-auto overflow-y-auto" style={{ height: 'calc(100vh - 240px)' }}>
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
