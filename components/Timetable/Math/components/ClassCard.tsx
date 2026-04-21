import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TimetableClass, ClassKeywordColor, Teacher } from '../../../../types';
import { getSubjectTheme } from '../utils/gridUtils';
import { Clock, BookOpen } from 'lucide-react';
import { MATH_PERIOD_INFO, MATH_PERIOD_TIMES, WEEKEND_PERIOD_INFO, WEEKEND_PERIOD_TIMES } from '../../constants';
import { formatSchoolGrade } from '../../../../utils/studentUtils';
import { formatDateKey } from '../../../../utils/dateUtils';
import PortalTooltip from '../../../Common/PortalTooltip';
import { useAllLatestReports } from '../../../../hooks/useAllLatestReports';
import { EdutrixReport } from '../../../../services/supabaseClient';
import SubjectBadges from '../../../Common/SubjectBadges';

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
    isPendingMovedFrom?: boolean;  // 이동 출발지 (취소선 표시)
    pendingScheduledDate?: string;  // 예정일 (있으면 툴팁에 표시)
    isTransferScheduled?: boolean;  // 반이동예정 (미래 withdrawalDate + isTransferred)
    transferScheduledDate?: string;  // 반이동예정일
    transferTo?: string;  // 반이동 대상 반
    isWithdrawalScheduled?: boolean;  // 퇴원예정 (미래 withdrawalDate, 재원생 섹션에 가로줄로 표시)
    withdrawalScheduledDate?: string;  // 퇴원예정일
    classLabel?: string;  // 합반수업 시 소속 수업 라벨
    textbookInfo?: { month: string; textbookName: string } | null;
    isExcelMode?: boolean;
    mode?: 'view' | 'edit';
    onCellSelect?: (classId: string) => void;
    isStudentSelected?: boolean;
    isCopiedStudent?: boolean;
    isCutStudent?: boolean;
    isAcHighlighted?: boolean;
    onStudentSelect?: (studentId: string, className: string) => void;
    onStudentMultiSelect?: (studentIds: Set<string>, className: string) => void;
    selectedStudentIds?: Set<string>;
    className?: string;
    isPendingExcelDelete?: boolean;
    latestReport?: EdutrixReport | null;  // 최근 진도 보고서 (ClassCard에서 전달)
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
    isPendingMovedFrom = false,
    pendingScheduledDate,
    isTransferScheduled = false,
    transferScheduledDate,
    transferTo,
    isWithdrawalScheduled = false,
    withdrawalScheduledDate,
    classLabel,
    textbookInfo,
    isExcelMode,
    mode,
    onCellSelect,
    isStudentSelected,
    isCopiedStudent,
    isCutStudent,
    isAcHighlighted,
    onStudentSelect,
    onStudentMultiSelect,
    selectedStudentIds,
    className: clsName,
    isPendingExcelDelete = false,
    latestReport,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    // 엑셀 모드에서는 싱글클릭으로 모달을 열지 않음
    const isClickable = !isExcelMode && !!onStudentClick;
    // 엑셀 모드에서는 개별 학생 드래그 비활성 (테두리 드래그만 사용)
    const isDraggable = isExcelMode ? false : canEdit;

    // hover 시 적용할 스타일 (자연스럽게)
    const hoverStyle: React.CSSProperties = isClickable && isHovered ? {
        backgroundColor: '#dbeafe', // blue-100
        color: '#1e40af', // blue-800
        fontWeight: 600
    } : {};

    return (
        <li
            draggable={isDraggable}
            onDragStart={(e) => {
                if (isDraggable) {
                    onDragStart(e, student.id, classId, zone);
                }
            }}
            onClick={(e) => {
                if (isExcelMode) {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+클릭: 토글 추가/제거
                        const newSet = new Set(selectedStudentIds);
                        if (newSet.has(student.id)) newSet.delete(student.id);
                        else newSet.add(student.id);
                        onStudentMultiSelect?.(newSet, clsName || '');
                    } else {
                        // 일반 클릭: 단일 선택
                        onStudentSelect?.(student.id, clsName || '');
                    }
                    onCellSelect?.(classId);
                    return;
                }
                if (isClickable) {
                    e.stopPropagation();
                    onStudentClick!(student.id);
                }
            }}
            onDoubleClick={(e) => {
                // 엑셀 모드: 더블클릭 시 기존 모달 열기
                if (isExcelMode && onStudentClick) {
                    e.stopPropagation();
                    onStudentClick(student.id);
                }
            }}
            onMouseDown={(e) => {
                if (isExcelMode && e.button === 0 && !e.ctrlKey && !e.metaKey) {
                    // 드래그 선택 시작: dataset으로 전파
                    (e.currentTarget.closest('[data-excel-card]') as HTMLElement)?.dispatchEvent(
                        new CustomEvent('excel-drag-start', { detail: { studentId: student.id, className: clsName } })
                    );
                }
            }}
            onMouseEnter={(e) => {
                setIsHovered(true);
                if (isExcelMode && e.buttons === 1) {
                    // 드래그 중: 범위 확장
                    (e.currentTarget.closest('[data-excel-card]') as HTMLElement)?.dispatchEvent(
                        new CustomEvent('excel-drag-extend', { detail: { studentId: student.id } })
                    );
                }
            }}
            onMouseLeave={() => setIsHovered(false)}
            className={`py-0 px-0.5 list-none ${fontSizeClass} leading-[1.3] overflow-hidden whitespace-nowrap min-w-0 font-normal transition-all duration-150
            ${isPendingExcelDelete ? '!bg-red-200 !text-red-500 line-through opacity-50' : ''}
            ${isExcelMode && !isPendingExcelDelete ? 'cursor-pointer select-none' : isDraggable ? 'cursor-grab' : isClickable ? 'cursor-pointer' : ''}
            ${!isPendingExcelDelete && isPendingMovedFrom ? '!bg-gray-200 !text-gray-400 line-through opacity-60' : !isPendingExcelDelete && isPendingMoved ? '!bg-purple-400 !text-white font-bold' : !isPendingExcelDelete && isCutStudent ? '!bg-amber-100 !text-amber-800 ring-1 ring-dashed ring-amber-400 opacity-70' : !isPendingExcelDelete && isStudentSelected ? '!bg-blue-200 !text-blue-900 font-bold ring-1 ring-blue-400' : !isPendingExcelDelete && isCopiedStudent ? '!bg-green-100 !text-green-800 ring-1 ring-green-400' : ''}
            ${!isPendingExcelDelete && !isStudentSelected && !isCutStudent && !isCopiedStudent && !isPendingMovedFrom && !isPendingMoved ? (isTransferScheduled ? 'bg-purple-200 text-purple-800 font-bold' : isWithdrawalScheduled ? 'bg-orange-100 text-orange-800 line-through' : isAcHighlighted ? '!bg-red-200 !text-red-700 font-bold ring-2 ring-red-400 animate-pulse' : isHighlighted ? 'bg-yellow-300 font-bold text-black' : enrollmentStyle ? `${enrollmentStyle.bg} ${enrollmentStyle.text}` : themeText) : ''}
            ${!isPendingExcelDelete && !isStudentSelected && !isCutStudent && !isCopiedStudent && !isPendingMoved && !isPendingMovedFrom && !isTransferScheduled && !isWithdrawalScheduled && !isHighlighted && !enrollmentStyle ? 'opacity-80' : ''}`}
            style={hoverStyle}
            title={
                (() => {
                    let lines = displayText;
                    // 상태 정보
                    const statusInfo = isPendingMoved && pendingScheduledDate
                        ? `이동 예정일: ${pendingScheduledDate}`
                        : isPendingMoved
                            ? '즉시 이동 (저장 대기)'
                        : isTransferScheduled
                            ? `반이동예정: ${transferScheduledDate || '미정'}${transferTo ? `\n${transferTo}` : ''}`
                        : isWithdrawalScheduled && withdrawalScheduledDate
                            ? `퇴원예정: ${withdrawalScheduledDate}`
                        : enrollmentStyle && student.enrollmentDate
                            ? `${student.isTransferredIn ? '반이동' : '입학일'}: ${student.enrollmentDate}`
                        : '';
                    if (statusInfo) lines += `\n────────\n${statusInfo}`;
                    if (textbookInfo) lines += `\n────────\n${textbookInfo.month} ${textbookInfo.textbookName}`;
                    // 등하원 정보
                    const transportParts: string[] = [];
                    if (student.arrivalTime) transportParts.push(`등원: ${student.arrivalTime}`);
                    if (student.departureTime) transportParts.push(`하원: ${student.departureTime}`);
                    if (student.transportTags?.length) transportParts.push(student.transportTags.join(', '));
                    if (transportParts.length > 0) lines += `\n────────\n🚌 ${transportParts.join(' | ')}`;
                    // 최근 진도 정보
                    if (latestReport && latestReport.progress) {
                        const d = new Date(latestReport.date);
                        const t = latestReport.progress.trim();
                        const truncated = t.length > 80 ? t.substring(0, 80) + '...' : t;
                        const yy = String(d.getFullYear()).slice(2);
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        lines += `\n────────\n[진도] ${yy}.${mm}.${dd}\n${truncated}`;
                    }
                    return lines;
                })()
            }
        >
            <div className="leading-[1.2]">
                {classLabel && (
                    <span className={`inline-block leading-none bg-gray-500 text-white px-0.5 mr-0.5 align-middle font-bold ${fontSizeClass}`}>
                        {classLabel}
                    </span>
                )}
                {displayText}
            </div>
            <SubjectBadges enrollments={student.enrollments} />
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
    pendingMovedStudentIds?: Set<string>;  // 드래그 이동 대기 중인 학생 ID (flat, 다른 용도 유지)
    pendingMoveFromMap?: Map<string, Set<string>>;  // classId → 출발지 학생 IDs
    pendingMoveToMap?: Map<string, Set<string>>;  // classId → 도착지 학생 IDs (보라색 하이라이트 클래스 스코핑용)
    pendingMoveSchedules?: Map<string, string | undefined>;  // studentId → scheduledDate
    mergedClasses?: TimetableClass[];  // 합반수업: 같은 슬롯의 모든 수업 목록
    showMergedLabel?: boolean;  // 반반 레이아웃용 합반 라벨 표시
    isAssistantTeacher?: boolean;  // 부담임 수업 여부 (teacher 뷰에서 slotTeacher로 배정된 경우)
    latestTextbook?: { textbookName: string; distributedAt: string } | null;
    studentTextbookMap?: Map<string, { month: string; textbookName: string }>;
    referenceDate?: string;  // 주차 기준일 (YYYY-MM-DD), 없으면 오늘
    latestReports?: Map<string, any>;  // 학생별 최근 보고서 (학생이름 → EdutrixReport)
    // 엑셀 모드 (강사뷰 변형)
    isExcelMode?: boolean;
    isTestView?: boolean;  // 테스트 뷰 여부
    isSelected?: boolean;
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
    mode?: 'view' | 'edit';
    onCancelScheduledEnrollment?: (studentId: string, className: string) => void;  // 배정 예정 취소
    onWithdrawalDrop?: (studentId: string, classId: string, className: string) => void;  // 퇴원 드롭존
    // 엑셀 보류 삭제/등록 (시각적 표시) - pendingExcelDeleteIds: composite key "studentId_className"
    pendingExcelDeleteIds?: Set<string>;
    pendingExcelEnrollments?: Array<{ studentId: string; className: string; enrollmentDate?: string }>;
    // 통합 테이블: fixedCardHeight 대신 h-full로 부모 셀 채움
    fillCell?: boolean;
    // 학생 필터
    studentFilter?: { schools: string[]; grades: string[]; shuttle: 'all' | 'yes' | 'no' };
    shuttleStudentNames?: Set<string>;
    weeklyAbsent?: { late: Set<string>; absent: Set<string> };
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
    pendingMoveFromMap,
    pendingMoveToMap,
    pendingMoveSchedules,
    mergedClasses,
    showMergedLabel = false,
    cellSizePx = 72,
    isAssistantTeacher = false,
    latestTextbook,
    studentTextbookMap,
    referenceDate,
    latestReports,
    isExcelMode,
    isTestView = false,
    isSelected,
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
    mode,
    onCancelScheduledEnrollment,
    onWithdrawalDrop,
    pendingExcelDeleteIds,
    pendingExcelEnrollments,
    fillCell,
    studentFilter,
    shuttleStudentNames,
    weeklyAbsent,
}) => {
    // 주차 기준일: referenceDate가 있으면 해당 날짜, 없으면 오늘
    const refDateStr = referenceDate || formatDateKey(new Date());
    const refDateMs = new Date(refDateStr).getTime();
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

    // 수업명을 첫 번째 공백에서 2줄로 분리 (예: "초등M_수 개별진도 1A" → ["초등M_수", "개별진도 1A"])
    const classNameLines = useMemo(() => {
        const name = cls.className || '';
        const idx = name.indexOf(' ');
        if (idx === -1) return [name];
        return [name.slice(0, idx), name.slice(idx + 1)];
    }, [cls.className]);

    const [showScheduleTooltip, setShowScheduleTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const headerRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // 드래그 선택 + 테두리 드래그 이동 (엑셀 모드)
    const dragSelectStartId = useRef<string | null>(null);
    const dragSelectIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!isExcelMode || !cardRef.current) return;
        const el = cardRef.current;

        const handleDragStart = (e: Event) => {
            const { studentId, className: cn } = (e as CustomEvent).detail;
            dragSelectStartId.current = studentId;
            dragSelectIds.current = new Set([studentId]);
            onStudentSelect?.(studentId, cn || '');
            onCellSelect?.(cls.id);
        };

        const handleDragExtend = (e: Event) => {
            const { studentId } = (e as CustomEvent).detail;
            if (!dragSelectStartId.current) return;
            dragSelectIds.current.add(studentId);
            onStudentMultiSelect?.(new Set(dragSelectIds.current), cls.className);
        };

        const handleMouseUp = () => {
            if (dragSelectStartId.current && dragSelectIds.current.size > 1) {
                onStudentMultiSelect?.(new Set(dragSelectIds.current), cls.className);
            }
            dragSelectStartId.current = null;
        };

        el.addEventListener('excel-drag-start', handleDragStart);
        el.addEventListener('excel-drag-extend', handleDragExtend);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            el.removeEventListener('excel-drag-start', handleDragStart);
            el.removeEventListener('excel-drag-extend', handleDragExtend);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isExcelMode, cls.id, cls.className, onStudentSelect, onStudentMultiSelect, onCellSelect]);

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


    // 최신 진도 정보 (교재를 받은 학생들의 최근 보고서)
    const latestProgressInfo = useMemo(() => {
        if (!latestTextbook || !latestReports || latestReports.size === 0) return null;
        
        // 이 수업에 등록된 학생들의 보고서 조회
        const students = cls.studentList || [];
        const reports: Array<{ studentName: string; progress: string; date: string; teacherName: string }> = [];
        
        for (const student of students) {
            const report = latestReports.get(student.name);
            if (report && report.progress) {
                reports.push({
                    studentName: student.name,
                    progress: report.progress,
                    date: report.date,
                    teacherName: report.teacher_name || ''
                });
            }
        }
        
        if (reports.length === 0) return null;
        
        // 가장 최근 보고서 선택
        reports.sort((a, b) => b.date.localeCompare(a.date));
        const latest = reports[0];
        
        // 날짜 포맷팅
        const dateObj = new Date(latest.date);
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const formattedDate = month + '/' + day;
        
        return {
            progress: latest.progress,
            date: formattedDate,
            teacherName: latest.teacherName,
            studentName: latest.studentName
        };
    }, [cls.studentList, latestTextbook, latestReports]);
    // 키워드 매칭으로 색상 결정
    const matchedKeyword = useMemo(() => {
        return classKeywords.find(kw => cls.className?.includes(kw.keyword));
    }, [cls.className, classKeywords]);
    const hasSearchMatch = searchQuery && cls.studentList?.some(s => s.name.includes(searchQuery));

    // 엑셀 모드: 이 카드에 선택된 학생이 있는지 확인 (테두리 드래그용)
    const hasSelectedInThisCard = isExcelMode && selectedStudentIds && selectedStudentIds.size > 0 &&
        (cls.studentList || []).some(s => selectedStudentIds.has(s.id));

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
            const days = Math.ceil((refDateMs - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
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

    // 합반 수업의 고유 className 목록 및 인덱스 맵 (수업명 2등분 + 학생 [1]/[2] 라벨용)
    const uniqueMergedNames = useMemo(() => {
        if (!isMergedClass) return [];
        const seen = new Set<string>();
        return mergedClasses!.filter(c => {
            if (seen.has(c.className)) return false;
            seen.add(c.className);
            return true;
        });
    }, [mergedClasses, isMergedClass]);

    const classNameToIndex = useMemo(() => {
        const map = new Map<string, number>();
        uniqueMergedNames.forEach((c, i) => map.set(c.className, i + 1));
        return map;
    }, [uniqueMergedNames]);

    // 전체 학생 목록 가져오기 (합반수업 시 모든 수업의 학생을 합침)
    const allStudents = useMemo(() => {
        const today = refDateStr;
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

            // 주차 기준일(refDateStr) 기준으로 isScheduled/onHold 재계산
            // 훅에서는 실제 오늘 기준으로 설정하지만, 미래 주 미리보기 시 기준일이 다름
            students = students.map(s => {
                const recalcIsScheduled = s.enrollmentDate ? s.enrollmentDate > today : false;
                // isScheduled(배정 예정)로 인한 onHold는 기준일 기준으로 재계산, 명시적 onHold는 유지
                const recalcOnHold = s.isScheduled ? recalcIsScheduled : s.onHold;
                if (recalcIsScheduled !== s.isScheduled || recalcOnHold !== s.onHold) {
                    return { ...s, isScheduled: recalcIsScheduled, onHold: recalcOnHold };
                }
                return s;
            });

            // 합반수업일 때 classLabel 태깅 - 번호 인덱스 사용
            // 두 수업 모두 등록된 학생은 라벨을 합침 (예: "1,2")
            const labelIdx = classNameToIndex.get(targetCls.className) || 0;
            students.forEach(s => {
                if (!seenIds.has(s.id)) {
                    seenIds.add(s.id);
                    allStudentsList.push(isMergedClass ? { ...s, _classLabel: `${labelIdx}` } : s);
                } else if (isMergedClass) {
                    // 이미 추가된 학생 → 라벨 합치기
                    const existing = allStudentsList.find(e => e.id === s.id);
                    if (existing && !existing._classLabel.includes(`${labelIdx}`)) {
                        existing._classLabel = `${existing._classLabel},${labelIdx}`;
                    }
                }
            });
        });

        return allStudentsList;
    }, [cls, mergedClasses, isMergedClass, studentMap, classNameToIndex, refDateStr]);

    // 학생 필터 함수 (학교/학년/셔틀/출석)
    const filterStudent = useCallback((student: any): boolean => {
        if (!studentFilter) return true;
        if (studentFilter.schools.length > 0) {
            if (!student.school || !studentFilter.schools.includes(student.school)) return false;
        }
        if (studentFilter.grades.length > 0) {
            if (!student.grade || !studentFilter.grades.includes(student.grade)) return false;
        }
        if (studentFilter.shuttle !== 'all' && shuttleStudentNames && cls.subject !== '고등수학') {
            const isShuttle = shuttleStudentNames.has(student.name);
            if (studentFilter.shuttle === 'yes' && !isShuttle) return false;
            if (studentFilter.shuttle === 'no' && isShuttle) return false;
        }
        if (studentFilter.attendance && studentFilter.attendance !== 'all' && weeklyAbsent) {
            const isLate = weeklyAbsent.late.has(student.name);
            const isAbsent = weeklyAbsent.absent.has(student.name);
            if (studentFilter.attendance === 'late' && !isLate) return false;
            if (studentFilter.attendance === 'absent' && !isAbsent) return false;
            if (studentFilter.attendance === 'late_absent' && !isLate && !isAbsent) return false;
        }
        return true;
    }, [studentFilter, shuttleStudentNames, cls.subject, weeklyAbsent]);

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
            return { commonStudents: { active: [], hold: [], withdrawn: [], withdrawnFuture: [] }, partialStudentsByDay: null };
        }

        const today = refDateStr;

        // 신입생 정렬 가중치 함수 (영어 시간표와 동일)
        const getEnrollmentWeight = (student: any) => {
            // 반이동 학생 (다른 반에서 이동해 온 학생)이 가장 상단 (가중치 -1)
            if (student.isTransferredIn) return -1;
            // underline 학생 최상단 (가중치 0)
            if (student.underline) return 0;
            // enrollmentDate 기반 가중치
            if (student.enrollmentDate) {
                const days = Math.ceil((refDateMs - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                if (days <= 30) return 3;  // 30일 이내 신입생 최하단
                if (days <= 60) return 2;  // 31-60일 신입생 중간
            }
            return 1;  // 일반 학생
        };

        // 미래 퇴원예정 학생은 아직 재원생으로 표시 (영어 통합뷰와 동일)
        const isFutureWithdrawal = (s: any) => s.withdrawalDate && s.withdrawalDate > today;

        // 모든 병합 요일에 등원하는 학생 (공통)
        // 퇴원예정 학생도 재원생에 포함 (가로줄로 표시, 통합뷰와 동일)
        const commonActive = allStudents
            .filter(s => (!s.withdrawalDate || isFutureWithdrawal(s)) && !s.onHold && isStudentAttendingAllMergedDays(s))
            .sort((a, b) => {
                // 퇴원예정 학생은 하단에 배치
                const aIsWS = isFutureWithdrawal(a) && !a.isTransferred ? 1 : 0;
                const bIsWS = isFutureWithdrawal(b) && !b.isTransferred ? 1 : 0;
                if (aIsWS !== bIsWS) return aIsWS - bIsWS;
                const wA = getEnrollmentWeight(a), wB = getEnrollmentWeight(b);
                return wA !== wB ? wA - wB : (a.name || '').localeCompare(b.name || '', 'ko');
            })
            .filter(filterStudent);
        const commonHold = allStudents
            .filter(s => s.onHold && !s.withdrawalDate && isStudentAttendingAllMergedDays(s))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
            .filter(filterStudent);
        // 퇴원 학생: 과거/오늘 날짜 + 반이동이 아닌 실제 퇴원만
        const commonWithdrawn = allStudents
            .filter(s => s.withdrawalDate && s.withdrawalDate <= today && !s.isTransferred)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
            .filter(filterStudent);
        // 퇴원예정: 재원생 섹션에서 가로줄로 표시하므로 별도 섹션은 빈 배열
        const commonWithdrawnFuture: any[] = [];

        // 요일별 부분 등원 학생 (특정 요일만 오는 학생)
        const partial: Record<string, { active: any[]; hold: any[]; withdrawn: any[] }> = {};
        mergedDays.forEach(day => {
            // 퇴원예정 학생도 재원생에 포함 (가로줄로 표시, 통합뷰와 동일)
            const active = allStudents
                .filter(s => (!s.withdrawalDate || isFutureWithdrawal(s)) && !s.onHold && !isStudentAttendingAllMergedDays(s) && isStudentAttendingDay(s, day))
                .sort((a, b) => {
                    const aIsWS = isFutureWithdrawal(a) && !a.isTransferred ? 1 : 0;
                    const bIsWS = isFutureWithdrawal(b) && !b.isTransferred ? 1 : 0;
                    if (aIsWS !== bIsWS) return aIsWS - bIsWS;
                    const wA = getEnrollmentWeight(a), wB = getEnrollmentWeight(b);
                    return wA !== wB ? wA - wB : (a.name || '').localeCompare(b.name || '', 'ko');
                })
                .filter(filterStudent);
            const hold = allStudents
                .filter(s => s.onHold && !s.withdrawalDate && !isStudentAttendingAllMergedDays(s) && isStudentAttendingDay(s, day))
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
                .filter(filterStudent);
            // 퇴원 학생은 commonWithdrawn에서 통합 표시 (요일별 분리 X)
            partial[day] = { active, hold, withdrawn: [] };
        });

        return {
            commonStudents: { active: commonActive, hold: commonHold, withdrawn: commonWithdrawn, withdrawnFuture: commonWithdrawnFuture },
            partialStudentsByDay: partial
        };
    }, [isMergedCell, mergedDays, allStudents, refDateStr, refDateMs, filterStudent]);

    // 단일 셀: 해당 요일에 등원하는 학생만 (기존 로직)
    const { activeStudents, holdStudents, withdrawnStudents, withdrawnFutureStudents } = useMemo(() => {
        if (isMergedCell) {
            // 병합 셀에서는 사용하지 않음
            return { activeStudents: [], holdStudents: [], withdrawnStudents: [], withdrawnFutureStudents: [] };
        }

        const filterDay = currentDay || '';
        const today = refDateStr;

        // 신입생 정렬 가중치 함수 (영어 시간표와 동일)
        const getEnrollmentWeight = (student: any) => {
            // 반이동 학생 (다른 반에서 이동해 온 학생)이 가장 상단 (가중치 -1)
            if (student.isTransferredIn) return -1;
            if (student.underline) return 0;
            if (student.enrollmentDate) {
                const days = Math.ceil((refDateMs - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                if (days <= 30) return 3;
                if (days <= 60) return 2;
            }
            return 1;
        };

        // 미래 예정 학생은 아직 재원생으로 표시 (영어 통합뷰와 동일)
        const isFutureWithdrawal = (s: any) => s.withdrawalDate && s.withdrawalDate > today;

        // 퇴원예정 학생도 재원생에 포함 (가로줄로 표시, 통합뷰와 동일)
        const active = allStudents
            .filter(s => (!s.withdrawalDate || isFutureWithdrawal(s)) && !s.onHold && (filterDay ? isStudentAttendingDay(s, filterDay) : true))
            .sort((a, b) => {
                // 퇴원예정 학생은 하단에 배치
                const aIsWS = isFutureWithdrawal(a) && !a.isTransferred ? 1 : 0;
                const bIsWS = isFutureWithdrawal(b) && !b.isTransferred ? 1 : 0;
                if (aIsWS !== bIsWS) return aIsWS - bIsWS;
                const wA = getEnrollmentWeight(a), wB = getEnrollmentWeight(b);
                return wA !== wB ? wA - wB : (a.name || '').localeCompare(b.name || '', 'ko');
            })
            .filter(filterStudent);

        const hold = allStudents
            .filter(s => {
                if (!s.onHold || s.withdrawalDate) return false;
                if (filterDay && !isStudentAttendingDay(s, filterDay)) return false;
                // 수업시작일 기준 30일 전까지만 표시
                const enrollDate = s.enrollmentDate || s.startDate;
                if (enrollDate) {
                    const daysUntil = Math.floor((new Date(enrollDate).getTime() - refDateMs) / (1000 * 60 * 60 * 24));
                    return daysUntil <= 30;
                }
                return true;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
            .filter(filterStudent);

        // 퇴원 학생: 과거/오늘 날짜 + 반이동이 아닌 실제 퇴원만 (기준일 기준 30일 이내)
        const withdrawn = allStudents
            .filter(s => {
                if (!s.withdrawalDate || s.withdrawalDate > today || s.isTransferred) return false;
                const daysSince = Math.floor((refDateMs - new Date(s.withdrawalDate).getTime()) / (1000 * 60 * 60 * 24));
                return daysSince <= 30;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
            .filter(filterStudent);

        // 퇴원예정: 재원생 섹션에서 가로줄로 표시하므로 별도 섹션은 빈 배열
        const withdrawnFuture: any[] = [];

        return { activeStudents: active, holdStudents: hold, withdrawnStudents: withdrawn, withdrawnFutureStudents: withdrawnFuture };
    }, [isMergedCell, allStudents, currentDay, refDateStr, refDateMs, filterStudent]);

    // 병합 셀에서 부분 등원 학생이 있는지 확인
    const hasPartialStudents = isMergedCell && partialStudentsByDay &&
        mergedDays.some(day => partialStudentsByDay[day]?.active.length > 0);

    // 부분 등원 학생 수 (중복 제거) - 재원생 카운트에 합산 표시용
    const partialActiveCount = isMergedCell && partialStudentsByDay
        ? new Set(mergedDays.flatMap(d => (partialStudentsByDay[d]?.active || []).map((s: any) => s.id))).size
        : 0;

    // 병합 셀: 모든 대기 학생 (공통 + 부분등원 요일별) 통합
    // 부분등원(특정 요일만) 대기 학생이 누락되지 않도록 통합
    const allMergedHoldStudents = useMemo(() => {
        if (!isMergedCell || !partialStudentsByDay) return commonStudents.hold;
        const all = [...commonStudents.hold];
        const ids = new Set(all.map((s: any) => s.id));
        mergedDays.forEach(day => {
            (partialStudentsByDay[day]?.hold || []).forEach((s: any) => {
                if (!ids.has(s.id)) {
                    ids.add(s.id);
                    all.push(s);
                }
            });
        });
        return all.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }, [isMergedCell, commonStudents.hold, partialStudentsByDay, mergedDays]);

    // 교시 수(span)에 따른 재원생 최대 높이 계산
    // 1교시당 4명 기준 (1명당 약 21px)
    const maxStudentHeight = span * 4 * 21; // span * 4명 * 21px

    // 카드 전체 배경색 스타일 (키워드 색상 또는 흰색)
    const cardBgStyle = matchedKeyword
        ? { backgroundColor: matchedKeyword.bgColor }
        : { backgroundColor: '#ffffff' };

    // 수정 모드에서 수업명 헤더 클릭 핸들러
    const handleClassHeaderClick = (e: React.MouseEvent) => {
        if (isExcelMode) {
            // 엑셀 모드: 싱글클릭 → 셀 선택만
            e.stopPropagation();
            onCellSelect?.(cls.id);
            return;
        }
        if (canEdit) {
            if (isMergedClass && uniqueMergedNames.length > 1) return;
            e.stopPropagation();
            onClick(cls);
        }
    };

    // 엑셀 모드: 더블클릭 시 기존 모달 열기
    const handleClassHeaderDoubleClick = (e: React.MouseEvent) => {
        if (isExcelMode && canEdit) {
            if (isMergedClass && uniqueMergedNames.length > 1) return;
            e.stopPropagation();
            onClick(cls);
        }
    };

    // 엑셀 모드: 학생 자동완성 상태
    const [autoCompleteQuery, setAutoCompleteQuery] = useState('');
    const [showAutoComplete, setShowAutoComplete] = useState(false);
    const [acHighlightIndex, setAcHighlightIndex] = useState(0);
    const autoCompleteRef = useRef<HTMLInputElement>(null);

    // 자동완성 후보 학생 목록
    const autoCompleteResults = useMemo(() => {
        if (!isExcelMode || !autoCompleteQuery.trim() || !studentMap) return [];
        const query = autoCompleteQuery.trim().toLowerCase();
        const existingIds = new Set(
            (cls.studentIds || cls.studentList?.map((s: any) => s.id) || [])
        );
        return Object.values(studentMap)
            .filter((s: any) =>
                s.name?.toLowerCase().includes(query) &&
                !existingIds.has(s.id) &&
                s.status !== 'withdrawn'
            )
            .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }, [autoCompleteQuery, studentMap, cls, isExcelMode]);

    // 이 반에 대한 보류 등록 학생 (저장 전 가상 표시)
    const pendingEnrollmentStudents = useMemo(() => {
        if (!pendingExcelEnrollments || pendingExcelEnrollments.length === 0) return [];
        return pendingExcelEnrollments
            .filter(e => e.className === cls.className)
            .map(e => {
                const s = studentMap[e.studentId];
                return s ? { id: e.studentId, name: s.name, school: s.school, grade: s.grade } : null;
            })
            .filter(Boolean) as Array<{ id: string; name: string; school?: string; grade?: string }>;
    }, [pendingExcelEnrollments, cls.className, studentMap]);

    const handleEnrollStudent = useCallback((studentId: string) => {
        onEnrollStudent?.(studentId, cls.className);
        setAutoCompleteQuery('');
        setShowAutoComplete(false);
    }, [onEnrollStudent, cls.className]);

    // 병합 셀 내 zone 드래그 오버 상태 (로컬)
    const [dragOverZone, setDragOverZone] = useState<string | null>(null);
    const borderOverlayRef = useRef<HTMLDivElement>(null);

    // 전체 학생 최근 보고서 (ClassCard 레벨에서 1회 호출, 캐시 데이터만 읽음)
    const { data: allLatestReports } = useAllLatestReports();

    // 고스트 카드 (스케줄 변경 예정)
    if (cls.isPendingSchedule) {
        return (
            <div
                className="flex flex-col h-full overflow-hidden w-full max-w-full bg-gray-200 border border-dashed border-gray-400"
                style={{
                    ...(fixedCardHeight ? { height: `${fixedCardHeight}px`, maxHeight: `${fixedCardHeight}px` } : {}),
                    ...(compactMaxHeight ? { maxHeight: `${compactMaxHeight}px` } : {})
                }}
                title={`스케줄 변경 예정: ${cls.pendingScheduleDate}`}
            >
                {showClassName && (
                    <div
                        className="text-center font-bold px-0.5 mx-auto flex flex-col items-center justify-center shrink-0 overflow-hidden opacity-50"
                        style={{
                            width: `${cellSizePx}px`,
                            maxWidth: `${cellSizePx}px`,
                            padding: '2px 2px',
                        }}
                    >
                        <div className="min-w-0 w-full">
                            {classNameLines.map((line, i) => (
                                <span key={i} className={`block leading-tight ${titleFontSizeClass} whitespace-nowrap overflow-hidden text-gray-500`}>{line}</span>
                            ))}
                        </div>
                        <span className="text-xxs text-gray-500 font-normal">(예정)</span>
                    </div>
                )}
                {showStudents && (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-xxs text-gray-400">{cls.pendingScheduleDate}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            ref={cardRef}
            data-excel-card=""
            onDragOver={(e) => canEdit && onDragOver(e, cls.id)}
            onDragLeave={(e) => {
                if (canEdit) {
                    onDragLeave(e);
                    setDragOverZone(null);
                }
            }}
            onDrop={(e) => { if (canEdit) onDrop(e, cls.id, 'common'); }}
            onClick={isExcelMode ? (e) => { e.stopPropagation(); onCellSelect?.(cls.id); } : undefined}
            onDoubleClick={isExcelMode ? handleClassHeaderDoubleClick : undefined}
            className={`relative flex flex-col ${(fixedCardHeight && !fillCell) ? '' : 'h-full '}overflow-hidden transition-all w-full max-w-full ${isDragOver ? 'ring-2 ring-indigo-400 shadow-lg shadow-indigo-200' : ''} ${hasSearchMatch ? 'ring-2 ring-yellow-400' : ''} ${isExcelMode && isSelected ? 'ring-[3px] ring-blue-500 shadow-lg shadow-blue-200' : ''} ${isExcelMode ? 'cursor-pointer' : ''}`}
            style={{
                ...(isExcelMode && isSelected ? { backgroundColor: '#eff6ff' } : cardBgStyle),
                ...(fixedCardHeight && !fillCell ? { height: `${fixedCardHeight}px`, maxHeight: `${fixedCardHeight}px` } : {}),
                ...(compactMaxHeight && !fillCell ? { maxHeight: `${compactMaxHeight}px` } : {})
            }}
        >
            {/* 엑셀 모드: 선택된 학생이 있을 때 테두리 드래그 오버레이 */}
            {(() => {
                if (!hasSelectedInThisCard) return null;

                const handleBorderDrag = (e: React.DragEvent) => {
                    e.dataTransfer.effectAllowed = 'move';
                    const ids = [...selectedStudentIds!];
                    e.dataTransfer.setData('multiStudentIds', JSON.stringify(ids));
                    e.dataTransfer.setData('fromClassId', cls.id);
                    e.dataTransfer.setData('studentId', ids[0]);

                    // 커스텀 드래그 고스트: 선택된 학생 이름 표시
                    const ghost = document.createElement('div');
                    ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;background:#3b82f6;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.3);white-space:nowrap;z-index:99999;pointer-events:none;max-width:220px;';
                    const names = ids.map(id => {
                        const s = cls.studentList?.find(st => st.id === id) || studentMap[id];
                        return s?.name || '';
                    }).filter(Boolean);
                    if (names.length <= 3) {
                        ghost.textContent = `${names.join(', ')} 이동`;
                    } else {
                        ghost.textContent = `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}명 이동`;
                    }
                    document.body.appendChild(ghost);
                    e.dataTransfer.setDragImage(ghost, 10, 10);
                    requestAnimationFrame(() => document.body.removeChild(ghost));
                };
                // 드래그 시작 후 오버레이 전체를 숨겨서 같은 카드 내 드롭존이 이벤트를 받도록 함
                const hideOverlay = () => {
                    requestAnimationFrame(() => {
                        if (borderOverlayRef.current) {
                            borderOverlayRef.current.style.visibility = 'hidden';
                        }
                    });
                };
                const showOverlay = () => {
                    if (borderOverlayRef.current) {
                        borderOverlayRef.current.style.visibility = '';
                    }
                };
                return (
                    <div
                        ref={borderOverlayRef}
                        className="absolute inset-0 pointer-events-none z-20"
                        style={{ outline: '3px solid #3b82f6', outlineOffset: '-1px', borderRadius: '2px' }}
                    >
                        {/* 검색 입력창이 뜨는 상태면 하단 핸들들이 입력창을 덮어 클릭을 방해함.
                            하단 핸들은 아예 숨기고, 좌·우 핸들은 하단 검색창 영역만큼 높이를 줄인다. */}
                        {(() => {
                            const searchVisible = isExcelMode && isSelected && canEdit && mode === 'edit';
                            // 검색창 높이(border-t + p-1 + input) ≈ 32px
                            const sideBottomClass = searchVisible ? 'bottom-[32px]' : 'bottom-0';
                            return (
                                <>
                                    {/* 위 핸들 */}
                                    <div className="absolute top-0 left-0 right-0 h-[20px] pointer-events-auto cursor-move" draggable onDragStart={(e) => { handleBorderDrag(e); hideOverlay(); }} onDragEnd={showOverlay} />
                                    {/* 아래 핸들 — 검색창 있을 땐 숨김 */}
                                    {!searchVisible && (
                                        <div className="absolute bottom-0 left-0 right-0 h-[20px] pointer-events-auto cursor-move" draggable onDragStart={(e) => { handleBorderDrag(e); hideOverlay(); }} onDragEnd={showOverlay} />
                                    )}
                                    {/* 왼쪽 핸들 */}
                                    <div className={`absolute top-0 left-0 ${sideBottomClass} w-[20px] pointer-events-auto cursor-move`} draggable onDragStart={(e) => { handleBorderDrag(e); hideOverlay(); }} onDragEnd={showOverlay} />
                                    {/* 오른쪽 핸들 */}
                                    <div className={`absolute top-0 right-0 ${sideBottomClass} w-[28px] pointer-events-auto cursor-move`} draggable onDragStart={(e) => { handleBorderDrag(e); hideOverlay(); }} onDragEnd={showOverlay} />
                                </>
                            );
                        })()}
                    </div>
                );
            })()}

            {/* Class Name Header - 수정 모드에서 클릭 시 수업 상세 모달, 조회 모드에서 마우스 오버시 스케줄 툴팁 */}
            {showClassName && (
                <div
                    ref={headerRef}
                    onClick={handleClassHeaderClick}
                    className={`relative text-center font-bold px-0.5 mx-auto ${canEdit ? 'cursor-pointer hover:brightness-95' : 'cursor-pointer'} ${showStudents ? 'border-b border-gray-300' : ''} flex flex-col items-center justify-center shrink-0 overflow-hidden`}
                    style={{
                        width: `${cellSizePx}px`,
                        maxWidth: `${cellSizePx}px`,
                        padding: '2px 2px',
                        color: matchedKeyword ? matchedKeyword.textColor : '#111827'
                    }}
                    title={`${cls.className}${cls.room ? `\n${cls.room}` : ''}`}
                    onMouseEnter={() => !canEdit && setShowScheduleTooltip(true)}
                    onMouseLeave={() => setShowScheduleTooltip(false)}
                >
                    {isAssistantTeacher && (
                        <span className="absolute top-0 left-0 z-10 text-[10px] leading-none bg-gray-800 text-white px-0.5 py-0.5 font-bold whitespace-nowrap animate-pulse">부담임</span>
                    )}
                    {/* 강사 인수인계 예정 배지 (pendingTeacher + pendingTeacherDate 있을 때) */}
                    {cls.pendingTeacher && cls.pendingTeacherDate && (
                        <span
                            className="absolute top-0 right-0 z-10 text-[9px] leading-none bg-emerald-600 text-white px-1 py-0.5 font-bold whitespace-nowrap"
                            title={`${cls.pendingTeacherDate}부터 ${cls.pendingTeacher} 담임으로 인수인계 예정${cls.pendingTeacherReason ? `\n사유: ${cls.pendingTeacherReason}` : ''}`}
                        >
                            🔄 {cls.pendingTeacherDate.slice(5)}
                        </span>
                    )}
                    {isMergedClass && uniqueMergedNames.length > 1 ? (
                        /* 합반: 수업명 가로 2등분 */
                        <div className="flex w-full h-full">
                            {uniqueMergedNames.map((mc, idx) => {
                                const name = mc.className || '';
                                const nameIdx = name.indexOf(' ');
                                const lines = nameIdx === -1 ? [name] : [name.slice(0, nameIdx), name.slice(nameIdx + 1)];
                                return (
                                    <div key={mc.id} className={`flex-1 overflow-hidden relative flex flex-col items-center justify-center ${canEdit ? 'cursor-pointer hover:brightness-90' : ''}`} style={{ borderRight: idx < uniqueMergedNames.length - 1 ? '1px dashed #ccc' : undefined }} onClick={canEdit ? (e) => { e.stopPropagation(); onClick(mc); } : undefined}>
                                        <span className="absolute top-0 left-0 z-10 text-[10px] leading-none bg-gray-800 text-white px-0.5 py-0.5 font-bold whitespace-nowrap animate-pulse">{`합반${idx + 1}`}</span>
                                        <div className="min-w-0 w-full text-center pt-1">
                                            {lines.map((line, i) => (
                                                <span key={i} className={`block leading-tight ${titleFontSizeClass} whitespace-nowrap overflow-hidden text-black`}>{line}</span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* 단일 수업 또는 같은 이름 합반 */
                        <>
                        {(isMergedClass || showMergedLabel) && (
                            <span className={`absolute ${isAssistantTeacher ? 'top-2.5' : 'top-0'} left-0 z-10 text-[10px] leading-none bg-gray-800 text-white px-0.5 py-0.5 font-bold whitespace-nowrap animate-pulse`}>합반</span>
                        )}
                        <div className="relative min-w-0 w-full">
                            {classNameLines.map((line, i) => (
                                <span key={i} className={`block leading-tight ${titleFontSizeClass} whitespace-nowrap overflow-hidden text-black`}>{line}</span>
                            ))}
                        </div>
                        </>
                    )}
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
                    {showScheduleTooltip && (scheduleInfo.length > 0 || latestTextbook || latestProgressInfo) && createPortal(
                        <div
                            className="fixed bg-gray-900 text-white text-xs rounded-sm shadow-xl p-2 min-w-[140px] whitespace-nowrap pointer-events-none"
                            style={{
                                left: tooltipPosition.x,
                                top: tooltipPosition.y,
                                zIndex: 9999
                            }}
                        >
                            {scheduleInfo.length > 0 && (
                            <>
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
                            </>
                            )}
                            {latestTextbook && (
                                <div className={scheduleInfo.length > 0 ? "mt-1.5 pt-1.5 border-t border-gray-700" : ""}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <BookOpen size={12} className="text-green-400" />
                                        <span className="font-bold">교재</span>
                                    </div>
                                    <div className="text-gray-200">{latestTextbook.textbookName}</div>
                                    <div className="text-gray-400 mt-0.5" style={{ fontSize: '10px' }}>
                                        배부일: {latestTextbook.distributedAt.slice(0, 10)}
                                    </div>
                                </div>
                            )}
                            {latestProgressInfo && (
                                <div className={scheduleInfo.length > 0 || latestTextbook ? "mt-1.5 pt-1.5 border-t border-gray-700" : ""}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <BookOpen size={12} className="text-blue-400" />
                                        <span className="font-bold">최근 진도</span>
                                    </div>
                                    <div className="text-gray-400 text-[10px] mb-0.5">
                                        {latestProgressInfo.date} ({latestProgressInfo.studentName})
                                    </div>
                                    <div className="text-gray-200 text-[10px] max-w-[200px] whitespace-normal">
                                        {latestProgressInfo.progress.length > 60 
                                            ? latestProgressInfo.progress.substring(0, 60) + '...'
                                            : latestProgressInfo.progress}
                                    </div>
                                    {latestProgressInfo.teacherName && (
                                        <div className="text-gray-400 mt-0.5" style={{ fontSize: '10px' }}>
                                            선생님: {latestProgressInfo.teacherName}
                                        </div>
                                    )}
                                </div>
                            )}
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
                            <ul className="flex flex-col gap-0 min-w-0 list-none">
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
                                            themeText={theme.studentText || 'text-gray-800'}
                                            isPendingMoved={!!pendingMoveToMap?.get(cls.id)?.has(s.id)}
                                            isPendingMovedFrom={!!pendingMoveFromMap?.get(cls.id)?.has(s.id)}
                                            pendingScheduledDate={pendingMoveSchedules?.get(s.id) || undefined}
                                            isTransferScheduled={!!(s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr)}
                                            transferScheduledDate={s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr ? s.withdrawalDate : undefined}
                                            transferTo={s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr ? s.transferTo : undefined}
                                            isWithdrawalScheduled={!!(!s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr)}
                                            withdrawalScheduledDate={!s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr ? s.withdrawalDate : undefined}
                                            classLabel={isMergedClass ? s._classLabel : undefined}
                                            textbookInfo={studentTextbookMap?.get(s.name) || null}
                                            isExcelMode={isExcelMode}
                                            mode={mode}
                                            onCellSelect={onCellSelect}
                                            isStudentSelected={isExcelMode && !!selectedStudentIds?.has(s.id) && selectedStudentClassName === cls.className}
                                            isCopiedStudent={isExcelMode && !!copiedStudentIds?.includes(s.id) && copiedStudentClassName === cls.className}
                                            isCutStudent={isExcelMode && !!cutStudentIds?.includes(s.id) && cutStudentClassName === cls.className}
                                            isAcHighlighted={isExcelMode && acHighlightStudentId === s.id}
                                            onStudentSelect={onStudentSelect}
                                            onStudentMultiSelect={onStudentMultiSelect}
                                            selectedStudentIds={selectedStudentIds}
                                            className={cls.className}
                                            isPendingExcelDelete={!!pendingExcelDeleteIds?.has(`${s.id}_${cls.className}`)}
                                            latestReport={allLatestReports?.get(s.name) || null}
                                        />
                                    );
                                })}
                                {/* 보류 등록 학생 (저장 전 가상 표시) */}
                                {pendingEnrollmentStudents.map(s => (
                                    <li
                                        key={`pending-enroll-${s.id}`}
                                        className={`py-0 px-0.5 ${fontSizeClass} leading-[1.3] overflow-hidden whitespace-nowrap bg-green-100 text-green-700 border border-dashed border-green-400 flex items-center justify-between group/pending`}
                                        title="저장 대기 중 (X 또는 Del로 취소)"
                                    >
                                        {onCancelPendingEnroll && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onCancelPendingEnroll(s.id, cls.className); }}
                                                className="mr-0.5 text-green-500 hover:text-red-500 shrink-0 text-[11px] leading-none"
                                                title="등록 취소"
                                            >×</button>
                                        )}
                                        <span className="truncate">+ {s.name}{showSchool || showGrade ? `/${formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null)}` : ''}</span>
                                    </li>
                                ))}
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
                                                                themeText={theme.studentText || 'text-gray-800'}
                                                                isPendingMoved={!!pendingMoveToMap?.get(cls.id)?.has(s.id)}
                                            isPendingMovedFrom={!!pendingMoveFromMap?.get(cls.id)?.has(s.id)}
                                                                pendingScheduledDate={pendingMoveSchedules?.get(s.id) || undefined}
                                                                isTransferScheduled={!!(s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr)}
                                                                transferScheduledDate={s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr ? s.withdrawalDate : undefined}
                                                                transferTo={s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr ? s.transferTo : undefined}
                                                                isWithdrawalScheduled={!!(!s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr)}
                                                                withdrawalScheduledDate={!s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr ? s.withdrawalDate : undefined}
                                                                classLabel={isMergedClass ? s._classLabel : undefined}
                                                                textbookInfo={studentTextbookMap?.get(s.name) || null}
                                                                isExcelMode={isExcelMode}
                                                                mode={mode}
                                                                onCellSelect={onCellSelect}
                                                                isStudentSelected={isExcelMode && !!selectedStudentIds?.has(s.id) && selectedStudentClassName === cls.className}
                                                                isCopiedStudent={isExcelMode && !!copiedStudentIds?.includes(s.id) && copiedStudentClassName === cls.className}
                                                                isCutStudent={isExcelMode && !!cutStudentIds?.includes(s.id) && cutStudentClassName === cls.className}
                                                                onStudentSelect={onStudentSelect}
                                                                onStudentMultiSelect={onStudentMultiSelect}
                                                                selectedStudentIds={selectedStudentIds}
                                                                className={cls.className}
                                                                isPendingExcelDelete={!!pendingExcelDeleteIds?.has(`${s.id}_${cls.className}`)}
                                                                latestReport={allLatestReports?.get(s.name) || null}
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
                                                    onDrop={(e) => {
                                                        if (!canEdit) return;
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setDragOverZone(null);
                                                        onDrop(e, cls.id, d);
                                                    }}
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

                        {/* 대기 + 퇴원 (스크롤 영역 바깥, 셀 하단 고정) */}
                        {(showHoldStudents || showWithdrawnStudents) && (
                            <div className="flex-shrink-0 overflow-visible">
                                {showHoldStudents && allMergedHoldStudents.length > 0 && (
                                    <div className="px-0.5 py-0 bg-pink-50 border-b border-pink-200">
                                        <div className={`${fontSizeClass} font-bold text-pink-600 overflow-hidden whitespace-nowrap`}>{allMergedHoldStudents.length}명 - 대기</div>
                                        <ul className="flex flex-col gap-0 list-none">
                                            {allMergedHoldStudents.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                const tooltipText = s.enrollmentDate ? `예정일: ${s.enrollmentDate}` : undefined;
                                                return (
                                                    <li
                                                        key={s.id}
                                                        className={`${fontSizeClass} leading-[1.3] bg-amber-50 text-amber-800 px-0.5 py-0 overflow-hidden whitespace-nowrap cursor-pointer hover:bg-amber-100 transition-colors`}
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
                                {/* 퇴원예정 Section (미래 날짜 + 다른 반 등록 없음 = 실제 퇴원) */}
                                {showWithdrawnStudents && commonStudents.withdrawnFuture.length > 0 && (
                                    <div className="px-0.5 py-0 bg-red-50">
                                        <div className={`${fontSizeClass} font-bold text-red-500 overflow-hidden whitespace-nowrap`}>{commonStudents.withdrawnFuture.length}명 - 퇴원예정</div>
                                        <ul className="flex flex-col gap-0 list-none">
                                            {commonStudents.withdrawnFuture.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                const tooltipText = s.withdrawalDate ? `퇴원예정: ${s.withdrawalDate}` : undefined;
                                                return (
                                                    <li
                                                        key={s.id}
                                                        className={`${fontSizeClass} leading-[1.3] bg-red-100 text-red-700 px-0.5 py-0 overflow-hidden whitespace-nowrap cursor-pointer hover:bg-red-200 transition-colors`}
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
                                {showWithdrawnStudents && commonStudents.withdrawn.length > 0 && (
                                    <div className="px-0.5 py-0 bg-gray-100">
                                        <div className={`${fontSizeClass} font-bold text-gray-600 overflow-hidden whitespace-nowrap`}>{commonStudents.withdrawn.length}명 - 퇴원</div>
                                        <ul className="flex flex-col gap-0 list-none">
                                            {commonStudents.withdrawn.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                const tooltipText = s.withdrawalDate ? `퇴원일: ${s.withdrawalDate}` : undefined;
                                                // 기본뷰·테스트뷰 동일 동작: 드래그 가능 + 더블클릭 모달 (영어탭과 일관)
                                                return (
                                                    <li
                                                        key={s.id}
                                                        draggable={canEdit}
                                                        onDragStart={(e) => { if (canEdit) onDragStart(e, s.id, cls.id, 'common'); }}
                                                        className={`${fontSizeClass} leading-[1.3] bg-black text-white px-0.5 py-0 overflow-hidden whitespace-nowrap ${canEdit ? 'cursor-grab' : 'cursor-default'} hover:bg-gray-700 transition-colors`}
                                                        title={tooltipText}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onDoubleClick={(e) => {
                                                            if (onStudentClick) { e.stopPropagation(); onStudentClick(s.id); }
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

                        {/* 퇴원 드롭존 (병합 셀) */}
                        {canEdit && onWithdrawalDrop && (
                            <div
                                className={`flex-shrink-0 border-t border-red-300 flex items-center justify-center transition-all cursor-default ${
                                    dragOverZone === 'withdrawal'
                                        ? 'bg-red-200 ring-2 ring-inset ring-red-400 text-red-700 font-bold'
                                        : 'bg-red-50 text-red-400'
                                }`}
                                style={{ minHeight: '24px' }}
                                onDragOver={(e) => { if (!canEdit) return; e.preventDefault(); e.stopPropagation(); setDragOverZone('withdrawal'); }}
                                onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setDragOverZone(null); }}
                                onDrop={(e) => {
                                    if (!canEdit) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverZone(null);
                                    const studentId = e.dataTransfer.getData('studentId');
                                    if (studentId) onWithdrawalDrop(studentId, cls.id, cls.className);
                                }}
                            >
                                <span className="text-xxs">{dragOverZone === 'withdrawal' ? '▼ 퇴원' : '퇴원'}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
                        <div className="flex-1 px-0.5 py-0.5 min-w-0 min-h-0 overflow-y-auto no-scrollbar fade-bottom overscroll-contain">
                            <div className={`${fontSizeClass} font-bold text-indigo-600 mb-0 overflow-hidden whitespace-nowrap`}>{activeStudents.length}명 - 재원생</div>
                            <ul className="flex flex-col min-w-0 list-none">
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
                                            classId={cls.id}
                                            fontSizeClass={fontSizeClass}
                                            isHighlighted={isHighlighted}
                                            enrollmentStyle={enrollmentStyle}
                                            themeText={theme.studentText || 'text-gray-800'}
                                            isPendingMoved={!!pendingMoveToMap?.get(cls.id)?.has(s.id)}
                                            isPendingMovedFrom={!!pendingMoveFromMap?.get(cls.id)?.has(s.id)}
                                            pendingScheduledDate={pendingMoveSchedules?.get(s.id) || undefined}
                                            isTransferScheduled={!!(s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr)}
                                            transferScheduledDate={s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr ? s.withdrawalDate : undefined}
                                            transferTo={s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr ? s.transferTo : undefined}
                                            isWithdrawalScheduled={!!(!s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr)}
                                            withdrawalScheduledDate={!s.isTransferred && s.withdrawalDate && s.withdrawalDate > refDateStr ? s.withdrawalDate : undefined}
                                            classLabel={isMergedClass ? s._classLabel : undefined}
                                            textbookInfo={studentTextbookMap?.get(s.name) || null}
                                            isExcelMode={isExcelMode}
                                            mode={mode}
                                            onCellSelect={onCellSelect}
                                            isStudentSelected={isExcelMode && !!selectedStudentIds?.has(s.id) && selectedStudentClassName === cls.className}
                                            isCopiedStudent={isExcelMode && !!copiedStudentIds?.includes(s.id) && copiedStudentClassName === cls.className}
                                            isCutStudent={isExcelMode && !!cutStudentIds?.includes(s.id) && cutStudentClassName === cls.className}
                                            isAcHighlighted={isExcelMode && acHighlightStudentId === s.id}
                                            onStudentSelect={onStudentSelect}
                                            onStudentMultiSelect={onStudentMultiSelect}
                                            selectedStudentIds={selectedStudentIds}
                                            className={cls.className}
                                            isPendingExcelDelete={!!pendingExcelDeleteIds?.has(`${s.id}_${cls.className}`)}
                                            latestReport={allLatestReports?.get(s.name) || null}
                                        />
                                    );
                                })}
                                {/* 보류 등록 학생 (저장 전 가상 표시) */}
                                {pendingEnrollmentStudents.map(s => (
                                    <li
                                        key={`pending-enroll-${s.id}`}
                                        className={`py-0 px-0.5 ${fontSizeClass} leading-[1.3] overflow-hidden whitespace-nowrap bg-green-100 text-green-700 border border-dashed border-green-400 flex items-center justify-between group/pending`}
                                        title="저장 대기 중 (X 또는 Del로 취소)"
                                    >
                                        {onCancelPendingEnroll && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onCancelPendingEnroll(s.id, cls.className); }}
                                                className="mr-0.5 text-green-500 hover:text-red-500 shrink-0 text-[11px] leading-none"
                                                title="등록 취소"
                                            >×</button>
                                        )}
                                        <span className="truncate">+ {s.name}{showSchool || showGrade ? `/${formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null)}` : ''}</span>
                                    </li>
                                ))}
                            </ul>

                        </div>

                        {/* 대기 + 퇴원 (스크롤 영역 바깥, 셀 하단 고정) */}
                        {(showHoldStudents || showWithdrawnStudents) && (
                            <div className="flex-shrink-0 overflow-visible">
                                {/* 대기생 Section */}
                                {showHoldStudents && holdStudents.length > 0 && (
                                    <div className="px-0.5 py-0 bg-pink-50 border-b border-pink-200">
                                        <div className={`${fontSizeClass} font-bold text-pink-600 overflow-hidden whitespace-nowrap`}>{holdStudents.length}명 - 대기</div>
                                        <ul className="flex flex-col gap-0 list-none">
                                            {holdStudents.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                const tooltipText = s.enrollmentDate ? `예정일: ${s.enrollmentDate}` : undefined;
                                                const isScheduledStudent = !!(s as any).isScheduled;
                                                return (
                                                    <li
                                                        key={s.id}
                                                        className={`${fontSizeClass} leading-[1.3] bg-amber-50 text-amber-800 px-0.5 py-0 overflow-hidden whitespace-nowrap cursor-pointer hover:bg-amber-100 transition-colors flex items-center group`}
                                                        title={tooltipText}
                                                        onClick={(e) => {
                                                            if (onStudentClick) {
                                                                e.stopPropagation();
                                                                onStudentClick(s.id);
                                                            }
                                                        }}
                                                    >
                                                        {isScheduledStudent && canEdit && onCancelScheduledEnrollment && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm(`${s.name} 학생의 배정 예정을 취소하시겠습니까?`)) {
                                                                        onCancelScheduledEnrollment(s.id, cls.className);
                                                                    }
                                                                }}
                                                                className="mr-0.5 text-red-400 hover:text-red-600 shrink-0 text-[11px] leading-none"
                                                                title="배정 예정 취소"
                                                            >
                                                                &times;
                                                            </button>
                                                        )}
                                                        <span className="flex-1 truncate">{text}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                {/* 퇴원예정 Section (미래 날짜 + 다른 반 등록 없음 = 실제 퇴원) */}
                                {showWithdrawnStudents && withdrawnFutureStudents.length > 0 && (
                                    <div className="px-0.5 py-0 bg-red-50">
                                        <div className={`${fontSizeClass} font-bold text-red-500 overflow-hidden whitespace-nowrap`}>{withdrawnFutureStudents.length}명 - 퇴원예정</div>
                                        <ul className="flex flex-col gap-0 list-none">
                                            {withdrawnFutureStudents.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                return (
                                                    <li
                                                        key={s.id}
                                                        className={`${fontSizeClass} leading-[1.3] bg-red-100 text-red-700 px-0.5 py-0 overflow-hidden whitespace-nowrap cursor-pointer hover:bg-red-200 transition-colors`}
                                                        title={s.withdrawalDate ? `퇴원예정: ${s.withdrawalDate}` : text}
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

                                {/* 퇴원생 Section */}
                                {showWithdrawnStudents && withdrawnStudents.length > 0 && (
                                    <div className="px-0.5 py-0 bg-gray-100">
                                        <div className={`${fontSizeClass} font-bold text-gray-600 overflow-hidden whitespace-nowrap`}>{withdrawnStudents.length}명 - 퇴원</div>
                                        <ul className="flex flex-col gap-0 list-none">
                                            {withdrawnStudents.map(s => {
                                                let text = s.name;
                                                if (showSchool || showGrade) {
                                                    const sg = formatSchoolGrade(showSchool ? s.school : null, showGrade ? s.grade : null);
                                                    if (sg && sg !== '-') text += `/${sg}`;
                                                }
                                                // 기본뷰·테스트뷰 동일 동작: 드래그 가능 + 더블클릭 모달 (영어탭과 일관)
                                                return (
                                                    <li
                                                        key={s.id}
                                                        draggable={canEdit}
                                                        onDragStart={(e) => { if (canEdit) onDragStart(e, s.id, cls.id, 'common'); }}
                                                        className={`${fontSizeClass} leading-[1.3] bg-black text-white px-0.5 py-0 overflow-hidden whitespace-nowrap ${canEdit ? 'cursor-grab' : 'cursor-default'} hover:bg-gray-700 transition-colors`}
                                                        title={s.withdrawalDate ? `${text} (퇴원: ${s.withdrawalDate})` : text}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onDoubleClick={(e) => {
                                                            if (onStudentClick) { e.stopPropagation(); onStudentClick(s.id); }
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

                        {/* 퇴원 드롭존 (단일 셀) */}
                        {canEdit && onWithdrawalDrop && (
                            <div
                                className={`flex-shrink-0 border-t border-red-300 flex items-center justify-center transition-all cursor-default ${
                                    dragOverZone === 'withdrawal'
                                        ? 'bg-red-200 ring-2 ring-inset ring-red-400 text-red-700 font-bold'
                                        : 'bg-red-50 text-red-400'
                                }`}
                                style={{ minHeight: '24px' }}
                                onDragOver={(e) => { if (!canEdit) return; e.preventDefault(); e.stopPropagation(); setDragOverZone('withdrawal'); }}
                                onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setDragOverZone(null); }}
                                onDrop={(e) => {
                                    if (!canEdit) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverZone(null);
                                    const studentId = e.dataTransfer.getData('studentId');
                                    if (studentId) onWithdrawalDrop(studentId, cls.id, cls.className);
                                }}
                            >
                                <span className="text-xxs">{dragOverZone === 'withdrawal' ? '▼ 퇴원' : '퇴원'}</span>
                            </div>
                        )}
                    </div>
                )
            )}
            {/* 엑셀 모드: 학생 자동완성 입력 */}
            {isExcelMode && isSelected && canEdit && mode === 'edit' && (
                <div className="flex-shrink-0 border-t border-gray-300 p-1 bg-blue-50" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                        <input
                            ref={autoCompleteRef}
                            type="text"
                            value={autoCompleteQuery}
                            onChange={(e) => {
                                setAutoCompleteQuery(e.target.value);
                                setShowAutoComplete(true);
                                setAcHighlightIndex(0);
                            }}
                            onFocus={() => setShowAutoComplete(true)}
                            onBlur={() => {
                                // 딜레이: 클릭 이벤트 처리 후 닫기
                                setTimeout(() => {
                                    onAcHighlightChange?.(null);
                                }, 200);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setShowAutoComplete(false);
                                    setAutoCompleteQuery('');
                                    onAcHighlightChange?.(null);
                                }
                                if (e.key === 'ArrowDown' && autoCompleteResults.length > 0) {
                                    e.preventDefault();
                                    setAcHighlightIndex(prev => {
                                        const next = Math.min(prev + 1, autoCompleteResults.length - 1);
                                        onAcHighlightChange?.((autoCompleteResults[next] as any).id);
                                        return next;
                                    });
                                }
                                if (e.key === 'ArrowUp' && autoCompleteResults.length > 0) {
                                    e.preventDefault();
                                    setAcHighlightIndex(prev => {
                                        const next = Math.max(prev - 1, 0);
                                        onAcHighlightChange?.((autoCompleteResults[next] as any).id);
                                        return next;
                                    });
                                }
                                if (e.key === 'Enter' && autoCompleteResults.length > 0) {
                                    const idx = Math.min(acHighlightIndex, autoCompleteResults.length - 1);
                                    handleEnrollStudent((autoCompleteResults[idx] as any).id);
                                    onAcHighlightChange?.(null);
                                    setAcHighlightIndex(0);
                                }
                            }}
                            placeholder="학생 검색..."
                            className="w-full px-1.5 py-0.5 text-xxs border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
                        />
                        {showAutoComplete && autoCompleteResults.length > 0 && (
                            <ul className="absolute z-50 left-0 right-0 bottom-full mb-0.5 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                                {autoCompleteResults.map((s: any, idx: number) => (
                                    <li
                                        key={s.id}
                                        onClick={() => {
                                            handleEnrollStudent(s.id);
                                            onAcHighlightChange?.(null);
                                            setAcHighlightIndex(0);
                                        }}
                                        onMouseEnter={() => {
                                            setAcHighlightIndex(idx);
                                            onAcHighlightChange?.(s.id);
                                        }}
                                        onMouseLeave={() => {
                                            onAcHighlightChange?.(null);
                                        }}
                                        className={`px-1.5 py-0.5 text-xxs cursor-pointer flex flex-col ${idx === acHighlightIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                                    >
                                        <div className="flex justify-between">
                                            <span className="font-medium">{s.name}</span>
                                            <span className="text-gray-400">{formatSchoolGrade(s.school, s.grade)}</span>
                                        </div>
                                        <SubjectBadges enrollments={s.enrollments} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
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
        prevProps.showMergedLabel === nextProps.showMergedLabel &&
        prevProps.isAssistantTeacher === nextProps.isAssistantTeacher &&
        prevProps.pendingMoveSchedules === nextProps.pendingMoveSchedules &&
        prevProps.latestTextbook === nextProps.latestTextbook &&
        prevProps.latestReports === nextProps.latestReports &&
        prevProps.studentTextbookMap === nextProps.studentTextbookMap &&
        prevProps.isExcelMode === nextProps.isExcelMode &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.selectedStudentIds === nextProps.selectedStudentIds &&
        prevProps.selectedStudentClassName === nextProps.selectedStudentClassName &&
        prevProps.copiedStudentIds === nextProps.copiedStudentIds &&
        prevProps.copiedStudentClassName === nextProps.copiedStudentClassName &&
        prevProps.pendingExcelDeleteIds === nextProps.pendingExcelDeleteIds &&
        prevProps.pendingExcelEnrollments === nextProps.pendingExcelEnrollments &&
        prevProps.referenceDate === nextProps.referenceDate &&
        prevProps.mode === nextProps.mode &&
        prevProps.acHighlightStudentId === nextProps.acHighlightStudentId &&
        prevProps.cutStudentIds === nextProps.cutStudentIds &&
        prevProps.cutStudentClassName === nextProps.cutStudentClassName &&
        prevProps.studentFilter === nextProps.studentFilter &&
        prevProps.shuttleStudentNames === nextProps.shuttleStudentNames &&
        prevProps.pendingMovedStudentIds === nextProps.pendingMovedStudentIds &&
        prevProps.pendingMoveFromMap === nextProps.pendingMoveFromMap &&
        prevProps.weeklyAbsent === nextProps.weeklyAbsent
    );
});
