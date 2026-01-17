import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TimetableClass, ClassKeywordColor, Teacher } from '../../../../types';
import { getSubjectTheme } from '../utils/gridUtils';
import { Clock } from 'lucide-react';
import { MATH_PERIOD_INFO, MATH_PERIOD_TIMES, WEEKEND_PERIOD_INFO, WEEKEND_PERIOD_TIMES } from '../../constants';
import { formatSchoolGrade } from '../../../../utils/studentUtils';

interface ClassCardProps {
    cls: TimetableClass;
    span: number;
    searchQuery: string;
    showStudents: boolean;
    showClassName: boolean;
    showSchool: boolean;
    showGrade: boolean;
    canEdit: boolean;
    dragOverClassId: string | null;
    onClick: (cls: TimetableClass) => void;
    onDragStart: (e: React.DragEvent, studentId: string, fromClassId: string) => void;
    onDragOver: (e: React.DragEvent, classId: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, toClassId: string) => void;
    studentMap: Record<string, any>;
    classKeywords?: ClassKeywordColor[];
    onStudentClick?: (studentId: string) => void;
    currentDay?: string;
    mergedDays?: string[];
    teachers?: Teacher[];
    fontSize?: 'small' | 'normal' | 'large' | 'very-large';  // 글자 크기 설정
    rowHeight?: 'compact' | 'short' | 'normal' | 'tall' | 'very-tall';  // 세로 높이 설정
    showHoldStudents?: boolean;  // 대기 학생 표시 여부
    showWithdrawnStudents?: boolean;  // 퇴원 학생 표시 여부
}

const ClassCard: React.FC<ClassCardProps> = ({
    cls,
    span,
    searchQuery,
    showStudents,
    showClassName,
    showSchool,
    showGrade,
    canEdit,
    dragOverClassId,
    onClick,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    studentMap,
    classKeywords = [],
    onStudentClick,
    currentDay,
    mergedDays = [],
    fontSize = 'normal',
    rowHeight = 'normal',
    showHoldStudents = true,
    showWithdrawnStudents = true
}) => {
    // 컴팩트 모드 여부
    const isCompact = rowHeight === 'compact';
    // 글자 크기 CSS 클래스 매핑
    const fontSizeClass = {
        'small': 'text-[9px]',
        'normal': 'text-[10px]',
        'large': 'text-[11px]',
        'very-large': 'text-xs'
    }[fontSize];

    const titleFontSizeClass = {
        'small': 'text-[10px]',
        'normal': 'text-xs',
        'large': 'text-sm',
        'very-large': 'text-base'
    }[fontSize];
    const theme = getSubjectTheme(cls.subject);
    const [showScheduleTooltip, setShowScheduleTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const headerRef = useRef<HTMLDivElement>(null);

    // 툴팁 위치 업데이트
    useEffect(() => {
        if (showScheduleTooltip && headerRef.current) {
            const rect = headerRef.current.getBoundingClientRect();
            const tooltipWidth = 160; // 대략적인 툴팁 너비
            const viewportWidth = window.innerWidth;

            // 기본 위치: 요소 중앙 하단
            let x = rect.left + rect.width / 2 - tooltipWidth / 2;
            const y = rect.bottom + 4;

            // 왼쪽 경계 체크
            if (x < 8) x = 8;
            // 오른쪽 경계 체크
            if (x + tooltipWidth > viewportWidth - 8) {
                x = viewportWidth - tooltipWidth - 8;
            }

            setTooltipPosition({ x, y });
        }
    }, [showScheduleTooltip]);

    // 수업 스케줄 정보 생성 (마우스 오버 툴팁용)
    const scheduleInfo = useMemo(() => {
        if (!cls.schedule || cls.schedule.length === 0) return [];

        const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
        const scheduleByDay: Record<string, { periods: string[]; times: string[] }> = {};

        // schedule 배열에서 요일별 교시와 시간 정보 추출
        // schedule 형식: ["월 1-1", "목 1-2"] 또는 ["월 1", "목 2"]
        cls.schedule.forEach(item => {
            const parts = item.split(' ');
            if (parts.length < 2) return;

            const day = parts[0];
            const periodId = parts[1];

            if (!scheduleByDay[day]) {
                scheduleByDay[day] = { periods: [], times: [] };
            }

            const isWeekend = day === '토' || day === '일';

            // 레거시 형식(1-1, 1-2) 또는 통일된 형식(1, 2) 모두 지원
            let timeStr = '';
            if (isWeekend) {
                timeStr = WEEKEND_PERIOD_TIMES[periodId] || WEEKEND_PERIOD_INFO[periodId]?.time || '';
            } else {
                timeStr = MATH_PERIOD_TIMES[periodId] || MATH_PERIOD_INFO[periodId]?.time || '';
            }
            if (!timeStr) return;

            if (!scheduleByDay[day].periods.includes(periodId)) {
                scheduleByDay[day].periods.push(periodId);
                scheduleByDay[day].times.push(timeStr);
            }
        });

        // 요일 순서대로 정렬하여 반환
        const sortedDays = Object.keys(scheduleByDay).sort(
            (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
        );

        return sortedDays.map(day => {
            const info = scheduleByDay[day];
            const validTimes = info.times.filter(t => t && t.includes('~'));
            if (validTimes.length === 0) return { day, timeRange: '시간 미정' };

            // 시간 순서대로 정렬
            const sortedIndices = info.periods
                .map((p, i) => ({ period: p, index: i }))
                .filter(item => info.times[item.index] && info.times[item.index].includes('~'))
                .sort((a, b) => {
                    const timeA = info.times[a.index].split('~')[0];
                    const timeB = info.times[b.index].split('~')[0];
                    return timeA.localeCompare(timeB);
                });

            if (sortedIndices.length === 0) return { day, timeRange: '시간 미정' };

            const sortedTimes = sortedIndices.map(item => info.times[item.index]);
            const firstTime = sortedTimes[0];
            const lastTime = sortedTimes[sortedTimes.length - 1];

            const startTime = firstTime.split('~')[0];
            const endTime = lastTime.split('~')[1];

            const timeRange = sortedTimes.length > 1
                ? `${startTime}~${endTime}`
                : firstTime;

            return { day, timeRange };
        }).filter(item => item.timeRange !== '시간 미정');
    }, [cls.schedule]);

    // 키워드 매칭으로 색상 결정
    const matchedKeyword = useMemo(() => {
        return classKeywords.find(kw => cls.className?.includes(kw.keyword));
    }, [cls.className, classKeywords]);
    const hasSearchMatch = searchQuery && cls.studentList?.some(s => s.name.includes(searchQuery));

    // 학생이 특정 요일에 등원하는지 확인
    const isStudentAttendingDay = (student: any, day: string): boolean => {
        const attendanceDays = student.attendanceDays;
        if (!attendanceDays || attendanceDays.length === 0) return true;  // 설정 없으면 모든 요일 등원
        return attendanceDays.includes(day);
    };

    // 병합 셀 여부 확인
    const isMergedCell = mergedDays.length > 1;

    // 전체 학생 목록 가져오기
    const allStudents = useMemo(() => {
        if (cls.studentList && cls.studentList.length > 0) {
            return [...cls.studentList];
        } else if (cls.studentIds && cls.studentIds.length > 0) {
            return cls.studentIds.map(id => studentMap[id]).filter(Boolean);
        }
        return [];
    }, [cls.studentList, cls.studentIds, studentMap]);

    // 학생이 병합된 모든 요일에 등원하는지 확인
    const isStudentAttendingAllMergedDays = (student: any): boolean => {
        const attendanceDays = student.attendanceDays;
        if (!attendanceDays || attendanceDays.length === 0) return true;  // 설정 없으면 모든 요일 등원
        return mergedDays.every(day => attendanceDays.includes(day));
    };

    // 병합 셀: 공통 학생 + 요일별 학생 분류
    // - 모든 병합 요일에 등원하는 학생: 한 번만 표시 (commonStudents)
    // - 특정 요일만 등원하는 학생: 해당 요일에만 표시 (partialStudentsByDay)
    const { commonStudents, partialStudentsByDay } = useMemo(() => {
        if (!isMergedCell) {
            return { commonStudents: { active: [], hold: [], withdrawn: [] }, partialStudentsByDay: null };
        }

        // 모든 병합 요일에 등원하는 학생 (공통)
        const commonActive = allStudents
            .filter(s => !s.withdrawalDate && !s.onHold && isStudentAttendingAllMergedDays(s))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        const commonHold = allStudents
            .filter(s => s.onHold && !s.withdrawalDate && isStudentAttendingAllMergedDays(s))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        const commonWithdrawn = allStudents
            .filter(s => s.withdrawalDate && isStudentAttendingAllMergedDays(s))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        // 요일별 부분 등원 학생 (특정 요일만 오는 학생)
        const partial: Record<string, { active: any[]; hold: any[]; withdrawn: any[] }> = {};
        mergedDays.forEach(day => {
            const active = allStudents
                .filter(s => !s.withdrawalDate && !s.onHold && !isStudentAttendingAllMergedDays(s) && isStudentAttendingDay(s, day))
                .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            const hold = allStudents
                .filter(s => s.onHold && !s.withdrawalDate && !isStudentAttendingAllMergedDays(s) && isStudentAttendingDay(s, day))
                .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            const withdrawn = allStudents
                .filter(s => s.withdrawalDate && !isStudentAttendingAllMergedDays(s) && isStudentAttendingDay(s, day))
                .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            partial[day] = { active, hold, withdrawn };
        });

        return {
            commonStudents: { active: commonActive, hold: commonHold, withdrawn: commonWithdrawn },
            partialStudentsByDay: partial
        };
    }, [isMergedCell, mergedDays, allStudents]);

    // 단일 셀: 해당 요일에 등원하는 학생만 (기존 로직)
    const { activeStudents, holdStudents, withdrawnStudents } = useMemo(() => {
        if (isMergedCell) {
            // 병합 셀에서는 사용하지 않음
            return { activeStudents: [], holdStudents: [], withdrawnStudents: [] };
        }

        const filterDay = currentDay || '';

        const active = allStudents
            .filter(s => !s.withdrawalDate && !s.onHold && (filterDay ? isStudentAttendingDay(s, filterDay) : true))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        const hold = allStudents
            .filter(s => s.onHold && !s.withdrawalDate && (filterDay ? isStudentAttendingDay(s, filterDay) : true))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        const withdrawn = allStudents
            .filter(s => s.withdrawalDate && (filterDay ? isStudentAttendingDay(s, filterDay) : true))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        return { activeStudents: active, holdStudents: hold, withdrawnStudents: withdrawn };
    }, [isMergedCell, allStudents, currentDay]);

    // 병합 셀에서 부분 등원 학생이 있는지 확인
    const hasPartialStudents = isMergedCell && partialStudentsByDay &&
        mergedDays.some(day => partialStudentsByDay[day]?.active.length > 0);

    // 교시 수(span)에 따른 재원생 최대 높이 계산
    // 1교시당 4명 기준 (1명당 약 21px)
    const maxStudentHeight = span * 4 * 21; // span * 4명 * 21px

    // 카드 전체 배경색 스타일 (키워드 색상 또는 흰색)
    const cardBgStyle = matchedKeyword
        ? { backgroundColor: matchedKeyword.bgColor }
        : { backgroundColor: '#ffffff' };

    return (
        <div
            onClick={() => canEdit && onClick(cls)}
            onDragOver={(e) => canEdit && onDragOver(e, cls.id)}
            onDragLeave={canEdit ? onDragLeave : undefined}
            onDrop={(e) => canEdit && onDrop(e, cls.id)}
            className={`flex flex-col h-full overflow-hidden transition-all hover:brightness-95 ${dragOverClassId === cls.id ? 'ring-2 ring-indigo-400 scale-[1.02]' : (canEdit ? 'cursor-pointer' : '')} ${hasSearchMatch ? 'ring-2 ring-yellow-400' : ''}`}
            style={cardBgStyle}
        >
            {/* Class Name Header - 키워드 색상 적용, 마우스 오버시 스케줄 툴팁 */}
            {showClassName && (
                <div
                    ref={headerRef}
                    className={`text-center font-bold py-1 px-1 ${titleFontSizeClass} cursor-help ${showStudents ? 'border-b border-gray-300' : 'flex-1 flex flex-col justify-center'}`}
                    style={matchedKeyword
                        ? { color: matchedKeyword.textColor }
                        : { color: '#1f2937' }
                    }
                    onMouseEnter={() => setShowScheduleTooltip(true)}
                    onMouseLeave={() => setShowScheduleTooltip(false)}
                >
                    <div>{cls.className}</div>
                    {/* 강의실 + 재원생 수 (학생 목록 숨김 시) */}
                    {(cls.room || !showStudents) && (
                        <div className={`${fontSizeClass} font-normal text-gray-500 mt-0.5`}>
                            {cls.room}
                            {!showStudents && (
                                <>
                                    {cls.room && ' · '}
                                    {isMergedCell ? (
                                        // 병합 셀: 요일별 인원 표시 (예: 월3 목4)
                                        <span className="text-indigo-600 font-bold">
                                            {mergedDays.map((day, idx) => {
                                                const dayCount = commonStudents.active.length +
                                                    (partialStudentsByDay?.[day]?.active.length || 0);
                                                return (
                                                    <span key={day}>
                                                        {idx > 0 && ' '}
                                                        {day}{dayCount}
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    ) : (
                                        // 단일 셀: 총 인원만 표시
                                        <span className="text-indigo-600 font-bold">{activeStudents.length}명</span>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Schedule Tooltip - Portal을 사용하여 DOM 최상위에 렌더링 */}
                    {showScheduleTooltip && scheduleInfo.length > 0 && createPortal(
                        <div
                            className="fixed bg-gray-900 text-white text-xs rounded-lg shadow-xl p-2 min-w-[140px] whitespace-nowrap pointer-events-none"
                            style={{
                                left: tooltipPosition.x,
                                top: tooltipPosition.y,
                                zIndex: 9999
                            }}
                        >
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-gray-700">
                                <Clock size={12} className="text-yellow-400" />
                                <span className="font-bold">수업 시간</span>
                            </div>
                            <div className="space-y-1">
                                {scheduleInfo.map(({ day, timeRange }) => (
                                    <div key={day} className="flex justify-between gap-3">
                                        <span className={`font-bold ${day === '토' || day === '일' ? 'text-red-400' : 'text-blue-300'}`}>
                                            {day}
                                        </span>
                                        <span className="text-gray-200">{timeRange}</span>
                                    </div>
                                ))}
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
            )}

            {/* Student List */}
            {showStudents && (
                isMergedCell ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-1 py-0">
                            <div className={`${fontSizeClass} font-bold text-indigo-600 mb-0`}>({commonStudents.active.length})</div>
                            <ul className="flex flex-col gap-0">
                                {commonStudents.active.map(s => {
                                    const isHighlighted = searchQuery && s.name.includes(searchQuery);
                                    let displayText = s.name;
                                    if (showSchool || showGrade) {
                                        const schoolGrade = formatSchoolGrade(
                                            showSchool ? s.school : null,
                                            showGrade ? s.grade : null
                                        );
                                        if (schoolGrade && schoolGrade !== '-') displayText += `/${schoolGrade}`;
                                    }
                                    return (
                                        <li
                                            key={s.id}
                                            draggable={canEdit}
                                            onDragStart={(e) => canEdit && onDragStart(e, s.id, cls.id)}
                                            onClick={(e) => {
                                                if (onStudentClick && !canEdit) {
                                                    e.stopPropagation();
                                                    onStudentClick(s.id);
                                                }
                                            }}
                                            className={`py-0 px-0.5 ${fontSizeClass} leading-[1.3] truncate font-medium
                                            ${canEdit ? 'cursor-grab hover:bg-white/80' : onStudentClick ? 'cursor-pointer hover:bg-white/80' : ''}
                                            ${isHighlighted ? 'bg-yellow-300 font-bold text-black' : theme.text}`}
                                        >
                                            {displayText}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        {/* Spacer - 대기/퇴원을 하단으로 밀기 */}
                        <div className="flex-1"></div>

                        {/* 부분 등원 학생 (월만, 목만 등) */}
                        {hasPartialStudents && (() => {
                            // 각 요일의 학생 수 중 최대값 계산
                            const maxStudentCount = Math.max(
                                ...mergedDays.map(day => partialStudentsByDay?.[day]?.active.length || 0)
                            );

                            return (
                                <div className="flex-shrink-0 flex border-t-2 border-amber-300 bg-white">
                                    {mergedDays.map((day, idx) => {
                                        const isLastDay = idx === mergedDays.length - 1;
                                        const dayStudents = partialStudentsByDay?.[day];
                                        const dayActiveStudents = dayStudents?.active || [];
                                        const emptySlots = maxStudentCount - dayActiveStudents.length;

                                        return (
                                            <div key={day} className={`flex-1 flex flex-col ${!isLastDay ? 'border-r-2 border-amber-300' : ''}`}>
                                                <div className="text-center text-[11px] font-bold bg-amber-100 text-amber-800 py-0.5 border-b-2 border-amber-300">
                                                    {day}만 ({dayActiveStudents.length})
                                                </div>
                                                <div className="px-0.5 py-0 bg-amber-50 flex-1">
                                                    <ul className="flex flex-col gap-0">
                                                        {dayActiveStudents.map(s => {
                                                            const isHighlighted = searchQuery && s.name.includes(searchQuery);
                                                            let displayText = s.name;
                                                            if (showSchool || showGrade) {
                                                                const schoolGrade = formatSchoolGrade(
                                                                    showSchool ? s.school : null,
                                                                    showGrade ? s.grade : null
                                                                );
                                                                if (schoolGrade && schoolGrade !== '-') displayText += `/${schoolGrade}`;
                                                            }
                                                            return (
                                                                <li
                                                                    key={s.id}
                                                                    draggable={canEdit}
                                                                    onDragStart={(e) => canEdit && onDragStart(e, s.id, cls.id)}
                                                                    onClick={(e) => {
                                                                        if (onStudentClick && !canEdit) {
                                                                            e.stopPropagation();
                                                                            onStudentClick(s.id);
                                                                        }
                                                                    }}
                                                                    className={`py-0 px-1 ${fontSizeClass} leading-[1.3] truncate
                                                                    ${canEdit ? 'cursor-grab hover:bg-white/80' : onStudentClick ? 'cursor-pointer hover:bg-white/80' : ''}
                                                                    ${isHighlighted ? 'bg-yellow-300 font-bold text-black' : 'text-amber-900 font-medium'}`}
                                                                >
                                                                    {displayText}
                                                                </li>
                                                            );
                                                        })}
                                                        {/* 빈 슬롯 추가 - 다른 요일과 높이 맞춤 */}
                                                        {Array.from({ length: emptySlots }).map((_, i) => (
                                                            <li key={`empty-${i}`} className="py-0 px-1 text-sm leading-[1.3] text-transparent select-none">
                                                                &nbsp;
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        {/* 대기 + 퇴원 (토글에 따라 조건부 렌더링) */}
                        {(showHoldStudents || showWithdrawnStudents) && (
                            <div className="flex-shrink-0">
                                {showHoldStudents && (
                                    <div className="px-0.5 py-0.5 bg-violet-50 border-b border-violet-200 overflow-y-auto" style={{ minHeight: '40px', maxHeight: '48px' }}>
                                        <div className="text-[10px] font-bold text-violet-600">대기 ({commonStudents.hold.length}명)</div>
                                        {commonStudents.hold.length > 0 ? (
                                            <ul className="flex flex-col">
                                                {commonStudents.hold.map(s => (
                                                    <li key={s.id} className="text-[10px] leading-tight text-violet-800 truncate">{s.name}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-[10px] text-violet-300">-</span>
                                        )}
                                    </div>
                                )}
                                {showWithdrawnStudents && (
                                    <div className="px-0.5 py-0.5 bg-gray-100 overflow-y-auto" style={{ minHeight: '40px', maxHeight: '48px' }}>
                                        <div className="text-[10px] font-bold text-gray-600">퇴원 ({commonStudents.withdrawn.length}명)</div>
                                        {commonStudents.withdrawn.length > 0 ? (
                                            <ul className="flex flex-col">
                                                {commonStudents.withdrawn.map(s => (
                                                    <li key={s.id} className="text-[10px] leading-tight text-gray-700 truncate">{s.name}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-[10px] text-gray-400">-</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-0.5 py-0.5">
                            <div className="text-[10px] font-bold text-indigo-600 mb-0.5">재원생 ({activeStudents.length}명)</div>
                            <ul className="flex flex-col">
                                {activeStudents.map(s => {
                                    const isHighlighted = searchQuery && s.name.includes(searchQuery);
                                    let displayText = s.name;
                                    if (showSchool || showGrade) {
                                        const schoolGrade = formatSchoolGrade(
                                            showSchool ? s.school : null,
                                            showGrade ? s.grade : null
                                        );
                                        if (schoolGrade && schoolGrade !== '-') displayText += `/${schoolGrade}`;
                                    }
                                    return (
                                        <li
                                            key={s.id}
                                            draggable={canEdit}
                                            onDragStart={(e) => canEdit && onDragStart(e, s.id, cls.id)}
                                            onClick={(e) => {
                                                if (onStudentClick && !canEdit) {
                                                    e.stopPropagation();
                                                    onStudentClick(s.id);
                                                }
                                            }}
                                            className={`py-0 px-0.5 ${fontSizeClass} leading-tight truncate
                                            ${canEdit ? 'cursor-grab hover:bg-white/80' : onStudentClick ? 'cursor-pointer hover:bg-white/80' : ''}
                                            ${isHighlighted ? 'bg-yellow-300 font-bold text-black' : theme.text}`}
                                        >
                                            {displayText}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        {/* Spacer: 대기/퇴원을 하단으로 밀기 */}
                        <div className="flex-1"></div>

                        {/* 하단 고정 영역: 대기 + 퇴원 (토글에 따라 조건부 렌더링) */}
                        {(showHoldStudents || showWithdrawnStudents) && (
                            <div className="flex-shrink-0">
                                {/* 대기생 Section */}
                                {showHoldStudents && (
                                    <div className="px-0.5 py-0.5 bg-violet-50 border-b border-violet-200 overflow-y-auto" style={{ minHeight: '40px', maxHeight: '48px' }}>
                                        <div className="text-[10px] font-bold text-violet-600">대기 ({holdStudents.length}명)</div>
                                        {holdStudents.length > 0 ? (
                                            <ul className="flex flex-col">
                                                {holdStudents.map(s => (
                                                    <li key={s.id} className="text-[10px] leading-tight text-violet-800 truncate" title={s.name}>
                                                        {s.name}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-[10px] text-violet-300">-</span>
                                        )}
                                    </div>
                                )}

                                {/* 퇴원생 Section */}
                                {showWithdrawnStudents && (
                                    <div className="px-0.5 py-0.5 bg-gray-100 overflow-y-auto" style={{ minHeight: '40px', maxHeight: '48px' }}>
                                        <div className="text-[10px] font-bold text-gray-600">퇴원 ({withdrawnStudents.length}명)</div>
                                        {withdrawnStudents.length > 0 ? (
                                            <ul className="flex flex-col">
                                                {withdrawnStudents.map(s => (
                                                    <li
                                                        key={s.id}
                                                        className="text-[10px] leading-tight text-gray-700 truncate"
                                                        title={s.withdrawalDate ? `${s.name} (퇴원: ${s.withdrawalDate})` : s.name}
                                                    >
                                                        {s.name}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-[10px] text-gray-400">-</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            )}
        </div>
    );
};

// React.memo로 불필요한 리렌더링 방지
export default React.memo(ClassCard, (prevProps, nextProps) => {
    // 핵심 데이터가 변경되지 않았으면 리렌더링 스킵
    return (
        prevProps.cls.id === nextProps.cls.id &&
        prevProps.cls.className === nextProps.cls.className &&
        prevProps.cls.studentList === nextProps.cls.studentList &&
        prevProps.cls.studentIds === nextProps.cls.studentIds &&
        prevProps.span === nextProps.span &&
        prevProps.searchQuery === nextProps.searchQuery &&
        prevProps.showStudents === nextProps.showStudents &&
        prevProps.showClassName === nextProps.showClassName &&
        prevProps.showSchool === nextProps.showSchool &&
        prevProps.showGrade === nextProps.showGrade &&
        prevProps.dragOverClassId === nextProps.dragOverClassId &&
        prevProps.currentDay === nextProps.currentDay &&
        prevProps.fontSize === nextProps.fontSize &&
        prevProps.rowHeight === nextProps.rowHeight &&
        prevProps.showHoldStudents === nextProps.showHoldStudents &&
        prevProps.showWithdrawnStudents === nextProps.showWithdrawnStudents
    );
});
