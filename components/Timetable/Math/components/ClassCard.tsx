import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TimetableClass, ClassKeywordColor, Teacher } from '../../../../types';
import { getSubjectTheme } from '../utils/gridUtils';
import { Clock } from 'lucide-react';
import { MATH_PERIOD_INFO, MATH_PERIOD_TIMES, WEEKEND_PERIOD_INFO, WEEKEND_PERIOD_TIMES } from '../../constants';
import { formatSchoolGrade } from '../../../../utils/studentUtils';
import { formatDateKey } from '../../../../utils/dateUtils';
import PortalTooltip from '../../../Common/PortalTooltip';

// 학생 항목 컴포넌트 - hover 효과를 위해 분리
interface StudentItemProps {
    student: any;
    displayText: string;
    canEdit: boolean;
    onStudentClick?: (studentId: string) => void;
    onDragStart: (e: React.DragEvent, studentId: string, classId: string, zone?: string) => void;
    classId: string;
    zone?: string;  // 'common' | 특정 요일 (예: '월', '목')
    fontSizeClass: string;
    isHighlighted: boolean;
    enrollmentStyle: { bg: string; text: string } | null;
    themeText: string;
    isPendingMoved?: boolean;
    classLabel?: string;  // 합반수업 시 소속 수업 라벨
}

const StudentItem: React.FC<StudentItemProps> = ({
    student,
    displayText,
    canEdit,
    onStudentClick,
    onDragStart,
    classId,
    zone,
    fontSizeClass,
    isHighlighted,
    enrollmentStyle,
    themeText,
    isPendingMoved = false,
    classLabel
}) => {
    const [isHovered, setIsHovered] = useState(false);
    // 조회 모드/수정 모드 모두에서 학생 클릭 가능 (영어 시간표와 동일)
    const isClickable = !!onStudentClick;

    // hover 시 적용할 스타일 (자연스럽게)
    const hoverStyle: React.CSSProperties = isClickable && isHovered ? {
        backgroundColor: '#dbeafe', // blue-100
        color: '#1e40af', // blue-800
        fontWeight: 600
    } : {};

    return (
        <li
            draggable={canEdit}
            onDragStart={(e) => canEdit && onDragStart(e, student.id, classId, zone)}
            onClick={(e) => {
                if (isClickable) {
                    e.stopPropagation();
                    onStudentClick(student.id);
                }
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`py-0 px-0.5 ${fontSizeClass} leading-[1.3] overflow-hidden whitespace-nowrap min-w-0 font-normal transition-all duration-150
            ${canEdit ? 'cursor-grab' : ''} ${isClickable ? 'cursor-pointer' : ''}
            ${isPendingMoved ? 'bg-purple-400 text-white font-bold' : isHighlighted ? 'bg-yellow-300 font-bold text-black' : enrollmentStyle ? `${enrollmentStyle.bg} ${enrollmentStyle.text}` : themeText}
            ${!isPendingMoved && !isHighlighted && !enrollmentStyle ? 'opacity-80' : ''}`}
            style={hoverStyle}
            title={
                student.isTransferredIn
                    ? `${displayText}\n반이동 학생`
                    : enrollmentStyle && student.enrollmentDate
                        ? `${displayText}\n입학일: ${student.enrollmentDate}`
                        : displayText
            }
        >
            {classLabel && (
                <span className="inline-block text-[8px] leading-none bg-gray-500 text-white rounded px-0.5 mr-0.5 align-middle font-normal">
                    {classLabel}
                </span>
            )}
            {displayText}
        </li>
    );
};

interface ClassCardProps {
    cls: TimetableClass;
    span: number;
    searchQuery: string;
    showStudents: boolean;
    showClassName: boolean;
    showSchool: boolean;
    showGrade: boolean;
    canEdit: boolean;  // 수정 모드 여부 (true일 때 수업명 클릭하면 수업 상세 모달)
    isDragOver: boolean;
    onClick: (cls: TimetableClass) => void;  // 수업 상세 모달 열기 (수정 모드에서만)
    onDragStart: (e: React.DragEvent, studentId: string, fromClassId: string, fromZone?: string) => void;
    onDragOver: (e: React.DragEvent, classId: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, toClassId: string, toZone?: string) => void;
    studentMap: Record<string, any>;
    classKeywords?: ClassKeywordColor[];
    onStudentClick?: (studentId: string) => void;  // 학생 클릭 시 상세 모달 (조회/수정 모두)
    currentDay?: string;
    mergedDays?: string[];
    teachers?: Teacher[];
    fontSize?: 'small' | 'normal' | 'large' | 'very-large';  // 글자 크기 설정
    rowHeight?: 'compact' | 'short' | 'normal' | 'tall' | 'very-tall';  // 세로 높이 설정
    cellSizePx?: number;  // 셀 사이즈 (수업명 정사각형 크기)
    showHoldStudents?: boolean;  // 대기 학생 표시 여부
    showWithdrawnStudents?: boolean;  // 퇴원 학생 표시 여부
    pendingMovedStudentIds?: Set<string>;  // 드래그 이동 대기 중인 학생 ID
    mergedClasses?: TimetableClass[];  // 합반수업: 같은 슬롯의 모든 수업 목록
    isAssistantTeacher?: boolean;  // 부담임 수업 여부 (teacher 뷰에서 slotTeacher로 배정된 경우)
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
    isDragOver,
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
    showWithdrawnStudents = true,
    pendingMovedStudentIds,
    mergedClasses,
    cellSizePx = 72,
    isAssistantTeacher = false
}) => {
    // 컴팩트 모드 여부
    const isCompact = rowHeight === 'compact';

    // 셀 높이를 픽셀 단위로 고정 (테이블 td의 height는 최소값이므로 ClassCard에서 직접 제한)
    // 행 높이 = cellSizePx(헤더) + studentSlotH(학생영역) — TimetableGrid의 rowHeightValue와 동일
    const fixedCardHeight = useMemo((): number | undefined => {
        if (!showStudents || rowHeight === 'compact') return undefined;
        const studentSlotH = rowHeight === 'short' ? 50 : rowHeight === 'tall' ? 150 : rowHeight === 'very-tall' ? 230 : 90;
        return (cellSizePx + studentSlotH) * span;
    }, [showStudents, rowHeight, span, cellSizePx]);

    // compact 모드: maxHeight로 행 높이 팽창 방지 (height 고정 없이 내용에 따라 자연스럽게 축소)
    // 학생이 많은 셀이 전체 행 높이를 팽창시켜 빈 셀에 큰 빈공간이 생기는 문제 해결
    const compactMaxHeight = useMemo((): number | undefined => {
        if (!showStudents || rowHeight !== 'compact') return undefined;
        return 150 * span;
    }, [showStudents, rowHeight, span]);

    // 글자 크기 CSS 클래스 매핑
    const fontSizeClass = {
        'small': 'text-nano',
        'normal': 'text-xs',
        'large': 'text-sm',
        'very-large': 'text-base'
    }[fontSize];

    const titleFontSizeClass = {
        'small': 'text-xs',
        'normal': 'text-sm',
        'large': 'text-base',
        'very-large': 'text-lg'
    }[fontSize];
    const theme = getSubjectTheme(cls.subject);

    // 섹션별 기본 인원: 병합셀 10명, 단일셀 6명, 대기 2명, 퇴원 3명
    const MERGED_BASE = 10;
    const SINGLE_BASE = 6;
    const HOLD_BASE = 2;
    const WITHDRAWN_BASE = 3;
    const activeItemH = fontSize === 'small' ? 13 : fontSize === 'large' ? 18 : fontSize === 'very-large' ? 21 : 16;

    // 수업명을 첫 번째 공백에서 2줄로 분리 (예: "초등M_초저 개별진도 A" → ["초등M_초저", "개별진도A"])
    const classNameLines = useMemo(() => {
        const name = cls.className || '';
        const idx = name.indexOf(' ');
        if (idx === -1) return [name];
        return [name.slice(0, idx), name.slice(idx + 1).replace(/\s+/g, '')];
    }, [cls.className]);

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

    // === 입학일 기반 스타일 (영어 시간표와 동일) ===
    const getEnrollmentStyle = (student: any) => {
        // 반이동 학생 (다른 반에서 이동해 온 학생) - 초록 배경에 검은 글씨
        if (student.isTransferredIn) {
            return { bg: 'bg-green-200', text: 'text-gray-900 font-bold' };
        }
        if (student.enrollmentDate) {
            const days = Math.ceil((Date.now() - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
            if (days <= 30) return { bg: 'bg-red-500', text: 'text-white font-bold' };
            if (days <= 60) return { bg: 'bg-pink-100', text: 'text-black font-bold' };
        }
        return null;
    };

    // 병합 셀 여부 확인
    const isMergedCell = mergedDays.length > 1;

    // 합반수업 여부 확인
    const isMergedClass = mergedClasses && mergedClasses.length > 1;
    const mergedClassCount = mergedClasses ? mergedClasses.length : 0;

    // 전체 학생 목록 가져오기 (합반수업 시 모든 수업의 학생을 합침)
    const allStudents = useMemo(() => {
        const today = formatDateKey(new Date());
        const classesToProcess = isMergedClass ? mergedClasses! : [cls];

        const allStudentsList: any[] = [];
        const seenIds = new Set<string>();

        classesToProcess.forEach(targetCls => {
            let students: any[] = [];
            if (targetCls.studentList && targetCls.studentList.length > 0) {
                students = [...targetCls.studentList];
            } else if (targetCls.studentIds && targetCls.studentIds.length > 0) {
                students = targetCls.studentIds.map(id => studentMap[id]).filter(Boolean);
            }

            // 입학일 필터링 - 단, 대기 학생(배정 예정 포함)은 미래 입학일이어도 표시
            students = students.filter(s => {
                if (!s.enrollmentDate) return true;
                if (s.onHold) return true;  // 대기 학생은 미래 입학일이어도 대기 섹션에 표시
                return s.enrollmentDate <= today;
            });

            // 합반수업일 때 classLabel 태깅 (중복 학생 방지)
            students.forEach(s => {
                if (!seenIds.has(s.id)) {
                    seenIds.add(s.id);
                    allStudentsList.push(isMergedClass ? { ...s, _classLabel: targetCls.className } : s);
                }
            });
        });

        return allStudentsList;
    }, [cls, mergedClasses, isMergedClass, studentMap]);

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

        // 신입생 정렬 가중치 함수 (영어 시간표와 동일)
        const getEnrollmentWeight = (student: any) => {
            // 반이동 학생 (다른 반에서 이동해 온 학생)이 가장 상단 (가중치 -1)
            if (student.isTransferredIn) return -1;
            // underline 학생 최상단 (가중치 0)
            if (student.underline) return 0;
            // enrollmentDate 기반 가중치
            if (student.enrollmentDate) {
                const days = Math.ceil((Date.now() - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                if (days <= 30) return 3;  // 30일 이내 신입생 최하단
                if (days <= 60) return 2;  // 31-60일 신입생 중간
            }
            return 1;  // 일반 학생
        };

        // 모든 병합 요일에 등원하는 학생 (공통)
        const commonActive = allStudents
            .filter(s => !s.withdrawalDate && !s.onHold && isStudentAttendingAllMergedDays(s))
            .sort((a, b) => {
                const wA = getEnrollmentWeight(a), wB = getEnrollmentWeight(b);
                return wA !== wB ? wA - wB : (a.name || '').localeCompare(b.name || '', 'ko');
            });
        const commonHold = allStudents
            .filter(s => s.onHold && !s.withdrawalDate && isStudentAttendingAllMergedDays(s))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
        // 퇴원 학생은 attendanceDays와 관계없이 모두 표시 (퇴원 이력 추적)
        const commonWithdrawn = allStudents
            .filter(s => s.withdrawalDate)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

        // 요일별 부분 등원 학생 (특정 요일만 오는 학생)
        const partial: Record<string, { active: any[]; hold: any[]; withdrawn: any[] }> = {};
        mergedDays.forEach(day => {
            const active = allStudents
                .filter(s => !s.withdrawalDate && !s.onHold && !isStudentAttendingAllMergedDays(s) && isStudentAttendingDay(s, day))
                .sort((a, b) => {
                    const wA = getEnrollmentWeight(a), wB = getEnrollmentWeight(b);
                    return wA !== wB ? wA - wB : (a.name || '').localeCompare(b.name || '', 'ko');
                });
            const hold = allStudents
                .filter(s => s.onHold && !s.withdrawalDate && !isStudentAttendingAllMergedDays(s) && isStudentAttendingDay(s, day))
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
            // 퇴원 학생은 commonWithdrawn에서 통합 표시 (요일별 분리 X)
            partial[day] = { active, hold, withdrawn: [] };
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

        // 신입생 정렬 가중치 함수 (영어 시간표와 동일)
        const getEnrollmentWeight = (student: any) => {
            // 반이동 학생 (다른 반에서 이동해 온 학생)이 가장 상단 (가중치 -1)
            if (student.isTransferredIn) return -1;
            if (student.underline) return 0;
            if (student.enrollmentDate) {
                const days = Math.ceil((Date.now() - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                if (days <= 30) return 3;
                if (days <= 60) return 2;
            }
            return 1;
        };

        const active = allStudents
            .filter(s => !s.withdrawalDate && !s.onHold && (filterDay ? isStudentAttendingDay(s, filterDay) : true))
            .sort((a, b) => {
                const wA = getEnrollmentWeight(a), wB = getEnrollmentWeight(b);
                return wA !== wB ? wA - wB : (a.name || '').localeCompare(b.name || '', 'ko');
            });

        const hold = allStudents
            .filter(s => s.onHold && !s.withdrawalDate && (filterDay ? isStudentAttendingDay(s, filterDay) : true))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

        // 퇴원 학생은 attendanceDays와 관계없이 모두 표시 (퇴원 이력 추적)
        const withdrawn = allStudents
            .filter(s => s.withdrawalDate)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

        return { activeStudents: active, holdStudents: hold, withdrawnStudents: withdrawn };
    }, [isMergedCell, allStudents, currentDay]);

    // 병합 셀에서 부분 등원 학생이 있는지 확인
    const hasPartialStudents = isMergedCell && partialStudentsByDay &&
        mergedDays.some(day => partialStudentsByDay[day]?.active.length > 0);

    // 부분 등원 학생 수 (중복 제거) - 재원생 카운트에 합산 표시용
    const partialActiveCount = isMergedCell && partialStudentsByDay
        ? new Set(mergedDays.flatMap(d => (partialStudentsByDay[d]?.active || []).map((s: any) => s.id))).size
        : 0;

    // 교시 수(span)에 따른 재원생 최대 높이 계산
    // 1교시당 4명 기준 (1명당 약 21px)
    const maxStudentHeight = span * 4 * 21; // span * 4명 * 21px

    // 카드 전체 배경색 스타일 (키워드 색상 또는 흰색)
    const cardBgStyle = matchedKeyword
        ? { backgroundColor: matchedKeyword.bgColor }
        : { backgroundColor: '#ffffff' };

    // 수정 모드에서 수업명 헤더 클릭 핸들러
    const handleClassHeaderClick = (e: React.MouseEvent) => {
        if (canEdit) {
            e.stopPropagation();
            onClick(cls);
        }
    };

    // 병합 셀 내 zone 드래그 오버 상태 (로컬)
    const [dragOverZone, setDragOverZone] = useState<string | null>(null);

    return (
        <div
            onDragOver={(e) => canEdit && onDragOver(e, cls.id)}
            onDragLeave={(e) => {
                if (canEdit) {
                    onDragLeave(e);
                    setDragOverZone(null);
                }
            }}
            onDrop={(e) => canEdit && onDrop(e, cls.id, 'common')}
            className={`flex flex-col ${fixedCardHeight ? '' : 'h-full '}overflow-hidden transition-all w-full max-w-full ${isDragOver ? 'ring-2 ring-indigo-400 shadow-lg shadow-indigo-200' : ''} ${hasSearchMatch ? 'ring-2 ring-yellow-400' : ''}`}
            style={{
                ...cardBgStyle,
                ...(fixedCardHeight ? { height: `${fixedCardHeight}px`, maxHeight: `${fixedCardHeight}px` } : {}),
                ...(compactMaxHeight ? { maxHeight: `${compactMaxHeight}px` } : {})
            }}
        >
            {/* Class Name Header - 수정 모드에서 클릭 시 수업 상세 모달, 조회 모드에서 마우스 오버시 스케줄 툴팁 */}
            {showClassName && (
                <div
                    ref={headerRef}
                    onClick={handleClassHeaderClick}
                    className={`relative text-center font-bold px-0.5 mx-auto ${canEdit ? 'cursor-pointer hover:brightness-95' : 'cursor-pointer'} ${showStudents ? 'border-b border-gray-300' : ''} flex flex-col items-center justify-center shrink-0 overflow-hidden`}
                    style={{
                        width: `${cellSizePx}px`,
                        maxWidth: `${cellSizePx}px`,
                        height: `${cellSizePx}px`,
                        color: matchedKeyword ? matchedKeyword.textColor : '#111827'
                    }}
                    title={`${cls.className}${cls.room ? `\n${cls.room}` : ''}`}
                    onMouseEnter={() => !canEdit && setShowScheduleTooltip(true)}
                    onMouseLeave={() => setShowScheduleTooltip(false)}
                >
                    {isAssistantTeacher && (
                        <span className="absolute top-0 left-0 z-10 text-[10px] leading-none bg-gray-600 text-white px-0.5 py-0.5 font-bold whitespace-nowrap animate-pulse">부담임</span>
                    )}
                    <div className="relative min-w-0 w-full">
                        {classNameLines.map((line, i) => (
                            <span key={i} className={`block leading-tight ${titleFontSizeClass} whitespace-nowrap overflow-hidden`}>{line}</span>
                        ))}
                        {isMergedClass && (
                            <PortalTooltip
                                triggerClassName="absolute -top-0.5 -right-0.5 z-10"
                                content={
                                    <div className="bg-gray-900 text-white text-xs rounded shadow-xl p-2 min-w-[120px]">
                                        <div className="font-bold mb-1 border-b border-gray-700 pb-1">합반 수업 ({mergedClassCount}개)</div>
                                        <ul className="space-y-0.5">
                                            {mergedClasses!.map(mc => (
                                                <li key={mc.id} className="text-gray-200">• {mc.className}</li>
                                            ))}
                                        </ul>
                                    </div>
                                }
                            >
                                <span className="inline-flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 cursor-pointer shadow-sm">
                                    +{mergedClassCount - 1}
                                </span>
                            </PortalTooltip>
                        )}
                    </div>
                    {/* 강의실 (2행) + 재원생 수 (학생 목록 숨김 시) */}
                    {(cls.room || !showStudents) && (
                        <div className={`${fontSizeClass} font-normal text-gray-600 leading-tight`}>
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
                            className="fixed bg-gray-900 text-white text-xs rounded-sm shadow-xl p-2 min-w-[140px] whitespace-nowrap pointer-events-none"
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
                    <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
                        <div
                            className={`flex-1 px-1 py-0 transition-colors min-w-0 min-h-0 overflow-y-auto no-scrollbar fade-bottom overscroll-contain ${dragOverZone === 'common' ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-400' : ''}`}
                            onDragOver={(e) => {
                                if (!canEdit) return;
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOverZone('common');
                            }}
                            onDragLeave={(e) => {
                                // 자식 요소로 이동하는 경우 무시
                                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                setDragOverZone(null);
                            }}
                            onDrop={(e) => {
                                if (!canEdit) return;
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOverZone(null);
                                onDrop(e, cls.id, 'common');
                            }}
                        >
                            <div className={`${fontSizeClass} font-bold text-indigo-600 mb-0 overflow-hidden whitespace-nowrap`}>{commonStudents.active.length + partialActiveCount}명 - 재원생</div>
                            <ul className="flex flex-col gap-0 min-w-0">
                                {commonStudents.active.map(s => {
                                    const isHighlighted = !!(searchQuery && s.name.includes(searchQuery));
                                    const enrollmentStyle = getEnrollmentStyle(s);
                                    let displayText = s.name;
                                    if (showSchool || showGrade) {
                                        const schoolGrade = formatSchoolGrade(
                                            showSchool ? s.school : null,
                                            showGrade ? s.grade : null
                                        );
                                        if (schoolGrade && schoolGrade !== '-') displayText += `/${schoolGrade}`;
                                    }
                                    return (
                                        <StudentItem
                                            key={s.id}
                                            student={s}
                                            displayText={displayText}
                                            canEdit={canEdit}
                                            onStudentClick={onStudentClick}
                                            onDragStart={onDragStart}
                                            classId={cls.id}
                                            zone="common"
                                            fontSizeClass={fontSizeClass}
                                            isHighlighted={isHighlighted}
                                            enrollmentStyle={enrollmentStyle}
                                            themeText={theme.text}
                                            isPendingMoved={pendingMovedStudentIds?.has(s.id)}
                                            classLabel={isMergedClass ? s._classLabel : undefined}
                                        />
                                    );
                                })}
                            </ul>

                        {/* 부분 등원 학생 (행 단위 좌우 분할: 학생 쪽만 표시, 반대쪽 회색) - 재원생 바로 밑 */}
                        {isMergedCell && (canEdit || hasPartialStudents) && mergedDays.length > 0 && (() => {
                            const partialRows: { student: typeof commonStudents.active[0]; day: string }[] = [];
                            mergedDays.forEach(day => {
                                (partialStudentsByDay?.[day]?.active || []).forEach(s => partialRows.push({ student: s, day }));
                            });
                            if (!canEdit && partialRows.length === 0) return null;

                            return (
                                <div className="flex-shrink-0 border-t border-dashed border-gray-400 overflow-hidden min-w-0">
                                    {partialRows.map(({ student: s, day }) => {
                                        const isHighlighted = !!(searchQuery && s.name.includes(searchQuery));
                                        const enrollmentStyle = getEnrollmentStyle(s);
                                        let displayText = s.name;
                                        if (showSchool || showGrade) {
                                            const schoolGrade = formatSchoolGrade(
                                                showSchool ? s.school : null,
                                                showGrade ? s.grade : null
                                            );
                                            if (schoolGrade && schoolGrade !== '-') displayText += `/${schoolGrade}`;
                                        }
                                        return (
                                            <div key={s.id} className="flex min-w-0">
                                                {mergedDays.map((d, dIdx) => (
                                                    <div
                                                        key={d}
                                                        className={`flex-1 min-w-0 overflow-hidden transition-colors ${dIdx < mergedDays.length - 1 ? 'border-r border-dashed border-gray-300' : ''} ${d !== day ? (dragOverZone === d ? 'bg-blue-200 ring-2 ring-inset ring-blue-400' : 'bg-gray-200') : ''}`}
                                                        onDragOver={(e) => { if (!canEdit || d === day) return; e.preventDefault(); e.stopPropagation(); setDragOverZone(d); }}
                                                        onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setDragOverZone(null); }}
                                                        onDrop={(e) => { if (!canEdit || d === day) return; e.preventDefault(); e.stopPropagation(); setDragOverZone(null); onDrop(e, cls.id, d); }}
                                                    >
                                                        {d === day && (
                                                            <StudentItem
                                                                student={s}
                                                                displayText={displayText}
                                                                canEdit={canEdit}
                                                                onStudentClick={onStudentClick}
                                                                onDragStart={onDragStart}
                                                                classId={cls.id}
                                                                zone={day}
                                                                fontSizeClass={fontSizeClass}
                                                                isHighlighted={isHighlighted}
                                                                enrollmentStyle={enrollmentStyle}
                                                                themeText={theme.text}
                                                                isPendingMoved={pendingMovedStudentIds?.has(s.id)}
                                                                classLabel={isMergedClass ? s._classLabel : undefined}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                    {canEdit && (
                                        <div className="flex min-w-0 border-t border-gray-300">
                                            {mergedDays.map((d, dIdx) => (
                                                <div
                                                    key={d}
                                                    className={`flex-1 min-w-0 flex items-center justify-center transition-all
                                                        ${dIdx < mergedDays.length - 1 ? 'border-r border-dashed border-gray-300' : ''}
                                                        ${dragOverZone === d
                                                            ? 'bg-blue-200 ring-2 ring-inset ring-blue-500 text-blue-700 font-bold'
                                                            : 'bg-gray-100 text-gray-400'}`}
                                                    style={{ minHeight: `${Math.max(40, activeItemH * 3)}px` }}
                                                    onDragOver={(e) => { if (!canEdit) return; e.preventDefault(); e.stopPropagation(); setDragOverZone(d); }}
                                                    onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setDragOverZone(null); }}
                                                    onDrop={(e) => { if (!canEdit) return; e.preventDefault(); e.stopPropagation(); setDragOverZone(null); onDrop(e, cls.id, d); }}
                                                >
                                                    <span className="text-xxs">
                                                        {dragOverZone === d ? '▼' : `${d}만`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                        </div>

                        {/* 대기 + 퇴원 (토글에 따라 조건부 렌더링) */}
                        {(showHoldStudents || showWithdrawnStudents) && (
                            <div className="flex-shrink overflow-y-auto no-scrollbar min-h-0" style={{ maxHeight: `${Math.max(60, 3 * activeItemH + 20)}px` }}>
                                {showHoldStudents && (
                                    <div className="px-0.5 py-0 bg-pink-50 border-b border-pink-200">
                                        <div className={`${fontSizeClass} font-bold text-pink-600 overflow-hidden whitespace-nowrap`}>{commonStudents.hold.length}명 - 대기</div>
                                        <ul className="flex flex-col gap-0">
                                            {commonStudents.hold.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                const tooltipText = s.enrollmentDate ? `예정일: ${s.enrollmentDate}` : undefined;
                                                return <li key={s.id} className={`${fontSizeClass} leading-[1.3] bg-amber-50 text-amber-800 px-0.5 py-0 overflow-hidden whitespace-nowrap cursor-pointer`} title={tooltipText}>{text}</li>;
                                            })}
                                        </ul>
                                    </div>
                                )}
                                {showWithdrawnStudents && (
                                    <div className="px-0.5 py-0 bg-gray-100">
                                        <div className={`${fontSizeClass} font-bold text-gray-600 overflow-hidden whitespace-nowrap`}>{commonStudents.withdrawn.length}명 - 퇴원</div>
                                        <ul className="flex flex-col gap-0">
                                            {commonStudents.withdrawn.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                const tooltipText = s.withdrawalDate ? `퇴원일: ${s.withdrawalDate}` : undefined;
                                                return (
                                                    <li
                                                        key={s.id}
                                                        className={`${fontSizeClass} leading-[1.3] bg-black text-white px-0.5 py-0 overflow-hidden whitespace-nowrap cursor-pointer hover:bg-gray-700 transition-colors`}
                                                        title={tooltipText}
                                                        onClick={(e) => {
                                                            if (onStudentClick) {
                                                                e.stopPropagation();
                                                                onStudentClick(s.id);
                                                            }
                                                        }}
                                                    >
                                                        {text}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
                        <div className="flex-1 px-0.5 py-0.5 min-w-0 min-h-0 overflow-y-auto no-scrollbar fade-bottom overscroll-contain">
                            <div className={`${fontSizeClass} font-bold text-indigo-600 mb-0 overflow-hidden whitespace-nowrap`}>{activeStudents.length}명 - 재원생</div>
                            <ul className="flex flex-col min-w-0">
                                {activeStudents.map(s => {
                                    const isHighlighted = !!(searchQuery && s.name.includes(searchQuery));
                                    const enrollmentStyle = getEnrollmentStyle(s);
                                    let displayText = s.name;
                                    if (showSchool || showGrade) {
                                        const schoolGrade = formatSchoolGrade(
                                            showSchool ? s.school : null,
                                            showGrade ? s.grade : null
                                        );
                                        if (schoolGrade && schoolGrade !== '-') displayText += `/${schoolGrade}`;
                                    }
                                    return (
                                        <StudentItem
                                            key={s.id}
                                            student={s}
                                            displayText={displayText}
                                            canEdit={canEdit}
                                            onStudentClick={onStudentClick}
                                            onDragStart={onDragStart}
                                            classId={s._classLabel ? cls.id : cls.id}
                                            fontSizeClass={fontSizeClass}
                                            isHighlighted={isHighlighted}
                                            enrollmentStyle={enrollmentStyle}
                                            themeText={theme.text}
                                            isPendingMoved={pendingMovedStudentIds?.has(s.id)}
                                            classLabel={isMergedClass ? s._classLabel : undefined}
                                        />
                                    );
                                })}
                                {/* 단일셀: 6명 기본 높이 - 빈 슬롯으로 공간 확보 */}
                                {Array.from({ length: Math.max(0, SINGLE_BASE - activeStudents.length) }).map((_, i) => (
                                    <li key={`pad-${i}`} className={`py-0 px-0.5 ${fontSizeClass} leading-[1.3] invisible select-none`}>&nbsp;</li>
                                ))}
                            </ul>
                        </div>

                        {/* 하단 고정 영역: 대기 + 퇴원 (토글에 따라 조건부 렌더링) */}
                        {(showHoldStudents || showWithdrawnStudents) && (
                            <div className="flex-shrink overflow-y-auto no-scrollbar min-h-0" style={{ maxHeight: `${Math.max(60, 3 * activeItemH + 20)}px` }}>
                                {/* 대기생 Section */}
                                {showHoldStudents && (
                                    <div className="px-0.5 py-0 bg-pink-50 border-b border-pink-200">
                                        <div className={`${fontSizeClass} font-bold text-pink-600 overflow-hidden whitespace-nowrap`}>{holdStudents.length}명 - 대기</div>
                                        <ul className="flex flex-col gap-0">
                                            {holdStudents.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                return (
                                                    <li key={s.id} className={`${fontSizeClass} leading-[1.3] bg-amber-50 text-amber-800 px-0.5 py-0 overflow-hidden whitespace-nowrap`} title={text}>
                                                        {text}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                {/* 퇴원생 Section */}
                                {showWithdrawnStudents && (
                                    <div className="px-0.5 py-0 bg-gray-100">
                                        <div className={`${fontSizeClass} font-bold text-gray-600 overflow-hidden whitespace-nowrap`}>{withdrawnStudents.length}명 - 퇴원</div>
                                        <ul className="flex flex-col gap-0">
                                            {withdrawnStudents.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                return (
                                                    <li
                                                        key={s.id}
                                                        className={`${fontSizeClass} leading-[1.3] bg-black text-white px-0.5 py-0 overflow-hidden whitespace-nowrap cursor-pointer hover:bg-gray-700 transition-colors`}
                                                        title={s.withdrawalDate ? `${text} (퇴원: ${s.withdrawalDate})` : text}
                                                        onClick={(e) => {
                                                            if (onStudentClick) {
                                                                e.stopPropagation();
                                                                onStudentClick(s.id);
                                                            }
                                                        }}
                                                    >
                                                        {text}
                                                    </li>
                                                );
                                            })}
                                        </ul>
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
        prevProps.canEdit === nextProps.canEdit &&
        prevProps.isDragOver === nextProps.isDragOver &&
        prevProps.currentDay === nextProps.currentDay &&
        prevProps.fontSize === nextProps.fontSize &&
        prevProps.rowHeight === nextProps.rowHeight &&
        prevProps.cellSizePx === nextProps.cellSizePx &&
        prevProps.showHoldStudents === nextProps.showHoldStudents &&
        prevProps.showWithdrawnStudents === nextProps.showWithdrawnStudents &&
        prevProps.mergedClasses === nextProps.mergedClasses &&
        prevProps.isAssistantTeacher === nextProps.isAssistantTeacher
    );
});
