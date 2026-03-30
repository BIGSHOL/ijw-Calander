import React, { useMemo } from 'react';
import { TimetableClass, Teacher, ClassKeywordColor } from '../../../../types';
import { getClassesForCell, getConsecutiveSpan, shouldSkipCell, isSameClassNameSet } from '../utils/gridUtils';
import ClassCard from './ClassCard';
import { WEEKEND_PERIOD_TIMES, ALL_WEEKDAYS, LEGACY_TO_UNIFIED_PERIOD_MAP, MATH_GROUP_DISPLAY, MATH_GROUP_PERIOD_IDS, MATH_GROUPED_PERIODS, MATH_PERIOD_TIMES } from '../../constants';
import { BookOpen } from 'lucide-react';
import { useClassTextbookMap } from '../../../../hooks/useClassTextbookMap';
import { useAllLatestReports } from '../../../../hooks/useAllLatestReports';
import { formatDateKey, getWeekReferenceDate } from '../../../../utils/dateUtils';

// 시간 텍스트를 ~ 뒤에서 줄바꿈하는 헬퍼
const renderTime = (time: string) => {
    const idx = time.indexOf('~');
    if (idx === -1) return time;
    return <>{time.slice(0, idx + 1)}<br />{time.slice(idx + 1)}</>;
};

// 빈 셀 배경색: 회색
const EMPTY_CELL_BG = '#e5e7eb';

// 교시 병합 셀의 반명 슬롯 높이 (sub-period당, px) — 반명 2줄까지 표시
const NAME_SLOT_H = 28;

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
    pendingMoveSchedules?: Map<string, string | undefined>;
    // 엑셀 모드 (강사뷰 변형: 셀 선택, 텍스트 복사, 자동완성, 복사/붙여넣기)
    isExcelMode?: boolean;
    selectedClassId?: string | null;
    onCellSelect?: (classId: string) => void;
    onEnrollStudent?: (studentId: string, className: string) => void;
    onCancelPendingEnroll?: (studentId: string, className: string) => void;
    selectedStudentIds?: Set<string>;
    selectedStudentClassName?: string | null;
    copiedStudentIds?: string[] | null;
    copiedStudentClassName?: string | null;
    cutStudentIds?: string[] | null;
    cutStudentClassName?: string | null;
    acHighlightStudentId?: string | null;
    onAcHighlightChange?: (studentId: string | null) => void;
    onStudentSelect?: (studentId: string, className: string) => void;
    onStudentMultiSelect?: (studentIds: Set<string>, className: string) => void;
    // 배정 예정 취소
    onCancelScheduledEnrollment?: (studentId: string, className: string) => void;
    // 퇴원 드롭존
    onWithdrawalDrop?: (studentId: string, classId: string, className: string) => void;
    // 엑셀 보류 삭제/등록 (시각적 표시)
    pendingExcelDeleteIds?: Set<string>;
    pendingExcelEnrollments?: Array<{ studentId: string; className: string; enrollmentDate?: string }>;
    // 묶음 요일 그룹 순서 (teacher-based 뷰)
    weekdayGroupOrder?: string[];
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
    pendingMovedStudentIds,
    pendingMoveSchedules,
    isExcelMode,
    selectedClassId,
    onCellSelect,
    onEnrollStudent,
    onCancelPendingEnroll,
    selectedStudentIds,
    selectedStudentClassName,
    copiedStudentIds,
    copiedStudentClassName,
    cutStudentIds,
    cutStudentClassName,
    acHighlightStudentId,
    onAcHighlightChange,
    onStudentSelect,
    onStudentMultiSelect,
    onCancelScheduledEnrollment,
    onWithdrawalDrop,
    pendingExcelDeleteIds,
    pendingExcelEnrollments,
    weekdayGroupOrder,
}) => {
    // 주차 기준일: 미래 주 → weekStart, 이번 주 → today, 과거 주 → weekEnd(일요일)
    const referenceDate = useMemo(() => {
        const firstDay = orderedSelectedDays[0];
        const dateInfo = firstDay && weekDates[firstDay];
        if (dateInfo?.date) {
            return getWeekReferenceDate(dateInfo.date);
        }
        return formatDateKey(new Date());
    }, [weekDates, orderedSelectedDays]);

    // 수업별 최신 교재 + 학생별 교재 수납 조회
    const { byClassId, byClassName, byStudentName } = useClassTextbookMap();
    const getLatestTextbook = (cls: TimetableClass) =>
        byClassId.get(cls.id) || byClassName.get(cls.className) || null;

    
    // 학생별 최근 보고서 (진도 정보)
    const { data: latestReports } = useAllLatestReports();
    // 수정 모드일 때만 실제 canEdit 적용
    const effectiveCanEdit = canEdit && mode === 'edit';
    // 부담임 셀에서는 드래그 비활성화 (teacher 뷰에서 해당 셀의 리소스가 담임이 아닌 경우)
    const getCanEdit = (cls: TimetableClass, resource: string) =>
        effectiveCanEdit && !(viewType === 'teacher' && cls.teacher?.trim() !== resource?.trim());
    // 부담임 슬롯 여부 판별 (teacher 뷰에서 slotTeacher로 배정된 경우)
    const isAssistantSlot = (cls: TimetableClass, resource: string) =>
        viewType === 'teacher' && cls.teacher?.trim() !== resource?.trim();
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
                if (typeof slot !== 'string') return;
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
        // 병합 셀에서 요일당 폭 = cellSize / 2 (대략)
        const base = columnWidth === 'compact' ? 36 :
            columnWidth === 'narrow' ? 45 :
                columnWidth === 'wide' ? 63 :
                    columnWidth === 'x-wide' ? 72 : 54;
        return Math.round(base * widthFactor);
    }, [columnWidth, widthFactor]);

    const mergedCellWidthCache = useMemo(() => {
        const cache: Record<number, { width: string; minWidth: string; maxWidth: string; overflow: 'hidden' }> = {};
        const minPerDay = Math.round(perDayWidth * 0.5);
        for (let i = 1; i <= 7; i++) {
            const w = `${i * perDayWidth}px`;
            cache[i] = { width: w, minWidth: `${i * minPerDay}px`, maxWidth: w, overflow: 'hidden' };
        }
        return cache;
    }, [perDayWidth]);

    const getMergedCellWidthStyle = (colspan: number) => {
        const minPerDay = Math.round(perDayWidth * 0.5);
        const w = `${colspan * perDayWidth}px`;
        return mergedCellWidthCache[colspan] || { width: w, minWidth: `${colspan * minPerDay}px`, maxWidth: w, overflow: 'hidden' as const };
    };

    // cellSize 픽셀 매핑: columnWidth + rowHeight 둘 다 반영
    // 사이즈(rowHeight) 변경 시 정사각형 헤더가 가로/세로 모두 커지도록
    const cellSizePx = useMemo(() => {
        const widthBased = columnWidth === 'compact' ? 72 :
            columnWidth === 'narrow' ? 90 :
                columnWidth === 'wide' ? 126 :
                    columnWidth === 'x-wide' ? 144 : 108;
        const heightBased = rowHeight === 'compact' ? 54 :
            rowHeight === 'short' ? 72 :
                rowHeight === 'tall' ? 108 :
                    rowHeight === 'very-tall' ? 126 : 90;
        return Math.max(widthBased, heightBased);
    }, [columnWidth, rowHeight]);

    const singleCellWidthStyle = useMemo(() => {
        const baseWidth = Math.round(cellSizePx * widthFactor);
        const minBase = Math.round(baseWidth * 0.5);
        return { width: `${baseWidth}px`, minWidth: `${minBase}px`, maxWidth: `${baseWidth}px`, overflow: 'hidden' as const };
    }, [cellSizePx, widthFactor]);

    // 교시당 높이 = 헤더(cellSizePx) + 학생 영역(studentSlotH)
    // cellSizePx에 연동하여 열폭/행높이 조합에서 항상 적절한 학생 영역 확보
    const rowHeightValue = useMemo((): number | 'auto' => {
        if (!showStudents) return 'auto';
        if (rowHeight === 'compact') return 'auto';
        const studentSlotH = rowHeight === 'short' ? 30 :
            rowHeight === 'tall' ? 90 :
                rowHeight === 'very-tall' ? 160 : 50;
        return cellSizePx + studentSlotH;
    }, [showStudents, rowHeight, cellSizePx]);

    const isCompactMode = rowHeight === 'compact' || !showStudents;

    // td 내부 wrapper div 스타일 (td height는 CSS 최소값이므로 wrapper div로 실제 높이 제한)
    // 별도 테이블(월/목, 화/금, 수)의 행 높이를 통일하기 위해 필수
    const cellWrapperStyle = (h: string | undefined): React.CSSProperties | undefined =>
        h ? { height: h, maxHeight: h, overflowY: 'auto', overflowX: 'hidden' } : undefined;

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

    // 토/일: 주말 통합 테이블로 표시 (교시 컬럼 공유)
    const hasSaturday = orderedSelectedDays.includes('토');
    const hasSunday = orderedSelectedDays.includes('일');

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

    // 주말(토+일) 통합: 각 선생님이 토/일 중 어떤 요일에 수업이 있는지
    const weekendResourceDaysMap = useMemo(() => {
        const map = new Map<string, string[]>();
        if (!hasSaturday && !hasSunday) return map;
        const weekendDays = [hasSaturday ? '토' : null, hasSunday ? '일' : null].filter(Boolean) as string[];
        allResources.forEach(resource => {
            const daysForResource = weekendDays.filter(day =>
                resourceDayLookup.get(resource?.trim())?.has(day) ?? false
            );
            if (daysForResource.length > 0) {
                map.set(resource, daysForResource);
            }
        });
        return map;
    }, [allResources, hasSaturday, hasSunday, resourceDayLookup]);

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

    // 주말 활성 선생님
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
        isWednesdayTable?: boolean,
        hidePeriodColumn?: boolean
    ) => {
        if (resources.length === 0) return null;

        // 그룹별 색상 설정
        const getGroupColors = () => {
            if (title === '월/목') return { bg: 'bg-blue-600', border: 'border-blue-600', light: 'bg-blue-50', text: 'text-blue-700' };
            if (title === '화/금') return { bg: 'bg-purple-600', border: 'border-purple-600', light: 'bg-purple-50', text: 'text-purple-700' };
            if (title === '주말' || title === '토/일') return { bg: 'bg-orange-600', border: 'border-orange-600', light: 'bg-orange-50', text: 'text-orange-700' };
            return { bg: 'bg-green-600', border: 'border-green-600', light: 'bg-green-50', text: 'text-green-700' };
        };
        const groupColors = getGroupColors();

        // 주말 테이블: 토/일 각 열을 수요일과 동일한 정사각형 셀로
        const isWeekend = title === '주말' || title === '토/일';

        // 셀 내 수업 렌더링 헬퍼: 합반이면 1개 카드에 통합 (수업명만 2등분 표시)
        const renderCellClassCards = (
            cellClasses: TimetableClass[],
            day: string,
            periodIndex: number,
            resource: string,
            colSpan: number,
            mergedDaysForCell: string[],
            overrideShowClassName?: boolean
        ) => {
            // 항상 첫 번째 수업을 대표로, 나머지는 mergedClasses로 통합
            const mergedClassesForCard = cellClasses.length > 1 ? cellClasses : undefined;
            const cls = cellClasses[0];

            return (
                <ClassCard
                    cls={cls}
                    span={getConsecutiveSpan(cls, day, periodIndex, currentPeriods, filteredClasses, viewType)}
                    searchQuery={searchQuery}
                    showStudents={showStudents}
                    showClassName={overrideShowClassName !== undefined ? overrideShowClassName : showClassName}
                    showSchool={showSchool}
                    showGrade={showGrade}
                    canEdit={getCanEdit(cls, resource)}
                    isAssistantTeacher={isAssistantSlot(cls, resource)}
                    isDragOver={mergedClassesForCard ? cellClasses.some(c => dragOverClassId === c.id) : dragOverClassId === cls.id}
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
                    cellSizePx={cellSizePx}
                    showHoldStudents={showHoldStudents}
                    showWithdrawnStudents={showWithdrawnStudents}
                    pendingMovedStudentIds={pendingMovedStudentIds}
                    pendingMoveSchedules={pendingMoveSchedules}
                    mergedClasses={mergedClassesForCard}
                    showMergedLabel={!!mergedClassesForCard}
                    latestTextbook={getLatestTextbook(cls)}
                    latestReports={latestReports}
                    studentTextbookMap={byStudentName}
                    referenceDate={referenceDate}
                    isExcelMode={isExcelMode}
                    isSelected={selectedClassId === cls.id}
                    onCellSelect={onCellSelect}
                    onEnrollStudent={onEnrollStudent}
                                    onCancelPendingEnroll={onCancelPendingEnroll}
                    selectedStudentIds={selectedStudentIds}
                    selectedStudentClassName={selectedStudentClassName}
                    copiedStudentIds={copiedStudentIds}
                    copiedStudentClassName={copiedStudentClassName}
                    cutStudentIds={cutStudentIds}
                    cutStudentClassName={cutStudentClassName}
                    acHighlightStudentId={acHighlightStudentId}
                    onAcHighlightChange={onAcHighlightChange}
                    onStudentSelect={onStudentSelect}
                    onStudentMultiSelect={onStudentMultiSelect}
                    mode={mode}
                    onCancelScheduledEnrollment={onCancelScheduledEnrollment}
                    onWithdrawalDrop={onWithdrawalDrop}
                    pendingExcelDeleteIds={pendingExcelDeleteIds}
                    pendingExcelEnrollments={pendingExcelEnrollments}
                />
            );
        };

        // 테이블 총 폭 계산 (colgroup과 일치시켜 확장 방지)
        const periodColW = hidePeriodColumn ? 0 : 90;
        const totalTableWidth = periodColW + resources.reduce((acc, resource) => {
            const daysForRes = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);
            const isMerged = daysForRes.length > 1 && !isWeekend;
            const colW = isMerged ? perDayWidth : parseInt(singleCellWidthStyle.width);
            return acc + daysForRes.length * colW;
        }, 0);

        return (
            <div className="flex-shrink-0">
                <div className="relative">
                    <table className="border-collapse border-2 border-black" style={{ tableLayout: 'fixed', width: `${totalTableWidth}px` }}>
                        {/* colgroup으로 각 컬럼 너비 강제 */}
                        <colgroup>
                            {!hidePeriodColumn && <col style={{ width: '90px' }} />}
                            {resources.map(resource => {
                                const daysForRes = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);
                                return daysForRes.map((day) => {
                                    const colW = (daysForRes.length > 1 && !isWeekend) ? `${perDayWidth}px` : singleCellWidthStyle.width;
                                    return <col key={`col-${resource}-${day}`} style={{ width: colW }} />;
                                });
                            })}
                        </colgroup>
                        <thead className="sticky top-0 z-20">
                            {/* Group Title Row */}
                            {title && (
                                <tr>
                                    {!hidePeriodColumn ? (
                                        <th
                                            className={`${groupColors.bg} text-white px-3 py-2 font-bold text-sm text-left sticky left-0 z-30`}
                                            colSpan={1}
                                            style={{ width: '90px', minWidth: '90px' }}
                                        >
                                            {title}
                                        </th>
                                    ) : null}
                                    <th
                                        className={`${groupColors.bg} text-white px-3 py-2 font-bold text-sm ${hidePeriodColumn ? 'text-left' : ''}`}
                                        colSpan={resources.reduce((acc, r) => acc + (isWednesdayTable ? 1 : (daysMap.get(r) || []).length), 0)}
                                    >
                                        {hidePeriodColumn && title}
                                    </th>
                                </tr>
                            )}
                            {/* Teacher/Room Row */}
                            <tr>
                                {!hidePeriodColumn && <th
                                    className={`p-1.5 text-period-label font-bold text-black border-b border-b-black border-r-2 border-r-black sticky left-0 z-30`}
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
                                </th>}
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
                                            className="p-1.5 text-sm font-bold border-b-2 border-b-black border-r-2 border-r-black truncate"
                                            style={{
                                                ...headerWidthStyle,
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
                            {/* Day Row with Date */}
                            <tr>
                                {resources.map(resource => {
                                    const daysForResource = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);

                                    return daysForResource.map((day, dayIndex) => {
                                        const isWeekend = day === '토' || day === '일';
                                        const isLastDayForResource = dayIndex === daysForResource.length - 1;
                                        const dateInfo = weekDates[day];
                                        // 강사 구분은 굵은선, 요일 사이는 얇은선
                                        const borderRightClass = isLastDayForResource ? 'border-r-2 border-r-black' : 'border-r border-r-black';
                                        // 병합 요일(월/목 등)은 좁게, 단독 요일(수)과 주말은 넓게
                                        const isMergedDay = daysForResource.length > 1 && !isWeekend;
                                        const dayHeaderWidth = isMergedDay
                                            ? getMergedCellWidthStyle(1)  // 병합 셀의 1요일 너비
                                            : singleCellWidthStyle;  // 단독 셀 너비 (수요일, 주말)

                                        return (
                                            <th
                                                key={`${resource}-${day}`}
                                                className={`p-1.5 text-xxs font-bold text-center border-b-2 border-b-black ${borderRightClass} ${isWeekend ? 'bg-orange-50 text-black' : day === '수' ? 'bg-green-50 text-black' : 'bg-gray-100 text-black'}`}
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
                        <tbody className="timetable-body">
                            {(() => {
                                // 주말 테이블은 그룹화하지 않고 시간만 표시
                                const isWeekendTable = title === '주말' || title === '토/일';

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

                                        // 두 교시 모두 있으면 1행으로 합쳐서 표시
                                        if (hasFirst && hasSecond) {
                                            processedPeriods.add(firstPeriod);
                                            processedPeriods.add(secondPeriod);

                                            const firstPeriodIndex = currentPeriods.indexOf(firstPeriod);
                                            const secondPeriodIndex = currentPeriods.indexOf(secondPeriod);

                                            rows.push(
                                                <tr key={`group-${groupId}`}>
                                                    {!hidePeriodColumn && (
                                                        <td
                                                            className={`p-1.5 text-period-label font-bold text-black text-center sticky left-0 z-10 border-b-2 border-b-black border-r-2 border-r-black`}
                                                            style={{
                                                                width: '90px',
                                                                minWidth: '90px',
                                                                backgroundColor: bgHex
                                                            }}
                                                        >
                                                            <div className="font-bold text-period-label text-black">{groupInfo.label}</div>
                                                            <div>{renderTime(groupInfo.time)}</div>
                                                        </td>
                                                    )}
                                                    {resources.map(resource => {
                                                        const daysForResource = isWednesdayTable ? ['수'] : (daysMap.get(resource) || []);

                                                        const cells: React.ReactNode[] = [];
                                                        let dayIndex = 0;

                                                        while (dayIndex < daysForResource.length) {
                                                            const day = daysForResource[dayIndex];
                                                            const firstClasses = getClassesForCell(filteredClasses, day, firstPeriod, resource, viewType);
                                                            const secondClasses = getClassesForCell(filteredClasses, day, secondPeriod, resource, viewType);

                                                            // 수평 병합 확인 (같은 className 세트면 요일 병합)
                                                            let shouldSkipHorizontalMerge = false;
                                                            if (!isWednesdayTable && (firstClasses.length > 0 || secondClasses.length > 0) && dayIndex > 0) {
                                                                const prevDay = daysForResource[dayIndex - 1];
                                                                const prevFirst = getClassesForCell(filteredClasses, prevDay, firstPeriod, resource, viewType);
                                                                const prevSecond = getClassesForCell(filteredClasses, prevDay, secondPeriod, resource, viewType);
                                                                if (isSameClassNameSet(firstClasses, prevFirst) && isSameClassNameSet(secondClasses, prevSecond)) {
                                                                    shouldSkipHorizontalMerge = true;
                                                                }
                                                            }

                                                            if (shouldSkipHorizontalMerge) {
                                                                dayIndex++;
                                                                continue;
                                                            }

                                                            // 수평 병합 span
                                                            let colSpan = 1;
                                                            const mergedDaysForCell: string[] = [day];
                                                            if (!isWednesdayTable && (firstClasses.length > 0 || secondClasses.length > 0)) {
                                                                for (let nextIdx = dayIndex + 1; nextIdx < daysForResource.length; nextIdx++) {
                                                                    const nextDay = daysForResource[nextIdx];
                                                                    const nextFirst = getClassesForCell(filteredClasses, nextDay, firstPeriod, resource, viewType);
                                                                    const nextSecond = getClassesForCell(filteredClasses, nextDay, secondPeriod, resource, viewType);
                                                                    if (isSameClassNameSet(firstClasses, nextFirst) && isSameClassNameSet(secondClasses, nextSecond)) {
                                                                        colSpan++;
                                                                        mergedDaysForCell.push(nextDay);
                                                                    } else {
                                                                        break;
                                                                    }
                                                                }
                                                            }

                                                            const baseWidthStyle = colSpan > 1
                                                                ? getMergedCellWidthStyle(colSpan)
                                                                : singleCellWidthStyle;
                                                            // 높이: 2교시분
                                                            const doubleHeightValue = isCompactMode
                                                                ? (firstClasses.length > 0 || secondClasses.length > 0 ? 90 : undefined)
                                                                : (rowHeightValue as number) * 2;
                                                            const cellStyle = {
                                                                ...baseWidthStyle,
                                                                height: doubleHeightValue ? `${doubleHeightValue}px` : undefined
                                                            };

                                                            const bothEmpty = firstClasses.length === 0 && secondClasses.length === 0;
                                                            const sameClass = firstClasses.length > 0 && secondClasses.length > 0 && isSameClassNameSet(firstClasses, secondClasses);
                                                            const isLastDayForResource = (dayIndex + colSpan - 1) === daysForResource.length - 1;
                                                            // 빈 셀은 내부 요일 세로줄 제거 (마지막 요일의 굵은 구분선만 유지)
                                                            const borderRightClass = isLastDayForResource
                                                                ? 'border-r-2 border-r-black'
                                                                : (bothEmpty ? '' : 'border-r border-r-black');

                                                            cells.push(
                                                                <td
                                                                    key={`${resource}-${day}-${groupId}`}
                                                                    className={`p-0 align-top border-b-2 border-b-black overflow-hidden ${borderRightClass}`}
                                                                    style={{ ...cellStyle, ...(bothEmpty ? { backgroundColor: EMPTY_CELL_BG } : {}) }}
                                                                    colSpan={colSpan > 1 ? colSpan : undefined}
                                                                >
                                                                    <div style={cellWrapperStyle(cellStyle.height)}>
                                                                    {bothEmpty ? (
                                                                        /* 빈 셀: 반명 슬롯 구조 유지 (빈 슬롯 2개 + 여백) */
                                                                        <div className="flex flex-col h-full" style={{ backgroundColor: EMPTY_CELL_BG }}>
                                                                            <div style={{ height: `${NAME_SLOT_H}px` }} className="shrink-0 border-b border-b-black" />
                                                                            <div style={{ height: `${NAME_SLOT_H}px` }} className="shrink-0 border-b border-b-black" />
                                                                            <div className="flex-1" />
                                                                        </div>
                                                                    ) : sameClass ? (
                                                                        /* 같은 수업: 반명 슬롯 2칸 합쳐서 표시 + 학생 영역 */
                                                                        <div className="flex flex-col h-full">
                                                                            <div style={{ height: `${NAME_SLOT_H * 2}px` }} className="shrink-0 flex items-center justify-center overflow-hidden border-b border-black bg-white">
                                                                                <span className="text-xs font-bold text-black leading-tight text-center px-0.5">{firstClasses[0].className}{firstClasses[0].room ? ` ${firstClasses[0].room}` : ''}</span>
                                                                            </div>
                                                                            <div className="flex-1 overflow-hidden">
                                                                                {renderCellClassCards(firstClasses, day, firstPeriodIndex, resource, colSpan, mergedDaysForCell, false)}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        /* 다른 수업 / 한쪽만 수업: 반명 슬롯 2개 + 학생 영역 */
                                                                        <div className="flex flex-col h-full">
                                                                            <div style={{ height: `${NAME_SLOT_H}px` }} className="shrink-0 flex items-center justify-center overflow-hidden border-b border-b-black bg-white">
                                                                                {firstClasses.length > 0 && (
                                                                                    <span className="text-xs font-bold text-black leading-tight text-center px-0.5">{firstClasses[0].className}</span>
                                                                                )}
                                                                            </div>
                                                                            <div style={{ height: `${NAME_SLOT_H}px` }} className="shrink-0 flex items-center justify-center overflow-hidden border-b border-black bg-white">
                                                                                {secondClasses.length > 0 && (
                                                                                    <span className="text-xs font-bold text-black leading-tight text-center px-0.5">{secondClasses[0].className}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-1 overflow-hidden">
                                                                                {firstClasses.length > 0
                                                                                    ? renderCellClassCards(firstClasses, day, firstPeriodIndex, resource, colSpan, mergedDaysForCell, false)
                                                                                    : secondClasses.length > 0
                                                                                        ? renderCellClassCards(secondClasses, day, secondPeriodIndex, resource, colSpan, mergedDaysForCell, false)
                                                                                        : null
                                                                                }
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    </div>
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
                                                        {!hidePeriodColumn && (
                                                            <td
                                                                className={`p-1.5 text-period-label font-bold text-black text-center sticky left-0 z-10 border-b-2 border-b-black border-r-2 border-r-black`}
                                                                style={{
                                                                    width: '90px',
                                                                    minWidth: '90px',
                                                                    backgroundColor: bgHex
                                                                }}
                                                            >
                                                                <div className="font-bold text-period-label text-black">{period}</div>
                                                                <div>{renderTime(periodTime)}</div>
                                                            </td>
                                                        )}
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

                                                                // 수평 병합 확인 (같은 className 세트면 요일 병합)
                                                                let shouldSkipHorizontalMerge = false;
                                                                if (!isWednesdayTable && cellClasses.length > 0 && dayIndex > 0) {
                                                                    for (let prevIdx = dayIndex - 1; prevIdx >= 0; prevIdx--) {
                                                                        const prevDay = daysForResource[prevIdx];
                                                                        const prevDayClasses = getClassesForCell(filteredClasses, prevDay, period, resource, viewType);

                                                                        if (isSameClassNameSet(cellClasses, prevDayClasses)) {
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

                                                                // 수평 병합 span 계산 (같은 className 세트 + 같은 rowSpan이면 병합)
                                                                let colSpan = 1;
                                                                const mergedDaysForCell: string[] = [day];
                                                                if (!isWednesdayTable && cellClasses.length > 0) {
                                                                    for (let nextIdx = dayIndex + 1; nextIdx < daysForResource.length; nextIdx++) {
                                                                        const nextDay = daysForResource[nextIdx];
                                                                        const nextDayClasses = getClassesForCell(filteredClasses, nextDay, period, resource, viewType);

                                                                        if (isSameClassNameSet(cellClasses, nextDayClasses)) {
                                                                            const nextRowSpan = Math.max(1, ...nextDayClasses.map((c: TimetableClass) =>
                                                                                getConsecutiveSpan(c, nextDay, periodIndex, currentPeriods, filteredClasses, viewType)
                                                                            ));
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
                                                                const borderRightClass = isLastDayForResource ? 'border-r-2 border-r-black' : 'border-r border-r-black';

                                                                cells.push(
                                                                    <td
                                                                        key={`${resource}-${day}-${period}`}
                                                                        className={`p-0 align-top border-b-2 border-b-black overflow-hidden ${borderRightClass}`}
                                                                        style={{ ...cellStyle, ...(isEmpty ? { backgroundColor: EMPTY_CELL_BG } : {}) }}
                                                                        rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                                        colSpan={colSpan > 1 ? colSpan : undefined}
                                                                    >
                                                                        <div style={cellWrapperStyle(cellStyle.height)}>
                                                                        {isEmpty ? (
                                                                            <div className="text-xxs text-gray-500 text-center py-1">
                                                                                {viewType === 'room' ? resource : '빈 강의실'}
                                                                            </div>
                                                                        ) : renderCellClassCards(cellClasses, day, periodIndex, resource, colSpan, mergedDaysForCell)}
                                                                        </div>
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
                                                {!hidePeriodColumn && (
                                                    <td
                                                        className={`p-1.5 text-period-label font-bold text-black text-center sticky left-0 z-10 border-b-2 border-b-black border-r-2 border-r-black`}
                                                        style={{
                                                            width: '90px',
                                                            minWidth: '90px',
                                                            backgroundColor: bgHex
                                                        }}
                                                    >
                                                        <div>{renderTime(periodTimeDisplay)}</div>
                                                    </td>
                                                )}
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
                                                        const borderRightClass = isLastDayForResource ? 'border-r-2 border-r-black' : 'border-r border-r-black';

                                                        cells.push(
                                                            <td
                                                                key={`${resource}-${day}-${period}`}
                                                                className={`p-0 align-top border-b-2 border-b-black overflow-hidden ${borderRightClass}`}
                                                                style={{ ...cellStyle, ...(isEmpty ? { backgroundColor: EMPTY_CELL_BG } : {}) }}
                                                                rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                                colSpan={colSpan > 1 ? colSpan : undefined}
                                                            >
                                                                <div style={cellWrapperStyle(cellStyle.height)}>
                                                                {isEmpty ? (
                                                                    <div className="text-xxs text-gray-500 text-center py-1">
                                                                        {viewType === 'room' ? resource : '빈 강의실'}
                                                                    </div>
                                                                ) : renderCellClassCards(cellClasses, day, periodIndex, resource, colSpan, mergedDaysForCell)}
                                                                </div>
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
    // orderedSelectedDays는 이미 사용자 설정 요일 순서가 반영된 상태
    const dayBasedData = useMemo(() => {
        const data: { day: string; resources: string[] }[] = [];

        orderedSelectedDays.forEach(day => {
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
    const renderDayBasedTable = (day: string, resources: string[], hidePeriodColumn?: boolean) => {
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

        // 테이블 총 폭 계산
        const periodColWidth = hidePeriodColumn ? 0 : 90;
        const totalDayTableWidth = periodColWidth + resources.length * parseInt(singleCellWidthStyle.width);

        return (
            <div key={day} className="flex-shrink-0">
                <div className="relative">
                    <table className="border-collapse border-2 border-black" style={{ tableLayout: 'fixed', width: `${totalDayTableWidth}px` }}>
                        {/* colgroup으로 각 컬럼 너비 강제 */}
                        <colgroup>
                            {!hidePeriodColumn && <col style={{ width: '90px' }} />}
                            {resources.map(resource => (
                                <col key={`col-${resource}`} style={{ width: singleCellWidthStyle.width }} />
                            ))}
                        </colgroup>
                        <thead className="sticky top-0 z-20">
                            {/* Day Header Row */}
                            <tr>
                                {!hidePeriodColumn && (
                                    <th
                                        className={`${dayColors.bg} text-white px-3 py-2 font-bold text-sm text-left sticky left-0 z-30`}
                                        style={{ width: '90px', minWidth: '90px' }}
                                    >
                                        {day}
                                        {dateInfo && <span className="ml-1 text-xs opacity-80">({dateInfo.formatted})</span>}
                                    </th>
                                )}
                                <th
                                    className={`${dayColors.bg} text-white px-3 py-2 font-bold text-sm`}
                                    colSpan={resources.length}
                                >
                                    {hidePeriodColumn && (
                                        <span className="text-left block">
                                            {day}
                                            {dateInfo && <span className="ml-1 text-xs opacity-80">({dateInfo.formatted})</span>}
                                        </span>
                                    )}
                                </th>
                            </tr>
                            {/* Teacher/Room Row */}
                            <tr>
                                {!hidePeriodColumn && (
                                    <th
                                        className={`p-1.5 text-period-label font-bold text-black border-b border-b-black border-r-2 border-r-black sticky left-0 z-30`}
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
                                )}
                                {resources.map((resource, idx) => {
                                    const teacherData = teachers.find(t => t.name === resource);
                                    const bgColor = teacherData?.bgColor || '#3b82f6';
                                    const textColor = teacherData?.textColor || '#ffffff';
                                    const isLast = idx === resources.length - 1;
                                    // 모든 선생님 사이에 세로 구분선 추가
                                    const borderRightClass = isLast ? 'border-r-2 border-r-black' : 'border-r border-r-black';

                                    return (
                                        <th
                                            key={resource}
                                            className={`p-1.5 text-sm font-bold border-b-2 border-b-black truncate ${borderRightClass}`}
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
                        <tbody className="timetable-body">
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

                                        // 두 교시 모두 있으면 1행으로 합쳐서 표시
                                        if (hasFirst && hasSecond) {
                                            processedPeriods.add(firstPeriod);
                                            processedPeriods.add(secondPeriod);

                                            const firstPeriodIndex = currentPeriods.indexOf(firstPeriod);
                                            const secondPeriodIndex = currentPeriods.indexOf(secondPeriod);

                                            rows.push(
                                                <tr key={`group-${groupId}`}>
                                                    {!hidePeriodColumn && (
                                                        <td
                                                            className={`p-1.5 text-period-label font-bold text-black text-center sticky left-0 z-10 border-b-2 border-b-black border-r-2 border-r-black`}
                                                            style={{
                                                                width: '90px',
                                                                minWidth: '90px',
                                                                backgroundColor: bgHex
                                                            }}
                                                        >
                                                            <div className="font-bold text-period-label text-black">{groupInfo.label}</div>
                                                            <div>{renderTime(groupInfo.time)}</div>
                                                        </td>
                                                    )}
                                                    {resources.map((resource, resourceIdx) => {
                                                        const firstClasses = getClassesForCell(filteredClasses, day, firstPeriod, resource, viewType);
                                                        const secondClasses = getClassesForCell(filteredClasses, day, secondPeriod, resource, viewType);

                                                        const doubleHeightValue = isCompactMode
                                                            ? ((firstClasses.length > 0 || secondClasses.length > 0) ? 90 : undefined)
                                                            : (rowHeightValue as number) * 2;
                                                        const cellStyle = {
                                                            ...singleCellWidthStyle,
                                                            height: doubleHeightValue ? `${doubleHeightValue}px` : undefined
                                                        };

                                                        const bothEmpty = firstClasses.length === 0 && secondClasses.length === 0;
                                                        const sameClass = firstClasses.length > 0 && secondClasses.length > 0 && isSameClassNameSet(firstClasses, secondClasses);
                                                        const isLastResource = resourceIdx === resources.length - 1;
                                                        // 빈 셀은 내부 세로줄 제거
                                                        const borderRightClass = isLastResource
                                                            ? 'border-r-2 border-r-black'
                                                            : (bothEmpty ? '' : 'border-r border-r-black');

                                                        const renderDayBasedClassCards = (classes: TimetableClass[], periodIndex: number, overrideShowClassName?: boolean) => (
                                                            classes.map((cls: TimetableClass) => (
                                                                <ClassCard
                                                                    key={cls.id}
                                                                    cls={cls}
                                                                    span={1}
                                                                    searchQuery={searchQuery}
                                                                    showStudents={showStudents}
                                                                    showClassName={overrideShowClassName !== undefined ? overrideShowClassName : showClassName}
                                                                    showSchool={showSchool}
                                                                    showGrade={showGrade}
                                                                    canEdit={getCanEdit(cls, resource)}
                                                                    isAssistantTeacher={isAssistantSlot(cls, resource)}
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
                                                                    cellSizePx={cellSizePx}
                                                                    showHoldStudents={showHoldStudents}
                                                                    showWithdrawnStudents={showWithdrawnStudents}
                                                                    pendingMovedStudentIds={pendingMovedStudentIds}
                                                                    pendingMoveSchedules={pendingMoveSchedules}
                                                                    latestTextbook={getLatestTextbook(cls)}
                                                                    latestReports={latestReports}
                                                                    studentTextbookMap={byStudentName}
                                                                    referenceDate={referenceDate}
                                                                    isExcelMode={isExcelMode}
                                                                    isSelected={selectedClassId === cls.id}
                                                                    onCellSelect={onCellSelect}
                                                                    onEnrollStudent={onEnrollStudent}
                                                                    onCancelPendingEnroll={onCancelPendingEnroll}
                                                                    selectedStudentIds={selectedStudentIds}
                                                                    selectedStudentClassName={selectedStudentClassName}
                                                                    copiedStudentIds={copiedStudentIds}
                                                                    copiedStudentClassName={copiedStudentClassName}
                                                                    cutStudentIds={cutStudentIds}
                                                                    cutStudentClassName={cutStudentClassName}
                                                                    acHighlightStudentId={acHighlightStudentId}
                                                                    onAcHighlightChange={onAcHighlightChange}
                                                                    onStudentSelect={onStudentSelect}
                                                                    onStudentMultiSelect={onStudentMultiSelect}
                                                                    mode={mode}
                                                                    onCancelScheduledEnrollment={onCancelScheduledEnrollment}
                                                                    onWithdrawalDrop={onWithdrawalDrop}
                                                                    pendingExcelDeleteIds={pendingExcelDeleteIds}
                                                                    pendingExcelEnrollments={pendingExcelEnrollments}
                                                                />
                                                            ))
                                                        );

                                                        return (
                                                            <td
                                                                key={`${resource}-${groupId}`}
                                                                className={`p-0 align-top border-b-2 border-b-black overflow-hidden ${borderRightClass}`}
                                                                style={{ ...cellStyle, ...(bothEmpty ? { backgroundColor: EMPTY_CELL_BG } : {}) }}
                                                            >
                                                                <div style={cellWrapperStyle(cellStyle.height)}>
                                                                {bothEmpty ? (
                                                                    /* 빈 셀: 반명 슬롯 구조 유지 */
                                                                    <div className="flex flex-col h-full" style={{ backgroundColor: EMPTY_CELL_BG }}>
                                                                        <div style={{ height: `${NAME_SLOT_H}px` }} className="shrink-0 border-b border-b-black" />
                                                                        <div style={{ height: `${NAME_SLOT_H}px` }} className="shrink-0 border-b border-b-black" />
                                                                        <div className="flex-1" />
                                                                    </div>
                                                                ) : sameClass ? (
                                                                    /* 같은 수업: 반명 슬롯 2칸 합쳐서 표시 + 학생 영역 */
                                                                    <div className="flex flex-col h-full">
                                                                        <div style={{ height: `${NAME_SLOT_H * 2}px` }} className="shrink-0 flex items-center justify-center overflow-hidden border-b border-black bg-white">
                                                                            <span className="text-xs font-bold text-black leading-tight text-center px-0.5">{firstClasses[0].className}{firstClasses[0].room ? ` ${firstClasses[0].room}` : ''}</span>
                                                                        </div>
                                                                        <div className="flex-1 overflow-hidden">
                                                                            {renderDayBasedClassCards(firstClasses, firstPeriodIndex, false)}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* 다른 수업 / 한쪽만 수업: 반명 슬롯 2개 + 학생 영역 */
                                                                    <div className="flex flex-col h-full">
                                                                        <div style={{ height: `${NAME_SLOT_H}px` }} className="shrink-0 flex items-center justify-center overflow-hidden border-b border-b-black bg-white">
                                                                            {firstClasses.length > 0 && (
                                                                                <span className="text-xs font-bold text-black leading-tight text-center px-0.5">{firstClasses[0].className}</span>
                                                                            )}
                                                                        </div>
                                                                        <div style={{ height: `${NAME_SLOT_H}px` }} className="shrink-0 flex items-center justify-center overflow-hidden border-b border-black bg-white">
                                                                            {secondClasses.length > 0 && (
                                                                                <span className="text-xs font-bold text-black leading-tight text-center px-0.5">{secondClasses[0].className}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1 overflow-hidden">
                                                                            {firstClasses.length > 0
                                                                                ? renderDayBasedClassCards(firstClasses, firstPeriodIndex, false)
                                                                                : secondClasses.length > 0
                                                                                    ? renderDayBasedClassCards(secondClasses, secondPeriodIndex, false)
                                                                                    : null
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                </div>
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
                                                        {!hidePeriodColumn && (
                                                            <td
                                                                className={`p-1.5 text-period-label font-bold text-black text-center sticky left-0 z-10 border-b-2 border-b-black border-r-2 border-r-black`}
                                                                style={{
                                                                    width: '90px',
                                                                    minWidth: '90px',
                                                                    backgroundColor: bgHex
                                                                }}
                                                            >
                                                                <div className="font-bold text-period-label text-black">{period}</div>
                                                                <div>{renderTime(periodTime)}</div>
                                                            </td>
                                                        )}
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
                                                            const borderRightClass = isLastResource ? 'border-r-2 border-r-black' : 'border-r border-r-black';

                                                            return (
                                                                <td
                                                                    key={`${resource}-${period}`}
                                                                    className={`p-0 align-top border-b-2 border-b-black overflow-hidden ${borderRightClass}`}
                                                                    style={{ ...cellStyle, ...(isEmpty ? { backgroundColor: EMPTY_CELL_BG } : {}) }}
                                                                    rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                                >
                                                                    <div style={cellWrapperStyle(cellStyle.height)}>
                                                                    {isEmpty ? (
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
                                                                                canEdit={getCanEdit(cls, resource)}
                                                                                isAssistantTeacher={isAssistantSlot(cls, resource)}
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
                                                                                cellSizePx={cellSizePx}
                                                                                showHoldStudents={showHoldStudents}
                                                                                showWithdrawnStudents={showWithdrawnStudents}
                                                                                pendingMovedStudentIds={pendingMovedStudentIds}
                                                                                pendingMoveSchedules={pendingMoveSchedules}
                                                                                latestTextbook={getLatestTextbook(cls)}
                    latestReports={latestReports}
                    studentTextbookMap={byStudentName}
                                                                                isExcelMode={isExcelMode}
                                                                                isSelected={selectedClassId === cls.id}
                                                                                onCellSelect={onCellSelect}
                                                                                onEnrollStudent={onEnrollStudent}
                                    onCancelPendingEnroll={onCancelPendingEnroll}
                                                                                selectedStudentIds={selectedStudentIds}
                                                                                selectedStudentClassName={selectedStudentClassName}
                                                                                copiedStudentIds={copiedStudentIds}
                                                                                copiedStudentClassName={copiedStudentClassName}
                                                                                cutStudentIds={cutStudentIds}
                                                                                cutStudentClassName={cutStudentClassName}
                                                                                acHighlightStudentId={acHighlightStudentId}
                                                                                onAcHighlightChange={onAcHighlightChange}
                                                                                onStudentSelect={onStudentSelect}
                                                                                onStudentMultiSelect={onStudentMultiSelect}
                                                                                mode={mode}
                                                                            onCancelScheduledEnrollment={onCancelScheduledEnrollment}
                    onWithdrawalDrop={onWithdrawalDrop}
                    pendingExcelDeleteIds={pendingExcelDeleteIds}
                    pendingExcelEnrollments={pendingExcelEnrollments}
                                                                            />
                                                                        ))
                                                                    )}
                                                                    </div>
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
                                                {!hidePeriodColumn && (
                                                    <td
                                                        className={`p-1.5 text-period-label font-bold text-black text-center sticky left-0 z-10 border-b-2 border-b-black border-r-2 border-r-black`}
                                                        style={{
                                                            width: '90px',
                                                            minWidth: '90px',
                                                            backgroundColor: bgHex
                                                        }}
                                                    >
                                                        <div>{renderTime(periodTimeDisplay)}</div>
                                                    </td>
                                                )}
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
                                                    const borderRightClass = isLastResource ? 'border-r-2 border-r-black' : 'border-r border-r-black';

                                                    return (
                                                        <td
                                                            key={`${resource}-${period}`}
                                                            className={`p-0 align-top border-b-2 border-b-black overflow-hidden ${borderRightClass}`}
                                                            style={{ ...cellStyle, ...(isEmpty ? { backgroundColor: EMPTY_CELL_BG } : {}) }}
                                                            rowSpan={maxRowSpan > 1 ? maxRowSpan : undefined}
                                                        >
                                                            <div style={cellWrapperStyle(cellStyle.height)}>
                                                            {isEmpty ? (
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
                                                                        canEdit={getCanEdit(cls, resource)}
                                                                        isAssistantTeacher={isAssistantSlot(cls, resource)}
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
                                                                                cellSizePx={cellSizePx}
                                                                        showHoldStudents={showHoldStudents}
                                                                        showWithdrawnStudents={showWithdrawnStudents}
                                                                        pendingMovedStudentIds={pendingMovedStudentIds}
                                                                        pendingMoveSchedules={pendingMoveSchedules}
                                                                        latestTextbook={getLatestTextbook(cls)}
                    latestReports={latestReports}
                    studentTextbookMap={byStudentName}
                                                                        isExcelMode={isExcelMode}
                                                                        isSelected={selectedClassId === cls.id}
                                                                        onCellSelect={onCellSelect}
                                                                        onEnrollStudent={onEnrollStudent}
                                    onCancelPendingEnroll={onCancelPendingEnroll}
                                                                        selectedStudentIds={selectedStudentIds}
                                                                        selectedStudentClassName={selectedStudentClassName}
                                                                        copiedStudentIds={copiedStudentIds}
                                                                        copiedStudentClassName={copiedStudentClassName}
                                                                        cutStudentIds={cutStudentIds}
                                                                        cutStudentClassName={cutStudentClassName}
                                                                        acHighlightStudentId={acHighlightStudentId}
                                                                        onAcHighlightChange={onAcHighlightChange}
                                                                        onStudentSelect={onStudentSelect}
                                                                        onStudentMultiSelect={onStudentMultiSelect}
                                                                        mode={mode}
                                                                    onCancelScheduledEnrollment={onCancelScheduledEnrollment}
                    onWithdrawalDrop={onWithdrawalDrop}
                    pendingExcelDeleteIds={pendingExcelDeleteIds}
                    pendingExcelEnrollments={pendingExcelEnrollments}
                                                                    />
                                                                ))
                                                            )}
                                                            </div>
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
                <div className="flex gap-0">
                    {dayBasedData.map(({ day, resources }) =>
                        renderDayBasedTable(day, resources, false)
                    )}
                </div>
            </div>
        );
    }

    // teacher-based 뷰 (그룹 순서 적용)
    const groupConfigs: Record<string, { resources: string[]; daysMap: Map<string, string[]>; isWednesday?: boolean; hasData: boolean }> = {
        '월/목': { resources: monThuActiveResources, daysMap: monThuResourceDaysMap, hasData: monThuActiveResources.length > 0 },
        '화/금': { resources: tueFriActiveResources, daysMap: tueFriResourceDaysMap, hasData: tueFriActiveResources.length > 0 },
        '주말': { resources: weekendActiveResources, daysMap: weekendResourceDaysMap, hasData: weekendActiveResources.length > 0 },
        '수요일': { resources: wednesdayResources, daysMap: wednesdayResourceDaysMap, isWednesday: true, hasData: hasWednesday && wednesdayResources.length > 0 },
    };

    const baseOrder = (weekdayGroupOrder && weekdayGroupOrder.length > 0)
        ? weekdayGroupOrder.filter(g => groupConfigs[g])
        : ['월/목', '화/금', '주말', '수요일'];

    // 주말만 항상 맨 끝 고정
    const nonWeekendGroups = baseOrder.filter(g => g !== '주말');
    const orderedGroups = [...nonWeekendGroups, ...baseOrder.filter(g => g === '주말')];

    const activeGroups = orderedGroups.filter(g => groupConfigs[g]?.hasData);

    // 평일 그룹 (교시 공유)과 주말 그룹 분리
    const weekdayActiveGroups = activeGroups.filter(g => g !== '주말');
    const weekendGroup = activeGroups.find(g => g === '주말');

    // 평일 교시 전용 테이블 렌더링
    const renderPeriodColumn = () => {
        // 배경색
        const bgHex = '#f3f4f6';

        return (
            <div className="flex-shrink-0 sticky left-0 z-30">
                <table className="border-collapse border-2 border-black" style={{ tableLayout: 'fixed', width: '90px' }}>
                    <colgroup>
                        <col style={{ width: '90px' }} />
                    </colgroup>
                    <thead className="sticky top-0 z-20">
                        {/* 빈 타이틀 행 (다른 테이블의 그룹 타이틀 행과 높이 맞춤) */}
                        <tr>
                            <th className="bg-gray-700 text-white px-3 py-2 font-bold text-sm text-left" style={{ width: '90px', minWidth: '90px' }}>
                                &nbsp;
                            </th>
                        </tr>
                        {/* 교시 헤더 — 선생님 행 + 날짜 행을 rowSpan=2로 통합 */}
                        <tr>
                            <th
                                className="p-1.5 text-period-label font-bold text-black border-b-2 border-b-black"
                                rowSpan={2}
                                style={{ width: '90px', minWidth: '90px', backgroundColor: bgHex }}
                            >
                                교시
                            </th>
                        </tr>
                        <tr>{/* rowSpan으로 병합됨 — 빈 행 */}</tr>
                    </thead>
                    <tbody className="timetable-body">
                        {(() => {
                            const rows: React.ReactNode[] = [];
                            const processedPeriods = new Set<string>();

                            MATH_GROUPED_PERIODS.forEach(groupId => {
                                const periodIds = MATH_GROUP_PERIOD_IDS[groupId];
                                const [firstPeriod, secondPeriod] = periodIds;
                                const hasFirst = currentPeriods.includes(firstPeriod);
                                const hasSecond = currentPeriods.includes(secondPeriod);

                                if (!hasFirst && !hasSecond) return;

                                const groupInfo = MATH_GROUP_DISPLAY[groupId];

                                if (hasFirst && hasSecond) {
                                    processedPeriods.add(firstPeriod);
                                    processedPeriods.add(secondPeriod);

                                    const doubleHeightValue = isCompactMode ? 90 : (rowHeightValue as number) * 2;
                                    rows.push(
                                        <tr key={`period-col-group-${groupId}`}>
                                            <td
                                                className="p-1.5 text-period-label font-bold text-black text-center border-b-2 border-b-black"
                                                style={{ width: '90px', minWidth: '90px', height: `${doubleHeightValue}px`, backgroundColor: bgHex }}
                                            >
                                                <div className="font-bold text-period-label text-black">{groupInfo.label}</div>
                                                <div>{renderTime(groupInfo.time)}</div>
                                            </td>
                                        </tr>
                                    );
                                } else {
                                    periodIds.forEach(period => {
                                        if (!currentPeriods.includes(period) || processedPeriods.has(period)) return;
                                        processedPeriods.add(period);
                                        const periodTime = MATH_PERIOD_TIMES[period] || period;
                                        const heightValue = isCompactMode ? 45 : rowHeightValue;
                                        rows.push(
                                            <tr key={`period-col-${period}`}>
                                                <td
                                                    className="p-1.5 text-period-label font-bold text-black text-center border-b-2 border-b-black"
                                                    style={{ width: '90px', minWidth: '90px', height: `${heightValue}px`, backgroundColor: bgHex }}
                                                >
                                                    <div className="font-bold text-period-label text-black">{period}</div>
                                                    <div>{renderTime(periodTime)}</div>
                                                </td>
                                            </tr>
                                        );
                                    });
                                }
                            });

                            return rows;
                        })()}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="overflow-auto h-full">
            <div className="flex gap-0">
                {/* 평일: 좌측 교시 컬럼 1개 공유 */}
                {weekdayActiveGroups.length > 0 && renderPeriodColumn()}
                {weekdayActiveGroups.map((groupName) => {
                    const config = groupConfigs[groupName];
                    return (
                        <React.Fragment key={groupName}>
                            {renderTable(config.resources, config.daysMap, groupName, config.isWednesday, true)}
                        </React.Fragment>
                    );
                })}
                {/* 주말: 자체 교시 컬럼 포함 */}
                {weekendGroup && (() => {
                    const config = groupConfigs[weekendGroup];
                    return renderTable(config.resources, config.daysMap, weekendGroup, config.isWednesday, false);
                })()}
            </div>
        </div>
    );
};

// React.memo로 불필요한 리렌더링 방지 (부모 리렌더 시 props 변경 없으면 스킵)
export default React.memo(TimetableGrid);
